/**
 * 配置持久化存储模块
 * 抖音文字动效页配置本地缓存
 */

const STORAGE_KEY = 'douyin_text_config';

// 默认配置（与 douyin.js 中的默认配置保持一致）
const defaultConfig = {
  // 公共配置
  currentEffect: 'applyRainbowEffect',
  effectMode: 'rainbow',
  text: '双击修改文字',
  fontSize: 220,
  letterSpacing: 10,
  bgColor: '#1a1a2e',
  scrollSpeed: 5,
  fontWeight: 'normal',

  // 发光模式
  glowColor: '#ff00ff',
  glowOuterStrength: 5,
  glowDistance: 15,
  glowBreathSpeed: 2,

  // 抖动模式
  redColor: '#FF1493',
  cyanColor: '#E6E6FA',
  glitchInterval: 4,
  glitchOffsetAmplitude: 4,
  glitchBaseOffset: 2,

  // 霓虹模式
  neonColor: '#00ffff',
  neonGlowColor: '#ff00ff',
  neonCoreColor: '#ffffff',
  neonStrength: 4,
  neonFlickerSpeed: 3,

  // 彩虹模式
  rainbowColors: ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#8b00ff'],
  rainbowGradientType: 0,
  rainbowDropShadow: true,
  rainbowShadowColor: '#1152d4',
  rainbowShadowBlur: 5,
  rainbowShadowDistance: 16,

  // 波浪模式
  waveColor: '#00ffff',
  waveSize: 200,
  waveAmplitude: 50,
  waveFrequency: 2,
  waveSpeed: 6,
  waveScrollSpeed: 2,

  // 色彩循环
  colorCycleColors: ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#00ffff', '#0000ff'],
  colorCycleSpeed: 2,

  // 缩放脉冲
  scalePulseColor: '#00ffff',
  scalePulseMinScale: 0.8,
  scalePulseMaxScale: 1.2,
  scalePulseSpeed: 2
};

module.exports = {
  /**
   * 加载配置（启动时调用）
   * @returns {Object} 合并后的配置
   */
  load() {
    try {
      const saved = wx.getStorageSync(STORAGE_KEY);
      if (saved && typeof saved === 'object') {
        // 合并保存的配置和默认配置（默认配置兜底新字段）
        return { ...defaultConfig, ...saved };
      }
    } catch (e) {
      console.error('[configStore] 读取配置失败:', e);
    }
    return { ...defaultConfig };
  },

  /**
   * 保存配置
   * @param {Object} config - 要保存的配置对象
   */
  save(config) {
    if (!config || typeof config !== 'object') return;
    try {
      wx.setStorageSync(STORAGE_KEY, config);
    } catch (e) {
      console.error('[configStore] 保存配置失败:', e);
    }
  },

  /**
   * 获取默认配置
   * @returns {Object}
   */
  getDefault() {
    return { ...defaultConfig };
  },

  /**
   * 清空保存的配置（恢复默认）
   */
  clear() {
    try {
      wx.removeStorageSync(STORAGE_KEY);
    } catch (e) {
      console.error('[configStore] 清除配置失败:', e);
    }
  }
};
