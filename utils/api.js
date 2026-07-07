/**
 * 后端 API 通信模块
 *
 * 开发版 → 本地局域网 IP（手机和电脑同一 WiFi）
 * 体验版/正式版 → 线上域名
 * 需在微信小程序后台配置 request 合法域名
 */

// ===== 服务器地址配置 =====
var API_BASE = 'https://lovelytext.mym-english.com/api'
try {
  var accountInfo = wx.getAccountInfoSync()
  if (accountInfo.miniProgram.envVersion === 'develop') {
    // 替换成你 Mac 的局域网 IP
    API_BASE = 'http://192.168.5.32:3000/api'
  }
} catch (e) {}

const TOKEN_KEY = 'app_token'

let _token = ''
let _loginPromise = null

/** 获取缓存的 token */
function getToken() {
  if (_token) return _token
  try { _token = wx.getStorageSync(TOKEN_KEY) || '' } catch (e) { _token = '' }
  return _token
}

/** 保存 token */
function saveToken(token) {
  _token = token
  try { wx.setStorageSync(TOKEN_KEY, token) } catch (e) { /* ignore */ }
}

/**
 * 登录（wx.login → /api/auth/app-login）
 * 多次调用只会发一次请求
 */
function login() {
  if (_loginPromise) return _loginPromise

  _loginPromise = new Promise(function (resolve) {
    wx.login({
      success: function (res) {
        if (!res.code) {
          _loginPromise = null
          resolve(false)
          return
        }
        wx.request({
          url: API_BASE + '/auth/app-login',
          method: 'POST',
          data: { appId: 'text-plus', code: res.code },
          success: function (r) {
            if (r.data && r.data.code === 0 && r.data.token) {
              saveToken(r.data.token)
              resolve(true)
            } else {
              console.error('[api] 登录失败:', r.data)
              _loginPromise = null
              resolve(false)
            }
          },
          fail: function (err) {
            console.error('[api] 登录请求失败:', err)
            _loginPromise = null
            resolve(false)
          }
        })
      },
      fail: function (err) {
        console.error('[api] wx.login 失败:', err)
        _loginPromise = null
        resolve(false)
      }
    })
  })

  return _loginPromise
}

/**
 * 带自动登录的 request
 * token 过期时自动重新登录后重试一次
 */
function request(opts) {
  var token = getToken()
  var headers = {}
  if (token) headers['Authorization'] = 'Bearer ' + token

  function doRequest() {
    return new Promise(function (resolve, reject) {
      wx.request({
        url: API_BASE + opts.url,
        method: opts.method || 'POST',
        data: opts.data || {},
        header: headers,
        success: function (r) {
          if (r.statusCode === 401) {
            // token 过期，重新登录后重试
            _token = ''
            _loginPromise = null
            login().then(function (ok) {
              if (ok) {
                headers['Authorization'] = 'Bearer ' + getToken()
                wx.request({
                  url: API_BASE + opts.url,
                  method: opts.method || 'POST',
                  data: opts.data || {},
                  header: headers,
                  success: function (r2) { resolve(r2) },
                  fail: reject
                })
              } else {
                reject(new Error('登录失败'))
              }
            })
          } else {
            resolve(r)
          }
        },
        fail: reject
      })
    })
  }

  return doRequest()
}

/**
 * 上报事件日志
 * @param {string} page - 页面标识
 * @param {string} event - 事件类型: 'settings' | 'action'
 * @param {object} data - 相关数据
 */
function logEvent(page, event, data) {
  request({
    url: '/log/event',
    data: {
      appId: 'text-plus',
      page: page,
      event: event,
      data: data || {}
    }
  }).catch(function (err) {
    console.error('[api] 日志上报失败:', err)
  })
}

module.exports = {
  API_BASE: API_BASE,
  login: login,
  logEvent: logEvent,
  getToken: getToken,
  getBaseUrl: function () { return API_BASE }
}
