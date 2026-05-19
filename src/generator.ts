import * as opentypeModule from "opentype.js";
import { svgPathProperties } from "svg-path-properties";
import type { SVGData, GeneratorOptions } from "./types.js";

const DEFAULTS = {
  pipeMinLength: 150,
  pipeMaxLength: 350,
  pipeExtension: 1500,
  speed: 1600,
  stagger: 0.03,
} as const;

function generatePipeD(
  startX: number,
  startY: number,
  rng: () => number,
  minLen: number,
  maxLen: number,
  extension: number,
): string {
  let currX = startX;
  let currY = startY;
  let isVertical = rng() > 0.5;

  const dir1 = rng() > 0.5 ? 1 : -1;
  const dist1 = rng() * (maxLen - minLen) + minLen;
  if (isVertical) currY += dir1 * dist1;
  else currX += dir1 * dist1;

  let d = ` L ${currX} ${currY}`;
  isVertical = !isVertical;

  const dir2 = rng() > 0.5 ? 1 : -1;
  if (isVertical) currY += dir2 * extension;
  else currX += dir2 * extension;

  return d + ` L ${currX} ${currY}`;
}

function extractMPoint(dStr: string): { x: number; y: number } {
  const m = dStr.match(/^M\s*([\d.eE+-]+)\s+([\d.eE+-]+)/);
  if (!m) throw new Error(`No M command in subpath: ${dStr.slice(0, 40)}`);
  return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
}

function commandsToSubpaths(commands: opentypeModule.PathCommand[]): string[] {
  const subPaths: string[] = [];
  let current = "";
  for (const cmd of commands) {
    if (cmd.type === "M") {
      if (current) subPaths.push(current);
      current = `M ${cmd.x} ${cmd.y}`;
    } else if (cmd.type === "L") {
      current += ` L ${cmd.x} ${cmd.y}`;
    } else if (cmd.type === "C") {
      current += ` C ${cmd.x1} ${cmd.y1}, ${cmd.x2} ${cmd.y2}, ${cmd.x} ${cmd.y}`;
    } else if (cmd.type === "Q") {
      current += ` Q ${cmd.x1} ${cmd.y1}, ${cmd.x} ${cmd.y}`;
    } else if (cmd.type === "Z") {
      current += " Z";
    }
  }
  if (current) subPaths.push(current);
  return subPaths;
}

export function buildSVGData(
  fontBuffer: ArrayBuffer | Buffer,
  text: string,
  fontSize = 150,
  options: GeneratorOptions = {},
): SVGData {
  const {
    rng = Math.random,
    pipeMinLength = DEFAULTS.pipeMinLength,
    pipeMaxLength = DEFAULTS.pipeMaxLength,
    pipeExtension = DEFAULTS.pipeExtension,
    speed = DEFAULTS.speed,
    stagger = DEFAULTS.stagger,
  } = options;

  let buffer: ArrayBuffer;
  if (fontBuffer instanceof ArrayBuffer) {
    buffer = fontBuffer;
  } else if (fontBuffer.buffer instanceof ArrayBuffer) {
    buffer = fontBuffer.buffer.slice(
      fontBuffer.byteOffset,
      fontBuffer.byteOffset + fontBuffer.byteLength,
    );
  } else {
    buffer = fontBuffer as unknown as ArrayBuffer;
  }

  // CJS/ESM interop fallback
  const opentype = (opentypeModule as any).default || opentypeModule;

  if (typeof opentype.parse !== "function") {
    throw new Error(
      "Font parser failed to initialize. Ensure opentype.js is resolving correctly.",
    );
  }

  let font: opentypeModule.Font;
  try {
    font = opentype.parse(buffer);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Failed to parse font: ${msg}. ` +
        "Ensure the file is a valid .ttf or .otf font. " +
        "Some OpenType features (e.g. advanced GSUB substitutions) are not supported by the underlying parser.",
    );
  }

  let textPath: opentypeModule.Path;
  let totalWidth: number;
  try {
    textPath = font.getPath(text, 0, fontSize, fontSize);
    totalWidth = font.getAdvanceWidth(text, fontSize);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Failed to render "${text}" with the provided font: ${msg}. ` +
        "The font may use unsupported OpenType features or may not contain glyphs for the requested characters.",
    );
  }
  const subPaths = commandsToSubpaths(textPath.commands);

  const pathData = subPaths.map((dStr, index) => {
    const endPt = extractMPoint(dStr);
    const pipeD = generatePipeD(
      endPt.x,
      endPt.y,
      rng,
      pipeMinLength,
      pipeMaxLength,
      pipeExtension,
    );
    const fullD = dStr + pipeD;

    const letterLength = new svgPathProperties(dStr).getTotalLength();
    const totalLength = new svgPathProperties(fullD).getTotalLength();

    return {
      fullD,
      letterLength,
      totalLength,
      duration: totalLength / speed,
      delay: index * stagger,
    };
  });

  return {
    fillD: subPaths.join(" "),
    pathData,
    totalWidth,
    fontSize,
    textOffsetX: totalWidth / 2,
    textOffsetY: (fontSize * 2) / 3,
  };
}

export type { SVGData, GeneratorOptions } from "./types.js";
