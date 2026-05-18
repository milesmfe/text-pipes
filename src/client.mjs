export class TextPipes {
  #container;
  #group;
  #data;
  #state = "idle";
  #raf = 0;

  /**
   * @param {HTMLElement} container — element that will hold the SVG
   * @param {object}      data     — JSON returned by buildSVGData()
   */
  #onResize = () => this.#applyTransform();

  constructor(container, data) {
    this.#container = container;
    this.#data = data;
    this.#render();
    window.addEventListener("resize", this.#onResize);
  }

  drain() {
    cancelAnimationFrame(this.#raf);
    this.#enableTransitions();
    this.#setState("draining");
  }

  restore() {
    this.#enableTransitions();
    this.#setState("returning");
    this.#pollReturn();
  }

  /** Scrub animation to a normalised position (0 = idle, 1 = fully drained). */
  setProgress(t) {
    cancelAnimationFrame(this.#raf);
    const clamped = Math.max(0, Math.min(1, t));

    const strokes = this.#group.querySelectorAll(".tp-stroke");
    const fill = this.#group.querySelector(".tp-fill");
    if (fill) fill.style.opacity = String(1 - clamped);

    strokes.forEach((el) => {
      el.style.transition = "none";
      const drain = parseFloat(el.dataset.drainOffset);
      el.style.strokeDashoffset = String(drain * clamped);
    });
  }

  destroy() {
    cancelAnimationFrame(this.#raf);
    window.removeEventListener("resize", this.#onResize);
    this.#container.innerHTML = "";
  }

  // -- internals --

  #render() {
    const d = this.#data;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;overflow:visible;";

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    this.#group = g;
    this.#applyTransform();

    const fill = document.createElementNS("http://www.w3.org/2000/svg", "path");
    fill.setAttribute("d", d.fillD);
    fill.setAttribute("class", "tp-fill");
    fill.style.cssText =
      "fill:#111;stroke:#111;stroke-width:2px;stroke-linecap:round;stroke-linejoin:round;transition:opacity .4s ease;";
    g.appendChild(fill);

    for (const p of d.pathData) {
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      path.setAttribute("d", p.fullD);
      path.setAttribute("class", "tp-stroke");
      path.dataset.drainOffset = String(-p.totalLength);
      path.dataset.dur = p.duration.toFixed(4);
      path.dataset.del = p.delay.toFixed(4);
      path.style.cssText = `fill:none;stroke:#111;stroke-width:2px;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:${p.letterLength.toFixed(3)} ${(p.totalLength * 10).toFixed(3)};stroke-dashoffset:0;`;
      g.appendChild(path);
    }

    svg.appendChild(g);
    this.#container.style.position = "relative";
    this.#container.appendChild(svg);
  }

  #applyTransform() {
    const d = this.#data;
    const rect = this.#container.getBoundingClientRect();
    const tx = rect.width / 2 - d.textOffsetX;
    const ty = rect.height / 2 - d.textOffsetY;
    this.#group.setAttribute("transform", `translate(${tx},${ty})`);
  }

  #enableTransitions() {
    this.#group.querySelectorAll(".tp-stroke").forEach((el) => {
      el.style.transition = `stroke-dashoffset ${el.dataset.dur}s linear ${el.dataset.del}s`;
    });
  }

  #setState(state) {
    this.#state = state;
    const fill = this.#group.querySelector(".tp-fill");
    const strokes = this.#group.querySelectorAll(".tp-stroke");

    if (state === "draining") {
      if (fill) fill.style.opacity = "0";
      strokes.forEach((el) => {
        el.style.strokeDashoffset = el.dataset.drainOffset;
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

  #pollReturn() {
    const strokes = this.#group.querySelectorAll(".tp-stroke");
    const allHome = [...strokes].every(
      (el) =>
        Math.abs(parseFloat(getComputedStyle(el).strokeDashoffset) || 0) <= 5
    );
    if (allHome) {
      this.#setState("idle");
    } else {
      this.#raf = requestAnimationFrame(() => this.#pollReturn());
    }
  }
}
