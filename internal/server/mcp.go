package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"

	"claudia/internal/claude"
	"claudia/internal/schema"
)

// Changes go through the Claude Code CLI, because running sessions also write
// ~/.claude.json and the CLI knows how to update it safely.

var errMCPRequest = errors.New("invalid MCP server request")

func (s *Server) listMCP(w http.ResponseWriter, r *http.Request) {
	servers, err := s.paths.MCPServers(r.URL.Query().Get("dir"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, servers)
}

// saveMCP adds a server, or replaces it when previous names an existing one.
func (s *Server) saveMCP(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Dir      string            `json:"dir"`
		Scope    string            `json:"scope"`
		Name     string            `json:"name"`
		Previous *claude.MCPServer `json:"previous"`
		Config   json.RawMessage   `json:"config"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || !validMCP(body.Dir, body.Scope, body.Name) || !json.Valid(body.Config) {
		writeError(w, errMCPRequest)
		return
	}

	if prev := body.Previous; prev != nil {
		if !validMCP(body.Dir, prev.Scope, prev.Name) {
			writeError(w, errMCPRequest)
			return
		}
		if err := s.claudeMCP(r.Context(), body.Dir, nil, "remove", "-s", prev.Scope, "--", prev.Name); err != nil {
			writeCLIError(w, err)
			return
		}
		if err := s.claudeMCP(r.Context(), body.Dir, body.Config, "add-json", "-s", body.Scope, "--", body.Name, "-"); err != nil {
			// Put the old server back, so that a failed edit loses nothing.
			s.claudeMCP(context.Background(), body.Dir, prev.Config, "add-json", "-s", prev.Scope, "--", prev.Name, "-")
			writeCLIError(w, err)
			return
		}
	} else if err := s.claudeMCP(r.Context(), body.Dir, body.Config, "add-json", "-s", body.Scope, "--", body.Name, "-"); err != nil {
		writeCLIError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) deleteMCP(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	if !validMCP(q.Get("dir"), q.Get("scope"), q.Get("name")) {
		writeError(w, errMCPRequest)
		return
	}
	if err := s.claudeMCP(r.Context(), q.Get("dir"), nil, "remove", "-s", q.Get("scope"), "--", q.Get("name")); err != nil {
		writeCLIError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Local and project servers belong to a folder. Names that start with "-" could be read as options.
func validMCP(dir, scope, name string) bool {
	if name == "" || strings.HasPrefix(name, "-") {
		return false
	}
	switch scope {
	case claude.MCPUser:
		return true
	case claude.MCPLocal, claude.MCPProject:
		return dir != ""
	}
	return false
}

// claudeMCP runs "claude mcp ..." in the folder, with stdin as input.
func (s *Server) claudeMCP(ctx context.Context, dir string, stdin []byte, args ...string) error {
	s.cli.Lock()
	defer s.cli.Unlock()

	executables := schema.Executables()
	if len(executables) == 0 {
		return schema.ErrNotFound
	}
	if dir == "" {
		dir, _ = os.UserHomeDir()
	} else if _, err := s.paths.ProjectDir(dir); err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, executables[0], append([]string{"mcp"}, args...)...)
	cmd.Dir = dir
	cmd.Env = withoutSession(os.Environ())
	cmd.Stdin = bytes.NewReader(stdin)
	output, err := cmd.CombinedOutput()
	if err != nil {
		message := strings.TrimSpace(string(output))
		if message == "" {
			message = err.Error()
		}
		return fmt.Errorf("%w: %s", errCLI, message)
	}
	return nil
}

var errCLI = errors.New("claude mcp failed")

// withoutSession drops the variables that a Claude Code session passes to its
// child processes. Claudia only has them when it was started from a session
// terminal, and it is not part of that session. Settings such as
// CLAUDE_CONFIG_DIR stay.
func withoutSession(env []string) []string {
	var kept []string
	for _, entry := range env {
		name, _, _ := strings.Cut(entry, "=")
		if !sessionVariable(name) {
			kept = append(kept, entry)
		}
	}
	return kept
}

func sessionVariable(name string) bool {
	switch name {
	case "CLAUDECODE", "CLAUDE_PID", "CLAUDE_EFFORT":
		return true
	}
	if !strings.HasPrefix(name, "CLAUDE_CODE_") {
		return false
	}
	for _, part := range []string{"SESSION", "CHILD", "MESSAGING", "ENTRYPOINT", "EXECPATH"} {
		if strings.Contains(name, part) {
			return true
		}
	}
	return false
}

// The CLI explains what went wrong, for example that a name is taken.
func writeCLIError(w http.ResponseWriter, err error) {
	if errors.Is(err, errCLI) {
		message := strings.TrimPrefix(err.Error(), errCLI.Error()+": ")
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": message})
		return
	}
	writeError(w, err)
}
