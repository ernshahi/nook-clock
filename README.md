# Mac Timer — Tauri 2

A small native macOS timer: a lap stopwatch and countdown timers in a frameless, resizable window.

## Why this exists

macOS Clock is a system app, so a timer that should sit on the desktop — translucent, resizable, with the traffic-light window — has nowhere to live except as its own app. This project is that app. It follows a macOS stopwatch reference and runs as a Tauri window instead of a browser tab, so it can use native HUD vibrancy, working close / minimize / zoom controls, and a window size that persists between launches.

The stopwatch records laps. The timer has hour / minute / second pickers, common presets, an optional label, a progress ring, and a chime that brings the window forward when time is up.

## Run

1. Install Rust and Node.js.
2. `npm install`
3. `npm run tauri dev`

For a production build: `npm run tauri build`.
