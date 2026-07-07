/**
 * DrawingPass - 原子绘制单元
 *
 * 封装一次完整的 canvas 2D 绘制调用：
 *   ctx.save → ctx.translate → ctx.scale → shadowBlur → fillStyle → drawText → ctx.restore
 *
 * 特性：
 * - 支持 shadowBlur 发光（glow）/ 投影（dropShadow）
 * - 支持 scale 变换（scalePulse）
 * - 支持动态 fill（gradient / 插值颜色）
 * - perChar 模式：逐字绘制 + 回调偏移（wave）
 */

const canvasUtils = require('./canvasUtils.js');

const IS_ANDROID = canvasUtils.isAndroid();

/**
 * @param {Object} options
 * @param {string|function} options.fill - 填充颜色，或返回颜色/gradient 的函数
 * @param {string} [options.glowColor] - 发光颜色（shadowColor）
 * @param {number} [options.glowBlur=0] - 发光模糊半径（shadowBlur）
 * @param {number} [options.scaleX=1]
 * @param {number} [options.scaleY=1]
 * @param {boolean} [options.perChar=false] - 是否逐字绘制
 */
function createDrawingPass(options) {
  if (!options) options = {};

  const pass = {
    fill: options.fill || '#ffffff',
    glowColor: options.glowColor || null,
    glowBlur: options.glowBlur || 0,
    scaleX: options.scaleX || 1,
    scaleY: options.scaleY || 1,
    perChar: options.perChar || false,

    /**
     * 执行绘制
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {string} text - 文字内容
     * @param {number} x - 绘制中心 x
     * @param {number} y - 绘制中心 y
     * @param {Object} style - { fontSize, fontWeight }
     * @param {number} letterSpacing
     * @param {number[]|null} charWidths - 预测量字符宽度（letterSpacing > 0 时需要）
     * @param {Object} [perCharOpts] - perChar 模式专用参数
     * @param {function} [perCharOpts.getOffset] - (index) => { x, y } 逐字偏移
     * @param {number} [perCharOpts.baseX=0] - 逐字起始 x（相对 translate 原点）
     */
    draw: function (ctx, text, x, y, style, letterSpacing, charWidths, perCharOpts) {
      if (!text || !ctx) return;

      const fill = typeof this.fill === 'function' ? this.fill() : this.fill;
      const { fontSize, fontWeight } = style;
      const spacing = letterSpacing || 0;

      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));

      // Scale 变换
      if (this.scaleX !== 1 || this.scaleY !== 1) {
        ctx.scale(this.scaleX, this.scaleY);
      }

      // 发光 / 阴影
      const effectiveBlur = this.glowBlur > 0
        ? (IS_ANDROID ? Math.round(this.glowBlur * 0.5) : this.glowBlur)
        : 0;

      if (effectiveBlur > 0) {
        ctx.shadowBlur = effectiveBlur;
        ctx.shadowColor = this.glowColor || fill;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }

      ctx.fillStyle = fill;
      canvasUtils.setTextStyle(ctx, { fontSize, fontWeight, fontFamily: style.fontFamily || '', fill });

      if (this.perChar) {
        // 逐字绘制（wave 模式）
        const chars = text.split('');
        const opts = perCharOpts || {};
        const getOffset = opts.getOffset || (() => ({ x: 0, y: 0 }));
        const baseX = opts.baseX || 0;
        let cx = baseX;

        for (let i = 0; i < chars.length; i++) {
          const offset = getOffset(i);
          const charX = cx + (offset.x || 0);
          const charY = (offset.y || 0);

          ctx.fillText(chars[i], charX, charY);

          const cw = (charWidths && charWidths[i]) ? charWidths[i] : ctx.measureText(chars[i]).width;
          cx += cw + spacing;
        }
      } else {
        canvasUtils.drawHorizontalText(ctx, text, 0, { fill, fontSize, fontWeight }, spacing, charWidths);
      }

      // 清除阴影（避免影响后续绘制）
      if (effectiveBlur > 0) {
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
      }

      ctx.restore();
    }
  };

  return pass;
}

module.exports = { createDrawingPass };
