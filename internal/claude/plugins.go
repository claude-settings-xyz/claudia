package claude

import (
	"cmp"
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strings"
)

type Plugin struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Marketplace string    `json:"marketplace"`
	Description string    `json:"description,omitempty"`
	Category    string    `json:"category,omitempty"`
	Installs    []Install `json:"installs"`
}

type Install struct {
	Scope       string `json:"scope"`
	ProjectPath string `json:"projectPath,omitempty"`
	Version     string `json:"version,omitempty"`
}

type installRecord struct {
	Install
	InstallPath string `json:"installPath"`
}

type manifest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Category    string `json:"category"`
}

// Plugins lists installed plugins and the plugins offered by known marketplaces.
func (p Paths) Plugins() ([]Plugin, error) {
	dir := filepath.Join(p.ConfigDir, "plugins")
	byID := map[string]*Plugin{}

	var markets map[string]struct {
		InstallLocation string `json:"installLocation"`
	}
	if err := readJSON(filepath.Join(dir, "known_marketplaces.json"), &markets); err != nil {
		return nil, err
	}
	for market, info := range markets {
		var catalog struct {
			Plugins []manifest `json:"plugins"`
		}
		path := filepath.Join(info.InstallLocation, ".claude-plugin", "marketplace.json")
		if err := readJSON(path, &catalog); err != nil {
			continue
		}
		for _, m := range catalog.Plugins {
			id := m.Name + "@" + market
			byID[id] = &Plugin{
				ID:          id,
				Name:        m.Name,
				Marketplace: market,
				Description: m.Description,
				Category:    m.Category,
				Installs:    []Install{},
			}
		}
	}

	var installed struct {
		Plugins map[string][]installRecord `json:"plugins"`
	}
	if err := readJSON(filepath.Join(dir, "installed_plugins.json"), &installed); err != nil {
		return nil, err
	}
	for id, records := range installed.Plugins {
		plugin, ok := byID[id]
		if !ok {
			name, market, _ := strings.Cut(id, "@")
			plugin = &Plugin{ID: id, Name: name, Marketplace: market}
			byID[id] = plugin
		}
		plugin.Installs = make([]Install, len(records))
		for i, record := range records {
			plugin.Installs[i] = record.Install
		}
		if plugin.Description == "" {
			plugin.Description = describe(records)
		}
	}

	plugins := make([]Plugin, 0, len(byID))
	for _, plugin := range byID {
		plugins = append(plugins, *plugin)
	}
	slices.SortFunc(plugins, func(a, b Plugin) int { return cmp.Compare(a.ID, b.ID) })
	return plugins, nil
}

func describe(records []installRecord) string {
	for _, record := range records {
		var m manifest
		path := filepath.Join(record.InstallPath, ".claude-plugin", "plugin.json")
		if readJSON(path, &m) == nil && m.Description != "" {
			return m.Description
		}
	}
	return ""
}

// readJSON leaves v unchanged when the file does not exist.
func readJSON(path string, v any) error {
	data, err := os.ReadFile(path)
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	return json.Unmarshal(data, v)
}

type Marketplace struct {
	Name        string          `json:"name"`
	Source      json.RawMessage `json:"source"`
	LastUpdated string          `json:"lastUpdated,omitempty"`
	Plugins     int             `json:"plugins"`
}

// Marketplaces lists the plugin marketplaces that Claude Code has added.
func (p Paths) Marketplaces() ([]Marketplace, error) {
	var known map[string]struct {
		Source          json.RawMessage `json:"source"`
		InstallLocation string          `json:"installLocation"`
		LastUpdated     string          `json:"lastUpdated"`
	}
	if err := readJSON(filepath.Join(p.ConfigDir, "plugins", "known_marketplaces.json"), &known); err != nil {
		return nil, err
	}

	marketplaces := []Marketplace{}
	for name, info := range known {
		var catalog struct {
			Plugins []json.RawMessage `json:"plugins"`
		}
		readJSON(filepath.Join(info.InstallLocation, ".claude-plugin", "marketplace.json"), &catalog)
		marketplaces = append(marketplaces, Marketplace{
			Name:        name,
			Source:      info.Source,
			LastUpdated: info.LastUpdated,
			Plugins:     len(catalog.Plugins),
		})
	}
	slices.SortFunc(marketplaces, func(a, b Marketplace) int { return cmp.Compare(a.Name, b.Name) })
	return marketplaces, nil
}
