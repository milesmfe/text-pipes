# Text Pipes

Animated SVG text effect. Parses any `.ttf`/`.otf` font, traces each glyph, extends it with a randomised "pipe" path, and animates the strokes draining away from (or returning to) the letterforms.

<p align="center">
  <img src="assets/example.gif" alt="Text Pipes animation demo" width="600" />
</p>

Generation and rendering are split into two independent modules so you can run the heavy font-parsing step on a server and ship only the lightweight renderer to the browser. A root entry point re-exports both for convenience.

## Install

```bash
npm install @milesmfe/text-pipes
```

## Quick start

### 1. Generate path data

The generator accepts raw font bytes (`Buffer` in Node, `ArrayBuffer` in the browser) and returns a plain JSON-serialisable object.

**Node**

```js
import { readFileSync } from "fs";
import { buildSVGData } from "@milesmfe/text-pipes/generator";

const font = readFileSync("./fonts/Inter.ttf");
const data = buildSVGData(font, "hello world");
```

**Browser**

```js
import { buildSVGData } from "@milesmfe/text-pipes/generator";

const res  = await fetch("/fonts/Inter.ttf");
const font = await res.arrayBuffer();
const data = buildSVGData(font, "hello world");
```

### 2. Render and animate

The renderer creates an SVG that scales responsively to fill its container via `viewBox`. Just give the container a size and the text scales to fit.

```html
<div id="tp" style="width: 600px; max-width: 100%"></div>

<script type="module">
  import { TextPipes } from "@milesmfe/text-pipes/renderer";

  const tp = new TextPipes(document.getElementById("tp"), data, {
    color: "#fff",
  });

  // animate strokes away from the text, then bring them back
  await tp.drain();
  await tp.restore();

  // clean up when done
  tp.destroy();
</script>
```

Both `drain()` and `restore()` return a `Promise` that resolves when the animation completes, so you can chain animations or run logic after them.

### 3. Alignment

Control how the text sits within its container using the `align` option. The SVG's `preserveAspectRatio` is set accordingly.

```js
// left-aligned (e.g. for a heading above body text)
new TextPipes(el, data, { align: "left" });

// right-aligned
new TextPipes(el, data, { align: "right" });

// centered (default)
new TextPipes(el, data, { align: "center" });
```

### 4. Scroll-driven scrubbing

`setProgress` maps a `0`-`1` value directly to the animation position with transitions disabled, making it ideal for scroll-linked effects.

```js
window.addEventListener("scroll", () => {
  const t = window.scrollY / (document.body.scrollHeight - window.innerHeight);
  tp.setProgress(t);
});
```

### 5. One-import browser usage

If you don't need the server/client split, the root entry point re-exports everything:

```js
import { buildSVGData, TextPipes } from "@milesmfe/text-pipes";

const font = await fetch("/fonts/Inter.ttf").then(r => r.arrayBuffer());
const data = buildSVGData(font, "hello");
const tp   = new TextPipes(document.getElementById("tp"), data);
```

### 6. Static HTML (no bundler)

A self-contained IIFE build is included for use via CDN or a local `<script>` tag. It bundles all dependencies and exposes a `textPipes` global.

```html
<div id="tp" style="width: 600px; max-width: 100%"></div>

<script src="https://cdn.jsdelivr.net/npm/@milesmfe/text-pipes/dist/text-pipes.iife.js"></script>
<script>
  const { buildSVGData, TextPipes } = window.textPipes;

  fetch("/fonts/Inter.ttf")
    .then(r => r.arrayBuffer())
    .then(font => {
      const data = buildSVGData(font, "hello");
      const tp = new TextPipes(document.getElementById("tp"), data, {
        color: "#fff",
      });
      tp.drain();
    });
</script>
```

## Architecture

```
text-pipes/generator          text-pipes/renderer
┌──────────────────┐          ┌──────────────────┐
│  Font buffer      │          │  SVGData JSON     │
│  + text string    │─ JSON ──▶│  + DOM container  │
│                   │          │                   │
│  → SVGData JSON   │          │  → Live SVG       │
│    (serialisable) │          │    + drain/restore │
└──────────────────┘          └──────────────────┘
  Runs anywhere (Node/Browser)   Browser only
```

The generator depends on [opentype.js](https://github.com/opentypejs/opentype.js) and [svg-path-properties](https://github.com/rveciana/svg-path-properties). The renderer has zero runtime dependencies.

## API

### `text-pipes/generator`

#### `buildSVGData(fontBuffer, text, fontSize?, options?)`

Parses a font, traces the glyphs for `text`, appends a randomised pipe segment to each subpath, and returns an `SVGData` object.

| Param | Type | Default | Description |
|---|---|---|---|
| `fontBuffer` | `ArrayBuffer \| Buffer` | | Raw `.ttf` or `.otf` font data |
| `text` | `string` | | The text to render |
| `fontSize` | `number` | `150` | Font size in px (controls path detail, not display size) |
| `options` | `GeneratorOptions` | `{}` | See below |

**`GeneratorOptions`**

| Option | Type | Default | Description |
|---|---|---|---|
| `rng` | `() => number` | `Math.random` | Random number generator. Supply a seeded RNG for deterministic output (important for SSR) |
| `pipeMinLength` | `number` | `150` | Minimum length of the first pipe segment |
| `pipeMaxLength` | `number` | `350` | Maximum length of the first pipe segment |
| `pipeExtension` | `number` | `1500` | Length of the second (long) pipe segment |
| `speed` | `number` | `1600` | Base speed divisor for computing animation duration |
| `stagger` | `number` | `0.03` | Delay increment between successive subpaths (seconds) |

**Returns: `SVGData`**

```ts
interface SVGData {
  fillD: string;         // combined fill path for the solid text shape
  pathData: PathDatum[]; // per-subpath data (path d, lengths, timing)
  viewBox: string;       // SVG viewBox computed from the font's bounding box
  width: number;         // natural width of the text (px)
  height: number;        // natural height of the text (px)
  totalWidth: number;    // advance width of the text (px)
  fontSize: number;      // the fontSize that was used
  textOffsetX: number;   // legacy horizontal centering offset
  textOffsetY: number;   // legacy vertical centering offset
}

interface PathDatum {
  fullD: string;        // character subpath + pipe extension
  letterLength: number; // length of the character portion
  totalLength: number;  // length of the full path
  duration: number;     // computed animation duration (seconds)
  delay: number;        // computed stagger delay (seconds)
}
```

The returned object is plain JSON — you can `JSON.stringify` it, store it in a database, embed it in a `<script>` tag, or return it from an API endpoint.

---

### `text-pipes/renderer`

#### `new TextPipes(container, data, options?)`

Creates a responsive SVG inside `container`. The SVG uses `viewBox` to scale proportionally — the container only needs a width and the text scales to fit. No `position: relative` or explicit height required.

| Param | Type | Description |
|---|---|---|
| `container` | `HTMLElement` | The element that will hold the SVG |
| `data` | `SVGData` | The object returned by `buildSVGData` |
| `options` | `RendererOptions` | See below |

**`RendererOptions`**

| Option | Type | Default | Description |
|---|---|---|---|
| `color` | `string` | `"#111"` | CSS color for strokes and fill |
| `strokeWidth` | `number` | `2` | Stroke width in px |
| `fadeSpeedFactor` | `number` | `10` | How aggressively the fill fades during scrubbing (`1` = slow, `20` = instant) |
| `drainSpeed` | `number` | `1` | Speed multiplier for `drain()` transitions |
| `restoreSpeed` | `number` | `1` | Speed multiplier for `restore()` transitions |
| `easing` | `string` | `"linear"` | CSS easing function for stroke transitions |
| `align` | `"left" \| "center" \| "right"` | `"center"` | Horizontal alignment within the container |

#### Methods

| Method | Returns | Description |
|---|---|---|
| `drain()` | `Promise<void>` | Animate every stroke away from its character. Resolves when the animation completes |
| `restore()` | `Promise<void>` | Animate all strokes back to idle. Resolves when the animation completes and the fill is visible again |
| `setProgress(t)` | `void` | Scrub to an exact position. `0` = idle, `1` = fully drained. Transitions are disabled so updates are instant |
| `destroy()` | `void` | Remove the SVG and release all references |

#### Properties

| Property | Type | Description |
|---|---|---|
| `state` | `"idle" \| "draining" \| "returning"` | Current animation state (read-only) |

## Recipes

### Chaining animations

```js
await tp.drain();
console.log(tp.state); // "draining" (visually drained, strokes are away)

await tp.restore();
console.log(tp.state); // "idle" (text is fully visible again)
```

### Deterministic output for SSR

Pass a seeded RNG to get identical output across runs. This avoids hydration mismatches when generating on the server and rendering on the client.

```js
import seedrandom from "seedrandom";
import { buildSVGData } from "@milesmfe/text-pipes/generator";

const data = buildSVGData(font, "hello", 150, {
  rng: seedrandom("my-seed"),
});
```

### Pre-generate and cache

Since `SVGData` is plain JSON, you can generate once at build time and cache indefinitely.

```js
// build step or API route
import { readFileSync, writeFileSync } from "fs";
import { buildSVGData } from "@milesmfe/text-pipes/generator";

const font = readFileSync("./fonts/Inter.ttf");
const data = buildSVGData(font, "hello");
writeFileSync("./data/hello.json", JSON.stringify(data));
```

```html
<!-- client — only the renderer is loaded, no font parsing deps -->
<script type="module">
  import { TextPipes } from "@milesmfe/text-pipes/renderer";

  const data = await fetch("/data/hello.json").then(r => r.json());
  const tp = new TextPipes(document.getElementById("tp"), data);
  tp.drain();
</script>
```

### Custom easing

```js
const tp = new TextPipes(container, data, {
  easing: "cubic-bezier(0.4, 0, 0.2, 1)",
  drainSpeed: 0.6,
});
```

### Responsive sizing

The SVG scales to fit its container's width, maintaining aspect ratio. Just set a width on the container — no height needed.

```html
<!-- fills available width, height adjusts automatically -->
<div id="tp" style="width: 100%"></div>

<!-- constrained width -->
<div id="tp" style="width: 400px; max-width: 100%"></div>
```

### React

```jsx
import { useEffect, useRef } from "react";
import { TextPipes } from "@milesmfe/text-pipes/renderer";

function Pipes({ data }) {
  const ref = useRef(null);

  useEffect(() => {
    const tp = new TextPipes(ref.current, data, { color: "#fff" });
    tp.drain();
    return () => tp.destroy();
  }, [data]);

  return <div ref={ref} style={{ width: "100%", maxWidth: 600 }} />;
}
```

### Svelte

```svelte
<script>
  import { onMount } from "svelte";

  let { data } = $props();
  let container = $state<HTMLElement>();

  onMount(() => {
    const { TextPipes } = await import("@milesmfe/text-pipes/renderer");
    const tp = new TextPipes(container, data, { color: "#111" });
    tp.drain();
    return () => tp.destroy();
  });
</script>

<div bind:this={container} style="width: 100%; max-width: 600px;"></div>
```

## TypeScript

Full type declarations ship with the package. All interfaces are importable from any entry point:

```ts
import type { SVGData, GeneratorOptions } from "@milesmfe/text-pipes/generator";
import type { RendererOptions }           from "@milesmfe/text-pipes/renderer";

// or from the root
import type { SVGData, PathDatum, GeneratorOptions, RendererOptions } from "@milesmfe/text-pipes";
```

## Module formats

All entry points ship as ESM (`.mjs`) and CommonJS (`.cjs`) with sourcemaps and declaration maps. A self-contained IIFE build (`dist/text-pipes.iife.js`) is also included for CDN / `<script>` tag usage.

| File | Format | Dependencies | Use case |
|---|---|---|---|
| `dist/index.mjs` | ESM | External | Bundler (Vite, Webpack, etc.) |
| `dist/index.cjs` | CJS | External | Node `require()` |
| `dist/generator.mjs` / `.cjs` | ESM / CJS | External | Server-only generation |
| `dist/renderer.mjs` / `.cjs` | ESM / CJS | None | Client-only rendering |
| `dist/text-pipes.iife.js` | IIFE | Bundled | `<script>` tag, no build step |

## License

MIT
