'use client';
import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { store, sky } from '@/lib/store';

// Living paper: the page's paper tone with a very faint drift of warm and cool light, like daylight
// moving across a wall. Perf: rendered into a small offscreen texture (blurry by design), then
// stretched to full screen. The same texture is what the glass bust refracts — no extra scene pass.
const SKY_W = 384;

const quadVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }
`;

const skyFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uRes;
  uniform vec2 uMouse;
  uniform float uFade;

  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
  float fbm(vec2 p) {
    float f = 0.0, a = 0.5;
    for (int i = 0; i < 3; i++) { f += a * snoise(p); p *= 1.9; a *= 0.42; }
    return f;
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
    p += uMouse * 0.03;

    float a = -0.9;
    p = mat2(cos(a), -sin(a), sin(a), cos(a)) * p;

    float t = uTime * 0.03;
    vec2 q = vec2(p.x * 0.32, p.y * 1.05);
    vec2 w = vec2(fbm(q + vec2(t, -t * 0.6)), fbm(q + vec2(4.2 - t * 0.8, 1.3 + t)));
    float n = fbm(q + 0.9 * w + vec2(t * 0.5, 0.0));

    vec3 paper = vec3(0.953, 0.949, 0.933);
    vec3 cool  = vec3(0.925, 0.932, 0.940);
    vec3 warm  = vec3(0.975, 0.962, 0.930);
    vec3 light = vec3(0.990, 0.988, 0.980);

    float lit = smoothstep(-0.05, 0.75, n);
    float wrm = smoothstep(0.2, 0.9, n + 0.3 * w.x);
    vec3 col = mix(paper, cool, smoothstep(0.8, 0.0, uv.y) * 0.5);
    col = mix(col, light, lit * 0.6);
    col = mix(col, warm, wrm * 0.5);
    col *= 1.0 - 0.035 * length(uv - 0.5);

    col = mix(col, paper, uFade);
    gl_FragColor = vec4(col, 1.0);
  }
`;

// Full-screen display of the low-res sky + fine grain (added at full res so there is no banding).
const showFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uSky;
  void main() {
    vec3 col = texture2D(uSky, vUv).rgb;
    float g = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    col += (g - 0.5) / 255.0 * 2.0;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export default function Sky() {
  const size = useThree((s) => s.size);

  const { rt, offScene, offCam, skyMat } = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(SKY_W, 240, {
      depthBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
    });
    const skyMat = new THREE.ShaderMaterial({
      vertexShader: quadVert,
      fragmentShader: skyFrag,
      uniforms: {
        uTime: { value: 0 },
        uRes: { value: new THREE.Vector2(16, 9) },
        uMouse: { value: new THREE.Vector2() },
        uFade: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });
    const offScene = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMat);
    quad.frustumCulled = false;
    offScene.add(quad);
    const offCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return { rt, offScene, offCam, skyMat };
  }, []);

  // Keep the offscreen texture at the screen's aspect ratio.
  useEffect(() => {
    rt.setSize(SKY_W, Math.max(1, Math.round((SKY_W * size.height) / size.width)));
    skyMat.uniforms.uRes.value.set(size.width, size.height);
    sky.texture = rt.texture;
  }, [rt, skyMat, size]);

  useEffect(() => () => { rt.dispose(); skyMat.dispose(); sky.texture = null; }, [rt, skyMat]);

  const showUniforms = useMemo(() => ({ uSky: { value: rt.texture } }), [rt]);
  const mouse = useMemo(() => new THREE.Vector2(), []);

  // Runs before the main render (negative priority keeps R3F's own render loop).
  useFrame(({ gl }, dt) => {
    const u = skyMat.uniforms;
    u.uTime.value += dt;
    mouse.set(store.mouse.x, store.mouse.y);
    u.uMouse.value.lerp(mouse, 0.03);
    u.uFade.value = THREE.MathUtils.smoothstep(store.heroProgress, 0.15, 0.85);
    gl.setRenderTarget(rt);
    gl.render(offScene, offCam);
    gl.setRenderTarget(null);
  }, -1);

  return (
    <mesh frustumCulled={false} renderOrder={-1}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial vertexShader={quadVert} fragmentShader={showFrag} uniforms={showUniforms} depthWrite={false} depthTest={false} />
    </mesh>
  );
}
