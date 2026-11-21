export async function installEmulatorIfNeeded(): Promise<void> {
  const forceEmulator =
  new URLSearchParams(window.location.search).get('emulateXR') === '1';

  if (!import.meta.env.DEV && !forceEmulator) return;

  // Don't replace a real WebXR runtime unless explicitly requested.
  if (!forceEmulator) {
    const supported = navigator.xr
    ? await navigator.xr.isSessionSupported('immersive-vr').catch(() => false)
    : false;

    if (supported) return;
  }

  const [
    { XRDevice, metaQuest3 },
    { DevUI },
    { SyntheticEnvironmentModule }
  ] = await Promise.all([
    import('iwer'),
                        import('@iwer/devui'),
                        import('@iwer/sem')
  ]);

  const device = new XRDevice(metaQuest3);

  device.installRuntime({ forceInstall: true });
  device.installDevUI(DevUI);

  // Install SEM using the new API.
  device.installSEM(SyntheticEnvironmentModule);

  // The SEM property is optional in the TypeScript definitions.
  const sem = device.sem;

  if (!sem) {
    throw new Error('[xr] Failed to initialize Synthetic Environment Module');
  }

  await sem.loadDefaultEnvironment('sunlit_living_room');

  console.info('[xr] IWER + SEM environment installed');
}
