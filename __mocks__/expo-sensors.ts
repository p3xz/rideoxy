// Minimal stub for expo-sensors used in Jest node environment
export const Accelerometer = {
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  setUpdateInterval: jest.fn(),
  addListener: jest.fn().mockImplementation(() => ({ remove: jest.fn() })),
  removeAllListeners: jest.fn(),
};

export const Gyroscope = {
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  setUpdateInterval: jest.fn(),
  addListener: jest.fn().mockImplementation(() => ({ remove: jest.fn() })),
  removeAllListeners: jest.fn(),
};

export default {
  Accelerometer,
  Gyroscope,
};
