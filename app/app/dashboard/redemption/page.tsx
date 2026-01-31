"use client";

import { useAuth } from "@/lib/auth-context";
import { submitRedemption, getCurrentKYCStatus, getMyRedemptions } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function RedemptionPage() {
  const { isAuthenticated, userType, userId } = useAuth();
  const [kycStatus, setKycStatus] = useState("Loading...");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [quantity, setQuantity] = useState(500);
  const [confirmed, setConfirmed] = useState(false);

  // Redemption state
  const [myRedemptions, setMyRedemptions] = useState<any[]>([]);

  // mock for now (later comes from backend)
  const silverBalance = 120; // grams
  const eligible = silverBalance >= 500 && userType === "INDIA_USER" && kycStatus === "VERIFIED";

  // Fetch user's redemptions
  useEffect(() => {
    if (isAuthenticated && userType === "INDIA_USER") {
      fetchMyRedemptions();
    }
  }, [isAuthenticated, userType]);

  const fetchMyRedemptions = async () => {
    try {
      const redemptions = await getMyRedemptions();
      setMyRedemptions(redemptions);
    } catch (error) {
      console.error("Failed to fetch redemptions:", error);
    }
  };

  // redirect if not logged in
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isAuthenticated, router]);

  // international users should NEVER access redemption
  if (!isAuthenticated) return null;

  if (userType !== "INDIA_USER") {
    return (
      <div className="container">
        <div className="card max-w-xl">
          
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-4xl animate-fadeIn space-y-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2 text-[#f1f5f9]">Physical Silver Redemption</h1>
          <p className="text-[#94a3b8]" style={{ animationDelay: '0.1s' }}>
          Request delivery of your physical silver assets to your verified address
        </p>
        <p className="text-sm text-[#64748b] mt-2">
          Physical redemption is a regulated, offline process.
        </p>
      </div>

      {/* Eligibility message */}
      {!eligible && (
        <div className="card mb-6 animate-slideInUp" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center">
            
            <div>
              <h3 className="text-lg font-semibold text-yellow-400 mb-1">Eligibility Requirements</h3>
              <p className="text-sm">
                To request physical redemption, you need:
                <br />• Minimum 500g silver balance (current: {silverBalance}g)
                <br />• KYC status: VERIFIED (current: {kycStatus})
                <br />• Indian user account
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Redemption Form */}
        <form className={`card card-redemption animate-slideInUp ${!eligible ? 'opacity-50 pointer-events-none' : ''}`} style={{ animationDelay: '0.3s' }}>
        <div className="flex items-center mb-6">
          <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center mr-4">
            
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Redemption Request Form</h2>
            <p className="text-sm opacity-90">Please provide accurate delivery information</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-white">Full Name</label>
            <input
              disabled={!eligible}
              placeholder="Enter your full legal name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-white focus:ring-opacity-50 transition-all"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-white">Phone Number</label>
            <input
              disabled={!eligible}
              placeholder="+91 XXXXX XXXXX"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-white focus:ring-opacity-50 transition-all"
              required
            />
          </div>
        </div>

        <div className="space-y-2 mb-6">
          <label className="block text-sm font-semibold text-white">Delivery Address</label>
          <input
            disabled={!eligible}
            placeholder="Street address, building, apartment"
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
            className="w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-white focus:ring-opacity-50 transition-all"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-white">City</label>
            <input
              disabled={!eligible}
              placeholder="City name"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-white focus:ring-opacity-50 transition-all"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-white">State</label>
            <input
              disabled={!eligible}
              placeholder="State"
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-white focus:ring-opacity-50 transition-all"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-white">Pincode</label>
            <input
              disabled={!eligible}
              placeholder="6-digit pincode"
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              className="w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-white focus:ring-opacity-50 transition-all"
              required
            />
          </div>
        </div>

        <div className="space-y-2 mb-6">
          <label className="block text-sm font-semibold text-white">Redemption Quantity</label>
          <input
            disabled={!eligible}
            type="number"
            min={500}
            max={silverBalance}
            placeholder={`Grams (minimum 100g, maximum ${silverBalance}g)`}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-white focus:ring-opacity-50 transition-all"
            required
          />
          <p className="text-xs text-gray-400">Available balance: {silverBalance}g • Minimum redemption: 500g</p>
        </div>

        <div className="mb-6">
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              disabled={!eligible}
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1 w-4 h-4 text-orange-600 bg-gray-100 border-gray-300 rounded focus:ring-orange-500 focus:ring-2"
            />
            <span className="text-sm leading-relaxed">
              I confirm that this redemption request complies with Indian regulatory requirements and that all provided information is accurate and up-to-date.
            </span>
          </label>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500 bg-opacity-20 border border-red-500 border-opacity-30 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-red-400">{error}</p>
            </div>
          </div>
        )}

        <button
          disabled={!eligible || loading || !confirmed}
          className={`w-full py-3 text-lg font-semibold rounded-lg transition-all duration-200 ${
            eligible && confirmed
              ? "btn-redemption hover:scale-105"
              : "btn-disabled cursor-not-allowed"
          }`}
          onClick={async (e) => {
            e.preventDefault();
            if (!userId) return;

            setLoading(true);
            setError("");

            try {
              const address = `${fullName}, ${phoneNumber}, ${addressLine1}, ${city}, ${state}, ${pincode}`;
              await submitRedemption(quantity, address);

              // Success message
              setFullName("");
              setPhoneNumber("");
              setAddressLine1("");
              setCity("");
              setState("");
              setPincode("");
              setQuantity(500);
              setConfirmed(false);

              // Show success modal or toast
              alert("Redemption request submitted successfully! You will receive a confirmation email shortly.");
            } catch (err) {
              setError("Failed to submit redemption request. Please try again.");
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Submitting Request...
            </div>
          ) : (
            "Submit Redemption Request"
          )}
        </button>
        </form>

        {/* Right Column: Redemption Process */}
        <div className="card animate-slideInUp" style={{ animationDelay: '0.2s' }}>
          <h3 className="text-lg font-semibold mb-4">Redemption Process</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                myRedemptions.length > 0 ? 'bg-green-500' : 'bg-gray-300'
              }`}>
                1
              </div>
              <span className={`ml-2 text-sm ${myRedemptions.length > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                 Request Redemption
              </span>
            </div>
            <div className={`flex-1 h-1 mx-4 ${
              myRedemptions.some(r => r.status === 'APPROVED' || r.status === 'FULFILLED' || r.status === 'DISPATCHED')
                ? 'bg-green-500' : 'bg-gray-300'
            }`}></div>
            <div className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                myRedemptions.some(r => r.status === 'APPROVED' || r.status === 'FULFILLED' || r.status === 'DISPATCHED')
                  ? 'bg-green-500' : 'bg-gray-300'
              }`}>
                2
              </div>
              <span className={`ml-2 text-sm ${
                myRedemptions.some(r => r.status === 'APPROVED' || r.status === 'FULFILLED' || r.status === 'DISPATCHED')
                  ? 'text-green-600' : 'text-gray-500'
              }`}>
                  Admin Verification
              </span>
            </div>
            <div className={`flex-1 h-1 mx-4 ${
              myRedemptions.some(r => r.status === 'FULFILLED' || r.status === 'DISPATCHED')
                ? 'bg-green-500' : 'bg-gray-300'
            }`}></div>
            <div className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                myRedemptions.some(r => r.status === 'FULFILLED' || r.status === 'DISPATCHED')
                  ? 'bg-green-500' : 'bg-gray-300'
              }`}>
                3
              </div>
              <span className={`ml-2 text-sm ${
                myRedemptions.some(r => r.status === 'FULFILLED' || r.status === 'DISPATCHED')
                  ? 'text-green-600' : 'text-gray-500'
              }`}>
                 Vault Allocation
              </span>
            </div>
            <div className={`flex-1 h-1 mx-4 ${
              myRedemptions.some(r => r.status === 'DISPATCHED')
                ? 'bg-green-500' : 'bg-gray-300'
            }`}></div>
            <div className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                myRedemptions.some(r => r.status === 'DISPATCHED')
                  ? 'bg-green-500' : 'bg-gray-300'
              }`}>
                4
              </div>
              <span className={`ml-2 text-sm ${
                myRedemptions.some(r => r.status === 'DISPATCHED')
                  ? 'text-green-600' : 'text-gray-500'
              }`}>
                 Shipment Initiated
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
