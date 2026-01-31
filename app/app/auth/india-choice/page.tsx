"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

export default function IndiaChoicePage() {
  const router = useRouter();

  const handleTradingChoice = () => {
    router.push("/dashboard/trading");
  };

  const handlePhysicalChoice = () => {
    router.push("/dashboard/physical");
  };

  return (
    <div className="container">
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="max-w-2xl text-center">
          {/* Headline */}
          <h1 className="text-4xl font-semibold mb-4">
            Choose Your Focus
          </h1>

          {/* Subtext */}
          <p className="mb-6">
            As an Indian user, do you want to focus on trading or physical redemption?
          </p>

          <div className="divider" />

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row justify-center gap-4 mt-6">
            <button
              onClick={handleTradingChoice}
              className="btn-primary"
            >
              Trading
            </button>

            <button
              onClick={handlePhysicalChoice}
              className="btn-secondary"
            >
              Physical Redemption
            </button>
          </div>

          {/* Trust line */}
          <p className="text-sm text-gray-500 mt-6">
            You can access all features later from your dashboard.
          </p>

          {/* Back link */}
          <div className="mt-4">
            <Link href="/" className="text-sm text-blue-500 hover:text-blue-700">
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
