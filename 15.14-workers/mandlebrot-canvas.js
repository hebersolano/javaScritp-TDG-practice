class Tile {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  static *tiles(width, height, numRows, numCols) {
    let columnWidth = Math.ceil(width / numCols);
    let rowHeight = Math.ceil(height / numRows);

    for (let row = 0; row < numRows; row++) {
      let tileHeight = row < numRows - 1 ? rowHeight : height - rowHeight * (numRows - 1);

      for (let col = 0; col < numCols; col++) {
        let tileWidth = col < numCols - 1 ? columnWidth : width - columnWidth * (numCols - 1);

        yield new Tile(col * columnWidth, row * rowHeight, tileWidth, tileHeight);
      }
    }
  }
}

class WorkerPool {
  constructor(numWorkers, workerSource) {
    this.idleWorkers = [];
    this.workQueue = [];
    this.workerMap = new Map();

    for (let i = 0; i < numWorkers; i++) {
      let worker = new Worker(workerSource);

      worker.onmessage = (message) => {
        this._workerDone(worker, null, message.data);
      };

      worker.onerror = (error) => {
        this._workerDone(worker, error, null);
      };

      this.idleWorkers[i] = worker;
    }
  }

  _workerDone(worker, error, response) {
    let [resolver, rejector] = this.workerMap.get(worker);
    this.workerMap.delete(worker);

    // if there no queued work, put this worker in idle worker
    if (this.workQueue.length === 0) {
      this.idleWorkers.push(worker);
    } else {
      let [work, resolver, rejector] = this.workQueue.shift();
      this.workerMap.set(worker, [resolver, rejector]);
      worker.postMessage(work);
    }

    error === null ? resolver(response) : rejector(error);
  }

  addWork(work) {
    return new Promise((resolve, reject) => {
      if (this.idleWorkers.length > 0) {
        let worker = this.idleWorkers.pop();
        this.workerMap.set(worker, [resolve, reject]);
        worker.postMessage(work);
      } else {
        this.workQueue.push([work, resolve, reject]);
      }
    });
  }
}

class PageState {
  static initialState() {
    let s = new PageState();
    s.cx = -0.5;
    s.cy = 0;
    s.perPixel = 3 / window.innerHeight;
    s.maxIterations = 500;
    return s;
  }

  static fromURL(url) {
    let s = new PageState();
    let params = new URLSearchParams(url);
    s.cx = parseInt(params.get("cx"));
    s.cy = parseInt(params.get("cy"));
    s.perPixel = parseInt(params.get("pp"));
    s.maxIterations = parseInt(params.get("it"));

    if (isNaN(s.cx) || isNaN(s.cy) || isNaN(s.perPixel) || isNaN(maxIterations)) return null;

    return s;
  }

  toURL() {
    let u = new URL(window.location);
    u.searchParams.set("cx", this.cx);
    u.searchParams.set("cy", this.cy);
    u.searchParams.set("pp", this.perPixel);
    u.searchParams.set("it", this.maxIterations);

    return u.href;
  }
}

const ROWS = 3;
const COLS = 4;
const NUMWORKERS = navigator.hardwareConcurrency || 2;

export class MandelbrotCanvas {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.workerPool = new WorkerPool(NUMWORKERS, "worker-mandelbrot.js");

    this.tiles = null;
    this.pendingRender = null;
    this.wantsRender = false;
    this.resizeTimer = null;
    this.colorTable = null;

    // event handlers
    this.canvas.addEventListener("pointerdown", (e) => this.handlePointer(e));
    window.addEventListener("keydown", (e) => this.handleKey(e));
    window.addEventListener("resize", (e) => this.handleResize(e));
    window.addEventListener("popstate", (e) => this.setState(e.state, false));

    // init state
    this.state = PageState.fromURL(window.location) || PageState.initialState();

    // save state in the history
    history.replaceState(this.state, "", this.state.toURL());

    // set canvas size and get an array of tiles that cover it
    this.setSize();

    // render into de canvas
    this.render();
  }

  setSize() {
    this.width = this.canvas.width = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
    this.tiles = [...Tile.tiles(this.width, this.height, ROWS, COLS)];
  }

  setState(f, save = true) {
    if (typeof f === "function") {
      f(this.state);
    } else if (typeof f === "object") {
      for (let property in f) {
        this.state[property] = f[property];
      }
    }

    this.render();

    if (save) history.pushState(this.state, "", this.state.toURL());
  }

  render() {
    console.log(this.pendingRender);
    if (this.pendingRender) {
      this.wantsRender = true;
      return;
    }

    console.log("rendering");
    let { cx, cy, perPixel, maxIterations } = this.state;
    let x0 = cx - (perPixel * this.width) / 2;
    let y0 = cy - (perPixel * this.height) / 2;

    let promises = this.tiles.map((tile) =>
      this.workerPool.addWork({
        tile,
        x0: x0 + tile.x * perPixel,
        y0: y0 + tile.y * perPixel,
        perPixel,
        maxIterations,
      })
    );

    this.pendingRender = Promise.all(promises)
      .then((response) => {
        // overall max and min iterations over all tiles to assign colors
        let min = maxIterations;
        let max = 0;

        for (let r of response) {
          if (r.min < min) min = r.min;
          if (r.max > max) max = r.max;
        }

        /* Convert the raw iterations count from workers into pixel colors */

        //allocate a color table, or reallocate if it no longer the right size
        if (!this.colorTable || this.colorTable.length !== maxIterations + 1) {
          this.colorTable = new Uint32Array(maxIterations + 1);
        }

        // Pixels in the set will be colored fully opaque black. Pixels outside the set will be translucent black with higher iteration counts resulting in higher opacity. Pixels with minimum iteration counts will show through, resulting in a grayscale image.
        if (min === max) {
          if (min === maxIterations) this.colorTable[min] = 0xff000000;
          this.colorTable[min] = 0;
        } else {
          // use a logarithmic scale to assign each possible iteration count an opacity between 0 and 255, and then use the shift left operator to turn that into a pixel value
          let maxlog = Math.log(1 + max - min);
          for (let i = min; i <= max; i++) {
            const opacity = Math.ceil((Math.log(1 + i - min) / maxlog) * 255);
            const pixelValue = opacity << 24;
            this.colorTable[i] = pixelValue;
          }
        }

        // translate the iteration numbers in each response's ImageData to colors from the color table
        for (const r of response) {
          let iterations = new Uint32Array(r.imageData.data.buffer);
          for (let i = 0; i < iterations.length; i++) {
            iterations[i] = this.colorTable[iterations[i]];
          }
        }

        // render all the imageData  objects into their corresponding tiles of the canvas using putImageData(). (first remove any CSS transform on the canvas that may have been set by the pointerdown event handler)
        this.canvas.style.transform = "";
        for (let r of response) {
          this.context.putImageData(r.imageData, r.tile.x, r.tile.y);
        }
      })
      .catch((error) => console.error("worker error", error))
      .finally(() => {
        this.pendingRender = null;
        //if render requests came in while we were busy, render now
        if (this.wantsRender) {
          this.wantsRender = false;
          this.render();
        }
      });

    // render() end
  }

  // if the user resizes the window
  handleResize(event) {
    console.log("resize handler");
    // if we already deferring a resize, clear it
    if (this.resizeTimer) clearTimeout(this.resizeTimer);

    // and defer this resize instead
    this.resizeTimer = setTimeout(() => {
      this.resizeTimer = null;
      this.setSize();
      this.render();
    }, 200);
  }

  /**
   * @param {KeyboardEvent} event
   */
  handleKey(event) {
    console.log("key handler", event.key);
    switch (event.key) {
      case "Escape": // go back to the init state
        this.setState(PageState.initialState);
        break;
      case "+": // to increase the number of iterations
        this.setState((s) => {
          s.maxIterations = Math.round(s.maxIterations * 1.5);
        });
        break;
      case "-": // to increase the number of iterations
        this.setState((s) => {
          s.maxIterations = Math.round(s.maxIterations / 1.5);
          if (s.maxIterations < 1) s.maxIterations = 1;
        });
        break;
      case "o": // to zoom out
        this.setState((s) => (s.perPixel *= 2));
        break;
      case "ArrowUp": // to scroll up
        this.setState((s) => (s.cy -= (this.height / 10) * s.perPixel));
        break;
      case "ArrowDown": // to scroll down
        this.setState((s) => (s.cy += (this.height / 10) * s.perPixel));
        break;
      case "ArrowLeft": // to scroll left
        this.setState((s) => (s.cx -= (this.width / 10) * s.perPixel));
        break;
      case "ArrowRight": // to scroll right
        this.setState((s) => (s.cx += (this.width / 10) * s.perPixel));
        break;
    }
  }

  /**
   * is called then we get a pinterdown event on the canvas. The pointerdown event might be the start of a zoom gesture (a click or tab) or a pan gesture (a drag). This handler registers handlers for the pointermove and pointerup in order to response to the rest of the gestures.
   * @param {PointerEvent} event
   */
  handlePointer(event) {
    console.log("pinter handler");

    const x0 = event.clientX;
    const y0 = event.clientY;
    const t0 = Date.now();

    // this is the handler for move events
    const pointerMoveHandler = (event) => {
      console.log("pinter move handler");
      let dx = event.clientX - x0;
      let dy = event.clientY - y0;
      let dt = Date.now() - t0;

      // if the pointer has moved enough or enough time has passed that this is not a regular click, then use CSS to pan the display. (we will rerender it for real when we get the pointer up event )
      if (dx > 10 || dy > 10 || dt > 500) {
        this.canvas.style.transform = `translate(${dx}px, ${dy}px)`;
      }
    };

    const pointerUpHandler = (event) => {
      console.log("pointer up handler");
      // the pinter is up, the gesture is over, so remove the move and up handlers until the next gesture
      this.canvas.removeEventListener("pointermove", pointerMoveHandler);
      this.canvas.removeEventListener("pointerup", pointerUpHandler);

      let dx = event.clientX - x0;
      let dy = event.clientY - y0;
      let dt = Date.now() - t0;

      const { cx, cy, perPixel } = this.state;

      if (dx > 10 || dy > 10 || dt > 500) {
        // the user panned the image by (dx, dy) pixels. Convert those values to offsets in the complex plane
        this.setState({ cx: cx - dx * perPixel, cy: cy - dy * perPixel });
      } else {
        // the user clicked. Compute how many pixels the center moves
        let cdx = x0 - this.width / 2;
        let cdy = y0 - this.height / 2;

        // use CSS to quickly and temporarily zoom  in
        this.canvas.style.transform = `translate(${-cdx * 2}px, ${-cdy * 2}px, scale(2))`;

        // set  the complex coordinates of the new center point and zoom in by a factor of 2
        this.setState((s) => {
          s.cx += cdx * s.perPixel;
          s.cy += cdy * s.perPixel;
          s.perPixel /= 2;
        });
      }
    };

    // when the user begin a gesture we register handlers for the pointermove and pointerup events
    this.canvas.addEventListener("pointermove", pointerMoveHandler);
    this.canvas.addEventListener("pointerup", pointerUpHandler);
  }
}
