"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSilverBalance, getDSTBalance, submitLoanApplication, getUserLoans, calculateLoanTerms } from "@/lib/api";

import Card from "@/components/Card";
import StatBox from "@/components/StatBox";
import Table from "@/components/Table";
import Badge from "@/components/Badge";

interface LoanApplication {
  id: string;
  amount: number;
  ltv: number;
  interestRate: number;
  term: number;
  status: string;
  appliedDate: string;
}

export default function LoansPage() {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();

  const [silverBalance, setSilverBalance] = useState(0);
  const [dstBalance, setDstBalance] = useState(0);
  const [loanAmount, setLoanAmount] = useState("");
  const [loanTerm, setLoanTerm] = useState("12");
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [loanApplications, setLoanApplications] = useState<LoanApplication[]>([]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
    } else {
      fetchData();
    }
  }, [isAuthenticated, router]);

  const fetchData = async () => {
    try {
      const [silverRes, dstRes, loansRes] = await Promise.all([
        getSilverBalance(),
        getDSTBalance(),
        getUserLoans(),
      ]);
      setSilverBalance(silverRes.balance);
      setDstBalance(dstRes.balance);

      // Transform loan data to match interface
      const transformedLoans = loansRes.loans.map((loan: any) => ({
        id: loan.id,
        amount: loan.amount,
        ltv: (loan.amount / loan.collateralAmount) * 100,
        interestRate: loan.interestRate,
        term: 12, // Default term
        status: loan.status,
        appliedDate: new Date(loan.createdAt).toLocaleDateString()
      }));
      setLoanApplications(transformedLoans);
    } catch (error) {
      console.error("Failed to fetch loan data:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateLoanEligibility = () => {
    const maxLTV = 50; // 50% LTV
    const silverValue = silverBalance * 7500; // Assuming 7500 INR per gram
    const maxLoanAmount = (silverValue * maxLTV) / 100;
    return maxLoanAmount;
  };

  const calculateEMI = (principal: number, rate: number, term: number) => {
    const monthlyRate = rate / (12 * 100);
    const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, term)) /
                (Math.pow(1 + monthlyRate, term) - 1);
    return emi;
  };

  const handleLoanApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    setApplying(true);
    try {
      // Submit loan request to backend
      const result = await fetch('/api/loans/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: requestedAmount,
          collateralAmount: silverBalance,
          term: parseInt(loanTerm),
        }),
      });
      if (!result.ok) throw new Error('Failed to submit loan request');

      alert("Loan request submitted successfully!");
      setLoanAmount("");
      setLoanTerm("12");
      fetchData();
    } catch (error) {
      console.error("Loan request failed:", error);
      alert(`Loan request failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setApplying(false);
    }
  };

  if (!isAuthenticated) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center">
        <div className="animate-pulse text-lg text-[#9CA3AF]">Loading loan information...</div>
      </div>
    );
  }

  const maxLoanAmount = calculateLoanEligibility();
  const requestedAmount = parseFloat(loanAmount) || 0;
  const ltv = requestedAmount > 0 ? (requestedAmount / (silverBalance * 7500)) * 100 : 0;
  const interestRate = 8.5; // Base interest rate
  const termMonths = parseInt(loanTerm);
  const emi = requestedAmount > 0 ? calculateEMI(requestedAmount, interestRate, termMonths) : 0;

  return (
    <div className="min-h-screen bg-[#0B0F14]">
      

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-12">
        {/* Page Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-[#f1f5f9]">Loan Management</h1>
            <p className="text-[#9CA3AF] mt-2">Apply for loans against your silver holdings</p>
          </div>
        </div>

          {/* Loan Eligibility Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatBox
            title="Silver Collateral Balance"
            value={`${silverBalance}g`}
            change={{ value: 2.5, type: 'positive' }}
            icon={<span className="text-2xl">🥈</span>}
          />
          <StatBox
            title="Max LTV"
            value="50%"
            change={{ value: 0, type: 'neutral' }}
          />
          <StatBox
            title="Max Eligible Loan Amount"
            value={`₹${maxLoanAmount.toLocaleString()}`}
            change={{ value: 0, type: 'neutral' }}
          />
          <StatBox
            title="Available Credit"
            value={`₹${Math.max(0, maxLoanAmount - loanApplications.filter(l => l.status === 'ACTIVE').reduce((sum, l) => sum + l.amount, 0)).toLocaleString()}`}
            change={{ value: 0, type: 'neutral' }}
          />
        </div>

        {/* Loan Application Form */}
        <Card title="Apply for Loan" subtitle="Get instant loan against your silver collateral">
          <form onSubmit={handleLoanApplication} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-[#94a3b8] mb-2">
                  Loan Amount (₹)
                </label>
                <input
                  type="number"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(e.target.value)}
                  placeholder="Enter loan amount"
                  min="1000"
                  max={maxLoanAmount}
                  step="1000"
                  className="w-full px-3 py-2 bg-[#121826] border border-[#1F2937] rounded-lg text-[#f1f5f9] placeholder-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#9CA3AF]"
                  required
                />
                <p className="text-xs text-[#64748b] mt-1">
                  Max: ₹{maxLoanAmount.toLocaleString()} (50% LTV)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#94a3b8] mb-2">
                  Loan Term (Months)
                </label>
                <select
                  value={loanTerm}
                  onChange={(e) => setLoanTerm(e.target.value)}
                  className="w-full px-3 py-2 bg-[#121826] border border-[#1F2937] rounded-lg text-[#f1f5f9] focus:outline-none focus:ring-2 focus:ring-[#9CA3AF]"
                >
                  <option value="6">6 months</option>
                  <option value="12">12 months</option>
                  <option value="24">24 months</option>
                  <option value="36">36 months</option>
                </select>
              </div>
            </div>

            {/* Loan Calculator Preview */}
            {requestedAmount > 0 && (
              <div className="bg-[#121826] rounded-lg p-4 space-y-3">
                <h4 className="text-lg font-semibold text-[#f1f5f9]">Loan Preview</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-[#64748b]">Loan-to-Value</div>
                    <div className="text-[#f1f5f9] font-semibold">{ltv.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-[#64748b]">Interest Rate</div>
                    <div className="text-[#f1f5f9] font-semibold">{interestRate}% p.a.</div>
                  </div>
                  <div>
                    <div className="text-[#64748b]">Monthly EMI</div>
                    <div className="text-[#f1f5f9] font-semibold">₹{emi.toFixed(0)}</div>
                  </div>
                  <div>
                    <div className="text-[#64748b]">Total Interest</div>
                    <div className="text-[#f1f5f9] font-semibold">₹{(emi * termMonths - requestedAmount).toFixed(0)}</div>
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={applying || requestedAmount > maxLoanAmount || requestedAmount < 1000}
              className="w-full bg-[#121826] text-[#f1f5f9] px-6 py-3 rounded-lg hover:bg-[#1F2937] transition-colors border border-[#1F2937] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {applying ? "Submitting Application..." : "Request Loan Against Silver"}
            </button>
          </form>
        </Card>

        {/* Loan Applications History */}
        <Card title="Loan Applications" subtitle="Track your loan applications and repayments">
          <Table
            headers={["Application ID", "Amount", "LTV", "Interest Rate", "Term", "Status", "Applied Date"]}
            rows={loanApplications.map(app => [
              app.id,
              `₹${app.amount.toLocaleString()}`,
              `${app.ltv}%`,
              `${app.interestRate}%`,
              `${app.term} months`,
              <Badge key={app.id} variant={app.status === 'Approved' ? 'success' : app.status === 'Pending' ? 'warning' : 'error'}>
                {app.status}
              </Badge>,
              app.appliedDate
            ])}
          />
        </Card>

        {/* Loan Terms & Conditions */}
        <Card title="Loan Terms & Conditions" subtitle="Important information about our loan products">
          <div className="space-y-4 text-sm text-[#94a3b8]">
            <div>
              <h4 className="font-semibold text-[#f1f5f9] mb-2">Eligibility Criteria</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>Minimum collateral: 10g of silver</li>
                <li>Maximum LTV: 60%</li>
                <li>KYC verification required</li>
                <li>Credit score above 650</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-[#f1f5f9] mb-2">Interest Rates</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>Base rate: 8.5% p.a.</li>
                <li>Premium for high LTV: +0.5%</li>
                <li>Discount for long-term: -0.25% for 24+ months</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-[#f1f5f9] mb-2">Repayment Terms</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>Monthly EMI payments</li>
                <li>Prepayment allowed without penalty</li>
                <li>Late payment fee: 2% per month</li>
                <li>Default triggers collateral liquidation</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 p-3 bg-[#121826] rounded-lg">
            <p className="text-sm text-[#94a3b8]">
              Loan contracts exist on Soroban. Execution occurs only after admin approval.
            </p>
          </div>
        </Card>
      </main>
    </div>
  );
}
