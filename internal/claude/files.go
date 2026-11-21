package claude

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
)

var (
	ErrConflict    = errors.New("the file changed on disk since it was loaded")
	ErrInvalidJSON = errors.New("settings must be a valid JSON object")
)

type File struct {
	Path    string `json:"path"`
	Exists  bool   `json:"exists"`
	Content string `json:"content"`
	// Version is a hash of the content, or empty when the file does not exist.
	Version string `json:"version"`
}

func ReadFile(path string) (File, error) {
	data, err := os.ReadFile(path)
	if errors.Is(err, fs.ErrNotExist) {
		return File{Path: path}, nil
	}
	if err != nil {
		return File{}, err
	}
	return File{Path: path, Exists: true, Content: string(data), Version: hash(data)}, nil
}

// WriteFile replaces the file only if its version on disk still matches.
func WriteFile(path string, kind Kind, content, version string) (File, error) {
	if kind.isJSON() && !isJSONObject(content) {
		return File{}, ErrInvalidJSON
	}

	current, err := ReadFile(path)
	if err != nil {
		return File{}, err
	}
	if current.Version != version {
		return File{}, ErrConflict
	}

	if err := writeAtomic(path, []byte(content)); err != nil {
		return File{}, err
	}
	return ReadFile(path)
}

func writeAtomic(path string, data []byte) error {
	// Write through symlinks so that dotfile setups keep working.
	if target, err := filepath.EvalSymlinks(path); err == nil {
		path = target
	}

	mode := fs.FileMode(0o644)
	if info, err := os.Stat(path); err == nil {
		mode = info.Mode().Perm()
	}

	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(dir, "."+filepath.Base(path)+".*")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())

	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Chmod(mode); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), path)
}

func isJSONObject(content string) bool {
	var v map[string]any
	return json.Unmarshal([]byte(content), &v) == nil && v != nil
}

func hash(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}
