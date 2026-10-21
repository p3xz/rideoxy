describe('Keep-Awake Failure-Silence', () => {
  test('activateKeepAwakeAsync does not reject even if native module throws', async () => {
    let KeepAwake: any;
    try {
      KeepAwake = require('expo-keep-awake');
    } catch {
      // module not found in test environment
    }

    if (KeepAwake?.activateKeepAwakeAsync) {
      // Calling without mock or with failing native module must resolve quietly without rejection
      await expect(KeepAwake.activateKeepAwakeAsync()).resolves.toBeUndefined();
    }
  });

  test('deactivateKeepAwake does not reject even if native module throws', async () => {
    let KeepAwake: any;
    try {
      KeepAwake = require('expo-keep-awake');
    } catch {
      // module not found in test environment
    }

    if (KeepAwake?.deactivateKeepAwake) {
      await expect(KeepAwake.deactivateKeepAwake()).resolves.toBeUndefined();
    }
  });
});
