"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

export default function IndiaFeaturesPage() {
  const router = useRouter();

  const features = [
    {
      title: "Physical Redemption",
      description: "Convert your digital silver into physical bars delivered to your address (minimum 100g required)",
      icon: "📦",
      action: () => router.push("/dashboard/redemption"),
      primary: true
    },
    {
      title: "Silver Trading",
      description: "Buy and sell silver with market orders and real-time pricing",
      icon: "📈",
      action: () => router.push("/dashboard/trading"),
      primary: false
    },
    {
      title: "Mint Digital Silver",
      description: "Tokenize your physical silver holdings into DST tokens",
      icon: "🪙",
      action: () => router.push("/dashboard/mint"),
      primary: false
    },
    {
      title: "Loan Against Silver",
      description: "Get instant loans using your silver holdings as collateral",
      icon: "💰",
      action: () => router.push("/dashboard/loans"),
      primary: false
    },
    {
      title: "Portfolio Balance",
      description: "View your complete silver holdings and transaction history",
      icon: "📊",
      action: () => router.push("/dashboard/balance"),
      primary: false
    },
    {
      title: "KYC & Verification",
      description: "Complete your identity verification for full platform access",
      icon: "✅",
      action: () => router.push("/dashboard/kyc"),
      primary: false
    }
  ];

  return (
    <div className="container">
      <div className="max-w-6xl mx-auto py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-semibold mb-4">
            Choose Your Preferred Feature
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            As an Indian user, you have access to all these powerful features. Select what interests you most:
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`card p-6 cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg ${
                feature.primary ? 'border-2 border-orange-300 bg-orange-50' : ''
              }`}
              onClick={feature.action}
            >
              <div className="text-center">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-gray-600 mb-4">{feature.description}</p>
                <button
                  className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                    feature.primary
                      ? 'bg-orange-600 hover:bg-orange-700 text-white'
                      : 'bg-[#121826] hover:bg-[#1F2937] text-white'
                  }`}
                >
                  Explore {feature.title}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Alternative Actions */}
        <div className="text-center">
          <div className="divider my-8" />
          <p className="text-gray-600 mb-4">Or explore everything at once:</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="btn-secondary"
          >
            Go to Main Dashboard
          </button>
        </div>

        {/* Back link */}
        <div className="text-center mt-8">
          <Link href="/auth/india-choice" className="text-sm text-blue-500 hover:text-blue-700">
            ← Back to Previous Choice
          </Link>
        </div>
      </div>
    </div>
  );
}
