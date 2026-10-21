// Minimal stub for expo-sqlite
const mockDb = {
  runAsync: jest.fn().mockResolvedValue(undefined),
  getAllAsync: jest.fn().mockResolvedValue([]),
  getFirstAsync: jest.fn().mockResolvedValue(null),
  withTransactionAsync: jest.fn().mockResolvedValue(undefined),
  execAsync: jest.fn().mockResolvedValue(undefined),
  execSync: jest.fn(),
  getAllSync: jest.fn().mockReturnValue([]),
  getFirstSync: jest.fn().mockReturnValue(null),
  runSync: jest.fn(),
};

export const openDatabaseSync = jest.fn().mockReturnValue(mockDb);
export const openDatabaseAsync = jest.fn().mockResolvedValue(mockDb);
export const SQLiteProvider = jest.fn();
