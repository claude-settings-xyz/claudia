package claude

import (
	"cmp"
	"encoding/json"
	"path/filepath"
	"slices"
)

// MCP server scopes, as Claude Code names them.
const (
	MCPUser    = "user"    // ~/.claude.json, for every folder
	MCPLocal   = "local"   // ~/.claude.json, for one folder and only you
	MCPProject = "project" // <folder>/.mcp.json, shared through the repository
)

type MCPServer struct {
	Name   string          `json:"name"`
	Scope  string          `json:"scope"`
	Config json.RawMessage `json:"config"`
}

// MCPServers lists the servers of a scope. A project also shows the global ones.
func (p Paths) MCPServers(dir string) ([]MCPServer, error) {
	var state struct {
		MCPServers map[string]json.RawMessage `json:"mcpServers"`
		Projects   map[string]struct {
			MCPServers map[string]json.RawMessage `json:"mcpServers"`
		} `json:"projects"`
	}
	if err := readJSON(p.StateFile, &state); err != nil {
		return nil, err
	}

	servers := collect(state.MCPServers, MCPUser)
	if dir == "" {
		return servers, nil
	}
	dir, err := p.ProjectDir(dir)
	if err != nil {
		return nil, err
	}

	// Claude Code stores the real path of the folder, which differs when a parent is a symlink.
	local := state.Projects[dir].MCPServers
	if real, err := filepath.EvalSymlinks(dir); err == nil && local == nil {
		local = state.Projects[real].MCPServers
	}
	var shared struct {
		MCPServers map[string]json.RawMessage `json:"mcpServers"`
	}
	if err := readJSON(filepath.Join(dir, ".mcp.json"), &shared); err != nil {
		return nil, err
	}
	// collect never returns nil, so an empty list is encoded as [] and not null.
	result := collect(local, MCPLocal)
	result = append(result, collect(shared.MCPServers, MCPProject)...)
	return append(result, servers...), nil
}

func collect(configs map[string]json.RawMessage, scope string) []MCPServer {
	servers := []MCPServer{}
	for name, config := range configs {
		servers = append(servers, MCPServer{Name: name, Scope: scope, Config: config})
	}
	slices.SortFunc(servers, func(a, b MCPServer) int { return cmp.Compare(a.Name, b.Name) })
	return servers
}
