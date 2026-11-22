package claude

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestSkills(t *testing.T) {
	paths := Paths{ConfigDir: t.TempDir()}
	root := filepath.Join(paths.ConfigDir, "skills")

	write := func(name, content string) {
		path := filepath.Join(root, name, "SKILL.md")
		os.MkdirAll(filepath.Dir(path), 0o755)
		os.WriteFile(path, []byte(content), 0o644)
	}
	write("folded", "---\nname: other-name\ndescription: >\n  First line\n  second line.\n---\n# Body\n")
	write("plain", "---\r\ndescription: Plain one\r\n---\r\n")
	write("no-frontmatter", "# Just text\n")
	write(".trash", "---\ndescription: deleted\n---\n")
	os.MkdirAll(filepath.Join(root, "empty-folder"), 0o755)

	skills, err := paths.Skills("")
	if err != nil {
		t.Fatal(err)
	}

	want := map[string]string{
		"folded":         "First line second line.",
		"no-frontmatter": "",
		"plain":          "Plain one",
	}
	if len(skills) != len(want) {
		t.Fatalf("got %+v", skills)
	}
	for _, skill := range skills {
		if d, ok := want[skill.Name]; !ok || d != skill.Description {
			t.Errorf("%s: got description %q, want %q", skill.Name, skill.Description, d)
		}
	}
}

func TestSkillInvocation(t *testing.T) {
	paths := Paths{ConfigDir: t.TempDir()}
	root := filepath.Join(paths.ConfigDir, "skills")
	for name, content := range map[string]string{
		"normal":       "---\ndescription: Normal\n---\n",
		"command-only": "---\ndescription: Mine\ndisable-model-invocation: true\n---\n",
		"quoted":       "---\ndisable-model-invocation: \"true\"\n---\n",
		"claude-only":  "---\nuser-invocable: false\n---\n",
		"allowed":      "---\ndisable-model-invocation: false\nuser-invocable: true\n---\n",
		"broken":       "---\ndisable-model-invocation: [\n---\n",
	} {
		path := filepath.Join(root, name, "SKILL.md")
		os.MkdirAll(filepath.Dir(path), 0o755)
		os.WriteFile(path, []byte(content), 0o644)
	}

	skills, err := paths.Skills("")
	if err != nil {
		t.Fatal(err)
	}
	want := map[string][2]bool{
		"normal":       {true, true},
		"command-only": {false, true},
		"quoted":       {false, true},
		"claude-only":  {true, false},
		"allowed":      {true, true},
		"broken":       {true, true},
	}
	for _, skill := range skills {
		if got := [2]bool{skill.ModelInvocable, skill.UserInvocable}; got != want[skill.Name] {
			t.Errorf("%s: got model, user = %v, want %v", skill.Name, got, want[skill.Name])
		}
	}
}

func TestSkillFileRejectsBadNames(t *testing.T) {
	paths := Paths{ConfigDir: "/config"}
	for _, name := range []string{"", ".", "..", ".trash", "a/b", `a\b`, "../x"} {
		if _, err := paths.SkillFile("", name); !errors.Is(err, ErrBadSkillName) {
			t.Errorf("%q: got %v, want ErrBadSkillName", name, err)
		}
	}
	got, err := paths.SkillFile("", "my-skill")
	if err != nil || got != filepath.Join("/config", "skills", "my-skill", "SKILL.md") {
		t.Errorf("got %q, %v", got, err)
	}
}
