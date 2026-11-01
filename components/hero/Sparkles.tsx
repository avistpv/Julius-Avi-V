'use client';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { store } from '@/lib/store';

// Little four-point glints that twinkle on the upper highlights of the tube (like in the reference).
const COUNT = 14;

const vert = /* glsl */ `
  attribute float aPhase;
  attribute float aSize;
  uniform float uTime;
  uniform float uReveal;
  varying float vAlpha;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    float tw = pow(max(0.0, sin(uTime * 1.3 + aPhase * 6.2831)), 6.0);
    vAlpha = tw * uReveal;
    float s = aSize * (0.35 + 0.65 * tw);
    // Billboard: offset in view space so the glint always faces the camera.
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mv.xy += position.xy * s;
    gl_Position = projectionMatrix * mv;
  }
`;

const frag = /* glsl */ `
  varying float vAlpha;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - 0.5;
    float core = exp(-dot(p, p) * 140.0);
    float rayX = exp(-abs(p.y) * 90.0) * exp(-abs(p.x) * 7.0);
    float rayY = exp(-abs(p.x) * 90.0) * exp(-abs(p.y) * 7.0);
    float a = clamp(core + (rayX + rayY) * 0.9, 0.0, 1.0) * vAlpha;
    gl_FragColor = vec4(vec3(1.0), a);
  }
`;

export default function Sparkles({ curve, radius }: { curve: THREE.Curve<THREE.Vector3>; radius: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const mat = useRef<THREE.ShaderMaterial>(null!);
  const reveal = useRef(0);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uReveal: { value: 0 } }), []);

  const { geo } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1);
    const phase = new Float32Array(COUNT);
    const size = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      phase[i] = Math.random();
      size[i] = 0.35 + Math.random() * 0.35;
    }
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
    geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 1));
    return { geo };
  }, []);

  const matrices = useMemo(() => {
    // Pick points spread along the stroke and sit them on the upper-front rim of the tube.
    const out: THREE.Matrix4[] = [];
    for (let i = 0; i < COUNT; i++) {
      const t = (i + 0.5) / COUNT + (Math.random() - 0.5) * 0.03;
      const p = curve.getPointAt(THREE.MathUtils.clamp(t, 0, 1));
      p.add(new THREE.Vector3(-0.35, 0.75, 0.6).normalize().multiplyScalar(radius * 1.02));
      out.push(new THREE.Matrix4().makeTranslation(p.x, p.y, p.z));
    }
    return out;
  }, [curve, radius]);

  useFrame((state, dt) => {
    if (!mesh.current) return;
    if (mesh.current.userData.init !== true) {
      matrices.forEach((m, i) => mesh.current.setMatrixAt(i, m));
      mesh.current.instanceMatrix.needsUpdate = true;
      mesh.current.userData.init = true;
    }
    // Glints appear after the word has been written.
    if (store.ready) reveal.current = Math.min(1, reveal.current + dt * 0.4);
    mat.current.uniforms.uTime.value = state.clock.elapsedTime;
    mat.current.uniforms.uReveal.value = Math.max(0, reveal.current * 2 - 1);
  });

  return (
    <instancedMesh ref={mesh} args={[geo, undefined, COUNT]} frustumCulled={false} renderOrder={10}>
      <shaderMaterial
        ref={mat}
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  );
}
