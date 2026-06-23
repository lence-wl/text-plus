/**
 * 色彩循环效果 (Canvas 2D)
 * - 颜色在多个颜色之间平滑过渡
 */

const { createBaseEffect } = require('./BaseEffect.js');
const { createDrawingPass } = require('./DrawingPass.js');
const canvasUtils = require('./canvasUtils.js');

const effectImpl = {
  name: '色彩循环',
  key: 'colorCycle',

  defaultConfig: {
    colorCycleColors: ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#00ffff', '#0000ff'],
    colorCycleSpeed: 2,
  },

  settings: [
    { key: 'colorCycleColors', type: 'multiColor', label: '循环颜色', colorCount: 6, event: 'handleColorCycleColorsChange' },
    { key: 'colorCycleSpeed', type: 'slider', label: '循环速度', min: 0.5, max: 10, step: 0.5, event: 'onColorCycleSpeedChange' }
  ],

  create: function (config, baseStyle) {
    var pass = createDrawingPass({
      fill: config.colorCycleColors[0]
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

  animate: function (ctx, config, deltaTime) {
    var layer = this.layers[0];
    if (!layer) return;

    var colors = config.colorCycleColors;
    if (!colors || colors.length === 0) return;

    if (colors.length === 1) {
      layer._pass.fill = colors[0];
    } else {
      this.tick(deltaTime, config.colorCycleSpeed);

      var cycleLength = colors.length;
      var normalizedTime = this._elapsed % cycleLength;
      var colorIndex = Math.floor(normalizedTime);
      var t = normalizedTime - colorIndex;

      var currentColor = colors[colorIndex % cycleLength];
      var nextColor = colors[(colorIndex + 1) % cycleLength];
      layer._pass.fill = canvasUtils.interpolateColor(currentColor, nextColor, t);
    }

    var style = {
      fontSize: config.fontSize,
      fontWeight: config.fontWeight,
      letterSpacing: config.letterSpacing
    };
    this.drawLayer(ctx, style);
  },

  updateColor: function (context, colors) {
    // 颜色通过 animate 动态更新，此处无需操作
  }
};

module.exports = {
  name: effectImpl.name,
  key: effectImpl.key,
  defaultConfig: effectImpl.defaultConfig,
  settings: effectImpl.settings,
  createEffect: function () { return createBaseEffect(effectImpl); }
};
