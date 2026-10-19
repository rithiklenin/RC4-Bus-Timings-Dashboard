"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import styles from "./admin.module.css";

interface AuthStatus {
  connected: boolean;
  connectedAt?: string;
  email?: string;
  expiresAt?: string;
  fullName?: string;
  roleName?: string;
}

export default function AdminPage() {
  const [status, setStatus] = useState<AuthStatus>({ connected: false });
  const [callbackUrl, setCallbackUrl] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const refreshStatus = useCallback(async () => {
    const response = await fetch("/api/dining-auth/status", { cache: "no-store" });
    setStatus(await response.json() as AuthStatus);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/dining-auth/status", { cache: "no-store" })
      .then((response) => response.json() as Promise<AuthStatus>)
      .then((nextStatus) => { if (!cancelled) setStatus(nextStatus); });
    return () => { cancelled = true; };
  }, []);

  async function connectCallback(url: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/dining-auth/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callbackUrl: url }),
      });
      const result = await response.json() as { connected?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to connect NUS Dining");
      setCallbackUrl("");
      setMessage("NUS Dining connected. The token is stored only by the local server.");
      await refreshStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to connect NUS Dining");
    } finally {
      setBusy(false);
    }
  }

  async function completeLogin(event: FormEvent) {
    event.preventDefault();
    await connectCallback(callbackUrl);
  }

  async function disconnect() {
    await fetch("/api/dining-auth/logout", { method: "POST" });
    setMessage("NUS Dining disconnected.");
    await refreshStatus();
  }

  async function verifyConnection() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/dining-auth/test", { cache: "no-store" });
      const result = await response.json() as { connected?: boolean; error?: string };
      if (!response.ok || !result.connected) throw new Error(result.error ?? "Connection test failed");
      setMessage("Verified: an authenticated NUS Dining profile request succeeded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Connection test failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        <div className={styles.eyebrow}>RC4 dashboard prototype</div>
        <h1>Dining integration</h1>
        <p className={styles.intro}>Connect one NUS account so server-side dining requests can include its bearer token. The token is never returned to the dashboard browser.</p>

        <div className={`${styles.status} ${status.connected ? styles.connected : ""}`}>
          <span />
          <div>
            <strong>{status.connected ? "Connected" : "Not connected"}</strong>
            {status.connected && <small>{status.fullName ?? status.email ?? "NUS Dining account"}</small>}
          </div>
        </div>

        {!status.connected ? (
          <>
            <a className={styles.primary} href="/api/dining-auth/start" target="_blank" rel="noreferrer">1. Sign in with NUS</a>
            <div className={styles.explainer}>
              <strong>Prototype limitation</strong>
              <p>NUS sends the login back to its own fixed Dining App callback. After signing in, copy the complete final URL from that window and paste it below. The local server validates the login state before exchanging it.</p>
            </div>
            <form onSubmit={completeLogin}>
              <label htmlFor="callback-url">2. Final NUS callback URL</label>
              <textarea
                id="callback-url"
                value={callbackUrl}
                onChange={(event) => setCallbackUrl(event.target.value)}
                placeholder="https://inetapps.nus.edu.sg/nusds/login/student?code=…"
                rows={4}
                required
                spellCheck={false}
              />
              <button className={styles.secondary} disabled={busy} type="submit">{busy ? "Connecting…" : "3. Connect dining API"}</button>
            </form>
          </>
        ) : (
          <div className={styles.actions}>
            <Link href="/">Open dashboard</Link>
            <button type="button" disabled={busy} onClick={verifyConnection}>{busy ? "Checking…" : "Verify API"}</button>
            <button type="button" onClick={disconnect}>Disconnect</button>
          </div>
        )}
        {message && <div className={styles.message} role="status">{message}</div>}
        <p className={styles.footnote}>Local prototype only. The in-memory token disappears when the Next.js server restarts and is unsuitable for deployment.</p>
      </section>
    </main>
  );
}

