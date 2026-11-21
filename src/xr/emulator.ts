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

  // Install the emulated WebXR runtime.
  device.installRuntime({ forceInstall: true });

  // Install synthetic environment support.
  const sem = new SyntheticEnvironmentModule();
  device.installSyntheticEnvironmentModule(sem);

  // Load a built-in room.
  await device.sem.loadDefaultEnvironment('sunlit_living_room');

  // Install emulator controls.
  device.installDevUI(DevUI);

  console.info('[xr] IWER + synthetic environment installed');
}
