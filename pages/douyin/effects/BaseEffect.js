/**
 * BaseEffect - 特效基类工厂
 *
 * 提供所有特效的公共能力：
 * 1. 字符宽度缓存（替代各特效私有 _xxxCharWidths）
 * 2. 双副本无缝滚动绘制（drawLayer）
 * 3. 时间管理（tick / getElapsed / getBreath）
 * 4. 通用层位置同步（syncPositions）
 * 5. 默认 no-op 生命周期方法
 *
 * 用法：
 *   const effect = createBaseEffect({
 *     name: '发光', key: 'glow',
 *     defaultConfig: { ... }, settings: [ ... ],
 *     create(config, baseStyle) { ... },    // 返回 layer 数组
 *     animate(ctx, config, deltaTime) { ... }  // 可选，完全自定义绘制
 *   })
 */

const textMeasurer = require('../textMeasurer.js');
const canvasUtils = require('./canvasUtils.js');

/**
 * @param {Object} impl - 特效特有实现
 * @param {string} impl.name - 中文名称
 * @param {string} impl.key - 标识 key
 * @param {Object} impl.defaultConfig - 默认参数
 * @param {Array} impl.settings - 设置面板描述
 * @param {Function} impl.create - (config, baseStyle) => layer[]
 * @param {Function} [impl.animate] - (ctx, config, deltaTime) 自定义绘制逻辑
 * @param {Function} [impl.updateText] - (config) 文字内容变更
 * @param {Function} [impl.updateColor] - (...args) 颜色变更
 * @param {Function} [impl.updateConfig] - (key, value) 参数变更
 * @param {Function} [impl.install] - (context) 安装钩子
 * @param {Function} [impl.destroy] - (context) 销毁钩子
 * @returns {Object} 特效实例
 */
function createBaseEffect(impl) {
  const effect = {
    // ========== 元数据 ==========
    name: impl.name,
    key: impl.key,
    defaultConfig: impl.defaultConfig || {},
    settings: impl.settings || [],

    // ========== 公共状态 ==========
    layers: [],           // [{ x, y, passes: DrawingPass[] }]
    cycleWidth: 0,        // 无缝循环宽度
    _charWidths: null,    // 字符宽度缓存
    _cacheKey: '',        // 缓存键（text + fontSize + fontWeight）
    _elapsed: 0,          // 动画时间（秒）

    // ========== 字符宽度缓存 ==========

    /**
     * 获取预测量的逐字宽度数组（用于 letterSpacing 逐字绘制）
     * 仅当输入变更时才重新测量
     */
    getCharWidths: function (ctx, text, fontSize, fontWeight, letterSpacing) {
      if (letterSpacing <= 0) return null;

      const key = text + '|' + fontSize + '|' + fontWeight;
      if (this._charWidths && this._cacheKey === key) {
        return this._charWidths;
      }

      if (ctx && text) {
        const chars = text.split('');
        const metrics = textMeasurer.measureChars(ctx, chars, fontSize, fontWeight);
        this._charWidths = metrics.map(function (m) { return m.width; });
        this._cacheKey = key;
      }

      return this._charWidths;
    },

    /**
     * 计算文字总宽度（用于 cycleWidth）
     */
    calcTextWidth: function (ctx, text, fontSize, fontWeight, letterSpacing) {
      return textMeasurer.calcTextWidth(ctx, text, fontSize, fontWeight, letterSpacing);
    },

    // ========== 双副本循环绘制 ==========

    /**
     * 遍历所有 layer，每个 layer 的每个 pass 执行双副本绘制
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} style - { fontSize, fontWeight, letterSpacing }
     */
    drawLayer: function (ctx, style) {
      var self = this;
      var cycleW = self.cycleWidth;
      var charWidths = self._charWidths;
      var spacing = style.letterSpacing || 0;

      self.layers.forEach(function (layer) {
        if (!layer || !layer.passes) return;
        var x = layer.x;
        var y = layer.y;

        layer.passes.forEach(function (pass) {
          if (!pass) return;
          pass.draw(ctx, layer.text, x, y, style, spacing, charWidths);
          if (cycleW && cycleW > 0) {
            pass.draw(ctx, layer.text, x + cycleW, y, style, spacing, charWidths);
          }
        });
      });
    },

    // ========== 时间管理 ==========

    /**
     * 更新时间计数器并返回当前 elapsed
     */
    tick: function (deltaTime, speed) {
      speed = speed || 1;
      this._elapsed += deltaTime * speed;
      this._elapsed = canvasUtils.limitTimeRange(this._elapsed);
      return this._elapsed;
    },

    /**
     * 获取呼吸/脉冲强度 0~1
     */
    getBreath: function (min, max) {
      min = min || 0;
      max = max || 1;
      return canvasUtils.calculateBreathIntensity(this._elapsed, min, max);
    },

    // ========== 层位置同步 ==========

    /**
     * 统一设置所有 layer 的 x, y
     * 在动画循环中由 douyin.js 调用
     */
    syncPositions: function (baseX, centerY) {
      this.layers.forEach(function (layer) {
        if (layer) {
          layer.x = baseX;
          layer.y = centerY;
        }
      });
    },

    // ========== 生命周期（默认 no-op）==========

    install: function (context) {
      this._elapsed = 0;
      this._charWidths = null;
      this._cacheKey = '';
      if (impl.install) impl.install.call(this, context);
    },

    destroy: function (context) {
      this.layers = [];
      this._charWidths = null;
      this._cacheKey = '';
      this._elapsed = 0;
      this.cycleWidth = 0;
      if (impl.destroy) impl.destroy.call(this, context);
    },

    /**
     * 创建图层
     * @param {Object} config - 页面配置
     * @param {Object} baseStyle - { fontSize, fontWeight }
     * @returns {Array} layer 数组
     */
    create: function (config, baseStyle) {
      return impl.create.call(this, config, baseStyle);
    },

    /**
     * 帧动画（默认使用 drawLayer）
     */
    animate: function (ctx, config, deltaTime) {
      if (impl.animate) {
        impl.animate.call(this, ctx, config, deltaTime);
      } else {
        var style = {
          fontSize: config.fontSize,
          fontWeight: config.fontWeight,
          letterSpacing: config.letterSpacing
        };
        this.drawLayer(ctx, style);
      }
    },

    updateText: function (context, config) {
      this._charWidths = null;  // 刷新缓存
      this._cacheKey = '';
      if (impl.updateText) impl.updateText.call(this, context, config);
    },

    updateColor: function (context) {
      var args = Array.prototype.slice.call(arguments, 1);
      if (impl.updateColor) impl.updateColor.apply(this, [context].concat(args));
    },

    updateConfig: function (context, key, value) {
      if (impl.updateConfig) impl.updateConfig.call(this, context, key, value);
    }
  };

  return effect;
}

module.exports = { createBaseEffect };
