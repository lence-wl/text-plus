Page({
  data: {
    nowTime: '',
    address: '定位获取中...',
    customText: '现场实拍水印'
  },

  _timer: null,
  _canvas: null,
  _canvasCtx: null,
  _canvasWidth: 0,
  _canvasHeight: 0,

  onReady() {
    this._initCanvas()
    this._startTimer()
    this._getLocation()
  },

  onUnload() {
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
  },

  // ---------- Canvas 2D 初始化 (修复 #1 #4 #8) ----------
  _initCanvas() {
    const query = wx.createSelectorQuery()
    query.select('#waterCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0]) {
          console.error('[水印相机] Canvas 节点获取失败')
          return
        }
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        this._canvas = canvas
        this._canvasCtx = ctx
        this._canvasWidth = res[0].width   // 物理像素
        this._canvasHeight = res[0].height
      })
  },

  // ---------- 实时时间 (修复: 内存泄漏防护) ----------
  _startTimer() {
    this._updateTime()
    this._timer = setInterval(() => {
      this._updateTime()
    }, 1000)
  },

  _updateTime() {
    const d = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const time = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    this.setData({ nowTime: time })
  },

  // ---------- 定位 ----------
  _getLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          address: `北纬 ${res.latitude.toFixed(4)}° 东经 ${res.longitude.toFixed(4)}°`
        })
      },
      fail: (err) => {
        console.warn('[水印相机] 定位失败', err)
        this.setData({ address: '定位未开启' })
      }
    })
  },

  // ---------- 拍照 + 合成 + 保存 (修复 #2 #3 #5 #9 #10) ----------
  onTakePhoto() {
    if (!this._canvas) {
      wx.showToast({ title: '相机加载中，请稍后', icon: 'none' })
      return
    }

    wx.showLoading({ title: '生成水印照片...', mask: true })

    const cameraCtx = wx.createCameraContext()
    cameraCtx.takePhoto({
      quality: 'high',
      success: (res) => {
        this._compositeWatermark(res.tempImagePath)
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '拍摄失败，请重试', icon: 'none' })
      }
    })
  },

  // ---------- Canvas 2D 水印合成 ----------
  _compositeWatermark(tempImagePath) {
    // #2 修复: 获取原图真实尺寸，动态调整 Canvas
    wx.getImageInfo({
      src: tempImagePath,
      success: (imgInfo) => {
        this._drawWatermark(tempImagePath, imgInfo.width, imgInfo.height)
      },
      fail: () => {
        // 降级：用默认尺寸绘制
        this._drawWatermark(tempImagePath, this._canvasWidth, this._canvasHeight)
      }
    })
  },

  _drawWatermark(imagePath, imgW, imgH) {
    const canvas = this._canvas
    const ctx = this._canvasCtx

    // 调整 Canvas 物理尺寸匹配原图分辨率
    canvas.width = imgW
    canvas.height = imgH
    this._canvasWidth = imgW
    this._canvasHeight = imgH

    // 水印基础字号：按图片短边比例计算
    const baseSize = Math.max(24, Math.round(Math.min(imgW, imgH) * 0.032))
    const padding = baseSize * 1.5
    const lineHeight = baseSize * 1.6

    // #9 修复: Canvas 2D 通过 canvas.createImage() 异步加载图片
    const img = canvas.createImage()
    img.src = imagePath

    img.onload = () => {
      // 绘制原图
      ctx.clearRect(0, 0, imgW, imgH)
      ctx.drawImage(img, 0, 0, imgW, imgH)

      // 绘制水印文字
      const lines = [
        this.data.nowTime,
        this.data.address,
        this.data.customText
      ]

      const startY = imgH - padding - (lines.length - 1) * lineHeight

      ctx.save()
      ctx.font = `500 ${baseSize}px sans-serif`
      ctx.fillStyle = '#ffffff'
      ctx.textBaseline = 'top'

      // 文字背景（增强可读性，替代 text-shadow）
      lines.forEach((text, i) => {
        const y = startY + i * lineHeight
        const metrics = ctx.measureText(text)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
        ctx.fillRect(
          padding - 6,
          y - 2,
          metrics.width + 12,
          lineHeight - 2
        )
        ctx.fillStyle = '#ffffff'
        ctx.fillText(text, padding, y)
      })

      ctx.restore()

      // #3 修复: Canvas 2D 导出入参传 canvas 节点
      wx.canvasToTempFilePath({
        canvas: canvas,
        x: 0,
        y: 0,
        width: imgW,
        height: imgH,
        destWidth: imgW,
        destHeight: imgH,
        fileType: 'jpg',
        quality: 0.95,
        success: (outRes) => {
          this._saveToAlbum(outRes.tempFilePath)
        },
        fail: () => {
          wx.hideLoading()
          wx.showToast({ title: '图片生成失败', icon: 'none' })
        }
      })
    }

    img.onerror = () => {
      wx.hideLoading()
      wx.showToast({ title: '图片加载失败', icon: 'none' })
    }
  },

  // ---------- 保存相册 ----------
  _saveToAlbum(filePath) {
    wx.saveImageToPhotosAlbum({
      filePath: filePath,
      success: () => {
        wx.hideLoading()
        wx.showToast({ title: '保存成功', icon: 'success' })
      },
      fail: (err) => {
        wx.hideLoading()
        if (err.errMsg && err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '需要相册权限',
            content: '请在设置中开启「保存到相册」权限',
            confirmText: '去设置',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.openSetting()
              }
            }
          })
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' })
        }
      }
    })
  },

  // ---------- 相机异常 ----------
  onCameraError() {
    wx.showModal({
      title: '相机权限被拒绝',
      content: '请在设置中开启相机权限后重试',
      confirmText: '去设置',
      success: (res) => {
        if (res.confirm) wx.openSetting()
      }
    })
  }
})
