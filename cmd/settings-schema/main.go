// Command settings-schema prints the settings schema of the installed Claude
// Code as JSON. The docs homepage keeps a copy, because a static site cannot
// read it from your computer.
package main

import (
	"encoding/json"
	"log"
	"os"

	"claudia/internal/schema"
)

func main() {
	result, err := schema.NewLoader().Load()
	if err != nil {
		log.Fatal(err)
	}
	out := struct {
		Version string          `json:"version"`
		Schema  json.RawMessage `json:"schema"`
	}{result.Version, result.Schema}
	if err := json.NewEncoder(os.Stdout).Encode(out); err != nil {
		log.Fatal(err)
	}
}
