export const documentDirectory = 'file:///mock-docs/';
export const cacheDirectory = 'file:///mock-cache/';
export const getInfoAsync = jest.fn().mockResolvedValue({ exists: true, isDirectory: true });
export const makeDirectoryAsync = jest.fn().mockResolvedValue(undefined);
export const copyAsync = jest.fn().mockResolvedValue(undefined);
export const deleteAsync = jest.fn().mockResolvedValue(undefined);
