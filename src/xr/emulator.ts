/**
 * Dev-only WebXR emulator (IWER + DevUI). Only installs when the browser has no real
 * immersive-vr support, so it stays out of the way on the Quest and when the
 * Immersive Web Emulator extension is already active. Stripped from production builds.
 */
export async function installEmulatorIfNeeded(): Promise<void> {
  if (import.meta.env.DEV) {
    const supported = navigator.xr
      ? await navigator.xr.isSessionSupported('immersive-vr').catch(() => false)
      : false;
    if (supported) return;

    const { XRDevice, metaQuest3 } = await import('iwer');
    const { DevUI } = await import('@iwer/devui');
    const device = new XRDevice(metaQuest3);
    // Chrome exposes navigator.xr even without a headset, so IWER must be forced to install.
    device.installRuntime({ forceInstall: true });
    // installDevUI mounts the control panel and drives it every frame; `new DevUI(device)`
    // alone only shows the "Enter XR" pill.
    device.installDevUI(DevUI);
    console.info('[xr] IWER emulator installed (Meta Quest 3 preset)');
  }
}
