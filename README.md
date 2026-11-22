# Claudia

A tray app that manages your Claude Code `settings.json`, `CLAUDE.md`, memory, MCP servers, skills, plugins and marketplaces, globally and for each project folder. The interface runs in your browser at http://127.0.0.1:7377.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/claude-settings-xyz/claudia/main/install.sh | sh   # macOS, Linux
```

```powershell
irm https://raw.githubusercontent.com/claude-settings-xyz/claudia/main/install.ps1 | iex   # Windows
```

See the [installation docs](docs/content/docs/installation.mdx) for options and uninstalling.

## Layout

| Path              | What it is                                                        |
| ----------------- | ----------------------------------------------------------------- |
| `main.go`         | Entry point: flags, single instance check, HTTP server, tray      |
| `tray.go`         | Tray menu with Open and Quit                                      |
| `icon.go`         | Tray icon, drawn at startup                                       |
| `internal/claude` | Reads and writes Claude Code files, lists projects, skills and plugins |
| `internal/schema` | Reads the settings schema from the installed Claude Code          |
| `internal/server` | JSON API under `/api` and checks on every request                 |
| `web`             | React, Vite and shadcn interface. `web/embed.go` embeds the build |
| `docs`            | Landing page and docs, made with Fumadocs                         |
| `packaging`       | Files for platform packages, such as the macOS `Info.plist`       |
| `install.sh`      | Installer for macOS and Linux                                     |
| `install.ps1`     | Installer for Windows                                             |

## Commands

```bash
make build    # web, then bin/claudia
make dev      # Go API on :7377 and Vite on :5173
make test     # go vet and go test
make app      # bin/Claudia.app for macOS (menu bar only)
make release  # release assets and checksums in bin/release
make docs     # docs dev server
```

You need Go 1.26 or later and Node.js 24 or later.

## Security

The server only listens on 127.0.0.1. It refuses requests with a different `Host` header, which blocks DNS rebinding. API requests must send an `X-Claudia` header. Browsers do not let other websites send that header, so they cannot change your files.
