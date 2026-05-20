import type { SVGData, RendererOptions } from "./types.js";

const NS = "http://www.w3.org/2000/svg";

const DEFAULTS: Required<RendererOptions> = {
  color: "#111",
  strokeWidth: 2,
  fadeSpeedFactor: 10,
  drainSpeed: 1,
  restoreSpeed: 1,
  easing: "linear",
  align: "center",
};

const ASPECT_MAP = {
  left: "xMinYMid meet",
  center: "xMidYMid meet",
  right: "xMaxYMid meet",
} as const;

interface StrokeRef {
  el: SVGPathElement;
  drainOffset: number;
  duration: number;
  delay: number;
}

type State = "idle" | "draining" | "returning";

export class TextPipes {
  #container: HTMLElement;
  #svg: SVGSVGElement | null = null;
  #fill: SVGPathElement | null = null;
  #strokes: StrokeRef[] = [];
  #data: SVGData;
  #options: Required<RendererOptions>;
  #state: State = "idle";
  #pendingResolve: (() => void) | null = null;
  #pendingFinalState: State = "idle";
  #transitionHandler: ((e: TransitionEvent) => void) | null = null;
  #transitionTarget: SVGPathElement | null = null;

  get state(): State {
    return this.#state;
  }

  constructor(container: HTMLElement, data: SVGData, options: RendererOptions = {}) {
    this.#container = container;
    this.#data = data;
    this.#options = { ...DEFAULTS, ...options };
    this.#render();
  }

  drain(): Promise<void> {
    this.#clearPending();
    return new Promise<void>((resolve) => {
      this.#pendingFinalState = "draining";
      this.#enableTransitions(this.#options.drainSpeed);
      this.#listenForTransitionEnd(resolve);
      this.#setState("draining");
    });
  }

  restore(): Promise<void> {
    this.#clearPending();
    return new Promise<void>((resolve) => {
      this.#pendingFinalState = "idle";
      this.#enableTransitions(this.#options.restoreSpeed, true);
      this.#listenForTransitionEnd(resolve);
      this.#setState("returning");
    });
  }

  setProgress(t: number): void {
    this.#clearPending();
    const clamped = Math.max(0, Math.min(1, t));

    if (this.#fill) {
      this.#fill.style.opacity = String(Math.max(0, 1 - clamped * this.#options.fadeSpeedFactor));
    }

    for (const s of this.#strokes) {
      s.el.style.transition = "none";
      s.el.style.strokeDashoffset = String(s.drainOffset * clamped);
    }

    this.#state = clamped === 0 ? "idle" : "draining";
  }

  destroy(): void {
    this.#clearPending();
    if (this.#svg) {
      this.#svg.remove();
    }
    this.#svg = null;
    this.#fill = null;
    this.#strokes = [];
  }

  #render(): void {
    const d = this.#data;
    const { color, strokeWidth, align } = this.#options;
    const sw = `${strokeWidth}px`;

    const svg = document.createElementNS(NS, "svg");
    svg.style.cssText = "width:100%;height:100%;overflow:visible;display:block;";

    if (d.viewBox) {
      svg.setAttribute("viewBox", d.viewBox);
      svg.setAttribute("preserveAspectRatio", ASPECT_MAP[align]);
    } else {
      svg.style.position = "absolute";
      svg.style.top = "0";
      svg.style.left = "0";
      const tx = -d.textOffsetX;
      const ty = -d.textOffsetY;
      const w = d.totalWidth;
      const h = d.fontSize;
      svg.setAttribute("viewBox", `${tx} ${ty} ${w} ${h}`);
      svg.setAttribute("preserveAspectRatio", ASPECT_MAP[align]);
    }

    const fill = document.createElementNS(NS, "path");
    fill.setAttribute("d", d.fillD);
    fill.setAttribute("class", "tp-fill");
    fill.style.cssText = `fill:${color};stroke:${color};stroke-width:${sw};stroke-linecap:round;stroke-linejoin:round;transition:opacity .4s ease;`;
    svg.appendChild(fill);
    this.#fill = fill;

    this.#strokes = [];
    for (const p of d.pathData) {
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", p.fullD);
      path.setAttribute("class", "tp-stroke");
      path.style.cssText = `fill:none;stroke:${color};stroke-width:${sw};stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:${p.letterLength.toFixed(3)} ${(p.totalLength * 10).toFixed(3)};stroke-dashoffset:0;`;
      svg.appendChild(path);

      this.#strokes.push({
        el: path,
        drainOffset: -p.totalLength,
        duration: p.duration,
        delay: p.delay,
      });
    }

    this.#svg = svg;
    this.#container.appendChild(svg);
  }

  #enableTransitions(speedFactor = 1, forRestore = false): void {
    const { easing } = this.#options;

    if (this.#fill) {
      if (forRestore && this.#strokes.length > 0) {
        let maxDur = 0;
        for (const s of this.#strokes) {
          const total = (s.duration + s.delay) / speedFactor;
          if (total > maxDur) maxDur = total;
        }
        const fillDelay = (maxDur * 0.3).toFixed(4);
        const fillDur = (maxDur * 0.4).toFixed(4);
        this.#fill.style.transition = `opacity ${fillDur}s ease ${fillDelay}s`;
      } else {
        this.#fill.style.transition = `opacity ${0.4 / speedFactor}s ease`;
      }
    }

    for (const s of this.#strokes) {
      const dur = (s.duration / speedFactor).toFixed(4);
      const del = (s.delay / speedFactor).toFixed(4);
      s.el.style.transition = `stroke-dashoffset ${dur}s ${easing} ${del}s`;
    }
  }

  #setState(state: State): void {
    this.#state = state;

    if (state === "draining") {
      if (this.#fill) this.#fill.style.opacity = "0";
      for (const s of this.#strokes) {
        s.el.style.strokeDashoffset = String(s.drainOffset);
      }
    } else if (state === "returning") {
      if (this.#fill) this.#fill.style.opacity = "1";
      for (const s of this.#strokes) {
        s.el.style.strokeDashoffset = "0";
      }
    } else {
      if (this.#fill) {
        this.#fill.style.transition = "none";
        this.#fill.style.opacity = "1";
      }
      for (const s of this.#strokes) {
        s.el.style.transition = "none";
        s.el.style.strokeDashoffset = "0";
      }
    }
  }

  #listenForTransitionEnd(resolve: () => void): void {
    if (this.#strokes.length === 0) {
      this.#state = "idle";
      resolve();
      return;
    }

    let lastDur = 0;
    let lastStroke = this.#strokes[0];
    for (const s of this.#strokes) {
      const total = s.duration + s.delay;
      if (total >= lastDur) {
        lastDur = total;
        lastStroke = s;
      }
    }

    this.#pendingResolve = resolve;
    this.#transitionTarget = lastStroke.el;
    this.#transitionHandler = (e: TransitionEvent) => {
      if (e.propertyName !== "stroke-dashoffset") return;
      this.#finishTransition();
    };
    lastStroke.el.addEventListener("transitionend", this.#transitionHandler);
  }

  #finishTransition(): void {
    const resolve = this.#pendingResolve;
    const finalState = this.#pendingFinalState;
    this.#clearPending();
    if (finalState === "idle") {
      this.#setState("idle");
    } else {
      this.#state = finalState;
    }
    resolve?.();
  }

  #clearPending(): void {
    if (this.#transitionHandler && this.#transitionTarget) {
      this.#transitionTarget.removeEventListener("transitionend", this.#transitionHandler);
    }
    this.#transitionHandler = null;
    this.#transitionTarget = null;
    this.#pendingResolve = null;
  }
}

export type { SVGData, RendererOptions } from "./types.js";
