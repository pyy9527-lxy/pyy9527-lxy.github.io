/**
 * Fabric.js 画笔交互 — 保留/去除/撤销/清除
 */
const BrushCanvas = {
  canvas: null,
  brushMode: 'keep',
  brushSize: 10,
  canvasWidth: 600,
  canvasHeight: 400,

  init(canvasElId, imgUrl) {
    if (this.canvas) this.canvas.dispose();

    this.canvas = new fabric.Canvas(canvasElId, {
      isDrawingMode: true,
      backgroundColor: '#FFFFFF',
    });

    fabric.Image.fromURL(imgUrl, (img) => {
      const maxW = 580;
      const scale = Math.min(1, maxW / img.width);
      this.canvasWidth = Math.round(img.width * scale);
      this.canvasHeight = Math.round(img.height * scale);

      img.scale(scale);
      img.set({ selectable: false, evented: false });

      this.canvas.setDimensions({ width: this.canvasWidth, height: this.canvasHeight });
      this.canvas.add(img);
      this.canvas.renderAll();
    });

    this.canvas.freeDrawingBrush.width = this.brushSize;
    this.canvas.freeDrawingBrush.color = '#00FF00';
    this.canvas.freeDrawingBrush.limitedToCanvasSize = true;
  },

  setMode(mode) {
    this.brushMode = mode;
    this.canvas.isDrawingMode = true;
    this.canvas.freeDrawingBrush.color = mode === 'keep' ? '#00FF00' : '#FF0000';
  },

  setBrushSize(size) {
    this.brushSize = size;
    this.canvas.freeDrawingBrush.width = size;
  },

  undo() {
    const paths = this.canvas.getObjects().filter(o => o.type === 'path');
    if (paths.length > 0) {
      this.canvas.remove(paths[paths.length - 1]);
      this.canvas.renderAll();
      return true;
    }
    return false;
  },

  clearAll() {
    const objs = this.canvas.getObjects();
    objs.forEach(o => { if (o.type === 'path') this.canvas.remove(o); });
    this.canvas.renderAll();
  },

  /** 导出画笔蒙版 canvas */
  exportMaskCanvas() {
    const off = document.createElement('canvas');
    off.width = this.canvasWidth;
    off.height = this.canvasHeight;
    const ctx = off.getContext('2d');

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, off.width, off.height);

    const paths = this.canvas.getObjects().filter(o => o.type === 'path');
    paths.forEach(p => {
      ctx.strokeStyle = p.stroke;
      ctx.lineWidth = p.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      this._renderPath(ctx, p);
      ctx.stroke();
    });

    return off;
  },

  _renderPath(ctx, fp) {
    const path = fp.path;
    if (!path) return;
    for (const cmd of path) {
      switch (cmd[0]) {
        case 'M': ctx.moveTo(cmd[1], cmd[2]); break;
        case 'L': ctx.lineTo(cmd[1], cmd[2]); break;
        case 'C': ctx.bezierCurveTo(cmd[1], cmd[2], cmd[3], cmd[4], cmd[5], cmd[6]); break;
        case 'Q': ctx.quadraticCurveTo(cmd[1], cmd[2], cmd[3], cmd[4]); break;
      }
    }
  },

  destroy() {
    if (this.canvas) { this.canvas.dispose(); this.canvas = null; }
  },
};
