package claude

import (
	"bytes"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"go.yaml.in/yaml/v3"
)

var ErrBadSkillName = errors.New("invalid skill name")

type Skill struct {
	// Name is the folder name. Claude Code uses it for /name and for skillOverrides.
	Name        string `json:"name"`
	Description string `json:"description"`
	Path        string `json:"path"`
}

// SkillsDir returns the skills folder of a scope. An empty dir selects the user scope.
func (p Paths) SkillsDir(dir string) (string, error) {
	if dir == "" {
		return filepath.Join(p.ConfigDir, "skills"), nil
	}
	dir, err := p.ProjectDir(dir)
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, ".claude", "skills"), nil
}

func (p Paths) SkillFile(dir, name string) (string, error) {
	if name == "" || name != filepath.Base(name) || strings.HasPrefix(name, ".") || strings.ContainsAny(name, `/\`) {
		return "", ErrBadSkillName
	}
	root, err := p.SkillsDir(dir)
	if err != nil {
		return "", err
	}
	return filepath.Join(root, name, "SKILL.md"), nil
}

// Skills lists the folders in a scope's skills folder that contain a SKILL.md.
func (p Paths) Skills(dir string) ([]Skill, error) {
	root, err := p.SkillsDir(dir)
	if err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(root)
	if errors.Is(err, fs.ErrNotExist) {
		return []Skill{}, nil
	}
	if err != nil {
		return nil, err
	}

	skills := []Skill{}
	for _, entry := range entries {
		// Claude Code keeps deleted skills in .trash.
		if strings.HasPrefix(entry.Name(), ".") {
			continue
		}
		path := filepath.Join(root, entry.Name(), "SKILL.md")
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		skills = append(skills, Skill{
			Name:        entry.Name(),
			Description: description(data),
			Path:        path,
		})
	}
	slices.SortFunc(skills, func(a, b Skill) int { return strings.Compare(a.Name, b.Name) })
	return skills, nil
}

func description(data []byte) string {
	data = bytes.TrimPrefix(data, []byte("\ufeff"))
	if !bytes.HasPrefix(data, []byte("---")) {
		return ""
	}
	rest := data[3:]
	end := bytes.Index(rest, []byte("\n---"))
	if end < 0 {
		return ""
	}

	var meta struct {
		Description string `yaml:"description"`
	}
	if yaml.Unmarshal(rest[:end], &meta) != nil {
		return ""
	}
	return strings.TrimSpace(meta.Description)
}
