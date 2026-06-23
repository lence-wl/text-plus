/**
 * Canvas 2D 渲染器
 * 管理 canvas 生命周期，不包含绘制逻辑（绘制在特效中自行处理）
 */

const canvasUtils = require('./effects/canvasUtils.js');

/**
 * 创建 Canvas 2D 渲染器
 * @param {Object} canvas - 微信小程序 Canvas 节点
 * @param {number} width - 逻辑宽度
 * @param {number} height - 逻辑高度
 * @param {string} bgColor - 背景色（十六进制）
 * @param {number} pixelRatio - 设备像素比
 * @returns {Object} 渲染器对象 { ctx, clear, resize, destroy }
 */
function createRenderer(canvas, width, height, bgColor, pixelRatio) {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('无法获取 Canvas 2D 上下文');
  }

  // 存储状态
  const state = {
    canvas,
    ctx,
    width,
    height,
    bgColor,
    pixelRatio
  };

  // 设置初始尺寸
  _applyDimensions(state, width, height);

  return {
    get ctx() { return state.ctx; },
    get width() { return state.width; },
    get height() { return state.height; },
    get pixelRatio() { return state.pixelRatio; },
    get bgColor() { return state.bgColor; },

    clear() {
      const ctx = state.ctx;
      ctx.save();
      ctx.setTransform(state.pixelRatio, 0, 0, state.pixelRatio, 0, 0);
      ctx.fillStyle = state.bgColor;
      ctx.fillRect(0, 0, state.width, state.height);
      ctx.restore();
    },

    resize(w, h) {
      state.width = w;
      state.height = h;
      _applyDimensions(state, w, h);
    },

    /**
     * 设置背景色
     * @param {string} color - 十六进制颜色
     */
    setBgColor(color) {
      state.bgColor = color;
    },

    destroy() {
      state.canvas = null;
      state.ctx = null;
    }
  };
}

/**
 * 应用 canvas 物理尺寸并设置像素比变换
 */
function _applyDimensions(state, width, height) {
  const canvas = state.canvas;
  const pr = state.pixelRatio;

  canvas.width = width * pr;
  canvas.height = height * pr;

  // Canvas resize 会重置所有上下文状态，需要重新设置变换
  const ctx = state.ctx;
  ctx.setTransform(pr, 0, 0, pr, 0, 0);
}

module.exports = { createRenderer };
