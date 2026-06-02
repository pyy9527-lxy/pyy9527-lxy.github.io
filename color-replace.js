/**
 * Canvas 背景色替换 — 纯浏览器端，毫秒级
 */
const ColorReplace = {
  /**
   * 将抠图结果（透明 PNG Blob）与纯色背景合成
   * @param {Blob} fgBlob - 抠图结果 PNG（含透明通道）
   * @param {string} colorHex - 背景色，如 "#FF0000"
   * @returns {Promise<Blob>} 合成后的 PNG Blob
   */
  async apply(fgBlob, colorHex) {
    // 解析颜色
    const hex = colorHex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // 加载前景图
    const fgImg = await this._blobToImage(fgBlob);

    // 创建合成 canvas
    const canvas = document.createElement('canvas');
    canvas.width = fgImg.width;
    canvas.height = fgImg.height;
    const ctx = canvas.getContext('2d');

    // 先绘制纯色背景
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 再绘制前景（自动利用 alpha 通道）
    ctx.drawImage(fgImg, 0, 0);

    // 导出为 PNG
    return new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob), 'image/png');
    });
  },

  _blobToImage(blob) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(blob);
    });
  },
};
