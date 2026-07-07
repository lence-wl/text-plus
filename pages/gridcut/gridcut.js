/**
 * 九宫格切字 — 一字九图
 * Canvas 2D 渲染单字 + 3×3 九宫格，支持导出 9 张图片到相册
 */

const { checkTextSecurity } = require("../../utils/security.js");
const adManager = require("../../utils/adManager.js");
const api = require("../../utils/api.js");
const fontLoader = require("../../utils/fontLoader.js");

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
  gridCols: 3,
  fontFamily: ''
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
    config: { ...DEFAULT_CONFIG },
    fontList: [],
    showFontSheet: false,
    _previewVersion: 0
  },

  // Canvas 2D 实例
  _previewCanvas: null,
  _previewCtx: null,
  _pixelRatio: 1,

  // 双击检测
  _lastTapTime: 0,
  _tapTimer: null,
  _initTimer: null,

  // ========== 生命周期 ==========

  onLoad: function (options) {
    // 解析分享配置（完整 JSON 格式）
    if (options && options.cfg) {
      try {
        var shared = JSON.parse(decodeURIComponent(options.cfg));
        this.setData({ config: Object.assign({}, DEFAULT_CONFIG, shared) });
        // 标记需要加载分享的字体
        if (shared.fontFamily) {
          this._shareFontNeedsLoad = true;
        }
      } catch (e) {
        console.error('[gridcut] Failed to parse shared config:', e);
      }
    }

    try {
      var saved = wx.getStorageSync(STORAGE_KEY);
      if (saved && typeof saved === 'object') {
        // 本地存储仅在没有分享配置时覆盖默认值
        if (!options || !options.cfg) {
          this.setData({ config: Object.assign({}, DEFAULT_CONFIG, saved) });
        }
      }
    } catch (e) {
      // ignore
    }
    // 获取字体列表
    var self = this;
    fontLoader.getFontList().then(function (list) {
      self.setData({ fontList: list });
    });
    this._initRewardedVideoAd();
    // 初始化插屏广告（补充展示）
    adManager.initInterstitial('adunit-e27403557732ca1a');
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

  onShow: function () {},

  onReady: function () {
    var sysInfo = wx.getSystemInfoSync();
    this._pixelRatio = sysInfo.pixelRatio || 2;
    var size = this._calcCanvasSize();
    this.setData({ canvasWidth: size.w, canvasHeight: size.h });
    var self = this;
    this._initTimer = setTimeout(() => {
      self._initTimer = null;
      self._initPreviewCanvas();
    }, 200);

    // 分享打开时加载字体（延迟确保 canvas 已就绪）
    if (self._shareFontNeedsLoad) {
      var shareFont = self.data.config.fontFamily;
      var shareText = self.data.config.text;
      if (shareFont && shareText) {
        setTimeout(function () {
          fontLoader.loadFont(shareFont, shareText, function (ok) {
            if (ok) self._drawPreview();
          });
        }, 600);
      }
    }

    // 5秒后展示插屏广告（补充激励视频之外的广告位，最小间隔90秒）
    self._adTimer = setTimeout(function () {
      self._adTimer = null;
      adManager.showInterstitial('adunit-e27403557732ca1a');
    }, 5000);
  },

  onUnload: function () {
    if (this._initTimer) {
      clearTimeout(this._initTimer);
      this._initTimer = null;
    }
    if (this._adTimer) {
      clearTimeout(this._adTimer);
      this._adTimer = null;
    }
    if (this._tapTimer) {
      clearTimeout(this._tapTimer);
      this._tapTimer = null;
    }
    // 释放预览 canvas
    if (this._previewCanvas) {
      this._previewCanvas.width = 0;
      this._previewCanvas.height = 0;
      this._previewCanvas = null;
      this._previewCtx = null;
    }
    // 销毁激励视频广告
    if (this._rewardedVideoAd) {
      try { this._rewardedVideoAd.destroy(); } catch (e) { /* ignore */ }
      this._rewardedVideoAd = null;
    }
    try { wx.setStorageSync(STORAGE_KEY, this.data.config); } catch (e) { /* ignore */ }
  },

  // ========== 广告 ==========

  _initRewardedVideoAd: function () {
    if (wx.createRewardedVideoAd) {
      this._rewardedVideoAd = wx.createRewardedVideoAd({
        adUnitId: 'adunit-a4dd005b78ec003c'
      });
      this._rewardedVideoAd.onLoad(() => {
        console.log('[切字激励广告] 加载成功');
      });
      this._rewardedVideoAd.onError((err) => {
        console.error('[切字激励广告] 加载失败', err);
        this._rewardedVideoAd.load().catch(() => {});
      });
      this._rewardedVideoAd.onClose((res) => {
        if (res && res.isEnded) {
          // 看完广告，执行保存
          console.log('[切字激励广告] 看完，执行保存');
          var cb = this.__rewardedCallback;
          this.__rewardedCallback = null;
          if (cb) cb();
        } else {
          // 没看完就关闭
          console.log('[切字激励广告] 未看完');
          this.__rewardedCallback = null;
          wx.showToast({ title: '看完广告才能保存哦', icon: 'none' });
        }
      });
      this._rewardedVideoAd.load();
    }
  },

  _showRewardedVideo: function (callback) {
    if (!this._rewardedVideoAd) {
      callback();
      return;
    }
    var self = this;
    self.__rewardedCallback = callback;
    self._rewardedVideoAd.show().then(() => {
      console.log('[切字激励广告] 展示中...');
    }).catch((err) => {
      console.error('[切字激励广告] 展示失败', err);
      self.__rewardedCallback = null;
      // 广告展示失败，直接保存
      callback();
    });
  },

  // ========== 导航 ==========

  onBack: function () {
    wx.navigateBack();
  },

  // ========== 分享 ==========

  onShareAppMessage: function () {
    var c = this.data.config;
    var shareConfig = {};
    for (var key in c) {
      if (c.hasOwnProperty(key)) shareConfig[key] = c[key];
    }
    var cfg = encodeURIComponent(JSON.stringify(shareConfig));
    var title = c.text || '';
    return {
      title: '九宫格切字「' + title + '」— 一字九图，刷爆朋友圈',
      path: '/pages/gridcut/gridcut?cfg=' + cfg
    };
  },

  onShareTimeline: function () {
    var c = this.data.config;
    var shareConfig = {};
    for (var key in c) {
      if (c.hasOwnProperty(key)) shareConfig[key] = c[key];
    }
    var cfg = encodeURIComponent(JSON.stringify(shareConfig));
    var title = c.text || '';
    return {
      title: '九宫格切字「' + title + '」— 一字九图，刷爆朋友圈',
      query: 'cfg=' + cfg
    };
  },

  // ========== 初始化预览 Canvas ==========

  _initPreviewCanvas: function () {
    // 释放旧 canvas
    if (this._previewCanvas) {
      this._previewCanvas.width = 0;
      this._previewCanvas.height = 0;
    }
    this._previewCanvas = null;
    this._previewCtx = null;

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
      var ff = config.fontFamily ? '"' + config.fontFamily + '", "楷体", "STKaiti", "KaiTi", "PingFang SC", sans-serif' : '"楷体", "STKaiti", "KaiTi", "PingFang SC", sans-serif';
        ctx.font = (config.fontWeight || 'bold') + ' ' + cellFontSize + 'px ' + ff;
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
      var ff2 = config.fontFamily ? '"' + config.fontFamily + '", "楷体", "STKaiti", "KaiTi", "PingFang SC", sans-serif' : '"楷体", "STKaiti", "KaiTi", "PingFang SC", sans-serif';
        ctx.font = (config.fontWeight || 'bold') + ' ' + fontSize + 'px ' + ff2;
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
    var show = !this.data.showSettings;
    this.setData({ showSettings: show });
    if (show && this.data.fontList.length > 0) {
      var self = this;
      fontLoader.loadPreviewFonts(this.data.fontList, function (count) {
        self.setData({ _previewVersion: count });
      });
    }
  },

  
  
  

  onFontSelect: function (e) {
    var fontName = e.currentTarget.dataset.font || '';
    this.setData({ "config.fontFamily": fontName });
    if (fontName) {
      var self = this;
      fontLoader.loadFont(fontName, self.data.config.text || '', function (ok) {
        if (ok) self._drawPreview();
      });
    } else {
      this._drawPreview();
    }
  },
  closeSettings: function () {
    this.setData({ showSettings: false });
    try { wx.setStorageSync(STORAGE_KEY, this.data.config); } catch (e) { /* ignore */ }

    // 上报内容日志
    var c = this.data.config;
    api.logEvent('gridcut', 'settings', {
      text: c.text,
      multiMode: c.multiMode,
      fontSize: c.fontSize,
      textColor: c.textColor,
      bgColor: c.bgColor,
      fontWeight: c.fontWeight,
      glowEnabled: c.glowEnabled,
      gridRows: c.gridRows,
      gridCols: c.gridCols
    });
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
    this._showRewardedVideo(function () {
      self._doExport();
    });
  },

  _doExport: function () {
    var self = this;
    var rows = this.data.config.gridRows || 3;
    var cols = this.data.config.gridCols || 3;
    var total = rows * cols;

    var app = getApp();
    app.checkPhotoAlbumAuth(function () {
      self.setData({ isExporting: true, exportProgress: 0, exportTotal: total });

      var cellSize = Math.floor(MAX_TOTAL_SIZE / Math.max(rows, cols));
      var exportW = cellSize * cols;
      var exportH = cellSize * rows;
      var lineScale = exportW / self.data.canvasWidth;

      var offCanvas = wx.createOffscreenCanvas({ type: '2d', width: exportW, height: exportH });
      var ctx = offCanvas.getContext('2d');
      self._drawOnCtx(ctx, exportW, exportH, lineScale, true);

      self._exportCellsFromOffscreen(offCanvas, cellSize, rows, cols).then(function () {
        offCanvas.width = 0;
        offCanvas.height = 0;
      });
    });
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
          var dataUrl = cellCanvas.toDataURL('image/jpeg', 0.95);
          var base64 = dataUrl.split(',')[1];
          var tempPath = wx.env.USER_DATA_PATH + '/gridcut_' + index + '.jpg';
          fs.writeFileSync(tempPath, base64, 'base64');
          // 释放 cell canvas
          cellCanvas.width = 0;
          cellCanvas.height = 0;

          await new Promise(function (resolve, reject) {
            wx.saveImageToPhotosAlbum({
              filePath: tempPath,
              success: resolve,
              fail: reject
            });
          });

          self.setData({ exportProgress: index + 1 });
        }
      }
      wx.showToast({ title: '已保存' + (rows * cols) + '张图到相册', icon: 'success' });
      try { for (var ri = 0; ri < rows; ri++) { for (var ci = 0; ci < cols; ci++) { var idx = ri * cols + ci; fs.unlinkSync(wx.env.USER_DATA_PATH + '/gridcut_' + idx + '.jpg'); } } } catch (e) { /* ignore */ }
      // 清理临时文件
      try {
        for (var ri = 0; ri < rows; ri++) {
          for (var ci = 0; ci < cols; ci++) {
            var idx = ri * cols + ci;
            fs.unlinkSync(wx.env.USER_DATA_PATH + '/gridcut_' + idx + '.jpg');
          }
        }
      } catch (e) { /* ignore */ }
      // 上报导出事件
      var c = self.data.config;
      api.logEvent('gridcut', 'action', {
        action: 'export',
        text: c.text,
        multiMode: c.multiMode,
        gridRows: c.gridRows,
        gridCols: c.gridCols
      });
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
