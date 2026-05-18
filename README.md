# Text Pipes

Animated SVG text pipe effect. Turn a font file and a string into SVG path data, render it, and exposes drain / restore / scrub controls.

## Install

```bash
npm install text-pipes
```

## How it works

`text-pipes` is split into two entry points:

| Entry                 | Runs in | Purpose                                                                                                                                    |
| --------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `text-pipes/server` | Node    | Parse a `.ttf` / `.otf` font, trace each character, and extend every glyph with a randomised "pipe" path. Returns a plain JSON object. |
| `text-pipes/client` | Browser | Take that JSON, build a responsive SVG, and animate strokes with CSS `stroke-dashoffset` transitions.                                    |

The server does the expensive work once. The client is dependency-free and renders at 60 fps.

## Quick start

### 1. Generate path data on the server

```js
import { buildSVGData } from "text-pipes/server";

const data = buildSVGData("/absolute/path/to/Font.ttf", "hello");
```

`buildSVGData` returns a JSON-serialisable object; cache it, persist it, or serve it from an API endpoint.

### 2. Serve the client module to the browser

The client entry point is a plain `.mjs` file. Expose it however suits your stack:

```js
// Express example
import { createRequire } from "module";
const require = createRequire(import.meta.url);

app.get("/text-pipes-client.mjs", (_req, res) => {
  res.type("application/javascript");
  res.sendFile(require.resolve("text-pipes/client"));
});
```

### 3. Render and control the animation

```html
<div id="pipes" style="width:100%;height:100vh"></div>

<script type="module">
  import { TextPipes } from "/text-pipes-client.mjs";

  const res  = await fetch("/api/textpipes");
  const data = await res.json();

  const tp = new TextPipes(document.getElementById("pipes"), data);

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

### Server: `text-pipes/server`

#### `buildSVGData(fontPath, text, fontSize?)`

| Param        | Type       | Default | Description                                        |
| ------------ | ---------- | ------- | -------------------------------------------------- |
| `fontPath` | `string` | —      | Absolute path to a `.ttf` or `.otf` font file. |
| `text`     | `string` | —      | The text to render.                                |
| `fontSize` | `number` | `150` | Font size in px.                                   |

Returns an object:

| Key             | Type       | Description                                            |
| --------------- | ---------- | ------------------------------------------------------ |
| `fillD`       | `string` | Combined SVG `d` attribute for the solid text shape. |
| `pathData`    | `Array`  | One entry per character (see below).                   |
| `totalWidth`  | `number` | Advance width of the full string at `fontSize`.      |
| `fontSize`    | `number` | The font size that was used.                           |
| `textOffsetX` | `number` | Half of `totalWidth`: useful for centring.           |
| `textOffsetY` | `number` | Vertical centre offset (`fontSize * 2/3`).           |

Each element of `pathData`:

| Key              | Type       | Description                                                       |
| ---------------- | ---------- | ----------------------------------------------------------------- |
| `fullD`        | `string` | SVG `d` combining the character outline and its pipe extension. |
| `letterLength` | `number` | Path length of the character portion only.                        |
| `totalLength`  | `number` | Path length including the pipe.                                   |
| `duration`     | `number` | Suggested animation duration in seconds (`totalLength / 1600`). |
| `delay`        | `number` | Stagger delay in seconds (`index * 0.03`).                      |

### Client: `text-pipes/client`

#### `new TextPipes(container, data)`

| Param         | Type            | Description                                |
| ------------- | --------------- | ------------------------------------------ |
| `container` | `HTMLElement` | The element that will hold the SVG.        |
| `data`      | `object`      | The object returned by `buildSVGData()`. |

Creates a full-size SVG inside `container`, centred and responsive (re-centres on window resize).

#### `tp.drain()`

Animate every stroke away from its character. Each stroke's transition is staggered by the `delay` value in `pathData`.

#### `tp.restore()`

Animate the strokes back to their idle position.

#### `tp.setProgress(t)`

Scrub the animation to an exact position.

| Param | Type       | Description                                                                |
| ----- | ---------- | -------------------------------------------------------------------------- |
| `t` | `number` | `0` = idle (text visible), `1` = fully drained. Clamped to `[0, 1]`. |

Transitions are disabled during scrubbing so the update is instant: useful for scroll-linked or slider-driven effects.

#### `tp.destroy()`

Cancel pending animation frames, remove the resize listener, and clear the container.

## Full example

A minimal Express app that serves the effect:

```
example/
├── fonts/
│   └── YourFont.ttf
├── public/
│   └── index.html
├── server.js
└── package.json
```

**server.js**

```js
import express from "express";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { buildSVGData } from "text-pipes/server";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require   = createRequire(import.meta.url);
const app       = express();

let cached;

app.get("/api/textpipes", (_req, res) => {
  if (!cached) {
    cached = buildSVGData(join(__dirname, "fonts/YourFont.ttf"), "hello");
  }
  res.json(cached);
});

app.get("/text-pipes-client.mjs", (_req, res) => {
  res.type("application/javascript");
  res.sendFile(require.resolve("text-pipes/client"));
});

app.use(express.static(join(__dirname, "public")));

app.listen(3000, () => console.log("http://localhost:3000"));
```

**public/index.html**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>text-pipes</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; background: #fff; overflow: hidden; }
    #pipes { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="pipes"></div>
  <script type="module">
    import { TextPipes } from "/text-pipes-client.mjs";

    const res  = await fetch("/api/textpipes");
    const data = await res.json();
    const tp   = new TextPipes(document.getElementById("pipes"), data);

    // drain after 1 second, restore after 3
    setTimeout(() => tp.drain(), 1000);
    setTimeout(() => tp.restore(), 3000);
  </script>
</body>
</html>
```

## Dependencies

| Package                                                             | Purpose                                               |
| ------------------------------------------------------------------- | ----------------------------------------------------- |
| [opentype.js](https://github.com/opentypejs/opentype.js)               | Font parsing and glyph path extraction (server only). |
| [svg-path-properties](https://github.com/rveciana/svg-path-properties) | Path length calculation (server only).                |

The client entry has zero dependencies.

## License

MIT
