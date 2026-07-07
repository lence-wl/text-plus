/**
 * 彩虹文字效果 (Canvas 2D)
 * - 使用 canvas createLinearGradient 实现渐变
 * - 支持垂直/水平渐变 + 可选投影
 */

const { createBaseEffect } = require('./BaseEffect.js');
const { createDrawingPass } = require('./DrawingPass.js');
const canvasUtils = require('./canvasUtils.js');
const textMeasurer = require('../textMeasurer.js');

const effectImpl = {
  name: '彩虹',
  key: 'rainbow',

  defaultConfig: {
    rainbowColors: ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#8b00ff'],
    rainbowGradientType: 0,     // 0: 垂直, 1: 水平
    rainbowDropShadow: true,
    rainbowShadowColor: '#1152d4',
    rainbowShadowBlur: 5,
    rainbowShadowDistance: 16,
  },

  settings: [
    { key: 'rainbowColors', type: 'multiColor', label: '彩虹颜色', colorCount: 7, event: 'handleRainbowColorChange' },
    { key: 'rainbowGradientType', type: 'select', label: '渐变方向', options: [{ text: '垂直渐变', value: 0 }, { text: '水平渐变', value: 1 }], event: 'onRainbowGradientTypeChange' },
    { key: 'rainbowDropShadow', type: 'switch', label: '阴影效果', event: 'onRainbowDropShadowChange' },
    { key: 'rainbowShadowColor', type: 'color', label: '阴影颜色', event: 'handleRainbowShadowColorChange' },
    { key: 'rainbowShadowBlur', type: 'slider', label: '阴影模糊', min: 0, max: 20, event: 'onRainbowShadowBlurChange' },
    { key: 'rainbowShadowDistance', type: 'slider', label: '阴影距离', min: 0, max: 30, event: 'onRainbowShadowDistanceChange' }
  ],

  create: function (config, baseStyle) {
    this._textHeight = 0;

    var pass = createDrawingPass({
      fill: config.rainbowColors[0]  // 占位，animate 中替换为 gradient
    });

    var layer = {
      text: config.text,
      x: 0, y: 0,
      passes: [pass],
      _pass: pass
    };

    this.layers = [layer];
    return this.layers;
  },

  install: function (context) {
    this._ctxRenderer = context.ctxRenderer;
  },

  animate: function (ctx, config, deltaTime) {
    var layer = this.layers[0];
    if (!layer || !config.text) return;

    // 预测量文字尺寸
    if (!this._textHeight && this._ctxRenderer && this._ctxRenderer.ctx) {
      var metrics = textMeasurer.measureText(
        this._ctxRenderer.ctx, config.text, config.fontSize, config.fontWeight, config.fontFamily
      );
      this._textHeight = metrics.width;
    }

    // 自定义绘制（支持 shadowDistance 偏移 + 动态渐变）
    var self = this;
    var cycleW = self.cycleWidth;
    var textLen = self._textHeight || (config.fontSize * config.text.length * 0.7);
    var charWidths = self.getCharWidths(
      ctx, config.text, config.fontSize, config.fontWeight, config.letterSpacing, config.fontFamily
    );

    function drawOne(x, y) {
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));

      canvasUtils.setTextStyle(ctx, {
        fontSize: config.fontSize,
        fontWeight: config.fontWeight,
        fontFamily: config.fontFamily || '',
        fill: '#fff'
      });

      // 动态渐变
      var gradient = canvasUtils.createGradient(
        ctx, config.rainbowGradientType, config.rainbowColors,
        textLen, config.fontSize * 1.5
      );
      ctx.fillStyle = gradient;

      // 投影（shadowBlur + shadowOffsetY）
      if (config.rainbowDropShadow) {
        ctx.shadowBlur = config.rainbowShadowBlur || 5;
        ctx.shadowColor = config.rainbowShadowColor || '#1152d4';
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = config.rainbowShadowDistance || 16;
      }

      canvasUtils.drawHorizontalText(ctx, config.text, 0, {
        fill: config.rainbowColors[0],
        fontSize: config.fontSize,
        fontWeight: config.fontWeight
      }, config.letterSpacing, charWidths);

      if (config.rainbowDropShadow) {
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }

      ctx.restore();
    }

    drawOne(layer.x, layer.y);
    if (cycleW && cycleW > 0) {
      drawOne(layer.x + cycleW, layer.y);
    }
  },

  updateText: function (context, config) {
    this._textHeight = 0;
    if (this._ctxRenderer && this._ctxRenderer.ctx) {
      var metrics = textMeasurer.measureText(
        this._ctxRenderer.ctx, config.text, config.fontSize, config.fontWeight, config.fontFamily
      );
      this._textHeight = metrics.width;
    }
  },

  updateColor: function (context, colors) {
    // 颜色在 animate 中通过 config.rainbowColors 读取
  },

  updateConfig: function (context, key, value) {
    // 参数在 animate 中通过 config 读取
  }
};

module.exports = {
  name: effectImpl.name,
  key: effectImpl.key,
  defaultConfig: effectImpl.defaultConfig,
  settings: effectImpl.settings,
  createEffect: function () { return createBaseEffect(effectImpl); }
};
