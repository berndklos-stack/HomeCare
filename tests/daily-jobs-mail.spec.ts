import { expect, test } from "@playwright/test";
import {
  activeOverviewJobs,
  buildDailyJobMail,
  calendarEventTimeLabel,
  parseIcsEvents,
} from "../app/api/cron/daily-jobs/route";

function job(overrides: Record<string, unknown> = {}) {
  return {
    assignedTo: "Bernd Klos",
    description: "",
    dueDate: "2026-09-20",
    id: `JOB-${Math.random()}`,
    objectId: "OBJECT-1",
    priority: "normal",
    status: "geplant",
    title: "Testauftrag",
    ...overrides,
  };
}

test("Tagesmail berechnet alte Kalender-Serien einschließlich Ausschlüssen und verschobenen Terminen", () => {
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0",
    "BEGIN:VEVENT", "UID:weekly", "DTSTART;TZID=Europe/Stockholm:20260922T090000",
    "DTEND;TZID=Europe/Stockholm:20260922T100000", "RRULE:FREQ=WEEKLY;COUNT=5",
    "EXDATE;TZID=Europe/Stockholm:20261013T090000", "SUMMARY:Wöchentlich", "END:VEVENT",
    "BEGIN:VEVENT", "UID:weekly", "RECURRENCE-ID;TZID=Europe/Stockholm:20261006T090000",
    "DTSTART;TZID=Europe/Stockholm:20261007T140000", "DTEND;TZID=Europe/Stockholm:20261007T150000",
    "SUMMARY:Verschoben", "END:VEVENT",
    "BEGIN:VEVENT", "UID:cancelled", "DTSTART:20261006T100000Z", "STATUS:CANCELLED", "SUMMARY:Abgesagt", "END:VEVENT",
    "END:VCALENDAR"].join("\r\n");
  const events = parseIcsEvents(ics, "Arbeit", "2026-10-06", "2026-10-09");
  expect(events.map((event) => [event.title, event.date, calendarEventTimeLabel(event)]))
    .toEqual([["Verschoben", "2026-10-07", "14:00–15:00"]]);
  expect(parseIcsEvents(ics, "Arbeit", "2026-10-13", "2026-10-16")).toEqual([]);
  expect(parseIcsEvents(ics, "Arbeit", "2026-10-27", "2026-10-30")).toEqual([]);
});

test("Ganztägige Wiederholungen und zusätzliche Termine erscheinen im Tagesmail-Zeitraum", () => {
  const events = parseIcsEvents(["BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:annual",
    "DTSTART;VALUE=DATE:20201006", "RRULE:FREQ=YEARLY", "SUMMARY:Jahrestag", "END:VEVENT",
    "BEGIN:VEVENT", "UID:extra", "DTSTART:20260901T080000Z", "RDATE:20261008T080000Z",
    "SUMMARY:Zusatztermin", "END:VEVENT", "END:VCALENDAR"].join("\r\n"), "Arbeit", "2026-10-06", "2026-10-09");
  expect(events.map((event) => [event.title, event.date, calendarEventTimeLabel(event)]))
    .toEqual([["Jahrestag", "2026-10-06", "Ganztägig"], ["Zusatztermin", "2026-10-08", "10:00"]]);
});

test("abgeschlossene normale Aufträge bleiben aus der Tagesmail", () => {
  const visible = activeOverviewJobs([
    job({ id: "OPEN", status: "geplant" }),
    job({ id: "LETTERBOX", status: "erledigt", title: "Briefkasten-Test" }),
    job({ id: "COMPLETED", status: " abgeschlossen " }),
    job({ id: "BILLED", status: "abgerechnet" }),
    job({ id: "CANCELLED", status: "storniert" }),
  ]);

  expect(visible.map((item) => item.id)).toEqual(["OPEN"]);
});

test("nur offene Teilaufträge eines laufenden Serienauftrags werden verwendet", async () => {
  const master = job({
    dueDate: "2026-08-31",
    id: "GUNNABO",
    schedule: { end: "nie", endDate: "", frequency: "wöchentlich", interval: 1, occurrences: 0, type: "serie", weekdays: ["1"] },
    title: "Umbau Gunnabo",
  });
  const completedOccurrence = job({
    dueDate: "2026-08-31",
    id: "GUNNABO-20260831",
    seriesMasterId: "GUNNABO",
    seriesOccurrenceDate: "2026-08-31",
    status: "erledigt",
    title: "Umbau Gunnabo",
  });
  const futureOccurrence = job({
    dueDate: "2026-09-25",
    id: "GUNNABO-20260925",
    seriesMasterId: "GUNNABO",
    seriesOccurrenceDate: "2026-09-25",
    status: "geplant",
    title: "Umbau Gunnabo",
  });

  const mail = await buildDailyJobMail({
    dailyMailSettings: { birthdaySources: "", calendarSources: "", reminderSources: "" },
    jobs: [master, completedOccurrence, futureOccurrence],
    objects: [{ address: "Gunnabo 126", id: "OBJECT-1", name: "Gunnabo" }],
  }, "2026-09-20");

  expect(mail.openJobCount).toBe(1);
  expect(mail.text).toContain("25.9.2026");
  expect(mail.text).not.toContain("31.8.2026");
});

test("Serienauftrag ohne offenen Teilauftrag bleibt aus der Tagesmail", () => {
  const master = job({
    id: "SERIES",
    schedule: { end: "nie", endDate: "", frequency: "wöchentlich", interval: 1, occurrences: 0, type: "serie", weekdays: ["1"] },
  });
  const completedOccurrence = job({ id: "SERIES-DONE", seriesMasterId: "SERIES", status: "abgeschlossen" });

  expect(activeOverviewJobs([master, completedOccurrence])).toEqual([]);
});

test("Kalendertermine zeigen Stockholm-Zeit, Zeitspanne und Ganztagsstatus", () => {
  const events = parseIcsEvents([
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "DTSTART;VALUE=DATE:20260920",
    "DTEND;VALUE=DATE:20260921",
    "SUMMARY:Ganztagstermin",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "DTSTART:20260920T073000Z",
    "DTEND:20260920T083000Z",
    "SUMMARY:Besprechung Börjes",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "DTSTART;TZID=Europe/Stockholm:20260921T140000",
    "SUMMARY:Termin ohne Endzeit",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n"), "Arbeit", "2026-09-20", "2026-09-23");

  expect(events.map((event) => [event.title, calendarEventTimeLabel(event)])).toEqual([
    ["Ganztagstermin", "Ganztägig"],
    ["Besprechung Börjes", "09:30–10:30"],
    ["Termin ohne Endzeit", "14:00"],
  ]);
});
