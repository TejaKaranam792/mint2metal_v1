"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";

export default function Home() {
  // Carousel state for the "Pioneering RWA" section
  const [currentSlide, setCurrentSlide] = useState(0);

  const carouselSlides = [
    {
      title: "Enterprise-Grade \nAsset Tokenization",
      description: "Our infrastructure enables seamless tokenization, storage auditing, and fractional ownership of real-world assets, starting with precious metals. We bridge the gap between traditional vaulting and decentralized finance.",
      image: "/store_of_value_hand.png"
    },
    {
      title: "Fractional Ownership \nof Precious Metals",
      description: "Democratizing access to high-value assets. Investors can own portions of LBMA-certified bullion bars, making gold and silver investment accessible to everyone, anywhere.",
      image: "/gold_fractional_ownership.png"
    },
    {
      title: "Institutional-Level \nSecurity & Compliance",
      description: "Your assets are secured in world-class vaults (Brinks/Malca-Amit) with full insurance and multi-sig security. We adhere to the highest global compliance standards for RWA issuance.",
      image: "/vault_security.png"
    },
    {
      title: "Real-Time \nProof of Reserves",
      description: "Unparalleled transparency. Every digital token is backed by a physically audited gram of precious metal, with real-time on-chain verification of our vault holdings.",
      image: "/proof_of_reserves.png"
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [carouselSlides.length]);

  return (
    <div className="min-h-screen bg-background text-primary-text font-sans overflow-x-hidden">
      {/* Navbar */}
      <nav className="absolute top-0 w-full z-50 py-6 px-8 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3 cursor-pointer">
          <Image 
            src="/logo.png" 
            alt="Mint2Metal Logo" 
            width={40} 
            height={40} 
            className="object-contain"
          />
          <div className="text-xl font-bold tracking-wide">
            mint2metal
            <span className="text-primary font-normal text-sm align-top">
              SILVER
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-6 text-sm font-medium">
          <Link href="#faqs" className="hover:text-primary transition-colors">FAQ's</Link>
          <Link href="/auth/login" className="px-5 py-2 rounded border border-border-strong hover:border-primary transition-colors">
            Log In
          </Link>
          <Link href="/auth/signup" className="px-5 py-2 rounded bg-primary text-background hover:bg-primary-strong transition-colors">
            Sign Up
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-screen w-full flex flex-col items-center justify-center text-center px-4">
        {/* Background Image Setup */}
        <div className="absolute inset-0 z-0 bg-black">
          <Image
            src="/hero_vault_bg.png"
            alt="Silver Vault Background"
            fill
            className="object-cover opacity-50 transition-opacity duration-1000"
            priority
          />
        </div>
        {/* Gradient Overlay for bottom blending */}
        <div className="absolute inset-0 z-0 bg-gradient-to-t from-background via-black/40 to-transparent"></div>

        <div className="relative z-10 max-w-4xl mt-16">
          <h1 className="text-6xl md:text-7xl font-bold tracking-tight mb-6">
            <span className="text-primary">Mint2Metal</span> is the premiere <br />
            <span className="text-primary">RWA infrastructure.</span>
          </h1>
          <p className="text-lg md:text-xl text-primary-text/90 max-w-2xl mx-auto mb-16 font-light">
            We provide the technology and framework for institutions to bring physical precious metals onto the blockchain securely and transparently.
          </p>

          {/* Lookup Pill */}
          <div className="glass-pill mx-auto max-w-3xl flex items-center justify-between p-2 pl-6 rounded-full border border-white/20 bg-black/40 backdrop-blur-md">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/50">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              </div>
              <div className="text-left">
                <div className="text-base font-bold">Asset Allocation Lookup</div>
                <div className="text-xs text-secondary-text">Enter the address that holds verified RWA tokens below</div>
              </div>
            </div>
            <div className="flex gap-2 w-1/3">
              <input 
                type="text" 
                placeholder="Stellar address" 
                className="w-full bg-transparent border border-white/30 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-primary text-white"
              />
              <button className="bg-primary text-background px-6 py-2 rounded-full font-medium hover:bg-primary-strong transition-colors min-w-[100px]">
                Look up
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Store of Value Section (Carousel) */}
      <section className="py-24 px-8 max-w-7xl mx-auto relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 text-5xl md:text-8xl font-black text-white/5 blur-sm z-0 text-center w-full mt-10">
          Pioneering RWA <br/> Tokenization
        </div>
        
        <div className="relative z-10 rounded-3xl border border-primary/30 overflow-hidden bg-surface/50 backdrop-blur-sm mt-16 max-w-5xl mx-auto min-h-[400px]">
          <div className="flex transition-transform duration-700 ease-in-out" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
            {carouselSlides.map((slide, index) => (
              <div key={index} className="min-w-full flex flex-col md:flex-row">
                <div className="md:w-1/2 h-64 md:h-[400px] relative bg-black">
                  <Image
                    src={slide.image}
                    alt={slide.title}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-surface/90"></div>
                </div>
                <div className="md:w-1/2 p-10 md:p-16 flex flex-col justify-center">
                  <h2 className="text-3xl font-bold mb-6 whitespace-pre-line">{slide.title}</h2>
                  <p className="text-secondary-text leading-relaxed text-lg">
                    {slide.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Carousel indicators */}
        <div className="flex justify-center gap-3 mt-8">
          {carouselSlides.map((_, index) => (
            <div 
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-3 h-3 rounded-full border border-primary transition-all duration-300 cursor-pointer ${currentSlide === index ? 'bg-primary scale-125' : 'bg-transparent opacity-50 hover:opacity-100'}`}
            ></div>
          ))}
        </div>
      </section>

      {/* What We Do Section */}
      <section className="py-24 px-8 max-w-7xl mx-auto border-t border-border-subtle">
        <div className="flex flex-col md:flex-row gap-16 items-center">
          
          <div className="md:w-1/2">
            <h2 className="text-4xl md:text-5xl font-bold text-primary mb-6 leading-tight">
              Bridging the Gap Between <br/> Vaults and Blockchain.
            </h2>
            <p className="text-secondary-text text-lg mb-8 leading-relaxed">
              Mint2Metal provides a robust, institutional-grade infrastructure for the tokenization of real-world assets. We specialize in bringing physical silver and other precious metals onto the Stellar network, ensuring 1:1 backing, real-time auditing, and seamless fractional ownership.
            </p>
            <div className="space-y-4 mb-10">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0 mt-1">✓</div>
                <p className="text-primary-text/80">LBMA-certified physical commodity backing</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0 mt-1">✓</div>
                <p className="text-primary-text/80">Automated Proof of Reserve (PoR) protocols</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0 mt-1">✓</div>
                <p className="text-primary-text/80">Enterprise-grade API & Smart Contract rails</p>
              </div>
            </div>
            <button className="bg-primary text-background px-8 py-3 rounded-full font-bold hover:bg-primary-strong transition-colors text-lg shadow-[0_0_20px_rgba(226,232,240,0.2)]">
              Explore Our Infrastructure
            </button>
          </div>

          <div className="md:w-1/2">
             <div className="rounded-3xl border border-primary/30 overflow-hidden bg-surface shadow-2xl relative h-[500px]">
                <Image
                  src="/easy_to_transport.png"
                  alt="Mint2Metal Security"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent"></div>
                <div className="absolute bottom-8 left-8 right-8 p-6 glass-pill border border-white/10 rounded-2xl backdrop-blur-md">
                   <div className="text-sm font-bold text-primary mb-1 uppercase tracking-widest">Our Mission</div>
                   <div className="text-lg font-medium text-white">Democratizing access to precious metals through secure, transparent, and scalable blockchain technology.</div>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faqs" className="py-24 px-8 max-w-4xl mx-auto">
        <h2 className="text-4xl font-bold text-center mb-12">Frequently Asked Questions</h2>
        <div className="space-y-6">
          <div className="bg-surface p-6 rounded-2xl border border-primary/20">
            <h3 className="text-xl font-bold mb-2">How does Mint2Metal Ensure Physical Backing?</h3>
            <p className="text-secondary-text font-light leading-relaxed">All our tokens are minted strictly 1:1 against verifiable, audited vault holdings. We employ real-time Proof of Reserve to guarantee full collateralization.</p>
          </div>
          <div className="bg-surface p-6 rounded-2xl border border-primary/20">
            <h3 className="text-xl font-bold mb-2">What is the redemption process?</h3>
            <p className="text-secondary-text font-light leading-relaxed">Institutional clients can redeem their tokens for the underlying physical asset through our redemption portal, subject to standard auditing and KYC/AML procedures.</p>
          </div>
          <div className="bg-surface p-6 rounded-2xl border border-primary/20">
            <h3 className="text-xl font-bold mb-2">Which blockchains are supported?</h3>
            <p className="text-secondary-text font-light leading-relaxed">We currently issue tokens natively on the Stellar network to ensure low transaction costs and enterprise-grade speed and security.</p>
          </div>
        </div>
      </section>

      {/* Footer Footer */}
      <footer className="border-t border-border mt-12 py-10 text-center text-secondary-text">
        <div className="flex justify-center items-center gap-2 mb-4">
          <Image src="/logo.png" alt="Mint2Metal Logo" width={32} height={32} className="object-contain opacity-70" />
          <span className="text-lg font-bold tracking-wide text-primary-text/80">mint2metal</span>
        </div>
        <p>&copy; 2024 Mint2Metal. All rights reserved. Powered by Stellar.</p>
      </footer>
    </div>
  );
}
