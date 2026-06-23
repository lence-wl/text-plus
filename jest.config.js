module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  moduleFileExtensions: ['js', 'json', 'wxml', 'wxss'],
  transformIgnorePatterns: [
    '/node_modules/(?!(miniprogram-simulate)/)'
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  collectCoverageFrom: [
    'components/**/*.js',
    '!node_modules/**',
    '!**/node_modules/**'
  ]
};
