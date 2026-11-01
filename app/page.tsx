import SmoothScroll from '@/components/SmoothScroll';
import Cursor from '@/components/Cursor';
import Hero from '@/components/hero/Hero';
import Intro from '@/components/intro/Intro';
import Work from '@/components/work/Work';
import Jump from '@/components/jump/Jump';

export default function Home() {
  return (
    <main>
      <SmoothScroll />
      <Cursor />
      <Hero />
      <Intro />
      <Work />
      <Jump />
      {/* Next: III · LEGIO — team (engraved portraits), landing straight out of the jump. */}
    </main>
  );
}
