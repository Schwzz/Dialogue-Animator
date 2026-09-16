# Dialogue Animator

A single-file, browser-based tool for building retro/visual-novel-style dialogue box animations — the kind of typewriter text boxes you'd see in RPGs, VNs, or game-dev devlogs. Write a script, style the box, hit play, and record the preview (or use Presenter Mode) for your video, stream overlay, or game mockup.

No build step, no dependencies, no backend. It's one `.html` file — open it in a browser and it works.

## Features

- **Block-based script editor** — break dialogue into blocks, each with its own speaker name, expression, and typewriter text
- **Typewriter animation** with speed presets (Casual Read → Rapid Fire) or a custom speed slider
- **Text effect tags** — wrap words in `[wave]`, `[shake]`, `[rainbow]`, `[big]`, or `[small]`
- **Event tags** — trigger `[flash]`, `[screenshake]`, `[pause:N]` (hold N seconds), or `[expr:N]` (swap portrait) mid-line
- **4 expression portrait slots** per character, swappable live or mid-line via tags
- **Layout controls** — toggle portrait, name tag, and portrait shake; switch between a full-width bottom bar or a floating box you position and resize with sliders
- **Box styling** — height, font size, and border/text/background/name-tag colors
- **Background** — upload an image or set a solid color
- **Procedural blip sound** (Web Audio API) with adjustable pitch, pitch variance, waveform, duration, and volume — no audio files needed
- **Auto-advance** between blocks, or set a per-block wait time
- **Playback controls** — play, pause, stop, skip/advance, with keyboard shortcuts
- **Presenter Mode** — scales the preview to fill your screen for recording or streaming
- **Built-in guide** — in-app reference for tags and shortcuts

## Getting started

1. Download `dialogue-animator-v5.html`
2. Open it in any modern browser (Chrome, Firefox, Edge, Safari)

That's it — everything runs client-side. To host it (e.g. GitHub Pages), you can rename it to `index.html` and enable Pages on the repo.

> The UI font (Inter) and script/dialogue font (JetBrains Mono) load from Google Fonts over the network. If you need this to work fully offline, download those fonts and swap the `<link>` tags in `<head>` for local `@font-face` declarations.

## Writing a script

Each block is one unit of dialogue: a speaker, an expression slot, optional wait time, and the text itself. Use the **+ Add Block** button to add more, and the block list on the left to reorder or delete them.

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
| Click preview | Same as `Space` |

## Tech notes

- Single HTML file — all CSS and JS are inline, no build tooling
- No external JS libraries; sound is generated with the Web Audio API (`OscillatorNode`), no audio files
- Fonts loaded from Google Fonts CDN (Inter for the UI, JetBrains Mono for script/dialogue text)
- State (script, images, colors) lives in memory only — nothing is saved automatically, so export/save your script text somewhere safe before closing the tab
