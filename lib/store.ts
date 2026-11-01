import * as THREE from 'three';
import type { Texture } from 'three';

// Shared mutable state read inside the render loop (no React re-renders).
export const store = {
  scroll: 0, // px
  heroProgress: 0, // 0..1 while the hero scrolls out
  mouse: { x: 0, y: 0 }, // -1..1
  pointer: { x: 0, y: 0 }, // raw px
  ready: false, // preloader finished -> start intro animations

  // Word + wreath -> Caesar transition (driven by scroll, see SmoothScroll).
  morph: 0, // 0 = bust in its hero pose, 1 = bust sitting in the intro slot (scroll-driven)
  assemble: 0, // 0..1 after the preloader: particles gather into the glass bust (time-driven)
  anchor: { x: 0, y: 0, w: 0, h: 0 }, // intro bust slot, viewport px
  sceneActive: true, // false once the intro has scrolled away -> stop rendering the 3D layer
  velocity: 0, // Lenis scroll velocity (px per frame), drives the warp speed
  jump: 0, // 0..1 progress through the hyperjump section
};

// Low-res background texture shared by the paper backdrop and the glass (which refracts it).
export const sky: { texture: Texture | null } = { texture: null };

// Filled by the 3D components each frame so they can hand off to one another.
export const morphShared = {
  bustMatrix: new THREE.Matrix4(), // world matrix of the Caesar bust
  headCenter: new THREE.Vector3(0, 0.38, 0), // in bust-local units (bust is 1 unit tall)
  headRadius: 0.12,
  bustReady: false,
};
