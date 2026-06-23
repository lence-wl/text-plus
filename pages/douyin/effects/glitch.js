/**
 * 抖动效果 (Canvas 2D)
 * - 红色层 + 青色层 + 透明主层
 * - 红/青层随机纵向偏移，产生 RGB split 抖动效果
 */

const { createBaseEffect } = require('./BaseEffect.js');
const { createDrawingPass } = require('./DrawingPass.js');

const effectImpl = {
  name: '抖动',
  key: 'glitch',

  defaultConfig: {
    redColor: '#FF1493',
    cyanColor: '#E6E6FA',
    glitchInterval: 4,
    glitchOffsetAmplitude: 4,
    glitchBaseOffset: 2,
  },

  settings: [
    { key: 'glitchColors', type: 'multiColor', label: '字体颜色', colorKeys: ['redColor', 'cyanColor'], event: 'handleGlitchColorChange' },
    { key: 'glitchInterval', type: 'slider', label: '抖动间隔', min: 1, max: 10, event: 'onGlitchIntervalChange' },
    { key: 'glitchOffsetAmplitude', type: 'slider', label: '抖动幅度', min: 1, max: 20, event: 'onGlitchOffsetAmplitudeChange' },
    { key: 'glitchBaseOffset', type: 'slider', label: '基础偏移', min: 0, max: 10, event: 'onGlitchBaseOffsetChange' }
  ],

  create: function (config, baseStyle) {
    var self = this;

    // 红色层
    var redPass = createDrawingPass({ fill: config.redColor });
    var redLayer = {
      text: config.text, x: 0, y: 0,
      passes: [redPass], _pass: redPass,
      _offsetY: 0
    };

    // 青色层
    var cyanPass = createDrawingPass({ fill: config.cyanColor });
    var cyanLayer = {
      text: config.text, x: 0, y: 0,
      passes: [cyanPass], _pass: cyanPass,
      _offsetY: 0
    };

    // 透明主层（不绘制，仅用于兼容）
    var mainPass = createDrawingPass({ fill: 'transparent' });
    var mainLayer = {
      text: config.text, x: 0, y: 0,
      passes: [],  // 不绘制
      _pass: mainPass
    };

    this.layers = [cyanLayer, redLayer, mainLayer];
    this._redLayer = redLayer;
    this._cyanLayer = cyanLayer;
    this._mainLayer = mainLayer;
    this._counter = 0;
    this._currentOffset = 0;

    return this.layers;
  },

  animate: function (ctx, config, deltaTime) {
    var self = this;
    if (!self._cyanLayer || !self._redLayer) return;
    if (!config.text) return;

    // 帧计数器
    self._counter++;
    if (self._counter >= (config.glitchInterval || 4)) {
      self._counter = 0;
      self._currentOffset = (Math.random() - 0.5) * (config.glitchOffsetAmplitude || 4);
    }

    // 主层 y 坐标（由 syncPositions 设置）
    var mainY = self._mainLayer.y;

    // 红/青层纵向偏移
    self._redLayer.y = mainY + (config.glitchBaseOffset || 2) + self._currentOffset;
    self._cyanLayer.y = mainY - (config.glitchBaseOffset || 2) - self._currentOffset;
    self._redLayer._offsetY = self._redLayer.y;
    self._cyanLayer._offsetY = self._cyanLayer.y;

    // 自定义绘制（青→红→跳过透明）
    var cycleW = self.cycleWidth;
    var charWidths = self.getCharWidths(ctx, config.text, config.fontSize, config.fontWeight, config.letterSpacing);
    var style = {
      fontSize: config.fontSize,
      fontWeight: config.fontWeight,
      letterSpacing: config.letterSpacing
    };

    function drawOne(layer) {
      if (!layer || !layer.text) return;
      var pass = layer._pass;
      pass.draw(ctx, layer.text, layer.x, layer.y, style, style.letterSpacing, charWidths);
      if (cycleW && cycleW > 0) {
        pass.draw(ctx, layer.text, layer.x + cycleW, layer.y, style, style.letterSpacing, charWidths);
      }
    }

    // 绘制青层
    drawOne(self._cyanLayer);
    // 绘制红层
    drawOne(self._redLayer);
    // mainLayer 不绘制
  },

  updateColor: function (context, colors) {
    if (!Array.isArray(colors) || colors.length < 2) return;
    if (this._redLayer) this._redLayer._pass.fill = colors[0];
    if (this._cyanLayer) this._cyanLayer._pass.fill = colors[1];
  }
};

module.exports = {
  name: effectImpl.name,
  key: effectImpl.key,
  defaultConfig: effectImpl.defaultConfig,
  settings: effectImpl.settings,
  createEffect: function () { return createBaseEffect(effectImpl); }
};
