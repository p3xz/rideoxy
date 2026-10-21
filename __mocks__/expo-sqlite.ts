// Minimal stub for expo-sqlite
export const openDatabaseSync = jest.fn().mockReturnValue({
  runAsync: jest.fn().mockResolvedValue(undefined),
  getAllAsync: jest.fn().mockResolvedValue([]),
  getFirstAsync: jest.fn().mockResolvedValue(null),
  withTransactionAsync: jest.fn().mockResolvedValue(undefined),
  execAsync: jest.fn().mockResolvedValue(undefined),
});
export const SQLiteProvider = jest.fn();
