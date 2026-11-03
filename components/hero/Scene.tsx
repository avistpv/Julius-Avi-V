'use client';
import { Suspense, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import StudioEnv from './StudioEnv';
import Sky from './Sky';
import Morph from './Morph';
import { store } from '@/lib/store';
import { isSoftwareGL } from '@/lib/gpu';

// Without a GPU (see lib/gpu.ts) the same scene draws at half resolution, without MSAA, every third
// display frame (~20 fps): there each frame is read back to the CPU and the main thread waits for it.
const SOFT_DPR = 0.5;
const SOFT_FRAME_STEP = 3;

// Stop rendering entirely once the hero + intro (where the bust lives) have scrolled off screen.
// On software WebGL the scene runs on demand and is invalidated every SOFT_FRAME_STEP frames while visible.
function FrameGate({ isSoft }: { isSoft: boolean }) {
  const set = useThree((s) => s.set);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    let raf = 0;
    let running = true;
    let frame = 0;
    const loop = () => {
      const visible = store.sceneActive;
      if (!isSoft && visible !== running) {
        running = visible;
        set({ frameloop: visible ? 'always' : 'never' });
      }
      if (isSoft && visible && frame++ % SOFT_FRAME_STEP === 0) invalidate();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [set, invalidate, isSoft]);
  return null;
}

export default function Scene() {
  // 1.5x pixel density on desktops, 1x on phones, half on software WebGL.
  const [isSoft] = useState(isSoftwareGL);
  const dpr = typeof window !== 'undefined' && window.innerWidth < 900 ? 1 : 1.5;
  return (
    <Canvas
      className="scene-canvas"
      dpr={isSoft ? SOFT_DPR : [1, dpr]}
      frameloop={isSoft ? 'demand' : 'always'}
      gl={{ antialias: !isSoft, alpha: false, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 10], fov: 32, near: 0.1, far: 50 }}
      onCreated={({ gl }) => {
        gl.setClearColor('#f3f2ee');
        // First frame is on screen -> let the preloader finish.
        requestAnimationFrame(() => window.dispatchEvent(new Event('scene-ready')));
      }}
    >
      <Sky />

      {/* Studio lighting from a tiny procedural equirect (see StudioEnv). */}
      <StudioEnv />
      <ambientLight intensity={0.4} />
      <directionalLight position={[-3, 5, 6]} intensity={1.2} />

      <Suspense fallback={null}>
        <Morph />
      </Suspense>
      <FrameGate isSoft={isSoft} />
    </Canvas>
  );
}

