"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DEFAULT_CSC_CONTENT, type CscContentItem, type CscContentResponse } from "@/lib/csc-content";
import styles from "../admin.module.css";

interface DiningAuthStatus {
  connected: boolean;
  email?: string;
  fullName?: string;
}

type ConsoleSection = "highlights" | "dining";

const FIELD_LIMITS = { eyebrow: 32, title: 64, description: 180, note: 80 } as const;

export default function AdminConsole() {
  const [section, setSection] = useState<ConsoleSection>("highlights");
  const [items, setItems] = useState<CscContentItem[]>(DEFAULT_CSC_CONTENT.map((item) => ({ ...item })));
  const [activeIndex, setActiveIndex] = useState(0);
  const [contentMessage, setContentMessage] = useState("");
  const [contentBusy, setContentBusy] = useState(false);
  const [diningStatus, setDiningStatus] = useState<DiningAuthStatus>({ connected: false });
  const [callbackUrl, setCallbackUrl] = useState("");
  const [diningMessage, setDiningMessage] = useState("");
  const [diningBusy, setDiningBusy] = useState(false);

  const refreshDiningStatus = useCallback(async () => {
    const response = await fetch("/api/dining-auth/status", { cache: "no-store" });
    setDiningStatus(await response.json() as DiningAuthStatus);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch("/api/csc-content", { cache: "no-store" }).then((response) => response.json() as Promise<CscContentResponse>),
      fetch("/api/dining-auth/status", { cache: "no-store" }).then((response) => response.json() as Promise<DiningAuthStatus>),
    ]).then(([content, dining]) => {
      if (!cancelled) {
        setItems(content.items);
        setDiningStatus(dining);
      }
    });
    return () => { cancelled = true; };
  }, []);

  function updateItem(field: keyof Pick<CscContentItem, "eyebrow" | "title" | "description" | "note">, value: string) {
    setItems((current) => current.map((item, index) => index === activeIndex ? { ...item, [field]: value } : item));
    setContentMessage("");
  }

  async function saveHighlights(event: FormEvent) {
    event.preventDefault();
    setContentBusy(true);
    setContentMessage("");
    try {
      const response = await fetch("/api/csc-content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const result = await response.json() as CscContentResponse & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to save highlights");
      setItems(result.items);
      setContentMessage("Saved. The dashboard will pick up these changes automatically.");
    } catch (error) {
      setContentMessage(error instanceof Error ? error.message : "Unable to save highlights");
    } finally {
      setContentBusy(false);
    }
  }

  async function completeDiningLogin(event: FormEvent) {
    event.preventDefault();
    setDiningBusy(true);
    setDiningMessage("");
    try {
      const response = await fetch("/api/dining-auth/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callbackUrl }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to connect NUS Dining");
      setCallbackUrl("");
      setDiningMessage("NUS Dining connected successfully.");
      await refreshDiningStatus();
    } catch (error) {
      setDiningMessage(error instanceof Error ? error.message : "Unable to connect NUS Dining");
    } finally {
      setDiningBusy(false);
    }
  }

  async function disconnectDining() {
    await fetch("/api/dining-auth/logout", { method: "POST" });
    setDiningMessage("NUS Dining disconnected.");
    await refreshDiningStatus();
  }

  async function verifyDining() {
    setDiningBusy(true);
    setDiningMessage("");
    try {
      const response = await fetch("/api/dining-auth/test", { cache: "no-store" });
      const result = await response.json() as { connected?: boolean; error?: string };
      if (!response.ok || !result.connected) throw new Error(result.error ?? "Connection test failed");
      setDiningMessage("Verified. The authenticated NUS Dining request succeeded.");
    } catch (error) {
      setDiningMessage(error instanceof Error ? error.message : "Connection test failed");
    } finally {
      setDiningBusy(false);
    }
  }

  const activeItem = items[activeIndex];

  return (
    <main className={styles.consoleShell}>
      <header className={styles.consoleHeader}>
        <div className={styles.consoleBrand}><span>RC4</span><div><strong>Dashboard admin</strong><small>Mock NUS session</small></div></div>
        <div className={styles.headerActions}>
          <Link href="/">View dashboard</Link>
          <form action="/api/admin-auth/logout" method="post"><button type="submit">Sign out</button></form>
        </div>
      </header>

      <div className={styles.consoleLayout}>
        <aside className={styles.consoleNav} aria-label="Admin sections">
          <div><span>Manage</span>
            <button className={section === "highlights" ? styles.navActive : ""} onClick={() => setSection("highlights")} type="button"><i>✦</i><span>RC4 highlights<small>Edit rotating CSC content</small></span></button>
            <button className={section === "dining" ? styles.navActive : ""} onClick={() => setSection("dining")} type="button"><i>⌁</i><span>Dining connection<small>Connect the live menu API</small></span></button>
          </div>
          <p>Prototype changes are stored in the running server and reset when it restarts.</p>
        </aside>

        <section className={styles.consoleMain}>
          {section === "highlights" ? (
            <>
              <div className={styles.sectionHeading}><div><span>Content manager</span><h1>RC4 highlights</h1><p>Edit the three cards that rotate on the public dashboard.</p></div><button className={styles.saveTop} disabled={contentBusy} form="highlight-form" type="submit">{contentBusy ? "Saving…" : "Save changes"}</button></div>
              <div className={styles.editorTabs} role="tablist" aria-label="Highlight cards">
                {items.map((item, index) => <button role="tab" aria-selected={index === activeIndex} className={index === activeIndex ? styles.editorTabActive : ""} onClick={() => setActiveIndex(index)} type="button" key={item.id}><span>{index + 1}</span><div>{item.title}<small>{item.eyebrow}</small></div></button>)}
              </div>
              <div className={styles.editorGrid}>
                <form id="highlight-form" className={styles.editorForm} onSubmit={saveHighlights}>
                  <Field label="Small label" value={activeItem.eyebrow} limit={FIELD_LIMITS.eyebrow} onChange={(value) => updateItem("eyebrow", value)} />
                  <Field label="Headline" value={activeItem.title} limit={FIELD_LIMITS.title} onChange={(value) => updateItem("title", value)} />
                  <Field label="Description" value={activeItem.description} limit={FIELD_LIMITS.description} multiline onChange={(value) => updateItem("description", value)} />
                  <Field label="Footer note" value={activeItem.note} limit={FIELD_LIMITS.note} onChange={(value) => updateItem("note", value)} />
                  <div className={styles.formFooter}><button disabled={contentBusy} type="submit">{contentBusy ? "Saving…" : "Save all highlights"}</button>{contentMessage && <span role="status">{contentMessage}</span>}</div>
                </form>
                <aside className={styles.previewWrap}><span>Live preview</span><div className={styles.highlightPreview}><small>{activeItem.eyebrow}</small><h2>{activeItem.title}</h2><p>{activeItem.description}</p><strong>{activeItem.note}</strong><div><i /><i /><i /></div></div><p>Text updates in real time. Saving publishes all three cards to this running dashboard.</p></aside>
              </div>
            </>
          ) : (
            <>
              <div className={styles.sectionHeading}><div><span>Integration</span><h1>Dining hall API</h1><p>Connect one NUS account so the dashboard can retrieve the live RC4 menu.</p></div></div>
              <section className={styles.diningCard}>
                <div className={`${styles.connectionStatus} ${diningStatus.connected ? styles.connectionLive : ""}`}><i /><div><strong>{diningStatus.connected ? "Connected" : "Not connected"}</strong><span>{diningStatus.connected ? diningStatus.fullName ?? diningStatus.email ?? "NUS Dining account" : "Live menu requests are currently disabled"}</span></div></div>
                {!diningStatus.connected ? <div className={styles.diningSteps}>
                  <div className={styles.step}><b>1</b><div><strong>Open NUS sign-in</strong><p>Use the official NUS page in a new tab.</p><a href="/api/dining-auth/start" target="_blank" rel="noreferrer">Sign in with NUS ↗</a></div></div>
                  <div className={styles.step}><b>2</b><form onSubmit={completeDiningLogin}><label htmlFor="callback-url">Paste the final callback URL</label><p>After NUS finishes, copy the complete URL from the address bar.</p><textarea id="callback-url" value={callbackUrl} onChange={(event) => setCallbackUrl(event.target.value)} placeholder="https://inetapps.nus.edu.sg/nusds/login/student?code=…" rows={4} required spellCheck={false} /><button disabled={diningBusy} type="submit">{diningBusy ? "Connecting…" : "Connect dining menu"}</button></form></div>
                </div> : <div className={styles.connectedActions}><Link href="/">View live menu</Link><button disabled={diningBusy} onClick={verifyDining} type="button">{diningBusy ? "Checking…" : "Verify connection"}</button><button onClick={disconnectDining} type="button">Disconnect</button></div>}
                {diningMessage && <div className={styles.consoleMessage} role="status">{diningMessage}</div>}
              </section>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function Field({ label, value, limit, multiline = false, onChange }: { label: string; value: string; limit: number; multiline?: boolean; onChange: (value: string) => void }) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return <label className={styles.field} htmlFor={id}><span>{label}<small>{value.length}/{limit}</small></span>{multiline ? <textarea id={id} value={value} maxLength={limit} rows={4} onChange={(event) => onChange(event.target.value)} /> : <input id={id} value={value} maxLength={limit} onChange={(event) => onChange(event.target.value)} />}</label>;
}
