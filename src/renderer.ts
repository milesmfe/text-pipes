import type { SVGData, RendererOptions } from "./types.js";

const NS = "http://www.w3.org/2000/svg";

const DEFAULTS: Required<RendererOptions> = {
  color: "#111",
  strokeWidth: 2,
  fadeSpeedFactor: 10,
  drainSpeed: 1,
  restoreSpeed: 1,
  easing: "linear",
};

type State = "idle" | "draining" | "returning";

export class TextPipes {
  #container: HTMLElement;
  #group: SVGGElement | null = null;
  #data: SVGData;
  #options: Required<RendererOptions>;
  #state: State = "idle";
  #resizeObserver: ResizeObserver | null = null;
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
    this.#resizeObserver = new ResizeObserver(() => this.#applyTransform());
    this.#resizeObserver.observe(container);
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
      this.#enableTransitions(this.#options.restoreSpeed);
      this.#listenForTransitionEnd(resolve);
      this.#setState("returning");
    });
  }

  setProgress(t: number): void {
    this.#clearPending();
    const clamped = Math.max(0, Math.min(1, t));

    const strokes = this.#group!.querySelectorAll<SVGPathElement>(".tp-stroke");
    const fill = this.#group!.querySelector<SVGPathElement>(".tp-fill");

    if (fill) fill.style.opacity = String(Math.max(0, 1 - clamped * this.#options.fadeSpeedFactor));

    strokes.forEach((el) => {
      el.style.transition = "none";
      const drain = parseFloat(el.dataset.drainOffset!);
      el.style.strokeDashoffset = String(drain * clamped);
    });

    this.#state = clamped === 0 ? "idle" : "draining";
  }

  destroy(): void {
    this.#clearPending();
    this.#resizeObserver?.disconnect();
    this.#container.innerHTML = "";

    this.#resizeObserver = null;
    this.#group = null;
  }

  #render(): void {
    const d = this.#data;
    const { color, strokeWidth } = this.#options;
    const sw = `${strokeWidth}px`;

    const svg = document.createElementNS(NS, "svg");
    svg.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;overflow:visible;";

    const g = document.createElementNS(NS, "g") as SVGGElement;
    this.#group = g;
    this.#applyTransform();

    const fill = document.createElementNS(NS, "path");
    fill.setAttribute("d", d.fillD);
    fill.setAttribute("class", "tp-fill");
    fill.style.cssText = `fill:${color};stroke:${color};stroke-width:${sw};stroke-linecap:round;stroke-linejoin:round;transition:opacity .4s ease;`;
    g.appendChild(fill);

    for (const p of d.pathData) {
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", p.fullD);
      path.setAttribute("class", "tp-stroke");
      path.dataset.drainOffset = String(-p.totalLength);
      path.dataset.dur = p.duration.toFixed(4);
      path.dataset.del = p.delay.toFixed(4);
      path.style.cssText = `fill:none;stroke:${color};stroke-width:${sw};stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:${p.letterLength.toFixed(3)} ${(p.totalLength * 10).toFixed(3)};stroke-dashoffset:0;`;
      g.appendChild(path);
    }

    svg.appendChild(g);
    this.#container.style.position = "relative";
    this.#container.appendChild(svg);
  }

  #applyTransform(): void {
    if (!this.#group) return;
    const d = this.#data;
    const rect = this.#container.getBoundingClientRect();
    const tx = rect.width / 2 - d.textOffsetX;
    const ty = rect.height / 2 - d.textOffsetY;
    this.#group.setAttribute("transform", `translate(${tx},${ty})`);
  }

  #enableTransitions(speedFactor = 1): void {
    const { easing } = this.#options;
    const fill = this.#group!.querySelector<SVGPathElement>(".tp-fill");
    if (fill) {
      fill.style.transition = `opacity ${0.4 / speedFactor}s ease`;
    }

    this.#group!.querySelectorAll<SVGPathElement>(".tp-stroke").forEach((el) => {
      const dur = (parseFloat(el.dataset.dur!) / speedFactor).toFixed(4);
      const del = (parseFloat(el.dataset.del!) / speedFactor).toFixed(4);
      el.style.transition = `stroke-dashoffset ${dur}s ${easing} ${del}s`;
    });
  }

  #setState(state: State): void {
    this.#state = state;
    const fill = this.#group!.querySelector<SVGPathElement>(".tp-fill");
    const strokes = this.#group!.querySelectorAll<SVGPathElement>(".tp-stroke");

    if (state === "draining") {
      if (fill) fill.style.opacity = "0";
      strokes.forEach((el) => {
        el.style.strokeDashoffset = el.dataset.drainOffset!;
      });
    } else if (state === "returning") {
      if (fill) fill.style.opacity = "0";
      strokes.forEach((el) => {
        el.style.strokeDashoffset = "0";
      });
    } else {
      if (fill) fill.style.opacity = "1";
      strokes.forEach((el) => {
        el.style.transition = "none";
        el.style.strokeDashoffset = "0";
      });
    }
  }

  #listenForTransitionEnd(resolve: () => void): void {
    const strokes = this.#group!.querySelectorAll<SVGPathElement>(".tp-stroke");
    if (strokes.length === 0) {
      this.#state = "idle";
      resolve();
      return;
    }

    let lastDur = 0;
    let lastStroke: SVGPathElement = strokes[0];
    strokes.forEach((el) => {
      const total = parseFloat(el.dataset.dur!) + parseFloat(el.dataset.del!);
      if (total >= lastDur) {
        lastDur = total;
        lastStroke = el;
      }
    });

    this.#pendingResolve = resolve;
    this.#transitionTarget = lastStroke;
    this.#transitionHandler = (e: TransitionEvent) => {
      if (e.propertyName !== "stroke-dashoffset") return;
      this.#finishTransition();
    };
    lastStroke.addEventListener("transitionend", this.#transitionHandler);
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
