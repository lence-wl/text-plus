/**
 * 缩放脉冲效果 (Canvas 2D)
 * - 文字大小正弦变化，产生脉冲效果
 */

const { createBaseEffect } = require('./BaseEffect.js');
const { createDrawingPass } = require('./DrawingPass.js');

const effectImpl = {
  name: '缩放脉冲',
  key: 'scalePulse',

  defaultConfig: {
    scalePulseColor: '#00ffff',
    scalePulseMinScale: 0.8,
    scalePulseMaxScale: 1.2,
    scalePulseSpeed: 2,
  },

  settings: [
    { key: 'scalePulseColor', type: 'color', label: '字体颜色', event: 'handleScalePulseColorChange' },
    { key: 'scalePulseMinScale', type: 'slider', label: '最小缩放', min: 0.5, max: 1, step: 0.1, event: 'onScalePulseMinScaleChange' },
    { key: 'scalePulseMaxScale', type: 'slider', label: '最大缩放', min: 1, max: 2, step: 0.1, event: 'onScalePulseMaxScaleChange' },
    { key: 'scalePulseSpeed', type: 'slider', label: '脉冲速度', min: 0.5, max: 10, step: 0.5, event: 'onScalePulseSpeedChange' }
  ],

  create: function (config, baseStyle) {
    var pass = createDrawingPass({
      fill: config.scalePulseColor,
      scaleX: 1,
      scaleY: 1
    });

    var layer = {
      text: config.text,
      x: 0, y: 0,
      passes: [pass],
      _pass: pass  // 快捷引用
    };

    this.layers = [layer];
    return this.layers;
  },

  animate: function (ctx, config, deltaTime) {
    var layer = this.layers[0];
    if (!layer) return;

    this.tick(deltaTime, config.scalePulseSpeed);
    var pulse = this.getBreath(config.scalePulseMinScale, config.scalePulseMaxScale);

    layer._pass.scaleX = pulse;
    layer._pass.scaleY = pulse;

    var style = {
      fontSize: config.fontSize,
      fontWeight: config.fontWeight,
      letterSpacing: config.letterSpacing,
      fontFamily: config.fontFamily || ''
    };
    this.drawLayer(ctx, style);
  },

  updateColor: function (context, color) {
    var layer = this.layers[0];
    if (layer && layer._pass) layer._pass.fill = color;
  }
};

module.exports = {
  name: effectImpl.name,
  key: effectImpl.key,
  defaultConfig: effectImpl.defaultConfig,
  settings: effectImpl.settings,
  createEffect: function () { return createBaseEffect(effectImpl); }
};
