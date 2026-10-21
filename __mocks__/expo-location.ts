// Minimal stub for expo-location — only the constants/enums used in location.ts
export const Accuracy = {
  Lowest: 1,
  Low: 2,
  Balanced: 3,
  High: 4,
  Highest: 5,
  BestForNavigation: 6,
};
export const getForegroundPermissionsAsync = jest.fn().mockResolvedValue({ granted: true });
export const getBackgroundPermissionsAsync = jest.fn().mockResolvedValue({ granted: false });
export const requestForegroundPermissionsAsync = jest.fn().mockResolvedValue({ granted: true });
export const requestBackgroundPermissionsAsync = jest.fn().mockResolvedValue({ granted: false });
export const getCurrentPositionAsync = jest.fn().mockResolvedValue(null);
export const watchPositionAsync = jest.fn().mockResolvedValue({ remove: jest.fn() });
export const startLocationUpdatesAsync = jest.fn().mockResolvedValue(undefined);
export const stopLocationUpdatesAsync = jest.fn().mockResolvedValue(undefined);
export const hasStartedLocationUpdatesAsync = jest.fn().mockResolvedValue(false);
