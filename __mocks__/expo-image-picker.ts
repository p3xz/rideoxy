export const requestCameraPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
export const requestMediaLibraryPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
export const launchCameraAsync = jest.fn().mockResolvedValue({ canceled: true, assets: [] });
export const launchImageLibraryAsync = jest.fn().mockResolvedValue({ canceled: true, assets: [] });
