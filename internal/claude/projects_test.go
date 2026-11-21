package claude

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestProjects(t *testing.T) {
	root := t.TempDir()
	home := filepath.Join(root, "home")
	paths := Paths{
		ConfigDir: filepath.Join(home, ".claude"),
		StateFile: filepath.Join(root, ".claude.json"),
	}

	old := mkdir(t, root, "old")
	touch(t, filepath.Join(old, "CLAUDE.md"))
	recent := mkdir(t, root, "recent")
	touch(t, filepath.Join(recent, ".claude", "settings.json"))
	empty := mkdir(t, root, "empty")
	saved := mkdir(t, root, "saved")
	touch(t, filepath.Join(home, ".claude", "settings.json"))

	session(t, paths, old, time.Now().Add(-time.Hour))
	session(t, paths, recent, time.Now())
	session(t, paths, empty, time.Now())

	state := map[string]any{"projects": map[string]any{
		old: map[string]any{}, recent: map[string]any{}, empty: map[string]any{}, home: map[string]any{},
	}}
	data, _ := json.Marshal(state)
	os.WriteFile(paths.StateFile, data, 0o644)

	projects, err := paths.Projects([]string{saved})
	if err != nil {
		t.Fatal(err)
	}

	var got []string
	for _, p := range projects {
		got = append(got, p.Name)
	}
	want := []string{"recent", "old", "saved"}
	if len(got) != len(want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("got %v, want %v", got, want)
		}
	}

	if _, err := paths.ProjectDir(home); !errors.Is(err, ErrGlobalDir) {
		t.Errorf("home folder: got %v, want ErrGlobalDir", err)
	}
}

func mkdir(t *testing.T, parent, name string) string {
	dir := filepath.Join(parent, name)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	return dir
}

func touch(t *testing.T, path string) {
	os.MkdirAll(filepath.Dir(path), 0o755)
	if err := os.WriteFile(path, []byte("{}"), 0o644); err != nil {
		t.Fatal(err)
	}
}

func session(t *testing.T, paths Paths, dir string, at time.Time) {
	file := filepath.Join(paths.ConfigDir, "projects", sessionDirName.ReplaceAllString(dir, "-"), "s.jsonl")
	touch(t, file)
	os.Chtimes(file, at, at)
}

func TestProjectsMergeSymlinks(t *testing.T) {
	root := t.TempDir()
	paths := Paths{ConfigDir: filepath.Join(root, "config"), StateFile: filepath.Join(root, ".claude.json")}
	real := mkdir(t, root, "real")
	touch(t, filepath.Join(real, "CLAUDE.md"))
	link := filepath.Join(root, "l")
	if err := os.Symlink(real, link); err != nil {
		t.Skip("symlinks not supported:", err)
	}

	data, _ := json.Marshal(map[string]any{"projects": map[string]any{real: map[string]any{}, link: map[string]any{}}})
	os.WriteFile(paths.StateFile, data, 0o644)

	projects, err := paths.Projects(nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(projects) != 1 || projects[0].Path != link {
		t.Fatalf("got %+v", projects)
	}
}
