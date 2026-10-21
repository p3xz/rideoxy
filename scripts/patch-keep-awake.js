const fs = require('fs');
const path = require('path');

function patchFile(filePath, transforms) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const { target, replacement } of transforms) {
    if (content.includes(target)) {
      content = content.replace(target, replacement);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[patch-keep-awake] Successfully patched ${filePath}`);
  }
}

// 1. Patch expo-keep-awake/src/index.ts
const keepAwakeIndexPath = path.join(__dirname, '..', 'node_modules', 'expo-keep-awake', 'src', 'index.ts');
patchFile(keepAwakeIndexPath, [
  {
    target: `activateKeepAwakeAsync(tagOrDefault).then(() => {
      if (isMounted && ExpoKeepAwake.addListenerForTag && options?.listener) {
        addListener(tagOrDefault, options.listener);
      }
    });`,
    replacement: `activateKeepAwakeAsync(tagOrDefault)
      .then(() => {
        if (isMounted && ExpoKeepAwake.addListenerForTag && options?.listener) {
          addListener(tagOrDefault, options.listener);
        }
      })
      .catch(() => {});`,
  },
  {
    target: `      if (options?.suppressDeactivateWarnings) {
        deactivateKeepAwake(tagOrDefault).catch(() => {});
      } else {
        deactivateKeepAwake(tagOrDefault);
      }`,
    replacement: `      deactivateKeepAwake(tagOrDefault).catch(() => {});`,
  },
  {
    target: `export async function activateKeepAwakeAsync(tag: string = ExpoKeepAwakeTag): Promise<void> {
  await ExpoKeepAwake.activate?.(tag);
}`,
    replacement: `export async function activateKeepAwakeAsync(tag: string = ExpoKeepAwakeTag): Promise<void> {
  try {
    await ExpoKeepAwake.activate?.(tag);
  } catch {}
}`,
  },
  {
    target: `export async function deactivateKeepAwake(tag: string = ExpoKeepAwakeTag): Promise<void> {
  await ExpoKeepAwake.deactivate?.(tag);
}`,
    replacement: `export async function deactivateKeepAwake(tag: string = ExpoKeepAwakeTag): Promise<void> {
  try {
    await ExpoKeepAwake.deactivate?.(tag);
  } catch {}
}`,
  },
]);

// 2. Patch expo/src/launch/withDevTools.tsx & withDevTools.ios.tsx
['withDevTools.tsx', 'withDevTools.ios.tsx'].forEach((fileName) => {
  const withDevToolsPath = path.join(__dirname, '..', 'node_modules', 'expo', 'src', 'launch', fileName);
  patchFile(withDevToolsPath, [
    {
      target: `return () => useKeepAwake(ExpoKeepAwakeTag, { suppressDeactivateWarnings: true });`,
      replacement: `return () => {
        try {
          useKeepAwake(ExpoKeepAwakeTag, { suppressDeactivateWarnings: true });
        } catch {}
      };`,
    },
  ]);
});
