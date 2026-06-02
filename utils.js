/**
 * 工具函数
 */
const Utils = {
  /** 显示/隐藏元素 */
  show(id) { document.getElementById(id).style.display = ''; },
  hide(id) { document.getElementById(id).style.display = 'none'; },
  flex(id) { document.getElementById(id).style.display = 'flex'; },
  el(id) { return document.getElementById(id); },

  /** 获取文件扩展名 */
  getExt(name) {
    const m = name.match(/\.(\w+)$/);
    return m ? m[1].toLowerCase() : '';
  },

  /** 判断是否为图片 */
  isImage(file) {
    return file.type.startsWith('image/');
  },

  /** 判断是否为视频 */
  isVideo(file) {
    return file.type.startsWith('video/');
  },

  /** 格式化文件大小 */
  formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  },

  /** 读取文件为 Data URL */
  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  /** 下载 Blob/URL */
  download(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },

  /** 下载 Blob */
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    this.download(url, filename);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },
};
