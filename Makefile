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

# Release assets in bin/release, as install.sh and install.ps1 expect them.
# macOS gets a zipped menu bar app. Run this on a Mac: the macOS tray needs cgo.
release: web
	rm -rf bin/release
	mkdir -p bin/release
	for arch in arm64 amd64; do \
		app=bin/release/darwin-$$arch/Claudia.app; \
		mkdir -p $$app/Contents/MacOS; \
		GOOS=darwin GOARCH=$$arch CGO_ENABLED=1 go build -ldflags "$(LDFLAGS)" -o $$app/Contents/MacOS/claudia . || exit 1; \
		sed 's/VERSION/$(VERSION)/' packaging/darwin/Info.plist > $$app/Contents/Info.plist; \
		codesign --force --sign - $$app || exit 1; \
		ditto -c -k --keepParent $$app bin/release/claudia-darwin-$$arch.zip || exit 1; \
		rm -rf bin/release/darwin-$$arch; \
	done
	GOOS=windows GOARCH=amd64 go build -ldflags "$(LDFLAGS) -H=windowsgui" -o bin/release/claudia-windows-amd64.exe .
	GOOS=windows GOARCH=arm64 go build -ldflags "$(LDFLAGS) -H=windowsgui" -o bin/release/claudia-windows-arm64.exe .
	GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags "$(LDFLAGS)" -o bin/release/claudia-linux-amd64 .
	GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -ldflags "$(LDFLAGS)" -o bin/release/claudia-linux-arm64 .
	cd bin/release && shasum -a 256 claudia-* > checksums.txt

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
