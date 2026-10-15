"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Send } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { apiFetch } from "@/lib/apiClient";
import { feedbackPath } from "@/lib/administration";

function FeedbackForm() {
  const [category, setCategory] = useState("problem");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  return <main className="administration-shell"><Link className="ghost-button" href="/"><ArrowLeft size={16} />Zurück</Link><h1>Feedback senden</h1>
    <form onSubmit={async event => {
      event.preventDefault(); setBusy(true); setStatus("");
      try {
        const source = new URLSearchParams(window.location.search).get("from");
        const pagePath = source ? feedbackPath(`/app/${source}`) : "/feedback";
        const response = await apiFetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, message, pagePath }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Feedback konnte nicht gesendet werden.");
        setMessage(""); setStatus("Vielen Dank. Dein Feedback wurde gespeichert.");
      } catch (error) { setStatus((error as Error).message); } finally { setBusy(false); }
    }}>
      <label>Kategorie<select value={category} onChange={e => setCategory(e.target.value)}><option value="problem">Problem melden</option><option value="improvement">Verbesserung vorschlagen</option><option value="feature">Funktion wünschen</option></select></label>
      <label>Nachricht<textarea rows={7} maxLength={5000} required value={message} onChange={e => setMessage(e.target.value)} /></label>
      <button className="primary-button" disabled={busy || !message.trim()} type="submit"><Send size={16} />Feedback senden</button>
      {status && <p role="status">{status}</p>}
    </form></main>;
}
export default function FeedbackPage() { return <AuthGate><FeedbackForm /></AuthGate>; }
