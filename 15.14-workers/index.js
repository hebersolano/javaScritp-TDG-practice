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

class MandelbrotCanvas {
  /**
   *
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
    if (typeof f === "function") f(this.state);

    if (typeof f === "object") {
      for (let property in f) {
        this.state[property] = f[property];
      }
    }

    this.render();

    if (save) history.pushState(this.state, "", this.state.toURL());
  }

  render() {
    if (this.pendingRender) {
      this.wantsRender = true;
      return;
    }

    let { cx, cy, perPixel, maxIterations } = this.state;
    let x0 = cx - perPixel * (this.width / 2);
    let y0 = cy - perPixel * (this.height / 2);

    let promises = this.tiles.map((tile) =>
      this.workerPool.addWork({
        tile,
        x0: x0 + tile.x * perPixel,
        y0: y0 + tile.y * perPixel,
        perPixel,
        maxIterations,
      })
    );

    this.pendingRender = Promise.all(promises).then((res) => {
      
    });
  }
}
