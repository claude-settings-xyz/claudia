VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)
LDFLAGS := -s -w -X main.version=$(VERSION)

.PHONY: build web app release dev dev-go dev-web docs test clean

build: web
	go build -ldflags "$(LDFLAGS)" -o bin/claudia .

web: web/node_modules
	cd web && npm run build

web/node_modules: web/package-lock.json
	cd web && npm ci
	@touch $@

# macOS menu bar app, which you can add to Login Items.
app: build
	rm -rf bin/Claudia.app
	mkdir -p bin/Claudia.app/Contents/MacOS
	cp bin/claudia bin/Claudia.app/Contents/MacOS/claudia
	sed 's/VERSION/$(VERSION)/' packaging/darwin/Info.plist > bin/Claudia.app/Contents/Info.plist

release: web
	GOOS=darwin GOARCH=arm64 go build -ldflags "$(LDFLAGS)" -o bin/claudia-darwin-arm64 .
	GOOS=darwin GOARCH=amd64 CGO_ENABLED=1 go build -ldflags "$(LDFLAGS)" -o bin/claudia-darwin-amd64 .
	GOOS=windows GOARCH=amd64 go build -ldflags "$(LDFLAGS) -H=windowsgui" -o bin/claudia-windows-amd64.exe .
	GOOS=windows GOARCH=arm64 go build -ldflags "$(LDFLAGS) -H=windowsgui" -o bin/claudia-windows-arm64.exe .
	GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags "$(LDFLAGS)" -o bin/claudia-linux-amd64 .
	GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -ldflags "$(LDFLAGS)" -o bin/claudia-linux-arm64 .

# Go API on :7377 and Vite on :5173. Open http://localhost:5173.
dev:
	$(MAKE) -j2 dev-go dev-web

dev-go:
	go run -tags dev . -no-open

dev-web: web/node_modules
	cd web && npm run dev

docs:
	cd docs && npm run dev

# Only list Go packages by name: web/node_modules can contain stray .go files.
test: web
	go vet . ./internal/... ./web
	go test ./internal/...

clean:
	rm -rf bin web/dist
