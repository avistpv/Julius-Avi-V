'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, type ComponentType, type CSSProperties } from 'react';

// Sections below the fold mount only when the reader gets within ~1.5 screens of them. Until then
// a same-height placeholder keeps the page length, so nothing jumps. This keeps first-load
// hydration to the hero and intro (the rest used to hydrate in one 2 s task on a phone).
const MARGIN = '1500px 0px';

function useNear<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return;
      setNear(true);
      io.disconnect();
    }, { rootMargin: MARGIN });
    io.observe(el);
    // A nav jump needs the whole page in place first: 'mount-sections' mounts everything at once.
    const all = () => { setNear(true); io.disconnect(); };
    window.addEventListener('mount-sections', all);
    return () => { io.disconnect(); window.removeEventListener('mount-sections', all); };
  }, []);
  return { ref, near };
}

function lazy(load: () => Promise<{ default: ComponentType }>, placeholder: CSSProperties, label: string, anchor?: string) {
  const Section = dynamic(load, { ssr: false });
  return function Lazy() {
    const { ref, near } = useNear<HTMLDivElement>();
    if (near) return <Section />;
    return (
      <div ref={ref} style={{ position: 'relative', ...placeholder }} aria-label={label} role="region">
        {/* Nav target at the same place the mounted section puts it (one screen above its end). */}
        {anchor && <span id={anchor} style={{ position: 'absolute', top: 'calc(100% - 100vh)' }} aria-hidden />}
      </div>
    );
  };
}

export const LazyJump = lazy(() => import('./jump/Jump'), { marginTop: '-100vh', height: '600vh', background: '#1a130c' }, 'How we work');
export const LazyLegio = lazy(() => import('./legio/Legio'), { height: '300vh', background: '#06070f' }, 'Team');
export const LazyFinale = lazy(() => import('./finale/Finale'), { height: '260vh', background: '#06070f' }, 'Numbers and contact', 'contact');
