package claude

import (
	"bytes"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"

	"go.yaml.in/yaml/v3"
)

var ErrBadSkillName = errors.New("invalid skill name")

type Skill struct {
	// Name is the folder name. Claude Code uses it for /name and for skillOverrides.
	Name        string `json:"name"`
	Description string `json:"description"`
	Path        string `json:"path"`
	// The frontmatter can stop Claude from using the skill (disable-model-invocation: true)
	// or you from running it (user-invocable: false). skillOverrides cannot change that.
	ModelInvocable bool `json:"modelInvocable"`
	UserInvocable  bool `json:"userInvocable"`
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
		meta := frontmatter(data)
		skills = append(skills, Skill{
			Name:           entry.Name(),
			Description:    strings.TrimSpace(meta.Description),
			Path:           path,
			ModelInvocable: !isYAMLBool(meta.DisableModelInvocation, true),
			UserInvocable:  !isYAMLBool(meta.UserInvocable, false),
		})
	}
	slices.SortFunc(skills, func(a, b Skill) int { return strings.Compare(a.Name, b.Name) })
	return skills, nil
}

type skillMeta struct {
	Description            string `yaml:"description"`
	DisableModelInvocation any    `yaml:"disable-model-invocation"`
	UserInvocable          any    `yaml:"user-invocable"`
}

// frontmatter reads the YAML block at the top of a SKILL.md. A file without one,
// or with YAML that does not parse, gives empty values.
func frontmatter(data []byte) skillMeta {
	var meta skillMeta
	data = bytes.TrimPrefix(data, []byte("\ufeff"))
	if !bytes.HasPrefix(data, []byte("---")) {
		return meta
	}
	rest := data[3:]
	end := bytes.Index(rest, []byte("\n---"))
	if end < 0 {
		return meta
	}
	if yaml.Unmarshal(rest[:end], &meta) != nil {
		return skillMeta{}
	}
	return meta
}

// isYAMLBool reports whether a frontmatter value is the boolean want. Authors
// write both true and "true".
func isYAMLBool(value any, want bool) bool {
	switch v := value.(type) {
	case bool:
		return v == want
	case string:
		return strings.EqualFold(strings.TrimSpace(v), strconv.FormatBool(want))
	}
	return false
}
