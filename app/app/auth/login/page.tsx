"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useState, useEffect, useCallback } from "react";
import { login as apiLogin, googleLogin as apiGoogleLogin } from "@/lib/api";

declare global {
  interface Window {
    google?: any;
  }
}

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
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleResponse = useCallback(
    async (response: any) => {
      setError("");
      setGoogleLoading(true);
      try {
        const data = await apiGoogleLogin(response.credential);
        const user = data.user;
        const token = data.token;
        login(user, token);

        if (user.role === "ADMIN") {
          router.push("/admin");
        } else if (
          user.country === "India" &&
          (!user.kyc || user.kyc.status !== "VERIFIED")
        ) {
          router.push("/dashboard/kyc");
        } else if (user.country === "India" || user.country === "INDIA") {
          router.push("/auth/india-choice");
        } else {
          router.push("/dashboard");
        }
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Google sign-in failed"
        );
      } finally {
        setGoogleLoading(false);
      }
    },
    [login, router]
  );

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleResponse,
      });
      window.google?.accounts.id.renderButton(
        document.getElementById("google-signin-btn"),
        {
          theme: "outline",
          size: "large",
          width: 380,
          text: "continue_with",
          shape: "pill",
          logo_alignment: "center",
        }
      );
    };
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, [handleGoogleResponse]);

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
        ? {
          email: formData.email,
          password: formData.password,
          twoFactorCode: formData.twoFactorCode,
          userId,
        }
        : { email: formData.email, password: formData.password };

      const response = await apiLogin(
        loginData.email,
        loginData.password,
        loginData.twoFactorCode
      );

      if (response.requiresTwoFactor) {
        setRequiresTwoFactor(true);
        setUserId(response.userId);
        setLoading(false);
        return;
      }

      const user = response.user;
      const token = response.token;
      login(user, token);

      const userType =
        user.role === "ADMIN"
          ? "ADMIN"
          : user.country === "India"
            ? "INDIA"
            : "INTERNATIONAL";

      if (userType === "ADMIN") {
        router.push("/admin");
      } else if (
        user.country === "India" &&
        (!user.kyc || user.kyc.status !== "VERIFIED")
      ) {
        router.push("/dashboard/kyc");
      } else if (user.country === "India") {
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
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #e0e7ff 0%, #f0f4ff 30%, #e8f0fe 50%, #dbeafe 70%, #ede9fe 100%)",
        padding: "1rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          background: "rgba(255, 255, 255, 0.85)",
          backdropFilter: "blur(20px)",
          borderRadius: "24px",
          padding: "48px 40px",
          boxShadow:
            "0 25px 50px -12px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(255,255,255,0.6)",
        }}
      >
        {/* Header */}
        <h1
          style={{
            fontSize: "32px",
            fontWeight: 700,
            textAlign: "center",
            marginBottom: "32px",
            background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Sign In
        </h1>

        {/* Google Sign-In Button */}
        <div
          id="google-signin-btn"
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: "24px",
            minHeight: "44px",
          }}
        >
          {googleLoading && (
            <div style={{ textAlign: "center", color: "#64748b", fontSize: "14px" }}>
              Signing in with Google...
            </div>
          )}
        </div>

        {/* Divider */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              flex: 1,
              height: "1px",
              background:
                "linear-gradient(to right, transparent, #cbd5e1, transparent)",
            }}
          />
          <span
            style={{
              fontSize: "13px",
              color: "#94a3b8",
              fontWeight: 500,
              letterSpacing: "0.5px",
            }}
          >
            or
          </span>
          <div
            style={{
              flex: 1,
              height: "1px",
              background:
                "linear-gradient(to right, transparent, #cbd5e1, transparent)",
            }}
          />
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin}>
          {/* Email */}
          <div
            style={{
              position: "relative",
              marginBottom: "16px",
            }}
          >
            <span
              style={{
                position: "absolute",
                left: "16px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94a3b8",
                fontSize: "18px",
              }}
            >
              👤
            </span>
            <input
              type="email"
              name="email"
              placeholder="Please enter your email"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={requiresTwoFactor}
              style={{
                width: "100%",
                padding: "14px 16px 14px 48px",
                borderRadius: "12px",
                border: "1.5px solid #e2e8f0",
                background: "#f8fafc",
                fontSize: "15px",
                color: "#1e293b",
                outline: "none",
                transition: "border-color 0.2s, box-shadow 0.2s",
                boxSizing: "border-box",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#818cf8";
                e.currentTarget.style.boxShadow =
                  "0 0 0 3px rgba(129,140,248,0.15)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#e2e8f0";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          {/* Password */}
          <div
            style={{
              position: "relative",
              marginBottom: "8px",
            }}
          >
            <span
              style={{
                position: "absolute",
                left: "16px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94a3b8",
                fontSize: "18px",
              }}
            >
              🔒
            </span>
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Please enter your password"
              value={formData.password}
              onChange={handleChange}
              required
              disabled={requiresTwoFactor}
              style={{
                width: "100%",
                padding: "14px 48px 14px 48px",
                borderRadius: "12px",
                border: "1.5px solid #e2e8f0",
                background: "#f8fafc",
                fontSize: "15px",
                color: "#1e293b",
                outline: "none",
                transition: "border-color 0.2s, box-shadow 0.2s",
                boxSizing: "border-box",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#818cf8";
                e.currentTarget.style.boxShadow =
                  "0 0 0 3px rgba(129,140,248,0.15)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#e2e8f0";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: "16px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#94a3b8",
                fontSize: "18px",
                padding: 0,
              }}
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>

          {/* Forgot Password */}
          <div
            style={{
              textAlign: "right",
              marginBottom: "20px",
            }}
          >
            <a
              href="#"
              style={{
                fontSize: "13px",
                color: "#6366f1",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              Forgot password?
            </a>
          </div>

          {/* 2FA Code */}
          {requiresTwoFactor && (
            <div
              style={{
                position: "relative",
                marginBottom: "16px",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: "16px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94a3b8",
                  fontSize: "18px",
                }}
              >
                🔑
              </span>
              <input
                type="text"
                name="twoFactorCode"
                placeholder="Enter 2FA Code"
                value={formData.twoFactorCode}
                onChange={handleChange}
                required
                maxLength={6}
                style={{
                  width: "100%",
                  padding: "14px 16px 14px 48px",
                  borderRadius: "12px",
                  border: "1.5px solid #e2e8f0",
                  background: "#f8fafc",
                  fontSize: "15px",
                  color: "#1e293b",
                  outline: "none",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                  boxSizing: "border-box",
                  letterSpacing: "4px",
                  textAlign: "center",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#818cf8";
                  e.currentTarget.style.boxShadow =
                    "0 0 0 3px rgba(129,140,248,0.15)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#e2e8f0";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "10px",
                padding: "10px 14px",
                marginBottom: "16px",
                fontSize: "13px",
                color: "#dc2626",
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "50px",
              border: "none",
              background: "linear-gradient(135deg, #8b5cf6, #6366f1, #3b82f6)",
              color: "#fff",
              fontSize: "16px",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              transition: "all 0.3s ease",
              boxShadow: "0 4px 15px rgba(99,102,241,0.4)",
              marginBottom: requiresTwoFactor ? "8px" : "0",
            }}
            onMouseEnter={(e) => {
              if (!loading)
                e.currentTarget.style.boxShadow =
                  "0 6px 20px rgba(99,102,241,0.5)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow =
                "0 4px 15px rgba(99,102,241,0.4)";
            }}
          >
            {loading
              ? "Signing In..."
              : requiresTwoFactor
                ? "Verify 2FA"
                : "Sign In"}
          </button>

          {/* Back to Login (for 2FA) */}
          {requiresTwoFactor && (
            <button
              type="button"
              onClick={() => {
                setRequiresTwoFactor(false);
                setUserId("");
                setFormData({ ...formData, twoFactorCode: "" });
              }}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "50px",
                border: "1.5px solid #e2e8f0",
                background: "transparent",
                color: "#64748b",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              Back to Login
            </button>
          )}
        </form>

        {/* Sign Up Link */}
        <p
          style={{
            textAlign: "center",
            marginTop: "28px",
            fontSize: "14px",
            color: "#64748b",
          }}
        >
          Don&apos;t have an account yet?{" "}
          <a
            href="/auth/signup"
            style={{
              color: "#6366f1",
              textDecoration: "underline",
              fontWeight: 500,
            }}
          >
            Sign up with email
          </a>
        </p>
      </div>
    </div>
  );
}
