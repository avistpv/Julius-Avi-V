'use client';
import dynamic from 'next/dynamic';

const BustFrames = dynamic(() => import('@/components/lab/BustFrames'), { ssr: false });

// Dev rig: node tools/bust-frames.mjs renders the pre-made bust frames from this page.
export default function BustLabPage() {
  return <BustFrames />;
}
