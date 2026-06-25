/**
 * 倒计时页面 — Canvas 2D 渲染
 * 支持：多倒计时切换、精度选择（天→毫秒）、渐变/图片/视频背景、导出卡片
 */

const STORAGE_KEY = 'countdown_app_data';

// ========== 工具函数 ==========

/** 生成简单唯一 ID */
function uuid() {
  return 'cd_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/** 补零 */
function pad(n, len) {
  len = len || 2;
  var s = String(n);
  while (s.length < len) s = '0' + s;
  return s;
}

// ========== 内置背景 ==========

var BUILTIN_BGS = [
  { key: 'gradient_deep', label: '深空', colors: ['#0f0c29', '#302b63', '#24243e'], cssGradient: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' },
  { key: 'gradient_sunset', label: '日落', colors: ['#f12711', '#f5af19'], cssGradient: 'linear-gradient(135deg, #f12711, #f5af19)' },
  { key: 'gradient_aurora', label: '极光', colors: ['#00b09b', '#96c93d'], cssGradient: 'linear-gradient(135deg, #00b09b, #96c93d)' },
  { key: 'gradient_ocean', label: '海洋', colors: ['#2193b0', '#6dd5ed'], cssGradient: 'linear-gradient(135deg, #2193b0, #6dd5ed)' },
  { key: 'gradient_purple', label: '暗紫', colors: ['#1a1a2e', '#16213e', '#0f3460'], cssGradient: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)' },
  { key: 'gradient_rose', label: '玫瑰', colors: ['#f093fb', '#f5576c'], cssGradient: 'linear-gradient(135deg, #f093fb, #f5576c)' }
];

// ========== 精度选项 ==========

var PRECISION_OPTIONS = [
  { key: 'days', label: '仅天数' },
  { key: 'hours', label: '天+时' },
  { key: 'minutes', label: '天+时+分' },
  { key: 'seconds', label: '天+时+分+秒' }
];

// ========== 默认倒计时 ==========

function createDefaultCountdown() {
  var now = new Date();
  var target = new Date(now.getFullYear() + 1, 0, 1); // 明年元旦
  return {
    id: uuid(),
    title: '元旦',
    targetDate: target.getFullYear() + '-01-01T00:00:00',
    precision: 'seconds',
    bgType: 'builtin',
    bgValue: 'gradient_deep',
    textColor: '#ffffff',
    textShadowEnabled: true,
    textShadowColor: '#000000',
    showTitle: true,
    showDate: true,
    screenDirection: 'portrait'
  };
}

// ========== Page ==========

Page({
  data: {
    // — 画布状态 —
    canvasReady: false,
    canvasWidth: 0,
    canvasHeight: 0,

    // — 倒计时数据 —
    countdowns: [],
    currentIndex: 0,
    currentCountdown: null,

    // — 显示 —
    displayParts: [],       // [{value, unit, isSep}, ...]
    isExpired: false,

    // — UI 状态 —
    showSettings: false,
    showSwitchSheet: false,
    switchSheetActions: [],
    isExporting: false,

    // — 编辑草稿 —
    isNewCountdown: false,
    draft: {},

    // — picker 展示值 —
    pickerDate: '',
    pickerTime: '',

    // — 静态配置 —
    builtinBackgrounds: BUILTIN_BGS,
    precisionOptions: PRECISION_OPTIONS,

    // — 导出进度 —
    exportProgress: 0,
    exportTotal: 1
  },

  // ========== 实例变量 ==========

  _canvas: null,
  _ctx: null,
  _pixelRatio: 1,
  _screenW: 0,
  _screenH: 0,
  _animationId: null,
  _bgImage: null,         // canvas Image 对象（图片背景用）
  _lastTapTime: 0,
  _tapTimer: null,
  _initTimer: null,

  // ========== 生命周期 ==========

  onLoad: function () {
    var saved = null;
    try {
      saved = wx.getStorageSync(STORAGE_KEY);
    } catch (e) { /* ignore */ }

    var countdowns = [];
    if (saved && Array.isArray(saved) && saved.length > 0) {
      countdowns = saved;
    } else {
      countdowns = [createDefaultCountdown()];
    }

    var cd = countdowns[0];
    this.setData({
      countdowns: countdowns,
      currentIndex: 0,
      currentCountdown: cd
    }, function () {
      this._syncPickerFromTarget(cd.targetDate);
    });
    this._initInterstitialAd();
  },

  onReady: function () {
    var self = this;
    wx.nextTick(function () {
      self._initTimer = setTimeout(function () {
        self._initTimer = null;
        self._initCanvas();
      }, 200);
    });
  },

  onShow: function () {
    if (this._interstitialAd) {
      this._interstitialAd.show().catch(() => {});
    }
    if (this._ctx && !this._animationId) {
      this._startLoop();
    }
  },

  onHide: function () {
    this._stopLoop();
  },

  onUnload: function () {
    if (this._initTimer) {
      clearTimeout(this._initTimer);
      this._initTimer = null;
    }
    if (this._tapTimer) {
      clearTimeout(this._tapTimer);
      this._tapTimer = null;
    }
    this._stopLoop();
    if (this._bgImage) {
      this._bgImage.onload = null;
      this._bgImage.onerror = null;
      this._bgImage = null;
    }
    try { wx.setStorageSync(STORAGE_KEY, this.data.countdowns); } catch (e) { /* ignore */ }
  },

  // ========== 广告 ==========

  _initInterstitialAd: function () {
    if (wx.createInterstitialAd) {
      this._interstitialAd = wx.createInterstitialAd({
        adUnitId: 'adunit-d33d47dd88ebafab'
      });
      this._interstitialAd.onLoad(() => {
        console.log('[倒计时插屏广告] 加载成功');
      });
      this._interstitialAd.onError((err) => {
        console.error('[倒计时插屏广告] 加载失败', err);
      });
      this._interstitialAd.onClose(() => {
        if (this._interstitialAd) {
          this._interstitialAd.load().catch(() => {});
        }
      });
      this._interstitialAd.load();
    }
  },

  // ========== 分享 ==========

  onShareAppMessage: function () {
    var cd = this.data.currentCountdown;
    return {
      title: '倒计时 - ' + (cd ? cd.title : ''),
      path: '/pages/countdown/countdown'
    };
  },

  onShareTimeline: function () {
    var cd = this.data.currentCountdown;
    return {
      title: '倒计时 - ' + (cd ? cd.title : ''),
      query: ''
    };
  },

  // ========== Canvas 初始化 ==========

  _initCanvas: function () {
    var sysInfo = wx.getSystemInfoSync();
    this._pixelRatio = sysInfo.pixelRatio || 2;
    this._screenW = sysInfo.screenWidth;
    this._screenH = sysInfo.screenHeight;

    var self = this;
    var query = wx.createSelectorQuery();
    query.select('#countdownCanvas').fields({ node: true, size: true }).exec(function (res) {
      if (!res || !res[0] || !res[0].node) {
        wx.showToast({ title: 'Canvas 初始化失败', icon: 'none' });
        return;
      }
      var canvas = res[0].node;
      var dpr = self._pixelRatio;
      // 取长边作为 Canvas 物理尺寸，覆盖横竖屏旋转
      var maxDim = Math.max(self._screenW, self._screenH);
      canvas.width = maxDim * dpr;
      canvas.height = maxDim * dpr;
      var ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      self._canvas = canvas;
      self._ctx = ctx;

      // 设置 Canvas CSS 尺寸
      self._updateCanvasSize();

      // 如果有图片背景，此时加载
      var cd = self.data.currentCountdown;
      if (cd && cd.bgType === 'image' && cd.bgValue) {
        self._loadBgImage(cd.bgValue);
      }

      self._startLoop();
      self.setData({ canvasReady: true });
    });
  },

  // ========== 动画循环 ==========

  _startLoop: function () {
    var self = this;
    if (self._animationId) return;

    function tick() {
      self._animationId = self._canvas.requestAnimationFrame(tick);
      self._updateDisplay();
      self._drawCanvas();
    }

    self._animationId = self._canvas.requestAnimationFrame(tick);
  },

  _stopLoop: function () {
    if (this._animationId && this._canvas && this._canvas.cancelAnimationFrame) {
      this._canvas.cancelAnimationFrame(this._animationId);
      this._animationId = null;
    }
  },

  // ========== 时间计算 ==========

  _updateDisplay: function () {
    var cd = this.data.currentCountdown;
    if (!cd) return;

    var now = Date.now();
    var target = new Date(cd.targetDate).getTime();

    if (target <= now) {
      if (!this.data.isExpired) {
        this.setData({ isExpired: true });
      }
      // 过期后显示全零
      this._buildParts(0, cd.precision);
      return;
    }

    if (this.data.isExpired) {
      this.setData({ isExpired: false });
    }

    var diff = target - now;
    this._buildParts(diff, cd.precision);
  },

  _buildParts: function (diffMs, precision) {
    var parts = [];

    // 分解时间
    var totalSec = Math.floor(diffMs / 1000);
    var sec = totalSec % 60;
    var totalMin = Math.floor(totalSec / 60);
    var min = totalMin % 60;
    var totalHr = Math.floor(totalMin / 60);
    var hr = totalHr % 24;
    var days = Math.floor(totalHr / 24);

    // 天
    parts.push({ value: String(days), unit: '天', isSep: false });

    if (precision === 'days') {
      this.setData({ displayParts: parts });
      return;
    }

    // 时
    parts.push({ value: pad(hr), unit: '时', isSep: false });

    if (precision === 'hours') {
      this.setData({ displayParts: parts });
      return;
    }

    // 分
    parts.push({ value: pad(min), unit: '分', isSep: false });

    if (precision === 'minutes') {
      this.setData({ displayParts: parts });
      return;
    }

    // 秒
    parts.push({ value: pad(sec), unit: '秒', isSep: false });

    this.setData({ displayParts: parts });
  },

  // ========== Canvas 绘制 ==========

  _drawCanvas: function () {
    var ctx = this._ctx;
    if (!ctx) return;
    var cd = this.data.currentCountdown;
    if (!cd) return;

    // 横屏时交换宽高（画布随 stage 旋转了 90°）
    var isLandscape = cd.screenDirection === 'landscape';
    var sw = isLandscape ? this._screenH : this._screenW;
    var sh = isLandscape ? this._screenW : this._screenH;

    // 1. 清屏
    if (cd.bgType === 'video') {
      // 透明背景，只清文字区域
      ctx.clearRect(0, 0, sw, sh);
    } else {
      ctx.clearRect(0, 0, sw, sh);
      // 2. 绘制背景
      if (cd.bgType === 'image' && this._bgImage) {
        this._drawImageBg(ctx, sw, sh);
      } else {
        this._drawBuiltinBg(ctx, sw, sh, cd.bgValue);
      }
    }

    // 3. 绘制文字内容
    this._drawTextContent(ctx, sw, sh, cd);
  },

  _drawBuiltinBg: function (ctx, sw, sh, key) {
    var preset = BUILTIN_BGS.find(function (b) { return b.key === key; }) || BUILTIN_BGS[0];
    var gradient = ctx.createLinearGradient(0, 0, 0, sh);
    var len = preset.colors.length;
    for (var i = 0; i < len; i++) {
      gradient.addColorStop(i / Math.max(len - 1, 1), preset.colors[i]);
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, sw, sh);
  },

  _drawImageBg: function (ctx, sw, sh) {
    if (!this._bgImage) return;
    // 等比缩放填满
    var imgW = this._bgImage.width;
    var imgH = this._bgImage.height;
    if (!imgW || !imgH) {
      ctx.drawImage(this._bgImage, 0, 0, sw, sh);
      return;
    }
    var scale = Math.max(sw / imgW, sh / imgH);
    var dw = imgW * scale;
    var dh = imgH * scale;
    var dx = (sw - dw) / 2;
    var dy = (sh - dh) / 2;
    ctx.drawImage(this._bgImage, dx, dy, dw, dh);
  },

  _drawTextContent: function (ctx, sw, sh, cd) {
    var parts = this.data.displayParts;
    if (!parts || parts.length === 0) return;

    // 过期状态
    if (this.data.isExpired) {
      ctx.fillStyle = cd.textColor || '#ffffff';
      ctx.font = 'bold ' + Math.round(sh * 0.08) + 'px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // 半透明背景条
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      var bw = sw * 0.6, bh = sh * 0.12;
      ctx.fillRect((sw - bw) / 2, sh * 0.44, bw, bh);
      ctx.fillStyle = cd.textColor || '#ffffff';
      ctx.fillText('已过期', sw / 2, sh * 0.5);
      return;
    }

    // 计算字号
    var dayFontSize = Math.round(sh * 0.24);
    var segFontSize = Math.round(sh * 0.20);
    var unitFontSize = Math.round(sh * 0.05);
    var shadowBlur = cd.textShadowEnabled ? Math.round(dayFontSize * 0.08) : 0;

    // 测量总宽度
    var totalWidth = 0;
    var gap = dayFontSize * 0.28;
    var i;
    for (i = 0; i < parts.length; i++) {
      var isDay = (i === 0);
      var fs = isDay ? dayFontSize : segFontSize;
      ctx.font = 'bold ' + fs + 'px "PingFang SC", "Helvetica Neue", sans-serif';
      totalWidth += ctx.measureText(parts[i].value).width;
      // 单位
      ctx.font = unitFontSize + 'px "PingFang SC", sans-serif';
      totalWidth += ctx.measureText(parts[i].unit).width;
      if (i < parts.length - 1) totalWidth += gap;
    }

    // 如果太宽，等比缩小
    var maxW = sw * 0.88;
    var scale = 1;
    if (totalWidth > maxW) {
      scale = maxW / totalWidth;
      dayFontSize = Math.round(dayFontSize * scale);
      segFontSize = Math.round(segFontSize * scale);
      unitFontSize = Math.round(unitFontSize * scale);
      gap = dayFontSize * 0.28;
    }

    // 设置阴影
    if (shadowBlur > 0) {
      ctx.shadowColor = cd.textShadowColor || '#000000';
      ctx.shadowBlur = shadowBlur;
    }

    ctx.fillStyle = cd.textColor || '#ffffff';
    ctx.textBaseline = 'middle';

    // 逐段绘制
    // 重新计算实际总宽度（含缩放后的字号）
    var actualTotal = 0;
    for (i = 0; i < parts.length; i++) {
      var isDay2 = (i === 0);
      var fs2 = isDay2 ? dayFontSize : segFontSize;
      ctx.font = 'bold ' + fs2 + 'px "PingFang SC", "Helvetica Neue", sans-serif';
      actualTotal += ctx.measureText(parts[i].value).width;
      ctx.font = unitFontSize + 'px "PingFang SC", sans-serif';
      actualTotal += ctx.measureText(parts[i].unit).width;
      if (i < parts.length - 1) actualTotal += gap;
    }

    var x = (sw - actualTotal) / 2;
    var y = sh * 0.50;

    for (i = 0; i < parts.length; i++) {
      var isDay3 = (i === 0);
      var fs3 = isDay3 ? dayFontSize : segFontSize;

      // 绘制数字
      ctx.textAlign = 'left';
      ctx.font = 'bold ' + fs3 + 'px "PingFang SC", "Helvetica Neue", sans-serif';
      var numW = ctx.measureText(parts[i].value).width;
      ctx.fillText(parts[i].value, x, y);
      x += numW + gap * 0.3;

      // 绘制单位
      ctx.font = unitFontSize + 'px "PingFang SC", sans-serif';
      ctx.fillText(parts[i].unit, x, y + fs3 * 0.35);
      x += ctx.measureText(parts[i].unit).width + gap * 0.7;
    }

    // 清除阴影
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 绘制标题（上方）
    if (cd.showTitle) {
      var titleFontSize = Math.round(sh * 0.06);
      ctx.font = 'bold ' + titleFontSize + 'px "PingFang SC", sans-serif';
      ctx.fillStyle = cd.textColor || '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(cd.title, sw / 2, sh * 0.22);
    }

    // 绘制目标日期（底部）
    if (cd.showDate) {
      var dateFontSize = Math.round(sh * 0.04);
      ctx.font = dateFontSize + 'px "PingFang SC", sans-serif';
      ctx.fillStyle = cd.textColor || '#ffffff';
      ctx.globalAlpha = 0.6;
      ctx.textAlign = 'center';
      var dateStr = cd.targetDate.replace('T', ' ');
      ctx.fillText(dateStr, sw / 2, sh * 0.88);
      ctx.globalAlpha = 1;
    }
  },

  // ========== 图片加载 ==========

  _loadBgImage: function (src) {
    if (!src) return;
    var self = this;
    if (!self._canvas) return;
    var img = self._canvas.createImage();
    img.onload = function () {
      self._bgImage = img;
    };
    img.onerror = function () {
      wx.showToast({ title: '背景图加载失败', icon: 'none' });
      // 降级为内置渐变
      self.setData({ 'currentCountdown.bgType': 'builtin', 'currentCountdown.bgValue': 'gradient_deep' });
    };
    img.src = src;
  },

  // ========== 触摸：双击唤起设置 ==========

  touchEvent: function (e) {
    var self = this;
    if (e.type === 'touchstart') {
      if (self._tapTimer) {
        clearTimeout(self._tapTimer);
        self._tapTimer = null;
      }
      var now = Date.now();
      if (now - self._lastTapTime < 300) {
        self._lastTapTime = 0;
        if (self.data.showSettings) {
          self.closeSettings();
        } else {
          self.toggleSettings();
        }
      } else {
        self._tapTimer = setTimeout(function () {
          if (self.data.showSettings) self.closeSettings();
          self._tapTimer = null;
        }, 300);
      }
      self._lastTapTime = now;
    }
    if (e.type === 'touchend' || e.type === 'touchcancel') {
      if (self._tapTimer) {
        clearTimeout(self._tapTimer);
        self._tapTimer = null;
        if (self.data.showSettings) self.closeSettings();
      }
    }
  },

  // ========== 设置面板 ==========

  toggleSettings: function () {
    var cd = this.data.currentCountdown;
    this.setData({
      showSettings: true,
      isNewCountdown: false,
      draft: {
        title: cd.title,
        targetDate: cd.targetDate,
        precision: cd.precision,
        bgType: cd.bgType,
        bgValue: cd.bgValue,
        textColor: cd.textColor,
        textShadowEnabled: cd.textShadowEnabled,
        textShadowColor: cd.textShadowColor,
        showTitle: cd.showTitle,
        showDate: cd.showDate,
        screenDirection: cd.screenDirection || 'portrait'
      }
    }, function () {
      this._syncPickerFromTarget(cd.targetDate);
    });
  },

  closeSettings: function () {
    // 新建模式：丢弃草稿直接关闭；编辑模式：保存后关闭
    if (this.data.isNewCountdown) {
      this.setData({ showSettings: false, isNewCountdown: false });
      return;
    }
    this._saveCurrentDraft();
  },

  /** 编辑模式关闭：持久化当前状态 */
  _saveCurrentDraft: function () {
    // 将 currentCountdown 同步到 countdowns 数组并存储
    var list = this.data.countdowns.slice();
    list[this.data.currentIndex] = this.data.currentCountdown;
    this.setData({ showSettings: false, countdowns: list });
    try { wx.setStorageSync(STORAGE_KEY, list); } catch (e) { /* ignore */ }
  },

  /** 新建模式：点「添加」保存 */
  onSaveNewCountdown: function () {
    var draft = this.data.draft;
    var newCd = {
      id: uuid(),
      title: draft.title || '新倒计时',
      targetDate: this._pickerToTarget(),
      precision: draft.precision || 'seconds',
      bgType: draft.bgType || 'builtin',
      bgValue: draft.bgValue || 'gradient_deep',
      textColor: draft.textColor || '#ffffff',
      textShadowEnabled: draft.textShadowEnabled !== false,
      textShadowColor: draft.textShadowColor || '#000000',
      showTitle: draft.showTitle !== false,
      showDate: draft.showDate !== false,
      screenDirection: draft.screenDirection || 'portrait'
    };
    var list = this.data.countdowns.concat([newCd]);
    var idx = list.length - 1;
    this.setData({
      showSettings: false,
      countdowns: list,
      currentIndex: idx,
      currentCountdown: newCd,
      isNewCountdown: false
    }, function () {
      this._updateCanvasSize();
      if (newCd.bgType === 'image' && newCd.bgValue) {
        this._loadBgImage(newCd.bgValue);
      } else {
        this._bgImage = null;
      }
      this._updateDisplay();
    });
    try { wx.setStorageSync(STORAGE_KEY, this.data.countdowns); } catch (e) { /* ignore */ }
  },

  /** 新建模式：点「取消」丢弃 */
  onCancelNewCountdown: function () {
    this.setData({ showSettings: false, isNewCountdown: false });
  },

  // ========== 切换倒计时 ==========

  _updateSwitchActions: function () {
    var list = this.data.countdowns;
    var actions = list.map(function (cd, i) {
      return {
        name: cd.title,
        subname: cd.targetDate ? cd.targetDate.replace('T', ' ') : '',
        index: i
      };
    });
    this.setData({ switchSheetActions: actions });
  },

  onOpenSwitchSheet: function () {
    this._updateSwitchActions();
    this.setData({ showSwitchSheet: true });
  },

  onSwitchSheetClose: function () {
    this.setData({ showSwitchSheet: false });
  },

  onSwitchSheetCancel: function () {
    this.setData({ showSwitchSheet: false });
  },

  onSwitchSheetSelect: function (e) {
    var item = e.detail;
    if (!item) return;
    var index = item.index;
    if (index === undefined || index === null) return;
    if (index === this.data.currentIndex) {
      this.setData({ showSwitchSheet: false });
      return;
    }
    var cd = this.data.countdowns[index];
    if (!cd) return;
    this.setData({
      showSwitchSheet: false,
      currentIndex: index,
      currentCountdown: cd
    }, function () {
      this._syncPickerFromTarget(cd.targetDate);
      this._updateCanvasSize();
      if (cd.bgType === 'image' && cd.bgValue) {
        this._loadBgImage(cd.bgValue);
      } else {
        this._bgImage = null;
      }
      this._updateDisplay();
    });
  },

  // ========== 新建倒计时 ==========

  onAddCountdown: function () {
    this.setData({
      showSettings: true,
      isNewCountdown: true,
      draft: {
        title: '',
        targetDate: '',
        precision: 'seconds',
        bgType: 'builtin',
        bgValue: 'gradient_deep',
        textColor: '#ffffff',
        textShadowEnabled: true,
        textShadowColor: '#000000',
        showTitle: true,
        showDate: true,
        screenDirection: 'portrait'
      }
    }, function () {
      // 默认目标：下个月今天
      var now = new Date();
      var nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      this._syncPickerFromTarget(
        nextMonth.getFullYear() + '-' +
        pad(nextMonth.getMonth() + 1) + '-' +
        pad(nextMonth.getDate()) + 'T00:00:00'
      );
    });
  },

  // ========== 删除倒计时 ==========

  onDeleteCountdown: function () {
    var self = this;
    if (self.data.isNewCountdown) {
      // 新建模式，直接关掉
      self.setData({ showSettings: false, isNewCountdown: false });
      return;
    }
    if (self.data.countdowns.length <= 1) {
      wx.showToast({ title: '至少保留一个倒计时', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '删除确认',
      content: '确定删除「' + (self.data.currentCountdown.title || '') + '」吗？',
      confirmColor: '#ff4757',
      success: function (res) {
        if (res.confirm) {
          var list = self.data.countdowns.slice();
          list.splice(self.data.currentIndex, 1);
          var newIdx = Math.min(self.data.currentIndex, list.length - 1);
          self.setData({
            showSettings: false,
            countdowns: list,
            currentIndex: newIdx,
            currentCountdown: list[newIdx]
          }, function () {
            self._updateCanvasSize();
            self._updateDisplay();
            try { wx.setStorageSync(STORAGE_KEY, list); } catch (e) { /* ignore */ }
          });
        }
      }
    });
  },

  // ========== 设置项变更处理（编辑模式即时生效，新建模式仅写 draft） ==========

  /** 同时更新 draft 和 currentCountdown（编辑模式即时预览） */
  _applySetting: function (draftKey, value, cdKey, cdValue) {
    var update = {};
    update['draft.' + draftKey] = value;
    if (!this.data.isNewCountdown && cdKey) {
      update['currentCountdown.' + cdKey] = cdValue !== undefined ? cdValue : value;
    }
    this.setData(update);
  },

  onTitleChange: function (e) {
    var val = e.detail.value || e.detail || '';
    this._applySetting('title', val, 'title', val);
  },

  onDateChange: function (e) {
    var val = e.detail.value;
    var full = val + 'T' + (this.data.pickerTime || '00:00') + ':00';
    this.setData({ pickerDate: val, 'draft.targetDate': full });
    if (!this.data.isNewCountdown) {
      this.setData({ 'currentCountdown.targetDate': full });
      this._updateDisplay();
    }
  },

  onTimeChange: function (e) {
    var val = e.detail.value;
    var full = (this.data.pickerDate || '') + 'T' + val + ':00';
    this.setData({ pickerTime: val, 'draft.targetDate': full });
    if (!this.data.isNewCountdown) {
      this.setData({ 'currentCountdown.targetDate': full });
      this._updateDisplay();
    }
  },

  onPrecisionChange: function (e) {
    var key = e.currentTarget.dataset.key;
    if (key) {
      this._applySetting('precision', key, 'precision', key);
      if (!this.data.isNewCountdown) this._updateDisplay();
    }
  },

  onTextColorChange: function (e) {
    var color = e.detail.colorList[0];
    this._applySetting('textColor', color, 'textColor', color);
  },

  onShadowToggle: function (e) {
    this._applySetting('textShadowEnabled', e.detail, 'textShadowEnabled', e.detail);
  },

  onShadowColorChange: function (e) {
    var color = e.detail.colorList[0];
    this._applySetting('textShadowColor', color, 'textShadowColor', color);
  },

  onShowTitleToggle: function (e) {
    this._applySetting('showTitle', e.detail, 'showTitle', e.detail);
  },

  onShowDateToggle: function (e) {
    this._applySetting('showDate', e.detail, 'showDate', e.detail);
  },

  onDirectionChange: function (e) {
    var direction = e.currentTarget.dataset.direction;
    if (direction) {
      this._applySetting('screenDirection', direction, 'screenDirection', direction);
      if (!this.data.isNewCountdown) this._updateCanvasSize();
    }
  },

  onBgTypeChange: function (e) {
    var type = e.currentTarget.dataset.type;
    if (!type) return;
    this._applySetting('bgType', type, 'bgType', type);
    if (type === 'builtin') {
      var bgKey = this.data.draft.bgValue || 'gradient_deep';
      if (!this.data.isNewCountdown) {
        this.setData({ 'currentCountdown.bgValue': bgKey });
        this._bgImage = null;
      }
    }
    if (type !== 'image') { this._bgImage = null; }
  },

  onSelectBuiltinBg: function (e) {
    var key = e.currentTarget.dataset.key;
    if (key) {
      this._applySetting('bgValue', key, 'bgValue', key);
      this._bgImage = null;
    }
  },

  onSelectBgImage: function () {
    var self = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: function (res) {
        var path = res.tempFiles[0].tempFilePath;
        self.setData({ 'draft.bgValue': path, 'draft.bgType': 'image' });
        if (!self.data.isNewCountdown) {
          self.setData({ 'currentCountdown.bgValue': path, 'currentCountdown.bgType': 'image' });
          self._loadBgImage(path);
        }
      },
      fail: function (err) {
        if (err && err.errMsg && err.errMsg.indexOf('cancel') === -1) {
          wx.showToast({ title: '选图失败', icon: 'none' });
        }
      }
    });
  },

  onSelectBgVideo: function () {
    var self = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      success: function (res) {
        var path = res.tempFiles[0].tempFilePath;
        self.setData({ 'draft.bgValue': path, 'draft.bgType': 'video' });
        if (!self.data.isNewCountdown) {
          self.setData({ 'currentCountdown.bgValue': path, 'currentCountdown.bgType': 'video' });
        }
      },
      fail: function (err) {
        if (err && err.errMsg && err.errMsg.indexOf('cancel') === -1) {
          wx.showToast({ title: '选视频失败', icon: 'none' });
        }
      }
    });
  },

  // ========== 导出 ==========

  onExport: function () {
    if (this.data.isExporting) return;
    var self = this;
    this.setData({ isExporting: true, exportProgress: 0, exportTotal: 1 });

    var cd = this.data.currentCountdown;
    var isLandscape = cd.screenDirection === 'landscape';
    var sw = isLandscape ? this._screenH : this._screenW;
    var sh = isLandscape ? this._screenW : this._screenH;
    var exportW = Math.round(sw * 3);
    var exportH = Math.round(sh * 3);

    var offCanvas = wx.createOffscreenCanvas({ type: '2d', width: exportW, height: exportH });
    var ctx = offCanvas.getContext('2d');
    var scale = exportW / sw;
    ctx.scale(scale, scale);

    // 绘制背景（视频背景用降级方案）
    if (cd.bgType === 'video') {
      this._drawBuiltinBg(ctx, sw, sh, 'gradient_deep');
    } else if (cd.bgType === 'image' && this._bgImage) {
      this._drawImageBg(ctx, sw, sh);
    } else {
      this._drawBuiltinBg(ctx, sw, sh, cd.bgValue);
    }

    // 绘制文字（用同样的 drawTextContent）
    this._drawTextContent(ctx, sw, sh, cd);

    // 导出
    var dataUrl = offCanvas.toDataURL('image/png');
    var base64 = dataUrl.split(',')[1];
    var tempPath = wx.env.USER_DATA_PATH + '/countdown_export.png';
    var fs = wx.getFileSystemManager();
    fs.writeFileSync(tempPath, base64, 'base64');

    var app = getApp();
    app.checkPhotoAlbumAuth(function () {
      wx.saveImageToPhotosAlbum({
        filePath: tempPath,
        success: function () {
          self.setData({ isExporting: false });
          wx.showToast({ title: '已保存到相册', icon: 'success' });
        },
        fail: function (err) {
          self.setData({ isExporting: false });
          wx.showToast({ title: '导出失败，请重试', icon: 'none' });
        }
      });
    });
  },

  // ========== 辅助 ==========

  /** 从 targetDate 字符串同步 pickerDate / pickerTime */
  _syncPickerFromTarget: function (targetDate) {
    if (!targetDate) return;
    var parts = targetDate.split('T');
    this.setData({
      pickerDate: parts[0] || '',
      pickerTime: parts[1] ? parts[1].substring(0, 5) : '00:00'
    });
  },

  /** 从 pickerDate + pickerTime 合成 targetDate 字符串 */
  _pickerToTarget: function () {
    return (this.data.pickerDate || '') + 'T' + (this.data.pickerTime || '00:00') + ':00';
  },

  /** 设置 Canvas CSS 尺寸（始终用长边填满正方形，靠 stage overflow 裁切） */
  _updateCanvasSize: function () {
    var maxDim = Math.max(this._screenW, this._screenH);
    this.setData({
      canvasWidth: maxDim,
      canvasHeight: maxDim
    });
  }
});
