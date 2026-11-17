import * as THREE from "three";
/** Future renderer foundation. Not registered as a playable game. Caller owns disposal. */
export function createKartScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#211b19");
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  camera.position.set(0, 6, 10);
  scene.add(new THREE.HemisphereLight(0xffe9c6, 0x443333, 2));
  return { scene, camera };
}
