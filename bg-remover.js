/**
 * 浏览器端 AI 抠图 — Transformers.js + RMBG-1.4 模型
 * 模型首次下载 ~170MB 到浏览器缓存，后续秒开
 */
const BGRemover = {
  _segmenter: null,
  _loading: false,

  /**
   * Load the segmentation pipeline (once)
   */
  async _load() {
    if (this._segmenter) return this._segmenter;
    if (this._loading) {
      // Wait for existing load
      for (let i = 0; i < 300; i++) {
        if (this._segmenter) return this._segmenter;
        await new Promise(r => setTimeout(r, 200));
      }
      throw new Error('Model loading timeout');
    }
    this._loading = true;
    try {
      if (!window.__bgPipeline) throw new Error('Transformers.js not loaded');
      this._segmenter = await window.__bgPipeline(
        'image-segmentation',
        'briaai/RMBG-1.4',
        { progress_callback: (info) => {
          if (info.status === 'downloading') {
            const pct = info.progress ? Math.round(info.progress) : 0;
            if (window.__onModelProgress) window.__onModelProgress(pct, info.file || '');
          }
        }}
      );
      return this._segmenter;
    } finally {
      this._loading = false;
    }
  },

  /**
   * Remove background from image.
   * @param {File|Blob|HTMLImageElement} input
   * @returns {Promise<Blob>} PNG with transparent background
   */
  async removeBackground(input) {
    const segmenter = await this._load();

    // Convert input to data URL if needed
    let imageUrl;
    if (input instanceof File || input instanceof Blob) {
      imageUrl = URL.createObjectURL(input);
    } else if (typeof input === 'string') {
      imageUrl = input;
    } else {
      // HTMLImageElement - draw to canvas to get data URL
      const c = document.createElement('canvas');
      c.width = input.naturalWidth || input.width;
      c.height = input.naturalHeight || input.height;
      c.getContext('2d').drawImage(input, 0, 0);
      imageUrl = c.toDataURL('image/png');
    }

    // Run segmentation (returns [{mask, label}])
    const result = await segmenter(imageUrl);
    if (!result || !result.length) throw new Error('Segmentation returned no results');

    // Get the foreground mask
    const maskData = result[0].mask;
    const originalImage = await this._loadImage(imageUrl);

    // Composite: original image with mask as alpha channel
    const canvas = document.createElement('canvas');
    canvas.width = originalImage.width;
    canvas.height = originalImage.height;
    const ctx = canvas.getContext('2d');

    // Draw original
    ctx.drawImage(originalImage, 0, 0);

    // Apply mask as alpha
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < maskData.data.length; i++) {
      imageData.data[i * 4 + 3] = Math.round(maskData.data[i] * 255);
    }
    ctx.putImageData(imageData, 0, 0);

    // Return as Blob
    return new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob), 'image/png');
    });
  },

  _loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  },
};
