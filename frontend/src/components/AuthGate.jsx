import React, { useEffect, useState } from "react";
import { api, setCsrfToken } from "../lib/api";
import "./Workflow.css";

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  function accept(data) {
    setCsrfToken(data.csrf);
    setSession(data);
    setPassword("");
  }
  function clear() {
    setCsrfToken("");
    setSession(null);
  }
  useEffect(() => {
    let cancelled = false;
    api("/auth/me")
      .then((data) => {
        if (!cancelled) accept(data);
      })
      .catch((e) => {
        if (!cancelled && e.status !== 401) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    window.addEventListener("session-expired", clear);
    return () => {
      cancelled = true;
      window.removeEventListener("session-expired", clear);
    };
  }, []);
  async function login(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      accept(
        await api("/auth/login", {
          method: "POST",
          body: JSON.stringify({ username, password }),
        }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      clear();
    } catch (e) {
      if (e.status === 401) clear();
      else window.alert(e.message);
    }
  }
  if (loading)
    return (
      <div className="auth-screen" role="status">
        Loading your workspace…
      </div>
    );
  if (session)
    return children(session.user, session.userCanPrintApproved, logout);
  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={login}>
        <img src="/weider-logo.png" alt="Weider" />
        <h1>Sign in to Weider ERP</h1>
        <p>Sales quotations and approvals</p>
        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}
        <label>
          Username
          <input
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button className="button primary" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <small>Contact your administrator for an account.</small>
      </form>
    </div>
  );
}
