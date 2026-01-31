"use client";

import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();

  if (pathname.startsWith('/auth')) return null;

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-content">
          <div className="footer-logo">
            <h2>Mint2Metal</h2>
          </div>
          <div className="footer-links">
            <a href="/privacy" className="footer-link">Privacy Policy</a>
            <span className="footer-separator">|</span>
            <a href="/terms" className="footer-link">Terms of Service</a>
            <span className="footer-separator">|</span>
            <a href="/contact" className="footer-link">Contact Us</a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2023 Mint2Metal. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
