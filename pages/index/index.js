var STORAGE_FONT_MODAL = 'font_modal_dismissed'

Page({
  data: {
    showGuide: false,
    showFontModal: false,
    guideTop: 0,
    guideLeft: 0,
    arrowOffset: 0,
    categories: [
      {
        title: '文字滚动',
        color: '#667eea',
        items: [
          {
            name: '单行滚动',
            desc: '7种特效 · 竖排展示',
            page: '/pages/single-text/single-text',
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
          }
        ]
      },
      {
        title: '效率工具',
        color: '#4facfe',
        items: [
          {
            name: '随机转盘',
            desc: '终结你的选择困难症',
            page: '/pages/wheel/wheel',
            icon: '转'
          }
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
            name: '手绘烟花',
            desc: '之间划过 · 火花迸射',
            page: '/pages/fluid/fluid',
            icon: '彩'
          }
        ]
      }
    ]
  },

  onShow: function () {
    // 字体功能弹窗：只显示一次
    try {
      var dismissed = wx.getStorageSync(STORAGE_FONT_MODAL);
      if (!dismissed) {
        this.setData({ showFontModal: true });
      }
    } catch (e) {
      this.setData({ showFontModal: true });
    }
  },

  onDismissFontModal: function () {
    this.setData({ showFontModal: false });
    try { wx.setStorageSync(STORAGE_FONT_MODAL, '1'); } catch (e) { /* ignore */ }
  },

  onTapItem: function (e) {
    var page = e.currentTarget.dataset.page;
    if (page) {
      wx.navigateTo({ url: page });
    }
  },

  onReady: function () {
    this._checkShowGuide();
  },

  // ========== 引导添加到我的小程序 ==========

  _checkShowGuide: function () {
    var self = this;

    setTimeout(function () {
      try {
        var rect = wx.getMenuButtonBoundingClientRect();
        var sysInfo = wx.getSystemInfoSync();
        // "···" 在胶囊按钮左侧，取胶囊左1/3处为箭头对准点
        var dotCenterX = rect.left + rect.width * 0.28;
        // tooltip 整体宽度估算 ~360rpx = 180px，箭头初始位于左边缘
        var tipWidth = 180;
        var tipLeft = dotCenterX - 12;
        // 边界保护
        if (tipLeft + tipWidth > sysInfo.windowWidth - 12) {
          tipLeft = sysInfo.windowWidth - tipWidth - 12;
        }
        if (tipLeft < 12) tipLeft = 12;
        // 箭头偏移量：从 tooltip 左边缘到箭头尖端的距离
        var offset = dotCenterX - tipLeft;
        self.setData({
          showGuide: true,
          guideTop: rect.bottom + 8,
          guideLeft: tipLeft,
          arrowOffset: offset
        });
      } catch (e) {
        self.setData({ showGuide: true, guideTop: 90, guideLeft: 120, arrowOffset: 20 });
      }
    }, 800);
  },

  onDismissGuide: function () {
    this.setData({ showGuide: false });
  },

  // ========== 分享 ==========

  onShareAppMessage: function () {
    return {
      title: '文字特效工具箱 — 滚动弹幕·九宫格切图·随机转盘·流光绘·手绘烟花',
      path: '/pages/index/index'
    };
  },

  onShareTimeline: function () {
    return {
      title: '文字特效工具箱 — 滚动弹幕·九宫格切图·随机转盘·流光绘·手绘烟花',
      query: ''
    };
  },

  // ========== 原生模板广告事件监听 ==========

  /** 广告加载成功 */
  onAdLoad: function () {
    console.log('[首页广告] 原生模板广告加载成功');
  },

  /** 广告加载失败 */
  onAdError: function (err) {
    console.error('[首页广告] 原生模板广告加载失败', err);
  },

  /** 广告关闭（用户点击关闭按钮） */
  onAdClose: function () {
    console.log('[首页广告] 原生模板广告已关闭');
  }
});