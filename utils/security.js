/**
 * 内容安全检测工具
 * 通过后端代理调用微信内容安全 API，AppSecret 不暴露在客户端
 */
const api = require('./api.js')

/**
 * 检测文本内容安全性
 * @param {string} text - 要检测的文本内容
 * @returns {Promise<boolean>} - true 表示通过检测，false 表示包含敏感内容
 */
async function checkTextSecurity(text) {
  if (!text || text.trim() === '') {
    return true
  }

  try {
    const token = api.getToken()
    if (!token) {
      // 还没登录，默认通过
      return true
    }

    return new Promise((resolve) => {
      wx.request({
        url: api.getBaseUrl() + '/content/check',
        method: 'POST',
        header: { 'Authorization': 'Bearer ' + token },
        data: { appId: 'text-plus', content: text },
        success: function (res) {
          if (res.data && res.data.safe === false) {
            resolve(false)
          } else {
            resolve(true)
          }
        },
        fail: function () {
          // 请求失败默认通过，避免影响用户体验
          resolve(true)
        }
      })
    })
  } catch (e) {
    return true
  }
}

module.exports = {
  checkTextSecurity
}
