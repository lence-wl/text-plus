Page({
  data: {},

  onShareAppMessage: function () {
    return {
      title: '聊天记录生成器 — 自定义聊天截图制作工具',
      path: '/pages/chatmock/chatmock'
    };
  },

  onShareTimeline: function () {
    return {
      title: '聊天记录生成器 — 自定义聊天截图制作工具',
      query: ''
    };
  }
})
