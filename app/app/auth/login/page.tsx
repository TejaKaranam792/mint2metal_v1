"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { login as apiLogin } from "@/lib/api";

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    twoFactorCode: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [userId, setUserId] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const loginData = requiresTwoFactor
        ? { email: formData.email, password: formData.password, twoFactorCode: formData.twoFactorCode, userId }
        : { email: formData.email, password: formData.password };

      const response = await apiLogin(loginData.email, loginData.password, loginData.twoFactorCode);

      if (response.requiresTwoFactor) {
        setRequiresTwoFactor(true);
        setUserId(response.userId);
        setLoading(false);
        return;
      }

      const user = response.user;
      const token = response.token;
      // Login with real user data and token
      login(user, token);

      // Determine redirect based on user type
      const userType = user.role === "ADMIN" ? "ADMIN" : (user.country === "India" ? "INDIA" : "INTERNATIONAL");

      if (userType === "ADMIN") {
        router.push("/admin");
      } else if (user.country === "India" && (!user.kyc || user.kyc.status !== "VERIFIED")) {
        router.push("/dashboard/kyc");
      } else if (user.country === "India") {
        // New flow: Ask Indian users to choose between trading and physical features
        router.push("/auth/india-choice");
      } else {
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="card max-w-md mx-auto mt-20">
        <h2 className="text-xl font-semibold mb-4 text-center">Login</h2>

        <form onSubmit={handleLogin}>
          <input
            className="mb-3"
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            required
            disabled={requiresTwoFactor}
          />
          <input
            className="mb-4"
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
            disabled={requiresTwoFactor}
          />

          {requiresTwoFactor && (
            <input
              className="mb-4"
              type="text"
              name="twoFactorCode"
              placeholder="2FA Code"
              value={formData.twoFactorCode}
              onChange={handleChange}
              required
              maxLength={6}
            />
          )}

          {error && <p className="text-red-500 mb-3">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? "Logging In..." : (requiresTwoFactor ? "Verify 2FA" : "Login")}
          </button>

          {requiresTwoFactor && (
            <button
              type="button"
              onClick={() => {
                setRequiresTwoFactor(false);
                setUserId("");
                setFormData({ ...formData, twoFactorCode: "" });
              }}
              className="btn-secondary w-full mt-2"
            >
              Back to Login
            </button>
          )}
        </form>

        <p className="text-center mt-4">
          Don't have an account yet?{" "}
          <a href="/auth/signup" className="text-blue-500 hover:underline">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}
