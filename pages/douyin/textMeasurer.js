/**
 * 文字测量工具
 * 使用 Canvas 2D ctx.measureText() 预测量文字尺寸
 * 仅在文字内容/字体大小变化时调用，不在动画循环中调用
 */

const DEFAULT_FONT_FAMILY = 'sans-serif';

/**
 * 构建 CSS font 字符串
 */
function _buildFont(fontSize, fontWeight) {
  const weight = fontWeight || 'normal';
  return `${weight} ${fontSize}px ${DEFAULT_FONT_FAMILY}`;
}

/**
 * 测量整段文字的尺寸
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D 上下文
 * @param {string} text - 文字内容
 * @param {number} fontSize - 字体大小（px）
 * @param {string} fontWeight - 字体粗细（'normal' | 'bold'）
 * @returns {{ width: number, height: number, font: string }}
 */
function measureText(ctx, text, fontSize, fontWeight) {
  if (!ctx || !text) {
    return { width: 0, height: 0, font: '' };
  }

  const font = _buildFont(fontSize, fontWeight);
  ctx.font = font;
  const metrics = ctx.measureText(text);

  return {
    width: metrics.width,
    // 高度用 fontSize 近似（Chinese CJK 字符约为 fontSize * 1.0 ~ 1.2）
    height: fontSize * 1.15,
    font: font
  };
}

/**
 * 逐字测量（用于 letterSpacing 逐字绘制场景）
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D 上下文
 * @param {string[]} chars - 字符数组
 * @param {number} fontSize - 字体大小（px）
 * @param {string} fontWeight - 字体粗细
 * @returns {Array<{ char: string, width: number, height: number }>}
 */
function measureChars(ctx, chars, fontSize, fontWeight) {
  if (!ctx || !chars || chars.length === 0) {
    return [];
  }

  const font = _buildFont(fontSize, fontWeight);
  ctx.font = font;

  return chars.map(char => {
    const metrics = ctx.measureText(char);
    return {
      char: char,
      width: metrics.width,
      height: fontSize * 1.15
    };
  });
}

/**
 * 计算横向文字总宽度（用于滚动判定）
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} fontSize
 * @param {string} fontWeight
 * @param {number} letterSpacing - 字符间距（px）
 * @returns {number} 横向文字的总宽度
 */
function calcTextWidth(ctx, text, fontSize, fontWeight, letterSpacing) {
  if (!ctx || !text || text.length === 0) {
    return 0;
  }

  const spacing = letterSpacing || 0;

  if (spacing <= 0) {
    // 无间距：直接用整段文字的宽度
    const metrics = measureText(ctx, text, fontSize, fontWeight);
    return metrics.width;
  }

  // 有间距：逐字测量并累加
  const chars = text.split('');
  const charMetrics = measureChars(ctx, chars, fontSize, fontWeight);
  let total = 0;
  charMetrics.forEach((cm, i) => {
    total += cm.width;
    if (i < charMetrics.length - 1) {
      total += spacing;
    }
  });
  return total;
}

/**
 * 计算竖排文字总高度（用于滚动判定）
 * @deprecated 使用 calcTextWidth 替代
 */
function calcVerticalTextLength(ctx, text, fontSize, fontWeight, letterSpacing) {
  if (!ctx || !text || text.length === 0) {
    return 0;
  }

  const spacing = letterSpacing || 0;

  if (spacing <= 0) {
    const metrics = measureText(ctx, text, fontSize, fontWeight);
    return metrics.width;
  }

  const chars = text.split('');
  const charMetrics = measureChars(ctx, chars, fontSize, fontWeight);
  let total = 0;
  charMetrics.forEach((cm, i) => {
    total += cm.width;
    if (i < charMetrics.length - 1) {
      total += spacing;
    }
  });
  return total;
}

module.exports = {
  measureText,
  measureChars,
  calcVerticalTextLength,
  calcTextWidth,
  _buildFont
};
