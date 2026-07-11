Page({
  data: {},

  onShareAppMessage: function () {
    return {
      title: '电子时钟 — 全屏数字时钟，简约桌面时钟',
      path: '/pages/clock/clock'
    };
  },

  onShareTimeline: function () {
    return {
      title: '电子时钟 — 全屏数字时钟，简约桌面时钟',
      query: ''
    };
  }
})
