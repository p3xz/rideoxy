/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react',
        },
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|expo|@expo|@maplibre|lucide-react-native)',
  ],
  moduleNameMapper: {
    // Stub out native modules that can't run in Node
    '^expo-location$': '<rootDir>/__mocks__/expo-location.ts',
    '^expo-task-manager$': '<rootDir>/__mocks__/expo-task-manager.ts',
    '^expo-sqlite$': '<rootDir>/__mocks__/expo-sqlite.ts',
    '^expo-file-system$': '<rootDir>/__mocks__/expo-file-system-legacy.ts',
    '^expo-file-system/legacy$': '<rootDir>/__mocks__/expo-file-system-legacy.ts',
    '^expo-image-picker$': '<rootDir>/__mocks__/expo-image-picker.ts',
    '^expo-haptics$': '<rootDir>/__mocks__/expo-haptics.ts',
    '^expo-splash-screen$': '<rootDir>/__mocks__/expo-splash-screen.ts',
    '^expo-sensors$': '<rootDir>/__mocks__/expo-sensors.ts',
  },
};
