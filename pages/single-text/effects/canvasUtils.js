/**
 * Canvas 2D 辅助函数
 * 提供颜色处理、渐变创建、横向文字绘制等通用功能
 */

// ========== Android 检测 ==========

const IS_ANDROID = (function () {
  try {
    const info = wx.getSystemInfoSync();
    return /android/i.test(info.system);
  } catch (e) {
    return false;
  }
})();

// ========== 颜色处理 ==========

/**
 * 十六进制颜色 → rgba 字符串
 */
function hexToRgba(hex, alpha) {
  if (!hex || typeof hex !== 'string') return 'rgba(0,0,0,1)';
  const clean = hex.replace('#', '');
  let r, g, b, a = alpha !== undefined ? alpha : 1;

  if (clean.length === 6) {
    r = parseInt(clean.slice(0, 2), 16);
    g = parseInt(clean.slice(2, 4), 16);
    b = parseInt(clean.slice(4, 6), 16);
  } else if (clean.length === 8) {
    r = parseInt(clean.slice(0, 2), 16);
    g = parseInt(clean.slice(2, 4), 16);
    b = parseInt(clean.slice(4, 6), 16);
    a = alpha !== undefined ? alpha : parseInt(clean.slice(6, 8), 16) / 255;
  } else {
    return 'rgba(0,0,0,1)';
  }

  return `rgba(${r},${g},${b},${a})`;
}

/**
 * 十六进制颜色 → 数字
 */
function hexToNumber(color) {
  if (!color || typeof color !== 'string') return 0;
  return parseInt(color.replace('#', '0x'), 16);
}

/**
 * 两个十六进制颜色之间插值
 */
function interpolateColor(c1, c2, t) {
  const r1 = parseInt(c1.slice(1, 3), 16);
  const g1 = parseInt(c1.slice(3, 5), 16);
  const b1 = parseInt(c1.slice(5, 7), 16);

  const r2 = parseInt(c2.slice(1, 3), 16);
  const g2 = parseInt(c2.slice(3, 5), 16);
  const b2 = parseInt(c2.slice(5, 7), 16);

  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);

  return '#' +
    r.toString(16).padStart(2, '0') +
    g.toString(16).padStart(2, '0') +
    b.toString(16).padStart(2, '0');
}

// ========== 渐变 ==========

/**
 * 创建线性渐变
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} type - 0: 垂直渐变, 1: 水平渐变
 * @param {string[]} colors
 * @param {number} width
 * @param {number} height
 */
function createGradient(ctx, type, colors, width, height) {
  let gradient;
  if (type === 0) {
    gradient = ctx.createLinearGradient(0, -height / 2, 0, height / 2);
  } else {
    gradient = ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
  }

  colors.forEach((color, i) => {
    gradient.addColorStop(i / Math.max(colors.length - 1, 1), color);
  });

  return gradient;
}

// ========== 文字绘制 ==========

/**
 * 逐字绘制横向文字（解决 Canvas 2D 无 letterSpacing 问题）
 * 调用前 ctx 需已 translate 到文字中心点
 */
function drawHorizontalText(ctx, text, offsetX, style, letterSpacing, charWidths) {
  if (!text || text.length === 0) return;

  const spacing = letterSpacing || 0;
  const chars = text.split('');

  if (spacing <= 0) {
    ctx.fillText(text, 0, 0);
    return;
  }

  let cx = offsetX || 0;
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], cx, 0);
    const charWidth = charWidths ? charWidths[i] : ctx.measureText(chars[i]).width;
    cx += charWidth + spacing;
  }
}

// ========== 样式 ==========

/**
 * 构建 CSS font 字符串
 */
function buildFont(fontSize, fontWeight, fontFamily) {
  const weight = fontWeight || 'normal';
  const family = fontFamily ? '"' + fontFamily + '", sans-serif' : 'sans-serif';
  return `${weight} ${fontSize}px ${family}`;
}

/**
 * 设置文字绘制样式
 */
function setTextStyle(ctx, style) {
  ctx.font = buildFont(style.fontSize, style.fontWeight, style.fontFamily);
  ctx.fillStyle = style.fill;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
}

// ========== 时间/动画工具 ==========

/**
 * 限制时间变量范围（sin 周期为 2π）
 */
function limitTimeRange(time, max) {
  max = max || Math.PI * 2;
  if (time > max) return time - max;
  return time;
}

/**
 * 计算呼吸/脉冲强度（0 ~ 1）
 */
function calculateBreathIntensity(time, min, max) {
  min = min || 0;
  max = max || 1;
  const normalized = (Math.sin(time) + 1) / 2;
  return min + (max - min) * normalized;
}

/**
 * 是否为 Android 设备
 */
function isAndroid() {
  return IS_ANDROID;
}

module.exports = {
  hexToRgba,
  hexToNumber,
  interpolateColor,
  createGradient,
  drawHorizontalText,
  buildFont,
  setTextStyle,
  limitTimeRange,
  calculateBreathIntensity,
  isAndroid
};
