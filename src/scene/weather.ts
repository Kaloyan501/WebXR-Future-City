import * as THREE from 'three';
import type { WeatherLook } from '../climate/weatherLook.ts';

export interface WeatherTargets {
  scene: THREE.Scene;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  inVR: boolean;
}

/** Applies the climate settings to the 3D scene: sunlight strength and colour, sky light, smog/fog haze. */
export function applyWeather(look: WeatherLook, t: WeatherTargets): void {
  t.sun.intensity = look.sunIntensity * 2; // the scene was lit with a 1.8 sun before; 0.9 × 2 keeps it close
  t.sun.color.set(look.sunColor);
  t.hemi.color.set(look.hemiSky);

  if (look.haze < 0.02) {
    t.scene.fog = null;
    return;
  }
  // Desktop distances are tuned for the camera ~69 units away; in VR the model is ~1.3 m away.
  const near = t.inVR ? 2.4 - 1.6 * look.haze : look.fogNear;
  const far = t.inVR ? 4.2 - 2.4 * look.haze : look.fogFar;
  if (t.scene.fog instanceof THREE.Fog) {
    t.scene.fog.color.set(look.fogColor);
    t.scene.fog.near = near;
    t.scene.fog.far = far;
  } else {
    t.scene.fog = new THREE.Fog(look.fogColor, near, far);
  }
}
