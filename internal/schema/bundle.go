package schema

import (
	"bufio"
	"bytes"
	"errors"
	"io"
	"os"
	"regexp"
	"strings"
)

// Native Claude Code installs are Bun executables. Bun stores the app as ES module
// chunks: NUL-terminated texts that start with "// @bun" and import each other by
// paths such as "/$bunfs/root/chunk-abc.js".

var errNoBundle = errors.New("no JavaScript bundle found in the Claude Code executable")

const chunkPrefix = "// @bun"

type bundle struct {
	chunks []string
	byPath map[string]int
}

func readBundle(path string) (*bundle, error) {
	chunks, err := readChunks(path)
	if err != nil {
		return nil, err
	}
	if len(chunks) == 0 {
		return nil, errNoBundle
	}
	return &bundle{chunks: chunks, byPath: mapPaths(chunks)}, nil
}

// readChunks streams the file so that only the JavaScript is kept in memory.
func readChunks(path string) ([]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	r := bufio.NewReaderSize(f, 1<<20)
	var chunks []string
	var current bytes.Buffer
	atStart, inChunk := true, false

	for {
		segment, err := r.ReadSlice(0)
		if atStart {
			inChunk = bytes.HasPrefix(segment, []byte(chunkPrefix))
		}
		if inChunk {
			current.Write(bytes.TrimSuffix(segment, []byte{0}))
		}

		switch {
		case errors.Is(err, bufio.ErrBufferFull):
			atStart = false
			continue
		case errors.Is(err, io.EOF):
			if inChunk {
				chunks = append(chunks, current.String())
			}
			return chunks, nil
		case err != nil:
			return nil, err
		}

		if inChunk {
			chunks = append(chunks, current.String())
			current.Reset()
		}
		atStart = true
	}
}

var (
	namedImport = regexp.MustCompile(`import\{([^}]*)\}from"([^"]+)";?`)
	exportList  = regexp.MustCompile(`export\{([^}]*)\};?\s*$`)
	asKeyword   = regexp.MustCompile(`\s+as\s+`)
)

// mapPaths finds the chunk behind each import path. A chunk's own path is not in
// its text, but every importer lists the names it takes from that path, and only
// one chunk exports all of them.
func mapPaths(chunks []string) map[string]int {
	needed := map[string]map[string]bool{}
	exporters := map[string][]int{}

	for i, chunk := range chunks {
		for _, m := range namedImport.FindAllStringSubmatch(chunk, -1) {
			if !strings.HasPrefix(m[2], "/$bunfs/") {
				continue
			}
			if needed[m[2]] == nil {
				needed[m[2]] = map[string]bool{}
			}
			for _, name := range splitNames(m[1]) {
				needed[m[2]][name[0]] = true
			}
		}
		for _, name := range exportedNames(chunk) {
			exporters[name] = append(exporters[name], i)
		}
	}

	byPath := map[string]int{}
	for path, names := range needed {
		var candidates map[int]bool
		for name := range names {
			next := map[int]bool{}
			for _, i := range exporters[name] {
				if candidates == nil || candidates[i] {
					next[i] = true
				}
			}
			candidates = next
		}
		if len(candidates) == 1 {
			for i := range candidates {
				byPath[path] = i
			}
		}
	}
	return byPath
}

func exportedNames(chunk string) []string {
	tail := chunk[max(0, len(chunk)-50_000):]
	m := exportList.FindStringSubmatch(tail)
	if m == nil {
		return nil
	}
	var names []string
	for _, name := range splitNames(m[1]) {
		names = append(names, name[1])
	}
	return names
}

// splitNames parses "a,b as c" into [original, alias] pairs.
func splitNames(list string) [][2]string {
	var names [][2]string
	for _, item := range strings.Split(list, ",") {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		parts := asKeyword.Split(item, 2)
		if len(parts) == 2 {
			names = append(names, [2]string{parts[0], parts[1]})
		} else {
			names = append(names, [2]string{parts[0], parts[0]})
		}
	}
	return names
}

var versionComment = regexp.MustCompile(`// Version: (\S+)`)

func chunkVersion(chunk string) string {
	if m := versionComment.FindStringSubmatch(chunk[:min(len(chunk), 2000)]); m != nil {
		return m[1]
	}
	return ""
}
