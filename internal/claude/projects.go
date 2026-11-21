package claude

import (
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"time"
)

type Project struct {
	Path string `json:"path"`
	Name string `json:"name"`
	// Saved is true for folders that were added in Claudia rather than found in Claude's state.
	Saved bool `json:"saved"`

	lastUsed time.Time
}

// Projects lists the folders from Claude's state that have config files, plus
// the saved folders. The most recently used folders come first.
func (p Paths) Projects(saved []string) ([]Project, error) {
	known, err := p.knownProjects()
	if err != nil {
		return nil, err
	}

	byPath := map[string]Project{}
	for _, path := range known {
		if hasConfig(path) {
			byPath[path] = Project{Path: path}
		}
	}
	for _, path := range saved {
		byPath[path] = Project{Path: path, Saved: true}
	}

	projects := make([]Project, 0, len(byPath))
	for path, project := range byPath {
		if _, err := p.ProjectDir(path); err != nil {
			continue
		}
		project.Name = filepath.Base(path)
		project.lastUsed = p.lastUsed(path)
		projects = append(projects, project)
	}
	slices.SortFunc(projects, func(a, b Project) int {
		if c := b.lastUsed.Compare(a.lastUsed); c != 0 {
			return c
		}
		return strings.Compare(strings.ToLower(a.Path), strings.ToLower(b.Path))
	})
	return projects, nil
}

func hasConfig(dir string) bool {
	files := []string{
		filepath.Join(dir, ".claude", "settings.json"),
		filepath.Join(dir, ".claude", "settings.local.json"),
		filepath.Join(dir, ".claude", "CLAUDE.md"),
		filepath.Join(dir, "CLAUDE.md"),
	}
	return slices.ContainsFunc(files, exists)
}

// Claude Code stores the sessions of a folder in a directory named after its
// path, with every character other than a letter or digit replaced by "-".
var sessionDirName = regexp.MustCompile(`[^a-zA-Z0-9]`)

// lastUsed returns the time of the newest Claude Code session in dir.
func (p Paths) lastUsed(dir string) time.Time {
	sessions := filepath.Join(p.ConfigDir, "projects", sessionDirName.ReplaceAllString(dir, "-"))
	entries, _ := os.ReadDir(sessions)

	var latest time.Time
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".jsonl" {
			continue
		}
		if info, err := entry.Info(); err == nil && info.ModTime().After(latest) {
			latest = info.ModTime()
		}
	}
	return latest
}

func (p Paths) knownProjects() ([]string, error) {
	data, err := os.ReadFile(p.StateFile)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	var state struct {
		Projects map[string]json.RawMessage `json:"projects"`
	}
	if err := json.Unmarshal(data, &state); err != nil {
		return nil, err
	}

	paths := make([]string, 0, len(state.Projects))
	for path := range state.Projects {
		paths = append(paths, filepath.Clean(path))
	}
	return paths, nil
}
