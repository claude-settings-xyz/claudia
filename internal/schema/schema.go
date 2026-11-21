// Package schema reads the settings schema from the installed Claude Code, so
// that the editor always matches the version that reads the settings.
package schema

import (
	"cmp"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"slices"
	"strconv"
	"strings"
	"sync"
)

var ErrNotFound = errors.New("could not find Claude Code on this computer")

type Result struct {
	Version string          `json:"version"`
	Binary  string          `json:"binary"`
	Schema  json.RawMessage `json:"schema"`
}

type Loader struct {
	mu       sync.Mutex
	cacheDir string
	results  map[string]Result
}

func NewLoader() *Loader {
	dir, err := os.UserCacheDir()
	if err == nil {
		dir = filepath.Join(dir, "claudia", "settings-schema")
	}
	return &Loader{cacheDir: dir, results: map[string]Result{}}
}

// Load returns the schema of the installed Claude Code. It reads the executable
// again only after it changes, for example after an update.
func (l *Loader) Load() (Result, error) {
	l.mu.Lock()
	defer l.mu.Unlock()

	var errs []error
	for _, binary := range candidates() {
		result, err := l.loadFrom(binary)
		if err == nil {
			return result, nil
		}
		errs = append(errs, fmt.Errorf("%s: %w", binary, err))
	}
	if len(errs) == 0 {
		return Result{}, ErrNotFound
	}
	return Result{}, errors.Join(errs...)
}

func (l *Loader) loadFrom(binary string) (Result, error) {
	info, err := os.Stat(binary)
	if err != nil {
		return Result{}, err
	}
	key := cacheKey(binary, info)
	if result, ok := l.results[key]; ok {
		return result, nil
	}
	if result, ok := l.readCache(key); ok {
		l.results[key] = result
		return result, nil
	}

	b, err := readBundle(binary)
	if err != nil {
		return Result{}, err
	}
	text, version, err := evaluate(b)
	if err != nil {
		return Result{}, err
	}
	var check struct {
		Properties map[string]json.RawMessage `json:"properties"`
	}
	if json.Unmarshal([]byte(text), &check) != nil || len(check.Properties) == 0 {
		return Result{}, errNoSettings
	}

	result := Result{Version: version, Binary: binary, Schema: json.RawMessage(text)}
	l.results[key] = result
	l.writeCache(key, result)
	return result, nil
}

func cacheKey(binary string, info os.FileInfo) string {
	sum := sha256.Sum256(fmt.Appendf(nil, "%s|%d|%d", binary, info.Size(), info.ModTime().UnixNano()))
	return hex.EncodeToString(sum[:8])
}

func (l *Loader) readCache(key string) (Result, bool) {
	if l.cacheDir == "" {
		return Result{}, false
	}
	data, err := os.ReadFile(filepath.Join(l.cacheDir, key+".json"))
	if err != nil {
		return Result{}, false
	}
	var result Result
	return result, json.Unmarshal(data, &result) == nil
}

// A failed cache write only costs time on the next start.
func (l *Loader) writeCache(key string, result Result) {
	if l.cacheDir == "" {
		return
	}
	data, err := json.Marshal(result)
	if err != nil || os.MkdirAll(l.cacheDir, 0o755) != nil {
		return
	}
	os.WriteFile(filepath.Join(l.cacheDir, key+".json"), data, 0o644)
}

// candidates lists Claude Code executables, most likely first. Apps started from
// the Dock or Start menu often have a short PATH, so common install folders are
// checked too.
func candidates() []string {
	name := "claude"
	if runtime.GOOS == "windows" {
		name = "claude.exe"
	}
	var paths []string
	if p, err := exec.LookPath(name); err == nil {
		paths = append(paths, p)
	}
	if home, err := os.UserHomeDir(); err == nil {
		paths = append(paths,
			filepath.Join(home, ".local", "bin", name),
			filepath.Join(home, ".claude", "local", name),
		)
		paths = append(paths, newestVersion(filepath.Join(home, ".local", "share", "claude", "versions"))...)
	}
	if runtime.GOOS != "windows" {
		paths = append(paths, "/opt/homebrew/bin/claude", "/usr/local/bin/claude")
	}

	var found []string
	for _, p := range paths {
		resolved, err := filepath.EvalSymlinks(p)
		if err != nil {
			continue
		}
		if info, err := os.Stat(resolved); err != nil || info.IsDir() || slices.Contains(found, resolved) {
			continue
		}
		found = append(found, resolved)
	}
	return found
}

// newestVersion returns the newest executable in the native installer's versions folder.
func newestVersion(dir string) []string {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	var names []string
	for _, entry := range entries {
		if !entry.IsDir() {
			names = append(names, entry.Name())
		}
	}
	if len(names) == 0 {
		return nil
	}
	slices.SortFunc(names, compareVersions)
	return []string{filepath.Join(dir, names[len(names)-1])}
}

func compareVersions(a, b string) int {
	pa, pb := strings.Split(a, "."), strings.Split(b, ".")
	for i := range max(len(pa), len(pb)) {
		var na, nb int
		if i < len(pa) {
			na, _ = strconv.Atoi(pa[i])
		}
		if i < len(pb) {
			nb, _ = strconv.Atoi(pb[i])
		}
		if c := cmp.Compare(na, nb); c != 0 {
			return c
		}
	}
	return strings.Compare(a, b)
}
