import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-surface to-elevated-surface">
      {/* Navbar */}
      <nav className="bg-surface/80 backdrop-blur-md border-b border-border/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Mint2Metal
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-secondary-text hover:text-primary-text transition-colors">Features</a>
              <a href="#how-it-works" className="text-secondary-text hover:text-primary-text transition-colors">How It Works</a>
              <a href="#security" className="text-secondary-text hover:text-primary-text transition-colors">Security</a>
              <a href="#contact" className="text-secondary-text hover:text-primary-text transition-colors">Contact</a>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/auth/login" className="text-secondary-text hover:text-primary-text transition-colors">Sign In</Link>
              <Link href="/auth/signup" className="bg-gradient-to-r from-primary to-accent text-background px-4 py-2 rounded-xl hover:shadow-lg transition-all duration-200 hover:scale-105 font-semibold">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="mb-8">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary border border-primary/20">
              🚀 Powered by Stellar Blockchain
            </span>
          </div>
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold text-primary-text mb-6 leading-tight">
            Digital Silver,
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"> Real Value</span>
          </h1>
          <p className="text-xl text-secondary-text mb-12 max-w-3xl mx-auto leading-relaxed">
            Mint, trade, and redeem digital silver tokens backed by physical precious metals. Experience the future of commodity investing with blockchain security.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/auth/signup" className="bg-gradient-to-r from-primary to-accent text-background px-8 py-4 rounded-2xl hover:shadow-xl transition-all duration-200 hover:scale-105 font-semibold">
              Start Investing
            </Link>
            <Link href="#how-it-works" className="border border-border text-primary-text px-8 py-4 rounded-2xl hover:bg-surface transition-all duration-200 hover:scale-105 font-semibold">
              Learn More
            </Link>
          </div>
          <div className="mt-12 flex justify-center items-center space-x-8 text-sm text-secondary-text">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-success rounded-full"></span>
              <span>99.9% Uptime</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-primary rounded-full"></span>
              <span>Bank-Grade Security</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-accent rounded-full"></span>
              <span>Physical Backing</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-primary-text mb-4">Why Choose Mint2Metal?</h2>
            <p className="text-lg text-secondary-text max-w-2xl mx-auto">
              Experience the convergence of traditional precious metals and cutting-edge blockchain technology.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-elevated-surface p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-border/50 hover:border-primary/30">
              <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mb-6">
                <span className="text-2xl">🥈</span>
              </div>
              <h3 className="text-xl font-semibold text-primary-text mb-4">Physical Backing</h3>
              <p className="text-secondary-text">Every digital token is backed by physical silver stored in secure vaults, ensuring real-world value.</p>
            </div>
            <div className="bg-elevated-surface p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-border/50 hover:border-primary/30">
              <div className="w-12 h-12 bg-gradient-to-br from-accent/20 to-accent/10 rounded-xl flex items-center justify-center mb-6">
                <span className="text-2xl">🔒</span>
              </div>
              <h3 className="text-xl font-semibold text-primary-text mb-4">Blockchain Security</h3>
              <p className="text-secondary-text">Leverage Stellar blockchain for transparent, immutable transactions with enterprise-grade security.</p>
            </div>
            <div className="bg-elevated-surface p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-border/50 hover:border-primary/30">
              <div className="w-12 h-12 bg-gradient-to-br from-success/20 to-success/10 rounded-xl flex items-center justify-center mb-6">
                <span className="text-2xl">💰</span>
              </div>
              <h3 className="text-xl font-semibold text-primary-text mb-4">Instant Liquidity</h3>
              <p className="text-secondary-text">Trade 24/7 with instant settlement and access to global markets through our advanced platform.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-primary-text mb-4">How It Works</h2>
            <p className="text-lg text-secondary-text max-w-2xl mx-auto">
              Simple steps to start your digital silver journey
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-background">1</div>
              <h3 className="text-lg font-semibold text-primary-text mb-2">Sign Up</h3>
              <p className="text-secondary-text">Complete KYC verification and connect your wallet</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-background">2</div>
              <h3 className="text-lg font-semibold text-primary-text mb-2">Purchase</h3>
              <p className="text-secondary-text">Buy digital silver tokens at current market rates</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-background">3</div>
              <h3 className="text-lg font-semibold text-primary-text mb-2">Trade & Earn</h3>
              <p className="text-secondary-text">Trade on our platform or earn interest through lending</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-background">4</div>
              <h3 className="text-lg font-semibold text-primary-text mb-2">Redeem</h3>
              <p className="text-secondary-text">Convert back to physical silver anytime</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary via-primary/90 to-accent">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-background mb-6">Ready to Invest in Digital Silver?</h2>
          <p className="text-xl text-primary-100 mb-8">Join thousands of investors already securing their future with blockchain-backed precious metals.</p>
          <Link href="/auth/signup" className="bg-background text-primary px-8 py-4 rounded-2xl hover:bg-surface transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl font-semibold">
            Start Your Journey
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-elevated-surface text-secondary-text py-12 border-t border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-4">Mint2Metal</div>
              <p className="text-muted-text">The future of precious metal investing, powered by blockchain.</p>
            </div>
            <div>
              <h4 className="font-semibold text-primary-text mb-4">Platform</h4>
              <ul className="space-y-2">
                <li><a href="/dashboard" className="hover:text-primary-text transition-colors">Dashboard</a></li>
                <li><a href="/dashboard/trading" className="hover:text-primary-text transition-colors">Trading</a></li>
                <li><a href="/dashboard/loans" className="hover:text-primary-text transition-colors">Loans</a></li>
                <li><a href="/dashboard/redemption" className="hover:text-primary-text transition-colors">Redemption</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-primary-text mb-4">Company</h4>
              <ul className="space-y-2">
                <li><a href="/architecture" className="hover:text-primary-text transition-colors">Architecture</a></li>
                <li><a href="/privacy-policy" className="hover:text-primary-text transition-colors">Privacy Policy</a></li>
                <li><a href="#security" className="hover:text-primary-text transition-colors">Security</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-primary-text mb-4">Support</h4>
              <ul className="space-y-2">
                <li><a href="#contact" className="hover:text-primary-text transition-colors">Contact Us</a></li>
                <li><a href="/dashboard/kyc" className="hover:text-primary-text transition-colors">KYC Status</a></li>
                <li><span className="text-muted-text">24/7 Support</span></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border mt-12 pt-8 text-center">
            <p>&copy; 2024 Mint2Metal. All rights reserved. Powered by Stellar.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
