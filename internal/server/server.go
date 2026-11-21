package server

import (
	"context"
	"encoding/json"
	"errors"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"claudia/internal/claude"
	"claudia/internal/schema"
)

// Header must be sent with every API request. Browsers do not let other sites
// set custom headers on cross-origin requests without a preflight, which this
// server never approves.
const Header = "X-Claudia"

type Server struct {
	paths      claude.Paths
	folders    *folders
	schemas    *schema.Loader
	version    string
	pickFolder func(context.Context) (string, error)
	picking    sync.Mutex
	cli        sync.Mutex
}

func New(paths claude.Paths, version string) (*Server, error) {
	f, err := newFolders()
	if err != nil {
		return nil, err
	}
	return &Server{
		paths:      paths,
		folders:    f,
		schemas:    schema.NewLoader(),
		version:    version,
		pickFolder: pickFolder,
	}, nil
}

// Handler serves the API and passes other requests to ui.
// Only requests for the given port on loopback host names are accepted.
func (s *Server) Handler(port string, ui http.Handler) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.health)
	mux.HandleFunc("GET /api/projects", s.listProjects)
	mux.HandleFunc("POST /api/projects", s.addProject)
	mux.HandleFunc("DELETE /api/projects", s.removeProject)
	mux.HandleFunc("POST /api/pick-folder", s.selectFolder)
	mux.HandleFunc("GET /api/files", s.readFile)
	mux.HandleFunc("PUT /api/files", s.writeFile)
	mux.HandleFunc("DELETE /api/files", s.deleteFile)
	mux.HandleFunc("GET /api/memory", s.listMemory)
	mux.HandleFunc("GET /api/mcp", s.listMCP)
	mux.HandleFunc("PUT /api/mcp", s.saveMCP)
	mux.HandleFunc("DELETE /api/mcp", s.deleteMCP)
	mux.HandleFunc("GET /api/plugins", s.listPlugins)
	mux.HandleFunc("GET /api/marketplaces", s.listMarketplaces)
	mux.HandleFunc("GET /api/skills", s.listSkills)
	mux.HandleFunc("GET /api/schema", s.settingsSchema)
	mux.Handle("/api/", http.NotFoundHandler())
	mux.Handle("/", ui)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !allowedHost(r.Host, port) {
			http.Error(w, "forbidden host", http.StatusForbidden)
			return
		}
		if isAPI(r) && r.Header.Get(Header) == "" {
			http.Error(w, "missing "+Header+" header", http.StatusForbidden)
			return
		}
		mux.ServeHTTP(w, r)
	})
}

// allowedHost blocks DNS rebinding, where a remote site resolves its own name to 127.0.0.1.
func allowedHost(host, port string) bool {
	name, p, err := net.SplitHostPort(host)
	if err != nil || p != port {
		return false
	}
	return name == "localhost" || name == "127.0.0.1"
}

func isAPI(r *http.Request) bool {
	return strings.HasPrefix(r.URL.Path, "/api/")
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	home, _ := os.UserHomeDir()
	writeJSON(w, http.StatusOK, map[string]string{"app": "claudia", "version": s.version, "home": home})
}

func (s *Server) listProjects(w http.ResponseWriter, r *http.Request) {
	saved, err := s.folders.list()
	if err != nil {
		writeError(w, err)
		return
	}
	projects, err := s.paths.Projects(saved)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, projects)
}

func (s *Server) addProject(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, errBadRequest)
		return
	}
	dir, err := s.paths.ProjectDir(body.Path)
	if err != nil {
		writeError(w, err)
		return
	}
	if err := s.folders.add(dir); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, claude.Project{Path: dir, Name: filepath.Base(dir), Saved: true})
}

func (s *Server) removeProject(w http.ResponseWriter, r *http.Request) {
	if err := s.folders.remove(r.URL.Query().Get("path")); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) readFile(w http.ResponseWriter, r *http.Request) {
	path, err := s.filePath(r)
	if err != nil {
		writeError(w, err)
		return
	}
	file, err := claude.ReadFile(path)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, file)
}

func (s *Server) writeFile(w http.ResponseWriter, r *http.Request) {
	path, err := s.filePath(r)
	if err != nil {
		writeError(w, err)
		return
	}
	var body struct {
		Content string `json:"content"`
		Version string `json:"version"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, errBadRequest)
		return
	}
	kind := claude.Kind(r.URL.Query().Get("kind"))
	file, err := claude.WriteFile(path, kind, body.Content, body.Version)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, file)
}

func (s *Server) filePath(r *http.Request) (string, error) {
	q := r.URL.Query()
	kind := claude.Kind(q.Get("kind"))
	switch kind {
	case claude.KindSkill:
		return s.paths.SkillFile(q.Get("dir"), q.Get("name"))
	case claude.KindMemoryNote:
		return s.paths.MemoryNoteFile(q.Get("dir"), q.Get("name"))
	}
	return s.paths.File(q.Get("dir"), kind)
}

func (s *Server) settingsSchema(w http.ResponseWriter, r *http.Request) {
	result, err := s.schemas.Load()
	if err != nil {
		log.Printf("settings schema: %v", err)
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Could not read the settings schema from Claude Code."})
		return
	}
	writeJSON(w, http.StatusOK, result)
}

// deleteFile only deletes memory notes. Other files are emptied in the editor instead.
func (s *Server) deleteFile(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	if claude.Kind(q.Get("kind")) != claude.KindMemoryNote {
		writeError(w, claude.ErrUnknownKind)
		return
	}
	if err := s.paths.DeleteMemoryNote(q.Get("dir"), q.Get("name")); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) listMemory(w http.ResponseWriter, r *http.Request) {
	memory, err := s.paths.Memory(r.URL.Query().Get("dir"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, memory)
}

func (s *Server) listMarketplaces(w http.ResponseWriter, r *http.Request) {
	marketplaces, err := s.paths.Marketplaces()
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, marketplaces)
}

func (s *Server) listSkills(w http.ResponseWriter, r *http.Request) {
	skills, err := s.paths.Skills(r.URL.Query().Get("dir"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, skills)
}

func (s *Server) listPlugins(w http.ResponseWriter, r *http.Request) {
	plugins, err := s.paths.Plugins()
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, plugins)
}

var errBadRequest = errors.New("invalid request body")

func writeError(w http.ResponseWriter, err error) {
	status := http.StatusInternalServerError
	switch {
	case errors.Is(err, errBadRequest),
		errors.Is(err, claude.ErrBadDir),
		errors.Is(err, claude.ErrGlobalDir),
		errors.Is(err, claude.ErrBadSkillName),
		errors.Is(err, claude.ErrBadNoteName),
		errors.Is(err, errMCPRequest),
		errors.Is(err, claude.ErrUnknownKind):
		status = http.StatusBadRequest
	case errors.Is(err, fs.ErrNotExist):
		status = http.StatusNotFound
	case errors.Is(err, claude.ErrConflict):
		status = http.StatusConflict
	case errors.Is(err, claude.ErrInvalidJSON):
		status = http.StatusUnprocessableEntity
	default:
		log.Printf("api error: %v", err)
	}
	writeJSON(w, status, map[string]string{"error": err.Error()})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
