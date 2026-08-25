import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type JobRecord = {
  id: string;
  seriesMasterId?: string;
  seriesOccurrenceDate?: string;
  title: string;
  objectId: string;
  status: string;
  priority: string;
  dueDate: string;
  assignedTo: string;
  description: string;
  schedule?: {
    type: "einmalig" | "serie";
    frequency: string;
    interval: number;
    weekdays: string[];
    end: string;
    endDate: string;
    occurrences: number;
  };
};

type ObjectRecord = {
  id: string;
  name: string;
  address: string;
};

type AppSnapshot = {
  dailyMailSettings?: DailyMailSettings;
  jobs?: JobRecord[];
  objects?: ObjectRecord[];
};

type DailyMailSettings = {
  birthdaySources?: string;
  calendarSources?: string;
};

type CalendarEvent = {
  calendar: string;
  date: string;
  endDate: string;
  location: string;
  title: string;
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

function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeJobDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const germanDate = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!germanDate) return value;
  return `${germanDate[3]}-${germanDate[2]}-${germanDate[1]}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isSeriesMaster(job: JobRecord) {
  return job.schedule?.type === "serie" && !job.seriesMasterId;
}

function parseJobTime(job: JobRecord) {
  const normalizedDate = normalizeJobDate(job.dueDate);
  const parsed = new Date(`${normalizedDate}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? Number.MAX_SAFE_INTEGER : parsed.getTime();
}

function sortedByDueDate(jobs: JobRecord[]) {
  return [...jobs].sort((first, second) => parseJobTime(first) - parseJobTime(second));
}

function jobSortGroup(job: JobRecord, occurrences: JobRecord[]) {
  const statuses = occurrences.length > 0 ? occurrences.map((item) => item.status) : [job.status];
  if (statuses.some((status) => status === "in Arbeit")) return 0;
  if (statuses.some((status) => status === "geplant" || status === "pausiert")) return 1;
  if (statuses.some((status) => status === "erledigt")) return 2;
  if (statuses.some((status) => status === "abgerechnet")) return 3;
  return 4;
}

function activeOverviewJobs(jobs: JobRecord[]) {
  const occurrenceGroups = jobs.reduce<Record<string, JobRecord[]>>((groups, job) => {
    if (!job.seriesMasterId) return groups;
    return {
      ...groups,
      [job.seriesMasterId]: [...(groups[job.seriesMasterId] ?? []), job],
    };
  }, {});

  return jobs
    .filter((job) => !job.seriesMasterId)
    .filter((job) => jobSortGroup(job, occurrenceGroups[job.id] ?? []) < 2)
    .sort((first, second) => {
      const firstOccurrences = occurrenceGroups[first.id] ?? [];
      const secondOccurrences = occurrenceGroups[second.id] ?? [];
      const groupDiff = jobSortGroup(first, firstOccurrences) - jobSortGroup(second, secondOccurrences);
      const firstDate = parseJobTime(sortedByDueDate(firstOccurrences).find((job) => !["erledigt", "abgerechnet", "storniert"].includes(job.status)) ?? first);
      const secondDate = parseJobTime(sortedByDueDate(secondOccurrences).find((job) => !["erledigt", "abgerechnet", "storniert"].includes(job.status)) ?? second);
      return groupDiff || firstDate - secondDate;
    });
}

function jobBucket(job: JobRecord, today: string, occurrences: JobRecord[]) {
  const nextOccurrence = sortedByDueDate(occurrences).find((item) => !["erledigt", "abgerechnet", "storniert"].includes(item.status));
  const dueDate = normalizeJobDate(nextOccurrence?.dueDate ?? job.dueDate);
  if (!dueDate) return "Ohne Datum";
  if (dueDate < today) return "Überfällig";
  if (dueDate === today) return "Heute";
  return "Anstehend";
}

function unfoldIcsLines(ics: string) {
  return ics
    .replace(/\r\n/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n");
}

function cleanIcsValue(value: string) {
  return value
    .replaceAll("\\n", " ")
    .replaceAll("\\,", ",")
    .replaceAll("\\;", ";")
    .trim();
}

function parseIcsDate(value: string) {
  const dateValue = value.includes(":") ? value.split(":").pop() ?? "" : value;
  const normalized = dateValue.trim();

  if (/^\d{8}$/.test(normalized)) {
    return `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}`;
  }

  const dateTime = normalized.match(/^(\d{4})(\d{2})(\d{2})T/);
  if (dateTime) {
    return `${dateTime[1]}-${dateTime[2]}-${dateTime[3]}`;
  }

  return "";
}

function parseIcsEvents(ics: string, calendar: string, fromDate: string, toDate: string): CalendarEvent[] {
  const lines = unfoldIcsLines(ics);
  const events: CalendarEvent[] = [];
  let current: Record<string, string> | null = null;

  lines.forEach((line) => {
    if (line === "BEGIN:VEVENT") {
      current = {};
      return;
    }
    if (line === "END:VEVENT") {
      if (current) {
        const date = parseIcsDate(current.DTSTART ?? "");
        const endDate = parseIcsDate(current.DTEND ?? "");
        if (date >= fromDate && date <= toDate) {
          events.push({
            calendar,
            date,
            endDate,
            location: cleanIcsValue(current.LOCATION ?? ""),
            title: cleanIcsValue(current.SUMMARY ?? "Termin ohne Titel"),
          });
        }
      }
      current = null;
      return;
    }
    if (!current || !line.includes(":")) return;
    const [rawKey, ...valueParts] = line.split(":");
    const key = rawKey.split(";")[0];
    current[key] = valueParts.join(":");
  });

  return events.sort((first, second) => first.date.localeCompare(second.date) || first.title.localeCompare(second.title, "de"));
}

function configuredCalendarSources(value: string | undefined) {
  return (value ?? "")
    .split(/\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.indexOf("|");
      if (separator === -1) return { name: "Kalender", url: normalizeCalendarUrl(entry) };
      return {
        name: entry.slice(0, separator).trim() || "Kalender",
        url: normalizeCalendarUrl(entry.slice(separator + 1).trim()),
      };
    })
    .filter((entry) => entry.url.startsWith("http"));
}

function normalizeCalendarUrl(value: string) {
  const cleaned = value.trim().replace(/\.$/, "");
  return cleaned.startsWith("webcal://") ? `https://${cleaned.slice("webcal://".length)}` : cleaned;
}

function mergeCalendarSourceText(primary = "", fallback = "") {
  return [primary, fallback].filter(Boolean).join("\n");
}

async function loadCalendarEvents(today: string, settings?: DailyMailSettings) {
  const toDate = addDays(today, 3);
  const sources = configuredCalendarSources(mergeCalendarSourceText(settings?.calendarSources, process.env.DAILY_CALENDAR_ICS_URLS));
  const birthdaySources = configuredCalendarSources(mergeCalendarSourceText(settings?.birthdaySources, process.env.DAILY_BIRTHDAY_ICS_URLS || process.env.FACEBOOK_BIRTHDAY_ICS_URL));
  const load = async (source: { name: string; url: string }) => {
    const response = await fetch(source.url, { cache: "no-store" });
    if (!response.ok) throw new Error(`${source.name}: ${response.status}`);
    return parseIcsEvents(await response.text(), source.name, today, toDate);
  };

  const [calendarResults, birthdayResults] = await Promise.all([
    Promise.allSettled(sources.map(load)),
    Promise.allSettled(birthdaySources.map(load)),
  ]);

  return {
    birthdayErrors: birthdayResults.filter((result) => result.status === "rejected").map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason)),
    birthdays: birthdayResults.flatMap((result) => result.status === "fulfilled" ? result.value : []),
    calendarErrors: calendarResults.filter((result) => result.status === "rejected").map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason)),
    calendarSources: sources.length,
    calendars: calendarResults.flatMap((result) => result.status === "fulfilled" ? result.value : []),
  };
}

async function buildDailyJobMail(snapshot: AppSnapshot, today: string) {
  const allJobs = snapshot.jobs ?? [];
  const jobs = activeOverviewJobs(allJobs);
  const objects = snapshot.objects ?? [];
  const occurrenceGroups = allJobs.reduce<Record<string, JobRecord[]>>((groups, job) => {
    if (!job.seriesMasterId) return groups;
    return {
      ...groups,
      [job.seriesMasterId]: [...(groups[job.seriesMasterId] ?? []), job],
    };
  }, {});
  const grouped = ["Überfällig", "Heute", "Anstehend", "Ohne Datum"].map((label) => ({
    label,
    jobs: jobs.filter((job) => jobBucket(job, today, occurrenceGroups[job.id] ?? []) === label),
  }));
  const calendarData = await loadCalendarEvents(today, snapshot.dailyMailSettings);
  const calendarHtml = `
    <h2 style="font-size:16px;margin:28px 0 10px;color:#1d1d1f;">Kalender heute plus 3 Tage</h2>
    ${calendarData.calendars.length > 0 ? `
      <table role="presentation" style="border-collapse:collapse;width:100%;">
        ${calendarData.calendars.map((event) => `
          <tr>
            <td style="border:1px solid #d2d2d7;border-radius:8px;padding:12px 14px;">
              <strong style="display:block;font-size:15px;color:#1d1d1f;">${escapeHtml(event.title)}</strong>
              <span style="display:block;margin-top:4px;color:#6e6e73;">${displayDate(event.date)} · ${escapeHtml(event.calendar)}${event.location ? ` · ${escapeHtml(event.location)}` : ""}</span>
            </td>
          </tr>
          <tr><td style="height:8px;"></td></tr>
        `).join("")}
      </table>
    ` : `<p style="margin:18px 0;color:#1d1d1f;">Keine Kalendertermine gefunden${calendarData.calendarSources === 0 ? " - es sind noch keine Kalenderquellen konfiguriert." : "."}</p>`}
  `;
  const birthdayHtml = `
    <h2 style="font-size:16px;margin:28px 0 10px;color:#1d1d1f;">Geburtstage</h2>
    ${calendarData.birthdays.length > 0 ? `
      <table role="presentation" style="border-collapse:collapse;width:100%;">
        ${calendarData.birthdays.map((event) => `
          <tr>
            <td style="border:1px solid #d2d2d7;border-radius:8px;padding:12px 14px;">
              <strong style="display:block;font-size:15px;color:#1d1d1f;">${escapeHtml(event.title)}</strong>
              <span style="display:block;margin-top:4px;color:#6e6e73;">${displayDate(event.date)} · ${escapeHtml(event.calendar)}</span>
            </td>
          </tr>
          <tr><td style="height:8px;"></td></tr>
        `).join("")}
      </table>
    ` : `<p style="margin:18px 0;color:#1d1d1f;">Keine Geburtstagsquelle verbunden oder keine Geburtstage im Zeitraum.</p>`}
  `;
  const listHtml = grouped
    .filter((group) => group.jobs.length > 0)
    .map((group) => `
      <h2 style="font-size:16px;margin:24px 0 10px;color:#1d1d1f;">${group.label}</h2>
      <table role="presentation" style="border-collapse:collapse;width:100%;">
        ${group.jobs.map((job) => {
          const object = objects.find((item) => item.id === job.objectId);
          const occurrences = occurrenceGroups[job.id] ?? [];
          const nextOccurrence = sortedByDueDate(occurrences).find((item) => !["erledigt", "abgerechnet", "storniert"].includes(item.status));
          const visibleDate = nextOccurrence?.dueDate ?? job.dueDate;
          const seriesInfo = isSeriesMaster(job) ? ` · Serienauftrag${nextOccurrence ? ` · nächster Termin ${displayDate(nextOccurrence.dueDate)}` : ""}` : "";
          return `
            <tr>
              <td style="border:1px solid #d2d2d7;border-radius:8px;padding:12px 14px;">
                <strong style="display:block;font-size:15px;color:#1d1d1f;">${escapeHtml(job.title)}</strong>
                <span style="display:block;margin-top:4px;color:#6e6e73;">${escapeHtml(object?.name ?? "Objekt unbekannt")} · ${escapeHtml(object?.address ?? "Adresse offen")}</span>
                <span style="display:block;margin-top:4px;color:#6e6e73;">${displayDate(visibleDate)} · ${escapeHtml(job.status)} · ${escapeHtml(job.priority)} · ${escapeHtml(job.assignedTo)}${escapeHtml(seriesInfo)}</span>
                ${job.description ? `<p style="margin:8px 0 0;color:#1d1d1f;">${escapeHtml(job.description)}</p>` : ""}
              </td>
            </tr>
            <tr><td style="height:8px;"></td></tr>
          `;
        }).join("")}
      </table>
    `)
    .join("");

  const summary = `${jobs.length} aktive Aufträge`;
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f7;padding:24px;">
      <main style="max-width:760px;margin:0 auto;background:#fff;border:1px solid #d2d2d7;border-radius:12px;padding:24px;">
        <p style="margin:0 0 6px;color:#6e6e73;font-size:13px;font-weight:700;text-transform:uppercase;">Kolaretorp Service AB</p>
        <h1 style="margin:0;color:#1d1d1f;font-size:28px;line-height:1.15;">Tägliche Auftragsliste</h1>
        <p style="margin:8px 0 20px;color:#6e6e73;">Stand ${displayDate(today)} um 08:00 Uhr · ${summary}</p>
        ${jobs.length > 0 ? listHtml : `<p style="margin:18px 0;color:#1d1d1f;">Aktuell sind keine aktiven Aufträge vorhanden.</p>`}
        ${calendarHtml}
        ${birthdayHtml}
      </main>
    </div>
  `;
  const text = [
    `Tägliche Auftragsliste - ${displayDate(today)}`,
    summary,
    "",
    ...jobs.map((job) => {
      const object = objects.find((item) => item.id === job.objectId);
      const occurrences = occurrenceGroups[job.id] ?? [];
      const nextOccurrence = sortedByDueDate(occurrences).find((item) => !["erledigt", "abgerechnet", "storniert"].includes(item.status));
      return `${displayDate(nextOccurrence?.dueDate ?? job.dueDate)} | ${job.status} | ${job.priority} | ${job.title} | ${object?.name ?? "Objekt unbekannt"} | ${job.assignedTo}`;
    }),
    "",
    "Kalender heute plus 3 Tage",
    ...(calendarData.calendars.length > 0 ? calendarData.calendars.map((event) => `${displayDate(event.date)} | ${event.calendar} | ${event.title}${event.location ? ` | ${event.location}` : ""}`) : ["Keine Kalendertermine gefunden."]),
    "",
    "Geburtstage",
    ...(calendarData.birthdays.length > 0 ? calendarData.birthdays.map((event) => `${displayDate(event.date)} | ${event.title}`) : ["Keine Geburtstagsquelle verbunden oder keine Geburtstage im Zeitraum."]),
  ].join("\n");

  return { calendarCount: calendarData.calendars.length, birthdayCount: calendarData.birthdays.length, html, openJobCount: jobs.length, text };
}

async function sendResendMail({ html, subject, text }: { html: string; subject: string; text: string }) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.REPORT_SENDER_EMAIL || "info@kolaretorp.se";
  const recipient = process.env.DAILY_JOB_LIST_EMAIL || "info@kolaretorp.se";
  const ccRecipient = "Nicole.Klos@icloud.com";
  const ccRecipients = recipient.toLowerCase() === ccRecipient.toLowerCase() ? [] : [ccRecipient];

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
        cc: ccRecipients.length > 0 ? ccRecipients : undefined,
      }),
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (response.ok) {
      return { cc: ccRecipients, from: sender, to: recipient };
    }

    lastError = `${response.status} ${await response.text()}`;
    if (!lastError.includes("domain is not verified")) break;
  }

  throw new Error(`Resend konnte die Tagesmail nicht senden: ${lastError}`);
}

async function sendDailyMail(request: Request, manual = false) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!manual && secret && authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  const url = new URL(request.url);
  const force = manual || url.searchParams.get("force") === "1";
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

  const mail = await buildDailyJobMail((appState?.data as AppSnapshot | undefined) ?? {}, today);
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
        lastBirthdayCount: mail.birthdayCount,
        lastCalendarEventCount: mail.calendarCount,
        lastSentAt: new Date().toISOString(),
        lastSentDate: today,
      },
      id: dailyMailStateRowId,
      updated_at: new Date().toISOString(),
    });
  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 });
  }

  return NextResponse.json({
    birthdayCount: mail.birthdayCount,
    calendarCount: mail.calendarCount,
    delivery,
    manual,
    openJobCount: mail.openJobCount,
    sent: true,
    stockholmHour: hour,
    today,
  });
}

export async function GET(request: Request) {
  return sendDailyMail(request);
}

export async function POST(request: Request) {
  return sendDailyMail(request, true);
}
