'use client';
import { Component, type ReactNode } from 'react';

// If WebGL can't start (old device, blocked GPU, lost context), show a calm CSS sky instead of
// breaking the whole page. The hero text and everything below keep working.
export default class SceneBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    // Let the preloader finish even though the 3D scene never reported a first frame.
    window.dispatchEvent(new Event('scene-ready'));
  }

  render() {
    if (this.state.failed) {
      if (this.props.fallback !== undefined) return this.props.fallback;
      return (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 'calc(1 - var(--hp, 0))', // fades to the paper background like the real sky
            background:
              'radial-gradient(60% 50% at 70% 25%, rgba(255,244,218,0.85), transparent 70%),' +
              'radial-gradient(50% 60% at 20% 70%, rgba(246,249,252,0.8), transparent 70%),' +
              'linear-gradient(180deg, #c3dcf0 0%, #a9cbea 100%)',
          }}
        />
      );
    }
    return this.props.children;
  }
}
