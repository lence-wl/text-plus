/**
 * 随机转盘 — Canvas 2D 渲染
 * 快捷场景 + 自定义选项 + 旋转动画 + 结果展示
 */

var STORAGE_KEY = 'random_picker_data';

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
    sceneActions: []
  },

  // ========== 实例变量 ==========

  _canvas: null,
  _ctx: null,
  _pixelRatio: 1,
  _canvasW: 310,
  _canvasH: 310,
  _wheelAngle: 0,
  _wheelAnimId: null,

  // ========== 生命周期 ==========

  onLoad: function () {
    try {
      var saved = wx.getStorageSync(STORAGE_KEY);
      if (saved && Array.isArray(saved.options) && saved.options.length > 0) {
        this.setData({ options: saved.options });
      }
    } catch (e) { /* ignore */ }
    this._updateFiltered();
    this._buildSceneActions();
  },

  onShow: function () {
    getApp().showInterstitial();
  },

  onReady: function () {
    var self = this;
    setTimeout(function () { self._initCanvas(); }, 300);
  },

  onUnload: function () {
    if (this._wheelAnimId && this._canvas) {
      this._canvas.cancelAnimationFrame(this._wheelAnimId);
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
    var targetIdx = randomIndex(opts);
    var targetSliceMid = targetIdx * sliceAngle + sliceAngle / 2;
    var totalSpin = 360 * 6 + (360 - targetSliceMid);
    var startAngle = this._wheelAngle * 180 / Math.PI;
    var duration = 2500;
    var startTime = Date.now();

    function spinLoop() {
      var elapsed = Date.now() - startTime;
      var t = Math.min(elapsed / duration, 1);
      var eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      self._wheelAngle = (startAngle + totalSpin * eased) * Math.PI / 180;
      self._drawWheel();

      if (t < 1) {
        self._wheelAnimId = self._canvas.requestAnimationFrame(spinLoop);
      } else {
        self._wheelAnimId = null;
        self.setData({ animating: false });
        wx.vibrateShort({ type: 'medium' });
        self._showResult(opts[targetIdx]);
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
    setTimeout(function () { self.onCanvasTap(); }, 300);
  },

  // ========== 快捷场景 ==========

  _buildSceneActions: function () {
    var actions = SCENES.map(function (s) { return { name: s.name }; });
    this.setData({ sceneActions: actions });
  },

  onOpenScenes: function () {
    this.setData({ showSceneSheet: true });
  },

  onSceneSheetClose: function () {
    this.setData({ showSceneSheet: false });
  },

  onSceneSheetSelect: function (e) {
    var item = e.detail;
    if (!item) return;
    var scene = SCENES.find(function (s) { return s.name === item.name; });
    if (!scene) return;
    this.setData({ showSceneSheet: false });
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
  }
});
