import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  seedDefaultAdminIfEmpty,
} from "./authService.js";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await seedDefaultAdminIfEmpty();
        const u = await getCurrentUser();
        if (!alive) return;
        setUser(u);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const api = useMemo(
    () => ({
      user,
      loading,
      async login(username, password) {
        const u = await loginUser({ username, password });
        setUser(u);
        return u;
      },
      async register({ username, name, password }) {
        const id = await registerUser({ username, name, password });
        return id;
      },
      async logout() {
        await logoutUser();
        setUser(null);
      },
      async refresh() {
        const u = await getCurrentUser();
        setUser(u);
        return u;
      },
    }),
    [user, loading]
  );

  return <AuthCtx.Provider value={api}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
