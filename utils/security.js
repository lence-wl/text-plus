/**
 * 内容安全检测工具
 * 使用 access_token 调用微信内容安全检测 API
 */

// 微信小程序配置（请替换为你的实际配置）
const WX_CONFIG = {
  appid: 'wx7223aed0ad36ab91',                           // 请填写你的小程序 AppID
  secret: 'd09e00598c48c4c2b367ba3bc7bfdef8' // 请填写你的小程序 AppSecret
};

// 缓存 access_token
let accessToken = '';
let tokenExpireTime = 0;

/**
 * 获取微信 access_token
 */
async function getAccessToken() {
  const now = Date.now();

  // 如果 token 未过期，直接返回
  if (accessToken && now < tokenExpireTime) {
    return accessToken;
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: 'https://api.weixin.qq.com/cgi-bin/token',
      method: 'GET',
      data: {
        grant_type: 'client_credential',
        appid: WX_CONFIG.appid,
        secret: WX_CONFIG.secret
      },
      success: (res) => {
        if (res.data && res.data.access_token) {
          accessToken = res.data.access_token;
          // 设置过期时间（提前 60 秒刷新）
          tokenExpireTime = now + (res.data.expires_in - 60) * 1000;
          resolve(accessToken);
        } else {
          reject(new Error(res.data?.errmsg || '获取 access_token 失败'));
        }
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
}

/**
 * 检测文本内容安全性
 * @param {string} text - 要检测的文本内容
 * @returns {Promise<boolean>} - true 表示通过检测，false 表示包含敏感内容
 */
async function checkTextSecurity(text) {
  if (!text || text.trim() === '') {
    return true; // 空文本默认通过
  }

  try {
    const token = await getAccessToken();

    return new Promise((resolve) => {
      wx.request({
        url: `https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${token}`,
        method: 'POST',
        data: {
          content: text
        },
        success: (res) => {
          if (res.data && res.data.errcode === 0) {
            console.log('内容安全检测通过');
            resolve(true);
          } else {
            console.error('内容安全检测失败:', res.data?.errmsg);
            resolve(false);
          }
        },
        fail: (err) => {
          console.error('内容安全检测请求失败:', err);
          // 请求失败时默认通过，避免影响用户体验
          resolve(true);
        }
      });
    });
  } catch (error) {
    console.error('获取 access_token 失败:', error);
    // 获取 token 失败时默认通过
    return true;
  }
}

module.exports = {
  checkTextSecurity
};