/**
 * 粒子喷泉 — 多笔画，每笔独立效果
 */

var STORAGE_KEY = 'fluid_config';

var PALETTES = [
  { name: '极光', colors: ['#00e5ff','#00b0ff','#7c4dff','#e040fb'] },
  { name: '火焰', colors: ['#ff6d00','#ff9100','#ff3d00','#ffea00'] },
  { name: '海洋', colors: ['#00b0ff','#00e676','#1de9b6','#80d8ff'] },
  { name: '樱花', colors: ['#ff4081','#f50057','#ff80ab','#ffc1cc'] },
];

var DEFAULTS = {
  paletteIdx: 0,
  particleSize: 3,
  emitRate: 6,
  spraySpeed: 1,
  gravity: 10,
  trailFade: 5,
};

Page({
  data: {
    cfg: { ...DEFAULTS },
    currentPalette: PALETTES[0],
    showSettings: false,
  },

  _canvas: null, _ctx: null, _dpr: 1, _sw: 0, _sh: 0,
  _animId: null,
  _particles: [],
  _strokes: [],        // [{ points, paletteIdx }]
  _curStroke: null,    // 当前正在画的笔画
  _gx: 0, _gy: 0.03,

  onLoad: function () {
    try {
      var s = wx.getStorageSync(STORAGE_KEY);
      if (s && typeof s === 'object') {
        var c = { ...DEFAULTS, ...s };
        this.setData({ cfg: c, currentPalette: PALETTES[c.paletteIdx || 0] });
      }
    } catch (e) {}
  },

  onShow: function () {
    getApp().showInterstitial();
  },

  onReady: function () {
    var self = this;
    setTimeout(function () { self._init(); }, 200);
  },

  onUnload: function () {
    if (this._animId && this._canvas) this._canvas.cancelAnimationFrame(this._animId);
    wx.stopAccelerometer();
    try { wx.setStorageSync(STORAGE_KEY, this.data.cfg); } catch (e) {}
  },

  _init: function () {
    var info = wx.getSystemInfoSync();
    this._dpr = info.pixelRatio || 2;
    this._sw = info.screenWidth; this._sh = info.screenHeight;
    var self = this;
    wx.createSelectorQuery().select('#fluidCanvas').fields({ node: true, size: true }).exec(function (res) {
      if (!res || !res[0] || !res[0].node) return;
      var c = res[0].node, d = self._dpr;
      c.width = self._sw * d; c.height = self._sh * d;
      var ctx = c.getContext('2d'); ctx.scale(d, d);
      self._canvas = c; self._ctx = ctx;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, self._sw, self._sh);
      self._startAccel();
      self._loop();
    });
  },

  _startAccel: function () {
    var self = this;
    wx.onAccelerometerChange(function (res) {
      self._gx = res.x * 0.06;
      self._gy = -res.y * 0.06;
    });
    wx.startAccelerometer({ interval: 'game' });
  },

  _loop: function () {
    var self = this;
    function tick() { self._animId = self._canvas.requestAnimationFrame(tick); self._up(); self._draw(); }
    self._animId = self._canvas.requestAnimationFrame(tick);
  },

  _up: function () {
    if (this._strokes.length === 0) return;
    var cfg = this.data.cfg;
    var particles = this._particles;
    var sw = this._sw, sh = this._sh;

    // 发射新粒子
    var maxNew = Math.min(cfg.emitRate, 250 - particles.length);
    for (var i = 0; i < maxNew; i++) {
      var stroke = this._strokes[Math.floor(Math.random() * this._strokes.length)];
      if (!stroke || stroke.points.length === 0) continue;
      var pt = stroke.points[Math.floor(Math.random() * stroke.points.length)];
      var pidx = stroke.paletteIdx != null ? stroke.paletteIdx : cfg.paletteIdx;
      var pal = PALETTES[pidx].colors;
      var a = Math.random() * Math.PI * 2;
      var sp = 1 + Math.random() * cfg.spraySpeed;
      particles.push({
        x: pt.x, y: pt.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - cfg.spraySpeed * 0.3,
        life: 25 + Math.random() * 55, max: 80,
        c: pal[Math.floor(Math.random() * pal.length)],
        s: cfg.particleSize * 0.3 + Math.random() * cfg.particleSize * 0.4
      });
    }

    // 更新 + 淘汰
    var grav = cfg.gravity / 100;
    for (var j = particles.length - 1; j >= 0; j--) {
      var o = particles[j];
      o.x += o.vx; o.y += o.vy;
      o.vx += this._gx * grav * 30;
      o.vy += this._gy * grav * 30;
      o.life--;
      if (o.life <= 0 || o.x < -50 || o.x > sw + 50 || o.y < -50 || o.y > sh + 50) {
        particles.splice(j, 1);
      }
    }
  },

  _draw: function () {
    var ctx = this._ctx, sw = this._sw, sh = this._sh, cfg = this.data.cfg;
    var particles = this._particles;
    if (particles.length === 0) return;

    var fade = 0.02 + cfg.trailFade * 0.02;
    ctx.globalAlpha = Math.min(1, fade);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, sw, sh);

    // 一次性画所有粒子，不逐粒改 globalAlpha（用 rgba 控制透明度）
    for (var i = 0; i < particles.length; i++) {
      var o = particles[i];
      var a = o.life / o.max;
      if (a <= 0) continue;
      var r = o.s * 0.7;
      // 外层
      ctx.fillStyle = o.c;
      ctx.globalAlpha = a * 0.12;
      ctx.beginPath(); ctx.arc(o.x, o.y, r * 2, 0, Math.PI * 2); ctx.fill();
      // 核心
      ctx.globalAlpha = a * 0.65;
      ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  },

  // ========== 触摸 ==========

  onTouchStart: function (e) {
    var t = e.touches[0];
    // 新笔画，记录当前设置
    this._curStroke = {
      points: [{ x: t.x, y: t.y }],
      paletteIdx: this.data.cfg.paletteIdx,
    };
    this._strokes.push(this._curStroke);
    if (this._strokes.length > 20) this._strokes.shift();
  },

  onTouchMove: function (e) {
    if (!this._curStroke) return;
    var t = e.touches[0];
    var pts = this._curStroke.points;
    var last = pts[pts.length - 1];
    var dx = t.x - last.x, dy = t.y - last.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 4) {
      var n = Math.floor(dist / 4);
      for (var i = 1; i <= n; i++) {
        pts.push({ x: last.x + dx * i / n, y: last.y + dy * i / n });
      }
      if (pts.length > 2000) pts.splice(0, pts.length - 2000);
    }
  },

  onTouchEnd: function () { this._curStroke = null; },

  // ========== 操作 ==========

  toggleSettings: function () { this.setData({ showSettings: !this.data.showSettings }); },
  closeSettings: function () { this.setData({ showSettings: false }); },

  onSize:     function (e) { this.setData({ 'cfg.particleSize': e.detail }); },
  onRate:     function (e) { this.setData({ 'cfg.emitRate': e.detail }); },
  onSpeed:    function (e) { this.setData({ 'cfg.spraySpeed': e.detail }); },
  onGravity:  function (e) { this.setData({ 'cfg.gravity': e.detail }); },
  onFade:     function (e) { this.setData({ 'cfg.trailFade': e.detail }); },

  onPalette: function () {
    var i = (this.data.cfg.paletteIdx + 1) % PALETTES.length;
    this.setData({ 'cfg.paletteIdx': i, currentPalette: PALETTES[i] });
    try { wx.setStorageSync(STORAGE_KEY, this.data.cfg); } catch (e) {}
  },

  onClear: function () {
    this._particles = []; this._strokes = []; this._curStroke = null;
    var ctx = this._ctx;
    if (ctx) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, this._sw, this._sh);
    }
  }
});
