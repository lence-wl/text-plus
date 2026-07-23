/**
 * Canvas 2D 中文文字横排滚动 + 特效模块化架构
 * 双击 canvas 打开/关闭设置面板
 */

const effectManager = require("./effects/index.js");
const configStore = require("../../utils/configStore.js");
const { checkTextSecurity } = require("../../utils/security.js");
const { createRenderer } = require("./renderer.js");
const textMeasurer = require("./textMeasurer.js");

const api = require("../../utils/api.js");
const fontLoader = require("../../utils/fontLoader.js");

const HISTORY_KEY = 'single_text_history';
const MAX_HISTORY = 20;

const sysInfo = wx.getSystemInfoSync();

Page({
  data: {
    canvasReady: false,
    showSettings: false,
    showEffectSheet: false,
    showGradientSheet: false,
    gradientOptions: [
      { text: '垂直渐变', value: 0 },
      { text: '水平渐变', value: 1 }
    ],
    rainbowGradientTypeLabel: '垂直渐变',
    activeTab: 'content',
    currentEffectName: '彩虹',
    effectOptions: effectManager.getEffectOptions(),
    currentSettings: [],
    showHistorySheet: false,
    historyList: [],
    config: {
      currentEffect: "applyRainbowEffect",
      effectMode: 'rainbow',
      text: '双击修改文字',
      fontSize: 220,
      letterSpacing: 10,
      bgColor: '#1a1a2e',
      scrollSpeed: 8,
      fontWeight: 'normal',
      vertical: true,
      fontFamily: '',
      mirrorEnabled: false,
      ...effectManager.getDefaultConfig()
    },
    fontList: [],
    fontLangTab: 'zh',
    showFontSheet: false,
    _previewVersion: 0
  },

  // Canvas 2D 渲染器
  ctxRenderer: null,

  // 当前特效实例（基于 BaseEffect）
  currentEffect: null,

  animationId: null,
  _lastTapTime: 0,
  _tapTimer: null,

  // 缓存
  _cachedConfig: null,
  _cachedTextLength: 0,
  _cycleWidth: 0,
  _scrollBaseX: 0,

  // ========== 生命周期 ==========

  onLoad: function (options) {
    var savedConfig = configStore.load();
    savedConfig.vertical = true;  // 竖排模式

    // 解析分享配置（新格式：完整 JSON）
    if (options && options.cfg) {
      try {
        var sharedConfig = JSON.parse(decodeURIComponent(options.cfg));
        for (var key in sharedConfig) {
          if (sharedConfig.hasOwnProperty(key)) {
            savedConfig[key] = sharedConfig[key];
          }
        }
      } catch (e) {
        console.error('[single-text] Failed to parse shared config:', e);
      }
    }

    // 向后兼容：单独的 text/effect 参数（旧版分享链接）
    if (options && options.text) {
      savedConfig.text = decodeURIComponent(options.text);
    }
    if (options && options.effect) {
      savedConfig.effectMode = options.effect;
    }

    // 分享打开时标记需要加载字体（在 onReady 中执行）
    if (options && options.cfg && savedConfig.fontFamily) {
      this._shareFontNeedsLoad = true;
    }

    // 根据 effectMode 推导 currentEffect
    var effectMap = {
      'rainbow': 'applyRainbowEffect',
      'neon': 'applyNeonEffect',
      'glitch': 'applyGlitchEffect',
      'wave': 'applyWaveEffect',
      'colorCycle': 'applyColorCycleEffect',
      'scalePulse': 'applyScalePulseEffect',
      'glow': 'applyGlowEffect'
    };
    savedConfig.currentEffect = effectMap[savedConfig.effectMode] || savedConfig.currentEffect || 'applyRainbowEffect';

    var gradientLabel = savedConfig.rainbowGradientType === 1 ? '水平渐变' : '垂直渐变';
    this.setData({ config: savedConfig, rainbowGradientTypeLabel: gradientLabel }, function () {
      this._updateCurrentSettings();
    });

    // 获取字体列表
    var self = this;
    fontLoader.getFontList().then(function (list) {
      self.setData({ fontList: list });
    });
  },

  onReady: async function () {
    await new Promise(resolve => wx.nextTick(resolve));
    await new Promise(resolve => setTimeout(resolve, 100));
    this.initCanvas2D();

    // 分享打开时加载字体（延迟确保 canvas 已就绪）
    if (this._shareFontNeedsLoad) {
      var self2 = this;
      var shareFont = this.data.config.fontFamily;
      var shareText = this.data.config.text;
      if (shareFont && shareText) {
        setTimeout(function () {
          fontLoader.loadFont(shareFont, shareText, function (ok) {
            if (ok) self2._recreateText();
          });
        }, 500);
      }
    }
  },

  onHide: function () {
    // 页面隐藏时不做特殊处理，onShow 会重新启动动画
  },

  onShow: function () {
    if (!this.animationId && this.ctxRenderer && this.canvas) {
      this.animate();
    }
  },

  onUnload: function () {
    if (this.animationId && this.canvas && this.canvas.cancelAnimationFrame) {
      this.canvas.cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this._destroyEffect();
    if (this.ctxRenderer && typeof this.ctxRenderer.destroy === 'function') {
      this.ctxRenderer.destroy();
      this.ctxRenderer = null;
    }
    this.canvas = null;
  },

  // ========== 分享 ==========

  onShareAppMessage: function () {
    var c = this.data.config;
    var shareConfig = {};
    for (var key in c) {
      if (c.hasOwnProperty(key) && key !== 'currentEffect') {
        shareConfig[key] = c[key];
      }
    }
    var cfg = encodeURIComponent(JSON.stringify(shareConfig));
    return {
      title: '单行文字滚动·LED弹幕 — ' + (c.text || '文字特效工具'),
      path: '/pages/single-text/single-text?cfg=' + cfg
    };
  },

  onShareTimeline: function () {
    var c = this.data.config;
    var shareConfig = {};
    for (var key in c) {
      if (c.hasOwnProperty(key) && key !== 'currentEffect') {
        shareConfig[key] = c[key];
      }
    }
    var cfg = encodeURIComponent(JSON.stringify(shareConfig));
    return {
      title: '单行文字滚动·LED弹幕 — ' + (c.text || '文字特效工具'),
      query: 'cfg=' + cfg
    };
  },

	// ========== 原生模板广告 ==========

	adLoad: function () {
		console.log('[原生模板广告] 加载成功');
	},
	adError: function (err) {
		console.error('[原生模板广告] 加载失败', err);
	},
	adClose: function () {
		console.log('[原生模板广告] 关闭');
	},

	// ========== 导航 ==========

  onBack: function () {
    wx.navigateBack();
  },

  // ========== 触摸事件 ==========

  touchEvent: function (e) {
    if (e.type === 'touchstart') {
      if (this._tapTimer) {
        clearTimeout(this._tapTimer);
        this._tapTimer = null;
      }

      const now = Date.now();
      if (now - this._lastTapTime < 300) {
        this._lastTapTime = 0;
        if (this.data.showSettings) {
          this.closeSettings();
        } else {
          this.toggleSettings();
        }
      } else {
        this._tapTimer = setTimeout(() => {
          if (this.data.showSettings) {
            this.closeSettings();
          }
          this._tapTimer = null;
        }, 300);
      }
      this._lastTapTime = now;
    }

    if (e.type === 'touchend' || e.type === 'touchcancel') {
      if (this._tapTimer) {
        clearTimeout(this._tapTimer);
        this._tapTimer = null;
        if (this.data.showSettings) {
          this.closeSettings();
        }
      }
    }
  },

  // ========== 设置面板 ==========

  toggleSettings: function () {
    this.setData({ showSettings: !this.data.showSettings, activeTab: this.data.activeTab || 'content' });
  },



  /** 字体卡片点击 */
  onFontSelect: function (e) {
    var fontName = e.currentTarget.dataset.font || '';
    var self = this;
    var text = self.data.config.text;
    if (fontName) {
      fontLoader.loadFont(fontName, text, function (ok) {
        if (ok) {
          self.setData({ "config.fontFamily": fontName });
          self._recreateText();
        } else {
          wx.showToast({ title: '字体加载失败', icon: 'none' });
        }
      });
    } else {
      self.setData({ "config.fontFamily": '' });
      self._recreateText();
    }
  },
  onFontLangTap: function (e) {
    var lang = e.currentTarget.dataset.lang;
    if (lang) this.setData({ fontLangTab: lang });
  },

  onTabChange: function (e) {
    var tab = e.currentTarget.dataset.tab;
    if (!tab) return;
    this.setData({ activeTab: tab });
    // 切换到字体 tab 时预加载预览
    if (tab === 'font' && this.data.fontList.length > 0) {
      var self = this;
      fontLoader.loadPreviewFonts(this.data.fontList).then(function (count) {
        self.setData({ _previewVersion: count });
      });
    }
  },

  closeSettings: function () {
    this._updateSettingsPanel(false);

    // 上报内容日志（内容为空时不上报）
    var c = this.data.config;
    var text = c.text || '';
    if (text.trim()) {
      var logData = {};
      for (var key in c) {
        if (c.hasOwnProperty(key) && key !== 'currentEffect') logData[key] = c[key];
      }
      api.logEvent('single-text', 'settings', logData);
    }
  },

  _updateSettingsPanel: function (show) {
    this.setData({ showSettings: show }, () => {
      if (!show) {
        this._updateCache();
        configStore.save(this.data.config);
      }
    });
  },

  _updateCurrentSettings: function () {
    const effect = effectManager.getEffect(this.data.config.effectMode);
    if (effect) {
      this.setData({
        currentSettings: effect.settings,
        currentEffectName: effect.name
      });
    }
  },

  // ========== 缓存 ==========

  _updateCache: function () {
    this._cachedConfig = this.data.config;

    if (this.ctxRenderer && this.ctxRenderer.ctx) {
      const config = this.data.config;
      this._cachedTextLength = textMeasurer.calcTextWidth(
        this.ctxRenderer.ctx,
        config.text,
        config.fontSize,
        config.fontWeight,
        config.letterSpacing,
        config.fontFamily || ''
      );
    } else {
      this._cachedTextLength = this.data.config.fontSize;
    }
  },

  // ========== Canvas 2D 初始化 ==========

  initCanvas2D: function () {
    const info = wx.getSystemInfoSync();
    this.screenWidth = info.screenWidth;
    this.screenHeight = info.screenHeight;
    this.pixelRatio = info.pixelRatio;

    const query = wx.createSelectorQuery();
    query.select('#myCanvas').node().exec((res) => {
      try {
        if (!res || !res[0] || !res[0].node) {
          wx.showToast({ title: 'Canvas 获取失败', icon: 'none' });
          return;
        }

        this.canvas = res[0].node;

        // 创建 Canvas 2D 渲染器
        this.ctxRenderer = createRenderer(
          this.canvas,
          this.screenWidth,
          this.screenHeight,
          this.data.config.bgColor,
          this.pixelRatio
        );

        // 创建文字
        this.createText();

        // 缓存（必须在 _resetTextPosition 之前，因为 cycleWidth 依赖 textLength）
        this._updateCache();

        // 初始位置
        this._resetTextPosition();

        // 启动动画
        this.animate();

        // 隐藏审核占位层
        this.setData({ canvasReady: true });
      } catch (e) {
        console.error('[single-text] initCanvas2D error:', e && e.message);
        wx.showToast({ title: '渲染初始化失败', icon: 'none' });
      }
    });
  },

  // ========== 文字位置重置 ==========

  _resetTextPosition: function () {
    const effect = this.currentEffect;
    if (!effect || !this.canvas) return;

    const w = this.screenWidth;
    const h = this.screenHeight;
    const config = this.data.config;
    const textLength = this._cachedTextLength || 0;
    const vertical = config.vertical;

    // 循环宽度
    if (vertical) {
      // 竖排：cycleWidth = textWidth + screenHeight
      // 保证第一遍从顶部消失时，第二遍恰好从底部进入
      this._cycleWidth = textLength + h;
      if (this._cycleWidth < config.fontSize * 1.5 + h) {
        this._cycleWidth = config.fontSize * 1.5 + h;
      }
    } else {
      this._cycleWidth = Math.max(textLength, config.fontSize * 1.5);
    }
    effect.cycleWidth = this._cycleWidth;

    if (vertical) {
      // 竖排：文字从屏幕底部开始出现，向上滚动
      this._scrollBaseX = h;
      // 变换：translate(sw/2,0) + rotate(π/2)
      // physical: sx=-canvas_y+sw/2, sy=canvas_x → canvas_y=0, canvas_x=scroll
      effect.syncPositions(h, 0);
    } else {
      // 横排：X 从屏幕右侧开始
      const startX = w + this._cycleWidth / 2;
      this._scrollBaseX = startX;
      effect.syncPositions(startX, h / 2);
    }
  },

  // ========== 文字创建 ==========

  createText: function () {
    const config = this.data.config;
    const baseStyle = {
      fontSize: config.fontSize,
      fontWeight: config.fontWeight,
      letterSpacing: config.letterSpacing,
      fontFamily: config.fontFamily || ''
    };

    // 创建特效实例
    this.currentEffect = effectManager.createEffect(config.effectMode);
    if (!this.currentEffect) {
      console.error('未找到特效模块:', config.effectMode);
      return;
    }

    // 安装特效（初始化状态、预测量等）
    if (this.currentEffect.install) {
      this.currentEffect.install(this);
    }

    this.currentEffect.create(config, baseStyle);

    // 预加载字符宽度缓存
    if (this.ctxRenderer && this.ctxRenderer.ctx && config.letterSpacing > 0) {
      this.currentEffect.getCharWidths(
        this.ctxRenderer.ctx, config.text,
        config.fontSize, config.fontWeight, config.letterSpacing, config.fontFamily || ''
      );
    }
  },

  // ========== 文字更新 ==========

  updateText: function () {
    const config = this.data.config;

    // 更新每个 layer 的 text
    if (this.currentEffect && this.currentEffect.layers) {
      this.currentEffect.layers.forEach(function (layer) {
        if (layer) layer.text = config.text;
      });
    }

    // 通知特效
    if (this.currentEffect && this.currentEffect.updateText) {
      this.currentEffect.updateText(this, config);
    }

    // 先更新缓存再重置位置（cycleWidth 依赖 _cachedTextLength）
    this._updateCache();
    this._resetTextPosition();
  },

  // ========== 文字重建 ==========

  _recreateText: function () {
    if (this.animationId && this.canvas && this.canvas.cancelAnimationFrame) {
      this.canvas.cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    this._destroyEffect();
    this._cachedConfig = null;
    this._cachedTextLength = 0;

    this.createText();
    this._updateCache();      // 必须在 _resetTextPosition 之前
    this._resetTextPosition();
    this.animate();
  },

  // ========== 特效销毁 ==========

  _destroyEffect: function () {
    if (this.currentEffect) {
      if (this.currentEffect.destroy) {
        this.currentEffect.destroy(this);
      }
      this.currentEffect = null;
    }
  },

  // ========== 动画循环 ==========

  animate: function () {
    if (!this.canvas || !this.ctxRenderer || !this.currentEffect) {
      return;
    }

    const canvas = this.canvas;
    const ctxRenderer = this.ctxRenderer;
    const ctx = ctxRenderer.ctx;
    const effect = this.currentEffect;
    const self = this;

    let lastTimestamp = 0;

    const animateLoop = function (timestamp) {
      // 计算 delta time
      if (!lastTimestamp) lastTimestamp = timestamp;
      let dt = (timestamp - lastTimestamp) / 1000;
      if (dt > 0.1) dt = 0.016;
      lastTimestamp = timestamp;

      // 调度下一帧
      self.animationId = canvas.requestAnimationFrame(animateLoop);

      try {
        // 1. 清空画布
        ctxRenderer.clear();

        // 2. 滚动逻辑
        const cfg = self._cachedConfig || self.data.config;
        const scrollDelta = (cfg.scrollSpeed || 5) * dt * 60;
        const cycleWidth = self._cycleWidth ||
          (cfg.vertical ? self.screenHeight : cfg.fontSize * 3);
        const vertical = cfg.vertical;

        // 更新滚动基准位置（沿文字排列方向递减）
        self._scrollBaseX = (self._scrollBaseX || 0) - scrollDelta;

        // 无缝回绕：竖排需等文字完全移出顶部才回绕，避免中途消失
        if (vertical) {
          var textLen = self._cachedTextLength || (cycleWidth - self.screenHeight);
          if (self._scrollBaseX + textLen < 0) {
            self._scrollBaseX += cycleWidth;
          }
        } else {
          if (self._scrollBaseX < -cycleWidth / 2) {
            self._scrollBaseX += cycleWidth;
          }
        }

        // 同步 cycleWidth 到特效实例
        effect.cycleWidth = cycleWidth;

        // 3. 应用旋转 + 同步位置 + 特效绘制
        if (vertical) {
          ctx.save();
          ctx.translate(self.screenWidth / 2, 0);
          ctx.rotate(Math.PI / 2);
          effect.syncPositions(self._scrollBaseX, 0);
          if (effect.animate) effect.animate(ctx, cfg, dt);
          ctx.restore();
        } else {
          effect.syncPositions(self._scrollBaseX, self.screenHeight / 2);
          if (effect.animate) effect.animate(ctx, cfg, dt);
        }
      } catch (e) {
        console.error('[single-text] animate error:', e && e.message);
        if (self.animationId && canvas && canvas.cancelAnimationFrame) {
          canvas.cancelAnimationFrame(self.animationId);
          self.animationId = null;
        }
      }
    };

    this.animationId = canvas.requestAnimationFrame(animateLoop);
  },

  // ========== 事件处理 ==========

  // --- 公共 ---

  handleBgColorChange: function (e) {
    const colorStr = e.detail.colorList[0];
    this.setData({ "config.bgColor": colorStr });
    if (this.ctxRenderer) {
      this.ctxRenderer.setBgColor(colorStr);
    }
  },

  onFontSizeConfirm: function (e) {
    this.setData({ 'config.fontSize': e.detail }, () => {
      if (this.data.config.effectMode === 'wave') {
        this._recreateText();
      } else {
        this.updateText();
      }
    });
  },

  onFontWeightChange: function (e) {
    const fontWeight = e.detail ? 'bold' : 'normal';
    this.setData({ 'config.fontWeight': fontWeight }, () => {
      this.updateText();
    });
  },

  onTextBlur: async function (e) {
    const text = e.detail.value;
    if (text === undefined || text === null) return;

    try {
      const isSafe = await checkTextSecurity(text);
      if (!isSafe) {
        wx.showToast({ title: '内容包含敏感信息', icon: 'none', duration: 2000 });
        return;
      }
      this.setData({ 'config.text': text });
      this._handleTextChange(text);
    } catch (err) {
      this.setData({ 'config.text': text });
      this._handleTextChange(text);
    }
  },

  _handleTextChange: function (text) {
    var fontName = this.data.config.fontFamily;
    var self = this;
    if (fontName && text) {
      // 文本变更后重新加载字体子集，确保新文字有字体效果
      fontLoader.loadFont(fontName, text, function (ok) {
        self._recreateText();
        if (text && text.trim()) self._saveHistory(text);
      });
    } else {
      self._recreateText();
      if (text && text.trim()) self._saveHistory(text);
    }
  },

  onEffectPickerTap: function () {
    this.setData({ showEffectSheet: true });
  },

  onEffectSheetClose: function () {
    this.setData({ showEffectSheet: false });
  },

  onGradientDirPickerTap: function () {
    this.setData({ showGradientSheet: true });
  },

  onGradientSheetClose: function () {
    this.setData({ showGradientSheet: false });
  },

  onGradientSheetSelect: function (e) {
    var value = e.currentTarget.dataset.value;
    var label = value === 0 ? '垂直渐变' : '水平渐变';
    this.setData({
      showGradientSheet: false,
      'config.rainbowGradientType': value,
      rainbowGradientTypeLabel: label
    });
    if (this.currentEffect && this.currentEffect.updateConfig) {
      this.currentEffect.updateConfig(this, 'rainbowGradientType', value);
    }
  },
  onEffectSheetSelect: function (e) {
    var index = e.currentTarget.dataset.index;
    var options = this.data.effectOptions;
    var selected = options[index];
    if (!selected) return;
    this.setData({ showEffectSheet: false });
    this._switchEffect(selected.value, selected.key, selected.text);
  },

  _switchEffect: function (value, effectMode, effectName) {
    if (this.animationId && this.canvas && this.canvas.cancelAnimationFrame) {
      this.canvas.cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    this._destroyEffect();
    this._cachedConfig = null;
    this._cachedTextLength = 0;

    var config = { ...this.data.config, currentEffect: value, effectMode: effectMode };
    this.setData({ config: config, currentEffectName: effectName }, () => {
      this._updateCurrentSettings();
      this.createText();
      this._updateCache();
      this._resetTextPosition();
      this.animate();
      configStore.save(config);
    });
  },

  onEffectChange: function (e) {
    const value = e.detail;
    let effectMode;
    if (value === 'applyGlitchEffect') effectMode = 'glitch';
    else if (value === 'applyNeonEffect') effectMode = 'neon';
    else if (value === 'applyRainbowEffect') effectMode = 'rainbow';
    else if (value === 'applyWaveEffect') effectMode = 'wave';
    else if (value === 'applyColorCycleEffect') effectMode = 'colorCycle';
    else if (value === 'applyScalePulseEffect') effectMode = 'scalePulse';
    else if (value === 'applyGlowEffect') effectMode = 'glow';

    if (this.animationId && this.canvas && this.canvas.cancelAnimationFrame) {
      this.canvas.cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    this._destroyEffect();
    this._cachedConfig = null;
    this._cachedTextLength = 0;

    const config = { ...this.data.config, currentEffect: value, effectMode };
    this.setData({ config }, () => {
      this._updateCurrentSettings();
      this.createText();
      this._updateCache();        // 先缓存文字宽度
      this._resetTextPosition();  // 再设置位置（依赖 _cachedTextLength）
      this.animate();
      configStore.save(config);
    });
  },

  onScrollSpeedChange: function (e) {
    this.setData({ "config.scrollSpeed": e.detail });
    if (!this._cachedConfig) this._cachedConfig = this.data.config;
    this._cachedConfig.scrollSpeed = e.detail;
  },

  onMirrorChange: function (e) {
    this.setData({ 'config.mirrorEnabled': e.detail });
  },

  // --- 发光模式 ---

  handleGlowColorChange: function (e) {
    const colorStr = e.detail.colorList[0];
    this.setData({ "config.glowColor": colorStr });
    if (this.currentEffect && this.currentEffect.updateColor) {
      this.currentEffect.updateColor(this, colorStr);
    }
  },

  onGlowStrengthChange: function (e) {
    this.setData({ "config.glowOuterStrength": e.detail });
    if (this.currentEffect && this.currentEffect.updateConfig) {
      this.currentEffect.updateConfig(this, 'glowOuterStrength', e.detail);
    }
  },

  onGlowDistanceChange: function (e) {
    this.setData({ "config.glowDistance": e.detail });
    if (this.currentEffect && this.currentEffect.updateConfig) {
      this.currentEffect.updateConfig(this, 'glowDistance', e.detail);
    }
  },

  onGlowBreathSpeedChange: function (e) {
    this.setData({ "config.glowBreathSpeed": e.detail });
  },

  // --- 抖动模式 ---

  handleGlitchColorChange: function (e) {
    const [redColor, cyanColor] = e.detail.colorList;
    this.setData({ "config.redColor": redColor, "config.cyanColor": cyanColor });
    if (this.currentEffect && this.currentEffect.updateColor) {
      this.currentEffect.updateColor(this, [redColor, cyanColor]);
    }
  },

  onGlitchIntervalChange: function (e) {
    this.setData({ "config.glitchInterval": e.detail });
  },

  onGlitchOffsetAmplitudeChange: function (e) {
    this.setData({ "config.glitchOffsetAmplitude": e.detail });
  },

  onGlitchBaseOffsetChange: function (e) {
    this.setData({ "config.glitchBaseOffset": e.detail });
  },

  // --- 霓虹灯模式 ---

  handleNeonColorChange: function (e) {
    const colorStr = e.detail.colorList[0];
    this.setData({ "config.neonColor": colorStr });
    if (this.currentEffect && this.currentEffect.updateColor) {
      this.currentEffect.updateColor(this, colorStr, 'middle');
    }
  },

  handleNeonGlowColorChange: function (e) {
    const colorStr = e.detail.colorList[0];
    this.setData({ "config.neonGlowColor": colorStr });
    if (this.currentEffect && this.currentEffect.updateColor) {
      this.currentEffect.updateColor(this, colorStr, 'outer');
    }
  },

  handleNeonCoreColorChange: function (e) {
    const colorStr = e.detail.colorList[0];
    this.setData({ "config.neonCoreColor": colorStr });
    if (this.currentEffect && this.currentEffect.updateColor) {
      this.currentEffect.updateColor(this, colorStr, 'core');
    }
  },

  onNeonStrengthChange: function (e) {
    this.setData({ "config.neonStrength": e.detail });
  },

  onNeonFlickerSpeedChange: function (e) {
    this.setData({ "config.neonFlickerSpeed": e.detail });
  },

  // --- 彩虹模式 ---

  handleRainbowColorChange: function (e) {
    const colors = e.detail.colorList;
    this.setData({ "config.rainbowColors": colors });
    if (this.currentEffect && this.currentEffect.updateColor) {
      this.currentEffect.updateColor(this, colors);
    }
  },

  onRainbowGradientTypeChange: function (e) {
    var value = e.detail;
    var label = value === 0 ? '垂直渐变' : '水平渐变';
    this.setData({ 'config.rainbowGradientType': value, rainbowGradientTypeLabel: label });
    if (this.currentEffect && this.currentEffect.updateConfig) {
      this.currentEffect.updateConfig(this, 'rainbowGradientType', value);
    }
  },

  onRainbowDropShadowChange: function (e) {
    this.setData({ "config.rainbowDropShadow": e.detail });
    if (this.currentEffect && this.currentEffect.updateConfig) {
      this.currentEffect.updateConfig(this, 'rainbowDropShadow', e.detail);
    }
  },

  handleRainbowShadowColorChange: function (e) {
    const colorStr = e.detail.colorList[0];
    this.setData({ "config.rainbowShadowColor": colorStr });
    if (this.currentEffect && this.currentEffect.updateConfig) {
      this.currentEffect.updateConfig(this, 'rainbowShadowColor', colorStr);
    }
  },

  onRainbowShadowBlurChange: function (e) {
    this.setData({ "config.rainbowShadowBlur": e.detail });
    if (this.currentEffect && this.currentEffect.updateConfig) {
      this.currentEffect.updateConfig(this, 'rainbowShadowBlur', e.detail);
    }
  },

  onRainbowShadowDistanceChange: function (e) {
    this.setData({ "config.rainbowShadowDistance": e.detail });
    if (this.currentEffect && this.currentEffect.updateConfig) {
      this.currentEffect.updateConfig(this, 'rainbowShadowDistance', e.detail);
    }
  },

  // --- 波浪模式 ---

  handleWaveColorChange: function (e) {
    const colorStr = e.detail.colorList[0];
    this.setData({ "config.waveColor": colorStr });
    if (this.currentEffect && this.currentEffect.updateColor) {
      this.currentEffect.updateColor(this, colorStr);
    }
  },

  onWaveAmplitudeChange: function (e) {
    this.setData({ "config.waveAmplitude": e.detail });
  },

  onWaveFrequencyChange: function (e) {
    this.setData({ "config.waveFrequency": e.detail });
  },

  onWaveSpeedChange: function (e) {
    this.setData({ "config.waveSpeed": e.detail });
  },

  // --- 色彩循环模式 ---

  handleColorCycleColorsChange: function (e) {
    const colors = e.detail.colorList;
    this.setData({ "config.colorCycleColors": colors });
    if (this.currentEffect && this.currentEffect.updateColor) {
      this.currentEffect.updateColor(this, colors);
    }
  },

  onColorCycleSpeedChange: function (e) {
    this.setData({ "config.colorCycleSpeed": e.detail });
  },

  // --- 缩放脉冲模式 ---

  handleScalePulseColorChange: function (e) {
    const colorStr = e.detail.colorList[0];
    this.setData({ "config.scalePulseColor": colorStr });
    if (this.currentEffect && this.currentEffect.updateColor) {
      this.currentEffect.updateColor(this, colorStr);
    }
  },

  onScalePulseMinScaleChange: function (e) {
    this.setData({ "config.scalePulseMinScale": e.detail });
  },

  onScalePulseMaxScaleChange: function (e) {
    this.setData({ "config.scalePulseMaxScale": e.detail });
  },

  onScalePulseSpeedChange: function (e) {
    this.setData({ "config.scalePulseSpeed": e.detail });
  },

  // ========== 清空 & 历史 ==========

  onClearText: function () {
    var self = this;
    wx.showModal({
      title: '确认清空',
      content: '确定要清空全部文字内容吗？',
      success: function (res) {
        if (res.confirm) {
          self.setData({ 'config.text': '' });
          self._recreateText();
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
    list = list.filter(function (item) { return item.text !== text; });
    list.unshift({ text: text, time: Date.now() });
    if (list.length > MAX_HISTORY) list = list.slice(0, MAX_HISTORY);
    try { wx.setStorageSync(HISTORY_KEY, list); } catch (e) { /* ignore */ }
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
      this.setData({ 'config.text': item.text, showHistorySheet: false });
      this._handleTextChange(item.text);
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

