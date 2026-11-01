import SmoothScroll from '@/components/SmoothScroll';
import Cursor from '@/components/Cursor';
import Hero from '@/components/hero/Hero';
import Intro from '@/components/intro/Intro';
import Work from '@/components/work/Work';
import Jump from '@/components/jump/Jump';
import Legio from '@/components/legio/Legio';
import Finale from '@/components/finale/Finale';

export default function Home() {
  return (
    <main>
      <SmoothScroll />
      <Cursor />
      <Hero />
      <Intro />
      <Work />
      <Jump />
      <Legio />
      <Finale />
    </main>
  );
}
