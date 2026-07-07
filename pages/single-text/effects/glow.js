/**
 * 发光呼吸效果 (Canvas 2D)
 * - 双 pass 绘制：发光底（shadowBlur）+ 清晰文字
 * - 呼吸动画：发光强度正弦变化
 */

const { createBaseEffect } = require('./BaseEffect.js');
const { createDrawingPass } = require('./DrawingPass.js');

const effectImpl = {
  name: '发光',
  key: 'glow',

  defaultConfig: {
    glowColor: '#ff00ff',
    glowOuterStrength: 5,
    glowDistance: 15,
    glowBreathSpeed: 2,
  },

  settings: [
    { key: 'glowColor', type: 'color', label: '字体颜色', event: 'handleGlowColorChange' },
    { key: 'glowOuterStrength', type: 'slider', label: '发光强度', min: 1, max: 20, event: 'onGlowStrengthChange' },
    { key: 'glowDistance', type: 'slider', label: '发光距离', min: 5, max: 50, event: 'onGlowDistanceChange' },
    { key: 'glowBreathSpeed', type: 'slider', label: '呼吸速度', min: 0.5, max: 10, step: 0.5, event: 'onGlowBreathSpeedChange' }
  ],

  create: function (config, baseStyle) {
    // Pass 1: 发光层（shadowBlur）
    var glowPass = createDrawingPass({
      fill: config.glowColor,
      glowColor: config.glowColor,
      glowBlur: config.glowDistance
    });

    // Pass 2: 清晰文字层（无发光）
    var corePass = createDrawingPass({
      fill: config.glowColor,
      glowBlur: 0
    });

    var layer = {
      text: config.text,
      x: 0, y: 0,
      passes: [glowPass, corePass],
      _glowPass: glowPass,
      _corePass: corePass
    };

    this.layers = [layer];
    return this.layers;
  },

  animate: function (ctx, config, deltaTime) {
    var layer = this.layers[0];
    if (!layer) return;

    // 呼吸动画
    this.tick(deltaTime, config.glowBreathSpeed);
    var breath = this.getBreath(0, 1);
    var blur = config.glowDistance * breath;
    layer._glowPass.glowBlur = blur;

    // 同步颜色
    layer._glowPass.fill = config.glowColor;
    layer._glowPass.glowColor = config.glowColor;
    layer._corePass.fill = config.glowColor;

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
    if (layer) {
      layer._glowPass.fill = color;
      layer._glowPass.glowColor = color;
      layer._corePass.fill = color;
    }
  },

  updateConfig: function (context, key, value) {
    // 参数在 animate 中直接通过 config 读取
  }
};

module.exports = {
  name: effectImpl.name,
  key: effectImpl.key,
  defaultConfig: effectImpl.defaultConfig,
  settings: effectImpl.settings,
  createEffect: function () { return createBaseEffect(effectImpl); }
};
