/**
 * Canvas 2D 中文文字横排滚动 + 特效模块化架构
 * 双击 canvas 打开/关闭设置面板
 */

const effectManager = require("./effects/index.js");
const configStore = require("../../utils/configStore.js");
const { checkTextSecurity } = require("../../utils/security.js");
const { createRenderer } = require("./renderer.js");
const textMeasurer = require("./textMeasurer.js");
const adManager = require("../../utils/adManager.js");

const sysInfo = wx.getSystemInfoSync();

Page({
  data: {
    canvasReady: false,
    showSettings: false,
    showEffectSheet: false,
    activeTab: 'content',
    currentEffectName: '彩虹',
    effectOptions: effectManager.getEffectOptions(),
    currentSettings: [],
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
      ...effectManager.getDefaultConfig()
    }
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

    this.setData({ config: savedConfig }, function () {
      this._updateCurrentSettings();
    });
  },

  onReady: async function () {
    await new Promise(resolve => wx.nextTick(resolve));
    await new Promise(resolve => setTimeout(resolve, 100));
    this.initCanvas2D();

    // 初始化插屏广告（5秒后展示）
    adManager.initInterstitial('adunit-c9535d894c52703a');
    var self = this;
    self._adTimer = setTimeout(function () {
      self._adTimer = null;
      adManager.showInterstitial('adunit-c9535d894c52703a');
    }, 5000);
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
    if (this._adTimer) {
      clearTimeout(this._adTimer);
      this._adTimer = null;
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
      title: '文字特效 - ' + (c.text || '双击修改文字'),
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
      title: '文字特效 - ' + (c.text || '双击修改文字'),
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

  onTabChange: function (e) {
    var tab = e.currentTarget.dataset.tab;
    if (tab) this.setData({ activeTab: tab });
  },

  closeSettings: function () {
    this._updateSettingsPanel(false);
    // 关闭设置面板时展示插屏广告
    adManager.showInterstitial('adunit-c9535d894c52703a');
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
        config.letterSpacing
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
      letterSpacing: config.letterSpacing
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
        config.fontSize, config.fontWeight, config.letterSpacing
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
      this._recreateText();
    } catch (err) {
      this.setData({ 'config.text': text });
      this._recreateText();
    }
  },

  onEffectPickerTap: function () {
    this.setData({ showEffectSheet: true });
  },

  onEffectSheetClose: function () {
    this.setData({ showEffectSheet: false });
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
    this.setData({ "config.rainbowGradientType": e.detail });
    if (this.currentEffect && this.currentEffect.updateConfig) {
      this.currentEffect.updateConfig(this, 'rainbowGradientType', e.detail);
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
  }
});

