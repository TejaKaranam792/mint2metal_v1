import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { WalletProvider } from "@/context/WalletContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen">
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
