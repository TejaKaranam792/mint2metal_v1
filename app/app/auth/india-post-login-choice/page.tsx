"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useEffect } from "react";

export default function IndiaPostLoginChoice() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    // Redirect if not authenticated or not Indian user
    if (!isAuthenticated) {
      router.push("/auth/login");
    } else if (user?.country !== "India") {
      router.push("/dashboard");
    }
  }, [isAuthenticated, user, router]);

  const handleTradingChoice = () => {
    router.push("/dashboard/trading");
  };

  const handlePhysicalChoice = () => {
    router.push("/dashboard/physical");
  };

  if (!isAuthenticated || user?.country !== "India") {
    return null; // Will redirect
  }

  return (
    <div className="container">
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="max-w-2xl text-center">
          {/* Headline */}
          <h1 className="text-4xl font-semibold mb-4">
            Choose Your Experience
          </h1>

          {/* Subtext */}
          <p className="mb-6">
            What would you like to focus on?
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
            You can access all features from your dashboard later.
          </p>
        </div>
      </div>
    </div>
  );
}
