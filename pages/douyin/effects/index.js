/**
 * 特效管理器
 * 统一管理和加载所有特效模块
 *
 * 每个特效模块导出：
 *   { name, key, defaultConfig, settings, createEffect() }
 *
 * createEffect() 返回一个基于 BaseEffect 的特效实例
 */

const glowModule = require('./glow.js');
const glitchModule = require('./glitch.js');
const neonModule = require('./neon.js');
const rainbowModule = require('./rainbow.js');
const waveModule = require('./wave.js');
const colorCycleModule = require('./colorCycle.js');
const scalePulseModule = require('./scalePulse.js');

// 特效模块映射
const effectModules = {
  glow: glowModule,
  glitch: glitchModule,
  neon: neonModule,
  rainbow: rainbowModule,
  wave: waveModule,
  colorCycle: colorCycleModule,
  scalePulse: scalePulseModule
};

/**
 * 获取所有特效选项（用于下拉选择器）
 * @returns {Array} 特效选项数组
 */
function getEffectOptions() {
  return [
    { text: glowModule.name, value: 'applyGlowEffect', key: glowModule.key },
    { text: glitchModule.name, value: 'applyGlitchEffect', key: glitchModule.key },
    { text: neonModule.name, value: 'applyNeonEffect', key: neonModule.key },
    { text: rainbowModule.name, value: 'applyRainbowEffect', key: rainbowModule.key },
    { text: waveModule.name, value: 'applyWaveEffect', key: waveModule.key },
    { text: colorCycleModule.name, value: 'applyColorCycleEffect', key: colorCycleModule.key },
    { text: scalePulseModule.name, value: 'applyScalePulseEffect', key: scalePulseModule.key }
  ];
}

/**
 * 获取特效模块（元数据）
 * @param {string} key - 特效标识
 * @returns {Object|null} 特效模块 { name, key, defaultConfig, settings, createEffect }
 */
function getEffect(key) {
  return effectModules[key] || null;
}

/**
 * 创建特效实例
 * @param {string} key - 特效标识
 * @returns {Object|null} 特效实例
 */
function createEffect(key) {
  var mod = effectModules[key];
  if (!mod || typeof mod.createEffect !== 'function') return null;
  return mod.createEffect();
}

/**
 * 获取所有特效的默认配置
 * @returns {Object} 合并后的默认配置
 */
function getDefaultConfig() {
  var config = {};
  Object.values(effectModules).forEach(function (effect) {
    Object.assign(config, effect.defaultConfig);
  });
  return config;
}

/**
 * 获取所有特效的设置项
 * @returns {Object} 按特效分组的设置项
 */
function getAllSettings() {
  var settings = {};
  Object.entries(effectModules).forEach(function (entry) {
    settings[entry[0]] = entry[1].settings;
  });
  return settings;
}

module.exports = {
  effectModules: effectModules,
  getEffectOptions: getEffectOptions,
  getEffect: getEffect,
  createEffect: createEffect,
  getDefaultConfig: getDefaultConfig,
  getAllSettings: getAllSettings
};
