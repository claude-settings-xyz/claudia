package claude

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strings"
)

// Claude's auto memory: Markdown notes that Claude writes for each folder that
// it works in, with MEMORY.md as the index.

var ErrBadNoteName = errors.New("invalid memory note name")

const memoryIndex = "MEMORY.md"

type Note struct {
	Name string `json:"name"`
	// Index is true for MEMORY.md, which lists the other notes.
	Index bool `json:"index"`
}

type Memory struct {
	Enabled bool   `json:"enabled"`
	Notes   []Note `json:"notes"`
}

// memoryFolder is the folder that sessions run in. The global scope uses the
// home folder, because sessions started there have no project.
func (p Paths) memoryFolder(dir string) (string, error) {
	if dir == "" {
		return os.UserHomeDir()
	}
	return p.ProjectDir(dir)
}

// MemoryDir returns where Claude keeps the memory of a scope.
func (p Paths) MemoryDir(dir string) (string, error) {
	folder, err := p.memoryFolder(dir)
	if err != nil {
		return "", err
	}

	// Claude Code ignores autoMemoryDirectory in the shared project file, so
	// only the local and user files count. Local wins.
	for _, file := range []string{
		filepath.Join(folder, ".claude", "settings.local.json"),
		filepath.Join(p.ConfigDir, "settings.json"),
	} {
		var settings struct {
			AutoMemoryDirectory string `json:"autoMemoryDirectory"`
		}
		if readJSON(file, &settings) == nil && settings.AutoMemoryDirectory != "" {
			return expandHome(settings.AutoMemoryDirectory), nil
		}
	}
	return filepath.Join(p.ConfigDir, "projects", sessionDirName.ReplaceAllString(folder, "-"), "memory"), nil
}

func (p Paths) Memory(dir string) (Memory, error) {
	memory := Memory{Enabled: p.memoryEnabled(dir), Notes: []Note{}}
	root, err := p.MemoryDir(dir)
	if err != nil {
		return Memory{}, err
	}

	entries, err := os.ReadDir(root)
	if errors.Is(err, fs.ErrNotExist) {
		return memory, nil
	}
	if err != nil {
		return Memory{}, err
	}
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") || strings.HasPrefix(entry.Name(), ".") {
			continue
		}
		memory.Notes = append(memory.Notes, Note{Name: entry.Name(), Index: entry.Name() == memoryIndex})
	}
	slices.SortFunc(memory.Notes, func(a, b Note) int {
		if a.Index != b.Index {
			if a.Index {
				return -1
			}
			return 1
		}
		return strings.Compare(a.Name, b.Name)
	})
	return memory, nil
}

func (p Paths) MemoryNoteFile(dir, name string) (string, error) {
	if !strings.HasSuffix(name, ".md") || name != filepath.Base(name) ||
		strings.HasPrefix(name, ".") || strings.ContainsAny(name, `/\`) {
		return "", ErrBadNoteName
	}
	root, err := p.MemoryDir(dir)
	if err != nil {
		return "", err
	}
	return filepath.Join(root, name), nil
}

// DeleteMemoryNote removes a note. The index stays, because Claude needs it.
func (p Paths) DeleteMemoryNote(dir, name string) error {
	if name == memoryIndex {
		return ErrBadNoteName
	}
	path, err := p.MemoryNoteFile(dir, name)
	if err != nil {
		return err
	}
	return os.Remove(path)
}

// memoryEnabled reads autoMemoryEnabled from the most specific file that sets
// it. Auto memory is on unless a file turns it off.
func (p Paths) memoryEnabled(dir string) bool {
	folder, err := p.memoryFolder(dir)
	if err != nil {
		return true
	}
	files := []string{filepath.Join(folder, ".claude", "settings.local.json")}
	if dir != "" {
		files = append(files, filepath.Join(folder, ".claude", "settings.json"))
	}
	files = append(files, filepath.Join(p.ConfigDir, "settings.json"))

	for _, file := range files {
		var settings struct {
			AutoMemoryEnabled *bool `json:"autoMemoryEnabled"`
		}
		if readJSON(file, &settings) == nil && settings.AutoMemoryEnabled != nil {
			return *settings.AutoMemoryEnabled
		}
	}
	return true
}

func expandHome(path string) string {
	if home, err := os.UserHomeDir(); err == nil && (path == "~" || strings.HasPrefix(path, "~/")) {
		return filepath.Join(home, path[1:])
	}
	return path
}
