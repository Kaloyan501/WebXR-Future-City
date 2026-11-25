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

  // Haze is tuned for the desktop camera distance; VR gets its own treatment later.
  if (look.haze < 0.02 || t.inVR) {
    t.scene.fog = null;
    return;
  }
  if (t.scene.fog instanceof THREE.Fog) {
    t.scene.fog.color.set(look.fogColor);
    t.scene.fog.near = look.fogNear;
    t.scene.fog.far = look.fogFar;
  } else {
    t.scene.fog = new THREE.Fog(look.fogColor, look.fogNear, look.fogFar);
  }
}
