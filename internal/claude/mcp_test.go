package claude

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestMCPServers(t *testing.T) {
	root := t.TempDir()
	paths := Paths{ConfigDir: filepath.Join(root, "config"), StateFile: filepath.Join(root, ".claude.json")}
	project := t.TempDir()

	// No servers anywhere must still be an empty list, not null.
	servers, err := paths.MCPServers(project)
	if err != nil {
		t.Fatal(err)
	}
	if data, _ := json.Marshal(servers); string(data) != "[]" {
		t.Fatalf("got %s", data)
	}

	state := map[string]any{
		"mcpServers": map[string]any{"github": map[string]any{"type": "http", "url": "https://x"}},
		"projects":   map[string]any{project: map[string]any{"mcpServers": map[string]any{"db": map[string]any{"command": "npx"}}}},
	}
	data, _ := json.Marshal(state)
	os.WriteFile(paths.StateFile, data, 0o644)
	os.WriteFile(filepath.Join(project, ".mcp.json"), []byte(`{"mcpServers": {"docs": {"type": "sse", "url": "https://d"}}}`), 0o644)

	servers, err = paths.MCPServers(project)
	if err != nil {
		t.Fatal(err)
	}
	var got []string
	for _, server := range servers {
		got = append(got, server.Scope+":"+server.Name)
	}
	want := []string{"local:db", "project:docs", "user:github"}
	if len(got) != 3 || got[0] != want[0] || got[1] != want[1] || got[2] != want[2] {
		t.Fatalf("got %v, want %v", got, want)
	}
}
