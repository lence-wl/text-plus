var STORAGE_FONT_MODAL = 'font_modal_dismissed'
var fontLoader = require('../../utils/fontLoader.js')

Page({
  data: {
    showGuide: false,
    showFontModal: false,
    guideTop: 0,
    guideLeft: 0,
    arrowOffset: 0,
    scrollFonts: [],
    multiScrollFonts: [],
    singlePreviewStyle: '',
    multiPreviewStyle: '',
    singleEffectClass: '',
    multiEffectClass: '',
    singleEffectMode: '',
    multiGlowColor: '',
    singleScrollText: '',
    multiScrollLines: [],
    singleActiveFont: 0,
    multiActiveFont: 0,
    categories: [
      {
        key: 'scroll',
        title: '文字滚动',
        color: '#667eea',
        items: [
          {
            name: '单行滚动',
            desc: 'LED字幕 · 7种特效 · 竖排滚动',
            page: '/pages/single-text/single-text',
            icon: '一'
          },
          {
            name: '多行滚动',
            desc: '弹幕生成 · 多行上滚 · 发光效果',
            page: '/pages/scroll-multi/multi',
            icon: '三'
          }
        ]
      },
      {
        key: 'grid',
        title: '九宫格',
        color: '#f093fb',
        items: [
          {
            name: '九宫格切字',
            desc: '一字九图 · 朋友圈文字排版',
            page: '/pages/gridcut/gridcut',
            icon: '字'
          },
          {
            name: '九宫格切图',
            desc: '一图九格 · 朋友圈图片排版',
            page: '/pages/photocut/photo-cut',
            icon: '图'
          }
        ]
      },
      {
        key: 'tools',
        title: '效率工具',
        color: '#4facfe',
        items: [
          {
            name: '随机转盘',
            desc: '抽奖转盘 · 终结选择困难症',
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
            desc: '丝绸绘画 · 光影艺术',
            page: '/pages/silk/silk',
            icon: '丝'
          },
          {
            name: '手绘烟花',
            desc: '指尖烟花 · 粒子特效',
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

    // 随机选取3个中文字体
    this._loadRandomFonts();
    // 随机特效
    this._randomEffect();
    // 从二级页面返回后重新注册字体（避免被覆盖）
    this._reloadActiveFonts();
  },

  _reloadActiveFonts: function () {
    var self = this;
    var singleFonts = self.data.scrollFonts;
    var multiFonts = self.data.multiScrollFonts;
    if (!singleFonts.length && !multiFonts.length) return;

    // 重新注册预览字体（每次 onShow 强制重注，因为去掉 global 后是页面级注册）
    fontLoader.resetPreviewCache();
    var allPicked = singleFonts.concat(multiFonts);
    fontLoader.loadPreviewFonts(allPicked);

    // 重新注册活跃字体的子集
    var sIdx = self.data.singleActiveFont;
    var mIdx = self.data.multiActiveFont;
    var sFont = singleFonts[sIdx];
    var mFont = multiFonts[mIdx];
    if (sFont && self.data.singleScrollText) {
      fontLoader.loadFont(sFont.name, self.data.singleScrollText, function (ok) {
        if (ok) self.setData({ singlePreviewStyle: 'font-family:' + sFont.name + ';' });
      });
    }
    if (mFont && self.data.multiScrollLines.length) {
      fontLoader.loadFont(mFont.name, self.data.multiScrollLines.join(''), function (ok) {
        if (ok) self.setData({ multiPreviewStyle: 'font-family:' + mFont.name + ';' });
      });
    }
  },

  _randomEffect: function () {
    var singleTexts = [
      '双击修改文字，选择你喜欢的特效',
      '今天天气真好，适合出去走走',
      '愿你被这世界温柔以待',
      '生活不止眼前的苟且',
      '一切都是最好的安排',
      '星光不问赶路人',
      '你若盛开蝴蝶自来'
    ];
    var multiLyrics = [
      ['我竟然没有调头', '最残忍那一刻', '静静看你走', '一点都不像我', '原来人会变得温柔', '是透彻的懂了'],
      ['后来', '我总算学会了', '如何去爱', '可惜你', '早已远去', '消失在人海'],
      ['夜空中最亮的星', '能否听清', '那仰望的人', '心底的孤独和叹息', '夜空中最亮的星', '能否记起'],
      ['我曾经跨过山和大海', '也穿过人山人海', '我曾经拥有着的一切', '转眼都飘散如烟', '我曾经失落失望', '失掉所有方向']
    ];
    var singleEffects = [
      { cls: 'single-rainbow', mode: 'rainbow' },
      { cls: 'single-glow', mode: 'glow' },
      { cls: 'single-neon', mode: 'neon' },
      { cls: 'single-gold', mode: 'glow' }
    ];
    var multiEffects = [
      { cls: 'multi-glow', color: '#ff66ff' },
      { cls: 'multi-cyan', color: '#00d4ff' },
      { cls: 'multi-gold', color: '#ffd700' },
      { cls: 'multi-warm', color: '#ff6b6b' }
    ];

    var st = singleTexts[Math.floor(Math.random() * singleTexts.length)];
    var ml = multiLyrics[Math.floor(Math.random() * multiLyrics.length)];
    var se = singleEffects[Math.floor(Math.random() * singleEffects.length)];
    var me = multiEffects[Math.floor(Math.random() * multiEffects.length)];

    this.setData({
      singleEffectClass: se.cls,
      singleEffectMode: se.mode,
      multiEffectClass: me.cls,
      multiGlowColor: me.color,
      singleScrollText: st,
      multiScrollLines: ml
    });
  },

  _loadRandomFonts: function () {
    var self = this;
    if (self.data.scrollFonts.length > 0) return;
    fontLoader.getFontList().then(function (list) {
      var zhFonts = list.filter(function (f) { return f.lang !== 'en'; });
      var shuffled = zhFonts.sort(function () { return Math.random() - 0.5; });
      var single = shuffled.slice(0, 4);
      var multi = shuffled.slice(4, 8);

      if (single.length === 0 && multi.length === 0) return;

      // 标签预览：loadPreviewFonts
      var allPicked = single.concat(multi);
      fontLoader.loadPreviewFonts(allPicked, function (count) {
        self.setData({
          scrollFonts: single,
          multiScrollFonts: multi,
          _scrollFontVersion: count
        });
      });

      // 滚动文字子集化：内容 + 标签预览字合并发送，确保所有字都有字体
      var singleText = self.data.singleScrollText;
      var multiText = self.data.multiScrollLines.join('');
      if (single.length && singleText) {
        fontLoader.loadFont(single[0].name, singleText, function (ok) {
          if (ok) self.setData({ singlePreviewStyle: 'font-family:' + single[0].name + ';' });
        });
      }
      if (multi.length && multiText) {
        fontLoader.loadFont(multi[0].name, multiText, function (ok) {
          if (ok) self.setData({ multiPreviewStyle: 'font-family:' + multi[0].name + ';' });
        });
      }
    });
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

  onSingleFreeUse: function () {
    var idx = this.data.singleActiveFont;
    var font = this.data.scrollFonts[idx] ? this.data.scrollFonts[idx].name : '';
    var cfg = encodeURIComponent(JSON.stringify({
      effectMode: this.data.singleEffectMode,
      fontFamily: font
    }));
    wx.navigateTo({ url: '/pages/single-text/single-text?cfg=' + cfg });
  },

  onSwitchSingleFont: function (e) {
    var idx = e.currentTarget.dataset.index;
    var font = this.data.scrollFonts[idx];
    if (!font || idx === this.data.singleActiveFont) return;
    var self = this;
    fontLoader.loadFont(font.name, self.data.singleScrollText, function (ok) {
      if (ok) self.setData({ singleActiveFont: idx, singlePreviewStyle: 'font-family:' + font.name + ';' });
    });
  },

  onSwitchMultiFont: function (e) {
    var idx = e.currentTarget.dataset.index;
    var font = this.data.multiScrollFonts[idx];
    if (!font || idx === this.data.multiActiveFont) return;
    var self = this;
    fontLoader.loadFont(font.name, self.data.multiScrollLines.join(''), function (ok) {
      if (ok) self.setData({ multiActiveFont: idx, multiPreviewStyle: 'font-family:' + font.name + ';' });
    });
  },

  onMultiFreeUse: function () {
    var idx = this.data.multiActiveFont;
    var font = this.data.multiScrollFonts[idx] ? this.data.multiScrollFonts[idx].name : '';
    var cfg = encodeURIComponent(JSON.stringify({
      config: {
        glowEnabled: true,
        glowColor: this.data.multiGlowColor,
        fontFamily: font
      }
    }));
    wx.navigateTo({ url: '/pages/scroll-multi/multi?cfg=' + cfg });
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