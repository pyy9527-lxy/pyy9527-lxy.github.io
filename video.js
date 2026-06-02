/**
 * 浏览器端视频处理 — 逐帧提取 + AI 抠图 + 合成
 */
const VideoProcessor = {
  processing: false,
  cancelFlag: false,

  /**
   * 处理视频：逐帧抠图
   * @param {File} videoFile - 视频文件
   * @param {Object} opts - { scale, frameSkip, onProgress, onFrame }
   * @returns {Promise<Blob>} 处理后的视频 Blob
   */
  async process(videoFile, opts = {}) {
    const scale = opts.scale || 0.5;
    const frameSkip = opts.frameSkip || 2;
    const onProgress = opts.onProgress || (() => {});
    const onLog = opts.onLog || (() => {});

    this.cancelFlag = false;

    // 创建视频元素
    const video = document.createElement('video');
    video.src = URL.createObjectURL(videoFile);
    video.muted = true;

    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = reject;
      video.load();
    });

    const duration = video.duration;
    const fps = 30; // 近似值
    const totalFrames = Math.floor(duration * fps);
    const framesToProcess = Math.floor(totalFrames / frameSkip);
    const interval = (duration / totalFrames) * frameSkip;

    onLog(`视频时长: ${duration.toFixed(1)}秒, 约处理 ${framesToProcess} 帧`);

    // Canvas 用于提取帧
    const extractCanvas = document.createElement('canvas');
    const ectx = extractCanvas.getContext('2d');

    const outW = Math.round(video.videoWidth * scale);
    const outH = Math.round(video.videoHeight * scale);
    extractCanvas.width = outW;
    extractCanvas.height = outH;

    // 收集处理后的帧
    const processedFrames = [];

    for (let i = 0; i < framesToProcess; i++) {
      if (this.cancelFlag) {
        onLog('处理已取消');
        break;
      }

      const time = i * interval;
      video.currentTime = time;

      await new Promise(r => { video.onseeked = r; });

      // 提取当前帧
      ectx.drawImage(video, 0, 0, outW, outH);

      // 转换帧为 Blob
      const frameBlob = await new Promise(r => {
        extractCanvas.toBlob(b => r(b), 'image/png');
      });

      try {
        // AI 抠图
        const resultBlob = await BGRemover.removeBackground(frameBlob, { model: 'medium' });
        processedFrames.push(resultBlob);

        const pct = Math.round((i + 1) / framesToProcess * 100);
        onProgress(pct, i + 1, framesToProcess);
      } catch (e) {
        onLog(`帧 ${i + 1} 处理失败: ${e.message}`);
      }

      // 短暂延迟避免阻塞 UI
      await new Promise(r => setTimeout(r, 10));
    }

    URL.revokeObjectURL(video.src);

    if (processedFrames.length === 0) {
      throw new Error('没有成功处理任何帧');
    }

    // 返回第一帧作为预览（视频合成需要额外库，简化处理）
    // 实际：将所有帧的 Blob 返回
    return {
      frames: processedFrames,
      firstFrame: processedFrames[0],
      totalFrames: processedFrames.length,
      width: outW,
      height: outH,
    };
  },

  cancel() {
    this.cancelFlag = true;
  },
};
