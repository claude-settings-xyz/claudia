package claude

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestMemory(t *testing.T) {
	paths := Paths{ConfigDir: t.TempDir()}
	project := t.TempDir()

	root, err := paths.MemoryDir(project)
	if err != nil {
		t.Fatal(err)
	}
	want := filepath.Join(paths.ConfigDir, "projects", sessionDirName.ReplaceAllString(project, "-"), "memory")
	if root != want {
		t.Fatalf("got %q, want %q", root, want)
	}

	os.MkdirAll(filepath.Join(root, "drafts"), 0o755)
	for _, name := range []string{"zeta.md", "MEMORY.md", "alpha.md", "notes.txt", ".hidden.md"} {
		os.WriteFile(filepath.Join(root, name), []byte("x"), 0o644)
	}
	memory, err := paths.Memory(project)
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, note := range memory.Notes {
		names = append(names, note.Name)
	}
	if len(names) != 3 || names[0] != "MEMORY.md" || names[1] != "alpha.md" || names[2] != "zeta.md" {
		t.Fatalf("got %v", names)
	}
	if !memory.Enabled {
		t.Error("auto memory is on by default")
	}

	if err := paths.DeleteMemoryNote(project, "MEMORY.md"); !errors.Is(err, ErrBadNoteName) {
		t.Errorf("deleting the index: got %v", err)
	}
	if err := paths.DeleteMemoryNote(project, "alpha.md"); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"../x.md", "a/b.md", "notes.txt", ".md"} {
		if _, err := paths.MemoryNoteFile(project, name); !errors.Is(err, ErrBadNoteName) {
			t.Errorf("%q: got %v", name, err)
		}
	}
}

func TestMemorySettings(t *testing.T) {
	paths := Paths{ConfigDir: t.TempDir()}
	project := t.TempDir()
	write := func(path, content string) {
		os.MkdirAll(filepath.Dir(path), 0o755)
		os.WriteFile(path, []byte(content), 0o644)
	}

	// The shared project file cannot move memory, but it can turn it off.
	write(filepath.Join(project, ".claude", "settings.json"), `{"autoMemoryDirectory": "/shared", "autoMemoryEnabled": false}`)
	write(filepath.Join(paths.ConfigDir, "settings.json"), `{"autoMemoryDirectory": "/user"}`)
	if root, _ := paths.MemoryDir(project); root != "/user" {
		t.Errorf("user directory: got %q", root)
	}
	if paths.memoryEnabled(project) {
		t.Error("the project turned auto memory off")
	}

	write(filepath.Join(project, ".claude", "settings.local.json"), `{"autoMemoryDirectory": "/local", "autoMemoryEnabled": true}`)
	if root, _ := paths.MemoryDir(project); root != "/local" {
		t.Errorf("local directory: got %q", root)
	}
	if !paths.memoryEnabled(project) {
		t.Error("the local file turned auto memory back on")
	}
}
