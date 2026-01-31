import { Header } from "@/components/header";
import { HeroSection } from "@/components/hero-section";
import { PhilosophySection } from "@/components/philosophy-section";
import { FeaturedProductsSection } from "@/components/featured-products-section";
import { TechnologySection } from "@/components/technology-section";
import { GallerySection } from "@/components/gallery-section";
import { CollectionSection } from "@/components/collection-section";
import { EditorialSection } from "@/components/editorial-section";
import { TestimonialsSection } from "@/components/testimonials-section";
import { FooterSection } from "@/components/footer-section";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <HeroSection />
      <PhilosophySection />
      <FeaturedProductsSection />
      <TechnologySection />
      <GallerySection />
      <CollectionSection />
      <EditorialSection />
      <TestimonialsSection />
      <FooterSection />
    </main>
  );
}
