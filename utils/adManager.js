/**
 * 广告管理器 — 统一管理插屏广告
 *
 * 使用方式：
 *   const adManager = require('../../utils/adManager.js');
 *   adManager.initInterstitial('adunit-xxx');
 *   adManager.showInterstitial('adunit-xxx');
 */

var _interstitials = {};

/**
 * 初始化插屏广告
 */
function initInterstitial(adUnitId) {
  if (!wx.createInterstitialAd) return;
  if (_interstitials[adUnitId]) return;

  try {
    var ad = wx.createInterstitialAd({ adUnitId: adUnitId });
    ad.onError(function (err) {
      console.error('[ad] 插屏加载失败', adUnitId, err.errCode);
    });
    ad.onClose(function () {
      console.log('[ad] 插屏关闭', adUnitId);
    });
    _interstitials[adUnitId] = ad;
  } catch (e) {
    console.error('[ad] 插屏初始化异常', adUnitId, e);
  }
}

/**
 * 展示插屏广告（有则展示，无则跳过）
 */
function showInterstitial(adUnitId) {
  if (!adUnitId || !_interstitials[adUnitId]) return false;

  try {
    _interstitials[adUnitId].show().catch(function (err) {
      console.log('[ad] 插屏展示被拒', adUnitId, err.errCode);
    });
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = {
  initInterstitial: initInterstitial,
  showInterstitial: showInterstitial
};
