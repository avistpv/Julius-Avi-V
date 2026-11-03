'use client';
import { Suspense, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment, Lightformer, PerformanceMonitor } from '@react-three/drei';
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
  // Start at up to 1.5x pixel density; drop to 1x if the GPU struggles.
  const [dpr, setDpr] = useState(1.5);
  const [isSoft] = useState(isSoftwareGL);
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

      {/* Studio lighting baked into an environment map: soft boxes give the glossy, balloon-like highlights. */}
      <Environment resolution={256} frames={1}>
        <color attach="background" args={['#efece6']} />
        <Lightformer form="rect" intensity={4} position={[0, 5, 2]} scale={[10, 2, 1]} rotation-x={Math.PI / 2} />
        <Lightformer form="rect" intensity={2.5} position={[-5, 1, 3]} scale={[3, 6, 1]} rotation-y={Math.PI / 2} />
        <Lightformer form="rect" intensity={2} position={[5, 0, 3]} scale={[3, 6, 1]} rotation-y={-Math.PI / 2} />
        <Lightformer form="ring" color="#fff1d6" intensity={3} position={[2, 3, 4]} scale={2} />
        <Lightformer form="rect" color="#9fbcf0" intensity={1} position={[0, -4, 1]} scale={[10, 2, 1]} rotation-x={-Math.PI / 2} />
      </Environment>
      <ambientLight intensity={0.4} />
      <directionalLight position={[-3, 5, 6]} intensity={1.2} />

      <Suspense fallback={null}>
        <Morph />
      </Suspense>
      <PerformanceMonitor onDecline={() => setDpr(1)} />
      <FrameGate isSoft={isSoft} />
    </Canvas>
  );
}

