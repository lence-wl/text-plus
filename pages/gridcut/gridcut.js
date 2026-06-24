/**
 * 九宫格切字 — 一字九图
 * Canvas 2D 渲染单字 + 3×3 九宫格，支持导出 9 张图片到相册
 */

const { checkTextSecurity } = require("../../utils/security.js");

const STORAGE_KEY = 'gridcut_config';

const DEFAULT_CONFIG = {
  text: '永',
  multiMode: false,        // false=单字, true=多字
  bgColor: '#1a1a2e',
  textColor: '#ffffff',
  gridColor: 'rgba(255,255,255,0.5)',
  gridWidth: 2,
  fontWeight: 'bold',
  fontSize: 70,
  glowEnabled: false,
  glowColor: '#ff66ff',
  glowBlur: 15,
  gridRows: 3,
  gridCols: 3
};

const MAX_TOTAL_SIZE = 4096;  // Canvas 最大安全边长

Page({
  data: {
    showSettings: false,
    isExporting: false,
    exportProgress: 0,
    exportTotal: 0,
    canvasWidth: 0,
    canvasHeight: 0,
    config: { ...DEFAULT_CONFIG }
  },

  // Canvas 2D 实例
  _previewCanvas: null,
  _previewCtx: null,
  _pixelRatio: 1,

  // 双击检测
  _lastTapTime: 0,
  _tapTimer: null,

  // ========== 生命周期 ==========

  onLoad: function () {
    try {
      const saved = wx.getStorageSync(STORAGE_KEY);
      if (saved && typeof saved === 'object') {
        this.setData({ config: { ...DEFAULT_CONFIG, ...saved } });
      }
    } catch (e) {
      // ignore
    }
  },

  _calcCanvasSize: function (rows, cols) {
    rows = rows || this.data.config.gridRows || 3;
    cols = cols || this.data.config.gridCols || 3;
    var sysInfo = wx.getSystemInfoSync();
    var maxW = sysInfo.screenWidth * 0.92;
    var maxH = sysInfo.windowHeight * 0.55;
    var ratio = rows / cols;
    var cw = maxW;
    var ch = cw * ratio;
    if (ch > maxH) { ch = maxH; cw = ch / ratio; }
    return { w: Math.round(cw), h: Math.round(ch) };
  },

  onShow: function () {
    getApp().showInterstitial();
  },

  onReady: function () {
    var sysInfo = wx.getSystemInfoSync();
    this._pixelRatio = sysInfo.pixelRatio || 2;
    var size = this._calcCanvasSize();
    this.setData({ canvasWidth: size.w, canvasHeight: size.h });
    setTimeout(() => { this._initPreviewCanvas(); }, 200);
  },

  onUnload: function () {
    try { wx.setStorageSync(STORAGE_KEY, this.data.config); } catch (e) { /* ignore */ }
  },

  // ========== 导航 ==========

  onBack: function () {
    wx.navigateBack();
  },

  // ========== 初始化预览 Canvas ==========

  _initPreviewCanvas: function () {
    const query = wx.createSelectorQuery();
    query.select('#previewCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) {
        wx.showToast({ title: 'Canvas 初始化失败', icon: 'none' });
        return;
      }
      const canvas = res[0].node;
      const dpr = this._pixelRatio;
      var cw = this.data.canvasWidth;
      var ch = this.data.canvasHeight;
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
      var ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      this._previewCanvas = canvas;
      this._previewCtx = ctx;
      this._drawPreview();
    });
  },

  // ========== 通用绘制 ==========

  _drawOnCtx: function (ctx, w, h, lineScale, noGrid) {
    var config = this.data.config;
    var scale = lineScale || 1;
    // 清除
    ctx.clearRect(0, 0, w, h);
    // 背景
    ctx.fillStyle = config.bgColor;
    ctx.fillRect(0, 0, w, h);
    // 网格线（导出时可跳过）
    if (!noGrid) {
    var gw = config.gridWidth != null ? config.gridWidth : 2;
    if (gw > 0) {
      var rows = config.gridRows || 3;
      var cols = config.gridCols || 3;
      var cw = w / cols;
      var ch = h / rows;
      ctx.strokeStyle = config.gridColor;
      ctx.lineWidth = gw * scale;
      ctx.lineCap = 'round';
      for (var c = 1; c < cols; c++) {
        ctx.beginPath();
        ctx.moveTo(c * cw, 0); ctx.lineTo(c * cw, h); ctx.stroke();
      }
      for (var r = 1; r < rows; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * ch); ctx.lineTo(w, r * ch); ctx.stroke();
      }
    }
    }
    // 文字
    if (config.multiMode) {
      // 多字模式：每个格子居中一个字
      var rows = config.gridRows || 3;
      var cols = config.gridCols || 3;
      var cw = w / cols;
      var ch = h / rows;
      var chars = (config.text || '').split('');
      var cellFontSize = Math.min(cw, ch) * 0.6;
      ctx.fillStyle = config.textColor;
      if (config.glowEnabled) {
        ctx.shadowColor = config.glowColor || '#ff66ff';
        ctx.shadowBlur = (config.glowBlur || 15) * scale;
      }
      ctx.font = (config.fontWeight || 'bold') + ' ' + cellFontSize + 'px "楷体", "STKaiti", "KaiTi", "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (var i = 0; i < chars.length && i < rows * cols; i++) {
        var ri = Math.floor(i / cols);
        var ci = i % cols;
        ctx.fillText(chars[i], ci * cw + cw / 2, ri * ch + ch / 2);
      }
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    } else {
      // 单字模式：大字居中
      var fontSizePct = (config.fontSize || 70) / 100;
      var fontSize = w * fontSizePct;
      ctx.fillStyle = config.textColor;
      if (config.glowEnabled) {
        ctx.shadowColor = config.glowColor || '#ff66ff';
        ctx.shadowBlur = (config.glowBlur || 15) * scale;
      }
      ctx.font = (config.fontWeight || 'bold') + ' ' + fontSize + 'px "楷体", "STKaiti", "KaiTi", "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(config.text, w / 2, h / 2);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }
  },

  _drawPreview: function () {
    if (!this._previewCtx) return;
    this._drawOnCtx(this._previewCtx, this.data.canvasWidth, this.data.canvasHeight, 1, false);
  },

  // ========== 触摸事件（双击切换设置面板） ==========

  touchEvent: function (e) {
    if (e.type === 'touchstart') {
      if (this._tapTimer) {
        clearTimeout(this._tapTimer);
        this._tapTimer = null;
      }
      var now = Date.now();
      if (now - this._lastTapTime < 300) {
        this._lastTapTime = 0;
        this.toggleSettings();
      } else {
        var self = this;
        this._tapTimer = setTimeout(function () {
          if (self.data.showSettings) self.closeSettings();
          self._tapTimer = null;
        }, 300);
      }
      this._lastTapTime = now;
    }
    if (e.type === 'touchend' || e.type === 'touchcancel') {
      if (this._tapTimer) {
        clearTimeout(this._tapTimer);
        this._tapTimer = null;
        if (this.data.showSettings) this.closeSettings();
      }
    }
  },

  // ========== 设置面板 ==========

  toggleSettings: function () {
    this.setData({ showSettings: !this.data.showSettings });
  },

  closeSettings: function () {
    this.setData({ showSettings: false });
    try { wx.setStorageSync(STORAGE_KEY, this.data.config); } catch (e) { /* ignore */ }
  },

  // ========== 文字输入 ==========

  onTextBlur: async function (e) {
    var text = e.detail.value;
    if (!text || !text.trim()) return;
    text = text.trim();
    // 安全审核
    try {
      var isSafe = await checkTextSecurity(text);
      if (!isSafe) {
        wx.showToast({ title: '内容包含敏感信息', icon: 'none', duration: 2000 });
        return;
      }
    } catch (err) { /* ignore */ }
    // 按模式截取
    if (this.data.config.multiMode) {
      var maxLen = (this.data.config.gridRows || 3) * (this.data.config.gridCols || 3);
      text = text.substring(0, maxLen);
    } else {
      text = text.charAt(0);
    }
    this.setData({ 'config.text': text }, () => this._drawPreview());
  },

  // ========== 颜色变更 ==========

  onBgColorChange: function (e) {
    var color = e.detail.colorList[0];
    this.setData({ 'config.bgColor': color }, () => this._drawPreview());
  },

  onTextColorChange: function (e) {
    var color = e.detail.colorList[0];
    this.setData({ 'config.textColor': color }, () => this._drawPreview());
  },

  onGridColorChange: function (e) {
    var color = e.detail.colorList[0];
    this.setData({ 'config.gridColor': color }, () => this._drawPreview());
  },

  // ========== 单字/多字切换 ==========

  onMultiModeToggle: function () {
    var newMode = !this.data.config.multiMode;
    var text = this.data.config.text || '';
    if (!newMode) {
      // 切到单字：只保留第一个字
      text = text.charAt(0);
    }
    // 切到多字：保留全部文字，不做截断
    this.setData({ 'config.multiMode': newMode, 'config.text': text }, () => this._drawPreview());
  },

  // ========== 宫格模式 ==========

  onGridMode: function (e) {
    var rows = e.currentTarget.dataset.rows;
    var cols = e.currentTarget.dataset.cols;
    var size = this._calcCanvasSize(rows, cols);
    this.setData({
      'config.gridRows': rows,
      'config.gridCols': cols,
      canvasWidth: size.w,
      canvasHeight: size.h
    }, () => {
      this._initPreviewCanvas();
    });
  },

  // ========== 网格线宽 ==========

  onGridWidthChange: function (e) {
    this.setData({ 'config.gridWidth': e.detail }, () => this._drawPreview());
  },

  // ========== 字重切换 ==========

  onFontWeightChange: function (e) {
    var weight = e.detail ? 'bold' : 'normal';
    this.setData({ 'config.fontWeight': weight }, () => this._drawPreview());
  },

  // ========== 字号 ==========

  onFontSizeChange: function (e) {
    this.setData({ 'config.fontSize': e.detail }, () => this._drawPreview());
  },

  // ========== 发光 ==========

  onGlowEnabledChange: function (e) {
    this.setData({ 'config.glowEnabled': e.detail }, () => this._drawPreview());
  },

  onGlowColorChange: function (e) {
    var color = e.detail.colorList[0];
    this.setData({ 'config.glowColor': color }, () => this._drawPreview());
  },

  onGlowBlurChange: function (e) {
    this.setData({ 'config.glowBlur': e.detail }, () => this._drawPreview());
  },

  // ========== 导出 ==========

  onExport: function () {
    if (this.data.isExporting) return;
    var self = this;
    var rows = this.data.config.gridRows || 3;
    var cols = this.data.config.gridCols || 3;
    var total = rows * cols;
    this.setData({ isExporting: true, exportProgress: 0, exportTotal: total });

    var cellSize = Math.floor(MAX_TOTAL_SIZE / Math.max(rows, cols));
    var exportW = cellSize * cols;
    var exportH = cellSize * rows;
    var lineScale = exportW / this.data.canvasWidth;

    var offCanvas = wx.createOffscreenCanvas({ type: '2d', width: exportW, height: exportH });
    var ctx = offCanvas.getContext('2d');
    this._drawOnCtx(ctx, exportW, exportH, lineScale, true);

    this._exportCellsFromOffscreen(offCanvas, cellSize, rows, cols);
  },

  _exportCellsFromOffscreen: async function (bigCanvas, cellSize, rows, cols) {
    var self = this;
    var fs = wx.getFileSystemManager();
    try {
      for (var row = 0; row < rows; row++) {
        for (var col = 0; col < cols; col++) {
          var index = row * cols + col;
          // 从大画布拷贝格子
          var cellCanvas = wx.createOffscreenCanvas({ type: '2d', width: cellSize, height: cellSize });
          var cellCtx = cellCanvas.getContext('2d');
          cellCtx.drawImage(
            bigCanvas,
            col * cellSize, row * cellSize, cellSize, cellSize,
            0, 0, cellSize, cellSize
          );
          // 导出为 base64 → 写临时文件 → 保存
          var dataUrl = cellCanvas.toDataURL('image/jpeg', 0.95);
          var base64 = dataUrl.split(',')[1];
          var tempPath = wx.env.USER_DATA_PATH + '/gridcut_' + index + '.jpg';
          fs.writeFileSync(tempPath, base64, 'base64');

          await new Promise(function (resolve, reject) {
            wx.saveImageToPhotosAlbum({
              filePath: tempPath,
              success: resolve,
              fail: function (err) {
                if (err && err.errMsg && err.errMsg.indexOf('auth deny') !== -1) {
                  wx.showModal({
                    title: '需要授权',
                    content: '请允许保存图片到相册',
                    confirmText: '去设置',
                    success: function (r) { if (r.confirm) wx.openSetting(); }
                  });
                }
                reject(err);
              }
            });
          });

          self.setData({ exportProgress: index + 1 });
        }
      }
      wx.showToast({ title: '已保存' + (rows * cols) + '张图到相册', icon: 'success' });
    } catch (err) {
      console.error('[gridcut] export error:', err);
      if (!err || !err.errMsg || err.errMsg.indexOf('auth deny') === -1) {
        wx.showToast({ title: '导出失败，请重试', icon: 'none' });
      }
    } finally {
      self.setData({ isExporting: false, exportProgress: 0 });
    }
  }
});
