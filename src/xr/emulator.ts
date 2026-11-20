/**
 * WebXR emulator (IWER + DevUI).
 * Enabled automatically in development or explicitly with ?emulateXR=1.
 */
export async function installEmulatorIfNeeded(): Promise<void> {
  const requested =
  import.meta.env.DEV ||
  new URLSearchParams(window.location.search).get('emulateXR') === '1';

  if (!requested) return;

  const supported = navigator.xr
  ? await navigator.xr.isSessionSupported('immersive-vr').catch(() => false)
  : false;

  // Never override a real VR implementation.
  if (supported) return;

  const { XRDevice, metaQuest3 } = await import('iwer');
  const { DevUI } = await import('@iwer/devui');

  const device = new XRDevice(metaQuest3);

  device.installRuntime({ forceInstall: true });
  device.installDevUI(DevUI);

  console.info('[xr] IWER emulator installed');
}
