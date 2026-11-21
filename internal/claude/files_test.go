package claude

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestWriteFileCreatesMissingFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".claude", "settings.json")

	file, err := WriteFile(path, KindSettings, `{"a": 1}`, "")
	if err != nil {
		t.Fatal(err)
	}
	if !file.Exists || file.Content != `{"a": 1}` || file.Version == "" {
		t.Fatalf("unexpected file: %+v", file)
	}
}

func TestWriteFileRejectsStaleVersion(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	first, err := WriteFile(path, KindSettings, `{}`, "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := WriteFile(path, KindSettings, `{"b": 2}`, first.Version); err != nil {
		t.Fatal(err)
	}

	_, err = WriteFile(path, KindSettings, `{"c": 3}`, first.Version)
	if !errors.Is(err, ErrConflict) {
		t.Fatalf("got %v, want ErrConflict", err)
	}
}

func TestWriteFileValidatesSettings(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	for _, content := range []string{"", "null", "[]", "{", `"text"`} {
		if _, err := WriteFile(path, KindSettings, content, ""); !errors.Is(err, ErrInvalidJSON) {
			t.Errorf("%q: got %v, want ErrInvalidJSON", content, err)
		}
	}
	if _, err := WriteFile(filepath.Join(t.TempDir(), "CLAUDE.md"), KindClaudeMD, "not json", ""); err != nil {
		t.Errorf("memory files are free text: %v", err)
	}
}

func TestWriteFileKeepsSymlinkAndMode(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "dotfiles-settings.json")
	link := filepath.Join(dir, "settings.json")
	if err := os.WriteFile(target, []byte(`{}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(target, link); err != nil {
		t.Skip("symlinks not supported:", err)
	}

	current, _ := ReadFile(link)
	if _, err := WriteFile(link, KindSettings, `{"x": true}`, current.Version); err != nil {
		t.Fatal(err)
	}

	if info, err := os.Lstat(link); err != nil || info.Mode()&os.ModeSymlink == 0 {
		t.Fatal("the symlink was replaced by a regular file")
	}
	data, _ := os.ReadFile(target)
	if string(data) != `{"x": true}` {
		t.Fatalf("target not updated: %s", data)
	}
	if info, _ := os.Stat(target); info.Mode().Perm() != 0o600 {
		t.Fatalf("mode changed to %v", info.Mode().Perm())
	}
}

func TestFilePaths(t *testing.T) {
	paths := Paths{ConfigDir: "/config", StateFile: "/state.json"}
	project := t.TempDir()

	cases := []struct {
		dir  string
		kind Kind
		want string
	}{
		{"", KindSettings, "/config/settings.json"},
		{"", KindClaudeMD, "/config/CLAUDE.md"},
		{project, KindSettings, filepath.Join(project, ".claude", "settings.json")},
		{project, KindLocalSettings, filepath.Join(project, ".claude", "settings.local.json")},
		{project, KindClaudeMD, filepath.Join(project, "CLAUDE.md")},
	}
	for _, c := range cases {
		got, err := paths.File(c.dir, c.kind)
		if err != nil || got != c.want {
			t.Errorf("File(%q, %q) = %q, %v; want %q", c.dir, c.kind, got, err, c.want)
		}
	}

	if _, err := paths.File("", KindLocalSettings); !errors.Is(err, ErrUnknownKind) {
		t.Errorf("user scope has no local settings, got %v", err)
	}
	if _, err := paths.File("relative/dir", KindSettings); !errors.Is(err, ErrBadDir) {
		t.Errorf("relative dir: got %v", err)
	}
}

func TestProjectMemoryPrefersExistingNestedFile(t *testing.T) {
	project := t.TempDir()
	nested := filepath.Join(project, ".claude", "CLAUDE.md")
	os.MkdirAll(filepath.Dir(nested), 0o755)
	os.WriteFile(nested, []byte("# nested"), 0o644)

	got, _ := Paths{}.File(project, KindClaudeMD)
	if got != nested {
		t.Fatalf("got %q, want %q", got, nested)
	}
}
