// Jest setup file for WeChat Mini Program testing
const simulate = require('miniprogram-simulate');

// Mock wx object for testing
global.wx = {
  createSelectorQuery: () => ({
    select: () => ({
      boundingClientRect: () => ({
        exec: (cb) => cb([[{ width: 100, height: 50 }]])
      })
    }),
    in: () => ({
      boundingClientRect: () => ({
        exec: (cb) => cb([[{ width: 100, height: 50 }]])
      })
    })
  }),
  getSystemInfo: (options) => {
    options.success && options.success({
      screenWidth: 375,
      screenHeight: 812,
      platform: 'devtools'
    });
  },
  getSystemInfoSync: () => ({
    screenWidth: 375,
    screenHeight: 812,
    platform: 'devtools'
  })
};

// Export simulate for use in tests
global.simulate = simulate;
