import SmoothScroll from '@/components/SmoothScroll';
import Cursor from '@/components/Cursor';
import Hero from '@/components/hero/Hero';
import Intro from '@/components/intro/Intro';
import Work from '@/components/work/Work';
import { LazyJump, LazyLegio, LazyFinale } from '@/components/LazySections';

export default function Home() {
  return (
    <main>
      <SmoothScroll />
      <Cursor />
      <Hero />
      <Intro />
      <Work />
      <LazyJump />
      <LazyLegio />
      <LazyFinale />
    </main>
  );
}
