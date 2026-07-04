/**
 * 九宫格切图 — 一图九图
 * Canvas 2D 渲染图片 + 3×3 九宫格线
 * 支持拖拽/缩放/旋转调整构图，导出 9 张图到相册
 */

const STORAGE_KEY = 'photocut_config';
const adManager = require("../../utils/adManager.js");

const DEFAULT_CONFIG = {
  gridColor: 'rgba(0,0,0,0.6)',
  gridWidth: 2,
  gridRows: 3,
  gridCols: 3
};

// 导出限制
const MAX_TOTAL_SIZE = 8192;  // 画布最大边长（安全上限）

Page({
  data: {
    // 状态
    hasImage: false,
    showHint: false,
    showSettings: false,
    isExporting: false,
    exportProgress: 0,
    exportTotal: 9,
    canvasWidth: 0,
    canvasHeight: 0,

    // 手势提示
    hintText: '拖动移动 · 双指缩放 · 双指旋转',

    // 网格配置
    config: { ...DEFAULT_CONFIG }
  },

  // Canvas 2D
  _previewCanvas: null,
  _previewCtx: null,
  _pixelRatio: 1,

  // 图片
  _image: null,
  _imagePath: '',   // 保留文件路径用于旧式 API 导出
  _imgW: 0,
  _imgH: 0,

  // 变换状态
  _transform: { x: 0, y: 0, scale: 1, rotation: 0 },

  // 触摸状态
  _touches: {},
  _prevDist: 0,
  _prevAngle: 0,
  _prevSingleX: 0,
  _prevSingleY: 0,

  // 提示定时器
  _hintTimer: null,
  _initTimer: null,

  // ========== 生命周期 ==========

  // ========== 分享 ==========

  onShareAppMessage: function () {
    return {
      title: '九宫格切图 — 一图九格，朋友圈专属排版',
      path: '/pages/photocut/photo-cut'
    };
  },

  onShareTimeline: function () {
    return {
      title: '九宫格切图 — 一图九格，朋友圈专属排版',
      query: ''
    };
  },

  onLoad: function () {
    try {
      var saved = wx.getStorageSync(STORAGE_KEY);
      if (saved && typeof saved === 'object') {
        this.setData({ config: { ...DEFAULT_CONFIG, ...saved } });
      }
    } catch (e) { /* ignore */ }
    this._initRewardedVideoAd();
    // 初始化插屏广告（补充展示）
    adManager.initInterstitial('adunit-8a02756aec63f656');
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
    this.setData({ canvasWidth: size.w, canvasHeight: size.h });
    this._initTimer = setTimeout(function () {
      self._initTimer = null;
      self._initPreviewCanvas();
    }, 200);

    // 5秒后展示插屏广告（补充激励视频之外的广告位，最小间隔90秒）
    self._adTimer = setTimeout(function () {
      self._adTimer = null;
      adManager.showInterstitial('adunit-8a02756aec63f656');
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
    if (this._hintTimer) clearTimeout(this._hintTimer);
    try { wx.setStorageSync(STORAGE_KEY, this.data.config); } catch (e) { /* ignore */ }
  },

  // ========== 广告 ==========

  _initRewardedVideoAd: function () {
    if (wx.createRewardedVideoAd) {
      this._rewardedVideoAd = wx.createRewardedVideoAd({
        adUnitId: 'adunit-9e611dc5e9ea6a6b'
      });
      this._rewardedVideoAd.onLoad(() => {
        console.log('[切图激励广告] 加载成功');
      });
      this._rewardedVideoAd.onError((err) => {
        console.error('[切图激励广告] 加载失败', err);
        this._rewardedVideoAd.load().catch(() => {});
      });
      this._rewardedVideoAd.onClose((res) => {
        if (res && res.isEnded) {
          console.log('[切图激励广告] 看完，执行保存');
          var cb = this.__rewardedCallback;
          this.__rewardedCallback = null;
          if (cb) cb();
        } else {
          console.log('[切图激励广告] 未看完');
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
      console.log('[切图激励广告] 展示中...');
    }).catch((err) => {
      console.error('[切图激励广告] 展示失败', err);
      self.__rewardedCallback = null;
      callback();
    });
  },

  // ========== Canvas 初始化 ==========

  _initPreviewCanvas: function () {
    var self = this;
    var query = wx.createSelectorQuery();
    query.select('#previewCanvas').fields({ node: true, size: true }).exec(function (res) {
      if (!res || !res[0] || !res[0].node) return;
      var canvas = res[0].node;
      var dpr = self._pixelRatio;
      var cw = self.data.canvasWidth;
      var ch = self.data.canvasHeight;
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
      var ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      self._previewCanvas = canvas;
      self._previewCtx = ctx;
      self._drawPreview();
    });
  },

  // ========== 图片选择 ==========

  onPickImage: function () {
    var self = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: function (res) {
        var tempPath = res.tempFiles[0].tempFilePath;
        self._loadImage(tempPath);
      },
      fail: function (err) {
        if (err && err.errMsg && err.errMsg.indexOf('cancel') === -1) {
          wx.showToast({ title: '选图失败，请重试', icon: 'none' });
        }
      }
    });
  },

  _loadImage: function (src) {
    var self = this;
    var canvas = this._previewCanvas;
    if (!canvas) {
      wx.showToast({ title: '画布未就绪', icon: 'none' });
      return;
    }
    var img = canvas.createImage();
    img.onload = function () {
      self._image = img;
      self._imagePath = src;
      self._imgW = img.width;
      self._imgH = img.height;
      // 自动适配居中
      self._resetTransform();
      self.setData({ hasImage: true });
      self._drawPreview();
      // 显示手势提示，3 秒后消失
      self.setData({ showHint: true });
      if (self._hintTimer) clearTimeout(self._hintTimer);
      self._hintTimer = setTimeout(function () {
        self.setData({ showHint: false });
      }, 3000);
    };
    img.onerror = function () {
      wx.showToast({ title: '图片加载失败', icon: 'none' });
    };
    img.src = src;
  },

  // ========== 变换重置 ==========

  _resetTransform: function () {
    var cw = this.data.canvasWidth, ch = this.data.canvasHeight;
    if (!this._imgW || !cw) return;
    var fitScale = Math.min(cw / this._imgW, ch / this._imgH) * 0.85;
    this._transform = { x: 0, y: 0, scale: fitScale, rotation: 0 };
  },

  onReset: function () {
    if (!this.data.hasImage) return;
    this._resetTransform();
    this._drawPreview();
  },

  // ========== Canvas 绘制 ==========

  _drawPreview: function () {
    var ctx = this._previewCtx;
    if (!ctx) return;
    this._drawScene(ctx, this.data.canvasWidth, this.data.canvasHeight, null, 1, false);
  },

  _drawScene: function (ctx, w, h, optTransform, lineScale, noGrid) {
    var config = this.data.config;
    var img = this._image;
    var scale = lineScale || 1;
    // 清屏 + 背景
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    if (img) {
      var t = optTransform || this._transform;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(t.rotation * Math.PI / 180);
      ctx.scale(t.scale, t.scale);
      ctx.drawImage(img, t.x - this._imgW / 2, t.y - this._imgH / 2, this._imgW, this._imgH);
      ctx.restore();
    }

    // 网格线（预览显示，导出跳过）
    if (!noGrid) {
      var gw = config.gridWidth != null ? config.gridWidth : 2;
      if (gw > 0) {
        var gridCfg = { gridColor: config.gridColor, gridWidth: gw * scale };
        this._drawGrid(ctx, w, h, gridCfg);
      }
    }

    // 空状态提示（画在网格线之上）
    if (!img) {
      this._drawEmptyState(ctx, w, h);
    }
  },

  _drawEmptyState: function (ctx, w, h) {
    var cx = w / 2, cy = h / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 36, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - 20);
    ctx.lineTo(cx, cy + 20);
    ctx.moveTo(cx - 20, cy);
    ctx.lineTo(cx + 20, cy);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '14px "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('点击加号选择图片', cx, cy + 50);
  },

  _drawGrid: function (ctx, w, h, config) {
    var rows = this.data.config.gridRows || 3;
    var cols = this.data.config.gridCols || 3;
    var cellW = w / cols;
    var cellH = h / rows;
    ctx.strokeStyle = config.gridColor;
    ctx.lineWidth = config.gridWidth || 2;
    ctx.lineCap = 'round';
    for (var c = 1; c < cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cellW, 0);
      ctx.lineTo(c * cellW, h);
      ctx.stroke();
    }
    for (var r = 1; r < rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * cellH);
      ctx.lineTo(w, r * cellH);
      ctx.stroke();
    }
  },

  // 空状态点击 canvas 触发选图
  onCanvasTap: function () {
    if (!this.data.hasImage) {
      this.onPickImage();
    }
  },

  // ========== 触摸手势 ==========

  _rafPending: false,

  _scheduleDraw: function () {
    if (this._rafPending) return;
    this._rafPending = true;
    var self = this;
    if (this._previewCanvas && this._previewCanvas.requestAnimationFrame) {
      this._previewCanvas.requestAnimationFrame(function () {
        self._drawPreview();
        self._rafPending = false;
      });
    } else {
      // 降级
      this._drawPreview();
      this._rafPending = false;
    }
  },

  onTouchStart: function (e) {
    var touches = e.touches;
    // 始终记录单指位置，避免 2→1 指切换时跳变
    if (touches.length >= 1) {
      this._prevSingleX = touches[0].x;
      this._prevSingleY = touches[0].y;
    }
    if (touches.length === 2) {
      this._prevDist = this._getTouchDist(touches);
      this._prevAngle = this._getTouchAngle(touches);
      this._rotAccum = 0;  // 旋转步进累加器
    }
    if (this.data.showHint) {
      if (this._hintTimer) clearTimeout(this._hintTimer);
      this.setData({ showHint: false });
    }
  },

  onTouchMove: function (e) {
    if (!this.data.hasImage) return;
    var touches = e.touches;

    if (touches.length === 1) {
      var dx = touches[0].x - this._prevSingleX;
      var dy = touches[0].y - this._prevSingleY;
      this._prevSingleX = touches[0].x;
      this._prevSingleY = touches[0].y;
      var angle = this._transform.rotation * Math.PI / 180;
      var cos = Math.cos(angle), sin = Math.sin(angle);
      this._transform.x += dx * cos - dy * sin;
      this._transform.y += dx * sin + dy * cos;
      this._drawPreview();  // 拖拽即时绘制，不节流
    } else if (touches.length === 2) {
      var dist = this._getTouchDist(touches);
      var touchAngle = this._getTouchAngle(touches);

      // 计算变化量，决定本次是缩放还是旋转（互斥）
      var zoomChange = this._prevDist > 0 ? Math.abs(dist / this._prevDist - 1) : 0;
      var dA = this._prevAngle !== null ? touchAngle - this._prevAngle : 0;
      var rotChange = Math.abs(dA);

      if (zoomChange >= rotChange / 100) {
        // 缩放（最小 0.5，最大 3.0）
        if (this._prevDist > 0 && dist > 0) {
          var newScale = this._transform.scale * (dist / this._prevDist);
          var minScale = 200 / Math.max(this._imgW, this._imgH, 200);
          if (newScale < minScale) newScale = minScale;
          if (newScale > 3.0) newScale = 3.0;
          this._transform.scale = newScale;
        }
        this._prevDist = dist;
        this._prevAngle = touchAngle;
        this._rotAccum = 0;
      } else if (rotChange > 1) {
        // 旋转步进 15°
        this._rotAccum += dA;
        if (Math.abs(this._rotAccum) >= 15) {
          var steps = Math.round(this._rotAccum / 15);
          this._transform.rotation += steps * 15;
          this._rotAccum -= steps * 15;
        }
        this._prevAngle = touchAngle;
        this._prevDist = dist;
      }

      this._scheduleDraw();
    }
  },

  onTouchEnd: function (e) {
    if (e.touches.length === 0) {
      this._prevDist = 0;
      this._prevAngle = null;
    } else if (e.touches.length === 1) {
      this._prevDist = 0;
      this._prevAngle = null;
      this._prevSingleX = e.touches[0].x;
      this._prevSingleY = e.touches[0].y;
    }
    this._drawPreview();
  },

  _getTouchDist: function (touches) {
    var dx = touches[0].x - touches[1].x;
    var dy = touches[0].y - touches[1].y;
    return Math.sqrt(dx * dx + dy * dy);
  },

  _getTouchAngle: function (touches) {
    var dx = touches[0].x - touches[1].x;
    var dy = touches[0].y - touches[1].y;
    return Math.atan2(dy, dx) * 180 / Math.PI;
  },

  // ========== 设置面板 ==========

  toggleSettings: function () {
    this.setData({ showSettings: !this.data.showSettings });
  },

  closeSettings: function () {
    this.setData({ showSettings: false });
    try { wx.setStorageSync(STORAGE_KEY, this.data.config); } catch (e) { /* ignore */ }
  },

  onGridColorChange: function (e) {
    var color = e.detail.colorList[0];
    this.setData({ 'config.gridColor': color }, this._drawPreview);
  },

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
      this._resetTransform();
      this._initPreviewCanvas();
    });
  },

  onGridWidthChange: function (e) {
    this.setData({ 'config.gridWidth': e.detail }, this._drawPreview);
  },

  // ========== 导出九图 ==========

  /**
   * 计算导出分辨率：根据原图尺寸和当前缩放，让每格尽可能 1:1 对应原图像素
   */
  _calcExportSize: function () {
    var rows = this.data.config.gridRows || 3;
    var cols = this.data.config.gridCols || 3;
    var cw = this.data.canvasWidth;
    var div = Math.max(rows, cols);
    var cellCoverPx = (cw / cols) / this._transform.scale;
    var cell = Math.round(cellCoverPx);
    var total = cell * div;
    if (total > MAX_TOTAL_SIZE) {
      total = MAX_TOTAL_SIZE;
      cell = Math.floor(total / div);
    }
    return { cell: cell, rows: rows, cols: cols };
  },

  // ========== 导出九图（OffscreenCanvas + toDataURL） ==========

  onExport: function () {
    if (this.data.isExporting) return;
    if (!this.data.hasImage) {
      wx.showToast({ title: '请先选择图片', icon: 'none' });
      return;
    }
    var self = this;
    this._showRewardedVideo(function () {
      self._doExport();
    });
  },

  _doExport: function () {
    var rows = this.data.config.gridRows || 3;
    var cols = this.data.config.gridCols || 3;
    var self = this;

    var app = getApp();
    app.checkPhotoAlbumAuth(function () {
      self.setData({ isExporting: true, exportProgress: 0, exportTotal: rows * cols });

      var sizes = self._calcExportSize();
      var exportCell = sizes.cell;
      var exportW = exportCell * sizes.cols;
      var exportH = exportCell * sizes.rows;
      var lineScale = exportCell / (self.data.canvasWidth / sizes.cols);
      var t = self._transform;
      var eT = { x: t.x, y: t.y, scale: t.scale * lineScale, rotation: t.rotation };

      // 在大画布上加载图片 → 渲染完整场景 → 逐格用 drawImage 拷贝
      var bigCanvas = wx.createOffscreenCanvas({ type: '2d', width: exportW, height: exportH });
      var img = bigCanvas.createImage();
      img.src = self._imagePath;
      img.onload = function () {
        var origImage = self._image;
        var origW = self._imgW, origH = self._imgH;
        self._image = img;
        self._imgW = img.width;
        self._imgH = img.height;
        var bigCtx = bigCanvas.getContext('2d');
        self._drawScene(bigCtx, exportW, exportH, eT, lineScale, true);
        self._image = origImage;
        self._imgW = origW;
        self._imgH = origH;
        self._exportCellsFromOffscreen(bigCanvas, exportCell, rows, cols);
      };
      img.onerror = function () {
        self.setData({ isExporting: false });
        wx.showToast({ title: '图片加载失败，请重试', icon: 'none' });
      };
    });
  },

  _exportCellsFromOffscreen: function (bigCanvas, cellSize, rows, cols) {
    var self = this;
    var fs = wx.getFileSystemManager();

    (async function () {
      try {
        for (var row = 0; row < rows; row++) {
          for (var col = 0; col < cols; col++) {
            var index = row * cols + col;
            // 格子画布
            var cellCanvas = wx.createOffscreenCanvas({ type: '2d', width: cellSize, height: cellSize });
            var cellCtx = cellCanvas.getContext('2d');
            // 从大画布拷贝对应区域
            cellCtx.drawImage(
              bigCanvas,
              col * cellSize, row * cellSize, cellSize, cellSize,
              0, 0, cellSize, cellSize
            );
            // 导出
            var dataUrl = cellCanvas.toDataURL('image/jpeg', 0.95);
            var base64 = dataUrl.split(',')[1];
            var tempPath = wx.env.USER_DATA_PATH + '/photocut_' + index + '.jpg';
            fs.writeFileSync(tempPath, base64, 'base64');

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
      } catch (err) {
        console.error('[photocut] export error:', err);
        if (!err || !err.errMsg || err.errMsg.indexOf('auth deny') === -1) {
          wx.showToast({ title: '导出失败，请重试', icon: 'none' });
        }
      } finally {
        self.setData({ isExporting: false, exportProgress: 0 });
      }
    })();
  }
});
