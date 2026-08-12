import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type JobRecord = {
  id: string;
  title: string;
  objectId: string;
  status: string;
  priority: string;
  dueDate: string;
  assignedTo: string;
  description: string;
};

type ObjectRecord = {
  id: string;
  name: string;
  address: string;
};

type AppSnapshot = {
  jobs?: JobRecord[];
  objects?: ObjectRecord[];
};

type DailyMailState = {
  lastSentDate?: string;
};

const appStateRowId = "kolaretorp-service-app";
const dailyMailStateRowId = "kolaretorp-daily-job-mail";
const stockholmTimeZone = "Europe/Stockholm";

function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}

function stockholmParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    month: "2-digit",
    timeZone: stockholmTimeZone,
    year: "numeric",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
  };
}

function displayDate(value: string) {
  if (!value) return "ohne Datum";
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("de-DE", { timeZone: stockholmTimeZone });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function jobBucket(job: JobRecord, today: string) {
  if (!job.dueDate) return "Ohne Datum";
  if (job.dueDate < today) return "Überfällig";
  if (job.dueDate === today) return "Heute";
  return "Anstehend";
}

function buildDailyJobMail(snapshot: AppSnapshot, today: string) {
  const jobs = (snapshot.jobs ?? [])
    .filter((job) => !["erledigt", "abgerechnet"].includes(job.status))
    .sort((first, second) => (first.dueDate || "9999-99-99").localeCompare(second.dueDate || "9999-99-99"));
  const objects = snapshot.objects ?? [];
  const grouped = ["Überfällig", "Heute", "Anstehend", "Ohne Datum"].map((label) => ({
    label,
    jobs: jobs.filter((job) => jobBucket(job, today) === label),
  }));
  const listHtml = grouped
    .filter((group) => group.jobs.length > 0)
    .map((group) => `
      <h2 style="font-size:16px;margin:24px 0 10px;color:#1d1d1f;">${group.label}</h2>
      <table role="presentation" style="border-collapse:collapse;width:100%;">
        ${group.jobs.map((job) => {
          const object = objects.find((item) => item.id === job.objectId);
          return `
            <tr>
              <td style="border:1px solid #d2d2d7;border-radius:8px;padding:12px 14px;">
                <strong style="display:block;font-size:15px;color:#1d1d1f;">${escapeHtml(job.title)}</strong>
                <span style="display:block;margin-top:4px;color:#6e6e73;">${escapeHtml(object?.name ?? "Objekt unbekannt")} · ${escapeHtml(object?.address ?? "Adresse offen")}</span>
                <span style="display:block;margin-top:4px;color:#6e6e73;">${displayDate(job.dueDate)} · ${escapeHtml(job.status)} · ${escapeHtml(job.priority)} · ${escapeHtml(job.assignedTo)}</span>
                ${job.description ? `<p style="margin:8px 0 0;color:#1d1d1f;">${escapeHtml(job.description)}</p>` : ""}
              </td>
            </tr>
            <tr><td style="height:8px;"></td></tr>
          `;
        }).join("")}
      </table>
    `)
    .join("");

  const summary = `${jobs.length} offene Aufträge`;
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f7;padding:24px;">
      <main style="max-width:760px;margin:0 auto;background:#fff;border:1px solid #d2d2d7;border-radius:12px;padding:24px;">
        <p style="margin:0 0 6px;color:#6e6e73;font-size:13px;font-weight:700;text-transform:uppercase;">Kolaretorp Service AB</p>
        <h1 style="margin:0;color:#1d1d1f;font-size:28px;line-height:1.15;">Tägliche Auftragsliste</h1>
        <p style="margin:8px 0 20px;color:#6e6e73;">Stand ${displayDate(today)} um 08:00 Uhr · ${summary}</p>
        ${jobs.length > 0 ? listHtml : `<p style="margin:18px 0;color:#1d1d1f;">Heute sind keine offenen Aufträge vorhanden.</p>`}
      </main>
    </div>
  `;
  const text = [
    `Tägliche Auftragsliste - ${displayDate(today)}`,
    summary,
    "",
    ...jobs.map((job) => {
      const object = objects.find((item) => item.id === job.objectId);
      return `${displayDate(job.dueDate)} | ${job.status} | ${job.priority} | ${job.title} | ${object?.name ?? "Objekt unbekannt"} | ${job.assignedTo}`;
    }),
  ].join("\n");

  return { html, openJobCount: jobs.length, text };
}

async function sendResendMail({ html, subject, text }: { html: string; subject: string; text: string }) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.REPORT_SENDER_EMAIL || "info@kolaretorp.se";
  const recipient = process.env.DAILY_JOB_LIST_EMAIL || "info@kolaretorp.se";

  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY fehlt.");
  }

  const senderCandidates = Array.from(new Set([
    fromAddress,
    "onboarding@resend.dev",
  ]));
  let lastError = "";

  for (const sender of senderCandidates) {
    const response = await fetch("https://api.resend.com/emails", {
      body: JSON.stringify({
        from: `Kolaretorp Service AB <${sender}>`,
        html,
        subject,
        text,
        to: [recipient],
      }),
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (response.ok) {
      return { from: sender, to: recipient };
    }

    lastError = `${response.status} ${await response.text()}`;
    if (!lastError.includes("domain is not verified")) break;
  }

  throw new Error(`Resend konnte die Tagesmail nicht senden: ${lastError}`);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (secret && authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";
  const { date: today, hour } = stockholmParts();

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase-Zugangsdaten fehlen." }, { status: 500 });
  }

  const { data: mailState, error: mailStateError } = await supabase
    .from("app_state")
    .select("data")
    .eq("id", dailyMailStateRowId)
    .maybeSingle();
  if (mailStateError) {
    return NextResponse.json({ error: mailStateError.message }, { status: 500 });
  }

  const lastSentDate = (mailState?.data as DailyMailState | undefined)?.lastSentDate;
  if (!force && lastSentDate === today) {
    return NextResponse.json({ skipped: true, reason: "Tagesmail wurde heute bereits gesendet.", today });
  }

  const { data: appState, error: appStateError } = await supabase
    .from("app_state")
    .select("data")
    .eq("id", appStateRowId)
    .maybeSingle();
  if (appStateError) {
    return NextResponse.json({ error: appStateError.message }, { status: 500 });
  }

  const mail = buildDailyJobMail((appState?.data as AppSnapshot | undefined) ?? {}, today);
  const delivery = await sendResendMail({
    html: mail.html,
    subject: `Tägliche Auftragsliste - Kolaretorp Service AB - ${displayDate(today)}`,
    text: mail.text,
  });

  const { error: saveError } = await supabase
    .from("app_state")
    .upsert({
      data: {
        lastOpenJobCount: mail.openJobCount,
        lastSentAt: new Date().toISOString(),
        lastSentDate: today,
      },
      id: dailyMailStateRowId,
      updated_at: new Date().toISOString(),
    });
  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 });
  }

  return NextResponse.json({ sent: true, stockholmHour: hour, today, openJobCount: mail.openJobCount, delivery });
}
