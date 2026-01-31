"use client";

import { createContext, useContext, useState, useEffect } from "react";

interface AuthContextType {
  isAuthenticated: boolean;
  userType: "INDIA_USER" | "INTERNATIONAL_USER" | "ADMIN" | null;
  userId: string | null;
  user: any;
  token: string | null;
  kycStatus: any;
  login: (user: any, token?: string) => void;
  logout: () => void;
  refetchKYC: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userType, setUserType] = useState<"INDIA_USER" | "INTERNATIONAL_USER" | "ADMIN" | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [kycStatus, setKycStatus] = useState<any>(null);

  useEffect(() => {
    // Set up global logout for API interceptors
    import('./api').then(({ setGlobalLogout }) => {
      setGlobalLogout(logout);
    });

    const stored = localStorage.getItem("auth");
    if (stored) {
      try {
        const authData = JSON.parse(stored);
        // Check if auth data is recent (within 24 hours)
        const storedTime = authData.timestamp || 0;
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;

        if (now - storedTime < twentyFourHours) {
          setUserType(authData.userType);
          setUserId(authData.userId);
          setUser(authData.user);
          setToken(authData.token);
          setIsAuthenticated(true);
        } else {
          // Clear expired auth data
          localStorage.removeItem("auth");
        }
      } catch (error) {
        // Clear corrupted auth data
        localStorage.removeItem("auth");
      }
    }
  }, []);

  // Refetch KYC status on app load if authenticated
  useEffect(() => {
    if (isAuthenticated && userId) {
      refetchKYC();
    }
  }, [isAuthenticated, userId]);

  const login = (userData: any, token?: string) => {
    const role = userData.role as "INDIA_USER" | "INTERNATIONAL_USER" | "ADMIN";
    setUserType(role);
    setUserId(userData.id);
    setUser(userData);
    setToken(token || null);
    setIsAuthenticated(true);
    localStorage.setItem("auth", JSON.stringify({
      userType: role,
      userId: userData.id,
      user: userData,
      token,
      timestamp: Date.now()
    }));
  };

  const refetchKYC = async () => {
    if (userId) {
      try {
        const { getCurrentKYCStatus } = await import('./api');
        const status = await getCurrentKYCStatus();
        setKycStatus(status);
      } catch (error) {
        console.error('Failed to refetch KYC status:', error);
      }
    }
  };

  const logout = () => {
    // Clear all sensitive state
    setIsAuthenticated(false);
    setUserType(null);
    setUserId(null);
    setUser(null);
    setToken(null);
    setKycStatus(null);
    localStorage.removeItem("auth");
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, userType, userId, user, token, kycStatus, login, logout, refetchKYC }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
