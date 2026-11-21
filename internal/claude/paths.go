package claude

import (
	"errors"
	"os"
	"path/filepath"
)

// Paths locates the files that Claude Code reads.
type Paths struct {
	ConfigDir string
	StateFile string
}

func DefaultPaths() (Paths, error) {
	if dir := os.Getenv("CLAUDE_CONFIG_DIR"); dir != "" {
		return Paths{ConfigDir: dir, StateFile: filepath.Join(dir, ".claude.json")}, nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return Paths{}, err
	}
	return Paths{
		ConfigDir: filepath.Join(home, ".claude"),
		StateFile: filepath.Join(home, ".claude.json"),
	}, nil
}

type Kind string

const (
	KindSettings      Kind = "settings"
	KindLocalSettings Kind = "settings-local"
	KindClaudeMD      Kind = "claude-md"
	KindSkill         Kind = "skill"
	KindMemoryNote    Kind = "memory-note"
)

func (k Kind) isJSON() bool {
	return k == KindSettings || k == KindLocalSettings
}

var (
	ErrUnknownKind = errors.New("unknown file kind")
	ErrBadDir      = errors.New("folder must be an absolute path to an existing directory")
	ErrGlobalDir   = errors.New("this folder holds the global Claude config, so use Global instead")
)

// File returns the path of a config file. An empty dir selects the user scope.
func (p Paths) File(dir string, kind Kind) (string, error) {
	if dir == "" {
		switch kind {
		case KindSettings:
			return filepath.Join(p.ConfigDir, "settings.json"), nil
		case KindClaudeMD:
			return filepath.Join(p.ConfigDir, "CLAUDE.md"), nil
		}
		return "", ErrUnknownKind
	}

	dir, err := p.ProjectDir(dir)
	if err != nil {
		return "", err
	}
	switch kind {
	case KindSettings:
		return filepath.Join(dir, ".claude", "settings.json"), nil
	case KindLocalSettings:
		return filepath.Join(dir, ".claude", "settings.local.json"), nil
	case KindClaudeMD:
		return projectMemory(dir), nil
	}
	return "", ErrUnknownKind
}

// Claude Code also reads .claude/CLAUDE.md, so edit that file when it is the only one.
func projectMemory(dir string) string {
	root := filepath.Join(dir, "CLAUDE.md")
	nested := filepath.Join(dir, ".claude", "CLAUDE.md")
	if !exists(root) && exists(nested) {
		return nested
	}
	return root
}

// ProjectDir rejects the folder that contains the config dir, usually the home
// folder, because its project files are the global files.
func (p Paths) ProjectDir(dir string) (string, error) {
	dir, err := checkDir(dir)
	if err != nil {
		return "", err
	}
	if sameFile(filepath.Join(dir, ".claude"), p.ConfigDir) {
		return "", ErrGlobalDir
	}
	return dir, nil
}

func checkDir(dir string) (string, error) {
	if !filepath.IsAbs(dir) {
		return "", ErrBadDir
	}
	dir = filepath.Clean(dir)
	info, err := os.Stat(dir)
	if err != nil || !info.IsDir() {
		return "", ErrBadDir
	}
	return dir, nil
}

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func sameFile(a, b string) bool {
	infoA, errA := os.Stat(a)
	infoB, errB := os.Stat(b)
	if errA != nil || errB != nil {
		return filepath.Clean(a) == filepath.Clean(b)
	}
	return os.SameFile(infoA, infoB)
}
