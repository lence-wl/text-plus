/**
 * 波浪效果 (Canvas 2D)
 * - 直接逐字绘制，每个字符正弦偏移
 * - 横排：上下波 | 竖排（旋转后）：左右波
 */

const { createBaseEffect } = require('./BaseEffect.js');

const effectImpl = {
  name: '波浪',
  key: 'wave',

  defaultConfig: {
    waveColor: '#00ffff',
    waveAmplitude: 50,
    waveFrequency: 2,
    waveSpeed: 6,
  },

  settings: [
    { key: 'waveColor', type: 'color', label: '字体颜色', event: 'handleWaveColorChange' },
    { key: 'waveAmplitude', type: 'slider', label: '波浪幅度', min: 5, max: 50, event: 'onWaveAmplitudeChange' },
    { key: 'waveFrequency', type: 'slider', label: '波浪频率', min: 0.1, max: 2, step: 0.1, event: 'onWaveFrequencyChange' },
    { key: 'waveSpeed', type: 'slider', label: '波浪速度', min: 0.5, max: 10, step: 0.5, event: 'onWaveSpeedChange' }
  ],

  create: function (config, baseStyle) {
    var layer = {
      text: config.text,
      x: 0, y: 0,
      passes: []  // wave 自己绘制，不用 DrawingPass
    };
    this.layers = [layer];
    this._layer = layer;
    return this.layers;
  },

  animate: function (ctx, config, deltaTime) {
    var layer = this._layer;
    if (!layer || !config.text) return;

    var chars = config.text.split('');
    if (chars.length === 0) return;

    this.tick(deltaTime, config.waveSpeed);

    var elapsed = this._elapsed;
    var freq = config.waveFrequency;
    var amp = config.waveAmplitude;
    var fontSize = config.fontSize;
    var fontWeight = config.fontWeight;
    var spacing = config.letterSpacing || 0;
    var cycleW = this.cycleWidth;
    var charWidths = this.getCharWidths(ctx, config.text, fontSize, fontWeight, spacing);

    // 默认每个字符步进（用于测量不到的退化情况）
    var defaultStep = fontSize * 1.15 + spacing;

    // 计算文字总宽度用于居中
    var totalW = 0;
    if (charWidths) {
      for (var i = 0; i < chars.length; i++) {
        totalW += charWidths[i];
        if (i < chars.length - 1) totalW += spacing;
      }
    } else {
      totalW = chars.length * defaultStep - spacing;
    }

    var startX = layer.x - totalW / 2;
    var baseY = layer.y;

    ctx.font = fontWeight + ' ' + fontSize + 'px sans-serif';
    ctx.fillStyle = config.waveColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    var cx = startX;
    for (var i = 0; i < chars.length; i++) {
      var cw = charWidths ? charWidths[i] : defaultStep;
      var offset = Math.sin(elapsed + i * freq) * amp;

      // 偏移加在 y 轴：横排=上下波，竖排（旋转后）=左右波
      var drawX = cx + cw / 2;
      var drawY = baseY + offset;

      ctx.fillText(chars[i], Math.round(drawX), Math.round(drawY));

      // 双副本
      if (cycleW && cycleW > 0) {
        ctx.fillText(chars[i], Math.round(drawX + cycleW), Math.round(drawY));
      }

      cx += cw + spacing;
    }
  },

  updateColor: function (context, color) {
    // 颜色在 animate 中通过 config.waveColor 使用
  }
};

module.exports = {
  name: effectImpl.name,
  key: effectImpl.key,
  defaultConfig: effectImpl.defaultConfig,
  settings: effectImpl.settings,
  createEffect: function () { return createBaseEffect(effectImpl); }
};
