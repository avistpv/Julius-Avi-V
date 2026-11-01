'use client';
import { Suspense, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment, Lightformer, PerformanceMonitor } from '@react-three/drei';
import Sky from './Sky';
import Morph from './Morph';
import { store } from '@/lib/store';

// Stop rendering entirely once the hero + intro (where the bust lives) have scrolled off screen.
function FrameGate() {
  const set = useThree((s) => s.set);
  useEffect(() => {
    let raf = 0;
    let running = true;
    const loop = () => {
      const visible = store.sceneActive;
      if (visible !== running) {
        running = visible;
        set({ frameloop: visible ? 'always' : 'never' });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [set]);
  return null;
}

export default function Scene() {
  // Start at up to 1.5x pixel density; drop to 1x if the GPU struggles.
  const [dpr, setDpr] = useState(1.5);
  return (
    <Canvas
      className="scene-canvas"
      dpr={[1, dpr]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
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
      <FrameGate />
    </Canvas>
  );
}

