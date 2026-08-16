/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/shared'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['shared/**/*.ts', '!shared/**/*.d.ts', '!shared/**/__tests__/**'],
  coverageDirectory: 'coverage',
  verbose: true,
  forceExit: true,
  // shared/ のみをコンパイルしてカバレッジ収集（auth 等の import エラーを防ぐ）
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
};
