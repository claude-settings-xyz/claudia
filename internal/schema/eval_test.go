package schema

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// A fake zod: every schema knows how to describe itself as JSON Schema.
const libraryChunk = `// @bun @bytecode
function str(d){return{toJSONSchema(){return{type:"string",description:d}}}}
function bool(d){return{toJSONSchema(){return{type:"boolean",description:d}}}}
export{str as s,bool as b};`

const settingsChunk = `// @bun @bytecode
// Version: 9.8.7
import{s as n,b as P}from"/$bunfs/root/chunk-lib.js";import{readFileSync}from"node:fs";
var unused=readFileSync("/etc/hosts").toString();
process.exit(1);
class Whole{constructor(f){this.f=f}whole(){let p={};for(let k in this.f)p[k]=this.f[k]();return{toJSONSchema(){let o={};for(let k in p)o[k]=p[k].toJSONSchema();return{type:"object",properties:o}}}}}
function fields(e,{strict:o=!1}={}){function inner(l){return"}"}return{$schema:()=>n("JSON Schema reference"),model:()=>n("Model"),verbose:()=>P("Verbose output")}}
function extra(){return[]}
var built=()=>new Whole(fields(extra()));
export{built as x};`

func writeFakeBinary(t *testing.T, chunks ...string) string {
	path := filepath.Join(t.TempDir(), "claude")
	data := "\x7fELF binary header\x00\x00" + strings.Join(chunks, "\x00") + "\x00more binary\x00"
	if err := os.WriteFile(path, []byte(data), 0o755); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestEvaluateFakeBundle(t *testing.T) {
	path := writeFakeBinary(t, libraryChunk, settingsChunk)
	b, err := readBundle(path)
	if err != nil {
		t.Fatal(err)
	}
	if len(b.chunks) != 2 {
		t.Fatalf("got %d chunks", len(b.chunks))
	}

	text, version, err := evaluate(b)
	if err != nil {
		t.Fatal(err)
	}
	if version != "9.8.7" {
		t.Errorf("version %q", version)
	}

	var schema struct {
		Properties map[string]struct {
			Type        string `json:"type"`
			Description string `json:"description"`
		} `json:"properties"`
	}
	if err := json.Unmarshal([]byte(text), &schema); err != nil {
		t.Fatal(err, text)
	}
	if got := schema.Properties["verbose"]; got.Type != "boolean" || got.Description != "Verbose output" {
		t.Errorf("verbose: %+v", got)
	}
	if len(schema.Properties) != 3 {
		t.Errorf("got %d properties: %s", len(schema.Properties), text)
	}
}

func TestReadChunksAcrossBufferBoundary(t *testing.T) {
	big := "// @bun\n" + strings.Repeat("x", 3<<20)
	path := writeFakeBinary(t, big, libraryChunk)
	chunks, err := readChunks(path)
	if err != nil {
		t.Fatal(err)
	}
	if len(chunks) != 2 || len(chunks[0]) != len(big) {
		t.Fatalf("got %d chunks", len(chunks))
	}
}

// Runs against the Claude Code on this computer, when there is one.
func TestInstalledClaudeCode(t *testing.T) {
	if testing.Short() || len(candidates()) == 0 {
		t.Skip("Claude Code is not installed")
	}
	loader := &Loader{results: map[string]Result{}}
	result, err := loader.Load()
	if err != nil {
		t.Fatal(err)
	}
	var schema struct {
		Properties map[string]json.RawMessage `json:"properties"`
	}
	json.Unmarshal(result.Schema, &schema)
	for _, key := range []string{"permissions", "env", "model", "hooks"} {
		if _, ok := schema.Properties[key]; !ok {
			t.Errorf("missing %s", key)
		}
	}
	t.Logf("Claude Code %s: %d settings", result.Version, len(schema.Properties))
}

func TestEvaluateWithoutBuilder(t *testing.T) {
	settings := `// @bun
import{s as n}from"/$bunfs/root/chunk-lib.js";
function fields(e){return{$schema:()=>n("Reference"),model:()=>n("Model")}}
export{fields as f};`
	b, err := readBundle(writeFakeBinary(t, libraryChunk, settings))
	if err != nil {
		t.Fatal(err)
	}
	text, _, err := evaluate(b)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(text, `"model":{"type":"string","description":"Model"}`) {
		t.Fatalf("unexpected schema: %s", text)
	}
}
