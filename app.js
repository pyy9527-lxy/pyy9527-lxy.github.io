/**
 * 主控制器 — 纯浏览器端抠图工具 (Transformers.js)
 */
const App = {
  currentType: 'image',
  currentMode: 'auto',
  currentColor: '#FFFFFF',
  file: null,
  fgBlob: null,       // cutout result Blob (transparent PNG)
  resultBlob: null,    // final composite Blob
  colorPicker: null,

  init() {
    this.initTabs();
    this.initModeSwitch();
    this.initUpload();
    this.initColorPicker();
    this.initActions();
    this.initBrushTools();
  },

  // ========== Tabs ==========
  initTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentType = tab.dataset.type;
        if (this.currentType === 'video') {
          Utils.hide('modeSwitch'); Utils.hide('manualTools');
          Utils.hide('previewContent'); Utils.hide('canvasContainer');
          Utils.el('uploadText').textContent = 'Drag video here or click to upload';
          Utils.el('uploadHint').textContent = 'MP4, AVI, MOV, WebM - Max 500MB (Best <30s)';
        } else {
          Utils.show('modeSwitch'); Utils.hide('videoPreviewContainer');
          Utils.hide('videoSettings'); Utils.hide('progressSection');
          Utils.el('uploadText').textContent = 'Drag image here or click to upload';
          Utils.el('uploadHint').textContent = 'JPG, PNG, WebP, BMP - Max 20MB';
        }
      });
    });
  },

  // ========== Mode ==========
  initModeSwitch() {
    Utils.el('modeAuto').addEventListener('click', () => this.switchMode('auto'));
    Utils.el('modeManual').addEventListener('click', () => this.switchMode('manual'));
  },
  switchMode(mode) {
    this.currentMode = mode;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    Utils.el(mode === 'auto' ? 'modeAuto' : 'modeManual').classList.add('active');
    if (mode === 'auto') {
      Utils.hide('manualTools'); Utils.hide('canvasContainer');
      if (this.file && this.currentType === 'image') {
        Utils.show('actionButtons'); Utils.el('btnRemoveBg').textContent = 'Remove Background';
        if (this.fgBlob) Utils.show('previewContent');
      }
    } else {
      if (!this.file || this.currentType !== 'image') {
        this.showError('Please upload an image first.');
        Utils.el('modeAuto').click(); return;
      }
      Utils.hide('actionButtons'); Utils.hide('previewContent');
      Utils.show('manualTools'); Utils.show('canvasContainer');
      this.initBrushCanvas();
    }
  },

  // ========== Upload ==========
  initUpload() {
    const zone = Utils.el('uploadZone');
    const input = Utils.el('fileInput');
    Utils.el('btnUpload').addEventListener('click', () => input.click());
    Utils.el('btnReupload').addEventListener('click', () => this.reset());
    input.addEventListener('change', e => { if (e.target.files[0]) this.handleFile(e.target.files[0]); });
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.classList.remove('dragover');
      if (e.dataTransfer.files[0]) this.handleFile(e.dataTransfer.files[0]);
    });
  },

  async handleFile(file) {
    this.file = file; this.fgBlob = null; this.resultBlob = null;
    Utils.el('fileName').textContent = file.name;
    Utils.hide('uploadZone'); Utils.flex('fileInfo');
    Utils.show('actionButtons');
    Utils.el('btnRemoveBg').textContent = this.currentType === 'video' ? 'Process Video' : 'Remove Background';
    Utils.el('btnDownload').disabled = true;
    if (Utils.isImage(file)) {
      const url = await Utils.readFile(file);
      Utils.el('previewOriginal').src = url;
      Utils.hide('previewEmpty'); Utils.show('previewContent');
      Utils.el('previewResult').src = '';
      Utils.hide('videoPreviewContainer');
    } else {
      Utils.hide('previewContent'); Utils.hide('previewEmpty');
      Utils.show('videoPreviewContainer');
      Utils.el('videoPreview').src = URL.createObjectURL(file);
      Utils.el('videoMeta').textContent = Utils.formatSize(file.size);
      Utils.show('videoSettings'); Utils.hide('modeSwitch');
    }
  },

  reset() {
    this.file = null; this.fgBlob = null; this.resultBlob = null;
    Utils.show('uploadZone'); Utils.hide('fileInfo'); Utils.hide('actionButtons');
    Utils.flex('previewEmpty'); Utils.hide('previewContent'); Utils.hide('videoPreviewContainer');
    Utils.hide('canvasContainer'); Utils.hide('manualTools');
    Utils.hide('videoSettings'); Utils.hide('progressSection'); Utils.hide('statusBox');
    Utils.el('fileInput').value = ''; Utils.el('btnDownload').disabled = true;
    BrushCanvas.destroy();
  },

  // ========== Color Picker ==========
  initColorPicker() {
    document.querySelectorAll('.color-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        this.currentColor = dot.dataset.color;
        Utils.el('colorValue').textContent = this.currentColor;
        if (this.fgBlob) this.doReplaceColor();
      });
    });
    this.colorPicker = Pickr.create({
      el: '#colorPickerContainer', theme: 'classic', default: '#FFFFFF',
      components: { preview: true, opacity: false, hue: true,
        interaction: { hex: true, input: true, save: true } },
    });
    this.colorPicker.on('save', color => {
      const hex = '#' + color.toHEXA()[0].substring(0, 6);
      this.currentColor = hex; Utils.el('colorValue').textContent = hex;
      document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
      if (this.fgBlob) this.doReplaceColor();
    });
  },

  // ========== Actions ==========
  initActions() {
    Utils.el('btnRemoveBg').addEventListener('click', () => this.doRemoveBg());
    Utils.el('btnDownload').addEventListener('click', () => this.doDownload());
  },

  // ========== AI Background Removal (browser) ==========
  async doRemoveBg() {
    if (!this.file) return this.showError('Please upload a file first.');
    if (this.currentType === 'video') return this.showError('Video processing coming soon.');
    const btn = Utils.el('btnRemoveBg'); btn.disabled = true;

    // Show model download progress
    window.__onModelProgress = (pct, file) => {
      this.showStatus(`Downloading AI model... ${pct}%`);
    };
    this.showStatus('Loading AI model (first time ~170MB download)...');

    try {
      const blob = await BGRemover.removeBackground(this.file);
      this.fgBlob = blob;
      const url = URL.createObjectURL(blob);
      Utils.el('previewResult').src = url;
      Utils.show('previewContent');
      this.hideStatus();
      Utils.hide('actionButtons');
      window.__onModelProgress = null;
      await this.doReplaceColor();
    } catch (e) {
      this.hideStatus(); window.__onModelProgress = null;
      this.showError('Failed: ' + (e.message || 'Unknown error'));
      btn.disabled = false;
    }
  },

  // ========== Color Replacement ==========
  async doReplaceColor() {
    if (!this.fgBlob) return;
    try {
      this.resultBlob = await ColorReplace.apply(this.fgBlob, this.currentColor);
      const url = URL.createObjectURL(this.resultBlob);
      Utils.el('previewResult').src = url;
      Utils.el('btnDownload').disabled = false;
    } catch (e) {
      this.showError('Color replace failed: ' + e.message);
    }
  },

  // ========== Download ==========
  doDownload() {
    if (!this.resultBlob && !this.fgBlob) return;
    Utils.downloadBlob(this.resultBlob || this.fgBlob, `cutout_${Date.now()}.png`);
  },

  // ========== Brush Tools ==========
  initBrushTools() {
    Utils.el('brushKeep').addEventListener('click', () => {
      Utils.el('brushKeep').classList.add('active'); Utils.el('brushRemove').classList.remove('active');
      BrushCanvas.setMode('keep');
    });
    Utils.el('brushRemove').addEventListener('click', () => {
      Utils.el('brushRemove').classList.add('active'); Utils.el('brushKeep').classList.remove('active');
      BrushCanvas.setMode('remove');
    });
    const sz = Utils.el('brushSize');
    sz.addEventListener('input', () => {
      Utils.el('brushSizeValue').textContent = sz.value + 'px';
      BrushCanvas.setBrushSize(parseInt(sz.value));
    });
    Utils.el('brushUndo').addEventListener('click', () => BrushCanvas.undo());
    Utils.el('brushClear').addEventListener('click', () => BrushCanvas.clearAll());
    Utils.el('btnManualApply').addEventListener('click', () => this.doManualRemove());
  },

  initBrushCanvas() {
    const img = Utils.el('previewOriginal');
    if (!img.src) return;
    BrushCanvas.init('brushCanvas', img.src);
  },

  async doManualRemove() {
    this.showStatus('Processing...');
    try {
      const blob = await BGRemover.removeBackground(this.file);
      this.fgBlob = blob;
      Utils.el('previewResult').src = URL.createObjectURL(blob);
      Utils.hide('canvasContainer'); Utils.show('previewContent');
      this.hideStatus(); Utils.hide('manualTools');
      await this.doReplaceColor();
    } catch (e) {
      this.hideStatus();
      this.showError('Manual removal failed: ' + e.message);
    }
  },

  // ========== UI Helpers ==========
  showStatus(msg) { Utils.el('statusText').textContent = msg; Utils.flex('statusBox'); },
  hideStatus() { Utils.hide('statusBox'); },
  showError(msg) {
    this.hideStatus();
    Utils.el('spinner').style.display = 'none';
    Utils.el('statusText').textContent = 'X ' + msg;
    Utils.el('statusText').style.color = '#F44336';
    Utils.flex('statusBox');
    setTimeout(() => {
      Utils.el('statusText').style.color = '';
      Utils.el('spinner').style.display = '';
      Utils.hide('statusBox');
    }, 5000);
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
