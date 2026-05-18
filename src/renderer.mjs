export class TextPipes {
  #container;
  #group;
  #data;
  #options;
  #state = "idle";
  #raf = 0;

  #onResize = () => this.#applyTransform();

  constructor(container, data, options = {}) {
    this.#container = container;
    this.#data = data;
    this.#options = {
      color: "#111",
      fadeSpeedFactor: 10,
      drainSpeed: 1,
      restoreSpeed: 1,
      ...options
    };
    this.#render();
    window.addEventListener("resize", this.#onResize);
  }

  drain() {
    cancelAnimationFrame(this.#raf);
    this.#enableTransitions(this.#options.drainSpeed);
    this.#setState("draining");
  }

  restore() {
    this.#enableTransitions(this.#options.restoreSpeed);
    this.#setState("returning");
    this.#pollReturn();
  }

  setProgress(t) {
    cancelAnimationFrame(this.#raf);
    const clamped = Math.max(0, Math.min(1, t));

    const strokes = this.#group.querySelectorAll(".tp-stroke");
    const fill = this.#group.querySelector(".tp-fill");
    
    if (fill) fill.style.opacity = String(Math.max(0, 1 - (clamped * this.#options.fadeSpeedFactor)));
    
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

  #render() {
    const d = this.#data;
    const color = this.#options.color;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;overflow:visible;";

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    this.#group = g;
    this.#applyTransform();

    const fill = document.createElementNS("http://www.w3.org/2000/svg", "path");
    fill.setAttribute("d", d.fillD);
    fill.setAttribute("class", "tp-fill");
    fill.style.cssText = `fill:${color};stroke:${color};stroke-width:2px;stroke-linecap:round;stroke-linejoin:round;transition:opacity .4s ease;`;
    g.appendChild(fill);

    for (const p of d.pathData) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", p.fullD);
      path.setAttribute("class", "tp-stroke");
      path.dataset.drainOffset = String(-p.totalLength);
      path.dataset.dur = p.duration.toFixed(4);
      path.dataset.del = p.delay.toFixed(4);
      path.style.cssText = `fill:none;stroke:${color};stroke-width:2px;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:${p.letterLength.toFixed(3)} ${(p.totalLength * 10).toFixed(3)};stroke-dashoffset:0;`;
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

  #enableTransitions(speedFactor = 1) {
    const fill = this.#group.querySelector(".tp-fill");
    if (fill) {
      fill.style.transition = `opacity ${0.4 / speedFactor}s ease`;
    }

    this.#group.querySelectorAll(".tp-stroke").forEach((el) => {
      const dur = (parseFloat(el.dataset.dur) / speedFactor).toFixed(4);
      const del = (parseFloat(el.dataset.del) / speedFactor).toFixed(4);
      el.style.transition = `stroke-dashoffset ${dur}s linear ${del}s`;
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
