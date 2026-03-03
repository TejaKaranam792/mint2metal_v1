"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useState, useEffect, useCallback } from "react";
import { signup, googleLogin as apiGoogleLogin } from "@/lib/api";

declare global {
  interface Window {
    google?: any;
  }
}

export default function Signup() {
  const router = useRouter();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    country: "INDIA",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
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

        if (user.country === "India" || user.country === "INDIA") {
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
        document.getElementById("google-signup-btn"),
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters long");
      setLoading(false);
      return;
    }

    try {
      await signup(formData.email, formData.password, formData.country);
      if (formData.country === "INDIA") {
        router.push("/auth/india-choice");
      } else {
        router.push("/auth/login");
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
          Create Account
        </h1>

        {/* Google Sign-Up Button */}
        <div
          id="google-signup-btn"
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: "24px",
            minHeight: "44px",
          }}
        >
          {googleLoading && (
            <div
              style={{
                textAlign: "center",
                color: "#64748b",
                fontSize: "14px",
              }}
            >
              Signing up with Google...
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

        {/* Signup Form */}
        <form onSubmit={handleSignup}>
          {/* Email */}
          <div style={{ position: "relative", marginBottom: "16px" }}>
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
          <div style={{ position: "relative", marginBottom: "16px" }}>
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
              placeholder="Password (min 8 characters)"
              value={formData.password}
              onChange={handleChange}
              required
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

          {/* Country */}
          <div style={{ position: "relative", marginBottom: "20px" }}>
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
              🌍
            </span>
            <select
              name="country"
              value={formData.country}
              onChange={handleChange}
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
                appearance: "none",
                cursor: "pointer",
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
            >
              <option value="INDIA">🇮🇳 India</option>
              <option value="OTHER">🌐 International</option>
            </select>
            <span
              style={{
                position: "absolute",
                right: "16px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94a3b8",
                fontSize: "14px",
                pointerEvents: "none",
              }}
            >
              ▾
            </span>
          </div>

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
              background:
                "linear-gradient(135deg, #8b5cf6, #6366f1, #3b82f6)",
              color: "#fff",
              fontSize: "16px",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              transition: "all 0.3s ease",
              boxShadow: "0 4px 15px rgba(99,102,241,0.4)",
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
            {loading ? "Creating Account..." : "Sign Up"}
          </button>
        </form>

        {/* Login Link */}
        <p
          style={{
            textAlign: "center",
            marginTop: "28px",
            fontSize: "14px",
            color: "#64748b",
          }}
        >
          Already have an account?{" "}
          <a
            href="/auth/login"
            style={{
              color: "#6366f1",
              textDecoration: "underline",
              fontWeight: 500,
            }}
          >
            Login here
          </a>
        </p>
      </div>
    </div>
  );
}
