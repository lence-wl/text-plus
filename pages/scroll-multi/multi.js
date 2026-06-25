/**
 * 多行滚动 — requestAnimationFrame 驱动
 */

var STORAGE_KEY = 'scroll_multi_config';

var DEFAULT_CONFIG = {
  bgColor: '#1a1a2e',
  scrollSpeed: 3,
  fontSize: 30,
  textColor: '#ffffff',
  glowEnabled: true,
  textAlign: 'center',
  glowBlur: 12,
  glowColor: '#ff66ff',
  screenDirection: 'portrait'
};

Page({
  data: {
    showSettings: false,
    activeTab: 'content',
    scrollY: 9999,  // 初始在屏幕外，避免闪烁
    rawText: '开始懂了-孙燕姿\n\n我竟然没有调头\n最残忍那一刻\n静静看你走\n一点都不像我\n原来人会变得温柔\n是透彻的懂了\n爱情是流动的 不由人的\n何必激动着要理由\n相信你只是怕伤害我\n不是骗我\n很爱过谁会舍得\n把我的梦摇醒了\n宣布幸福不会来了\n用心酸微笑去原谅了\n也翻越了\n有昨天还是好的\n但明天是自己的\n开始懂了\n快乐是选择',
    config: { ...DEFAULT_CONFIG }
  },

  _screenH: 0,
  _blockHeight: 0,
  _animId: null,
  _lastTs: 0,
  _scrollY: 0,
  _scrollActive: false,

  // 双击检测
  _lastTapTime: 0,
  _tapTimer: null,
  _initTimer: null,

  onLoad: function () {
    try {
      var saved = wx.getStorageSync(STORAGE_KEY);
      if (saved && typeof saved === 'object') {
        this.setData({ config: { ...DEFAULT_CONFIG, ...saved } });
      }
    } catch (e) { /* ignore */ }
    this._initInterstitialAd();
  },

  onShow: function () {
    if (this._interstitialAd) {
      this._interstitialAd.show().catch(() => {});
    }
  },

  onReady: function () {
    var self = this;
    this._initTimer = setTimeout(function () {
      self._initTimer = null;
      self._measureAndStart();
    }, 500);
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
    this._stopScroll();
    try { wx.setStorageSync(STORAGE_KEY, this.data.config); } catch (e) { /* ignore */ }
  },

  // ========== 广告 ==========

  _initInterstitialAd: function () {
    if (wx.createInterstitialAd) {
      this._interstitialAd = wx.createInterstitialAd({
        adUnitId: 'adunit-cfc3c31d23b35363'
      });
      this._interstitialAd.onLoad(() => {
        console.log('[多行滚动插屏广告] 加载成功');
      });
      this._interstitialAd.onError((err) => {
        console.error('[多行滚动插屏广告] 加载失败', err);
      });
      this._interstitialAd.onClose(() => {
        if (this._interstitialAd) {
          this._interstitialAd.load().catch(() => {});
        }
      });
      this._interstitialAd.load();
    }
  },

  // ========== 滚动核心：rAF + 直接 transform ==========

  _measureAndStart: function () {
    var self = this;
    var info = wx.getSystemInfoSync();
    var isLandscape = self.data.config.screenDirection === 'landscape';
    self._screenH = isLandscape ? info.screenWidth : info.screenHeight;

    var query = wx.createSelectorQuery();
    query.select('.scroll-block').boundingClientRect(function (rect) {
      if (!rect) { self._blockHeight = 400; return; }
      // 横屏时 scroll-stage 旋转了90度，滚动方向沿视觉宽度
      self._blockHeight = isLandscape ? (rect.width > 0 ? rect.width : 400) : (rect.height > 0 ? rect.height : 400);

      if (self._blockHeight <= self._screenH) {
        // 内容不够一屏：居中
        self._scrollY = (self._screenH - self._blockHeight) / 2;
        self.setData({ scrollY: self._scrollY });
      } else {
        // 内容超过一屏：从屏幕底部开始向上滚动
        self._scrollY = self._screenH;
        self.setData({ scrollY: self._scrollY });
        self._startLoop();
      }
    }).exec();
  },

  _startLoop: function () {
    var self = this;
    self._scrollActive = true;
    var lastTs = Date.now();

    function tick() {
      if (!self._scrollActive) return;

      var now = Date.now();
      var dt = (now - lastTs) / 1000;
      if (dt > 0.1) dt = 0.016;
      lastTs = now;

      self._animId = setTimeout(tick, 16);

      var speed = (self.data.config.scrollSpeed || 3) * 60;
      self._scrollY -= speed * dt;

      var blockH = self._blockHeight;
      var screenH = self._screenH;
      if (self._scrollY <= -blockH) {
        self._scrollY = screenH;
      }

      var y = Math.round(self._scrollY);
      if (y !== self.data.scrollY) {
        self.setData({ scrollY: y });
      }
    }

    self._animId = setTimeout(tick, 16);
  },

  _stopScroll: function () {
    this._scrollActive = false;
    if (this._animId) {
      clearTimeout(this._animId);
      this._animId = null;
    }
  },

  _remeasure: function () {
    this._stopScroll();
    var self = this;
    // 延迟 500ms 确保 CSS 旋转/重排完成后再测量
    setTimeout(function () { self._measureAndStart(); }, 500);
  },

  // ========== 导航 ==========

  onBack: function () { wx.navigateBack(); },

  // ========== 双击打开/关闭设置面板 ==========

  touchEvent: function (e) {
    if (e.type === 'touchstart') {
      if (this._tapTimer) {
        clearTimeout(this._tapTimer);
        this._tapTimer = null;
      }
      var now = Date.now();
      if (now - this._lastTapTime < 300) {
        this._lastTapTime = 0;
        if (this.data.showSettings) {
          this.closeSettings();
        } else {
          this.setData({ showSettings: true, activeTab: 'content' });
        }
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
        if (this.data.showSettings) self.closeSettings();
      }
    }
  },

  closeSettings: function () {
    this.setData({ showSettings: false });
    try { wx.setStorageSync(STORAGE_KEY, this.data.config); } catch (e) { /* ignore */ }
  },

  onTabChange: function (e) {
    var tab = e.currentTarget.dataset.tab;
    if (tab) this.setData({ activeTab: tab });
  },

  // ========== 文本输入 ==========

  onTextBlur: function (e) {
    var text = e.detail.value || '';
    if (text.length > 1000) {
      text = text.slice(0, 1000);
      wx.showToast({ title: '最多1000字', icon: 'none' });
    }
    this.setData({ rawText: text }, this._remeasure);
  },

  // ========== 样式设置 ==========

  onScrollSpeedChange: function (e) { this.setData({ 'config.scrollSpeed': e.detail }); },

  onFontSizeChange: function (e) {
    this.setData({ 'config.fontSize': e.detail });
    var self = this;
    setTimeout(function () {
      var query = wx.createSelectorQuery();
      query.select('.scroll-block').boundingClientRect(function (rect) {
        if (rect && rect.height > 0) self._blockHeight = rect.height;
      }).exec();
    }, 400);
  },

  // ========== 颜色设置（ColorPicker 回调） ==========

  handleTextColorChange: function (e) {
    var colorList = e.detail.colorList;
    if (colorList && colorList.length > 0) {
      this.setData({ 'config.textColor': colorList[0] });
    }
  },

  handleBgColorChange: function (e) {
    var colorList = e.detail.colorList;
    if (colorList && colorList.length > 0) {
      this.setData({ 'config.bgColor': colorList[0] });
    }
  },

  handleGlowColorChange: function (e) {
    var colorList = e.detail.colorList;
    if (colorList && colorList.length > 0) {
      this.setData({ 'config.glowColor': colorList[0] });
    }
  },

  onTextAlignChange: function (e) {
    var align = e.currentTarget.dataset.align;
    if (align) this.setData({ 'config.textAlign': align });
  },

  // ========== 发光设置 ==========

  onGlowEnabledChange: function (e) { this.setData({ 'config.glowEnabled': e.detail }); },
  onGlowBlurChange: function (e) { this.setData({ 'config.glowBlur': e.detail }); },

  // ========== 屏幕方向 ==========

  onDirectionChange: function (e) {
    var direction = e.currentTarget.dataset.direction;
    if (!direction) return;
    this.setData({ 'config.screenDirection': direction }, this._remeasure);
  }
});
