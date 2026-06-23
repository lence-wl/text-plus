Component({
  properties: {
    /** 返回的页面层级，默认 1 */
    delta: {
      type: Number,
      value: 1
    }
  },

  data: {
    top: '60rpx' // fallback
  },

  lifetimes: {
    attached() {
      try {
        const rect = wx.getMenuButtonBoundingClientRect()
        // 让返回按钮与胶囊按钮中心线水平对齐
        const top = rect.top + rect.height / 2
        this.setData({ top: top + 'px' })
      } catch (e) {
        // 获取失败时使用 fallback
      }
    }
  },

  methods: {
    onTap() {
      wx.navigateBack({ delta: this.properties.delta })
    }
  }
})
