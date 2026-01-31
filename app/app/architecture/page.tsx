"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import Card from "@/components/Card";

export default function ArchitecturePage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-[#0B0F14] text-[#f1f5f9]">
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <h1 className="text-3xl font-bold mb-8">System Architecture</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card title="Frontend Layer" subtitle="C4 L2 - Container">
            <ul className="space-y-2 text-[#94a3b8]">
              <li>• Next.js (React Framework)</li>
              <li>• Role-based UI components</li>
              <li>• WebSocket for real-time updates</li>
              <li>• Responsive design with Tailwind CSS</li>
            </ul>
          </Card>

          <Card title="Backend Layer" subtitle="C4 L2 - Container">
            <ul className="space-y-2 text-[#94a3b8]">
              <li>• Node.js/Express API server</li>
              <li>• KYC & AML verification services</li>
              <li>• Settlement engine</li>
              <li>• Database integration (Prisma ORM)</li>
            </ul>
          </Card>

          <Card title="Blockchain Layer" subtitle="C4 L2 - Container">
            <ul className="space-y-2 text-[#94a3b8]">
              <li>• DST token minting contracts</li>
              <li>• Loan contracts</li>
              <li>• Soroban smart contracts</li>
              <li>• Stellar blockchain integration</li>
            </ul>
          </Card>

          <Card title="External Systems" subtitle="C4 L2 - Container">
            <ul className="space-y-2 text-[#94a3b8]">
              <li>• Manual KYC Review</li>
              <li>• Physical Silver Vault</li>
              <li>• Silver Price Feed</li>
              <li>• Audit & Compliance systems</li>
            </ul>
          </Card>
        </div>

        <Card title="C4 Architecture Context" subtitle="High-level system overview">
          <div className="space-y-4 text-[#94a3b8]">
            <p>
              Mint2Metal operates as a Real-World Asset (RWA) protocol that tokenizes physical silver through Digital Silver Tokens (DST).
              The system ensures 1:1 backing of digital tokens with physical silver held in secure vaults.
            </p>
            <p>
              <strong>C4 L1 (Context):</strong> Users interact with the protocol to mint DST tokens backed by physical silver,
              enabling digital trading while maintaining physical custody.
            </p>
            <p>
              <strong>C4 L2 (Container):</strong> The system comprises frontend UI, backend services, blockchain contracts,
              and external integrations working together to facilitate secure RWA tokenization.
            </p>
          </div>
        </Card>
      </main>
    </div>
  );
}
