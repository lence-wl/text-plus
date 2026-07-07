// app.js
var api = require('./utils/api.js')

App({
  globalData: {
    userInfo: null
  },

  onLaunch: function () {
    // 静默登录，后续 API 调用可直接用 token
    api.login()
  },

  /**
   * 检查并请求保存图片到相册的权限
   * @param {Function} callback - 权限通过后的回调
   */
  checkPhotoAlbumAuth: function (callback) {
    var self = this;
    wx.getSetting({
      success: function (res) {
        var auth = res.authSetting['scope.writePhotosAlbum'];
        if (auth === undefined) {
          // 首次请求，直接调 authorize
          wx.authorize({
            scope: 'scope.writePhotosAlbum',
            success: function () {
              callback();
            },
            fail: function () {
              self._showAuthModal();
            }
          });
        } else if (auth === false) {
          // 用户之前拒绝过，引导去设置页
          self._showAuthModal();
        } else {
          // 已授权
          callback();
        }
      },
      fail: function () {
        // getSetting 失败，降级直接尝试
        callback();
      }
    });
  },

  _showAuthModal: function () {
    wx.showModal({
      title: '需要相册权限',
      content: '请允许保存图片到相册，用于导出文字图片',
      confirmText: '去设置',
      success: function (r) {
        if (r.confirm) {
          wx.openSetting();
        }
      }
    });
  }
})
