import { readFileSync } from "fs";
import opentype from "opentype.js";
import { svgPathProperties } from "svg-path-properties";

function generatePipeD(startX, startY) {
  let currX = startX;
  let currY = startY;
  let isVertical = Math.random() > 0.5;

  const dir1 = Math.random() > 0.5 ? 1 : -1;
  const dist1 = Math.random() * 200 + 150;
  if (isVertical) currY += dir1 * dist1;
  else currX += dir1 * dist1;

  let d = ` L ${currX} ${currY}`;
  isVertical = !isVertical;

  const dir2 = Math.random() > 0.5 ? 1 : -1;
  if (isVertical) currY += dir2 * 1500;
  else currX += dir2 * 1500;

  return d + ` L ${currX} ${currY}`;
}

function extractMPoint(dStr) {
  const m = dStr.match(/^M\s*([\d.eE+-]+)\s+([\d.eE+-]+)/);
  if (!m) throw new Error(`No M command in subpath: ${dStr.slice(0, 40)}`);
  return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
}

function commandsToSubpaths(commands) {
  const subPaths = [];
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

/**
 * @param {string} fontPath  — absolute path to a .ttf/.otf font file
 * @param {string} text      — the word(s) to render
 * @param {number} [fontSize=150]
 * @returns {{ fillD: string, pathData: Array, totalWidth: number, fontSize: number, textOffsetX: number, textOffsetY: number }}
 */
export function buildSVGData(fontPath, text, fontSize = 150) {
  const buf = readFileSync(fontPath);
  const font = opentype.parse(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  );

  const textPath = font.getPath(text, 0, fontSize, fontSize);
  const totalWidth = font.getAdvanceWidth(text, fontSize);
  const subPaths = commandsToSubpaths(textPath.commands);

  const pathData = subPaths.map((dStr, index) => {
    const endPt = extractMPoint(dStr);
    const pipeD = generatePipeD(endPt.x, endPt.y);
    const fullD = dStr + pipeD;

    const letterLength = new svgPathProperties(dStr).getTotalLength();
    const totalLength = new svgPathProperties(fullD).getTotalLength();

    return {
      fullD,
      letterLength,
      totalLength,
      duration: totalLength / 1600,
      delay: index * 0.03,
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
