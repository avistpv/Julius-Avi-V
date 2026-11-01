'use client';
import { Component, type ReactNode } from 'react';

// If WebGL can't start (old device, blocked GPU, lost context), show plain paper instead of
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
          style={{ position: 'absolute', inset: 0, background: 'var(--paper)' }}
        />
      );
    }
    return this.props.children;
  }
}
