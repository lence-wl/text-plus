Page({
  data: {},

  onShareAppMessage: function () {
    return {
      title: '文字壁纸 — 文字图片一键生成，多种字体样式',
      path: '/pages/wallpaper/wallpaper'
    };
  },

  onShareTimeline: function () {
    return {
      title: '文字壁纸 — 文字图片一键生成，多种字体样式',
      query: ''
    };
  }
})
