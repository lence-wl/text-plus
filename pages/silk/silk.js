/**
 * Silk 流光绘 — 基于 weavesilk.com 引擎的完整移植
 *
 * 核心机制：
 *   1. 弹簧粒子链 + 3D Perlin噪声 + 旋转/镜像/螺旋对称
 *   2. additive blending (lighter) 实现自然光晕
 *   3. HCL 颜色空间插值，过渡自然鲜艳
 *   4. 二次贝塞尔曲线绘制，线条流畅
 *   5. 独立火花粒子系统
 *   6. 多步物理/帧，线条更密集
 */

const adManager = require("../../utils/adManager.js");

// ===================================================================
// 1. UTILITY: Perlin 3D Noise (port from weavesilk noise.js)
// ===================================================================

var PERM = [];
(function initPerm() {
  for (var i = 0; i < 256; i++) PERM[i] = i;
  for (var i = 255; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = PERM[i]; PERM[i] = PERM[j]; PERM[j] = tmp;
  }
  for (var i = 0; i < 256; i++) PERM[i + 256] = PERM[i];
})();

function noiseFade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function noiseLerp(a, b, t) { return a + t * (b - a); }

function grad3d(hash, x, y, z) {
  switch (hash & 0xF) {
    case 0x0: return  x + y;
    case 0x1: return -x + y;
    case 0x2: return  x - y;
    case 0x3: return -x - y;
    case 0x4: return  x + z;
    case 0x5: return -x + z;
    case 0x6: return  x - z;
    case 0x7: return -x - z;
    case 0x8: return  y + z;
    case 0x9: return -y + z;
    case 0xA: return  y - z;
    case 0xB: return -y - z;
    case 0xC: return  y + x;
    case 0xD: return -y + z;
    case 0xE: return  y - x;
    case 0xF: return -y - z;
    default: return 0;
  }
}

function noise3d(x, y, z) {
  var X = (x | 0) & 255, Y = (y | 0) & 255, Z = (z | 0) & 255;
  x -= (x | 0); y -= (y | 0); z -= (z | 0);
  var fx = noiseFade(x), fy = noiseFade(y), fz = noiseFade(z);
  var p0 = PERM[X] + Y;
  var p00 = PERM[p0] + Z, p01 = PERM[p0 + 1] + Z;
  var p1 = PERM[X + 1] + Y;
  var p10 = PERM[p1] + Z, p11 = PERM[p1 + 1] + Z;
  return noiseLerp(fz,
    noiseLerp(fy, noiseLerp(fx, grad3d(PERM[p00], x, y, z), grad3d(PERM[p10], x-1, y, z)),
                 noiseLerp(fx, grad3d(PERM[p01], x, y-1, z), grad3d(PERM[p11], x-1, y-1, z))),
    noiseLerp(fy, noiseLerp(fx, grad3d(PERM[p00 + 1], x, y, z-1), grad3d(PERM[p10 + 1], x-1, y, z-1)),
                 noiseLerp(fx, grad3d(PERM[p01 + 1], x, y-1, z-1), grad3d(PERM[p11 + 1], x-1, y-1, z-1)))
  );
}

function perlinNoise(x, y, z, octaves, fallout) {
  var effect = 1, k = 1, sum = 0;
  for (var i = 0; i < octaves; i++) {
    effect *= fallout;
    sum += effect * (1 + noise3d(k * x, k * y, k * z)) / 2;
    k *= 2;
  }
  return sum;
}

// ===================================================================
// 2. UTILITY: HCL 颜色空间 (port from d3-interpolate)
// ===================================================================

function hexToRgb(hex) {
  var m = /^#?([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i.exec(hex);
  return m ? {
    r: parseInt(m[1], 16),
    g: parseInt(m[2], 16),
    b: parseInt(m[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

function rgbToHex(c) {
  return '#' + [c.r, c.g, c.b].map(function(v) {
    var h = Math.round(Math.max(0, Math.min(255, v))).toString(16);
    return h.length < 2 ? '0' + h : h;
  }).join('');
}

// D65 reference white
var Xn = 0.950470, Yn = 1, Zn = 1.088830;
var t0 = 4 / 29, t1 = 6 / 29, t2 = 3 * t1 * t1, t0cub = t0 * t0 * t0;

function rgbToXyz(c) {
  var r = c.r / 255, g = c.g / 255, b = c.b / 255;
  // sRGB linearization
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
  // sRGB → XYZ (D65)
  return {
    x: (0.4124564 * r + 0.3575761 * g + 0.1804375 * b),
    y: (0.2126729 * r + 0.7151522 * g + 0.0721750 * b),
    z: (0.0193339 * r + 0.1191920 * g + 0.9503041 * b)
  };
}

function xyzToLab(c) {
  var x = c.x / Xn, y = c.y / Yn, z = c.z / Zn;
  var fx = x > t0cub ? Math.pow(x, 1/3) : x / t2 + t0;
  var fy = y > t0cub ? Math.pow(y, 1/3) : y / t2 + t0;
  var fz = z > t0cub ? Math.pow(z, 1/3) : z / t2 + t0;
  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz)
  };
}

function labToHcl(lab) {
  var h = Math.atan2(lab.b, lab.a) * 180 / Math.PI;
  if (h < 0) h += 360;
  return {
    h: h,
    c: Math.sqrt(lab.a * lab.a + lab.b * lab.b),
    l: lab.l
  };
}

function hclToLab(hcl) {
  var hr = hcl.h * Math.PI / 180;
  return {
    l: hcl.l,
    a: Math.cos(hr) * hcl.c,
    b: Math.sin(hr) * hcl.c
  };
}

function labToXyz(lab) {
  var fy = (lab.l + 16) / 116;
  var fx = lab.a / 500 + fy;
  var fz = fy - lab.b / 200;
  var fx3 = fx * fx * fx, fy3 = fy * fy * fy, fz3 = fz * fz * fz;
  var x = fx3 > t0cub ? fx3 : (fx - t0) * t2;
  var y = fy3 > t0cub ? fy3 : (fy - t0) * t2;
  var z = fz3 > t0cub ? fz3 : (fz - t0) * t2;
  return { x: x * Xn, y: y * Yn, z: z * Zn };
}

function xyzToRgb(c) {
  // XYZ → linear sRGB
  var r =  3.2404542 * c.x - 1.5371385 * c.y - 0.4985314 * c.z;
  var g = -0.9692660 * c.x + 1.8760108 * c.y + 0.0415560 * c.z;
  var b =  0.0556434 * c.x - 0.2040259 * c.y + 1.0572252 * c.z;
  // Gamma
  r = r > 0.0031308 ? 1.055 * Math.pow(r, 1/2.4) - 0.055 : 12.92 * r;
  g = g > 0.0031308 ? 1.055 * Math.pow(g, 1/2.4) - 0.055 : 12.92 * g;
  b = b > 0.0031308 ? 1.055 * Math.pow(b, 1/2.4) - 0.055 : 12.92 * b;
  return {
    r: Math.max(0, Math.min(255, Math.round(r * 255))),
    g: Math.max(0, Math.min(255, Math.round(g * 255))),
    b: Math.max(0, Math.min(255, Math.round(b * 255)))
  };
}

function hclInterpolate(startHex, endHex) {
  var startRgb = hexToRgb(startHex);
  var endRgb = hexToRgb(endHex);
  var startHcl = labToHcl(xyzToLab(rgbToXyz(startRgb)));
  var endHcl = labToHcl(xyzToLab(rgbToXyz(endRgb)));

  // Handle hue shortest-path
  var dh = endHcl.h - startHcl.h;
  if (dh > 180) endHcl.h -= 360;
  else if (dh < -180) endHcl.h += 360;

  return function(t) {
    t = Math.max(0, Math.min(1, t));
    var hcl = {
      h: startHcl.h + (endHcl.h - startHcl.h) * t,
      c: startHcl.c + (endHcl.c - startHcl.c) * t,
      l: startHcl.l + (endHcl.l - startHcl.l) * t
    };
    var rgb = xyzToRgb(labToXyz(hclToLab(hcl)));
    return 'rgb(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ')';
  };
}

// ===================================================================
// 3. COLOR PALETTE (weavesilk.com colors)
// ===================================================================

var PALETTE = [
  { color: '#3dbbea', highlight: '#7b2fbe' },  // 极光蓝紫
  { color: '#53bf39', highlight: '#65eb43' },  // 绿
  { color: '#e1d730', highlight: '#fdf23f' },  // 黄
  { color: '#ea5126', highlight: '#fd722e' },  // 橙
  { color: '#db4775', highlight: '#fd5e8f' },  // 粉
  { color: '#825ba1', highlight: '#b585da' },  // 紫
  { color: '#555555', highlight: '#717171' }   // 灰
];

// ===================================================================
// 4. DEFAULT SILK PARAMETERS (weavesilk defaults)
// ===================================================================

var DEFAULTS = {
  symNumRotations: 6,
  symMirror: true,
  spiralCopies: 1,        // 1=off, 4=on
  spiralAngle: 0.75 * Math.PI,
  startLife: 150,
  startOpacity: 0.09,
  compositeOperation: 'lighter',
  noiseForceScale: 0.7,
  noiseSpaceScale: 0.02,
  noiseTimeScale: 0.005,
  noiseOctaves: 8,
  noiseFallout: 0.65,
  noiseAngleScale: 5 * Math.PI,
  noiseAngleOffset: 0,
  initialVelocityForceScale: 0.3,
  initialVelocityDecay: 0.98,
  windForceScale: 0,
  windAngle: Math.PI,
  rotateAnglesAroundSymmetryAxis: true,
  friction: 0.975,
  restingDistance: 0,
  rigidity: 0.2,
  drawsPerFrame: 3,
  brushScale: 1,
  lineWidth: 1.5,
  highlightMode: 'velocity',
  velocityColorScaleExponent: 1.5,
  velocityColorScaleDomainLow: 5,
  velocityColorScaleDomainHigh: 30
};

// ===================================================================
// 5. PAGE
// ===================================================================

Page({
  data: {
    symmetry: 6,
    mirror: true,
    spiral: false,
    palette: PALETTE,
    activeColorIndex: 0,
    isExporting: false
  },

  // ===== 安全 setData 包装 =====
  _safeSetData: function (data, callback) {
    if (this._destroyed) return;
    this.setData(data, callback);
  },

  // ===== 实例变量 =====
  _canvas: null,
  _ctx: null,
  _pixelRatio: 1,
  _sw: 0, _sh: 0,
  _cx: 0, _cy: 0,
  _animationId: null,
  _initTimer: null,
  _adTimer: null,
  _curve: [],
  _sparkles: [],
  _touchActive: false,
  _prevTouchX: 0, _prevTouchY: 0,
  _time: 0,
  _frameTime: 0,
  _noiseOffset: 0,
  _drawScale: 1,
  _offsetX: 0, _offsetY: 0,
  _destroyed: false,  // 页面销毁标志
  _colorInterp: null,
  _drawInstructions: [],

  // ===== 生命周期 =====

  // ========== 分享 ==========

  onShareAppMessage: function () {
    var sym = this.data.symmetry;
    var features = [];
    if (this.data.mirror) features.push('镜像');
    if (this.data.spiral) features.push('螺旋');
    var desc = sym + '轴对称';
    if (features.length) desc += '·' + features.join('·');
    return {
      title: '流光绘 — 指尖划过，丝光流影（' + desc + '）',
      path: '/pages/silk/silk'
    };
  },

  onShareTimeline: function () {
    var sym = this.data.symmetry;
    var features = [];
    if (this.data.mirror) features.push('镜像');
    if (this.data.spiral) features.push('螺旋');
    var desc = sym + '轴对称';
    if (features.length) desc += '·' + features.join('·');
    return {
      title: '流光绘 — 指尖划过，丝光流影（' + desc + '）',
      query: ''
    };
  },

  onLoad: function () {
    this._destroyed = false;  // 初始化销毁标志

    // 重写 setData，增加销毁检查
    var originalSetData = this.setData.bind(this);
    this.setData = function(data, callback) {
      if (this._destroyed) {
        console.warn('[流光绘] 页面已销毁，阻止 setData');
        return;
      }
      originalSetData(data, callback);
    }.bind(this);

    this._noiseOffset = Math.random() * 10000;
    this._colorInterp = hclInterpolate(PALETTE[0].color, PALETTE[0].highlight);
    this._initDrawInstructions();
    this._initRewardedVideoAd();
    // 初始化插屏广告
    adManager.initInterstitial('adunit-f749bc6a9b577d1e');
  },

  onShow: function () {},

  onReady: function () {
    var self = this;
    this._initTimer = setTimeout(function () {
      self._initTimer = null;
      self._initCanvas();
    }, 200);

    // 5秒后展示插屏广告（最小间隔120秒）
    self._adTimer = setTimeout(function () {
      self._adTimer = null;
      adManager.showInterstitial('adunit-f749bc6a9b577d1e');
    }, 5000);
  },

  onUnload: function () {
    // 设置销毁标志，阻止后续的 setData 调用
    this._destroyed = true;

    // 清理初始化定时器
    if (this._initTimer) {
      clearTimeout(this._initTimer);
      this._initTimer = null;
    }

    // 清理广告定时器
    if (this._adTimer) {
      clearTimeout(this._adTimer);
      this._adTimer = null;
    }

    // 停止加速器监听（关键！）
    wx.stopAccelerometer();

    // 取消动画帧
    if (this._animationId && this._canvas) {
      this._canvas.cancelAnimationFrame(this._animationId);
      this._animationId = null;
    }

    // 清理画布引用
    this._canvas = null;
    this._ctx = null;

    // 清理数据
    this._curve = [];
    this._sparkles = [];
  },

  // ========== 广告 ==========

  _initRewardedVideoAd: function () {
    if (wx.createRewardedVideoAd) {
      this._rewardedVideoAd = wx.createRewardedVideoAd({
        adUnitId: 'adunit-dbcd70f4fe0e0a57'
      });
      this._rewardedVideoAd.onLoad(() => {
        console.log('[流光绘激励广告] 加载成功');
      });
      this._rewardedVideoAd.onError((err) => {
        console.error('[流光绘激励广告] 加载失败', err);
        this._rewardedVideoAd.load().catch(() => {});
      });
      this._rewardedVideoAd.onClose((res) => {
        if (res && res.isEnded) {
          console.log('[流光绘激励广告] 看完，执行保存');
          var cb = this.__rewardedCallback;
          this.__rewardedCallback = null;
          if (cb) cb();
        } else {
          console.log('[流光绘激励广告] 未看完');
          this.__rewardedCallback = null;
          wx.showToast({ title: '看完广告才能保存哦', icon: 'none' });
        }
      });
      this._rewardedVideoAd.load();
    }
  },

  _showRewardedVideo: function (callback) {
    if (!this._rewardedVideoAd) {
      callback();
      return;
    }
    var self = this;
    self.__rewardedCallback = callback;
    self._rewardedVideoAd.show().then(() => {
      console.log('[流光绘激励广告] 展示中...');
    }).catch((err) => {
      console.error('[流光绘激励广告] 展示失败', err);
      self.__rewardedCallback = null;
      callback();
    });
  },

  // ===== Canvas 初始化 =====

  _initCanvas: function () {
    var sysInfo = wx.getSystemInfoSync();
    this._pixelRatio = sysInfo.pixelRatio || 2;
    this._sw = sysInfo.screenWidth;
    this._sh = sysInfo.screenHeight;
    this._cx = this._sw / 2;
    this._cy = this._sh / 2;

    var self = this;
    var query = wx.createSelectorQuery();
    query.select('#silkCanvas').fields({ node: true, size: true }).exec(function (res) {
      if (!res || !res[0] || !res[0].node) {
        wx.showToast({ title: 'Canvas 初始化失败', icon: 'none' });
        return;
      }
      var canvas = res[0].node;
      var dpr = self._pixelRatio;
      canvas.width = self._sw * dpr;
      canvas.height = self._sh * dpr;
      var ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      self._canvas = canvas;
      self._ctx = ctx;

      // 黑色背景
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, self._sw, self._sh);

      self._startLoop();
    });
  },

  // ===== 动画循环 =====

  _startLoop: function () {
    var self = this;
    if (self._animationId) return;
    if (self._destroyed) return;  // 已销毁则不启动
    function tick() {
      // 检查页面是否已销毁
      if (self._destroyed) {
        if (self._animationId && self._canvas) {
          self._canvas.cancelAnimationFrame(self._animationId);
        }
        self._animationId = null;
        return;
      }
      self._animationId = self._canvas.requestAnimationFrame(tick);
      self._frame();
    }
    self._animationId = self._canvas.requestAnimationFrame(tick);
  },

  _frame: function () {
    this._frameTime++;

    // 多步物理+绘制 (weavesilk: 每步都物理+绘制，时间递增)
    for (var step = 0; step < DEFAULTS.drawsPerFrame; step++) {
      this._time++;
      this._stepPhysics();
    }

    // 火花粒子
    this._updateSparkles();
    this._drawSparkles();
  },

  // ===== 绘制指令 (预计算对称变换) =====

  _initDrawInstructions: function () {
    var sym = this.data.symmetry;
    var spiral = this.data.spiral ? 4 : 1;
    var mirror = this.data.mirror;
    var rotateAmount = 2 * Math.PI / sym;
    var self = this;
    this._drawInstructions = [];

    // Spiral scale: d3.scale.pow().exponent(.5).domain([0,1]).range([1,0])
    for (var ri = 0; ri < sym; ri++) {
      var rotateBy = ri * rotateAmount;
      for (var si = 0; si < spiral; si++) {
        var pc = (si + 0.25 - 0.25) / spiral;
        var scale = Math.pow(1 - pc, 0.5);  // spiral scale
        var angle = rotateBy + DEFAULTS.spiralAngle * pc;
        this._drawInstructions.push({
          cos: Math.cos(angle),
          sin: Math.sin(angle),
          scale: scale,
          original: ri === 0 && si === 0
        });
        if (mirror) {
          this._drawInstructions.push({
            cos: Math.cos(angle),
            sin: Math.sin(angle),
            scale: scale,
            mirror: true,
            original: false
          });
        }
      }
    }
  },

  _rebuildDrawInstructions: function () {
    var sym = this.data.symmetry;
    var spiral = this.data.spiral ? 4 : 1;
    var mirror = this.data.mirror;
    var rotateAmount = 2 * Math.PI / sym;
    this._drawInstructions = [];

    for (var ri = 0; ri < sym; ri++) {
      var rotateBy = ri * rotateAmount;
      for (var si = 0; si < spiral; si++) {
        var pc = (si + 0.25 - 0.25) / spiral;
        var scale = Math.pow(1 - pc, 0.5);
        var angle = rotateBy + DEFAULTS.spiralAngle * pc;
        this._drawInstructions.push({
          cos: Math.cos(angle),
          sin: Math.sin(angle),
          scale: scale,
          original: ri === 0 && si === 0
        });
        if (mirror) {
          this._drawInstructions.push({
            cos: Math.cos(angle),
            sin: Math.sin(angle),
            scale: scale,
            mirror: true,
            original: false
          });
        }
      }
    }
  },

  // ===== 物理模拟 =====

  _stepPhysics: function () {
    var curve = this._curve;
    var self = this;
    var cx = this._cx, cy = this._cy;

    // 移除已死亡的粒子
    while (curve.length && curve[0].life <= 0) curve.shift();

    for (var i = 0; i < curve.length; i++) {
      var p = curve[i];
      var accx = 0, accy = 0;

      // --- Perlin 噪声力 (3D: x, y, time) ---
      if (DEFAULTS.noiseForceScale) {
        var noiseVal = perlinNoise(
          self._noiseOffset + p.x * DEFAULTS.noiseSpaceScale + 1000000,
          self._noiseOffset + p.y * DEFAULTS.noiseSpaceScale + 1000000,
          self._noiseOffset + DEFAULTS.noiseTimeScale * self._time,
          DEFAULTS.noiseOctaves,
          DEFAULTS.noiseFallout
        );
        var nAngle = DEFAULTS.noiseAngleOffset + DEFAULTS.noiseAngleScale * noiseVal;
        if (DEFAULTS.rotateAnglesAroundSymmetryAxis) {
          nAngle += Math.atan2(cx - p.y, cy - p.x);
        }
        accx += DEFAULTS.noiseForceScale * Math.cos(nAngle);
        accy += DEFAULTS.noiseForceScale * Math.sin(nAngle);
      }

      // --- 初速度力 ---
      if (DEFAULTS.initialVelocityForceScale && p.inputVx !== undefined) {
        accx += DEFAULTS.initialVelocityForceScale * p.inputVx;
        accy += DEFAULTS.initialVelocityForceScale * p.inputVy;
        p.inputVx *= DEFAULTS.initialVelocityDecay;
        p.inputVy *= DEFAULTS.initialVelocityDecay;
      }

      // --- 风力 ---
      if (DEFAULTS.windForceScale > 0) {
        var wAngle = DEFAULTS.windAngle;
        if (DEFAULTS.rotateAnglesAroundSymmetryAxis) {
          wAngle += Math.atan2(cx - p.y, cy - p.x);
        }
        accx += DEFAULTS.windForceScale * Math.cos(wAngle);
        accy += DEFAULTS.windForceScale * Math.sin(wAngle);
      }

      // Verlet 积分
      p.x += (p.x - p.px) * DEFAULTS.friction + accx;
      p.y += (p.y - p.py) * DEFAULTS.friction + accy;
      p.px = p.x;
      p.py = p.y;
      p.life--;

      // --- 弹簧约束 ---
      if (i > 0) {
        var p2 = curve[i - 1];
        var dx = p2.x - p.x, dy = p2.y - p.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > DEFAULTS.restingDistance + 0.01) {
          var diff = DEFAULTS.rigidity * (DEFAULTS.restingDistance - dist) / dist;
          p.x -= diff * dx;
          p2.x += diff * dx;
          p.y -= diff * dy;
          p2.y += diff * dy;
        }
      }
    }

    // 每次 step 都绘制 (additive blending 叠加产生光晕)
    this._drawCurves();

    // 低频发射火花（避免紫色分叉感）
    if (this._frameTime % 35 === 0 && curve.length > 0) {
      this._emitSparkle();
    }
  },

  // ===== 绘制曲线 (带 additive blending) =====

  _drawCurves: function () {
    var ctx = this._ctx;
    var curve = this._curve;
    if (curve.length < 2) return;

    var cx = this._cx, cy = this._cy;
    var instructions = this._drawInstructions;

    // === 保存原始坐标并设置 additive blending ===
    for (var i = 0; i < curve.length; i++) {
      var pt = curve[i];
      pt._sx = pt.x; pt._sy = pt.y;
    }

    ctx.globalCompositeOperation = 'lighter';

    // === 每段绘制 ===
    for (var di = 0; di < instructions.length; di++) {
      var instr = instructions[di];
      var cosA = instr.cos, sinA = instr.sin, scale = instr.scale;

      // 变换所有点到对称位置
      for (var j = 0; j < curve.length; j++) {
        var p = curve[j];
        var rx = p._sx - cx, ry = p._sy - cy;
        var tx = (rx * cosA - ry * sinA) * scale;
        var ty = (rx * sinA + ry * cosA) * scale;
        if (instr.mirror) tx = -tx;
        p._tx = cx + tx;
        p._ty = cy + ty;
      }

      // === 设置颜色 ===
      var lastP = curve[curve.length - 1];
      var alpha = DEFAULTS.startOpacity * (lastP.life / DEFAULTS.startLife);
      if (alpha <= 0) continue;

      var colorVal, speed;
      if (DEFAULTS.highlightMode === 'velocity') {
        speed = Math.sqrt(
          (lastP.inputVx || 0) * (lastP.inputVx || 0) +
          (lastP.inputVy || 0) * (lastP.inputVy || 0)
        );
        // pow scale mapping
        var vDomain = DEFAULTS.velocityColorScaleDomainHigh - DEFAULTS.velocityColorScaleDomainLow;
        var t = Math.max(0, Math.min(1, (speed - DEFAULTS.velocityColorScaleDomainLow) / vDomain));
        t = Math.pow(t, DEFAULTS.velocityColorScaleExponent);
      } else {
        // time mode
        t = 0.5 + 0.5 * Math.sin(this._time * 0.01);
      }

      if (!this._colorInterp) {
        this._colorInterp = hclInterpolate(PALETTE[0].color, PALETTE[0].highlight);
      }
      var strokeColor = this._colorInterp(t);

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = DEFAULTS.lineWidth * scale;

      // === 二次贝塞尔曲线绘制 ===
      ctx.beginPath();
      ctx.moveTo(curve[0]._tx, curve[0]._ty);
      var p1 = curve[1];
      var lenMinusOne = curve.length - 1;
      for (var k = 1; k < lenMinusOne - 1; k++) {
        var p2 = curve[k + 1];
        ctx.quadraticCurveTo(
          p1._tx, p1._ty,
          (p1._tx + p2._tx) / 2, (p1._ty + p2._ty) / 2
        );
        p1 = p2;
      }
      // 最后一段
      if (lenMinusOne >= 1) {
        ctx.lineTo(curve[lenMinusOne]._tx, curve[lenMinusOne]._ty);
      }
      ctx.stroke();
    }
  },

  // ===== 火花粒子系统 =====

  _emitSparkle: function () {
    var curve = this._curve;
    if (!curve.length) return;
    // 随机选择曲线上的一个点
    var idx = Math.floor(Math.random() * curve.length);
    var p = curve[idx];
    var alpha = 0.8 * p.life / DEFAULTS.startLife;
    if (alpha <= 0) return;

    // 获取当前颜色并提亮
    var t = 0;
    if (DEFAULTS.highlightMode === 'velocity') {
      var speed = Math.sqrt((p.inputVx || 0) * (p.inputVx || 0) + (p.inputVy || 0) * (p.inputVy || 0));
      t = Math.pow(Math.max(0, Math.min(1, (speed - DEFAULTS.velocityColorScaleDomainLow) / (DEFAULTS.velocityColorScaleDomainHigh - DEFAULTS.velocityColorScaleDomainLow))), DEFAULTS.velocityColorScaleExponent);
    }
    if (!this._colorInterp) {
      this._colorInterp = hclInterpolate(PALETTE[0].color, PALETTE[0].highlight);
    }
    var color = this._colorInterp(1); // 始终用高亮色

    this._sparkles.push({
      x: p._tx !== undefined ? p._tx : p.x,
      y: p._ty !== undefined ? p._ty : p.y,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      life: 45,
      maxLife: 45,
      alpha: alpha * 0.5,
      radius: 0.5,
      color: color
    });

    // 限制粒子数
    while (this._sparkles.length > 300) this._sparkles.shift();
  },

  _updateSparkles: function () {
    var sparks = this._sparkles;
    for (var i = sparks.length - 1; i >= 0; i--) {
      var s = sparks[i];
      s.x += s.vx;
      s.y += s.vy;
      s.life--;
      if (s.life <= 0) {
        sparks.splice(i, 1);
      }
    }
  },

  _drawSparkles: function () {
    var ctx = this._ctx;
    var sparks = this._sparkles;
    if (!sparks.length) return;

    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < sparks.length; i++) {
      var s = sparks[i];
      var alpha = s.alpha * (s.life / s.maxLife);
      if (alpha <= 0) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, 2 * Math.PI);
      ctx.fill();
    }
  },

  // ===== 添加曲线点 =====

  _addPoint: function (x, y, vx, vy) {
    if (this._curve.length > 500) this._curve.shift();
    this._curve.push({
      x: x, y: y,
      px: x, py: y,         // prev position (Verlet)
      inputVx: vx || 0,
      inputVy: vy || 0,
      life: DEFAULTS.startLife
    });
  },

  // ===== 触摸处理 =====

  onTouchStart: function (e) {
    var t = e.touches[0];
    this._touchActive = true;
    this._prevTouchX = t.x; this._prevTouchY = t.y;

    // 初始多点
    for (var i = 0; i < 5; i++) {
      this._addPoint(t.x, t.y, 0, 0);
    }
  },

  onTouchMove: function (e) {
    if (!this._touchActive) return;
    var t = e.touches[0];
    var dx = t.x - this._prevTouchX;
    var dy = t.y - this._prevTouchY;
    this._prevTouchX = t.x; this._prevTouchY = t.y;

    var dist = Math.sqrt(dx * dx + dy * dy);
    var steps = Math.max(1, Math.floor(dist / 3));
    for (var i = 0; i < steps; i++) {
      var frac = i / steps;
      this._addPoint(
        t.x - dx * (1 - frac),
        t.y - dy * (1 - frac),
        dx, dy
      );
    }
  },

  onTouchEnd: function () {
    this._touchActive = false;
  },

  // ===== 控制按钮 =====

  onSymmetryDown: function () {
    var s = this.data.symmetry;
    if (s <= 1) return;
    s--;
    this.setData({ symmetry: s });
    this._rebuildDrawInstructions();
  },

  onSymmetryUp: function () {
    var s = this.data.symmetry;
    if (s >= 12) return;
    s++;
    this.setData({ symmetry: s });
    this._rebuildDrawInstructions();
  },

  onToggleMirror: function () {
    var m = !this.data.mirror;
    this.setData({ mirror: m });
    this._rebuildDrawInstructions();
  },

  onToggleSpiral: function () {
    var sp = !this.data.spiral;
    this.setData({ spiral: sp });
    this._rebuildDrawInstructions();
  },

  // ===== 颜色选择 =====

  onSelectColor: function (e) {
    var idx = e.currentTarget.dataset.index;
    if (idx === undefined) return;
    var pal = PALETTE[idx];
    if (!pal) return;
    this._colorInterp = hclInterpolate(pal.color, pal.highlight);
    this.setData({ activeColorIndex: idx });
  },

  // ===== 清屏 =====

  onClear: function () {
    var ctx = this._ctx;
    if (ctx) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, this._sw, this._sh);
    }
    this._curve = [];
    this._sparkles = [];
    // 清除画布时30%概率展示插屏广告（最小间隔120秒）
    adManager.showInterstitial('adunit-f749bc6a9b577d1e');
  },

  // ===== 导出 =====

  onSave: function () {
    if (this.data.isExporting) return;
    var self = this;
    this._showRewardedVideo(function () {
      self._doSave();
    });
  },

  _doSave: function () {
    var self = this;
    this.setData({ isExporting: true });

    try {
      var canvas = this._canvas;
      var w = canvas.width;   // 实际像素宽度
      var h = canvas.height;  // 实际像素高度

      // 离屏 canvas 拷贝完整像素内容
      var off = wx.createOffscreenCanvas({ type: '2d', width: w, height: h });
      var octx = off.getContext('2d');
      octx.drawImage(canvas, 0, 0, w, h, 0, 0, w, h);

      var dataUrl = off.toDataURL('image/png');
      var base64 = dataUrl.split(',')[1];
      if (!base64) throw new Error('no data');

      var tempPath = wx.env.USER_DATA_PATH + '/silk_' + Date.now() + '.png';
      wx.getFileSystemManager().writeFileSync(tempPath, base64, 'base64');

      var app = getApp();
      app.checkPhotoAlbumAuth(function () {
        wx.saveImageToPhotosAlbum({
          filePath: tempPath,
          success: function () {
            self.setData({ isExporting: false });
            wx.showToast({ title: '已保存到相册', icon: 'success' });
          },
          fail: function (err) {
            self.setData({ isExporting: false });
            wx.showToast({ title: '保存失败，请重试', icon: 'none' });
          }
        });
      });
    } catch (e) {
      self.setData({ isExporting: false });
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  }
});
