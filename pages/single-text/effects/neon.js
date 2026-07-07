/**
 * 霓虹灯效果 (Canvas 2D)
 * - 三层文字：外层发光（最大最模糊）+ 中层发光 + 核心文字（最亮最清晰）
 * - 闪烁动画：外层和中层发光强度动态变化
 */

const { createBaseEffect } = require('./BaseEffect.js');
const { createDrawingPass } = require('./DrawingPass.js');

const effectImpl = {
  name: '霓虹',
  key: 'neon',

  defaultConfig: {
    neonColor: '#00ffff',       // 中层颜色
    neonGlowColor: '#ff00ff',   // 外层颜色
    neonCoreColor: '#ffffff',   // 核心颜色
    neonStrength: 4,
    neonFlickerSpeed: 3,
  },

  settings: [
    { key: 'neonGlowColor', type: 'color', label: '外层颜色', event: 'handleNeonGlowColorChange' },
    { key: 'neonColor', type: 'color', label: '中层颜色', event: 'handleNeonColorChange' },
    { key: 'neonCoreColor', type: 'color', label: '核心颜色', event: 'handleNeonCoreColorChange' },
    { key: 'neonStrength', type: 'slider', label: '发光强度', min: 1, max: 10, event: 'onNeonStrengthChange' },
    { key: 'neonFlickerSpeed', type: 'slider', label: '闪烁速度', min: 0.5, max: 10, step: 0.5, event: 'onNeonFlickerSpeedChange' }
  ],

  create: function (config, baseStyle) {
    // 外层发光（最大最模糊）
    var outerPass = createDrawingPass({
      fill: config.neonGlowColor,
      glowColor: config.neonGlowColor,
      glowBlur: config.neonStrength * 3
    });
    var outerLayer = {
      text: config.text, x: 0, y: 0,
      passes: [outerPass], _pass: outerPass
    };

    // 中层发光
    var middlePass = createDrawingPass({
      fill: config.neonColor,
      glowColor: config.neonColor,
      glowBlur: config.neonStrength * 1.5
    });
    var middleLayer = {
      text: config.text, x: 0, y: 0,
      passes: [middlePass], _pass: middlePass
    };

    // 核心文字（最亮最清晰，无发光）
    var corePass = createDrawingPass({
      fill: config.neonCoreColor,
      glowBlur: 0
    });
    var coreLayer = {
      text: config.text, x: 0, y: 0,
      passes: [corePass], _pass: corePass
    };

    // 从下到上：外层 → 中层 → 核心
    this.layers = [outerLayer, middleLayer, coreLayer];
    this._outerLayer = outerLayer;
    this._middleLayer = middleLayer;
    this._coreLayer = coreLayer;

    return this.layers;
  },

  animate: function (ctx, config, deltaTime) {
    if (!this._coreLayer) return;
    if (!config.text) return;

    // 闪烁动画
    this.tick(deltaTime, config.neonFlickerSpeed);
    var flicker = 0.7 + 0.3 * Math.sin(this._elapsed);

    // 更新外层/中层 blur
    this._outerLayer._pass.fill = config.neonGlowColor;
    this._outerLayer._pass.glowColor = config.neonGlowColor;
    this._outerLayer._pass.glowBlur = config.neonStrength * 3 * flicker;

    this._middleLayer._pass.fill = config.neonColor;
    this._middleLayer._pass.glowColor = config.neonColor;
    this._middleLayer._pass.glowBlur = config.neonStrength * 1.5 * flicker;

    this._coreLayer._pass.fill = config.neonCoreColor;

    var style = {
      fontSize: config.fontSize,
      fontWeight: config.fontWeight,
      letterSpacing: config.letterSpacing,
      fontFamily: config.fontFamily || ''
    };
    this.drawLayer(ctx, style);
  },

  updateColor: function (context, color, type) {
    switch (type) {
      case 'outer':
        if (this._outerLayer) {
          this._outerLayer._pass.fill = color;
          this._outerLayer._pass.glowColor = color;
        }
        break;
      case 'middle':
        if (this._middleLayer) {
          this._middleLayer._pass.fill = color;
          this._middleLayer._pass.glowColor = color;
        }
        break;
      case 'core':
        if (this._coreLayer) {
          this._coreLayer._pass.fill = color;
        }
        break;
    }
  }
};

module.exports = {
  name: effectImpl.name,
  key: effectImpl.key,
  defaultConfig: effectImpl.defaultConfig,
  settings: effectImpl.settings,
  createEffect: function () { return createBaseEffect(effectImpl); }
};
