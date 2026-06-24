Page({
  data: {
    categories: [
      {
        title: '文字滚动',
        color: '#667eea',
        items: [
          {
            name: '单行滚动',
            desc: '7种特效 · 竖排展示',
            page: '/pages/douyin/douyin',
            icon: '一'
          },
          {
            name: '多行滚动',
            desc: '多行上滚 · 发光效果',
            page: '/pages/scroll-multi/multi',
            icon: '三'
          }
        ]
      },
      {
        title: '九宫格',
        color: '#f093fb',
        items: [
          // {
          //   name: '文字壁纸',
          //   desc: '名言排版 · 保存分享',
          //   page: '/pages/wallpaper/wallpaper',
          //   icon: '壁'
          // },
          {
            name: '九宫格切字',
            desc: '一字九图 · 朋友圈',
            page: '/pages/gridcut/gridcut',
            icon: '字'
          },
					{
            name: '九宫格切图',
            desc: '一图九图 · 朋友圈',
            page: '/pages/photocut/photo-cut',
            icon: '图'
          },
          // {
          //   name: '聊天记录',
          //   desc: '模拟截图 · 搞笑传播',
          //   page: '/pages/chatmock/chatmock',
          //   icon: '聊'
          // }
        ]
      },
      {
        title: '效率工具',
        color: '#4facfe',
        items: [
          // {
          //   name: '倒计时',
          //   desc: '纪念日 · 重要时刻不错过',
          //   page: '/pages/countdown/countdown',
          //   icon: '倒'
          // },
          {
            name: '随机转盘',
            desc: '终结你的选择困难症',
            page: '/pages/wheel/wheel',
            icon: '转'
          },
          // {
          //   name: '电子时钟',
          //   desc: '4种风格 · 全屏',
          //   page: '/pages/clock/clock',
          //   icon: '钟'
          // }
        ]
      },
      {
        title: '趣味互动',
        color: '#43e97b',
        items: [
          {
            name: '流光绘',
            desc: 'WeaveSilk引擎 · 丝光流影',
            page: '/pages/silk/silk',
            icon: '丝'
          },
          {
            name: '粒子喷泉',
            desc: '画圈成门 · 火花迸射',
            page: '/pages/fluid/fluid',
            icon: '粒'
          }
        ]
      }
    ]
  },

  onTapItem: function (e) {
    var page = e.currentTarget.dataset.page;
    if (page) {
      wx.navigateTo({ url: page });
    }
  }
});