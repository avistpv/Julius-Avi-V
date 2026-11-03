// True when WebGL runs on the CPU (SwiftShader, llvmpipe, Microsoft Basic Render Driver): no GPU, so
// every pixel and frame of a WebGL scene costs main-thread time. Lab tools such as PageSpeed Insights
// run this way, as do VMs and machines with blocklisted drivers. Scenes stay the same; they just draw
// fewer pixels and frames there.
let cached: boolean | undefined;

export function isSoftwareGL(): boolean {
  if (cached !== undefined) return cached;
  cached = false;
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    if (gl && info) cached = /swiftshader|llvmpipe|software|basic render/i.test(String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)));
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    // No WebGL at all: the scenes fall back on their own.
  }
  return cached;
}
