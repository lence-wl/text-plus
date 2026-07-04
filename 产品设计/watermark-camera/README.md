# 微信小程序水印相机 - 修复版

## 方案可行性：✅ 完全可行

`camera` + `cover-view` + 离屏 Canvas 2D 是微信小程序实现水印相机唯一成熟且稳定的方案。

## 原代码 10 个 Bug 及修复

| # | Bug | 严重度 | 修复方式 |
|---|-----|-------|---------|
| 1 | WXML `type="2d"` 但 JS 用 `createCanvasContext()` (旧 API) | 🔴 致命 | 改用 `SelectorQuery.fields({ node: true })` + `getContext('2d')` |
| 2 | 高分辨率原图直接画到 750×1334 固定画布 | 🔴 致命 | `wx.getImageInfo` 获取真实尺寸，动态设置 `canvas.width/height` |
| 3 | `canvasToTempFilePath` 传 `canvasId` (旧 API) | 🔴 致命 | 改传 `canvas` 节点对象 |
| 4 | `onLoad` 中查询 Canvas 节点 | 🟡 中 | 移至 `onReady`，确保 DOM 就绪 |
| 5 | `cover-text` 设置 `text-shadow` (不支持) | 🟡 中 | 改用 `cover-view` + 半透明背景层 |
| 6 | `app.json` 缺失 `scope.writePhotosAlbum` | 🟡 中 | 添加相册写入权限声明 |
| 7 | `requiredBackgroundModes: ["audio"]` 无关联 | 🟢 低 | 删除 |
| 8 | 画布 CSS 用 rpx，JS 计算用 px，单位不一致 | 🟡 中 | Canvas 2D 节点自带 `width/height` 物理像素属性 |
| 9 | `ctx.drawImage(path)` 图片未 load 完成 | 🟡 中 | 改用 `canvas.createImage()` + `img.onload` 异步加载 |
| 10 | `cover-view` 底部按钮层级兼容性 | 🟢 低 | 拍照按钮改用 `cover-view`，确保覆盖在原生 camera 上 |

## 项目结构

```
watermark-camera/
├── app.json              # 权限配置 (camera/location/photoAlbum)
└── pages/
    └── camera/
        ├── index.json    # 页面配置
        ├── index.wxml    # 页面结构 (camera + cover-view + offscreen canvas)
        ├── index.wxss    # 样式 (固定 px 单位匹配 Canvas 2D)
        └── index.js      # 核心逻辑 (Camera 2D API 完整实现)
```

## 关键 API 对照

| 场景 | ❌ 旧方案 | ✅ 新方案 |
|------|----------|----------|
| 获取 Canvas 上下文 | `wx.createCanvasContext('id')` | `selectorQuery.fields({ node: true })` |
| 加载图片 | `ctx.drawImage(path, ...)` | `canvas.createImage()` + `onload` |
| 导出图片 | `canvasToTempFilePath({ canvasId })` | `canvasToTempFilePath({ canvas })` |
| Canvas 尺寸 | CSS rpx 固定 | 动态匹配原图物理像素 |

## 基础库要求

≥ 2.25.0（Canvas 2D 支持）

## 扩展方向

- 对接高德/百度逆地理编码获取详细地址
- 自定义水印文字、颜色、透明度
- 图片 LOGO 水印叠加
- 批量连拍 + 批量保存
- 水印网格平铺防篡改
