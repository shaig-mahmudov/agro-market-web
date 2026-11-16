"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { authApi, getStoredTokens, setStoredTokens, tryRefreshTokens } from "./api";
import type { AuthResponse, UserSummary } from "./types";

interface AuthContextValue {
  user: UserSummary | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  applyAuthResponse: (auth: AuthResponse) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = useCallback(async (): Promise<UserSummary | null> => {
    const { accessToken, refreshToken } = getStoredTokens();
    if (!accessToken && !refreshToken) {
      return null;
    }
    try {
      return await authApi.me();
    } catch {
      return null;
    }
  }, []);

  const refreshUser = useCallback(async () => {
    await tryRefreshTokens();
    const me = await fetchCurrentUser();
    setUser(me);
    setLoading(false);
  }, [fetchCurrentUser]);

  useEffect(() => {
    let active = true;
    void fetchCurrentUser().then((me) => {
      if (!active) return;
      setUser(me);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [fetchCurrentUser]);

  const applyAuthResponse = useCallback((auth: AuthResponse) => {
    setStoredTokens(auth.accessToken, auth.refreshToken);
    setUser(auth.user);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, applyAuthResponse, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
