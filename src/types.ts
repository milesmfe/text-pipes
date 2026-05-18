export interface PathDatum {
  fullD: string;
  letterLength: number;
  totalLength: number;
  duration: number;
  delay: number;
}

export interface SVGData {
  fillD: string;
  pathData: PathDatum[];
  totalWidth: number;
  fontSize: number;
  textOffsetX: number;
  textOffsetY: number;
}

export interface GeneratorOptions {
  rng?: () => number;
  pipeMinLength?: number;
  pipeMaxLength?: number;
  pipeExtension?: number;
  speed?: number;
  stagger?: number;
}

export interface RendererOptions {
  color?: string;
  strokeWidth?: number;
  fadeSpeedFactor?: number;
  drainSpeed?: number;
  restoreSpeed?: number;
  easing?: string;
}
