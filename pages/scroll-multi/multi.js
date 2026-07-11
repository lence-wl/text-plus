/**
 * 多行滚动 — requestAnimationFrame 驱动
 */

var STORAGE_KEY = 'scroll_multi_config';
var HISTORY_KEY = 'scroll_multi_text_history';
var MAX_HISTORY = 20;
const adManager = require("../../utils/adManager.js");
const api = require("../../utils/api.js");
const fontLoader = require("../../utils/fontLoader.js");

var DEFAULT_CONFIG = {
  bgColor: '#1a1a2e',
  scrollSpeed: 3,
  fontSize: 30,
  textColor: '#ffffff',
  glowEnabled: true,
  textAlign: 'center',
  glowBlur: 12,
  glowColor: '#ff66ff',
  screenDirection: 'portrait',
  fontFamily: ''
};

Page({
  data: {
    showSettings: false,
    showFontSheet: false,
    fontList: [],
    _previewVersion: 0,
    activeTab: 'content',
    scrollY: 9999,  // 初始在屏幕外，避免闪烁
    rawText: '开始懂了-孙燕姿\n\n我竟然没有调头\n最残忍那一刻\n静静看你走\n一点都不像我\n原来人会变得温柔\n是透彻的懂了\n爱情是流动的 不由人的\n何必激动着要理由\n相信你只是怕伤害我\n不是骗我\n很爱过谁会舍得\n把我的梦摇醒了\n宣布幸福不会来了\n用心酸微笑去原谅了\n也翻越了\n有昨天还是好的\n但明天是自己的\n开始懂了\n快乐是选择\n\n我竟然没有调头\n最残忍那一刻\n静静看你走\n一点都不像我\n原来人会变得温柔\n是透彻的懂了\n爱情是流动的 不由人的\n何必激动着要理由\n相信你只是怕伤害我\n不是骗我\n很爱过谁会舍得\n把我的梦摇醒了\n宣布幸福不会来了\n用心酸微笑去原谅了\n也翻越了\n有昨天还是好的\n但明天是自己的\n开始懂了\n快乐是选择',
    config: { ...DEFAULT_CONFIG },
    fontStyle: '',
    showHistorySheet: false,
    historyList: []
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

  onLoad: function (options) {
    // 解析分享配置（完整 JSON，优先于本地存储）
    if (options && options.cfg) {
      try {
        var shared = JSON.parse(decodeURIComponent(options.cfg));
        if (shared.config) {
          var sharedFont = shared.config.fontFamily || '';
          this.setData({ config: Object.assign({}, DEFAULT_CONFIG, shared.config), fontStyle: sharedFont ? 'font-family: "' + sharedFont + '";' : '' });
        }
        if (shared.rawText) {
          this.setData({ rawText: shared.rawText });
        }
        // 加载分享的字体
        var shareFont = shared.config && shared.config.fontFamily;
        if (shareFont) {
          var shareText = (shared.rawText || this.data.rawText || '').replace(/\n/g, '');
          this._loadShareFont = true;
        }
        // 分享时也拉取字体列表
        var shareSelf = this;
        fontLoader.getFontList().then(function (list) {
          shareSelf.setData({ fontList: list });
        });
        return; // 分享配置优先，跳过本地存储
      } catch (e) {
        console.error('[scroll-multi] Failed to parse shared config:', e);
      }
    }

    // 获取字体列表
    var self = this;
    fontLoader.getFontList().then(function (list) {
      self.setData({ fontList: list });
    });

    // 回退到本地存储
    try {
      var saved = wx.getStorageSync(STORAGE_KEY);
      if (saved && typeof saved === 'object') {
        var fontName = saved.fontFamily || '';
        this.setData({ config: Object.assign({}, DEFAULT_CONFIG, saved), fontStyle: fontName ? 'font-family: "' + fontName + '";' : '' });
      }
    } catch (e) { /* ignore */ }
  },

  onReady: function () {
    var self = this;
    // 分享打开时加载字体
    if (self._loadShareFont) {
      var sharedFont = self.data.config.fontFamily;
      var sharedText = (self.data.rawText || '').replace(/\n/g, '');
      if (sharedFont && sharedText) {
        fontLoader.loadFont(sharedFont, sharedText, function (ok) {
          if (ok) self.setData({ fontStyle: 'font-family: "' + sharedFont + '";' });
        });
      }
    }
    this._initTimer = setTimeout(function () {
      self._initTimer = null;
      self._measureAndStart();
    }, 500);

    // 初始化插屏广告（5秒后展示）
    adManager.initInterstitial('adunit-cfc3c31d23b35363');
    self._adTimer = setTimeout(function () {
      self._adTimer = null;
      adManager.showInterstitial('adunit-cfc3c31d23b35363');
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
    this._stopScroll();
    try { wx.setStorageSync(STORAGE_KEY, this.data.config); } catch (e) { /* ignore */ }
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

  // ========== 分享 ==========

  onShareAppMessage: function () {
    var shareData = {
      config: this.data.config,
      rawText: this.data.rawText
    };
    var cfg = encodeURIComponent(JSON.stringify(shareData));
    var title = (this.data.rawText || '').substring(0, 20);
    return {
      title: '多行文字滚动·弹幕生成器 — ' + (title || '文字特效工具'),
      path: '/pages/scroll-multi/multi?cfg=' + cfg
    };
  },

  onShareTimeline: function () {
    var shareData = {
      config: this.data.config,
      rawText: this.data.rawText
    };
    var cfg = encodeURIComponent(JSON.stringify(shareData));
    var title = (this.data.rawText || '').substring(0, 20);
    return {
      title: '多行文字滚动·弹幕生成器 — ' + (title || '文字特效'),
      query: 'cfg=' + cfg
    };
  },

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
    // 关闭设置面板时30%概率展示插屏广告
    adManager.showInterstitial('adunit-cfc3c31d23b35363');

    // 上报内容日志（内容为空时不上报）
    var rawText = this.data.rawText || '';
    if (rawText.trim()) {
      var c = this.data.config;
      api.logEvent('scroll-multi', 'settings', {
        fontSize: c.fontSize,
        textColor: c.textColor,
        bgColor: c.bgColor,
        scrollSpeed: c.scrollSpeed,
        textAlign: c.textAlign,
        glowEnabled: c.glowEnabled,
        glowBlur: c.glowBlur,
        glowColor: c.glowColor,
        screenDirection: c.screenDirection,
        textLength: rawText.length,
        content: rawText
      });
    }
  },

  

  onFontSelect: function (e) {
    var fontName = e.currentTarget.dataset.font || '';
    this.setData({ "config.fontFamily": fontName });
    if (fontName) {
      var self = this;
      // 全文去重去换行（最多50字），确保所有文字都有字体效果
      var subsetText = (self.data.rawText || '').replace(/\n/g, '');
      fontLoader.loadFont(fontName, subsetText, function (ok) {
        // 字体加载完再设 fontStyle，确保 WXML 渲染时字体已注册
        self.setData({ fontStyle: ok ? 'font-family: "' + fontName + '";' : '' });
        self._remeasure();
      });
    } else {
      this.setData({ fontStyle: '' });
      this._remeasure();
    }
  },
  onTabChange: function (e) {
    var tab = e.currentTarget.dataset.tab;
    if (!tab) return;
    this.setData({ activeTab: tab });
    if (tab === 'font' && this.data.fontList.length > 0) {
      var self = this;
      fontLoader.loadPreviewFonts(this.data.fontList, function (count) {
        self.setData({ _previewVersion: count });
      });
    }
  },

  // ========== 文本输入 ==========

  onTextBlur: function (e) {
    var text = e.detail.value || '';
    if (text.length > 1000) {
      text = text.slice(0, 1000);
      wx.showToast({ title: '最多1000字', icon: 'none' });
    }
    this.setData({ rawText: text }, this._remeasure);
    if (text && text.trim()) this._saveHistory(text);
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
  },

  // ========== 清空 & 历史 ==========

  onClearText: function () {
    var self = this;
    wx.showModal({
      title: '确认清空',
      content: '确定要清空全部文字内容吗？',
      success: function (res) {
        if (res.confirm) {
          self.setData({ rawText: '' }, self._remeasure);
        }
      }
    });
  },

  _loadHistory: function () {
    try {
      var list = wx.getStorageSync(HISTORY_KEY);
      return (list && Array.isArray(list)) ? list : [];
    } catch (e) { return []; }
  },

  _saveHistory: function (text) {
    if (!text || !text.trim()) return;
    var list = this._loadHistory();
    // 去重：相同的移除旧的
    list = list.filter(function (item) { return item.text !== text; });
    list.unshift({ text: text, time: Date.now() });
    if (list.length > MAX_HISTORY) list = list.slice(0, MAX_HISTORY);
    try { wx.setStorageSync(HISTORY_KEY, list); } catch (e) { /* ignore */ }
  },

  _saveCurrentToHistory: function () {
    this._saveHistory(this.data.rawText);
  },

  onShowHistory: function () {
    var list = this._loadHistory();
    if (list.length === 0) {
      wx.showToast({ title: '暂无历史记录', icon: 'none' });
      return;
    }
    list = list.map(function (item) {
      return { text: item.text, time: item.time, displayText: item.text.replace(/\n/g, ' ') };
    });
    this.setData({ showHistorySheet: true, historyList: list });
  },

  onHistoryClose: function () {
    this.setData({ showHistorySheet: false });
  },

  onHistorySelect: function (e) {
    var index = e.currentTarget.dataset.index;
    var item = this.data.historyList[index];
    if (item) {
      this.setData({ rawText: item.text, showHistorySheet: false }, this._remeasure);
    }
  },

  onHistoryDelete: function (e) {
    var index = e.currentTarget.dataset.index;
    var list = this._loadHistory();
    list.splice(index, 1);
    try { wx.setStorageSync(HISTORY_KEY, list); } catch (e) { /* ignore */ }
    if (list.length === 0) {
      this.setData({ showHistorySheet: false });
      wx.showToast({ title: '已清空历史', icon: 'none' });
    } else {
      list = list.map(function (item) {
        return { text: item.text, time: item.time, displayText: item.text.replace(/\n/g, ' ') };
      });
      this.setData({ historyList: list });
    }
  }
});
