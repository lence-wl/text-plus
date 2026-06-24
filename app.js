// app.js
App({
  interstitialAd: null,
  _adLoaded: false,
  _lastShowTime: 0,

  onLaunch() {
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    wx.login({
      success: res => {
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
      }
    })

    // 插屏广告
    if (wx.createInterstitialAd) {
      this.interstitialAd = wx.createInterstitialAd({
        adUnitId: '你的广告单元ID'           // ← 替换为正式 adUnitId
      })

      this.interstitialAd.onLoad(() => {
        console.log('[广告] 已加载就绪')
        this._adLoaded = true
      })

      this.interstitialAd.onError(err => {
        console.error('[广告] 加载失败', err)
        this._adLoaded = false
      })

      this.interstitialAd.onClose(() => {
        console.log('[广告] 已关闭，重新预加载')
        this._adLoaded = false
        this.interstitialAd.load()
      })

      this.interstitialAd.load()
    } else {
      console.log('[广告] wx.createInterstitialAd 不可用（开发工具/低版本不支持）')
    }
  },

  showInterstitial() {
    if (!this.interstitialAd) {
      console.log('[广告] 实例不存在，跳过')
      return
    }

    const now = Date.now()
    if (now - this._lastShowTime < 30000) {
      console.log('[广告] 频控中，距上次展示', Math.round((now - this._lastShowTime) / 1000), '秒')
      return
    }

    if (this._adLoaded) {
      console.log('[广告] 尝试展示...')
      this._lastShowTime = now
      this.interstitialAd.show().then(() => {
        console.log('[广告] 展示成功')
      }).catch(err => {
        console.error('[广告] 展示失败', err)
        this._adLoaded = false
        this.interstitialAd.load()
      })
    } else {
      console.log('[广告] 尚未加载，触发 load 等待下次')
      this.interstitialAd.load()
    }
  },

  globalData: {
    userInfo: null
  }
})
