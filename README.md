
# Text Pipes

Animated SVG text pipe effect. Turn a font file and a string into SVG path data, render it, and expose drain / restore / scrub controls.

**Version 2.0:** `text-pipes` is now entirely environment-agnostic. You can generate the SVG data ahead of time on your server (Node.js) or entirely on the client (Browser).

## Install

```bash
npm install text-pipes

```

## How it works

`text-pipes` is split into two independent modules:

| **Entry**          | **Purpose**                                                                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `text-pipes/generator` | Parses a `.ttf`/`.otf`font from an ArrayBuffer/Buffer, traces each character, and extends every glyph with a randomised "pipe" path. Returns a plain JSON object. |
| `text-pipes/renderer`  | Takes the generated JSON, builds a responsive SVG, and controls the animation natively.                                                                               |

## Quick Start

### 1. Generate path data

The generator requires raw font data (a `Buffer` in Node, or an `ArrayBuffer` in the Browser).

**Option A: Generate on the Server (Node.js)**

```javascript
import { readFileSync } from "fs";
import { buildSVGData } from "text-pipes/generator";

const fontBuffer = readFileSync("./fonts/YourFont.ttf");
const data = buildSVGData(fontBuffer, "hello");

```

**Option B: Generate in the Browser**

```javascript
import { buildSVGData } from "text-pipes/generator";

const res = await fetch("/fonts/YourFont.ttf");
const fontBuffer = await res.arrayBuffer();
const data = buildSVGData(fontBuffer, "hello");

```

### 2. Render and control the animation

```javascript
<div id="pipes" style="width:100%;height:100vh"></div>

<script type="module">
  import { TextPipes } from "text-pipes/renderer";
  
  // Assuming 'data' was fetched from your API or generated in-browser:
  const tp = new TextPipes(document.getElementById("pipes"), data, {
    color: "#ffffff",      // Outline and fill color
    fadeSpeedFactor: 8,    // How fast the text fill fades out
    drainSpeed: 1.5,       // Multiplier for drain animation speed
    restoreSpeed: 1.2      // Multiplier for restore animation speed
  });

  // Animate the strokes away from the text
  tp.drain();

  // Bring them back
  tp.restore();

  // Or scrub to any position (0 = idle, 1 = fully drained)
  tp.setProgress(0.5);

  // Clean up when done
  tp.destroy();
</script>

```

## API

### `text-pipes/generator`

#### `buildSVGData(fontBuffer, text, fontSize?)`

| **Param** | **Type**           | **Default** | **Description**                        |
| --------------- | ------------------------ | ----------------- | -------------------------------------------- |
| `fontBuffer`  | `ArrayBuffer \| Buffer` | —                | Raw file data for a `.ttf`or `.otf`font. |
| `text`        | `string`               | —                | The text to render.                          |
| `fontSize`    | `number`               | `150`           | Font size in px.                             |

Returns a JSON object containing the combined `fillD` text shape, advancing width dimensions, and a `pathData` array mapping each character to its combined character+pipe SVG path lengths.

### `text-pipes/renderer`

#### `new TextPipes(container, data, options?)`

Creates a full-size SVG inside `container`, centred and responsive.

| **Param** | **Type**  | **Description**                      |
| --------------- | --------------- | ------------------------------------------ |
| `container`   | `HTMLElement` | The element that will hold the SVG.        |
| `data`        | `object`      | The object returned by `buildSVGData()`. |
| `options`     | `object`      | Optional settings (see below).             |

**Options:**

* `color` (string): CSS color for strokes and fill. Default: `"#111"`.
* `fadeSpeedFactor` (number): Multiplier dictating how fast the fill fades when scrubbing. Default: `10`.
* `drainSpeed` (number): Animation speed multiplier for `drain()`. Default: `1`.
* `restoreSpeed` (number): Animation speed multiplier for `restore()`. Default: `1`.

#### Methods

* `tp.drain()`: Animate every stroke away from its character.
* `tp.restore()`: Animate the strokes back to their idle position.
* `tp.setProgress(t)`: Scrub the animation to an exact position (`0` = idle, `1` = fully drained). Transitions are disabled during scrubbing so updates are instant (ideal for scroll triggers).
* `tp.destroy()`: Cancel pending animation frames, remove the resize listener, and clear the container.

## Dependencies

* [opentype.js](https://github.com/opentypejs/opentype.js "null") (Generator only)
* [svg-path-properties](https://github.com/rveciana/svg-path-properties "null") (Generator only)

The Renderer has zero dependencies and runs efficiently at 60fps natively in the browser.

## License

MIT
