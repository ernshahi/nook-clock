# Mac Timer — Tauri 2

A small native macOS timer: a lap stopwatch and countdown timers in a frameless, resizable window.

## Why this exists

The default macOS Clock app covers too much of the screen, and it cannot be resized small enough to sit in a corner while you keep working. Its minimum size is already large enough to get in the way. This app exists so the timer can shrink down and stay out of the way.

The stopwatch records laps. The timer has hour / minute / second pickers, common presets, an optional label, a progress ring, and a chime that brings the window forward when time is up.

## Run

1. Install Rust and Node.js.
2. `npm install`
3. `npm run tauri dev`

For a production build: `npm run tauri build`.
