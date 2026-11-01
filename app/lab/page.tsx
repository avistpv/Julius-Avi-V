'use client';
import dynamic from 'next/dynamic';
const BustLab = dynamic(() => import('@/components/lab/BustLab'), { ssr: false });
export default function Lab() {
  return <BustLab />;
}
