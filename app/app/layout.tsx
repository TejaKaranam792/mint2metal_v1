import "./globals.css";
import { Inter } from 'next/font/google';
import { AuthProvider } from "@/lib/auth-context";
import { WalletProvider } from "@/context/WalletContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased flex flex-col min-h-screen`}>
        <WalletProvider>
          <AuthProvider>
            <Navbar />
            <main className="flex-grow">{children}</main>
            <Footer />
          </AuthProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
