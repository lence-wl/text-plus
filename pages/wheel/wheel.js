/**
 * 随机转盘 — Canvas 2D 渲染
 * 快捷场景 + 自定义选项 + 旋转动画 + 结果展示
 */

var STORAGE_KEY = 'random_picker_data';
var CUSTOM_SCENES_KEY = 'wheel_custom_scenes';
const adManager = require("../../utils/adManager.js");

// ========== 快捷场景 ==========

var SCENES = [
  { name: '🍚 吃什么饭',   options: ['烧饼','馒头','面条','大闸蟹','火锅','烤肉','麻辣烫'] },
  { name: '🎬 看什么电影', options: ['喜剧片','科幻片','悬疑片','动漫','恐怖片','爱情片'] },
  { name: '🌿 去哪玩',     options: ['公园','商场','海边','爬山','宅家','密室逃脱'] },
  { name: '🥤 今日饮品',   options: ['奶茶','咖啡','可乐','鲜榨果汁','白开水','啤酒'] },
  { name: '🧹 清空选项',   options: [] }
];

// ========== 转盘配色 ==========

var WHEEL_COLORS = [
  '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff',
  '#ff922b', '#845ef7', '#20c997', '#f06595',
  '#ff8787', '#ffe066', '#69db7c', '#74c0fc'
];

// ========== 工具 ==========

function randomIndex(arr) {
  return Math.floor(Math.random() * arr.length);
}

// ========== Page ==========

Page({
  data: {
    options: ['烧饼','馒头','面条','大闸蟹','火锅','烤肉','麻辣烫'],
    filteredOptions: [],
    result: '',
    resultVisible: false,
    animating: false,
    showSceneSheet: false,
    sceneActions: [],
    showDeleteSheet: false,
    deleteActions: [],
    showAd: true  // 控制广告显示
  },

  // ========== 实例变量 ==========

  _canvas: null,
  _ctx: null,
  _pixelRatio: 1,
  _canvasW: 310,
  _canvasH: 310,
  _wheelAngle: 0,
  _wheelAnimId: null,

  _initTimer: null,
  _rerollTimer: null,

  // ========== 生命周期 ==========

  onLoad: function () {
    try {
      var saved = wx.getStorageSync(STORAGE_KEY);
      if (saved && Array.isArray(saved.options) && saved.options.length > 0) {
        this.setData({ options: saved.options });
      }
    } catch (e) { /* ignore */ }
    try {
      var cs = wx.getStorageSync(CUSTOM_SCENES_KEY);
      this._customScenes = (cs && Array.isArray(cs)) ? cs : [];
    } catch (e) { this._customScenes = []; }
    this._updateFiltered();
    this._buildSceneActions();
    this._showEasterEggTip();
  },

  _showEasterEggTip: function () {
    try {
      if (wx.getStorageSync('wheel_easter_egg_v2')) return;
    } catch (e) { /* ignore */ }
    var self = this;
    setTimeout(function () {
      wx.showModal({
        title: '🤫 嘘……告诉你个秘密',
        content: '长按转盘上的某个扇区，命运就会偏向那边哦～',
        showCancel: false,
        confirmText: '我记住了',
        success: function () {
          try { wx.setStorageSync('wheel_easter_egg_v2', true); } catch (e) { /* ignore */ }
        }
      });
    }, 800);
  },

  onShow: function () {},

  onReady: function () {
    var self = this;
    // 初始化插屏广告
    adManager.initInterstitial('adunit-d40330e56e7deefc');
    
    // 进入页面5秒后展示插屏广告
    this._adTimer = setTimeout(function () {
      self._adTimer = null;
      adManager.showInterstitial('adunit-d40330e56e7deefc');
    }, 5000);
    
    this._initTimer = setTimeout(function () {
      self._initTimer = null;
      self._initCanvas();
    }, 300);
  },

  onUnload: function () {
    if (this._wheelAnimId && this._canvas) {
      this._canvas.cancelAnimationFrame(this._wheelAnimId);
    }
    if (this._initTimer) {
      clearTimeout(this._initTimer);
      this._initTimer = null;
    }
    if (this._rerollTimer) {
      clearTimeout(this._rerollTimer);
      this._rerollTimer = null;
    }
    this._save();
  },

  // ========== Canvas ==========

  _initCanvas: function () {
    var self = this;
    var query = wx.createSelectorQuery();
    query.select('#wheelCanvas').fields({ node: true, size: true }).exec(function (res) {
      if (!res || !res[0] || !res[0].node) {
        wx.showToast({ title: 'Canvas 初始化失败', icon: 'none' });
        return;
      }
      var canvas = res[0].node;
      var dpr = wx.getSystemInfoSync().pixelRatio || 2;
      self._pixelRatio = dpr;
      self._canvasW = 310;
      self._canvasH = 310;
      canvas.width = self._canvasW * dpr;
      canvas.height = self._canvasH * dpr;
      var ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      self._canvas = canvas;
      self._ctx = ctx;
      // 获取 canvas 在页面中的位置（供长按坐标转换用）
      var rectQuery = wx.createSelectorQuery().in(self);
      rectQuery.select('#wheelCanvas').boundingClientRect(function (rect) {
        self._canvasRect = rect;
      }).exec();
      self._drawWheel();
    });
  },

  // ========== 转盘绘制 ==========

  _drawWheel: function () {
    var ctx = this._ctx;
    if (!ctx) return;
    var opts = this.data.filteredOptions;
    var cw = this._canvasW, ch = this._canvasH;
    var cx = cw / 2, cy = ch / 2;
    var r = Math.min(cx, cy) - 8;

    ctx.clearRect(0, 0, cw, ch);

    // 底盘
    ctx.fillStyle = '#2a2a4a';
    ctx.beginPath(); ctx.arc(cx, cy, r + 6, 0, Math.PI * 2); ctx.fill();

    if (opts.length === 0) {
      ctx.fillStyle = '#8890a8';
      ctx.font = '16px "PingFang SC", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('点击下方 + 添加选项', cx, cy);
      return;
    }

    if (opts.length === 1) {
      ctx.fillStyle = WHEEL_COLORS[0];
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px "PingFang SC", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(opts[0], cx, cy);
      return;
    }

    var n = opts.length;
    var sliceAngle = (Math.PI * 2) / n;

    for (var i = 0; i < n; i++) {
      var start = this._wheelAngle + i * sliceAngle;
      var end = start + sliceAngle;

      // 扇区
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end);
      ctx.closePath();
      ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = 'rgba(26,26,46,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 文字
      var midAngle = start + sliceAngle / 2;
      var textR = r * 0.62;
      var tx = cx + Math.cos(midAngle) * textR;
      var ty = cy + Math.sin(midAngle) * textR;

      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(midAngle + Math.PI / 2);
      ctx.fillStyle = '#fff';
      var fontSize = Math.min(14, Math.max(10, (sliceAngle * r * 0.7) / (opts[i].length * 0.55)));
      ctx.font = 'bold ' + Math.round(fontSize) + 'px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(opts[i], 0, 0);
      ctx.restore();
    }

    // 中心圆
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px "PingFang SC", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('GO', cx, cy);

    // 指针（顶部）
    ctx.fillStyle = '#f093fb';
    ctx.beginPath();
    ctx.moveTo(cx, cy - r + 4);
    ctx.lineTo(cx - 10, cy - r - 18);
    ctx.lineTo(cx + 10, cy - r - 18);
    ctx.closePath();
    ctx.fill();
  },

  // ========== 旋转 ==========

  onCanvasTap: function () {
    if (this._skipTap) { this._skipTap = false; return; }
    this._doSpin();
  },

  onSpinTap: function () {
    this._doSpin();
  },

  onCanvasLongPress: function (e) {
    if (this.data.animating) return;
    var opts = this.data.filteredOptions;
    if (opts.length < 2) return;

    this._skipTap = true; // 阻止后续 tap 事件

    // 计算触摸点相对于 canvas 中心的角度
    var rect = this._canvasRect;
    if (!rect) return;
    var tx = e.detail.x - rect.left;
    var ty = e.detail.y - rect.top;
    var cx = this._canvasW / 2;
    var cy = this._canvasH / 2;
    var dx = tx - cx;
    var dy = ty - cy;

    // 检查是否在转盘范围内
    var dist = Math.sqrt(dx * dx + dy * dy);
    var r = Math.min(cx, cy) - 8;
    if (dist > r + 6 || dist < r * 0.18) return; // 不在扇区区域

    // 计算触摸角度 (0 指向右，顺时针)
    var touchAngle = Math.atan2(dy, dx);
    if (touchAngle < 0) touchAngle += Math.PI * 2;

    // 映射到扇区：扇区 i 的范围是 wheelAngle + i*slice 到 wheelAngle + (i+1)*slice
    var n = opts.length;
    var sliceAngle = (Math.PI * 2) / n;
    var relAngle = (touchAngle - this._wheelAngle % (Math.PI * 2) + Math.PI * 4) % (Math.PI * 2);
    var idx = Math.floor(relAngle / sliceAngle);
    if (idx >= n) idx = 0;

    wx.vibrateShort({ type: 'heavy' });
    this._doSpin(idx);
  },

  _doSpin: function (forceIdx) {
    if (this.data.animating) return;
    var opts = this.data.filteredOptions;
    if (opts.length < 2) {
      if (opts.length === 1) {
        this._showResult(opts[0]);
      } else {
        wx.showToast({ title: '请至少添加两个选项', icon: 'none' });
      }
      return;
    }

    var self = this;
    this.setData({ animating: true });
    wx.vibrateShort({ type: 'light' });

    var n = opts.length;
    var sliceAngle = 360 / n;
    var targetIdx = (forceIdx != null) ? forceIdx : randomIndex(opts);
    var targetSliceMid = targetIdx * sliceAngle + sliceAngle / 2;
    var startDeg = ((this._wheelAngle * 180 / Math.PI) % 360 + 360) % 360;
    var stopAngle = 270;
    var relSpin = (stopAngle - targetSliceMid - startDeg + 360) % 360;
    var totalSpin = 360 * 6 + relSpin;
    var startAngle = this._wheelAngle * 180 / Math.PI;
    var duration = 2500;
    var startTime = Date.now();

    function spinLoop() {
      var elapsed = Date.now() - startTime;
      var t = Math.min(elapsed / duration, 1);
      var eased = 1 - Math.pow(1 - t, 3);
      self._wheelAngle = (startAngle + totalSpin * eased) * Math.PI / 180;
      self._drawWheel();

      if (t < 1) {
        self._wheelAnimId = self._canvas.requestAnimationFrame(spinLoop);
      } else {
        self._wheelAnimId = null;
        self.setData({ animating: false });
        wx.vibrateShort({ type: 'medium' });
        self._showResult(opts[targetIdx]);
        // 旋转结束后50%概率展示插屏广告
        adManager.showInterstitial('adunit-d40330e56e7deefc');
      }
    }

    this._wheelAnimId = this._canvas.requestAnimationFrame(spinLoop);
  },

  // ========== 结果 ==========

  _showResult: function (result) {
    this.setData({ result: result, resultVisible: true });
  },

  onCloseResult: function () {
    this.setData({ resultVisible: false });
  },

  onReroll: function () {
    this.setData({ resultVisible: false });
    var self = this;
    this._rerollTimer = setTimeout(function () {
      self._rerollTimer = null;
      self.onCanvasTap();
    }, 300);
  },

  // ========== 快捷场景 ==========

  _buildSceneActions: function () {
    var actions = [];
    // 内置场景
    for (var i = 0; i < SCENES.length; i++) {
      actions.push({ name: SCENES[i].name, type: 'builtin', idx: i });
    }
    // 自定义场景
    var cs = this._customScenes || [];
    for (var j = 0; j < cs.length; j++) {
      actions.push({ name: '📌 ' + cs[j].name, type: 'custom', idx: j });
    }
    // 保存当前
    if (this.data.filteredOptions.length >= 2) {
      actions.push({ name: '💾 保存当前为场景', type: 'save' });
    }
    // 删除自定义
    if (cs.length > 0) {
      actions.push({ name: '🗑️ 删除自定义场景', type: 'delete_menu' });
    }
    this.setData({ sceneActions: actions });
  },

  onOpenScenes: function () {
    this._buildSceneActions(); // 每次打开刷新列表
    this.setData({ showSceneSheet: true });
  },

  onSceneSheetClose: function () {
    this.setData({ showSceneSheet: false });
  },

  onSceneSheetSelect: function (e) {
    var item = e.detail;
    if (!item) return;
    this.setData({ showSceneSheet: false });

    if (item.type === 'builtin') {
      var scene = SCENES[item.idx];
      if (!scene) return;
      if (scene.name === '🧹 清空选项') {
        this.setData({ options: [], result: '', resultVisible: false }, function () {
          this._updateFiltered(); this._drawWheel(); this._save();
        });
        wx.showToast({ title: '已清空', icon: 'none' });
        return;
      }
      this.setData({ options: scene.options.slice(), result: '', resultVisible: false }, function () {
        this._updateFiltered(); this._drawWheel(); this._save();
        wx.showToast({ title: '已切换至' + scene.name.replace(/[^一-龥]/g, ''), icon: 'none' });
      });
    } else if (item.type === 'custom') {
      var cs = this._customScenes[item.idx];
      if (!cs) return;
      this.setData({ options: cs.options.slice(), result: '', resultVisible: false }, function () {
        this._updateFiltered(); this._drawWheel(); this._save();
        wx.showToast({ title: '已切换至 ' + cs.name, icon: 'none' });
      });
    } else if (item.type === 'save') {
      this._onSaveScene();
    } else if (item.type === 'delete_menu') {
      this._openDeleteSheet();
    }
  },

  // ========== 保存 / 删除自定义场景 ==========

  onSaveScene: function () {
    this._onSaveScene();
  },

  _onSaveScene: function () {
    var self = this;
    var opts = this.data.filteredOptions;
    if (opts.length < 2) {
      wx.showToast({ title: '至少需要两个选项', icon: 'none' });
      return;
    }
    if (this._customScenes.length >= 10) {
      wx.showToast({ title: '自定义场景已达上限(10个)，请先删除旧的', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '保存为场景',
      editable: true,
      placeholderText: '输入场景名称',
      success: function (res) {
        if (res.confirm && res.content && res.content.trim()) {
          self._customScenes.push({
            name: res.content.trim(),
            options: opts.slice()
          });
          self._persistCustomScenes();
          wx.showToast({ title: '已保存', icon: 'success' });
        }
      }
    });
  },

  _openDeleteSheet: function () {
    var cs = this._customScenes;
    var actions = cs.map(function (s, i) {
      return { name: '📌 ' + s.name, idx: i };
    });
    this.setData({ deleteActions: actions, showDeleteSheet: true });
  },

  onDeleteSheetClose: function () {
    this.setData({ showDeleteSheet: false });
  },

  onDeleteSheetSelect: function (e) {
    var item = e.detail;
    if (!item) return;
    var self = this;
    var cs = this._customScenes[item.idx];
    wx.showModal({
      title: '删除场景',
      content: '确定删除「' + cs.name + '」？',
      confirmText: '删除',
      confirmColor: '#ff4757',
      success: function (r) {
        if (r.confirm) {
          self._customScenes.splice(item.idx, 1);
          self._persistCustomScenes();
          self.setData({ showDeleteSheet: false });
          wx.showToast({ title: '已删除', icon: 'none' });
        }
      }
    });
  },

  _persistCustomScenes: function () {
    try {
      wx.setStorageSync(CUSTOM_SCENES_KEY, this._customScenes);
    } catch (e) { /* ignore */ }
  },

  // ========== 选项管理 ==========

  _updateFiltered: function () {
    var filtered = this.data.options.filter(function (o) {
      return o && String(o).trim().length > 0;
    }).map(function (o) { return String(o).trim(); });
    this.setData({ filteredOptions: filtered });
  },

  onAddOption: function () {
    var self = this;
    wx.showModal({
      title: '添加选项',
      editable: true,
      placeholderText: '输入选项名称',
      success: function (res) {
        if (res.confirm && res.content && res.content.trim()) {
          var list = self.data.options.concat([res.content.trim()]);
          self.setData({ options: list, result: '', resultVisible: false }, function () {
            self._updateFiltered(); self._drawWheel(); self._save();
          });
        }
      }
    });
  },

  onDeleteOption: function (e) {
    var index = e.currentTarget.dataset.index;
    var list = this.data.options.slice();
    list.splice(index, 1);
    this.setData({ options: list, result: '', resultVisible: false }, function () {
      this._updateFiltered(); this._drawWheel(); this._save();
    });
  },

  // ========== 持久化 ==========

  _save: function () {
    try {
      wx.setStorageSync(STORAGE_KEY, { options: this.data.options });
    } catch (e) { /* ignore */ }
  },

  // ========== 分享 ==========

  onShareAppMessage: function () {
    var opts = this.data.filteredOptions;
    var desc = '';
    if (opts.length >= 2) {
      desc = '「' + opts.slice(0, 4).join('·') + (opts.length > 4 ? '…' : '') + '」';
      return {
        title: '随机转盘' + (desc ? ' — ' + desc : ' — 终结你的选择困难症'),
        path: '/pages/wheel/wheel'
      };
    }
    return {
      title: '随机转盘 — 终结你的选择困难症',
      path: '/pages/wheel/wheel'
    };
  },

  onShareTimeline: function () {
    var opts = this.data.filteredOptions;
    var desc = '';
    if (opts.length >= 2) {
      desc = '「' + opts.slice(0, 4).join('·') + (opts.length > 4 ? '…' : '') + '」';
      return {
        title: '随机转盘' + (desc ? ' — ' + desc : ' — 终结你的选择困难症'),
        query: ''
      };
    }
    return {
      title: '随机转盘 — 终结你的选择困难症',
      query: ''
    };
  },

  // ========== 原生模板广告事件监听 ==========

  /** 广告加载成功 */
  adLoad: function () {
    console.log('[转盘广告] 原生模板广告加载成功');
  },

  /** 广告加载失败 */
  adError: function (err) {
    console.error('[转盘广告] 原生模板广告加载失败', err);
    // 加载失败时隐藏广告容器，避免空白占位
    this.setData({ showAd: false });
  },

  /** 广告关闭（用户点击关闭按钮） */
  adClose: function () {
    console.log('[转盘广告] 原生模板广告已关闭');
    // 用户关闭广告后隐藏容器
    this.setData({ showAd: false });
  }
});
