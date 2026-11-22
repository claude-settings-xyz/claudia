#!/bin/sh
# Installs Claudia on macOS and Linux.
#
#   curl -fsSL https://raw.githubusercontent.com/claude-settings-xyz/claudia/main/install.sh | sh
#
# Options, as environment variables:
#   CLAUDIA_VERSION=v1.2.0   Install this release instead of the latest one.
#   CLAUDIA_NO_AUTOSTART=1   Do not start Claudia when you log in.
#
# To uninstall:
#   curl -fsSL https://raw.githubusercontent.com/claude-settings-xyz/claudia/main/install.sh | sh -s -- --uninstall

set -eu

repo="claude-settings-xyz/claudia"
releases="${CLAUDIA_DOWNLOAD_URL:-https://github.com/$repo/releases}"
version="${CLAUDIA_VERSION:-latest}"
label="app.claudia"
port=7377

say() { printf '%s\n' "$*"; }
fail() {
	printf 'claudia: %s\n' "$*" >&2
	exit 1
}
has() { command -v "$1" >/dev/null 2>&1; }

usage() {
	say "Usage: install.sh [--uninstall]"
	say ""
	say "Installs Claudia, starts it, and starts it again when you log in."
	say "Set CLAUDIA_VERSION to pick a release and CLAUDIA_NO_AUTOSTART=1 to skip the login item."
}

download() {
	if has curl; then
		curl -fsSL --retry 3 -o "$2" "$1"
	elif has wget; then
		wget -q -O "$2" "$1"
	else
		fail "install curl or wget, then try again."
	fi
}

# The API only answers requests that send the X-Claudia header.
responds() {
	if has curl; then
		curl -fsS -m 2 -H 'X-Claudia: 1' -o /dev/null "http://127.0.0.1:$port/api/health" 2>/dev/null
	else
		wget -q -T 2 --header 'X-Claudia: 1' -O /dev/null "http://127.0.0.1:$port/api/health" 2>/dev/null
	fi
}

sha256() {
	if has sha256sum; then
		sha256sum "$1" | cut -d ' ' -f 1
	elif has shasum; then
		shasum -a 256 "$1" | cut -d ' ' -f 1
	else
		fail "cannot check the download. Install sha256sum or shasum, then try again."
	fi
}

detect() {
	case "$(uname -s)" in
	Darwin) os=darwin ;;
	Linux) os=linux ;;
	*) fail "this script is for macOS and Linux. On Windows, use install.ps1." ;;
	esac

	case "$(uname -m)" in
	x86_64 | amd64) arch=amd64 ;;
	arm64 | aarch64) arch=arm64 ;;
	*) fail "there is no Claudia build for $(uname -m)." ;;
	esac

	# A shell that runs under Rosetta reports x86_64 on Apple silicon.
	if [ "$os" = darwin ] && [ "$arch" = amd64 ] && [ "$(sysctl -n sysctl.proc_translated 2>/dev/null || true)" = 1 ]; then
		arch=arm64
	fi
}

# Downloads a release asset into $tmp and checks it against checksums.txt.
fetch() {
	asset=$1
	if [ "$version" = latest ]; then
		base="$releases/latest/download"
	else
		base="$releases/download/$version"
	fi

	say "Downloading $asset ($version)..."
	download "$base/$asset" "$tmp/$asset" || fail "could not download $base/$asset."
	download "$base/checksums.txt" "$tmp/checksums.txt" || fail "could not download $base/checksums.txt."

	expected=$(awk -v name="$asset" '$2 == name || $2 == "*" name { print $1; exit }' "$tmp/checksums.txt")
	[ -n "$expected" ] || fail "checksums.txt has no entry for $asset."
	[ "$(sha256 "$tmp/$asset")" = "$expected" ] || fail "the download of $asset is damaged. Try again."
}

stop_running() {
	if [ "$os" = darwin ]; then
		launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
	fi
	if pgrep -x claudia >/dev/null 2>&1; then
		say "Stopping the running Claudia..."
		pkill -x claudia 2>/dev/null || true
		tries=0
		while pgrep -x claudia >/dev/null 2>&1 && [ "$tries" -lt 10 ]; do
			sleep 1
			tries=$((tries + 1))
		done
	fi
}

open_url() {
	if [ "$os" = darwin ]; then
		open "$1"
	elif has xdg-open; then
		xdg-open "$1" >/dev/null 2>&1 || true
	fi
}

# Waits until the server answers, then opens the interface.
open_when_ready() {
	tries=0
	while [ "$tries" -lt 15 ]; do
		if responds; then
			open_url "http://127.0.0.1:$port"
			return 0
		fi
		sleep 1
		tries=$((tries + 1))
	done
	say "Claudia did not start. Run $1 to see why."
}

install_macos() {
	fetch "claudia-darwin-$arch.zip"
	app="$HOME/Applications/Claudia.app"
	binary="$app/Contents/MacOS/claudia"
	agent="$HOME/Library/LaunchAgents/$label.plist"

	ditto -x -k "$tmp/claudia-darwin-$arch.zip" "$tmp/unzipped"
	[ -d "$tmp/unzipped/Claudia.app" ] || fail "the download does not contain Claudia.app."

	stop_running
	mkdir -p "$HOME/Applications"
	rm -rf "$app"
	mv "$tmp/unzipped/Claudia.app" "$app"
	say "Installed $app"

	if [ -n "${CLAUDIA_NO_AUTOSTART:-}" ]; then
		rm -f "$agent"
		open "$app"
		say ""
		say "Claudia is running in the menu bar."
		say "To start it when you log in, add it in System Settings > General > Login Items."
		return
	fi

	# A launch agent starts Claudia at login without opening the browser.
	mkdir -p "$HOME/Library/LaunchAgents"
	cat >"$agent" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>$label</string>
	<key>ProgramArguments</key>
	<array>
		<string>$binary</string>
		<string>-no-open</string>
	</array>
	<key>RunAtLoad</key>
	<true/>
	<key>ProcessType</key>
	<string>Interactive</string>
</dict>
</plist>
EOF

	if launchctl bootstrap "gui/$(id -u)" "$agent" 2>/dev/null; then
		open_when_ready "$binary"
	else
		# Outside a desktop session, for example over SSH, the agent loads at the next login.
		open "$app" 2>/dev/null || true
	fi
	say ""
	say "Claudia is running in the menu bar. It starts again when you log in."
}

# The Claudia logo, for the app menu and the desktop entry.
write_icon() {
	mkdir -p "$(dirname "$1")"
	cat >"$1" <<'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="16" fill="#e07a5f"/>
  <rect x="11" y="19.5" width="42" height="25" rx="12.5" fill="none" stroke="#fff" stroke-width="4.5"/>
  <circle cx="41" cy="32" r="6.5" fill="#fff"/>
</svg>
EOF
}

# Writes a desktop entry. The second argument adds options to the command.
write_entry() {
	mkdir -p "$(dirname "$1")"
	cat >"$1" <<EOF
[Desktop Entry]
Type=Application
Name=Claudia
Comment=Manage your Claude Code settings
Exec="$binary"$2
Icon=claudia
Terminal=false
Categories=Development;Utility;
EOF
}

install_linux() {
	fetch "claudia-linux-$arch"
	bin_dir="$HOME/.local/bin"
	binary="$bin_dir/claudia"
	data="${XDG_DATA_HOME:-$HOME/.local/share}"
	autostart="${XDG_CONFIG_HOME:-$HOME/.config}/autostart/claudia.desktop"

	stop_running
	mkdir -p "$bin_dir"
	# Copy next to the target first, so that the rename replaces the old file in one step.
	cp "$tmp/claudia-linux-$arch" "$binary.new"
	chmod 755 "$binary.new"
	mv -f "$binary.new" "$binary"
	say "Installed $binary"

	write_icon "$data/icons/hicolor/scalable/apps/claudia.svg"
	write_entry "$data/applications/claudia.desktop" ""
	if [ -n "${CLAUDIA_NO_AUTOSTART:-}" ]; then
		rm -f "$autostart"
	else
		write_entry "$autostart" " -no-open"
	fi

	if [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then
		nohup "$binary" -no-open >/dev/null 2>&1 &
		open_when_ready "$binary"
		say ""
		say "Claudia is running in the tray."
	else
		say ""
		say "There is no desktop session, so Claudia did not start. Run claudia to start it."
	fi
	if [ -z "${CLAUDIA_NO_AUTOSTART:-}" ]; then
		say "It starts when you log in."
	fi

	case ":$PATH:" in
	*":$bin_dir:"*) ;;
	*) say "Add $bin_dir to your PATH to run claudia from a terminal." ;;
	esac
	case "${XDG_CURRENT_DESKTOP:-}" in
	*GNOME*) say "On GNOME, the tray icon needs the AppIndicator extension." ;;
	esac
}

uninstall() {
	stop_running
	if [ "$os" = darwin ]; then
		rm -rf "$HOME/Applications/Claudia.app" \
			"$HOME/Library/LaunchAgents/$label.plist" \
			"$HOME/Library/Application Support/claudia" \
			"$HOME/Library/Caches/claudia"
	else
		data="${XDG_DATA_HOME:-$HOME/.local/share}"
		config="${XDG_CONFIG_HOME:-$HOME/.config}"
		rm -rf "$HOME/.local/bin/claudia" \
			"$data/applications/claudia.desktop" \
			"$data/icons/hicolor/scalable/apps/claudia.svg" \
			"$config/autostart/claudia.desktop" \
			"$config/claudia" \
			"${XDG_CACHE_HOME:-$HOME/.cache}/claudia"
	fi
	say "Claudia is uninstalled. Your Claude Code files did not change."
}

main() {
	case "${1:-}" in
	"") action=install ;;
	--uninstall) action=uninstall ;;
	-h | --help)
		usage
		exit 0
		;;
	*) fail "unknown option: $1. Run with --help to see the options." ;;
	esac

	detect
	if [ "$action" = uninstall ]; then
		uninstall
		return
	fi

	tmp=$(mktemp -d 2>/dev/null || mktemp -d -t claudia)
	trap 'rm -rf "$tmp"' EXIT
	trap 'exit 1' INT TERM

	if [ "$os" = darwin ]; then
		install_macos
	else
		install_linux
	fi
}

# Everything runs from here, so that a partial download does nothing.
main "$@"
