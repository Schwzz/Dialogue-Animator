# Dialogue Animator

A single-file, browser-based tool for building retro/visual-novel-style dialogue box animations — the kind of typewriter text boxes you'd see in RPGs, VNs, or game-dev devlogs. Write a script, style the box, hit play, and record the preview (or use Presenter Mode) for your video, stream overlay, or game mockup.

No build step, no runtime JavaScript dependencies, no backend. It's one `.html` file — open it in a browser and it works.

## Features

- **Block-based script editor** — break dialogue into blocks, each with its own speaker name, expression, and typewriter text
- **Typewriter animation** with speed presets (Casual Read → Rapid Fire) or a custom speed slider
- **Text effect tags** — wrap words in `[wave]`, `[shake]`, `[rainbow]`, `[big]`, or `[small]`
- **Event tags** — trigger `[flash]`, `[screenshake]`, `[pause:N]` (hold N seconds), or `[expr:N]` (swap portrait) mid-line
- **4 shared expression portrait slots**, swappable live or mid-line via tags
- **Layout controls** — toggle portrait, name tag, and portrait shake; switch between a full-width bottom bar or a floating box you position and resize with sliders
- **Box styling** — height, font size, and border/text/background/name-tag colors
- **Background** — upload an image or set a solid color
- **Procedural blip sound** (Web Audio API) with adjustable pitch, pitch variance, waveform, duration, and volume — no audio files needed
- **Auto-advance** between blocks, or set a per-block wait time
- **Playback controls** — play, pause, stop, skip/advance, with keyboard shortcuts; pausing preserves typing and wait countdowns
- **Presenter Mode** — scales the preview to fill your screen for recording or streaming, with clickable advance and a clean recording view
- **Project save/load** — portable JSON files include dialogue, portraits, background, and settings
- **Automatic recovery** — edits and assets are saved in this browser using IndexedDB
- **Built-in guide** — in-app reference for tags and shortcuts

## Getting started

1. Download `Dialogue-Animator.html`
2. Open it in any modern browser (Chrome, Firefox, Edge, Safari)

That's it — everything runs client-side. To host it (e.g. GitHub Pages), you can rename it to `index.html` and enable Pages on the repo.

> The UI font (Inter) and script/dialogue font (JetBrains Mono) load from Google Fonts over the network. If you need this to work fully offline, download those fonts and swap the `<link>` tags in `<head>` for local `@font-face` declarations.

## Writing a script

Each block is one unit of dialogue: a speaker, an expression slot, optional wait time, and the text itself. Use the **+ Add Block** button to add more, and the block list on the left to reorder or delete them.

Edits apply automatically while you type. **Apply Block** also commits the current fields; **Save Project** downloads the complete project as a JSON file. **Open Project** restores that file, including images and settings. Opening a replacement asks before discarding changed work.

Recovery runs automatically after edits and restores on the next visit in the same browser and origin. Keep a downloaded project file for a portable backup; clearing browser data, changing browser/origin, or restricted browser storage can prevent recovery. Storage failures appear beside the project buttons. Images are limited to 25 MB each and project files to 100 MB.

Adding, deleting, or reordering blocks stops playback safely. **Play** resumes when paused and otherwise starts from the beginning. **Space** skips typing or the current wait. Auto-advance loops at the end; a positive per-block wait also advances (or restarts at the last block).

### Text effects

Wrap the text you want styled, and close the tag with `[/]`:

| Tag | Effect |
|---|---|
| `[wave]...[/]` | Floating wave animation |
| `[shake]...[/]` | Shaky text |
| `[rainbow]...[/]` | Colour-cycling text |
| `[big]...[/]` | Larger text |
| `[small]...[/]` | Smaller text |

### Event tags

These fire instantly as the typewriter reaches them — no closing tag needed:

| Tag | Effect |
|---|---|
| `[flash]` | White screen flash |
| `[screenshake]` | Shakes the preview |
| `[pause:2]` | Holds for 2 seconds before continuing |
| `[expr:1]` – `[expr:4]` | Swaps the portrait to that expression slot |

Unknown or invalid tags remain visible. Escape literal brackets as `\[wave\]` to display `[wave]` without applying an effect. `[pause:0]` adds no delay; pause values must be finite, nonnegative, and at most 3,600 seconds. Expressions must be slots 1 through 4.

### Example

```
* This is [wave]really[/] important...
[pause:1.5][expr:2][flash]* WATCH OUT!
```

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Space` | Play / skip typing / advance to next block |
| `P` | Pause / resume |
| `Esc` | Stop (or exit Presenter Mode) |
| `F` | Toggle Presenter Mode |
| `H` | Show/hide recording overlays in Presenter Mode |
| Click preview | Same as `Space` |

## Tech notes

- Single HTML file — all CSS and JS are inline, no build tooling
- No external JS libraries; sound is generated with the Web Audio API (`OscillatorNode`), no audio files
- Fonts loaded from Google Fonts CDN (Inter for the UI, JetBrains Mono for script/dialogue text)
- Versioned project JSON embeds uploaded images as data URLs; recovery uses IndexedDB and reports storage failures
- Dialogue is rendered as text in the block list, and preview text is escaped before effect markup is added

## Regression tests

Node.js 20 or newer is needed only for development tests. Normal use still requires only the HTML file.

```sh
npm ci
npx playwright install chromium
npm test
```

The Chromium tests cover draft preservation, project file round trips, recovery and storage failures, safe rendering, parser validation, playback cancellation/pause timing, and Presenter Mode. GitHub Actions runs the suite on pushes and pull requests.
