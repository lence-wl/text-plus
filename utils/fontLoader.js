/**
 * fontLoader.js - 字体加载工具
 * 从后端获取字体列表、子集化并注册到小程序
 */
const api = require('./api.js')

var _cache = {}
var _loadingMap = {}
var _previewRegistered = {}
var TEMP_URL_TTL = 2 * 60 * 60 * 1000
var FILEID_STORAGE_KEY = 'font_fileid_cache'

/** 持久化 fileID 缓存 */
function _loadFileIDCache() {
  try {
    var raw = wx.getStorageSync(FILEID_STORAGE_KEY)
    return (raw && typeof raw === 'object') ? raw : {}
  } catch (e) { return {} }
}

function _saveFileIDCache(cache) {
  try { wx.setStorageSync(FILEID_STORAGE_KEY, cache) } catch (e) { /* ignore */ }
}

/** 获取字体列表（含预览文字） */
function getFontList() {
  return new Promise(function (resolve) {
    var token = api.getToken()
    if (!token) { resolve([]); return }

    wx.request({
      url: api.getBaseUrl() + '/fonts/list',
      method: 'GET',
      header: { 'Authorization': 'Bearer ' + token },
      success: function (res) {
        if (res.data && res.data.code === 0) {
          var list = res.data.data || []
          // 和字字不厌一致：中文显示"字字不厌"，英文显示"zi zi bu yan"
          list.forEach(function (f) {
            f.previewText = f.lang === 'en' ? 'zi zi bu yan' : '字字不厌'
          })
          resolve(list)
        } else {
          resolve([])
        }
      },
      fail: function () { resolve([]) }
    })
  })
}

/**
 * 预加载字体预览（用 previewFileID 注册 wx.loadFontFace）
 * 返回一个 Promise，resolve 时传已加载数量
 * 调用方用计数触发 WXML 重渲染
 */
function loadPreviewFonts(fontList, onProgress) {
  if (!fontList || !fontList.length) return Promise.resolve(0)

  return new Promise(function (resolve) {
    var total = fontList.length
    var loaded = 0

    fontList.forEach(function (f) {
      var name = f.name
      if (!name || !f.previewFileID) {
        loaded++
        if (loaded >= total) resolve(loaded)
        return
      }
      if (_previewRegistered[name]) {
        loaded++
        if (onProgress) onProgress(loaded)
        if (loaded >= total) resolve(loaded)
        return
      }
      _previewRegistered[name] = true

      wx.loadFontFace({
        family: name,
        source: 'url("' + f.previewFileID + '")',
        success: function () {
          console.log('[fontLoader] 预览注册成功:', name)
          _onPreviewDone()
        },
        fail: function (err) {
          console.warn('[fontLoader] 预览注册失败:', name, err && err.errMsg)
          _previewRegistered[name] = false
          _onPreviewDone()
        }
      })
    })

    function _onPreviewDone() {
      loaded++
      if (onProgress) onProgress(loaded)
      if (loaded >= total) resolve(loaded)
    }
  })
}

/**
 * 加载字体（子集化 + wx.loadFontFace）
 * @param {string} fontName - 字体名称
 * @param {string} text - 当前文字
 * @param {Function} callback - (success)
 */
function loadFont(fontName, text, callback) {
  if (!fontName || !text) {
    if (callback) callback(false)
    return
  }

  var deduped = ''
  var seen = {}
  for (var i = 0; i < text.length; i++) {
    var ch = text[i]
    if (!seen[ch]) { seen[ch] = true; deduped += ch }
  }

  var cacheKey = fontName + ':' + deduped
  var cached = _cache[cacheKey]
  if (cached && cached.expireAt > Date.now()) {
    _register(fontName, cached.fileID, callback)
    return
  }

  if (_loadingMap[cacheKey]) {
    _loadingMap[cacheKey].push(callback)
    return
  }

  _doLoad(fontName, deduped, cacheKey, callback)
}

function _doLoad(fontName, deduped, cacheKey, callback) {
  _loadingMap[cacheKey] = [callback].filter(Boolean)

  // 先查持久化缓存
  var fileIDCache = _loadFileIDCache()
  var cachedFileID = fileIDCache[cacheKey]
  if (cachedFileID) {
    _register(fontName, cachedFileID, function (ok) {
      if (ok) {
        _notify(_loadingMap[cacheKey], true)
        delete _loadingMap[cacheKey]
      } else {
        // 注册失败，清缓存，请求接口
        delete fileIDCache[cacheKey]
        _saveFileIDCache(fileIDCache)
        _ensureToken(function () { _doRequest(fontName, deduped, cacheKey, true) })
      }
    })
    return
  }

  // 无缓存，请求接口
  _ensureToken(function () {
    _doRequest(fontName, deduped, cacheKey, true)
  })

  function _doRequest(fontName, deduped, cacheKey, isRetry) {
    var token = api.getToken()
    wx.request({
      url: api.getBaseUrl() + '/fonts/subset',
      method: 'POST',
      data: { font: fontName, text: deduped },
      header: { 'Authorization': 'Bearer ' + token },
      success: function (res) {
        if (res.data && res.data.code === 0 && res.data.fileID) {
          var fileID = res.data.fileID
          var fc = _loadFileIDCache()
          fc[cacheKey] = fileID
          _saveFileIDCache(fc)
          _register(fontName, fileID, function (ok) {
            _notify(_loadingMap[cacheKey], ok)
            delete _loadingMap[cacheKey]
            _cache[cacheKey] = { fileID: fileID, expireAt: Date.now() + TEMP_URL_TTL }
          })
        } else if (res.statusCode === 401 && isRetry) {
          api.login().then(function () {
            _doRequest(fontName, deduped, cacheKey, false)
          })
        } else {
          _notify(_loadingMap[cacheKey], false)
          delete _loadingMap[cacheKey]
        }
      },
      fail: function () {
        if (isRetry) {
          setTimeout(function () {
            _doRequest(fontName, deduped, cacheKey, false)
          }, 1000)
        } else {
          _notify(_loadingMap[cacheKey], false)
          delete _loadingMap[cacheKey]
        }
      }
    })
  }
}

/** 确保已登录，未登录则等待登录完成 */
function _ensureToken(callback) {
  if (api.getToken()) {
    callback()
    return
  }
  api.login().then(function (ok) {
    callback()
  })
}

function _notify(list, ok) {
  if (!list) return
  list.forEach(function (cb) { if (cb) cb(ok) })
}

function _register(fontName, fileID, callback) {
  wx.loadFontFace({
    family: fontName,
    source: 'url("' + fileID + '")',
    success: function () {
      console.log('[fontLoader] 注册成功:', fontName)
      if (callback) callback(true)
    },
    fail: function (err) {
      console.warn('[fontLoader] 注册失败:', fontName, err)
      if (callback) callback(false)
    }
  })
}

function resetPreviewCache() {
  _previewRegistered = {}
}

module.exports = {
  getFontList: getFontList,
  loadFont: loadFont,
  loadPreviewFonts: loadPreviewFonts,
  resetPreviewCache: resetPreviewCache
}
