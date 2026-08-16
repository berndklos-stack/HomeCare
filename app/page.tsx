"use client";

/* eslint-disable @next/next/no-img-element -- Berichtsbilder müssen in Chrome-PDFs als echte img-Elemente erscheinen. */

import Image from "next/image";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Archive,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Camera,
  ClipboardList,
  Euro,
  FileDown,
  FileText,
  Home,
  KeyRound,
  Languages,
  LogOut,
  Mail,
  Moon,
  Paperclip,
  Pencil,
  PlayCircle,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Send,
  Sun,
  Trash2,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { appVersion, versionHistory } from "@/lib/appVersion";

type Language = "de" | "sv" | "en";
type Theme = "light" | "dark";
type Section =
  | "dashboard"
  | "objects"
  | "customers"
  | "jobs"
  | "planning"
  | "field"
  | "reports"
  | "communication"
  | "billing"
  | "portal"
  | "masterData";
type Modal = "customer" | "job" | "version" | null;

type ObjectRecord = {
  id: string;
  name: string;
  ownerCustomerId: string;
  owner: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerAddress: string;
  address: string;
  billingAddressMode: "Objektadresse" | "Eigentümeradresse" | "Abweichend";
  billingAddress: string;
  region: string;
  sizeSqm: number;
  plotSqm: number;
  rooms: number;
  beds: number;
  bathrooms: number;
  buildYear: number;
  carePackage: "Basis" | "Plus" | "Komfort" | "Premium";
  status: "Saison aktiv" | "Kontrolle offen" | "Winterruhe";
  access: {
    keySafe: string;
    alarm: string;
    parking: string;
    notes: string;
  };
  equipment: string[];
  utilities: {
    heating: string;
    water: string;
    septic: string;
    internet: string;
  };
  risks: string[];
  media: {
    images: number;
    documents: number;
    floorPlans: number;
    items: MediaItem[];
  };
  nextVisit: string;
  lastVisit: string;
  archived?: boolean;
};

type MediaItem = {
  id: string;
  type: "Bild" | "Dokument" | "Grundriss";
  name: string;
  description: string;
  source: "Upload" | "Kamera";
  previewUrl?: string;
  isPrimary?: boolean;
};

type CustomerRecord = {
  id: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  language: string;
  portalLoginEmail: string;
  portalPassword: string;
  portalLoginHistory: PortalLoginEntry[];
  objects: string[];
  balance: string;
  portalStatus: "aktiv" | "einladen" | "gesperrt";
  notes: string;
  reportMailBody: string;
  archived?: boolean;
};

type PortalLoginEntry = {
  id: string;
  email: string;
  loggedAt: string;
  userAgent: string;
};

type JobRecord = {
  id: string;
  seriesMasterId?: string;
  seriesOccurrenceDate?: string;
  seriesExcludedDates?: string[];
  title: string;
  objectId: string;
  customerId: string;
  type: string;
  status: "geplant" | "in Arbeit" | "pausiert" | "erledigt" | "abgerechnet" | "storniert";
  priority: "niedrig" | "normal" | "hoch" | "dringend";
  dueDate: string;
  assignedTo: string;
  description: string;
  internalNotes: string;
  checklist: string[];
  serviceIds?: string[];
  customService?: ServiceItem | null;
  billable: boolean;
  material: string;
  workMinutes: number;
  schedule: JobSchedule;
};

type JobSchedule = {
  type: "einmalig" | "serie";
  frequency: "täglich" | "wöchentlich" | "monatlich" | "jährlich";
  interval: number;
  weekdays: string[];
  end: "nie" | "am" | "nach";
  endDate: string;
  occurrences: number;
  activeFromMonth?: number;
  activeToMonth?: number;
  yearInterval?: number;
};

type ReportRecord = {
  id: string;
  jobId: string;
  objectId: string;
  title: string;
  date: string;
  visibleToCustomer: boolean;
  summary: string;
  internalNotes: string;
  media: string[];
  checklistResults: FieldTaskResult[];
  customerComment: string;
  sentAt?: string;
};

type FieldTaskResult = {
  id: string;
  title: string;
  meta: string;
  description: string;
  completed: boolean;
  minutes: number;
  note: string;
  photos: FieldPhoto[];
};

type FieldTask = {
  id: string;
  title: string;
  meta: string;
  description: string;
  defaultMinutes: number;
};

type FieldPhoto = {
  name: string;
  accepted: boolean;
  previewUrl?: string;
};

type FieldTaskProgress = {
  completed: boolean;
  minutes: string;
  note: string;
  photos: FieldPhoto[];
};

type BillingRecord = {
  id: string;
  objectId: string;
  customerId: string;
  source: string;
  label: string;
  amount: string;
  status: "abrechenbar" | "abgerechnet" | "intern";
};

type PortalMessageRecord = {
  id: string;
  customerId: string;
  objectId: string;
  subject: string;
  message: string;
  createdAt: string;
  status: "neu" | "gelesen" | "erledigt";
};

type AppSnapshot = {
  activeJobId: string | null;
  customers: CustomerRecord[];
  fieldNotes: Record<string, string>;
  fieldProgress: Record<string, Record<string, FieldTaskProgress>>;
  jobs: JobRecord[];
  objects: ObjectRecord[];
  packages: ServicePackage[];
  portalMessages: PortalMessageRecord[];
  reports: ReportRecord[];
  services: ServiceItem[];
  updatedAt?: string;
};

type ServiceItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  price: string;
  currency: string;
  description: string;
  checklist: ServiceChecklistItem[];
  archived?: boolean;
};

type ServiceChecklistItem = {
  id: string;
  title: string;
  note: string;
  defaultMinutes: number;
};

type ServicePackage = {
  id: string;
  name: string;
  price: string;
  description: string;
  serviceIds: string[];
  archived?: boolean;
};

type NewObjectFormState = {
  name: string;
  ownerCustomerId: string;
  owner: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerAddress: string;
  address: string;
  billingAddressMode: ObjectRecord["billingAddressMode"];
  billingAddress: string;
  region: string;
  sizeSqm: string;
  plotSqm: string;
  rooms: string;
  beds: string;
  bathrooms: string;
  buildYear: string;
  carePackage: ObjectRecord["carePackage"];
  status: ObjectRecord["status"];
  keySafe: string;
  alarm: string;
  parking: string;
  accessNotes: string;
  heating: string;
  water: string;
  septic: string;
  internet: string;
  equipment: string;
  risks: string;
  images: string;
  documents: string;
  floorPlans: string;
  documentDescription: string;
  mediaItems: MediaItem[];
  nextVisit: string;
  lastVisit: string;
};

type NewJobFormState = {
  title: string;
  type: string;
  priority: JobRecord["priority"];
  dueDate: string;
  assignedTo: string;
  description: string;
  internalNotes: string;
  serviceIds: string[];
  customServiceName: string;
  customServiceCategory: string;
  customServiceUnit: string;
  customServicePrice: string;
  customServiceCurrency: string;
  customServiceDescription: string;
  customServiceChecklist: ServiceChecklistItem[];
  customChecklistTitle: string;
  customChecklistNote: string;
  customChecklistMinutes: string;
  scheduleType: JobSchedule["type"];
  scheduleFrequency: JobSchedule["frequency"];
  scheduleInterval: string;
  scheduleWeekdays: string[];
  scheduleEnd: JobSchedule["end"];
  scheduleEndDate: string;
  scheduleOccurrences: string;
  scheduleActiveFromMonth: string;
  scheduleActiveToMonth: string;
  scheduleYearInterval: string;
};

type CustomerFormState = {
  name: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  language: string;
  portalLoginEmail: string;
  portalPassword: string;
  portalLoginHistory: PortalLoginEntry[];
  balance: string;
  portalStatus: CustomerRecord["portalStatus"];
  objects: string[];
  notes: string;
  reportMailBody: string;
};

const labels = {
  de: {
    appTitle: "Ferienhausverwaltung",
    subtitle: "Objekte, Einsätze, Berichte und Abrechnung in einer Arbeitszentrale.",
    search: "Suchen",
    newObject: "Neues Objekt",
    editObject: "Objekt bearbeiten",
    newCustomer: "Neuer Kunde",
    editCustomer: "Kunde bearbeiten",
    newJob: "Neuer Auftrag",
    createObject: "Objekt anlegen",
    saveObject: "Objekt speichern",
    createCustomer: "Kunde anlegen",
    saveCustomer: "Kunde speichern",
    createJob: "Auftrag anlegen",
    saveJob: "Auftrag speichern",
    close: "Schließen",
    language: "Sprache",
    dark: "Dunkelmodus",
    light: "Hellmodus",
    demo: "Demo-Daten",
  },
  sv: {
    appTitle: "Fritidshusförvaltning",
    subtitle: "Objekt, uppdrag, rapporter och fakturering i en arbetsyta.",
    search: "Sök",
    newObject: "Nytt objekt",
    editObject: "Redigera objekt",
    newCustomer: "Ny kund",
    editCustomer: "Redigera kund",
    newJob: "Nytt uppdrag",
    createObject: "Skapa objekt",
    saveObject: "Spara objekt",
    createCustomer: "Skapa kund",
    saveCustomer: "Spara kund",
    createJob: "Skapa uppdrag",
    saveJob: "Spara uppdrag",
    close: "Stäng",
    language: "Språk",
    dark: "Mörkt läge",
    light: "Ljust läge",
    demo: "Demo-data",
  },
  en: {
    appTitle: "Holiday Home Operations",
    subtitle: "Properties, visits, reports and billing in one workspace.",
    search: "Search",
    newObject: "New property",
    editObject: "Edit property",
    newCustomer: "New customer",
    editCustomer: "Edit customer",
    newJob: "New job",
    createObject: "Create property",
    saveObject: "Save property",
    createCustomer: "Create customer",
    saveCustomer: "Save customer",
    createJob: "Create job",
    saveJob: "Save job",
    close: "Close",
    language: "Language",
    dark: "Dark mode",
    light: "Light mode",
    demo: "Demo data",
  },
} satisfies Record<Language, Record<string, string>>;

const navItems: Array<{ id: Section; label: string; icon: typeof Home }> = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "objects", label: "Objekte", icon: Home },
  { id: "customers", label: "Kunden", icon: UsersRound },
  { id: "jobs", label: "Aufträge", icon: ClipboardList },
  { id: "planning", label: "Einsatzplanung", icon: CalendarDays },
  { id: "field", label: "Mobil vor Ort", icon: Wrench },
  { id: "billing", label: "Abrechnung", icon: Euro },
  { id: "portal", label: "Kundenportal", icon: KeyRound },
  { id: "masterData", label: "Stammdaten", icon: KeyRound },
];

const storageKeys = {
  objects: "kolaretorp-objects",
  customers: "kolaretorp-customers",
  jobs: "kolaretorp-jobs",
  reports: "kolaretorp-reports",
  services: "kolaretorp-services",
  packages: "kolaretorp-packages",
  portalMessages: "kolaretorp-portal-messages",
  fieldNotes: "kolaretorp-field-notes",
  fieldProgress: "kolaretorp-field-progress",
  activeJobId: "kolaretorp-active-job-id",
  updatedAt: "kolaretorp-updated-at",
};

function readStoredValue<T>(key: string, fallback: T): T {
  const stored = window.localStorage.getItem(key);
  if (!stored) return fallback;

  try {
    return JSON.parse(stored) as T;
  } catch {
    window.localStorage.removeItem(key);
    return fallback;
  }
}

function readLocalSnapshot(): AppSnapshot {
  return {
    activeJobId: readStoredValue<string | null>(storageKeys.activeJobId, null),
    customers: readStoredValue<CustomerRecord[]>(storageKeys.customers, seedCustomers),
    fieldNotes: readStoredValue<Record<string, string>>(storageKeys.fieldNotes, {}),
    fieldProgress: readStoredValue<Record<string, Record<string, FieldTaskProgress>>>(storageKeys.fieldProgress, {}),
    jobs: readStoredValue<JobRecord[]>(storageKeys.jobs, seedJobs),
    objects: readStoredValue<ObjectRecord[]>(storageKeys.objects, seedObjects),
    packages: readStoredValue<ServicePackage[]>(storageKeys.packages, seedPackages),
    portalMessages: readStoredValue<PortalMessageRecord[]>(storageKeys.portalMessages, []),
    reports: dedupeReports(readStoredValue<ReportRecord[]>(storageKeys.reports, seedReports)),
    services: readStoredValue<ServiceItem[]>(storageKeys.services, seedServices),
    updatedAt: readStoredValue<string | undefined>(storageKeys.updatedAt, undefined),
  };
}

function persistLocalSnapshot(snapshot: AppSnapshot) {
  const updatedAt = snapshot.updatedAt ?? new Date().toISOString();
  window.localStorage.setItem(storageKeys.objects, JSON.stringify(snapshot.objects));
  window.localStorage.setItem(storageKeys.customers, JSON.stringify(snapshot.customers));
  window.localStorage.setItem(storageKeys.jobs, JSON.stringify(snapshot.jobs));
  window.localStorage.setItem(storageKeys.reports, JSON.stringify(snapshot.reports));
  window.localStorage.setItem(storageKeys.services, JSON.stringify(snapshot.services));
  window.localStorage.setItem(storageKeys.packages, JSON.stringify(snapshot.packages));
  window.localStorage.setItem(storageKeys.portalMessages, JSON.stringify(snapshot.portalMessages));
  window.localStorage.setItem(storageKeys.fieldNotes, JSON.stringify(snapshot.fieldNotes));
  window.localStorage.setItem(storageKeys.fieldProgress, JSON.stringify(snapshot.fieldProgress));
  window.localStorage.setItem(storageKeys.activeJobId, JSON.stringify(snapshot.activeJobId));
  window.localStorage.setItem(storageKeys.updatedAt, JSON.stringify(updatedAt));
}

function snapshotWeight(snapshot: AppSnapshot) {
  const fieldNotes = snapshot.fieldNotes ?? {};
  const fieldProgress = snapshot.fieldProgress ?? {};
  const objectMedia = snapshot.objects.reduce((sum, object) => sum + object.media.items.length, 0);
  const reportPhotos = snapshot.reports.reduce(
    (sum, report) => sum + report.checklistResults.reduce((photoSum, item) => photoSum + item.photos.length, 0),
    0,
  );
  const progressPhotos = Object.values(fieldProgress).reduce(
    (sum, tasks) => sum + Object.values(tasks).reduce((photoSum, task) => photoSum + task.photos.length, 0),
    0,
  );

  return [
    snapshot.objects.length,
    snapshot.customers.length,
    snapshot.jobs.length,
    snapshot.reports.length,
    snapshot.services.length,
    snapshot.packages.length,
    snapshot.portalMessages?.length ?? 0,
    Object.keys(fieldNotes).length,
    Object.keys(fieldProgress).length,
    objectMedia,
    reportPhotos,
    progressPhotos,
  ].reduce((sum, value) => sum + value, 0);
}

function mergeRecordsById<T extends { id: string }>(primaryRecords: T[], secondaryRecords: T[]) {
  const recordsById = new Map<string, T>();

  secondaryRecords.forEach((record) => {
    recordsById.set(record.id, record);
  });
  primaryRecords.forEach((record) => {
    recordsById.set(record.id, { ...recordsById.get(record.id), ...record });
  });

  return Array.from(recordsById.values());
}

function mediaItemScore(item: MediaItem) {
  return [
    item.previewUrl ? 4 : 0,
    item.isPrimary ? 2 : 0,
    item.description ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);
}

function mergeMediaItems(remoteItems: MediaItem[] = [], localItems: MediaItem[] = []) {
  const itemsById = new Map<string, MediaItem>();

  [...remoteItems, ...localItems].forEach((item) => {
    const existing = itemsById.get(item.id);
    if (!existing || mediaItemScore(item) >= mediaItemScore(existing)) {
      itemsById.set(item.id, { ...existing, ...item });
    }
  });

  const mergedItems = Array.from(itemsById.values());
  const primaryImage = mergedItems.find((item) => item.type === "Bild" && item.isPrimary && item.previewUrl)
    ?? mergedItems.find((item) => item.type === "Bild" && item.previewUrl);

  return mergedItems.map((item) => ({
    ...item,
    isPrimary: item.type === "Bild" ? item.id === primaryImage?.id : item.isPrimary,
  }));
}

function mergeObjectsById(primaryObjects: ObjectRecord[], secondaryObjects: ObjectRecord[]) {
  const secondaryById = new Map(secondaryObjects.map((object) => [object.id, object]));
  const primaryIds = new Set(primaryObjects.map((object) => object.id));
  const merged = primaryObjects.map((primaryObject) => {
    const secondaryObject = secondaryById.get(primaryObject.id);
    if (!secondaryObject) return primaryObject;

    const base = { ...secondaryObject, ...primaryObject };
    const mediaItems = mergeMediaItems(primaryObject.media.items, secondaryObject.media.items);

    return {
      ...base,
      media: {
        ...base.media,
        documents: mediaItems.filter((item) => item.type === "Dokument").length,
        floorPlans: mediaItems.filter((item) => item.type === "Grundriss").length,
        images: mediaItems.filter((item) => item.type === "Bild").length,
        items: mediaItems,
      },
    };
  });

  secondaryObjects.forEach((object) => {
    if (!primaryIds.has(object.id)) merged.push(object);
  });

  return merged;
}

function mergeFieldProgress(
  primaryProgress: AppSnapshot["fieldProgress"],
  secondaryProgress: AppSnapshot["fieldProgress"],
) {
  const merged = { ...secondaryProgress, ...primaryProgress };

  Object.entries(primaryProgress).forEach(([jobId, primaryTasks]) => {
    if (!secondaryProgress[jobId]) return;
    merged[jobId] = { ...secondaryProgress[jobId], ...primaryTasks };
  });

  return merged;
}

function mergeFieldNotes(
  primaryNotes: AppSnapshot["fieldNotes"] | undefined,
  secondaryNotes: AppSnapshot["fieldNotes"] | undefined,
) {
  return { ...(secondaryNotes ?? {}), ...(primaryNotes ?? {}) };
}

function mergeSnapshots(remoteSnapshot: AppSnapshot, localSnapshot: AppSnapshot): AppSnapshot {
  const remoteTime = Date.parse(remoteSnapshot.updatedAt ?? "");
  const localTime = Date.parse(localSnapshot.updatedAt ?? "");
  const localIsNewer = Number.isFinite(localTime)
    ? !Number.isFinite(remoteTime) || localTime >= remoteTime
    : snapshotWeight(localSnapshot) >= snapshotWeight(remoteSnapshot);
  const primarySnapshot = localIsNewer ? localSnapshot : remoteSnapshot;
  const secondarySnapshot = localIsNewer ? remoteSnapshot : localSnapshot;
  const jobs = mergeRecordsById(primarySnapshot.jobs, secondarySnapshot.jobs);
  const activeJobId = primarySnapshot.activeJobId && jobs.some((job) => job.id === primarySnapshot.activeJobId)
    ? primarySnapshot.activeJobId
    : secondarySnapshot.activeJobId && jobs.some((job) => job.id === secondarySnapshot.activeJobId)
      ? secondarySnapshot.activeJobId
      : null;

  return {
    activeJobId,
    customers: mergeRecordsById(primarySnapshot.customers, secondarySnapshot.customers),
    fieldNotes: mergeFieldNotes(primarySnapshot.fieldNotes, secondarySnapshot.fieldNotes),
    fieldProgress: mergeFieldProgress(primarySnapshot.fieldProgress, secondarySnapshot.fieldProgress),
    jobs,
    objects: mergeObjectsById(primarySnapshot.objects, secondarySnapshot.objects),
    packages: mergeRecordsById(primarySnapshot.packages, secondarySnapshot.packages),
    portalMessages: mergeRecordsById(primarySnapshot.portalMessages ?? [], secondarySnapshot.portalMessages ?? []),
    reports: dedupeReports(mergeRecordsById(primarySnapshot.reports, secondarySnapshot.reports)),
    services: mergeRecordsById(primarySnapshot.services, secondarySnapshot.services),
    updatedAt: new Date(Math.max(
      Number.isFinite(remoteTime) ? remoteTime : 0,
      Number.isFinite(localTime) ? localTime : 0,
    )).toISOString(),
  };
}

function reportSummaryNote(summary: string) {
  return summary.replace(/^\d+ von \d+ Checklistenpunkten ausgeführt\.\s*/, "").trim();
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs = 2500): Promise<T> {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error("Supabase-Zeitlimit erreicht")), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}

async function loadSupabaseSnapshot() {
  if (process.env.NEXT_PUBLIC_DISABLE_SUPABASE_SYNC === "1") {
    return null;
  }

  const response = await withTimeout(fetch("/api/app-state", {
    cache: "no-store",
    headers: { Accept: "application/json" },
  }));
  const payload = await response.json() as { data?: AppSnapshot | null; error?: string; updatedAt?: string | null };

  if (!response.ok) {
    throw new Error(payload.error || "App-Daten konnten nicht geladen werden.");
  }

  return payload.data ? { ...payload.data, updatedAt: payload.data.updatedAt ?? payload.updatedAt ?? undefined } : null;
}

async function saveSupabaseSnapshot(snapshot: AppSnapshot) {
  if (process.env.NEXT_PUBLIC_DISABLE_SUPABASE_SYNC === "1") {
    return;
  }

  const response = await withTimeout(fetch("/api/app-state", {
    body: JSON.stringify(snapshot),
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    method: "PUT",
  }));
  const payload = await response.json() as { error?: string };

  if (!response.ok) {
    throw new Error(payload.error || "App-Daten konnten nicht gespeichert werden.");
  }
}

function emptyObjectForm(): NewObjectFormState {
  return {
    name: "",
    ownerCustomerId: "",
    owner: "",
    ownerEmail: "",
    ownerPhone: "",
    ownerAddress: "",
    address: "",
    billingAddressMode: "Eigentümeradresse",
    billingAddress: "",
    region: "Nybro",
    sizeSqm: "95",
    plotSqm: "1800",
    rooms: "4",
    beds: "6",
    bathrooms: "1",
    buildYear: "1990",
    carePackage: "Basis",
    status: "Kontrolle offen",
    keySafe: "",
    alarm: "",
    parking: "",
    accessNotes: "",
    heating: "",
    water: "",
    septic: "",
    internet: "",
    equipment: "",
    risks: "",
    images: "0",
    documents: "0",
    floorPlans: "0",
    documentDescription: "",
    mediaItems: [],
    nextVisit: "",
    lastVisit: "",
  };
}

function emptyJobForm(): NewJobFormState {
  return {
    title: "",
    type: "Hauskontrolle",
    priority: "normal",
    dueDate: "2026-08-05",
    assignedTo: "Johan Berg",
    description: "",
    internalNotes: "",
    serviceIds: [],
    customServiceName: "",
    customServiceCategory: "",
    customServiceUnit: "",
    customServicePrice: "",
    customServiceCurrency: "SEK",
    customServiceDescription: "",
    customServiceChecklist: [],
    customChecklistTitle: "",
    customChecklistNote: "",
    customChecklistMinutes: "",
    scheduleType: "einmalig",
    scheduleFrequency: "wöchentlich",
    scheduleInterval: "1",
    scheduleWeekdays: [],
    scheduleEnd: "nie",
    scheduleEndDate: "",
    scheduleOccurrences: "10",
    scheduleActiveFromMonth: "",
    scheduleActiveToMonth: "",
    scheduleYearInterval: "1",
  };
}

function objectToForm(object: ObjectRecord): NewObjectFormState {
  return {
    name: object.name,
    ownerCustomerId: object.ownerCustomerId,
    owner: object.owner,
    ownerEmail: object.ownerEmail,
    ownerPhone: object.ownerPhone,
    ownerAddress: object.ownerAddress,
    address: object.address,
    billingAddressMode: object.billingAddressMode,
    billingAddress: object.billingAddress,
    region: object.region,
    sizeSqm: String(object.sizeSqm),
    plotSqm: String(object.plotSqm),
    rooms: String(object.rooms),
    beds: String(object.beds),
    bathrooms: String(object.bathrooms),
    buildYear: String(object.buildYear),
    carePackage: object.carePackage,
    status: object.status,
    keySafe: object.access.keySafe,
    alarm: object.access.alarm,
    parking: object.access.parking,
    accessNotes: object.access.notes,
    heating: object.utilities.heating,
    water: object.utilities.water,
    septic: object.utilities.septic,
    internet: object.utilities.internet,
    equipment: object.equipment.join(", "),
    risks: object.risks.join(", "),
    images: String(object.media.images),
    documents: String(object.media.documents),
    floorPlans: String(object.media.floorPlans),
    documentDescription: "",
    mediaItems: object.media.items,
    nextVisit: object.nextVisit,
    lastVisit: object.lastVisit,
  };
}

function splitList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function primaryObjectImage(object: ObjectRecord) {
  return object.media.items.find((item) => item.type === "Bild" && item.isPrimary && item.previewUrl)
    ?? object.media.items.find((item) => item.type === "Bild" && item.previewUrl);
}

function serviceToFieldTasks(service: ServiceItem): FieldTask[] {
  if (service.checklist.length === 0) {
    return [{
      id: service.id,
      title: service.name,
      meta: `${service.category} · ${serviceRate(service)}`,
      description: service.description,
      defaultMinutes: 0,
    }];
  }

  return service.checklist.map((item) => ({
    id: `${service.id}-${item.id}`,
    title: item.title,
    meta: `${service.name} · ${service.category} · ${serviceRate(service)}`,
    description: item.note,
    defaultMinutes: item.defaultMinutes,
  }));
}

function jobSelectedServices(job: JobRecord, services: ServiceItem[]) {
  const selected = (job.serviceIds ?? [])
    .map((id) => services.find((service) => service.id === id))
    .filter(Boolean) as ServiceItem[];

  return job.customService ? [...selected, job.customService] : selected;
}

function jobToForm(job: JobRecord): NewJobFormState {
  return {
    ...emptyJobForm(),
    title: job.title,
    type: job.type,
    priority: job.priority,
    dueDate: job.dueDate,
    assignedTo: job.assignedTo,
    description: job.description,
    internalNotes: job.internalNotes,
    serviceIds: job.serviceIds ?? [],
    customServiceName: job.customService?.name ?? "",
    customServiceCategory: job.customService?.category ?? "",
    customServiceUnit: job.customService?.unit ?? "",
    customServicePrice: job.customService?.price ?? "",
    customServiceCurrency: job.customService?.currency ?? "SEK",
    customServiceDescription: job.customService?.description ?? "",
    customServiceChecklist: job.customService?.checklist ?? [],
    scheduleType: job.schedule.type,
    scheduleFrequency: job.schedule.frequency,
    scheduleInterval: String(job.schedule.interval),
    scheduleWeekdays: job.schedule.weekdays,
    scheduleEnd: job.schedule.end,
    scheduleEndDate: job.schedule.endDate,
    scheduleOccurrences: String(job.schedule.occurrences || 10),
    scheduleActiveFromMonth: job.schedule.activeFromMonth ? String(job.schedule.activeFromMonth) : "",
    scheduleActiveToMonth: job.schedule.activeToMonth ? String(job.schedule.activeToMonth) : "",
    scheduleYearInterval: String(job.schedule.yearInterval || 1),
  };
}

function firstNameFromName(name: string) {
  const cleaned = name.replace(/^Familie\s+/i, "").trim();
  return cleaned.split(/\s+/)[0] || "zusammen";
}

const defaultReportMailBody = "Hallo {Vorname}, anbei der Bericht vom aktuellen Einsatz. Für Rückfragen stehen wir gerne zur Verfügung.";

function customerReportSendBody(customer: CustomerRecord | undefined) {
  const firstName = firstNameFromName(customer?.contact || customer?.name || "");
  return `Hej ${firstName},\n\nanbei der Bericht vom letzten Einsatz.\nLieben Dank fuer deinen Auftrag.\n\nHejdå`;
}

function customerReportSendSubject(report: ReportRecord, object: ObjectRecord) {
  return `Einsatz - Bericht vom ${report.date} - ${object.name}`;
}

function reportRecipientEmail(object: ObjectRecord, customer: CustomerRecord | undefined) {
  return object.ownerEmail.trim() || customer?.email.trim() || "";
}

function safeFileName(value: string) {
  return value
    .replace(/[^\wäöüÄÖÜß-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function createReportPdfBlob(report: ReportRecord, object: ObjectRecord, job: JobRecord | undefined, customer: CustomerRecord | undefined) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14;
  let y = margin;

  function addFooter() {
    const pageCount = pdf.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      pdf.setPage(page);
      pdf.setFontSize(8);
      pdf.setTextColor(120);
      pdf.text(`Seite ${page} von ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: "right" });
    }
  }

  function ensureSpace(height: number) {
    if (y + height <= pageHeight - 16) return;
    pdf.addPage();
    y = margin;
  }

  function addWrappedText(text: string, x: number, maxWidth: number, lineHeight = 5) {
    const lines = pdf.splitTextToSize(text || "-", maxWidth) as string[];
    ensureSpace(lines.length * lineHeight + 2);
    pdf.text(lines, x, y);
    y += lines.length * lineHeight;
  }

  function addKeyValue(label: string, value: string, x: number, width: number) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(105);
    pdf.text(label, x, y);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(20);
    y += 4;
    addWrappedText(value, x, width, 4.5);
  }

  pdf.setFillColor(246, 247, 249);
  pdf.rect(0, 0, pageWidth, 38, "F");
  pdf.setTextColor(20);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("Einsatzbericht", margin, 18);
  const logoDataUrl = await fetchAssetAsDataUrl("/kolaretorp-logo.png");
  if (logoDataUrl) {
    try {
      pdf.addImage(logoDataUrl, "PNG", margin, 22, 54, 5.6, undefined, "FAST");
    } catch {
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text("Kolaretorp Service AB", margin, 26);
    }
  } else {
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text("Kolaretorp Service AB", margin, 26);
  }
  pdf.text(`Bericht ${report.id}`, pageWidth - margin, 18, { align: "right" });
  pdf.text(report.date, pageWidth - margin, 26, { align: "right" });
  y = 46;

  const objectImage = primaryObjectImage(object);
  if (objectImage?.previewUrl?.startsWith("data:image")) {
    try {
      pdf.addImage(objectImage.previewUrl, "JPEG", margin, y, 48, 32, undefined, "FAST");
    } catch {
      pdf.setDrawColor(210);
      pdf.rect(margin, y, 48, 32);
    }
  } else {
    pdf.setDrawColor(210);
    pdf.rect(margin, y, 48, 32);
  }

  const infoX = margin + 56;
  addKeyValue("Objekt", `${object.name} · ${object.address}`, infoX, pageWidth - infoX - margin);
  addKeyValue("Eigentümer", `${customer?.name ?? object.owner} · ${reportRecipientEmail(object, customer) || "-"}`, infoX, pageWidth - infoX - margin);
  if (job) addKeyValue("Auftrag", `${job.title} · ${job.assignedTo} · ${job.status}`, infoX, pageWidth - infoX - margin);
  y = Math.max(y, 84);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(20);
  pdf.text("Zusammenfassung", margin, y);
  y += 7;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  addWrappedText(report.summary, margin, pageWidth - margin * 2);
  if (report.customerComment) {
    y += 4;
    pdf.setFont("helvetica", "bold");
    pdf.text("Kommentar", margin, y);
    y += 6;
    pdf.setFont("helvetica", "normal");
    addWrappedText(report.customerComment, margin, pageWidth - margin * 2);
  }

  y += 5;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("Checkliste", margin, y);
  y += 7;

  report.checklistResults.forEach((item, index) => {
    ensureSpace(24);
    pdf.setFillColor(250, 250, 251);
    pdf.setDrawColor(225);
    const startY = y;
    pdf.roundedRect(margin, y, pageWidth - margin * 2, 18, 2, 2, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(20);
    pdf.text(`${index + 1}. ${item.title}`, margin + 4, y + 6);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(item.completed ? 34 : 150);
    pdf.text(item.completed ? "ausgeführt" : "nicht ausgeführt", pageWidth - margin - 4, y + 6, { align: "right" });
    pdf.setTextColor(80);
    pdf.text(`${item.minutes || 0} min.`, pageWidth - margin - 4, y + 13, { align: "right" });
    y += 23;
    if (item.description) addWrappedText(item.description, margin + 4, pageWidth - margin * 2 - 8, 4.2);
    if (item.note) {
      pdf.setFont("helvetica", "bold");
      pdf.text("Hinweis", margin + 4, y);
      y += 5;
      pdf.setFont("helvetica", "normal");
      addWrappedText(item.note, margin + 4, pageWidth - margin * 2 - 8, 4.2);
    }
    item.photos.forEach((photo) => {
      const previewUrl = photo.previewUrl;
      if (!previewUrl?.startsWith("data:image")) return;
      ensureSpace(38);
      try {
        pdf.addImage(previewUrl, "JPEG", margin + 4, y, 42, 28, undefined, "FAST");
      } catch {
        pdf.rect(margin + 4, y, 42, 28);
      }
      y += 33;
    });
    if (y === startY) y += 23;
    y += 3;
  });

  addFooter();
  return pdf.output("blob");
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("PDF konnte nicht gelesen werden."));
    reader.readAsDataURL(blob);
  });
}

async function downloadCustomerReportPdf(report: ReportRecord, object: ObjectRecord, job: JobRecord | undefined, customer: CustomerRecord | undefined) {
  const pdfBlob = await createReportPdfBlob(report, object, job, customer);
  const fileName = `${safeFileName(customerReportSendSubject(report, object))}.pdf`;
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function sendCustomerReportMail(report: ReportRecord, object: ObjectRecord, job: JobRecord | undefined, customer: CustomerRecord | undefined) {
  const recipientEmail = reportRecipientEmail(object, customer);
  if (!recipientEmail) throw new Error("Keine Empfängeradresse in den Objekt- oder Kundendaten gefunden.");

  const pdfBlob = await createReportPdfBlob(report, object, job, customer);
  const fileName = `${safeFileName(customerReportSendSubject(report, object))}.pdf`;
  const attachmentBase64 = await blobToBase64(pdfBlob);
  const response = await fetch("/api/reports/send", {
    body: JSON.stringify({
      attachmentBase64,
      body: customerReportSendBody(customer),
      cc: "info@kolaretorp.se",
      filename: fileName,
      subject: customerReportSendSubject(report, object),
      to: recipientEmail,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const payload = await response.json() as { error?: string; sent?: boolean };

  if (!response.ok || !payload.sent) {
    throw new Error(payload.error || "Bericht konnte nicht gesendet werden.");
  }
}

async function notifyPortalActivity(subject: string, body: string, replyTo?: string) {
  const response = await fetch("/api/portal/notify", {
    body: JSON.stringify({ body, replyTo, subject }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const payload = await response.json() as { error?: string; sent?: boolean };

  if (!response.ok || !payload.sent) {
    throw new Error(payload.error || "Portal-Benachrichtigung konnte nicht gesendet werden.");
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

async function fetchAssetAsDataUrl(path: string) {
  try {
    const response = await fetch(path);
    if (!response.ok) return "";
    const blob = await response.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
}

async function fileToImagePreview(file: File, maxSize = 1280, quality = 0.72) {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  if (!image) return dataUrl;

  const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

async function fileToDocumentPreview(file: File) {
  if (file.type.startsWith("image/")) return fileToImagePreview(file, 1100, 0.7);
  if (file.size > 2_000_000) return undefined;
  return readFileAsDataUrl(file);
}

function formToObject(form: NewObjectFormState, id: string): ObjectRecord {
  const imageCount = form.mediaItems.filter((item) => item.type === "Bild").length;
  const documentCount = form.mediaItems.filter((item) => item.type === "Dokument").length;
  const floorPlanCount = form.mediaItems.filter((item) => item.type === "Grundriss").length;
  const objectAddress = form.address.trim() || "Adresse offen";
  const ownerAddress = form.ownerAddress.trim() || "Eigentümeradresse offen";
  const billingAddress =
    form.billingAddressMode === "Objektadresse"
      ? objectAddress
      : form.billingAddressMode === "Eigentümeradresse"
        ? ownerAddress
        : form.billingAddress.trim() || ownerAddress;

  return {
    id,
    name: form.name.trim() || "Neues Ferienhaus",
    ownerCustomerId: form.ownerCustomerId,
    owner: form.owner.trim() || "Neuer Eigentümer",
    ownerEmail: form.ownerEmail.trim() || "kunde@example.com",
    ownerPhone: form.ownerPhone.trim() || "-",
    ownerAddress,
    address: objectAddress,
    billingAddressMode: form.billingAddressMode,
    billingAddress,
    region: form.region.trim() || "Nybro",
    sizeSqm: Number(form.sizeSqm) || 0,
    plotSqm: Number(form.plotSqm) || 0,
    rooms: Number(form.rooms) || 0,
    beds: Number(form.beds) || 0,
    bathrooms: Number(form.bathrooms) || 0,
    buildYear: Number(form.buildYear) || 0,
    carePackage: form.carePackage,
    status: form.status,
    access: {
      keySafe: form.keySafe.trim() || "noch zu pflegen",
      alarm: form.alarm.trim() || "noch zu pflegen",
      parking: form.parking.trim() || "noch zu pflegen",
      notes: form.accessNotes.trim() || "Zugang und Besonderheiten ergänzen.",
    },
    equipment: splitList(form.equipment),
    utilities: {
      heating: form.heating.trim() || "noch zu pflegen",
      water: form.water.trim() || "noch zu pflegen",
      septic: form.septic.trim() || "noch zu pflegen",
      internet: form.internet.trim() || "noch zu pflegen",
    },
    risks: splitList(form.risks),
    media: {
      images: Math.max(Number(form.images) || 0, imageCount),
      documents: Math.max(Number(form.documents) || 0, documentCount),
      floorPlans: Math.max(Number(form.floorPlans) || 0, floorPlanCount),
      items: form.mediaItems,
    },
    nextVisit: form.nextVisit.trim() || "noch planen",
    lastVisit: form.lastVisit.trim() || "-",
  };
}

function emptyCustomerForm(): CustomerFormState {
  return {
    name: "",
    contact: "",
    email: "",
    phone: "",
    address: "",
    language: "Deutsch",
    portalLoginEmail: "",
    portalPassword: "",
    portalLoginHistory: [],
    balance: "0 SEK",
    portalStatus: "einladen",
    objects: [],
    notes: "",
    reportMailBody: defaultReportMailBody,
  };
}

function customerToForm(customer: CustomerRecord): CustomerFormState {
  return {
    name: customer.name,
    contact: customer.contact,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    language: customer.language,
    portalLoginEmail: customer.portalLoginEmail || customer.email,
    portalPassword: customer.portalPassword || "",
    portalLoginHistory: customer.portalLoginHistory ?? [],
    balance: customer.balance,
    portalStatus: customer.portalStatus,
    objects: customer.objects,
    notes: customer.notes,
    reportMailBody: customer.reportMailBody || defaultReportMailBody,
  };
}

function formToCustomer(form: CustomerFormState, id: string): CustomerRecord {
  return {
    id,
    name: form.name.trim() || "Neuer Kunde",
    contact: form.contact.trim() || "Kontakt ergänzen",
    email: form.email.trim() || "kunde@example.com",
    phone: form.phone.trim() || "-",
    address: form.address.trim() || "Eigentümeradresse offen",
    language: form.language.trim() || "Deutsch",
    portalLoginEmail: form.portalLoginEmail.trim() || form.email.trim() || "kunde@example.com",
    portalPassword: form.portalPassword.trim(),
    portalLoginHistory: form.portalLoginHistory ?? [],
    objects: form.objects,
    balance: form.balance.trim() || "0 SEK",
    portalStatus: form.portalStatus,
    notes: form.notes.trim(),
    reportMailBody: form.reportMailBody.trim() || defaultReportMailBody,
  };
}

function svgPreview(label: string, colors: { sky: string; land: string; accent: string }) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 560">
      <defs>
        <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="${colors.sky}"/>
          <stop offset="1" stop-color="#f5f5f7"/>
        </linearGradient>
      </defs>
      <rect width="900" height="560" fill="url(#sky)"/>
      <rect y="370" width="900" height="190" fill="${colors.land}"/>
      <path d="M150 355h360v155H150z" fill="#fff" stroke="#1d1d1f" stroke-width="8"/>
      <path d="M120 355l210-150 210 150z" fill="${colors.accent}" stroke="#1d1d1f" stroke-width="8"/>
      <rect x="230" y="395" width="70" height="115" fill="#d6e8ff" stroke="#1d1d1f" stroke-width="6"/>
      <rect x="355" y="395" width="80" height="70" fill="#d6e8ff" stroke="#1d1d1f" stroke-width="6"/>
      <circle cx="700" cy="170" r="54" fill="#fff" opacity=".82"/>
      <text x="56" y="82" font-family="Arial, sans-serif" font-size="42" font-weight="700" fill="#1d1d1f">${label}</text>
    </svg>
  `)}`;
}

const demoVillaImage = svgPreview("Villa Långsjön", { sky: "#cfe7ff", land: "#d8ead1", accent: "#d14836" });
const demoAccessPhoto = svgPreview("Zugang geprüft", { sky: "#e8f1ff", land: "#e1e1e6", accent: "#0071e3" });
const demoTerracePhoto = svgPreview("Außenrunde", { sky: "#f5e9d8", land: "#d7ebd3", accent: "#7a5a34" });
const demoGardenPhoto = svgPreview("Gartenpflege", { sky: "#dff3ff", land: "#b9dfb8", accent: "#2f7d50" });

const seedObjects: ObjectRecord[] = [
  {
    id: "OBJ-1001",
    name: "Villa Långsjön",
    ownerCustomerId: "CUS-1",
    owner: "Familie Andersson",
    ownerEmail: "eva.andersson@example.com",
    ownerPhone: "+46 70 118 44 20",
    ownerAddress: "Storgatan 12, 392 32 Kalmar",
    address: "Långsjövägen 18, 382 92 Orrefors",
    billingAddressMode: "Eigentümeradresse",
    billingAddress: "Storgatan 12, 392 32 Kalmar",
    region: "Orrefors",
    sizeSqm: 126,
    plotSqm: 2800,
    rooms: 5,
    beds: 8,
    bathrooms: 2,
    buildYear: 1998,
    carePackage: "Komfort",
    status: "Saison aktiv",
    access: {
      keySafe: "Schlüsselsafe Nebeneingang",
      alarm: "Alarm vor Betreten deaktivieren",
      parking: "Zufahrt links am Bootssteg",
      notes: "Pooltechnik im Nebenraum, Filterdruck dokumentieren.",
    },
    equipment: ["Pool", "Sauna", "Kamin", "Bootssteg", "Glasfaser", "Wärmepumpe"],
    utilities: {
      heating: "Luftwärmepumpe + Kamin",
      water: "kommunal",
      septic: "kommunal",
      internet: "Fiber 250/250",
    },
    risks: ["Poolwerte wöchentlich prüfen", "Terrasse nach Sturm kontrollieren"],
    media: {
      images: 18,
      documents: 6,
      floorPlans: 1,
      items: [
        { id: "MED-1001-1", type: "Bild", name: "pooltechnik-vor-ort.jpg", description: "Pooltechnik und Filterdruck beim letzten Einsatz", source: "Kamera", previewUrl: demoVillaImage, isPrimary: true },
        { id: "MED-1001-2", type: "Dokument", name: "servicevertrag-komfort.pdf", description: "Aktueller Betreuungsvertrag Komfort", source: "Upload" },
        { id: "MED-1001-3", type: "Grundriss", name: "grundriss-villa-langsjon.pdf", description: "Grundriss Erdgeschoss und Obergeschoss", source: "Upload" },
      ],
    },
    nextVisit: "31.07.2026",
    lastVisit: "Heute, 09:20",
  },
  {
    id: "OBJ-1002",
    name: "Stuga Nybro",
    ownerCustomerId: "CUS-2",
    owner: "M. Schneider",
    ownerEmail: "markus.schneider@example.com",
    ownerPhone: "+49 171 440 22 18",
    ownerAddress: "Musterstraße 9, 50667 Köln, Deutschland",
    address: "Skogsstigen 7, 382 34 Nybro",
    billingAddressMode: "Eigentümeradresse",
    billingAddress: "Musterstraße 9, 50667 Köln, Deutschland",
    region: "Nybro",
    sizeSqm: 84,
    plotSqm: 1600,
    rooms: 4,
    beds: 6,
    bathrooms: 1,
    buildYear: 1982,
    carePackage: "Plus",
    status: "Kontrolle offen",
    access: {
      keySafe: "Schlüssel bei Nachbarin Frau Lind",
      alarm: "kein Alarm",
      parking: "Carport direkt am Haus",
      notes: "Briefkasten und Dachrinne hinten links prüfen.",
    },
    equipment: ["Kamin", "Waschmaschine", "Gartenhaus", "Wärmepumpe"],
    utilities: {
      heating: "Wärmepumpe",
      water: "Brunnen",
      septic: "Dreikammergrube",
      internet: "4G Router",
    },
    risks: ["Dachrinne bei Starkregen", "Brunnenpumpe im Winter sichern"],
    media: {
      images: 11,
      documents: 4,
      floorPlans: 1,
      items: [
        { id: "MED-1002-1", type: "Bild", name: "dachrinne-hinten.jpg", description: "Dachrinne hinten links nach Starkregen", source: "Kamera" },
        { id: "MED-1002-2", type: "Dokument", name: "brunnenpumpe-hinweis.pdf", description: "Hinweis zur Brunnenpumpe und Winterabsicherung", source: "Upload" },
      ],
    },
    nextVisit: "02.08.2026",
    lastVisit: "28.07.2026",
  },
  {
    id: "OBJ-1003",
    name: "Haus am Wald",
    ownerCustomerId: "CUS-3",
    owner: "B. Klos",
    ownerEmail: "bernd@example.com",
    ownerPhone: "+46 76 101 81 86",
    ownerAddress: "Kolaretorp 106, 382 93 Nybro",
    address: "Kolaretorp 106, 382 93 Nybro",
    billingAddressMode: "Objektadresse",
    billingAddress: "Kolaretorp 106, 382 93 Nybro",
    region: "Småland",
    sizeSqm: 102,
    plotSqm: 5200,
    rooms: 5,
    beds: 7,
    bathrooms: 1,
    buildYear: 1976,
    carePackage: "Basis",
    status: "Winterruhe",
    access: {
      keySafe: "intern",
      alarm: "Werkstatt separat",
      parking: "Hof vorne",
      notes: "Werkstatt bleibt bei Kundenansicht verborgen.",
    },
    equipment: ["Werkstatt", "Carport", "Kamin", "Waldgrundstück"],
    utilities: {
      heating: "Holz + Direktstrom",
      water: "Brunnen",
      septic: "Einzelanlage",
      internet: "Fiber",
    },
    risks: ["Terrassentür justieren", "Wildschäden am Zaun prüfen"],
    media: {
      images: 9,
      documents: 5,
      floorPlans: 0,
      items: [
        { id: "MED-1003-1", type: "Dokument", name: "werkstatt-intern.pdf", description: "Interner Hinweis zur Werkstatt", source: "Upload" },
      ],
    },
    nextVisit: "05.08.2026",
    lastVisit: "26.07.2026",
  },
];

const seedCustomers: CustomerRecord[] = [
  {
    id: "CUS-1",
    name: "Familie Andersson",
    contact: "Eva Andersson",
    email: "eva.andersson@example.com",
    phone: "+46 70 118 44 20",
    address: "Storgatan 12, 392 32 Kalmar",
    language: "SV / DE",
    portalLoginEmail: "eva.andersson@example.com",
    portalPassword: "demo-portal",
    portalLoginHistory: [],
    objects: ["OBJ-1001"],
    balance: "0 SEK",
    portalStatus: "aktiv",
    notes: "Bevorzugt Kommunikation per E-Mail, Fotos nach jeder Poolpflege mitschicken.",
    reportMailBody: defaultReportMailBody,
  },
  {
    id: "CUS-2",
    name: "M. Schneider",
    contact: "Markus Schneider",
    email: "markus.schneider@example.com",
    phone: "+49 171 440 22 18",
    address: "Musterstraße 9, 50667 Köln, Deutschland",
    language: "DE",
    portalLoginEmail: "markus.schneider@example.com",
    portalPassword: "demo-portal",
    portalLoginHistory: [],
    objects: ["OBJ-1002"],
    balance: "1.840 SEK",
    portalStatus: "aktiv",
    notes: "Rechnungsadresse in Deutschland, Rückfragen bitte auf Deutsch.",
    reportMailBody: defaultReportMailBody,
  },
  {
    id: "CUS-3",
    name: "B. Klos",
    contact: "Bernd Klos",
    email: "bernd@example.com",
    phone: "+46 76 101 81 86",
    address: "Kolaretorp 106, 382 93 Nybro",
    language: "DE / EN",
    portalLoginEmail: "bernd@example.com",
    portalPassword: "demo-portal",
    portalLoginHistory: [],
    objects: ["OBJ-1003"],
    balance: "0 SEK",
    portalStatus: "einladen",
    notes: "Interner Eigentümer, Werkstattinformationen nicht im Kundenportal anzeigen.",
    reportMailBody: defaultReportMailBody,
  },
];

const seedJobs: JobRecord[] = [
  {
    id: "JOB-2407",
    title: "Poolpflege und Wasserwerte",
    objectId: "OBJ-1001",
    customerId: "CUS-1",
    type: "Poolpflege",
    status: "in Arbeit",
    priority: "hoch",
    dueDate: "31.07.2026",
    assignedTo: "Johan Berg",
    description: "Pool reinigen, Wasserwerte messen, Filterdruck dokumentieren.",
    internalNotes: "pH-Mittel nur intern kalkulieren.",
    checklist: ["Zugang dokumentieren", "Vorher-Fotos", "Wasserwerte", "Material", "Bericht"],
    serviceIds: ["SVC-1", "SVC-2", "SVC-3"],
    customService: null,
    billable: true,
    material: "pH-Minus, Teststreifen",
    workMinutes: 95,
    schedule: { type: "serie", frequency: "wöchentlich", interval: 1, weekdays: ["Mo"], end: "nie", endDate: "", occurrences: 0, activeFromMonth: 5, activeToMonth: 9, yearInterval: 1 },
  },
  {
    id: "JOB-2408",
    title: "Gartenpflege und Sichtprüfung",
    objectId: "OBJ-1002",
    customerId: "CUS-2",
    type: "Gartenpflege",
    status: "geplant",
    priority: "normal",
    dueDate: "02.08.2026",
    assignedTo: "Anna Lind",
    description: "Rasen, Hecken, Zufahrt, Dachrinne hinten links prüfen.",
    internalNotes: "Dachrinne eventuell als Zusatzauftrag anbieten.",
    checklist: ["Außenrunde", "Rasen", "Hecken", "Fotos", "Rückmeldung"],
    serviceIds: ["SVC-5", "SVC-2", "SVC-3"],
    customService: null,
    billable: true,
    material: "-",
    workMinutes: 120,
    schedule: { type: "serie", frequency: "monatlich", interval: 1, weekdays: [], end: "am", endDate: "2026-10-31", occurrences: 0, activeFromMonth: 4, activeToMonth: 10, yearInterval: 1 },
  },
  {
    id: "JOB-2409",
    title: "Terrassentür justieren",
    objectId: "OBJ-1003",
    customerId: "CUS-3",
    type: "Reparatur",
    status: "erledigt",
    priority: "normal",
    dueDate: "29.07.2026",
    assignedTo: "Bernd Klos",
    description: "Beschlag prüfen und Tür einstellen.",
    internalNotes: "Interne Nacharbeit.",
    checklist: ["Werkzeug", "Beschlag", "Test", "Notiz"],
    serviceIds: [],
    customService: {
      id: "JOB-SVC-2409",
      name: "Terrassentür justieren",
      category: "Reparatur",
      unit: "Einsatz",
      price: "0",
      currency: "SEK",
      description: "Beschlag prüfen und Tür einstellen.",
      checklist: [
        { id: "JOB-SVC-2409-1", title: "Werkzeug vorbereiten", note: "Passendes Werkzeug und Schrauben bereitlegen.", defaultMinutes: 5 },
        { id: "JOB-SVC-2409-2", title: "Beschlag prüfen", note: "Beschlag und Schließverhalten kontrollieren.", defaultMinutes: 20 },
        { id: "JOB-SVC-2409-3", title: "Funktion testen", note: "Tür mehrfach öffnen und schließen, Ergebnis dokumentieren.", defaultMinutes: 10 },
      ],
    },
    billable: false,
    material: "Schrauben",
    workMinutes: 45,
    schedule: { type: "einmalig", frequency: "wöchentlich", interval: 1, weekdays: [], end: "nie", endDate: "", occurrences: 0 },
  },
];

const seedReports: ReportRecord[] = [
  {
    id: "REP-044",
    jobId: "JOB-2407",
    objectId: "OBJ-1001",
    title: "Poolpflege und Wasserwerte",
    date: "31.07.2026",
    visibleToCustomer: true,
    summary: "Pool gereinigt, Werte stabilisiert, nächste Kontrolle geplant.",
    internalNotes: "Filterdruck beobachten. Interner Hinweis nicht im Kundenportal.",
    media: ["3 Fotos", "1 Voicememo"],
    checklistResults: [
      {
        id: "REP-044-1",
        title: "Zugang prüfen",
        meta: "Hauskontrolle · Kontrolle · 795 SEK/Besuch",
        description: "Schlüsselsafe, Türen, Fenster und Alarmstatus dokumentieren.",
        completed: true,
        minutes: 10,
        note: "Zugang geprüft, Fotos ergänzt.",
        photos: [{ name: "zugang-villa-langsjon.jpg", accepted: true, previewUrl: demoAccessPhoto }],
      },
      {
        id: "REP-044-2",
        title: "Außenrunde durchführen",
        meta: "Hauskontrolle · Kontrolle · 795 SEK/Besuch",
        description: "Fassade, Dach, Terrasse, Zufahrt und sichtbare Schäden prüfen.",
        completed: true,
        minutes: 20,
        note: "Keine Auffälligkeiten außen.",
        photos: [{ name: "terrasse-villa-langsjon.jpg", accepted: true, previewUrl: demoTerracePhoto }],
      },
      {
        id: "REP-044-3",
        title: "Innenkontrolle abschließen",
        meta: "Hauskontrolle · Kontrolle · 795 SEK/Besuch",
        description: "Wasser, Heizung, Strom, Gerüche und Auffälligkeiten erfassen.",
        completed: false,
        minutes: 0,
        note: "Innenkontrolle beim Folgetermin nachholen.",
        photos: [],
      },
    ],
    customerComment: "Pool gereinigt und Wasserwerte geprüft. Nächste Kontrolle wie geplant.",
  },
  {
    id: "REP-041",
    jobId: "JOB-2408",
    objectId: "OBJ-1002",
    title: "Gartenpflege",
    date: "28.07.2026",
    visibleToCustomer: true,
    summary: "Gartenpflege ausgeführt und Zufahrt geprüft.",
    internalNotes: "Zusatztermin Dachrinne empfehlen.",
    media: ["5 Fotos"],
    checklistResults: [
      {
        id: "REP-041-1",
        title: "Rasen und Wege prüfen",
        meta: "Gartenpflege · Außenanlage · 595 SEK/Stunde",
        description: "Pflegebedarf, Hindernisse und Wetterlage notieren.",
        completed: true,
        minutes: 15,
        note: "Zufahrt frei, Wege geprüft.",
        photos: [{ name: "gartenpflege-nybro.jpg", accepted: true, previewUrl: demoGardenPhoto }],
      },
    ],
    customerComment: "Gartenpflege wurde ausgeführt, die Zufahrt ist frei.",
  },
];

const seedBilling: BillingRecord[] = [
  {
    id: "BIL-1001",
    objectId: "OBJ-1001",
    customerId: "CUS-1",
    source: "JOB-2407",
    label: "Poolpflege inkl. Material",
    amount: "2.110 SEK",
    status: "abrechenbar",
  },
  {
    id: "BIL-1002",
    objectId: "OBJ-1002",
    customerId: "CUS-2",
    source: "JOB-2408",
    label: "Gartenpflege und Sichtprüfung",
    amount: "1.840 SEK",
    status: "abgerechnet",
  },
];

const seedServices: ServiceItem[] = [
  { id: "SVC-1", name: "Hauskontrolle", category: "Kontrolle", unit: "Besuch", price: "795", currency: "SEK", description: "Sichtprüfung von Haus, Grundstück und Zugang mit Kurzbericht", checklist: [
    { id: "SVC-1-1", title: "Zugang prüfen", note: "Schlüsselsafe, Türen, Fenster und Alarmstatus dokumentieren.", defaultMinutes: 10 },
    { id: "SVC-1-2", title: "Außenrunde durchführen", note: "Fassade, Dach, Terrasse, Zufahrt und sichtbare Schäden prüfen.", defaultMinutes: 20 },
    { id: "SVC-1-3", title: "Innenkontrolle abschließen", note: "Wasser, Heizung, Strom, Gerüche und Auffälligkeiten erfassen.", defaultMinutes: 20 },
  ] },
  { id: "SVC-2", name: "Fotobericht", category: "Dokumentation", unit: "Bericht", price: "inklusive", currency: "SEK", description: "Strukturierte Fotos und kurze Zusammenfassung nach dem Einsatz", checklist: [
    { id: "SVC-2-1", title: "Vorher-Fotos erfassen", note: "Relevante Räume und Außenbereiche fotografieren.", defaultMinutes: 10 },
    { id: "SVC-2-2", title: "Nachher-Fotos ergänzen", note: "Erledigte Arbeiten und besondere Feststellungen dokumentieren.", defaultMinutes: 10 },
  ] },
  { id: "SVC-3", name: "E-Mail Rückmeldung", category: "Kommunikation", unit: "Nachricht", price: "inklusive", currency: "SEK", description: "Statusmeldung an Eigentümer nach Besuch oder Einsatz", checklist: [
    { id: "SVC-3-1", title: "Kundenzusammenfassung vorbereiten", note: "Nur kundenfreigegebene Hinweise aufnehmen.", defaultMinutes: 8 },
  ] },
  { id: "SVC-4", name: "Briefkastenservice", category: "Betreuung", unit: "Besuch", price: "inklusive", currency: "SEK", description: "Briefkasten leeren, relevante Post fotografieren und melden", checklist: [
    { id: "SVC-4-1", title: "Briefkasten leeren", note: "Post sortieren und wichtige Briefe fotografieren.", defaultMinutes: 10 },
  ] },
  { id: "SVC-5", name: "Gartenpflege", category: "Außenanlage", unit: "Stunde", price: "595", currency: "SEK", description: "Rasen, Hecken, Saisonpflege und Sichtkontrolle außen", checklist: [
    { id: "SVC-5-1", title: "Rasen und Wege prüfen", note: "Pflegebedarf, Hindernisse und Wetterlage notieren.", defaultMinutes: 15 },
    { id: "SVC-5-2", title: "Gartenarbeit ausführen", note: "Arbeitszeit und besondere Arbeiten sauber erfassen.", defaultMinutes: 60 },
  ] },
  { id: "SVC-6", name: "Schlüsselservice", category: "Zugang", unit: "Einsatz", price: "495", currency: "SEK", description: "Schlüsselübergabe, Zugangsdokumentation und Schlüsselverwaltung", checklist: [
    { id: "SVC-6-1", title: "Schlüsselbestand prüfen", note: "Schlüsselnummer, Ablageort und Übergabe dokumentieren.", defaultMinutes: 15 },
  ] },
  { id: "SVC-7", name: "Reinigung", category: "Innenbereich", unit: "Stunde", price: "495", currency: "SEK", description: "Innenreinigung und Vorbereitung für Eigentümer oder Gäste", checklist: [
    { id: "SVC-7-1", title: "Räume reinigen", note: "Bad, Küche, Wohnräume und Schlafräume nach Standard prüfen.", defaultMinutes: 90 },
  ] },
  { id: "SVC-8", name: "Notdienst", category: "Sonderleistung", unit: "Einsatz", price: "990", currency: "SEK", description: "Priorisierte Hilfe bei akuten Problemen nach Aufwand", checklist: [
    { id: "SVC-8-1", title: "Problem aufnehmen", note: "Ursache, Sofortmaßnahme und Folgeauftrag dokumentieren.", defaultMinutes: 30 },
  ] },
];

const seedPackages: ServicePackage[] = [
  { id: "PKG-1", name: "Basis", price: "2.990 SEK/Jahr", description: "Grundbetreuung mit 4 Kontrollen pro Jahr", serviceIds: ["SVC-1", "SVC-2", "SVC-3"] },
  { id: "PKG-2", name: "Plus", price: "5.490 SEK/Jahr", description: "Erweiterte Betreuung mit 8 Kontrollen und Briefkastenservice", serviceIds: ["SVC-1", "SVC-2", "SVC-3", "SVC-4"] },
  { id: "PKG-3", name: "Komfort", price: "7.990 SEK/Jahr", description: "Regelmäßige Betreuung mit 12 Kontrollen und kleinen Zusatzdiensten", serviceIds: ["SVC-1", "SVC-2", "SVC-3", "SVC-4", "SVC-5", "SVC-6"] },
  { id: "PKG-4", name: "Premium", price: "9.990 SEK/Jahr", description: "Alles inklusive mit priorisiertem Notfallservice", serviceIds: ["SVC-1", "SVC-2", "SVC-3", "SVC-4", "SVC-5", "SVC-6", "SVC-7", "SVC-8"] },
];

function statusTone(status: string) {
  if (["in Arbeit", "Entwurf", "abrechenbar"].includes(status)) return "warning";
  if (["erledigt", "abgerechnet", "aktiv", "Gelesen"].includes(status)) return "good";
  if (["dringend", "gesperrt"].includes(status)) return "danger";
  return "neutral";
}

function serviceRate(service: ServiceItem) {
  const price = service.price.trim();
  const hasCurrency = /\b(SEK|EUR|USD|NOK|DKK)\b/i.test(price);
  const amount = price.toLowerCase() === "inklusive" || hasCurrency ? price : `${price} ${service.currency || "SEK"}`;
  return `${amount}/${service.unit}`;
}

const monthNames = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

function scheduleLabel(schedule: JobSchedule) {
  if (schedule.type === "einmalig") return "einmalig";

  const interval = schedule.interval > 1 ? `alle ${schedule.interval} ` : "jede ";
  const cadence = schedule.frequency === "täglich"
    ? `${interval}${schedule.interval > 1 ? "Tage" : "Tag"}`
    : schedule.frequency === "wöchentlich"
      ? `${interval}${schedule.interval > 1 ? "Wochen" : "Woche"}`
      : schedule.frequency === "monatlich"
        ? `${interval}${schedule.interval > 1 ? "Monate" : "Monat"}`
        : `${interval}${schedule.interval > 1 ? "Jahre" : "Jahr"}`;
  const days = schedule.weekdays.length > 0 ? ` · ${schedule.weekdays.join(", ")}` : "";
  const end = schedule.end === "am" && schedule.endDate
    ? ` · bis ${schedule.endDate}`
    : schedule.end === "nach" && schedule.occurrences > 0
      ? ` · ${schedule.occurrences} Termine`
      : "";
  const season = schedule.activeFromMonth && schedule.activeToMonth
    ? ` · gültig ${monthNames[schedule.activeFromMonth - 1]} bis ${monthNames[schedule.activeToMonth - 1]}`
    : "";
  const years = schedule.yearInterval && schedule.yearInterval > 1
    ? ` · alle ${schedule.yearInterval} Jahre`
    : schedule.activeFromMonth && schedule.activeToMonth
      ? " · jedes Jahr"
      : "";

  return `Serie: ${cadence}${days}${season}${years}${end}`;
}

function parseJobDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const germanDate = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (germanDate) {
    const [, day, month, year] = germanDate;
    const parsed = new Date(`${year}-${month}-${day}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function formatJobDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalizeReportDate(value: string) {
  const parsed = parseJobDate(value);
  return parsed ? formatJobDate(parsed) : value.trim();
}

function reportDedupeKey(report: ReportRecord) {
  return [
    report.objectId,
    report.title.trim().toLowerCase(),
    normalizeReportDate(report.date),
  ].join("|");
}

function reportCompletenessScore(report: ReportRecord) {
  const photoCount = report.checklistResults.reduce((sum, item) => sum + item.photos.length, 0);
  const noteCount = report.checklistResults.filter((item) => item.note.trim()).length;

  return [
    report.sentAt ? 100 : 0,
    report.customerComment.trim() ? 20 : 0,
    report.checklistResults.length * 4,
    photoCount * 3,
    noteCount * 2,
    report.summary.trim() ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);
}

function mergeReportPair(first: ReportRecord, second: ReportRecord) {
  const primary = reportCompletenessScore(second) >= reportCompletenessScore(first) ? second : first;
  const fallback = primary === first ? second : first;
  const checklistById = new Map<string, FieldTaskResult>();

  [...fallback.checklistResults, ...primary.checklistResults].forEach((item) => {
    const existing = checklistById.get(item.id);
    const existingScore = existing ? Number(existing.completed) + existing.photos.length + Number(Boolean(existing.note.trim())) : -1;
    const itemScore = Number(item.completed) + item.photos.length + Number(Boolean(item.note.trim()));
    if (!existing || itemScore >= existingScore) checklistById.set(item.id, item);
  });

  return {
    ...fallback,
    ...primary,
    checklistResults: Array.from(checklistById.values()),
    customerComment: primary.customerComment || fallback.customerComment,
    date: normalizeReportDate(primary.date),
    media: Array.from(new Set([...fallback.media, ...primary.media])),
    sentAt: primary.sentAt ?? fallback.sentAt,
  };
}

function dedupeReports(reports: ReportRecord[]) {
  const reportsByKey = new Map<string, ReportRecord>();

  reports.forEach((report) => {
    const key = reportDedupeKey(report);
    const existing = reportsByKey.get(key);
    reportsByKey.set(key, existing ? mergeReportPair(existing, report) : { ...report, date: normalizeReportDate(report.date) });
  });

  return Array.from(reportsByKey.values()).sort((first, second) => normalizeReportDate(second.date).localeCompare(normalizeReportDate(first.date)));
}

function addScheduleInterval(date: Date, schedule: JobSchedule) {
  const nextDate = new Date(date);
  const interval = Math.max(schedule.interval || 1, 1);

  if (schedule.frequency === "täglich") nextDate.setDate(nextDate.getDate() + interval);
  if (schedule.frequency === "wöchentlich") nextDate.setDate(nextDate.getDate() + interval * 7);
  if (schedule.frequency === "monatlich") nextDate.setMonth(nextDate.getMonth() + interval);
  if (schedule.frequency === "jährlich") nextDate.setFullYear(nextDate.getFullYear() + interval);

  return nextDate;
}

function alignDateToActiveSeason(date: Date, schedule: JobSchedule) {
  if (!schedule.activeFromMonth || !schedule.activeToMonth) return date;

  const nextDate = new Date(date);
  const currentMonth = nextDate.getMonth() + 1;
  const fromMonth = schedule.activeFromMonth;
  const toMonth = schedule.activeToMonth;

  if (fromMonth <= toMonth && (currentMonth < fromMonth || currentMonth > toMonth)) {
    const year = currentMonth > toMonth ? nextDate.getFullYear() + Math.max(schedule.yearInterval || 1, 1) : nextDate.getFullYear();
    return new Date(`${year}-${String(fromMonth).padStart(2, "0")}-01T12:00:00`);
  }

  return nextDate;
}

const weekdayToJsDay: Record<string, number> = {
  Mo: 1,
  Di: 2,
  Mi: 3,
  Do: 4,
  Fr: 5,
  Sa: 6,
  So: 0,
};

function startOfWeek(date: Date) {
  const monday = new Date(date);
  const day = monday.getDay() || 7;
  monday.setDate(monday.getDate() - day + 1);
  return new Date(`${formatJobDate(monday)}T12:00:00`);
}

function dateInActiveSeason(date: Date, schedule: JobSchedule) {
  if (!schedule.activeFromMonth || !schedule.activeToMonth) return true;

  const month = date.getMonth() + 1;
  const fromMonth = schedule.activeFromMonth;
  const toMonth = schedule.activeToMonth;
  return fromMonth <= toMonth
    ? month >= fromMonth && month <= toMonth
    : month >= fromMonth || month <= toMonth;
}

function dateInYearRhythm(date: Date, firstDate: Date, schedule: JobSchedule) {
  const yearInterval = Math.max(schedule.yearInterval || 1, 1);
  return (date.getFullYear() - firstDate.getFullYear()) % yearInterval === 0;
}

function weeklySeriesDates(master: JobRecord, reports: ReportRecord[]) {
  const firstDate = parseJobDate(master.dueDate);
  if (!firstDate) return [];

  const selectedWeekdays = master.schedule.weekdays.length > 0
    ? master.schedule.weekdays
    : ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const selectedDays = new Set(selectedWeekdays.map((day) => weekdayToJsDay[day]).filter((day) => day !== undefined));
  const completedDates = new Set(
    reports
      .filter((report) => report.jobId === master.id || report.jobId.startsWith(`${master.id}-OCC-`))
      .map((report) => report.date),
  );
  const excludedDates = new Set(master.seriesExcludedDates ?? []);
  const dates: string[] = [];
  const startWeek = startOfWeek(firstDate);
  const endDate = master.schedule.end === "am" && master.schedule.endDate ? parseJobDate(master.schedule.endDate) : null;
  const openEndHorizon = new Date();
  openEndHorizon.setMonth(openEndHorizon.getMonth() + 6);
  const lastDate = endDate ?? (master.schedule.end === "nie" ? openEndHorizon : null);
  const candidate = new Date(firstDate);
  let occurrenceCount = 0;
  let guard = 0;

  while (guard < 900) {
    guard += 1;
    if (lastDate && candidate > lastDate) break;
    if (master.schedule.end === "nach" && master.schedule.occurrences > 0 && occurrenceCount >= master.schedule.occurrences) break;

    const candidateWeek = startOfWeek(candidate);
    const weekDiff = Math.floor((candidateWeek.getTime() - startWeek.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const isIntervalWeek = weekDiff >= 0 && weekDiff % Math.max(master.schedule.interval || 1, 1) === 0;
    const dateValue = formatJobDate(candidate);

    if (
      candidate >= firstDate
      && isIntervalWeek
      && selectedDays.has(candidate.getDay())
      && dateInActiveSeason(candidate, master.schedule)
      && dateInYearRhythm(candidate, firstDate, master.schedule)
    ) {
      occurrenceCount += 1;
      if (!completedDates.has(dateValue) && !excludedDates.has(dateValue)) {
        dates.push(dateValue);
      }
    }

    candidate.setDate(candidate.getDate() + 1);
  }

  return dates;
}

function nextSeriesDueDate(job: JobRecord) {
  if (job.schedule.type !== "serie" || job.seriesMasterId) return null;

  const currentDate = parseJobDate(job.dueDate);
  if (!currentDate) return null;

  const nextDate = alignDateToActiveSeason(addScheduleInterval(currentDate, job.schedule), job.schedule);
  if (job.schedule.end === "am" && job.schedule.endDate) {
    const endDate = parseJobDate(job.schedule.endDate);
    if (endDate && nextDate > endDate) return null;
  }

  if (job.schedule.end === "nach" && job.schedule.occurrences <= 1) return null;

  return formatJobDate(nextDate);
}

function seriesOccurrenceId(masterId: string, date: string) {
  return `${masterId}-OCC-${date.replaceAll("-", "")}`;
}

function isSeriesMaster(job: JobRecord) {
  return job.schedule.type === "serie" && !job.seriesMasterId;
}

function openSeriesDates(master: JobRecord, reports: ReportRecord[]) {
  if (!isSeriesMaster(master)) return [];
  if (master.schedule.frequency === "wöchentlich" && master.schedule.weekdays.length > 0) {
    return weeklySeriesDates(master, reports);
  }

  const firstDate = parseJobDate(master.dueDate);
  if (!firstDate) return [];

  const completedDates = new Set(
    reports
      .filter((report) => report.jobId === master.id || report.jobId.startsWith(`${master.id}-OCC-`))
      .map((report) => report.date),
  );
  const excludedDates = new Set(master.seriesExcludedDates ?? []);
  const dates: string[] = [];
  const openEndHorizon = new Date();
  openEndHorizon.setMonth(openEndHorizon.getMonth() + 6);
  let nextDate = ["erledigt", "abgerechnet"].includes(master.status)
    ? addScheduleInterval(firstDate, master.schedule)
    : new Date(firstDate);
  let guard = 0;
  let occurrenceCount = 0;

  while (guard < 80) {
    guard += 1;
    nextDate = alignDateToActiveSeason(nextDate, master.schedule);
    const dateValue = formatJobDate(nextDate);
    const endDate = master.schedule.end === "am" && master.schedule.endDate ? parseJobDate(master.schedule.endDate) : null;

    if (endDate && nextDate > endDate) break;
    if (master.schedule.end === "nie" && nextDate > openEndHorizon) break;
    occurrenceCount += 1;
    if (master.schedule.end === "nach" && master.schedule.occurrences > 0 && occurrenceCount > master.schedule.occurrences) break;

    if (!completedDates.has(dateValue) && !excludedDates.has(dateValue)) {
      dates.push(dateValue);
    }
    nextDate = addScheduleInterval(nextDate, master.schedule);
  }

  return dates;
}

function makeSeriesOccurrence(master: JobRecord, date: string): JobRecord {
  return {
    ...master,
    id: seriesOccurrenceId(master.id, date),
    seriesMasterId: master.id,
    seriesOccurrenceDate: date,
    seriesExcludedDates: undefined,
    dueDate: date,
    status: "geplant",
    schedule: {
      type: "einmalig",
      frequency: master.schedule.frequency,
      interval: 1,
      weekdays: [],
      end: "nie",
      endDate: "",
      occurrences: 0,
    },
    workMinutes: 0,
  };
}

function syncSeriesOccurrenceFromMaster(master: JobRecord, occurrence: JobRecord, reports: ReportRecord[]) {
  const hasReport = reports.some((report) => report.jobId === occurrence.id);
  if (hasReport || ["erledigt", "abgerechnet", "storniert"].includes(occurrence.status)) return occurrence;

  return {
    ...occurrence,
    title: master.title,
    objectId: master.objectId,
    customerId: master.customerId,
    type: master.type,
    priority: master.priority,
    assignedTo: master.assignedTo,
    description: master.description,
    internalNotes: master.internalNotes,
    checklist: master.checklist,
    serviceIds: master.serviceIds,
    customService: master.customService,
    billable: master.billable,
    material: master.material,
  };
}

function ensureSeriesOccurrences(jobs: JobRecord[], reports: ReportRecord[]) {
  let changed = false;
  const existingIds = new Set(jobs.map((job) => job.id));
  const existingOccurrenceDates = new Map<string, Set<string>>();
  const seriesMasters = new Map(jobs.filter(isSeriesMaster).map((job) => [job.id, job]));

  jobs.forEach((job) => {
    if (!job.seriesMasterId || !job.seriesOccurrenceDate) return;
    const dates = existingOccurrenceDates.get(job.seriesMasterId) ?? new Set<string>();
    dates.add(job.seriesOccurrenceDate);
    existingOccurrenceDates.set(job.seriesMasterId, dates);
  });

  const nextJobs = jobs.map((job) => {
    if (job.seriesMasterId) {
      const master = seriesMasters.get(job.seriesMasterId);
      if (!master) return job;
      const synced = syncSeriesOccurrenceFromMaster(master, job, reports);
      if (synced !== job) changed = true;
      return synced;
    }
    if (!isSeriesMaster(job)) return job;
    const openDates = openSeriesDates(job, reports);
    const hasOpenOccurrence = openDates.some((date) => !existingOccurrenceDates.get(job.id)?.has(date));

    if (hasOpenOccurrence) changed = true;
    return job;
  });

  nextJobs
    .filter(isSeriesMaster)
    .forEach((master) => {
      openSeriesDates(master, reports).forEach((date) => {
        const id = seriesOccurrenceId(master.id, date);
        if (existingIds.has(id) || existingOccurrenceDates.get(master.id)?.has(date)) return;
        nextJobs.push(makeSeriesOccurrence(master, date));
        existingIds.add(id);
        changed = true;
      });
    });

  return changed ? nextJobs : jobs;
}

function visibleOperationalJobs(jobs: JobRecord[]) {
  const mastersWithOccurrences = new Set(jobs.filter((job) => job.seriesMasterId).map((job) => job.seriesMasterId));
  return jobs.filter((job) => !isSeriesMaster(job) || !mastersWithOccurrences.has(job.id));
}

function nextOperationalJobs(jobs: JobRecord[]) {
  const operational = visibleOperationalJobs(jobs);
  const nextBySeries = new Map<string, JobRecord>();

  sortedByDueDate(operational)
    .filter((job) => job.seriesMasterId && !["erledigt", "abgerechnet", "storniert"].includes(job.status))
    .forEach((job) => {
      if (!job.seriesMasterId || nextBySeries.has(job.seriesMasterId)) return;
      nextBySeries.set(job.seriesMasterId, job);
    });

  return operational.filter((job) => !job.seriesMasterId || nextBySeries.get(job.seriesMasterId)?.id === job.id);
}

function recurringJobHint(job: JobRecord, allJobs: JobRecord[]) {
  if (!job.seriesMasterId) return "";
  const master = allJobs.find((item) => item.id === job.seriesMasterId);
  return master ? `Serienauftrag · ${scheduleLabel(master.schedule)}` : "Serienauftrag";
}

function sortedByDueDate(jobs: JobRecord[]) {
  return [...jobs].sort((first, second) => {
    const firstDate = parseJobDate(first.dueDate)?.getTime() ?? 0;
    const secondDate = parseJobDate(second.dueDate)?.getTime() ?? 0;
    return firstDate - secondDate;
  });
}

function readableJobStatus(status: JobRecord["status"]) {
  if (status === "geplant") return "offen";
  if (status === "in Arbeit") return "in Bearbeitung";
  return status;
}

function seriesSummary(master: JobRecord, occurrences: JobRecord[], reports: ReportRecord[]) {
  const completedDates = [
    ...occurrences.filter((job) => ["erledigt", "abgerechnet"].includes(job.status)).map((job) => job.dueDate),
    ...reports.filter((report) => report.jobId === master.id || report.jobId.startsWith(`${master.id}-OCC-`)).map((report) => report.date),
    ...(["erledigt", "abgerechnet"].includes(master.status) ? [master.dueDate] : []),
  ]
    .filter(Boolean)
    .sort((first, second) => (parseJobDate(second)?.getTime() ?? 0) - (parseJobDate(first)?.getTime() ?? 0));
  const nextJob = sortedByDueDate(occurrences).find((job) => !["erledigt", "abgerechnet", "storniert"].includes(job.status));

  return {
    lastDone: completedDates[0] ?? "noch keiner",
    nextDate: nextJob?.dueDate ?? "kein offener",
    nextStatus: nextJob ? readableJobStatus(nextJob.status) : "abgeschlossen",
    rhythm: scheduleLabel(master.schedule).replace(/^Serie:\s*/, ""),
  };
}

function nextRelevantJobDate(job: JobRecord, occurrences: JobRecord[]) {
  const nextOccurrence = sortedByDueDate(occurrences).find((item) => !["erledigt", "abgerechnet", "storniert"].includes(item.status));
  return parseJobDate(nextOccurrence?.dueDate ?? job.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

function jobSortGroup(job: JobRecord, occurrences: JobRecord[]) {
  const statuses = occurrences.length > 0 ? occurrences.map((item) => item.status) : [job.status];
  if (statuses.some((status) => status === "in Arbeit")) return 0;
  if (statuses.some((status) => status === "geplant" || status === "pausiert")) return 1;
  if (statuses.some((status) => status === "erledigt")) return 2;
  if (statuses.some((status) => status === "abgerechnet")) return 3;
  return 4;
}

function jobMatchesStatusFilter(job: JobRecord, occurrences: JobRecord[], statusFilter: string) {
  if (statusFilter === "alle") return true;
  return occurrences.length > 0
    ? occurrences.some((occurrence) => occurrence.status === statusFilter)
    : job.status === statusFilter;
}

type HomePageProps = {
  initialSection?: Section;
  portalOnly?: boolean;
};

export default function HomePage({ initialSection = "dashboard", portalOnly = false }: HomePageProps = {}) {
  const [section, setSection] = useState<Section>(initialSection);
  const [language, setLanguage] = useState<Language>("de");
  const [theme, setTheme] = useState<Theme>("light");
  const [query, setQuery] = useState("");
  const [selectedObjectId, setSelectedObjectId] = useState("OBJ-1001");
  const [objects, setObjects] = useState<ObjectRecord[]>(seedObjects);
  const [appStorageReady, setAppStorageReady] = useState(false);
  const [supabaseSyncDisabled, setSupabaseSyncDisabled] = useState(false);
  const [customers, setCustomers] = useState(seedCustomers);
  const [jobs, setJobs] = useState(seedJobs);
  const [reports, setReports] = useState(seedReports);
  const [billing] = useState(seedBilling);
  const [services, setServices] = useState(seedServices);
  const [servicePackages, setServicePackages] = useState(seedPackages);
  const [portalMessages, setPortalMessages] = useState<PortalMessageRecord[]>([]);
  const [portalCustomerId, setPortalCustomerId] = useState("");
  const [fieldNotes, setFieldNotes] = useState<Record<string, string>>({});
  const [fieldProgress, setFieldProgress] = useState<Record<string, Record<string, FieldTaskProgress>>>({});
  const [modal, setModal] = useState<Modal>(null);
  const [editingObjectId, setEditingObjectId] = useState<string | null>(null);
  const [objectEditorOpen, setObjectEditorOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editingFieldReportId, setEditingFieldReportId] = useState<string | null>(null);
  const [completedReportPromptId, setCompletedReportPromptId] = useState<string | null>(null);
  const [sendPreviewReportId, setSendPreviewReportId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [recordNotice, setRecordNotice] = useState("");
  const [newObject, setNewObject] = useState<NewObjectFormState>(emptyObjectForm());
  const [newCustomer, setNewCustomer] = useState<CustomerFormState>(emptyCustomerForm());
  const [newJob, setNewJob] = useState<NewJobFormState>(emptyJobForm());
  const skipNextAutoSaveRef = useRef(false);
  const remoteSyncRunningRef = useRef(false);

  function applySnapshot(snapshot: AppSnapshot) {
    const normalizedReports = dedupeReports(snapshot.reports);
    const normalizedJobs = ensureSeriesOccurrences(snapshot.jobs, normalizedReports);
    setObjects(snapshot.objects);
    setCustomers(snapshot.customers);
    setJobs(normalizedJobs);
    setReports(normalizedReports);
    setServices(snapshot.services);
    setServicePackages(snapshot.packages);
    setPortalMessages(snapshot.portalMessages ?? []);
    setFieldNotes(snapshot.fieldNotes ?? {});
    setFieldProgress(snapshot.fieldProgress);
    setActiveJobId(snapshot.activeJobId && normalizedJobs.some((job) => job.id === snapshot.activeJobId) ? snapshot.activeJobId : null);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadSnapshot() {
      const localSnapshot = readLocalSnapshot();
      if (!cancelled) applySnapshot(localSnapshot);

      try {
        const remoteSnapshot = await loadSupabaseSnapshot();
        if (cancelled) return;

        if (remoteSnapshot) {
          skipNextAutoSaveRef.current = true;
          const mergedSnapshot = mergeSnapshots(remoteSnapshot, localSnapshot);
          if (snapshotWeight(mergedSnapshot) >= snapshotWeight(remoteSnapshot)) {
            applySnapshot(mergedSnapshot);
            persistLocalSnapshot(mergedSnapshot);
            if (JSON.stringify(mergedSnapshot) !== JSON.stringify(remoteSnapshot)) {
              await saveSupabaseSnapshot(mergedSnapshot);
            }
          } else {
            applySnapshot(remoteSnapshot);
            persistLocalSnapshot(remoteSnapshot);
          }
        } else {
          await saveSupabaseSnapshot(localSnapshot);
        }
      } catch (error) {
        console.warn("Supabase-Synchronisation ist nicht verfügbar. Lokaler Speicher bleibt aktiv.", error);
        if (!cancelled) setSupabaseSyncDisabled(true);
      } finally {
        if (!cancelled) setAppStorageReady(true);
      }
    }

    void loadSnapshot();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!appStorageReady) return;
    const timeoutId = window.setTimeout(() => {
      setJobs((current) => ensureSeriesOccurrences(current, reports));
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [appStorageReady, reports]);

  useEffect(() => {
    if (!appStorageReady) return;
    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false;
      return;
    }
    const snapshot: AppSnapshot = {
      activeJobId,
      customers,
      fieldNotes,
      fieldProgress,
      jobs,
      objects,
      packages: servicePackages,
      portalMessages,
      reports,
      services,
      updatedAt: new Date().toISOString(),
    };

    try {
      persistLocalSnapshot(snapshot);
    } catch (error) {
      console.warn("App-Daten konnten nicht lokal gespeichert werden.", error);
    }

    if (supabaseSyncDisabled) return;
    const timeoutId = window.setTimeout(() => {
      void saveSupabaseSnapshot(snapshot).catch((error) => {
        console.warn("App-Daten konnten nicht nach Supabase synchronisiert werden.", error);
        setSupabaseSyncDisabled(true);
      });
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [activeJobId, appStorageReady, customers, fieldNotes, fieldProgress, jobs, objects, portalMessages, reports, servicePackages, services, supabaseSyncDisabled]);

  const currentSnapshot = useCallback((overrides: Partial<AppSnapshot> = {}): AppSnapshot => ({
    activeJobId,
    customers,
    fieldNotes,
    fieldProgress,
    jobs,
    objects,
    packages: servicePackages,
    portalMessages,
    reports,
    services,
    updatedAt: new Date().toISOString(),
    ...overrides,
  }), [activeJobId, customers, fieldNotes, fieldProgress, jobs, objects, portalMessages, reports, servicePackages, services]);

  const syncRemoteSnapshot = useCallback(async () => {
    if (!appStorageReady || supabaseSyncDisabled || remoteSyncRunningRef.current) return;
    remoteSyncRunningRef.current = true;

    try {
      const remoteSnapshot = await loadSupabaseSnapshot();
      if (!remoteSnapshot) return;

      const localSnapshot = currentSnapshot();
      const remoteTime = Date.parse(remoteSnapshot.updatedAt ?? "");
      const localTime = Date.parse(localSnapshot.updatedAt ?? "");
      const remoteHasNewerData = Number.isFinite(remoteTime) && (!Number.isFinite(localTime) || remoteTime > localTime);
      const remoteHasMoreData = snapshotWeight(remoteSnapshot) > snapshotWeight(localSnapshot);

      if (!remoteHasNewerData && !remoteHasMoreData) return;

      const mergedSnapshot = mergeSnapshots(remoteSnapshot, localSnapshot);
      skipNextAutoSaveRef.current = true;
      applySnapshot(mergedSnapshot);
      persistLocalSnapshot(mergedSnapshot);

      if (JSON.stringify(mergedSnapshot) !== JSON.stringify(remoteSnapshot)) {
        await saveSupabaseSnapshot(mergedSnapshot);
      }
    } catch (error) {
      console.warn("App-Daten konnten nicht automatisch aktualisiert werden.", error);
    } finally {
      remoteSyncRunningRef.current = false;
    }
  }, [appStorageReady, currentSnapshot, supabaseSyncDisabled]);

  useEffect(() => {
    if (!appStorageReady || supabaseSyncDisabled) return;

    const intervalId = window.setInterval(() => {
      void syncRemoteSnapshot();
    }, 15000);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void syncRemoteSnapshot();
      }
    }

    window.addEventListener("focus", syncRemoteSnapshot);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", syncRemoteSnapshot);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [appStorageReady, supabaseSyncDisabled, syncRemoteSnapshot]);

  function persistSnapshotNow(overrides: Partial<AppSnapshot> = {}) {
    const snapshot = currentSnapshot(overrides);
    try {
      persistLocalSnapshot(snapshot);
    } catch (error) {
      console.warn("App-Daten konnten nicht sofort lokal gespeichert werden.", error);
    }

    if (supabaseSyncDisabled) return;
    void saveSupabaseSnapshot(snapshot).catch((error) => {
      console.warn("App-Daten konnten nicht sofort nach Supabase synchronisiert werden.", error);
      setSupabaseSyncDisabled(true);
    });
  }

  const t = labels[language];
  const activeObjects = objects.filter((object) => !object.archived);
  const archivedObjects = objects.filter((object) => object.archived);
  const activeCustomers = customers.filter((customer) => !customer.archived);
  const archivedCustomers = customers.filter((customer) => customer.archived);
  const upcomingOperationalJobs = nextOperationalJobs(jobs);
  const selectedObject = activeObjects.find((object) => object.id === selectedObjectId) ?? activeObjects[0] ?? objects[0];
  const editingObject = objects.find((object) => object.id === editingObjectId);
  const filteredObjects = activeObjects.filter((object) =>
    [object.name, object.owner, object.address, object.region, object.carePackage]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const currentFieldJobId = activeJobId
    ?? upcomingOperationalJobs.find((job) => job.status === "in Arbeit")?.id
    ?? upcomingOperationalJobs.find((job) => !["erledigt", "abgerechnet", "storniert"].includes(job.status))?.id
    ?? "";
  const dashboardStats: Array<{ label: string; value: number; section: Section }> = [
    { label: "aktive Objekte", value: activeObjects.length, section: "objects" },
    { label: "offene Einsätze", value: upcomingOperationalJobs.filter((job) => !["erledigt", "abgerechnet", "storniert"].includes(job.status)).length, section: "planning" },
    { label: "Berichte", value: reports.length, section: "reports" },
    { label: "abrechenbar", value: billing.filter((item) => item.status === "abrechenbar").length, section: "billing" },
  ];

  function openCreateObject() {
    setEditingObjectId(null);
    setNewObject(emptyObjectForm());
    setObjectEditorOpen(true);
    setSection("objects");
  }

  function openEditObject(object: ObjectRecord) {
    setEditingObjectId(object.id);
    setSelectedObjectId(object.id);
    setNewObject(objectToForm(object));
    setObjectEditorOpen(true);
    setSection("objects");
  }

  function closeObjectEditor() {
    setObjectEditorOpen(false);
    setEditingObjectId(null);
    setNewObject(emptyObjectForm());
  }

  function saveObject() {
    const id = editingObjectId ?? `OBJ-${1000 + objects.length + 1}`;
    const existingObject = objects.find((object) => object.id === editingObjectId);
    const saved = { ...formToObject(newObject, id), archived: existingObject?.archived };
    const nextObjects = editingObjectId
      ? objects.map((object) => (object.id === editingObjectId ? saved : object))
      : [saved, ...objects];
    const nextCustomers = customers.map((customer) => {
      const withoutObject = customer.objects.filter((objectId) => objectId !== id);
      return customer.id === saved.ownerCustomerId
        ? { ...customer, objects: [...withoutObject, id] }
        : { ...customer, objects: withoutObject };
    });

    setObjects(nextObjects);
    setCustomers(nextCustomers);
    persistSnapshotNow({ customers: nextCustomers, objects: nextObjects });
    setSelectedObjectId(id);
    setSection("objects");
    setEditingObjectId(null);
    setObjectEditorOpen(false);
  }

  function archiveObject(object: ObjectRecord) {
    const openJobs = jobs.filter((job) => job.objectId === object.id && !["erledigt", "abgerechnet", "storniert"].includes(job.status));
    if (openJobs.length > 0) {
      setRecordNotice(`Objekt "${object.name}" kann nicht archiviert werden: offene Einsätze ${openJobs.map((job) => job.title).join(", ")}.`);
      return;
    }

    setObjects((current) => current.map((item) => (item.id === object.id ? { ...item, archived: true } : item)));
    setCustomers((current) => current.map((customer) => ({ ...customer, objects: customer.objects.filter((id) => id !== object.id) })));
    setSelectedObjectId(activeObjects.find((item) => item.id !== object.id)?.id ?? "");
    setRecordNotice(`Objekt "${object.name}" wurde archiviert.`);
  }

  function deleteObject(object: ObjectRecord) {
    if (!object.archived) return;
    setObjects((current) => current.filter((item) => item.id !== object.id));
    setCustomers((current) => current.map((customer) => ({ ...customer, objects: customer.objects.filter((id) => id !== object.id) })));
    setRecordNotice(`Archiviertes Objekt "${object.name}" wurde endgültig gelöscht.`);
  }

  function restoreObject(object: ObjectRecord) {
    setObjects((current) => current.map((item) => (item.id === object.id ? { ...item, archived: false } : item)));
    setCustomers((current) =>
      current.map((customer) =>
        customer.id === object.ownerCustomerId && !customer.archived && !customer.objects.includes(object.id)
          ? { ...customer, objects: [...customer.objects, object.id] }
          : customer,
      ),
    );
    setSelectedObjectId(object.id);
    setRecordNotice(`Objekt "${object.name}" wurde wieder aktiviert.`);
  }

  function openCreateCustomer() {
    setEditingCustomerId(null);
    setNewCustomer(emptyCustomerForm());
    setModal("customer");
  }

  function openEditCustomer(customer: CustomerRecord) {
    setEditingCustomerId(customer.id);
    setNewCustomer(customerToForm(customer));
    setModal("customer");
  }

  function saveCustomer() {
    const id = editingCustomerId ?? `CUS-${customers.length + 1}`;
    const existingCustomer = customers.find((customer) => customer.id === editingCustomerId);
    const saved = { ...formToCustomer(newCustomer, id), archived: existingCustomer?.archived };

    setCustomers((current) =>
      editingCustomerId
        ? current.map((customer) => (customer.id === editingCustomerId ? saved : customer))
        : [saved, ...current],
    );
    setObjects((current) =>
      current.map((object) => {
        if (saved.objects.includes(object.id)) {
          const billingAddress = object.billingAddressMode === "Eigentümeradresse" ? saved.address : object.billingAddress;

          return {
            ...object,
            ownerCustomerId: saved.id,
            owner: saved.name,
            ownerEmail: saved.email,
            ownerPhone: saved.phone,
            ownerAddress: saved.address,
            billingAddress,
          };
        }

        return object.ownerCustomerId === saved.id ? { ...object, ownerCustomerId: "" } : object;
      }),
    );
    setEditingCustomerId(null);
    setSection("customers");
    setModal(null);
  }

  function archiveCustomer(customer: CustomerRecord) {
    const assignedObjects = activeObjects.filter((object) => customer.objects.includes(object.id));
    if (assignedObjects.length > 0) {
      setRecordNotice(`Kunde "${customer.name}" kann nicht archiviert werden: noch zugeordnete Objekte ${assignedObjects.map((object) => object.name).join(", ")}.`);
      return;
    }

    setCustomers((current) => current.map((item) => (item.id === customer.id ? { ...item, archived: true } : item)));
    setRecordNotice(`Kunde "${customer.name}" wurde archiviert.`);
  }

  function deleteCustomer(customer: CustomerRecord) {
    if (!customer.archived) return;
    setCustomers((current) => current.filter((item) => item.id !== customer.id));
    setObjects((current) => current.map((object) => (object.ownerCustomerId === customer.id ? { ...object, ownerCustomerId: "" } : object)));
    setRecordNotice(`Archivierter Kunde "${customer.name}" wurde endgültig gelöscht.`);
  }

  function restoreCustomer(customer: CustomerRecord) {
    setCustomers((current) => current.map((item) => (item.id === customer.id ? { ...item, archived: false } : item)));
    setRecordNotice(`Kunde "${customer.name}" wurde wieder aktiviert.`);
  }

  function openCreateJob() {
    setEditingJobId(null);
    setNewJob(emptyJobForm());
    setModal("job");
  }

  function openEditJob(job: JobRecord) {
    setEditingJobId(job.id);
    setSelectedObjectId(job.objectId);
    setNewJob(jobToForm(job));
    setModal("job");
  }

  function cancelJob(job: JobRecord) {
    const nextJobs = jobs.map((item) => (
      item.id === job.id || (isSeriesMaster(job) && item.seriesMasterId === job.id)
        ? { ...item, status: "storniert" as const }
        : item
    ));
    setJobs(nextJobs);
    persistSnapshotNow({ jobs: nextJobs });
  }

  function restoreJob(job: JobRecord) {
    const nextJobs = jobs.map((item) => (
      item.id === job.id ? { ...item, status: "geplant" as const } : item
    ));
    setJobs(nextJobs);
    persistSnapshotNow({ jobs: nextJobs });
  }

  function saveJob() {
    const id = editingJobId ?? `JOB-${2410 + jobs.length}`;
    const existingJob = jobs.find((job) => job.id === editingJobId);
    const customServiceName = newJob.customServiceName.trim();
    const customService: ServiceItem | null = customServiceName
      ? {
          id: existingJob?.customService?.id ?? `JOB-SVC-${id}`,
          name: customServiceName,
          category: newJob.customServiceCategory.trim() || "Sonderleistung",
          unit: newJob.customServiceUnit.trim() || "Einsatz",
          price: newJob.customServicePrice.trim() || "0",
          currency: newJob.customServiceCurrency.trim() || "SEK",
          description: newJob.customServiceDescription.trim() || "Individuelle Leistung zum Auftrag.",
          checklist: newJob.customServiceChecklist,
        }
      : null;
    const selectedServiceTasks = newJob.serviceIds
      .map((serviceId) => services.find((service) => service.id === serviceId))
      .filter(Boolean)
      .flatMap((service) => serviceToFieldTasks(service as ServiceItem));
    const customServiceTasks = customService ? serviceToFieldTasks(customService) : [];
    const checklist = [...selectedServiceTasks, ...customServiceTasks].map((task) => task.title);
    const saved: JobRecord = {
      id,
      seriesMasterId: existingJob?.seriesMasterId,
      seriesOccurrenceDate: existingJob?.seriesOccurrenceDate,
      seriesExcludedDates: existingJob?.seriesExcludedDates,
      title: newJob.title.trim() || "Neuer Auftrag",
      objectId: selectedObject.id,
      customerId: selectedObject.ownerCustomerId || customers.find((customer) => customer.name === selectedObject.owner)?.id || "CUS-1",
      type: newJob.type.trim() || customService?.name || "Hauskontrolle",
      status: existingJob?.status ?? "geplant",
      priority: newJob.priority,
      dueDate: newJob.dueDate,
      assignedTo: newJob.assignedTo.trim() || "nicht zugewiesen",
      description: newJob.description.trim() || "Beschreibung ergänzen.",
      internalNotes: newJob.internalNotes.trim() || "Keine internen Notizen.",
      checklist: checklist.length > 0 ? checklist : existingJob?.checklist ?? ["Auftrag dokumentieren"],
      serviceIds: newJob.serviceIds,
      customService,
      billable: existingJob?.billable ?? true,
      material: existingJob?.material ?? "-",
      workMinutes: existingJob?.workMinutes ?? 0,
      schedule: {
        type: newJob.scheduleType,
        frequency: newJob.scheduleFrequency,
        interval: Math.max(Number(newJob.scheduleInterval) || 1, 1),
        weekdays: newJob.scheduleFrequency === "wöchentlich" ? newJob.scheduleWeekdays : [],
        end: newJob.scheduleEnd,
        endDate: newJob.scheduleEnd === "am" ? newJob.scheduleEndDate : "",
        occurrences: newJob.scheduleEnd === "nach" ? Math.max(Number(newJob.scheduleOccurrences) || 1, 1) : 0,
        activeFromMonth: newJob.scheduleActiveFromMonth ? Number(newJob.scheduleActiveFromMonth) : undefined,
        activeToMonth: newJob.scheduleActiveToMonth ? Number(newJob.scheduleActiveToMonth) : undefined,
        yearInterval: Math.max(Number(newJob.scheduleYearInterval) || 1, 1),
      },
    };

    setJobs((current) => {
      const reportJobIds = new Set(reports.map((report) => report.jobId));
      const withoutOldOccurrences = editingJobId && isSeriesMaster(saved)
        ? current.filter((job) => job.seriesMasterId !== editingJobId || reportJobIds.has(job.id) || job.status !== "geplant")
        : current;
      const nextJobs = editingJobId
        ? withoutOldOccurrences.map((job) => (job.id === editingJobId ? saved : job))
        : [saved, ...withoutOldOccurrences];

      return ensureSeriesOccurrences(nextJobs, reports);
    });
    setEditingJobId(null);
    setSection("jobs");
    setModal(null);
  }

  function startJob(job: JobRecord) {
    const nextJobs = jobs.map((item) => (item.id === job.id ? { ...item, status: "in Arbeit" as const } : item));
    setJobs(nextJobs);
    setActiveJobId(job.id);
    setEditingFieldReportId(null);
    persistSnapshotNow({ activeJobId: job.id, jobs: nextJobs });
    setSelectedObjectId(job.objectId);
    setSection("field");
  }

  function editReportInField(report: ReportRecord) {
    const job = jobs.find((item) => item.id === report.jobId);
    if (!job) return;

    const reportProgress = Object.fromEntries(
      report.checklistResults.map((item) => [
        item.id,
        {
          completed: item.completed,
          minutes: String(item.minutes || ""),
          note: item.note,
          photos: item.photos,
        },
      ]),
    ) as Record<string, FieldTaskProgress>;
    const nextFieldProgress = { ...fieldProgress, [job.id]: reportProgress };
    const nextFieldNotes = { ...fieldNotes, [job.id]: reportSummaryNote(report.summary) };

    setFieldProgress(nextFieldProgress);
    setFieldNotes(nextFieldNotes);
    setActiveJobId(job.id);
    setEditingFieldReportId(report.id);
    persistSnapshotNow({ activeJobId: job.id, fieldNotes: nextFieldNotes, fieldProgress: nextFieldProgress });
    setSelectedObjectId(job.objectId);
    setSection("field");
  }

  function clearActiveJob() {
    const nextJobs = jobs.map((item) => (
      item.id === activeJobId && item.status === "in Arbeit" ? { ...item, status: "geplant" as const } : item
    ));
    setJobs(nextJobs);
    setActiveJobId(null);
    setEditingFieldReportId(null);
    persistSnapshotNow({ activeJobId: null, jobs: nextJobs });
  }

  function completeJob(job: JobRecord, checklistResults: FieldTaskResult[], fieldNote: string) {
    const existingReport = editingFieldReportId
      ? reports.find((report) => report.id === editingFieldReportId)
      : reports.find((report) => report.jobId === job.id && report.date === job.dueDate);
    const isReportEdit = Boolean(editingFieldReportId && existingReport);
    const nextDueDate = isReportEdit ? null : nextSeriesDueDate(job);
    const normalizedResults = checklistResults.map((item) => ({
      ...item,
      minutes: item.completed ? item.minutes : 0,
    }));
    const workMinutes = normalizedResults.reduce((sum, item) => sum + item.minutes, 0);
    const completedCount = normalizedResults.filter((item) => item.completed).length;
    const photoCount = normalizedResults.reduce((sum, item) => sum + item.photos.length, 0);
    const reportId = existingReport?.id ?? `REP-${Date.now()}`;
    const summary = `${completedCount} von ${checklistResults.length} Checklistenpunkten ausgeführt.${fieldNote.trim() ? ` ${fieldNote.trim()}` : ""}`;
    const nextSchedule = job.schedule.type === "serie" && nextDueDate && job.schedule.end === "nach"
      ? { ...job.schedule, occurrences: Math.max(job.schedule.occurrences - 1, 0) }
      : job.schedule;
    const nextJobStatus = isReportEdit
      ? job.status
      : job.schedule.type === "serie" && nextDueDate ? "geplant" as const : "erledigt" as const;
    const nextJobs = jobs.map((item) => (
      item.id === job.id
        ? { ...item, dueDate: nextDueDate ?? item.dueDate, schedule: nextSchedule, status: nextJobStatus, workMinutes }
        : item
    ));
    const savedReport: ReportRecord = {
      id: reportId,
      jobId: job.id,
      objectId: job.objectId,
      title: job.title,
      date: existingReport?.date ?? job.dueDate,
      visibleToCustomer: existingReport?.visibleToCustomer ?? true,
      summary,
      internalNotes: job.internalNotes,
      media: [`${photoCount} Fotos`, `${workMinutes} Minuten dokumentiert`],
      checklistResults: normalizedResults,
      customerComment: existingReport?.customerComment ?? "",
      sentAt: existingReport?.sentAt,
    };
    const nextReports = dedupeReports([
      savedReport,
      ...reports.filter((report) => report.id !== reportId && (job.schedule.type === "serie" || report.jobId !== job.id)),
    ]);
    const nextObjects = objects.map((object) => (object.id === job.objectId ? { ...object, lastVisit: job.dueDate } : object));
    const nextFieldProgress = { ...fieldProgress };
    const nextFieldNotes = { ...fieldNotes };
    delete nextFieldProgress[job.id];
    delete nextFieldNotes[job.id];

    setJobs(nextJobs);
    setReports(nextReports);
    setObjects(nextObjects);
    setFieldNotes(nextFieldNotes);
    setFieldProgress(nextFieldProgress);
    setActiveJobId(null);
    setEditingFieldReportId(null);
    persistSnapshotNow({
      activeJobId: null,
      fieldNotes: nextFieldNotes,
      fieldProgress: nextFieldProgress,
      jobs: nextJobs,
      objects: nextObjects,
      reports: nextReports,
    });
    setSelectedObjectId(job.objectId);
    setSection("objects");
    if (!isReportEdit) setCompletedReportPromptId(reportId);
  }

  function updateReportRecord(report: ReportRecord) {
    const nextReports = dedupeReports(reports.map((item) => (item.id === report.id ? report : item)));
    setReports(nextReports);
    persistSnapshotNow({ reports: nextReports });
  }

  function sendReportToCustomer(report: ReportRecord) {
    setSendPreviewReportId(report.id);
  }

  async function createPortalMessage(customer: CustomerRecord, objectId: string, subject: string, message: string) {
    const object = objects.find((item) => item.id === objectId);
    const createdAt = new Date().toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
    const savedMessage: PortalMessageRecord = {
      id: `MSG-${Date.now()}`,
      customerId: customer.id,
      objectId,
      subject: subject.trim() || "Nachricht aus dem Kundenportal",
      message: message.trim(),
      createdAt,
      status: "neu",
    };
    const nextMessages = [savedMessage, ...portalMessages];

    setPortalMessages(nextMessages);
    persistSnapshotNow({ portalMessages: nextMessages });

    try {
      await notifyPortalActivity(
        `Kundenportal Nachricht - ${object?.name ?? "Objekt offen"}`,
        [
          `Kunde: ${customer.name}`,
          `Kontakt: ${customer.contact}`,
          `E-Mail: ${customer.email}`,
          `Objekt: ${object?.name ?? objectId}`,
          `Betreff: ${savedMessage.subject}`,
          "",
          savedMessage.message,
        ].join("\n"),
        customer.email,
      );
      setRecordNotice("Nachricht aus dem Kundenportal wurde gespeichert und per E-Mail gemeldet.");
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Benachrichtigung konnte nicht gesendet werden.";
      setRecordNotice(`Nachricht gespeichert, aber Mailversand fehlgeschlagen: ${messageText}`);
    }
  }

  function updatePortalCustomer(customerId: string, updates: Pick<CustomerRecord, "email" | "phone">) {
    const nextCustomers = customers.map((customer) => (
      customer.id === customerId
        ? { ...customer, email: updates.email.trim() || customer.email, phone: updates.phone.trim() || customer.phone }
        : customer
    ));
    setCustomers(nextCustomers);
    persistSnapshotNow({ customers: nextCustomers });
    setRecordNotice("Kundenstammdaten aus dem Portal wurden aktualisiert.");
  }

  function recordPortalLogin(customerId: string, email: string, userAgent: string) {
    const loginEntry: PortalLoginEntry = {
      id: `LOGIN-${Date.now()}`,
      email,
      loggedAt: new Date().toLocaleString("de-DE", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      userAgent: userAgent || "Unbekanntes Gerät",
    };
    const nextCustomers = customers.map((customer) => (
      customer.id === customerId
        ? {
            ...customer,
            portalLoginHistory: [loginEntry, ...(customer.portalLoginHistory ?? [])].slice(0, 25),
          }
        : customer
    ));

    setCustomers(nextCustomers);
    persistSnapshotNow({ customers: nextCustomers });
  }

  async function confirmSendReportToCustomer(report: ReportRecord) {
    const reportObject = objects.find((object) => object.id === report.objectId);
    if (!reportObject) return;
    const reportJob = jobs.find((job) => job.id === report.jobId);
    const reportCustomer = customers.find((customer) => customer.id === reportObject.ownerCustomerId || customer.name === reportObject.owner);
    const timestamp = new Date().toLocaleString("de-DE", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    const nextReport = { ...report, sentAt: report.sentAt ?? timestamp };

    try {
      await sendCustomerReportMail(nextReport, reportObject, reportJob, reportCustomer);
      updateReportRecord(nextReport);
      setSendPreviewReportId(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bericht konnte nicht gesendet werden.";
      window.alert(message);
    }
  }

  const sendPreviewReport = sendPreviewReportId ? reports.find((report) => report.id === sendPreviewReportId) : undefined;
  const sendPreviewObject = sendPreviewReport ? objects.find((object) => object.id === sendPreviewReport.objectId) : undefined;
  const sendPreviewJob = sendPreviewReport ? jobs.find((job) => job.id === sendPreviewReport.jobId) : undefined;
  const sendPreviewCustomer = sendPreviewObject
    ? customers.find((customer) => customer.id === sendPreviewObject.ownerCustomerId || customer.name === sendPreviewObject.owner)
    : undefined;
  const completedPromptReport = completedReportPromptId ? reports.find((report) => report.id === completedReportPromptId) : undefined;
  const completedPromptObject = completedPromptReport ? objects.find((object) => object.id === completedPromptReport.objectId) : undefined;
  const completedPromptJob = completedPromptReport ? jobs.find((job) => job.id === completedPromptReport.jobId) : undefined;
  const completedPromptCustomer = completedPromptObject
    ? customers.find((customer) => customer.id === completedPromptObject.ownerCustomerId || customer.name === completedPromptObject.owner)
    : undefined;

  if (portalOnly) {
    const portalLoggedIn = Boolean(portalCustomerId);
    return (
      <main className={`app portal-app ${portalLoggedIn ? "" : "portal-login-app"}`} data-ready="true" data-theme={theme}>
        <section className="workspace portal-workspace">
          <header className="topbar portal-topbar">
            {portalLoggedIn ? (
              <div className="portal-brand-head">
                <Image alt="Kolaretorp Service AB" height={28} priority src="/kolaretorp-logo.png" width={220} />
                <span>Kundenportal</span>
              </div>
            ) : <span aria-hidden="true" />}
            <div className="toolbar">
              <button className="ghost-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} type="button">
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                {theme === "dark" ? t.light : t.dark}
              </button>
            </div>
          </header>
          <CustomerPortalView
            billing={billing}
            customerId={portalCustomerId}
            customers={customers}
            jobs={jobs}
            messages={portalMessages}
            objects={objects}
            onRecordLogin={recordPortalLogin}
            onSendMessage={createPortalMessage}
            onUpdateCustomer={updatePortalCustomer}
            reports={reports}
            setCustomerId={setPortalCustomerId}
          />
        </section>
      </main>
    );
  }

  return (
    <main className="app" data-ready="true" data-theme={theme}>
      <aside className="sidebar">
        <div className="brand">
          <Image alt="Kolaretorp Service AB" height={23} priority src="/brand/kolaretorp-logo-white.png" width={220} />
        </div>
        <nav aria-label="Hauptnavigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={section === item.id ? "active" : ""}
                data-testid={`nav-${item.id}`}
                key={item.id}
                onClick={() => setSection(item.id)}
                type="button"
              >
                <Icon size={17} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <button className="version" onClick={() => setModal("version")} type="button">
          <span>Aktuelle Version</span>
          <strong>v{appVersion.version}</strong>
          <small>{appVersion.releaseDate}</small>
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>{t.appTitle}</h1>
            <span>{t.subtitle}</span>
          </div>
          <div className="toolbar">
            <label className="search">
              <Search size={16} />
              <input
                aria-label={t.search}
                placeholder={`${t.search}...`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label className="select-field">
              <Languages size={16} />
              <select
                aria-label={t.language}
                value={language}
                onChange={(event) => setLanguage(event.target.value as Language)}
              >
                <option value="de">DE</option>
                <option value="sv">SV</option>
                <option value="en">EN</option>
              </select>
            </label>
            <button className="ghost-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} type="button">
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              {theme === "dark" ? t.light : t.dark}
            </button>
          </div>
        </header>

        <div className="quickbar">
          {dashboardStats.map((item) => (
            <button key={item.label} onClick={() => setSection(item.section)} type="button">
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <section className="layout full">
          <div className="main-panel">
            {section === "dashboard" && (
              <Dashboard
                allJobs={jobs}
                jobs={upcomingOperationalJobs}
                objects={activeObjects}
                reports={reports}
                setSection={setSection}
              />
            )}
            {section === "objects" && objectEditorOpen && (
              <ObjectEditorPage
                customers={activeCustomers}
                jobs={jobs}
                object={editingObject}
                onBack={closeObjectEditor}
                onSubmit={saveObject}
                onSendReport={sendReportToCustomer}
                onUpdateReport={updateReportRecord}
                reports={reports}
                newObject={newObject}
                setNewObject={setNewObject}
                submitLabel={editingObjectId ? t.saveObject : t.createObject}
              />
            )}
            {section === "objects" && !objectEditorOpen && (
              <ObjectsView
                archivedObjects={archivedObjects}
                objects={filteredObjects}
                notice={recordNotice}
                onArchive={archiveObject}
                onRestore={restoreObject}
                selectedObjectId={selectedObject.id}
                onCreate={openCreateObject}
                onDelete={deleteObject}
                onEdit={openEditObject}
                onSelect={(id) => setSelectedObjectId(id)}
              />
            )}
            {section === "customers" && (
              <CustomersView
                archivedCustomers={archivedCustomers}
                customers={activeCustomers}
                notice={recordNotice}
                objects={activeObjects}
                onArchive={archiveCustomer}
                onRestore={restoreCustomer}
                onCreate={openCreateCustomer}
                onDelete={deleteCustomer}
                onEdit={openEditCustomer}
              />
            )}
            {section === "jobs" && (
              <JobsView jobs={jobs} objects={activeObjects} onCancel={cancelJob} onCreate={openCreateJob} onEdit={openEditJob} onRestore={restoreJob} onStart={startJob} reports={reports} />
            )}
            {section === "planning" && <PlanningView allJobs={jobs} jobs={upcomingOperationalJobs} objects={activeObjects} onStart={startJob} />}
            {section === "reports" && <ReportsView customers={customers} jobs={jobs} objects={objects} onEditInField={editReportInField} onSendReport={sendReportToCustomer} reports={reports} />}
            {section === "portal" && (
              <CustomerPortalView
                billing={billing}
                customerId={portalCustomerId}
                customers={customers}
                jobs={jobs}
                messages={portalMessages}
                objects={objects}
                onRecordLogin={recordPortalLogin}
                onSendMessage={createPortalMessage}
                onUpdateCustomer={updatePortalCustomer}
                reports={reports}
                setCustomerId={setPortalCustomerId}
              />
            )}
            {section === "field" && (
              <FieldView
                activeJobId={activeJobId}
                allJobs={jobs}
                jobs={upcomingOperationalJobs}
                objects={activeObjects}
                packages={servicePackages}
                services={services}
                reports={reports}
                fieldNote={currentFieldJobId ? fieldNotes[currentFieldJobId] ?? "" : ""}
                progress={currentFieldJobId ? fieldProgress[currentFieldJobId] ?? {} : {}}
                editingReportId={editingFieldReportId}
                onSelectJob={startJob}
                onSelectReport={editReportInField}
                onSendReport={sendReportToCustomer}
                onClearActiveJob={clearActiveJob}
                onProgressChange={(jobId, progress) => setFieldProgress((current) => {
                  const nextProgress = { ...current, [jobId]: progress };
                  persistSnapshotNow({ fieldProgress: nextProgress });
                  return nextProgress;
                })}
                onFieldNoteChange={(jobId, note) => setFieldNotes((current) => {
                  const nextNotes = { ...current, [jobId]: note };
                  persistSnapshotNow({ fieldNotes: nextNotes });
                  return nextNotes;
                })}
                onComplete={completeJob}
              />
            )}
            {section === "billing" && <BillingView billing={billing} objects={activeObjects} />}
            {section === "masterData" && (
              <MasterDataView
                customers={activeCustomers}
                objects={activeObjects}
                packages={servicePackages}
                services={services}
                setPackages={setServicePackages}
                setServices={setServices}
              />
            )}
          </div>
        </section>
      </section>

      {completedPromptReport && completedPromptObject && (
        <div className="modal-backdrop">
          <section className="modal send-preview-modal report-complete-modal" role="dialog" aria-modal="true" aria-labelledby="report-complete-title">
            <header>
              <div>
                <p>Einsatz abgeschlossen</p>
                <h2 id="report-complete-title">Bericht wurde erzeugt</h2>
              </div>
              <button aria-label="Hinweis schließen" onClick={() => setCompletedReportPromptId(null)} type="button">
                <X size={18} />
              </button>
            </header>
            <p className="report-complete-copy">
              Soll der Bericht jetzt geöffnet werden? Du kannst ihn prüfen und anschließend direkt an den Kunden senden.
            </p>
            <div className="send-preview-report">
              <CustomerReportCard
                customer={completedPromptCustomer}
                job={completedPromptJob}
                object={completedPromptObject}
                report={completedPromptReport}
                sentAt={completedPromptReport.sentAt}
              />
            </div>
            <div className="modal-actions">
              <button className="ghost-button" onClick={() => setCompletedReportPromptId(null)} type="button">Später</button>
              <button
                className="primary-button"
                onClick={() => {
                  setCompletedReportPromptId(null);
                  setSendPreviewReportId(completedPromptReport.id);
                }}
                type="button"
              >
                <Send size={16} />
                Bericht öffnen
              </button>
            </div>
          </section>
        </div>
      )}

      {sendPreviewReport && sendPreviewObject && (
        <div className="modal-backdrop">
          <section className="modal send-preview-modal" role="dialog" aria-modal="true" aria-labelledby="send-preview-title">
            <header>
              <div>
                <p>Versandvorschau</p>
                <h2 id="send-preview-title">Bericht senden</h2>
              </div>
              <button aria-label="Versandvorschau schließen" onClick={() => setSendPreviewReportId(null)} type="button">
                <X size={18} />
              </button>
            </header>
            <div className="send-preview-grid">
              <div>
                <span>An</span>
                <strong>{reportRecipientEmail(sendPreviewObject, sendPreviewCustomer) || "Keine E-Mail-Adresse hinterlegt"}</strong>
              </div>
              <div>
                <span>CC</span>
                <strong>info@kolaretorp.se</strong>
              </div>
              <div className="wide">
                <span>Betreff</span>
                <strong>{customerReportSendSubject(sendPreviewReport, sendPreviewObject)}</strong>
              </div>
              <div className="wide">
                <span>PDF-Anhang</span>
                <strong>{safeFileName(customerReportSendSubject(sendPreviewReport, sendPreviewObject))}.pdf</strong>
              </div>
              <div className="wide">
                <span>Nachricht</span>
                <pre>{customerReportSendBody(sendPreviewCustomer)}</pre>
              </div>
            </div>
            <div className="send-preview-report">
              <CustomerReportCard
                customer={sendPreviewCustomer}
                job={sendPreviewJob}
                object={sendPreviewObject}
                report={sendPreviewReport}
                sentAt={sendPreviewReport.sentAt}
              />
            </div>
            <div className="modal-actions">
              <button className="ghost-button" onClick={() => setSendPreviewReportId(null)} type="button">Abbrechen</button>
              <button className="primary-button" onClick={() => void confirmSendReportToCustomer(sendPreviewReport)} type="button">
                <Send size={16} />
                Jetzt senden
              </button>
            </div>
          </section>
        </div>
      )}

      {modal && (
        <div className="modal-backdrop">
          <section className="modal" role="dialog" aria-modal="true">
            <header>
              <div>
                <p>{modal === "customer" ? "Kundenstammdaten" : modal === "job" ? "Auftrag" : "Änderungsverlauf"}</p>
                <h2>{modal === "customer" ? (editingCustomerId ? t.editCustomer : t.newCustomer) : modal === "job" ? (editingJobId ? "Auftrag bearbeiten" : t.newJob) : `v${appVersion.version}`}</h2>
              </div>
              <button aria-label={t.close} onClick={() => setModal(null)} type="button">
                <X size={18} />
              </button>
            </header>
            {modal === "job" && (
              <JobForm
                newJob={newJob}
                objects={activeObjects}
                selectedObject={selectedObject}
                services={services}
                setNewJob={setNewJob}
                setSelectedObjectId={setSelectedObjectId}
                onSubmit={saveJob}
                submitLabel={editingJobId ? t.saveJob : t.createJob}
              />
            )}
            {modal === "customer" && (
              <CustomerForm
                customer={newCustomer}
                objects={activeObjects}
                setCustomer={setNewCustomer}
                onSubmit={saveCustomer}
                submitLabel={editingCustomerId ? t.saveCustomer : t.createCustomer}
              />
            )}
            {modal === "version" && (
              <div className="version-list">
                {versionHistory.map((entry) => (
                  <article key={entry.version}>
                    <strong>v{entry.version}</strong>
                    <span>{entry.date}</span>
                    <ul>
                      {entry.changes.map((change) => (
                        <li key={change}>{change}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function Dashboard({
  allJobs,
  jobs,
  objects,
  reports,
  setSection,
}: {
  allJobs: JobRecord[];
  jobs: JobRecord[];
  objects: ObjectRecord[];
  reports: ReportRecord[];
  setSection: (section: Section) => void;
}) {
  const openDashboardJobs = jobs.filter((job) => !["erledigt", "abgerechnet", "storniert"].includes(job.status));
  const workBlocks = [
    { label: "Heute steuern", value: openDashboardJobs.filter((job) => job.status === "in Arbeit").length, text: "laufende Einsätze", section: "planning" as Section },
    { label: "Objekte pflegen", value: objects.length, text: "vollständige Objektakten", section: "objects" as Section },
    { label: "Berichte prüfen", value: reports.length, text: "in Listenform", section: "reports" as Section },
  ];

  return (
    <div className="stack">
      <section className="workboard">
        {workBlocks.map((block) => (
          <button key={block.label} onClick={() => setSection(block.section)} type="button">
            <span>{block.label}</span>
            <strong>{block.value}</strong>
            <small>{block.text}</small>
          </button>
        ))}
      </section>
      <section className="panel">
        <div className="panel-title">
          <div>
            <p>Arbeitsliste</p>
            <h2>Nächste Einsätze</h2>
          </div>
        </div>
        <div className="table-list dashboard-work-list">
          {openDashboardJobs.map((job) => (
            <article key={job.id}>
              <div>
                <strong>{job.title}</strong>
                <span>{recurringJobHint(job, allJobs) || `${job.type} · ${job.assignedTo}`}</span>
              </div>
              <span>{job.dueDate}</span>
              <Badge value={job.status} />
            </article>
          ))}
          {openDashboardJobs.length === 0 && <span className="muted-line">Keine offenen Einsätze.</span>}
        </div>
      </section>
    </div>
  );
}

function ReportsView({
  customers,
  jobs,
  onEditInField,
  onSendReport,
  objects,
  reports,
}: {
  customers: CustomerRecord[];
  jobs: JobRecord[];
  onEditInField: (report: ReportRecord) => void;
  onSendReport: (report: ReportRecord) => void;
  objects: ObjectRecord[];
  reports: ReportRecord[];
}) {
  const [selectedReportId, setSelectedReportId] = useState("");
  const selectedReport = reports.find((report) => report.id === selectedReportId);
  const selectedObject = selectedReport ? objects.find((object) => object.id === selectedReport.objectId) : undefined;
  const selectedJob = selectedReport ? jobs.find((job) => job.id === selectedReport.jobId) : undefined;
  const selectedCustomer = selectedObject
    ? customers.find((customer) => customer.id === selectedObject.ownerCustomerId || customer.name === selectedObject.owner)
    : undefined;

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-title">
          <div>
            <p>Berichte</p>
            <h2>Berichtsübersicht</h2>
          </div>
        </div>
        <div className="table-list report-overview-list">
          {reports.map((report) => {
            const object = objects.find((item) => item.id === report.objectId);
            const job = jobs.find((item) => item.id === report.jobId);

            return (
              <button
                className={selectedReportId === report.id ? "active" : ""}
                key={report.id}
                onClick={() => setSelectedReportId(report.id)}
                type="button"
              >
                <FileText size={16} />
                <span>
                  <strong>{report.title}</strong>
                  <small>{object?.name ?? "Objekt unbekannt"} · {report.date} · {job?.assignedTo ?? "ohne Bearbeiter"}</small>
                </span>
                <Badge value={job?.status ?? "Bericht"} />
              </button>
            );
          })}
          {reports.length === 0 && <p>Noch keine Berichte vorhanden.</p>}
        </div>
      </section>
      {selectedReport && selectedObject && (
        <section className="panel report-detail-panel">
          <div className="history-detail-head">
            <div>
              <h3>{selectedReport.title}</h3>
              <span>{selectedObject.name} · {selectedObject.address}</span>
            </div>
            <div className="row-actions">
              <IconAction label={`Bericht ${selectedReport.title} mobil nachbearbeiten`} onClick={() => onEditInField(selectedReport)}><Pencil size={16} /></IconAction>
              <IconAction label={`PDF für ${selectedReport.title} herunterladen`} onClick={() => void downloadCustomerReportPdf(selectedReport, selectedObject, selectedJob, selectedCustomer)}><FileDown size={16} /></IconAction>
              <IconAction label={`Bericht ${selectedReport.title} an Kunden senden`} onClick={() => onSendReport(selectedReport)}><Send size={16} /></IconAction>
            </div>
          </div>
          <CustomerReportCard customer={selectedCustomer} job={selectedJob} object={selectedObject} report={selectedReport} sentAt={selectedReport.sentAt} />
        </section>
      )}
    </div>
  );
}

function CustomerReportCard({
  customer,
  job,
  object,
  report,
  sentAt,
}: {
  customer?: CustomerRecord;
  job?: JobRecord;
  object: ObjectRecord;
  report: ReportRecord;
  sentAt?: string;
}) {
  const objectImage = primaryObjectImage(object);

  return (
    <article className="customer-report-card printable-report">
      <div className="customer-report-head">
        <div>
          <img alt="Kolaretorp Service AB" className="customer-report-logo" src="/kolaretorp-logo.png" />
          <h3>Einsatzbericht</h3>
          <small>Berichtsnummer {report.id} · erstellt am {new Date().toLocaleDateString("de-DE")}</small>
        </div>
        <Badge value={job?.status ?? "Bericht"} />
      </div>
      <div className="report-hero">
        {objectImage?.previewUrl ? (
          <img
            alt={`Objektbild ${object.name}`}
            className="report-hero-image"
            src={objectImage.previewUrl}
          />
        ) : (
          <div className="report-hero-image report-hero-image-empty">
            <Home size={26} />
            <span>{object.name}</span>
          </div>
        )}
        <div>
          <span>Einsatzbericht</span>
          <strong>{object.name}</strong>
          <span>{object.address}</span>
          <small>{report.title} · {report.date}</small>
        </div>
      </div>
      <div className="report-info-grid">
        <section>
          <strong>Objekt</strong>
          <dl>
            <div><dt>Objekt</dt><dd>{object.name}</dd></div>
            <div><dt>Adresse</dt><dd>{object.address}</dd></div>
            <div><dt>Eigentümer</dt><dd>{object.owner}</dd></div>
          </dl>
        </section>
        <section>
          <strong>Kunde</strong>
          <dl>
            <div><dt>Kunde</dt><dd>{customer?.name ?? object.owner}</dd></div>
            <div><dt>Ansprechpartner</dt><dd>{customer?.contact ?? object.owner}</dd></div>
            <div><dt>E-Mail</dt><dd>{reportRecipientEmail(object, customer) || "-"}</dd></div>
          </dl>
        </section>
        <section>
          <strong>Auftrag</strong>
          <dl>
            <div><dt>Auftrag</dt><dd>{report.title}</dd></div>
            <div><dt>Datum</dt><dd>{report.date}</dd></div>
            {job && <div><dt>Rhythmus</dt><dd>{scheduleLabel(job.schedule)}</dd></div>}
          </dl>
        </section>
        <section>
          <strong>Leistung</strong>
          <dl>
            {job && <div><dt>Priorität</dt><dd>{job.priority}</dd></div>}
            {job && <div><dt>Bearbeiter</dt><dd>{job.assignedTo}</dd></div>}
            {job && <div><dt>Zeit / Material</dt><dd>{job.workMinutes} min. · {job.material}</dd></div>}
          </dl>
        </section>
      </div>
      <div className="report-summary-grid">
        <section>
          <strong>Zusammenfassung</strong>
          <p>{report.summary}</p>
        </section>
        <section>
          <strong>Kommentar an den Kunden</strong>
          <p>{report.customerComment || "Noch kein Kundenkommentar hinterlegt."}</p>
        </section>
      </div>
      {report.checklistResults.length > 0 ? (
        <div className="report-checklist">
          <strong>Kontrolle vor Ort</strong>
          <div className="report-task-list">
            {report.checklistResults.map((item) => (
              <article key={item.id}>
                <div>
                  <Badge value={item.completed ? "ausgeführt" : "nicht ausgeführt"} />
                  <strong>{item.title}</strong>
                  <span>{item.meta}</span>
                </div>
                <p>{item.description}</p>
                <dl>
                  <div><dt>Zeit</dt><dd>{item.minutes} min.</dd></div>
                  <div><dt>Hinweis / Info</dt><dd>{item.note || "Keine zusätzliche Info erfasst."}</dd></div>
                  <div><dt>Bilder</dt><dd>{item.photos.length > 0 ? item.photos.map((photo) => photo.name).join(", ") : "Keine Bilder erfasst."}</dd></div>
                </dl>
                {item.photos.length > 0 && (
                  <div className="report-point-photos">
                    {item.photos.map((photo) => (
                      <figure key={`${item.id}-${photo.name}-inline`}>
                        {photo.previewUrl ? (
                          <img alt={`Kontrollfoto ${photo.name}`} src={photo.previewUrl} />
                        ) : (
                          <div className="report-gallery-placeholder">
                            <Camera size={18} />
                            <span>Foto erfasst</span>
                          </div>
                        )}
                        <figcaption>{photo.name}</figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      ) : job && job.checklist.length > 0 ? (
        <div className="report-checklist">
          <strong>Kontrolle vor Ort</strong>
          <div className="report-task-list">
            {job.checklist.map((item) => (
              <article key={item}>
                <div>
                  <Badge value="offen" />
                  <strong>{item}</strong>
                  <span>{job.type}</span>
                </div>
                <p>Noch nicht im Einsatzbericht dokumentiert.</p>
                <dl>
                  <div><dt>Zeit</dt><dd>0 min.</dd></div>
                  <div><dt>Hinweis / Info</dt><dd>Keine zusätzliche Info erfasst.</dd></div>
                  <div><dt>Bilder</dt><dd>Keine Bilder erfasst.</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </div>
      ) : null}
      <div className="history-media">
        {report.media.map((item) => <span key={item}>{item}</span>)}
      </div>
      <footer className="report-footer">
        <span>Kolaretorp Service AB</span>
        <span>info@kolaretorp.se</span>
        {sentAt && <span>Versendet am {sentAt}</span>}
        <span className="print-page-counter" aria-hidden="true" />
      </footer>
    </article>
  );
}

function ObjectsView({
  archivedObjects,
  objects,
  notice,
  onArchive,
  onRestore,
  selectedObjectId,
  onCreate,
  onDelete,
  onEdit,
  onSelect,
}: {
  archivedObjects: ObjectRecord[];
  objects: ObjectRecord[];
  notice: string;
  onArchive: (object: ObjectRecord) => void;
  onRestore: (object: ObjectRecord) => void;
  selectedObjectId: string;
  onCreate: () => void;
  onDelete: (object: ObjectRecord) => void;
  onEdit: (object: ObjectRecord) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <p>Stammdaten</p>
          <h2>Objektübersicht</h2>
        </div>
        <button className="primary-button" onClick={onCreate} type="button">
          <Plus size={16} />
          Neues Objekt
        </button>
      </div>
      {notice && <p className="archive-notice">{notice}</p>}
      <div className="object-list">
        {objects.map((object) => (
          <article
            className={selectedObjectId === object.id ? "selected" : ""}
            key={object.id}
          >
            <button className="object-row-main" onClick={() => onSelect(object.id)} type="button">
              <ObjectThumbnail object={object} />
              <div>
                <strong>{object.name}</strong>
                <span>{object.owner}</span>
              </div>
              <span>{object.region}</span>
              <span>{object.sizeSqm} m² · {object.rooms} Zi. · {object.beds} Betten</span>
              <span>{object.carePackage}</span>
              <Badge value={object.status} />
            </button>
            <div className="row-actions">
              <IconAction label={`Objekt ${object.name} bearbeiten`} onClick={() => onEdit(object)}><Pencil size={16} /></IconAction>
              <IconAction danger label={`Objekt ${object.name} archivieren`} onClick={() => onArchive(object)}><Archive size={16} /></IconAction>
            </div>
          </article>
        ))}
      </div>
      {archivedObjects.length > 0 && (
        <div className="archive-section">
          <h3>Archivierte Objekte</h3>
          <div className="table-list compact-list">
            {archivedObjects.map((object) => (
              <article key={object.id}>
                <div>
                  <strong>{object.name}</strong>
                  <span>{object.address}</span>
                </div>
                <Badge value="archiviert" />
                <div className="row-actions">
                  <IconAction label={`Archiviertes Objekt ${object.name} bearbeiten`} onClick={() => onEdit(object)}><Pencil size={16} /></IconAction>
                  <IconAction label={`Archiviertes Objekt ${object.name} reaktivieren`} onClick={() => onRestore(object)}><RotateCcw size={16} /></IconAction>
                </div>
                <IconAction danger label={`Archiviertes Objekt ${object.name} löschen`} onClick={() => onDelete(object)}><Trash2 size={16} /></IconAction>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ObjectThumbnail({ object }: { object: ObjectRecord }) {
  const image = primaryObjectImage(object);

  return image?.previewUrl ? (
    <span
      aria-label={`Objektbild ${object.name}`}
      className="object-thumb"
      role="img"
      style={{ backgroundImage: `url(${image.previewUrl})` }}
    />
  ) : (
    <span className="object-thumb object-thumb-empty">
      <Home size={18} />
    </span>
  );
}

function CustomersView({
  archivedCustomers,
  customers,
  notice,
  objects,
  onArchive,
  onRestore,
  onCreate,
  onDelete,
  onEdit,
}: {
  archivedCustomers: CustomerRecord[];
  customers: CustomerRecord[];
  notice: string;
  objects: ObjectRecord[];
  onArchive: (customer: CustomerRecord) => void;
  onRestore: (customer: CustomerRecord) => void;
  onCreate: () => void;
  onDelete: (customer: CustomerRecord) => void;
  onEdit: (customer: CustomerRecord) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <p>Eigentümer</p>
          <h2>Kundenübersicht</h2>
        </div>
        <button className="primary-button" onClick={onCreate} type="button">
          <Plus size={16} />
          Neuer Kunde
        </button>
      </div>
      {notice && <p className="archive-notice">{notice}</p>}
      <div className="table-list">
        {customers.map((customer) => (
          <article className="customer-row" key={customer.id}>
            <div className="customer-row-main">
              <div>
              <strong>{customer.name}</strong>
                <span>{customer.contact} · {customer.email} · {customer.phone} · {customer.language}{customer.notes ? ` · ${customer.notes}` : ""}</span>
              </div>
              <span>{objects.filter((object) => customer.objects.includes(object.id)).map((object) => object.name).join(", ") || "Keine Objekte"}</span>
              <span>{customer.balance}</span>
              <Badge value={customer.portalStatus} />
            </div>
            <div className="row-actions">
              <IconAction label={`Kunde ${customer.name} bearbeiten`} onClick={() => onEdit(customer)}><Pencil size={16} /></IconAction>
              <IconAction danger label={`Kunde ${customer.name} archivieren`} onClick={() => onArchive(customer)}><Archive size={16} /></IconAction>
            </div>
          </article>
        ))}
      </div>
      {archivedCustomers.length > 0 && (
        <div className="archive-section">
          <h3>Archivierte Kunden</h3>
          <div className="table-list compact-list">
            {archivedCustomers.map((customer) => (
              <article key={customer.id}>
                <div>
                  <strong>{customer.name}</strong>
                  <span>{customer.contact} · {customer.email}</span>
                </div>
                <Badge value="archiviert" />
                <div className="row-actions">
                  <IconAction label={`Archivierten Kunden ${customer.name} bearbeiten`} onClick={() => onEdit(customer)}><Pencil size={16} /></IconAction>
                  <IconAction label={`Archivierten Kunden ${customer.name} reaktivieren`} onClick={() => onRestore(customer)}><RotateCcw size={16} /></IconAction>
                </div>
                <IconAction danger label={`Archivierten Kunden ${customer.name} löschen`} onClick={() => onDelete(customer)}><Trash2 size={16} /></IconAction>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function JobsView({
  jobs,
  objects,
  onCancel,
  onCreate,
  onEdit,
  onRestore,
  onStart,
  reports,
}: {
  jobs: JobRecord[];
  objects: ObjectRecord[];
  onCancel: (job: JobRecord) => void;
  onCreate: () => void;
  onEdit: (job: JobRecord) => void;
  onRestore: (job: JobRecord) => void;
  onStart: (job: JobRecord) => void;
  reports: ReportRecord[];
}) {
  const [expandedSeriesIds, setExpandedSeriesIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState("alle");
  const occurrenceGroups = jobs.reduce<Record<string, JobRecord[]>>((groups, job) => {
    if (!job.seriesMasterId) return groups;
    return {
      ...groups,
      [job.seriesMasterId]: [...(groups[job.seriesMasterId] ?? []), job],
    };
  }, {});
  const rootJobs = jobs
    .filter((job) => !job.seriesMasterId)
    .filter((job) => jobMatchesStatusFilter(job, occurrenceGroups[job.id] ?? [], statusFilter))
    .sort((first, second) => {
      const firstOccurrences = occurrenceGroups[first.id] ?? [];
      const secondOccurrences = occurrenceGroups[second.id] ?? [];
      const groupDiff = jobSortGroup(first, firstOccurrences) - jobSortGroup(second, secondOccurrences);
      return groupDiff || nextRelevantJobDate(first, firstOccurrences) - nextRelevantJobDate(second, secondOccurrences);
    });

  function toggleSeries(id: string) {
    setExpandedSeriesIds((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  }

  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <p>Auftragsabwicklung</p>
          <h2>Auftragsübersicht</h2>
        </div>
        <button className="primary-button" onClick={onCreate} type="button">
          <Plus size={16} />
          Neuer Auftrag
        </button>
      </div>
      <div className="status-filter-bar" aria-label="Aufträge nach Status filtern">
        {["alle", "geplant", "in Arbeit", "pausiert", "erledigt", "abgerechnet", "storniert"].map((status) => (
          <button
            className={statusFilter === status ? "active" : ""}
            key={status}
            onClick={() => setStatusFilter(status)}
            type="button"
          >
            {status}
          </button>
        ))}
      </div>
      <div className="table-list job-list">
        {rootJobs.map((job) => {
          const occurrences = sortedByDueDate(occurrenceGroups[job.id] ?? []);
          const isRecurring = isSeriesMaster(job);
          const isExpanded = expandedSeriesIds.includes(job.id);
          const summary = isRecurring ? seriesSummary(job, occurrences, reports) : null;

          return (
            <article className={`job-row ${isRecurring ? "series-job-row" : ""}`} key={job.id}>
              <div className="job-row-main">
                <div className="job-title-line">
                  <strong>{job.title}</strong>
                  {isRecurring && summary && (
                    <div className="series-summary-chips" aria-label="Serienstatus">
                      <span>Serienauftrag</span>
                      <span>Letzter: {summary.lastDone}</span>
                      <span>Nächster: {summary.nextStatus} {summary.nextDate}</span>
                    </div>
                  )}
                </div>
                <span>{objects.find((object) => object.id === job.objectId)?.name} · {isRecurring && summary ? summary.rhythm : scheduleLabel(job.schedule)} · {job.description}</span>
              </div>
              <div className="job-row-meta">
                <span>{isRecurring ? `${occurrences.length} Teilaufträge` : job.dueDate}</span>
                <span>{job.priority}</span>
                {!isRecurring && <Badge value={job.status} />}
                <div className="row-actions">
                  {isRecurring && (
                    <IconAction label={`${job.title} Teilaufträge ${isExpanded ? "ausblenden" : "anzeigen"}`} onClick={() => toggleSeries(job.id)}>
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </IconAction>
                  )}
                  <IconAction label={`Auftrag ${job.title} bearbeiten`} onClick={() => onEdit(job)}><Pencil size={16} /></IconAction>
                  {!isRecurring && job.status !== "storniert" && (
                    <IconAction label={`Auftrag ${job.title} starten`} onClick={() => onStart(job)}><PlayCircle size={16} /></IconAction>
                  )}
                  {job.status === "storniert" ? (
                    <IconAction label={`Auftrag ${job.title} reaktivieren`} onClick={() => onRestore(job)}><RotateCcw size={16} /></IconAction>
                  ) : (
                    <IconAction danger label={`Auftrag ${job.title} stornieren`} onClick={() => onCancel(job)}><X size={16} /></IconAction>
                  )}
                </div>
              </div>
              {isRecurring && isExpanded && (
                <div className="series-occurrence-list">
                  {occurrences.map((occurrence) => (
                    <div className="series-occurrence-row" key={occurrence.id}>
                      <div>
                        <strong>{occurrence.dueDate}</strong>
                        <span>{readableJobStatus(occurrence.status)} · {occurrence.assignedTo}</span>
                      </div>
                      <div className="row-actions">
                        <Badge value={occurrence.status} />
                        <IconAction label={`Teilauftrag ${occurrence.dueDate} bearbeiten`} onClick={() => onEdit(occurrence)}><Pencil size={16} /></IconAction>
                        {occurrence.status !== "storniert" && !["erledigt", "abgerechnet"].includes(occurrence.status) && (
                          <IconAction label={`Teilauftrag ${occurrence.dueDate} starten`} onClick={() => onStart(occurrence)}><PlayCircle size={16} /></IconAction>
                        )}
                        {occurrence.status === "storniert" ? (
                          <IconAction label={`Teilauftrag ${occurrence.dueDate} reaktivieren`} onClick={() => onRestore(occurrence)}><RotateCcw size={16} /></IconAction>
                        ) : (
                          <IconAction danger label={`Teilauftrag ${occurrence.dueDate} stornieren`} onClick={() => onCancel(occurrence)}><X size={16} /></IconAction>
                        )}
                      </div>
                    </div>
                  ))}
                  {occurrences.length === 0 && <span className="muted-line">Für diesen Serienauftrag sind aktuell keine offenen Teilaufträge vorbereitet.</span>}
                </div>
              )}
            </article>
          );
        })}
        {rootJobs.length === 0 && <span className="muted-line">Keine Aufträge für diesen Status.</span>}
      </div>
    </section>
  );
}

function PlanningView({ allJobs, jobs, objects, onStart }: { allJobs: JobRecord[]; jobs: JobRecord[]; objects: ObjectRecord[]; onStart: (job: JobRecord) => void }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <p>Disposition</p>
          <h2>Einsatzplanung</h2>
        </div>
      </div>
      <div className="planning-grid">
        {["geplant", "in Arbeit", "erledigt", "abgerechnet", "storniert"].map((status) => (
          <div key={status}>
            <h3>{status}</h3>
            {jobs.filter((job) => job.status === status).map((job) => (
              <button key={job.id} onClick={() => onStart(job)} type="button">
                <strong>{job.title}</strong>
                <span>{objects.find((object) => object.id === job.objectId)?.name}</span>
                <small>{recurringJobHint(job, allJobs) || job.assignedTo} · {job.dueDate}</small>
              </button>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function FieldView({
  activeJobId,
  allJobs,
  editingReportId,
  jobs,
  objects,
  packages,
  reports,
  services,
  fieldNote,
  progress,
  onSelectJob,
  onSelectReport,
  onClearActiveJob,
  onFieldNoteChange,
  onProgressChange,
  onSendReport,
  onComplete,
}: {
  activeJobId: string | null;
  allJobs: JobRecord[];
  editingReportId: string | null;
  jobs: JobRecord[];
  objects: ObjectRecord[];
  packages: ServicePackage[];
  reports: ReportRecord[];
  services: ServiceItem[];
  fieldNote: string;
  progress: Record<string, FieldTaskProgress>;
  onSelectJob: (job: JobRecord) => void;
  onSelectReport: (report: ReportRecord) => void;
  onClearActiveJob: () => void;
  onFieldNoteChange: (jobId: string, note: string) => void;
  onProgressChange: (jobId: string, progress: Record<string, FieldTaskProgress>) => void;
  onSendReport: (report: ReportRecord) => void;
  onComplete: (job: JobRecord, checklistResults: FieldTaskResult[], fieldNote: string) => void;
}) {
  const openJobs = jobs.filter((job) => !["erledigt", "abgerechnet", "storniert"].includes(job.status));
  const completedReports = dedupeReports(reports).filter((report) => {
    const job = allJobs.find((item) => item.id === report.jobId);
    return job ? ["erledigt", "geplant", "in Arbeit"].includes(job.status) : true;
  });
  const active = activeJobId ? jobs.find((job) => job.id === activeJobId) ?? allJobs.find((job) => job.id === activeJobId) : undefined;
  const activeReport = editingReportId ? reports.find((report) => report.id === editingReportId) : undefined;
  const reportLocked = Boolean(activeReport?.sentAt);
  if (!active && openJobs.length === 0 && completedReports.length === 0) {
    return (
      <section className="field-shell">
        <div className="phone-card">
          <p>Mobil vor Ort</p>
          <h2>Keine offenen Aufträge</h2>
          <span>Aktuell gibt es keine geplanten oder laufenden Einsätze.</span>
        </div>
      </section>
    );
  }
  if (!active) {
    return (
      <section className="field-shell">
        <div className="phone-card">
          <p>Mobil vor Ort</p>
          <div className="field-job-picker">
            <strong>Offene Aufträge</strong>
            {openJobs.map((job) => {
              const jobObject = objects.find((item) => item.id === job.objectId);
              return (
                <button key={job.id} onClick={() => onSelectJob(job)} type="button">
                  <span>
                    <strong>{job.title}</strong>
                    <small>{jobObject?.name ?? "Objekt unbekannt"} · {job.dueDate} · {recurringJobHint(job, allJobs) || job.assignedTo}</small>
                  </span>
                  <Badge value={job.status} />
                </button>
              );
            })}
            {openJobs.length === 0 && <span>Keine offenen Aufträge.</span>}
          </div>
          <div className="field-job-picker">
            <strong>Abgeschlossene Berichte</strong>
            {completedReports.map((report) => {
              const jobObject = objects.find((item) => item.id === report.objectId);
              return (
                <button key={report.id} onClick={() => onSelectReport(report)} type="button">
                  <span>
                    <strong>{report.title}</strong>
                    <small>{jobObject?.name ?? "Objekt unbekannt"} · {report.date}</small>
                  </span>
                  <Badge value={report.sentAt ? "gesendet" : "Bericht"} />
                </button>
              );
            })}
            {completedReports.length === 0 && <span>Noch keine abgeschlossenen Berichte.</span>}
          </div>
          <div className="field-empty-state">
            <h2>Auftrag auswählen</h2>
            <span>Tippe einen offenen Auftrag oder einen bestehenden Bericht an, um die Checkliste vor Ort zu bearbeiten.</span>
          </div>
        </div>
      </section>
    );
  }
  const activeJob = active;
  const object = objects.find((item) => item.id === activeJob.objectId) ?? objects[0];
  void packages;
  const jobServices = jobSelectedServices(activeJob, services);
  const fieldTasks = jobServices.length > 0
    ? jobServices.flatMap(serviceToFieldTasks)
    : activeJob.checklist.map((item) => ({
        id: item,
        title: item,
        meta: activeJob.type,
        description: "Aufgabe aus der Auftragscheckliste dokumentieren.",
        defaultMinutes: 0,
      }));

  function valueForTask(task: FieldTask, index: number) {
    return progress[task.id] ?? {
      completed: index < 1,
      minutes: task.defaultMinutes ? String(task.defaultMinutes) : "",
      note: "",
      photos: [],
    };
  }

  function updateTask(
    id: string,
    patch: Partial<FieldTaskProgress>,
    currentTask: FieldTaskProgress,
  ) {
    onProgressChange(activeJob.id, { ...progress, [id]: { ...currentTask, ...patch } });
  }

  function updateFieldNote(note: string) {
    onFieldNoteChange(activeJob.id, note);
  }

  function completeActiveJob() {
    const results = fieldTasks.map((task, index) => {
      const currentTask = valueForTask(task, index);
      return {
        id: task.id,
        title: task.title,
        meta: task.meta,
        description: task.description,
        completed: currentTask.completed,
        minutes: Number(currentTask.minutes) || 0,
        note: currentTask.note.trim(),
        photos: currentTask.photos,
      };
    });

    onComplete(activeJob, results, fieldNote);
  }

  return (
    <section className="field-shell">
      <div className="phone-card">
        <p>Mobil vor Ort</p>
        <div className="field-job-picker">
          <strong>Offene Aufträge</strong>
          {openJobs.map((job) => {
            const jobObject = objects.find((item) => item.id === job.objectId);
            return (
              <button
                className={job.id === activeJob.id ? "active" : ""}
                key={job.id}
                onClick={() => onSelectJob(job)}
                type="button"
              >
                <span>
                  <strong>{job.title}</strong>
                  <small>{jobObject?.name ?? "Objekt unbekannt"} · {job.dueDate} · {recurringJobHint(job, allJobs) || job.assignedTo}</small>
                </span>
                <Badge value={job.status} />
              </button>
            );
          })}
          {openJobs.length === 0 && <span>Keine offenen Aufträge.</span>}
        </div>
        <div className="field-job-picker">
          <strong>Abgeschlossene Berichte</strong>
          {completedReports.slice(0, 6).map((report) => {
            const jobObject = objects.find((item) => item.id === report.objectId);
            return (
              <button
                className={editingReportId === report.id ? "active" : ""}
                key={report.id}
                onClick={() => onSelectReport(report)}
                type="button"
              >
                <span>
                  <strong>{report.title}</strong>
                  <small>{jobObject?.name ?? "Objekt unbekannt"} · {report.date}</small>
                </span>
                <Badge value={report.sentAt ? "gesendet" : "Bericht"} />
              </button>
            );
          })}
          {completedReports.length === 0 && <span>Noch keine abgeschlossenen Berichte.</span>}
        </div>
        <div className="field-active-head">
          <h2>{editingReportId ? "Bericht nachbearbeiten" : activeJob.title}</h2>
          <div className="row-actions">
            {activeReport && (
              <IconAction label={`Bericht ${activeReport.title} senden`} onClick={() => onSendReport(activeReport)}>
                <Send size={16} />
              </IconAction>
            )}
            <IconAction label={`Auftrag ${activeJob.title} abwählen`} onClick={onClearActiveJob}>
              <X size={16} />
            </IconAction>
          </div>
        </div>
        {reportLocked && <div className="warning-line">Dieser Bericht wurde am {activeReport?.sentAt} gesendet und ist für Änderungen gesperrt.</div>}
        <span>{object.name} · {object.address}</span>
        <div className="field-summary">
          <strong>{activeJob.assignedTo}</strong>
          <small>{activeJob.dueDate} · {object.carePackage}</small>
        </div>
        <div className="service-task-list">
          {fieldTasks.map((task, index) => {
            const currentTask = valueForTask(task, index);

            return (
            <article key={task.id}>
              <div className="field-task-head">
                <label>
                  <input
                    type="checkbox"
                    disabled={reportLocked}
                    checked={currentTask.completed}
                    onChange={(event) => updateTask(task.id, { completed: event.target.checked }, currentTask)}
                  />
                  <span>
                    <strong>{task.title}</strong>
                    <small>{task.meta}</small>
                  </span>
                </label>
                <label className="task-photo-button" data-tooltip={`Bild zu ${task.title} erfassen`}>
                  <Camera size={16} />
                  <input
                    aria-label={`Bild zu ${task.title} erfassen`}
                    accept="image/*"
                    capture="environment"
                    disabled={reportLocked}
                    type="file"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      void fileToImagePreview(file, 900, 0.66).then((previewUrl) => {
                        updateTask(task.id, {
                          photos: [...currentTask.photos, { name: file.name, accepted: true, previewUrl }],
                        }, currentTask);
                      });
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
              <p>{task.description}</p>
              <div className="field-task-inputs">
                <label>
                  <span>Zeit min.</span>
                  <input
                    aria-label={`Zeit ${task.title}`}
                    disabled={!currentTask.completed || reportLocked}
                    value={currentTask.completed ? currentTask.minutes : ""}
                    inputMode="numeric"
                    min="0"
                    type="number"
                    onChange={(event) => updateTask(task.id, { minutes: event.target.value }, currentTask)}
                    onBlur={(event) => updateTask(task.id, { minutes: event.currentTarget.value }, currentTask)}
                  />
                </label>
                <label>
                  <span>Hinweis / Info</span>
                  <textarea
                    aria-label={`Hinweis ${task.title}`}
                    disabled={reportLocked}
                    placeholder="Kurznotiz, Besonderheit oder Rückmeldung"
                    value={currentTask.note}
                    onChange={(event) => updateTask(task.id, { note: event.target.value }, currentTask)}
                    onBlur={(event) => updateTask(task.id, { note: event.currentTarget.value }, currentTask)}
                  />
                </label>
              </div>
              {currentTask.photos.map((photo, photoIndex) => (
                <div className="captured-photo-card" key={`${task.id}-${photo.name}-${photoIndex}`}>
                  {photo.previewUrl ? (
                    <img alt={`Vorschau ${photo.name}`} src={photo.previewUrl} />
                  ) : (
                    <div className="captured-photo-placeholder">
                      <Camera size={18} />
                    </div>
                  )}
                  <div>
                    <strong>{photo.accepted ? "Foto übernommen" : "Neues Foto erfasst"}</strong>
                    <span>{photo.name}</span>
                  </div>
                  <div className="row-actions">
                    <button
                      aria-label="Foto benutzen"
                      className="icon-button"
                      disabled={reportLocked}
                      onClick={() => updateTask(task.id, {
                        photos: currentTask.photos.map((item, index) => (index === photoIndex ? { ...item, accepted: true } : item)),
                      }, currentTask)}
                      type="button"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      aria-label="Neues Foto aufnehmen"
                      className="icon-button"
                      disabled={reportLocked}
                      onClick={() => updateTask(task.id, {
                        photos: currentTask.photos.filter((_, index) => index !== photoIndex),
                      }, currentTask)}
                      type="button"
                    >
                      <RotateCcw size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </article>
            );
          })}
        </div>
        <textarea
          disabled={reportLocked}
          value={fieldNote}
          onBlur={(event) => updateFieldNote(event.currentTarget.value)}
          onChange={(event) => updateFieldNote(event.target.value)}
          aria-label="Einsatznotiz"
        />
        <button className="primary-button" disabled={reportLocked} onClick={completeActiveJob} type="button">
          {editingReportId ? "Bericht speichern" : "Einsatz abschließen"}
        </button>
      </div>
    </section>
  );
}

function BillingView({ billing, objects }: { billing: BillingRecord[]; objects: ObjectRecord[] }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <p>Finanzen</p>
          <h2>Abrechnung</h2>
        </div>
      </div>
      <div className="table-list">
        {billing.map((item) => (
          <article key={item.id}>
            <div>
              <strong>{item.label}</strong>
              <span>{item.source}</span>
            </div>
            <span>{objects.find((object) => object.id === item.objectId)?.name}</span>
            <strong>{item.amount}</strong>
            <Badge value={item.status} />
          </article>
        ))}
      </div>
    </section>
  );
}

function CustomerPortalView({
  billing,
  customerId,
  customers,
  jobs,
  messages,
  objects,
  onRecordLogin,
  onSendMessage,
  onUpdateCustomer,
  reports,
  setCustomerId,
}: {
  billing: BillingRecord[];
  customerId: string;
  customers: CustomerRecord[];
  jobs: JobRecord[];
  messages: PortalMessageRecord[];
  objects: ObjectRecord[];
  onRecordLogin: (customerId: string, email: string, userAgent: string) => void;
  onSendMessage: (customer: CustomerRecord, objectId: string, subject: string, message: string) => Promise<void>;
  onUpdateCustomer: (customerId: string, updates: Pick<CustomerRecord, "email" | "phone">) => void;
  reports: ReportRecord[];
  setCustomerId: (id: string) => void;
}) {
  const portalCustomers = customers.filter((customer) => !customer.archived && customer.portalStatus !== "gesperrt");
  const customer = customers.find((item) => item.id === customerId);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [selectedObjectId, setSelectedObjectId] = useState("");
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [portalProfileEmail, setPortalProfileEmail] = useState("");
  const [portalProfilePhone, setPortalProfilePhone] = useState("");
  const [portalNotice, setPortalNotice] = useState("");
  const [expandedPortalSeriesIds, setExpandedPortalSeriesIds] = useState<string[]>([]);
  const [selectedPortalReportId, setSelectedPortalReportId] = useState("");

  const customerObjects = customer
    ? objects.filter((object) => !object.archived && (customer.objects.includes(object.id) || object.ownerCustomerId === customer.id))
    : [];
  const currentObjectId = selectedObjectId && customerObjects.some((object) => object.id === selectedObjectId)
    ? selectedObjectId
    : customerObjects[0]?.id ?? "";
  const portalReports = reports
    .filter((report) => customerObjects.some((object) => object.id === report.objectId) && report.visibleToCustomer)
    .sort((first, second) => normalizeReportDate(second.date).localeCompare(normalizeReportDate(first.date)));
  const selectedPortalReport = portalReports.find((report) => report.id === selectedPortalReportId);
  const selectedPortalReportObject = selectedPortalReport ? objects.find((object) => object.id === selectedPortalReport.objectId) : undefined;
  const selectedPortalReportJob = selectedPortalReport ? jobs.find((job) => job.id === selectedPortalReport.jobId) : undefined;
  const customerJobs = jobs.filter((job) => customerObjects.some((object) => object.id === job.objectId));
  const portalOccurrenceGroups = customerJobs.reduce<Record<string, JobRecord[]>>((groups, job) => {
    if (!job.seriesMasterId) return groups;
    return {
      ...groups,
      [job.seriesMasterId]: [...(groups[job.seriesMasterId] ?? []), job],
    };
  }, {});
  const portalJobs = customerJobs
    .filter((job) => !job.seriesMasterId)
    .filter((job) => {
      const occurrences = portalOccurrenceGroups[job.id] ?? [];
      if (isSeriesMaster(job)) {
        return occurrences.some((occurrence) => !["erledigt", "abgerechnet", "storniert"].includes(occurrence.status));
      }
      return !["erledigt", "abgerechnet", "storniert"].includes(job.status);
    })
    .sort((first, second) => {
      const firstOccurrences = portalOccurrenceGroups[first.id] ?? [];
      const secondOccurrences = portalOccurrenceGroups[second.id] ?? [];
      const groupDiff = jobSortGroup(first, firstOccurrences) - jobSortGroup(second, secondOccurrences);
      return groupDiff || nextRelevantJobDate(first, firstOccurrences) - nextRelevantJobDate(second, secondOccurrences);
    });
  const portalMessages = messages.filter((message) => message.customerId === customer?.id);
  const portalBilling = billing.filter((item) => customerObjects.some((object) => object.id === item.objectId));

  function togglePortalSeries(id: string) {
    setExpandedPortalSeriesIds((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  }

  function login() {
    const normalizedEmail = loginEmail.trim().toLowerCase();
    const matchedCustomer = portalCustomers.find((item) => (item.portalLoginEmail || item.email).toLowerCase() === normalizedEmail);
    if (!matchedCustomer) {
      setPortalNotice("Kein aktiver Portalzugang für diese E-Mail-Adresse gefunden.");
      return;
    }
    if (matchedCustomer.portalPassword && matchedCustomer.portalPassword !== loginPassword) {
      setPortalNotice("Das Passwort passt nicht zum Portalzugang.");
      return;
    }

    setCustomerId(matchedCustomer.id);
    setSelectedObjectId(matchedCustomer.objects[0] ?? "");
    setPortalProfileEmail(matchedCustomer.email);
    setPortalProfilePhone(matchedCustomer.phone);
    onRecordLogin(matchedCustomer.id, matchedCustomer.portalLoginEmail || matchedCustomer.email, window.navigator.userAgent);
    setPortalNotice("");
  }

  async function submitMessage() {
    if (!customer || !currentObjectId || !messageBody.trim()) return;
    await onSendMessage(customer, currentObjectId, messageSubject.trim() || "Leistungsanfrage aus dem Kundenportal", messageBody);
    setMessageSubject("");
    setMessageBody("");
    setPortalNotice("Deine Leistungsanfrage wurde gesendet.");
  }

  function savePortalProfile() {
    if (!customer) return;
    onUpdateCustomer(customer.id, {
      email: portalProfileEmail || customer.email,
      phone: portalProfilePhone || customer.phone,
    });
    setPortalNotice("Deine Stammdaten wurden gespeichert.");
  }

  if (!customer) {
    return (
      <section className="portal-shell portal-login-shell">
        <div className="portal-login panel">
          <div className="portal-login-brand">
            <Image alt="Kolaretorp Service AB" height={42} priority src="/kolaretorp-logo.png" width={280} />
            <h1>Välkommen im Kundenportal</h1>
          </div>
          <div className="panel-title">
            <div>
              <p>Kundenportal</p>
              <h2>Anmelden</h2>
              <span>Du siehst hier deine Objekte, Berichte, Nachrichten und Rechnungsinformationen.</span>
            </div>
          </div>
          {portalNotice && <div className="warning-line">{portalNotice}</div>}
          <label>
            <span>E-Mail-Adresse</span>
            <input placeholder="kunde@example.com" type="email" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} />
          </label>
          <label>
            <span>Passwort</span>
            <input placeholder="Portal-Passwort" type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} />
          </label>
          <button className="primary-button portal-login-button" onClick={login} type="button">
            <KeyRound size={16} />
            Einloggen
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="portal-shell">
      <div className="portal-head panel">
        <div>
          <p>Kundenportal</p>
          <h2>{customer.name}</h2>
          <span>{customer.contact} · {customer.email}</span>
        </div>
        <button
          className="ghost-button"
          onClick={() => {
            setCustomerId("");
            setLoginPassword("");
          }}
          type="button"
        >
          <LogOut size={16} />
          Abmelden
        </button>
      </div>

      {portalNotice && <div className="warning-line">{portalNotice}</div>}

      <div className="portal-grid">
        <section className="panel portal-wide">
          <div className="panel-title">
            <div>
              <p>Deine Stammdaten</p>
              <h2>Kontakt und Rechnungsadresse</h2>
            </div>
          </div>
          <div className="portal-master-data">
            <div>
              <span>Kunde</span>
              <strong>{customer.name}</strong>
            </div>
            <div>
              <span>Ansprechpartner</span>
              <strong>{customer.contact}</strong>
            </div>
            <div>
              <span>E-Mail</span>
              <input value={portalProfileEmail || customer.email} onChange={(event) => setPortalProfileEmail(event.target.value)} />
            </div>
            <div>
              <span>Telefon</span>
              <input value={portalProfilePhone || customer.phone} onChange={(event) => setPortalProfilePhone(event.target.value)} />
            </div>
            <div>
              <span>Adresse / Rechnungsadresse</span>
              <strong>{customer.address}</strong>
            </div>
            <div>
              <span>Sprache</span>
              <strong>{customer.language}</strong>
            </div>
          </div>
          <button className="primary-button portal-profile-save" onClick={savePortalProfile} type="button">
            Stammdaten speichern
          </button>
        </section>

        <section className="panel portal-wide">
          <div className="panel-title">
            <div>
              <p>Objekte</p>
              <h2>Deine Ferienhäuser</h2>
            </div>
          </div>
          <div className="portal-object-list">
            {customerObjects.map((object) => (
              <button className={currentObjectId === object.id ? "active" : ""} key={object.id} onClick={() => setSelectedObjectId(object.id)} type="button">
                <ObjectThumbnail object={object} />
                <span>
                  <strong>{object.name}</strong>
                  <small>{object.address}</small>
                </span>
                <Badge value={object.status} />
              </button>
            ))}
            {customerObjects.length === 0 && <p>Dir sind noch keine Objekte zugeordnet.</p>}
          </div>
        </section>

        <section className="panel portal-wide">
          <div className="panel-title">
            <div>
              <p>Aufträge</p>
              <h2>Deine offenen Aufträge</h2>
            </div>
          </div>
          <div className="compact-list">
            {portalJobs.map((job) => {
              const occurrences = sortedByDueDate(portalOccurrenceGroups[job.id] ?? []);
              const openOccurrences = occurrences.filter((occurrence) => !["erledigt", "abgerechnet", "storniert"].includes(occurrence.status));
              const isRecurring = isSeriesMaster(job);
              const summary = isRecurring ? seriesSummary(job, occurrences, reports) : null;
              const isExpanded = expandedPortalSeriesIds.includes(job.id);

              return (
                <article className="portal-job-item" key={job.id}>
                  <div>
                    <strong>{job.title}</strong>
                    <span>{objects.find((object) => object.id === job.objectId)?.name ?? "Objekt"} · {isRecurring && summary ? summary.rhythm : job.dueDate}</span>
                  </div>
                  {isRecurring && summary ? (
                    <div className="portal-series-summary">
                      <Badge value="Serienauftrag" />
                      <small>Letzter: {summary.lastDone}</small>
                      <small>Nächster: {summary.nextStatus} {summary.nextDate}</small>
                      <button className="icon-button" onClick={() => togglePortalSeries(job.id)} type="button">
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    </div>
                  ) : (
                    <Badge value={readableJobStatus(job.status)} />
                  )}
                  {isRecurring && isExpanded && (
                    <div className="portal-series-occurrences">
                      {openOccurrences.map((occurrence) => (
                        <div key={occurrence.id}>
                          <span>{occurrence.dueDate}</span>
                          <Badge value={readableJobStatus(occurrence.status)} />
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
            {portalJobs.length === 0 && <p>Aktuell sind keine offenen Aufträge für dich vorhanden.</p>}
          </div>
        </section>

        <section className="panel portal-wide">
          <div className="panel-title">
            <div>
              <p>Leistung anfragen</p>
              <h2>Schreib uns eine Nachricht</h2>
            </div>
          </div>
          <div className="form-grid portal-form">
            <label>
              <span>Objekt</span>
              <select value={currentObjectId} onChange={(event) => setSelectedObjectId(event.target.value)}>
                {customerObjects.map((object) => <option key={object.id} value={object.id}>{object.name}</option>)}
              </select>
            </label>
            <label className="wide">
              <span>Betreff</span>
              <input placeholder="z.B. Reinigung, Gartenpflege oder Reparatur" value={messageSubject} onChange={(event) => setMessageSubject(event.target.value)} />
            </label>
            <label className="wide">
              <span>Nachricht</span>
              <textarea placeholder="Bitte beschreibe kurz, welche Leistung du wünschst." value={messageBody} onChange={(event) => setMessageBody(event.target.value)} />
            </label>
            <button className="primary-button wide" disabled={!currentObjectId || !messageBody.trim()} onClick={() => void submitMessage()} type="button">
              <Mail size={16} />
              Anfrage senden
            </button>
          </div>
        </section>

        <section className="panel portal-wide">
          <div className="panel-title">
            <div>
              <p>Berichte</p>
              <h2>Einsatzberichte</h2>
            </div>
          </div>
          <div className="compact-list portal-report-list">
            {portalReports.map((report) => (
              <button
                className={selectedPortalReportId === report.id ? "active" : ""}
                key={report.id}
                onClick={() => setSelectedPortalReportId(report.id)}
                type="button"
              >
                <FileText size={16} />
                <span>
                  <strong>{report.title}</strong>
                  <small>{objects.find((object) => object.id === report.objectId)?.name ?? "Objekt"} · {report.date}</small>
                </span>
                <Badge value={report.sentAt ? "gesendet" : "Bericht"} />
              </button>
            ))}
            {portalReports.length === 0 && <p>Für dich sind noch keine Berichte freigegeben.</p>}
          </div>
        </section>

        {selectedPortalReport && selectedPortalReportObject && (
          <section className="panel portal-wide portal-report-detail">
            <div className="history-detail-head">
              <div>
                <h3>{selectedPortalReport.title}</h3>
                <span>{selectedPortalReportObject.name} · {selectedPortalReport.date}</span>
              </div>
              <IconAction label={`PDF für ${selectedPortalReport.title} herunterladen`} onClick={() => void downloadCustomerReportPdf(selectedPortalReport, selectedPortalReportObject, selectedPortalReportJob, customer)}><FileDown size={16} /></IconAction>
            </div>
            <CustomerReportCard
              customer={customer}
              job={selectedPortalReportJob}
              object={selectedPortalReportObject}
              report={selectedPortalReport}
              sentAt={selectedPortalReport.sentAt}
            />
          </section>
        )}

        <section className="panel portal-wide">
          <div className="panel-title">
            <div>
              <p>Rechnungen</p>
              <h2>Rechnungsübersicht</h2>
              <span>Vorbereitet für das kommende Rechnungsmodul.</span>
            </div>
          </div>
          <div className="compact-list">
            {portalBilling.map((item) => (
              <article key={item.id}>
                <strong>{item.label}</strong>
                <span>{objects.find((object) => object.id === item.objectId)?.name ?? "Objekt"} · {item.source}</span>
                <Badge value={item.status} />
              </article>
            ))}
            {portalBilling.length === 0 && <p>Für dich sind noch keine Rechnungspositionen freigegeben.</p>}
          </div>
        </section>

        <section className="panel portal-wide">
          <div className="panel-title">
            <div>
              <p>Kommunikation</p>
              <h2>Nachrichtenverlauf</h2>
            </div>
          </div>
          <div className="compact-list">
            {portalMessages.map((message) => (
              <article key={message.id}>
                <strong>{message.subject}</strong>
                <span>{objects.find((object) => object.id === message.objectId)?.name ?? "Objekt"} · {message.createdAt}</span>
                <Badge value={message.status} />
              </article>
            ))}
            {portalMessages.length === 0 && <p>Du hast noch keine Nachrichten gesendet.</p>}
          </div>
        </section>
      </div>
    </section>
  );
}

function MasterDataView({
  customers,
  objects,
  services,
  setServices,
  packages,
  setPackages,
}: {
  customers: CustomerRecord[];
  objects: ObjectRecord[];
  services: ServiceItem[];
  setServices: (services: ServiceItem[]) => void;
  packages: ServicePackage[];
  setPackages: (packages: ServicePackage[]) => void;
}) {
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [archiveNotice, setArchiveNotice] = useState("");
  const [serviceForm, setServiceForm] = useState({
    name: "",
    category: "",
    unit: "",
    price: "",
    currency: "SEK",
    description: "",
    checklist: [] as ServiceChecklistItem[],
  });
  const [serviceChecklistForm, setServiceChecklistForm] = useState({
    title: "",
    note: "",
    defaultMinutes: "",
  });
  const [packageForm, setPackageForm] = useState({
    name: "",
    price: "",
    description: "",
    serviceIds: [] as string[],
  });
  const activeServices = services.filter((service) => !service.archived);
  const archivedServices = services.filter((service) => service.archived);
  const activePackages = packages.filter((servicePackage) => !servicePackage.archived);
  const archivedPackages = packages.filter((servicePackage) => servicePackage.archived);
  const categories = Array.from(new Set(activeServices.map((service) => service.category).filter(Boolean)))
    .sort((first, second) => first.localeCompare(second, "de"));
  const serviceUnits = Array.from(new Set(activeServices.map((service) => service.unit).filter(Boolean)))
    .sort((first, second) => first.localeCompare(second, "de"));
  const groupedServices = categories.map((category) => ({
    category,
    services: activeServices
      .filter((service) => service.category === category)
      .sort((first, second) => first.name.localeCompare(second.name, "de")),
  }));
  const selectedPackageServices = packageForm.serviceIds
    .map((id) => activeServices.find((service) => service.id === id))
    .filter(Boolean) as ServiceItem[];

  function resetServiceForm() {
    setEditingServiceId(null);
    setServiceForm({ name: "", category: "", unit: "", price: "", currency: "SEK", description: "", checklist: [] });
    setServiceChecklistForm({ title: "", note: "", defaultMinutes: "" });
  }

  function editService(service: ServiceItem) {
    setEditingServiceId(service.id);
    setServiceForm({
      name: service.name,
      category: service.category,
      unit: service.unit,
      price: service.price,
      currency: service.currency || "SEK",
      description: service.description,
      checklist: service.checklist ?? [],
    });
  }

  function addServiceChecklistItem() {
    if (!serviceChecklistForm.title.trim()) {
      setArchiveNotice("Bitte für den Checklistenpunkt mindestens einen Titel erfassen.");
      return;
    }

    setServiceForm({
      ...serviceForm,
      checklist: [
        ...serviceForm.checklist,
        {
          id: `SCL-${Date.now()}`,
          title: serviceChecklistForm.title.trim(),
          note: serviceChecklistForm.note.trim() || "Hinweis vor Ort ergänzen.",
          defaultMinutes: Number(serviceChecklistForm.defaultMinutes) || 0,
        },
      ],
    });
    setServiceChecklistForm({ title: "", note: "", defaultMinutes: "" });
  }

  function removeServiceChecklistItem(id: string) {
    setServiceForm({
      ...serviceForm,
      checklist: serviceForm.checklist.filter((item) => item.id !== id),
    });
  }

  function saveService() {
    if (!serviceForm.name.trim() || !serviceForm.category.trim() || !serviceForm.unit.trim()) {
      setArchiveNotice("Bitte Leistung, Kategorie und Einheit ausfüllen. Diese Felder sind Pflichtfelder.");
      return;
    }

    const existingService = services.find((service) => service.id === editingServiceId);
    const saved: ServiceItem = {
      id: editingServiceId ?? `SVC-${Date.now()}`,
      name: serviceForm.name.trim(),
      category: serviceForm.category.trim(),
      unit: serviceForm.unit.trim(),
      price: serviceForm.price.trim() || "0",
      currency: serviceForm.currency,
      description: serviceForm.description.trim() || "Beschreibung ergänzen.",
      checklist: serviceForm.checklist,
      archived: existingService?.archived ?? false,
    };

    setServices(editingServiceId ? services.map((service) => (service.id === editingServiceId ? saved : service)) : [saved, ...services]);
    resetServiceForm();
  }

  function serviceUsage(serviceId: string) {
    const linkedPackages = activePackages.filter((servicePackage) => servicePackage.serviceIds.includes(serviceId));

    return objects
      .map((object) => {
        const activePackage = linkedPackages.find((servicePackage) => servicePackage.name === object.carePackage);
        if (!activePackage) return null;

        const customer = customers.find((item) => item.id === object.ownerCustomerId || item.name === object.owner);
        return `${customer?.name ?? object.owner} · ${object.name} · Paket ${activePackage.name}`;
      })
      .filter(Boolean) as string[];
  }

  function archiveService(service: ServiceItem) {
    const usage = serviceUsage(service.id);
    if (usage.length > 0) {
      setArchiveNotice(`Leistung "${service.name}" ist noch aktiv bei: ${usage.join("; ")}. Bitte zuerst beim Kunden/Objekt entkoppeln.`);
      return;
    }

    setServices(services.map((item) => (item.id === service.id ? { ...item, archived: true } : item)));
    setPackages(packages.map((servicePackage) => ({
      ...servicePackage,
      serviceIds: servicePackage.serviceIds.filter((id) => id !== service.id),
    })));
    setArchiveNotice(`Leistung "${service.name}" wurde archiviert.`);
    if (editingServiceId === service.id) resetServiceForm();
  }

  function deleteArchivedService(service: ServiceItem) {
    if (!service.archived) return;
    setServices(services.filter((item) => item.id !== service.id));
    setPackages(packages.map((servicePackage) => ({
      ...servicePackage,
      serviceIds: servicePackage.serviceIds.filter((id) => id !== service.id),
    })));
    setArchiveNotice(`Archivierte Leistung "${service.name}" wurde endgültig gelöscht.`);
  }

  function restoreService(service: ServiceItem) {
    setServices(services.map((item) => (item.id === service.id ? { ...item, archived: false } : item)));
    setArchiveNotice(`Leistung "${service.name}" wurde wieder aktiviert.`);
  }

  function togglePackageService(id: string) {
    setPackageForm({
      ...packageForm,
      serviceIds: packageForm.serviceIds.includes(id)
        ? packageForm.serviceIds.filter((serviceId) => serviceId !== id)
        : [...packageForm.serviceIds, id],
    });
  }

  function resetPackageForm() {
    setEditingPackageId(null);
    setServicePickerOpen(false);
    setPackageForm({ name: "", price: "", description: "", serviceIds: [] });
  }

  function editPackage(servicePackage: ServicePackage) {
    setEditingPackageId(servicePackage.id);
    setPackageForm({
      name: servicePackage.name,
      price: servicePackage.price,
      description: servicePackage.description,
      serviceIds: servicePackage.serviceIds,
    });
  }

  function savePackage() {
    const existingPackage = packages.find((servicePackage) => servicePackage.id === editingPackageId);
    const saved: ServicePackage = {
      id: editingPackageId ?? `PKG-${Date.now()}`,
      name: packageForm.name.trim() || "Neues Paket",
      price: packageForm.price.trim() || "0 SEK/Jahr",
      description: packageForm.description.trim() || "Paketbeschreibung ergänzen.",
      serviceIds: packageForm.serviceIds,
      archived: existingPackage?.archived ?? false,
    };

    setPackages(editingPackageId ? packages.map((servicePackage) => (servicePackage.id === editingPackageId ? saved : servicePackage)) : [saved, ...packages]);
    resetPackageForm();
  }

  function archivePackage(servicePackage: ServicePackage) {
    const usage = objects
      .filter((object) => object.carePackage === servicePackage.name)
      .map((object) => {
        const customer = customers.find((item) => item.id === object.ownerCustomerId || item.name === object.owner);
        return `${customer?.name ?? object.owner} · ${object.name}`;
      });

    if (usage.length > 0) {
      setArchiveNotice(`Paket "${servicePackage.name}" ist noch aktiv bei: ${usage.join("; ")}. Bitte zuerst beim Kunden/Objekt entkoppeln.`);
      return;
    }

    setPackages(packages.map((item) => (item.id === servicePackage.id ? { ...item, archived: true } : item)));
    setArchiveNotice(`Paket "${servicePackage.name}" wurde archiviert.`);
    if (editingPackageId === servicePackage.id) resetPackageForm();
  }

  function deleteArchivedPackage(servicePackage: ServicePackage) {
    if (!servicePackage.archived) return;
    setPackages(packages.filter((item) => item.id !== servicePackage.id));
    setArchiveNotice(`Archiviertes Paket "${servicePackage.name}" wurde endgültig gelöscht.`);
  }

  function restorePackage(servicePackage: ServicePackage) {
    setPackages(packages.map((item) => (item.id === servicePackage.id ? { ...item, archived: false } : item)));
    setArchiveNotice(`Paket "${servicePackage.name}" wurde wieder aktiviert.`);
  }

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-title">
          <div>
            <p>Stammdaten</p>
            <h2>Leistungen einzeln erfassen</h2>
          </div>
        </div>
        {archiveNotice && <p className="archive-notice">{archiveNotice}</p>}
        <div className="form-grid compact-form">
          <label><span>Leistung</span><input required value={serviceForm.name} onChange={(event) => setServiceForm({ ...serviceForm, name: event.target.value })} /></label>
          <label><span>Kategorie</span><input list="service-categories" onClick={(event) => event.currentTarget.showPicker?.()} onFocus={(event) => event.currentTarget.showPicker?.()} required value={serviceForm.category} onChange={(event) => setServiceForm({ ...serviceForm, category: event.target.value })} /></label>
          <datalist id="service-categories">
            {categories.map((category) => <option key={category} value={category} />)}
          </datalist>
          <label><span>Einheit</span><input list="service-units" onClick={(event) => event.currentTarget.showPicker?.()} onFocus={(event) => event.currentTarget.showPicker?.()} required value={serviceForm.unit} onChange={(event) => setServiceForm({ ...serviceForm, unit: event.target.value })} /></label>
          <datalist id="service-units">
            {serviceUnits.map((unit) => <option key={unit} value={unit} />)}
          </datalist>
          <div className="price-currency-row">
            <label><span>Preis</span><input value={serviceForm.price} onChange={(event) => setServiceForm({ ...serviceForm, price: event.target.value })} placeholder="z.B. 595" /></label>
            <label>
              <span>Währung</span>
              <select value={serviceForm.currency} onChange={(event) => setServiceForm({ ...serviceForm, currency: event.target.value })}>
                <option>SEK</option>
                <option>EUR</option>
                <option>USD</option>
                <option>NOK</option>
                <option>DKK</option>
              </select>
            </label>
          </div>
          <label className="wide"><span>Beschreibung</span><textarea value={serviceForm.description} onChange={(event) => setServiceForm({ ...serviceForm, description: event.target.value })} /></label>
          <div className="wide service-checklist-editor">
            <span>Checkliste für Einsatz</span>
            <div className="service-checklist-form">
              <label><span>Punkt</span><input value={serviceChecklistForm.title} onChange={(event) => setServiceChecklistForm({ ...serviceChecklistForm, title: event.target.value })} placeholder="z.B. Zugang prüfen" /></label>
              <label><span>Standardzeit min.</span><input inputMode="numeric" min="0" type="number" value={serviceChecklistForm.defaultMinutes} onChange={(event) => setServiceChecklistForm({ ...serviceChecklistForm, defaultMinutes: event.target.value })} /></label>
              <label className="wide"><span>Hinweis / Info</span><textarea value={serviceChecklistForm.note} onChange={(event) => setServiceChecklistForm({ ...serviceChecklistForm, note: event.target.value })} placeholder="Was soll vor Ort geprüft oder dokumentiert werden?" /></label>
              <button className="ghost-button wide" onClick={addServiceChecklistItem} type="button">
                <Plus size={16} />
                Checklistenpunkt hinzufügen
              </button>
            </div>
            <div className="checklist-preview">
              {serviceForm.checklist.map((item) => (
                <article key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.note} · {item.defaultMinutes} min.</small>
                  </div>
                  <IconAction danger label={`Checklistenpunkt ${item.title} entfernen`} onClick={() => removeServiceChecklistItem(item.id)}><Trash2 size={16} /></IconAction>
                </article>
              ))}
              {serviceForm.checklist.length === 0 && <p>Noch keine Checklistenpunkte hinterlegt.</p>}
            </div>
          </div>
          <button className="primary-button wide" onClick={saveService} type="button">{editingServiceId ? "Leistung speichern" : "Leistung anlegen"}</button>
          {editingServiceId && <button className="ghost-button wide" onClick={resetServiceForm} type="button">Bearbeitung abbrechen</button>}
        </div>
        <div className="service-catalog">
          {activeServices.map((service) => (
            <article key={service.id}>
              <span>{service.category}</span>
              <strong>{service.name}</strong>
              <small>{service.description}</small>
              <small>{service.checklist?.length ?? 0} Checklistenpunkte</small>
              <mark>{serviceRate(service)}</mark>
              <div className="card-actions">
                <IconAction label={`Leistung ${service.name} bearbeiten`} onClick={() => editService(service)}><Pencil size={16} /></IconAction>
                <IconAction danger label={`Leistung ${service.name} archivieren`} onClick={() => archiveService(service)}><Archive size={16} /></IconAction>
              </div>
            </article>
          ))}
        </div>
        {archivedServices.length > 0 && (
          <div className="archive-section">
            <h3>Archivierte Leistungen</h3>
            <div className="table-list compact-list">
              {archivedServices.map((service) => (
                <article key={service.id}>
                  <div>
                    <strong>{service.name}</strong>
                    <span>{service.category} · {serviceRate(service)}</span>
                  </div>
                  <Badge value="archiviert" />
                  <div className="row-actions">
                    <IconAction label={`Archivierte Leistung ${service.name} bearbeiten`} onClick={() => editService(service)}><Pencil size={16} /></IconAction>
                    <IconAction label={`Archivierte Leistung ${service.name} reaktivieren`} onClick={() => restoreService(service)}><RotateCcw size={16} /></IconAction>
                  </div>
                  <IconAction danger label={`Archivierte Leistung ${service.name} löschen`} onClick={() => deleteArchivedService(service)}><Trash2 size={16} /></IconAction>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-title">
          <div>
            <p>Pakete</p>
            <h2>Mehrere Leistungen bündeln</h2>
          </div>
        </div>
        <div className="form-grid compact-form">
          <label><span>Paketname</span><input value={packageForm.name} onChange={(event) => setPackageForm({ ...packageForm, name: event.target.value })} /></label>
          <label><span>Paketpreis</span><input value={packageForm.price} onChange={(event) => setPackageForm({ ...packageForm, price: event.target.value })} placeholder="z.B. 7.990 SEK/Jahr" /></label>
          <label className="wide"><span>Paketbeschreibung</span><textarea value={packageForm.description} onChange={(event) => setPackageForm({ ...packageForm, description: event.target.value })} /></label>
          <div className="wide package-service-summary">
            <div>
              <span>Leistungen im Paket</span>
              <strong>{selectedPackageServices.length || "Keine"} ausgewählt</strong>
              <small>
                {selectedPackageServices.length > 0
                  ? selectedPackageServices.map((service) => service.name).sort((first, second) => first.localeCompare(second, "de")).join(", ")
                  : "Über Plus Leistungen aus dem Katalog auswählen"}
              </small>
            </div>
            <IconAction label="Leistungen auswählen" onClick={() => setServicePickerOpen(true)}><Plus size={18} /></IconAction>
          </div>
          <button className="primary-button wide" onClick={savePackage} type="button">{editingPackageId ? "Paket speichern" : "Paket anlegen"}</button>
          {editingPackageId && <button className="ghost-button wide" onClick={resetPackageForm} type="button">Bearbeitung abbrechen</button>}
        </div>
        <div className="service-catalog package-catalog">
          {activePackages.map((servicePackage) => (
            <article key={servicePackage.id}>
              <span>Paket</span>
              <strong>{servicePackage.name}</strong>
              <small>{servicePackage.description}</small>
              <div className="tags">
                {servicePackage.serviceIds.map((id) => {
                  const service = activeServices.find((item) => item.id === id);
                  return service ? <span key={id}>{service.name}</span> : null;
                })}
              </div>
              <mark>{servicePackage.price}</mark>
              <div className="card-actions">
                <IconAction label={`Paket ${servicePackage.name} bearbeiten`} onClick={() => editPackage(servicePackage)}><Pencil size={16} /></IconAction>
                <IconAction danger label={`Paket ${servicePackage.name} archivieren`} onClick={() => archivePackage(servicePackage)}><Archive size={16} /></IconAction>
              </div>
            </article>
          ))}
        </div>
        {archivedPackages.length > 0 && (
          <div className="archive-section">
            <h3>Archivierte Pakete</h3>
            <div className="table-list compact-list">
              {archivedPackages.map((servicePackage) => (
                <article key={servicePackage.id}>
                  <div>
                    <strong>{servicePackage.name}</strong>
                    <span>{servicePackage.price} · {servicePackage.description}</span>
                  </div>
                  <Badge value="archiviert" />
                  <div className="row-actions">
                    <IconAction label={`Archiviertes Paket ${servicePackage.name} bearbeiten`} onClick={() => editPackage(servicePackage)}><Pencil size={16} /></IconAction>
                    <IconAction label={`Archiviertes Paket ${servicePackage.name} reaktivieren`} onClick={() => restorePackage(servicePackage)}><RotateCcw size={16} /></IconAction>
                  </div>
                  <IconAction danger label={`Archiviertes Paket ${servicePackage.name} löschen`} onClick={() => deleteArchivedPackage(servicePackage)}><Trash2 size={16} /></IconAction>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
      {servicePickerOpen && (
        <div className="modal-backdrop nested-backdrop">
          <section aria-labelledby="service-picker-title" aria-modal="true" className="modal service-picker-modal" role="dialog">
            <header>
              <div>
                <p>Leistungskatalog</p>
                <h2 id="service-picker-title">Leistungen auswählen</h2>
              </div>
              <button aria-label="Leistungsauswahl schließen" onClick={() => setServicePickerOpen(false)} type="button">
                <X size={18} />
              </button>
            </header>
            <div className="service-selection-list">
              {groupedServices.map((group) => (
                <section key={group.category}>
                  <h3>{group.category}</h3>
                  {group.services.map((service) => (
                    <label key={service.id}>
                      <input checked={packageForm.serviceIds.includes(service.id)} onChange={() => togglePackageService(service.id)} type="checkbox" />
                      <span>
                        <strong>{service.name}</strong>
                        <small>{service.description}</small>
                      </span>
                      <mark>{serviceRate(service)}</mark>
                    </label>
                  ))}
                </section>
              ))}
            </div>
            <button className="primary-button" onClick={() => setServicePickerOpen(false)} type="button">Auswahl übernehmen</button>
          </section>
        </div>
      )}
    </div>
  );
}

function ObjectEditorPage({
  customers,
  jobs,
  object,
  onBack,
  onSendReport,
  onSubmit,
  onUpdateReport,
  reports,
  newObject,
  setNewObject,
  submitLabel,
}: {
  customers: CustomerRecord[];
  jobs: JobRecord[];
  object?: ObjectRecord;
  onBack: () => void;
  onSendReport: (report: ReportRecord) => void;
  onSubmit: () => void;
  onUpdateReport: (report: ReportRecord) => void;
  reports: ReportRecord[];
  newObject: NewObjectFormState;
  setNewObject: (value: NewObjectFormState) => void;
  submitLabel: string;
}) {
  const primaryImage = newObject.mediaItems.find((item) => item.type === "Bild" && item.isPrimary && item.previewUrl)
    ?? newObject.mediaItems.find((item) => item.type === "Bild" && item.previewUrl);

  return (
    <div className="object-editor-page">
      <section className="panel">
        <div className="editor-title">
          <div className="editor-title-main">
            <button className="ghost-button" onClick={onBack} type="button">
              <ArrowLeft size={16} />
              Zurück zur Objektübersicht
            </button>
          </div>
          {primaryImage?.previewUrl ? (
            <div
              aria-label="Aktuelles Objektbild"
              className="object-editor-image"
              role="img"
              style={{ backgroundImage: `url(${primaryImage.previewUrl})` }}
            />
          ) : (
            <div className="object-editor-image object-editor-image-empty">
              <Home size={26} />
              <span>Noch kein Objektbild definiert</span>
            </div>
          )}
        </div>
        <ObjectForm
          customers={customers}
          newObject={newObject}
          setNewObject={setNewObject}
          onSubmit={onSubmit}
          submitLabel={submitLabel}
        />
      </section>
      {object && <ObjectHistory customers={customers} jobs={jobs} object={object} onSendReport={onSendReport} onUpdateReport={onUpdateReport} reports={reports} />}
    </div>
  );
}

function ObjectHistory({
  customers,
  jobs,
  object,
  onSendReport,
  onUpdateReport,
  reports,
}: {
  customers: CustomerRecord[];
  jobs: JobRecord[];
  object: ObjectRecord;
  onSendReport: (report: ReportRecord) => void;
  onUpdateReport: (report: ReportRecord) => void;
  reports: ReportRecord[];
}) {
  const objectJobs = jobs.filter((job) => job.objectId === object.id);
  const objectReports = reports.filter((report) => report.objectId === object.id);
  const history = [
    ...objectJobs.map((job) => ({
      id: `job-${job.id}`,
      date: job.dueDate,
      title: job.title,
      type: "Auftrag" as const,
      job,
      report: objectReports.find((report) => report.jobId === job.id),
    })),
    ...objectReports
      .filter((report) => !objectJobs.some((job) => job.id === report.jobId))
      .map((report) => ({
        id: `report-${report.id}`,
        date: report.date,
        title: report.title,
        type: "Bericht" as const,
        job: undefined,
        report,
      })),
  ].sort((first, second) => second.date.localeCompare(first.date));
  const [selectedHistoryId, setSelectedHistoryId] = useState("");
  const selectedHistory = history.find((item) => item.id === selectedHistoryId);
  const selectedReport = selectedHistory?.report;
  const selectedJob = selectedHistory?.job;
  const reportCustomer = customers.find((customer) => customer.id === object.ownerCustomerId || customer.name === object.owner);
  const reportSubject = selectedReport ? customerReportSendSubject(selectedReport, object) : "";
  const reportPdfName = selectedHistory ? `Einsatzbericht-${object.name}-${selectedHistory.title}.pdf` : "";
  const mailBody = selectedReport ? customerReportSendBody(reportCustomer) : "";
  const sentAt = selectedReport?.sentAt ?? "";

  return (
    <section className="panel object-history">
      <div className="panel-title">
        <div>
          <p>Objektverlauf</p>
          <h2>Historie / Verlauf</h2>
          <span>{object.name}</span>
        </div>
      </div>
      <div className="history-list">
        {history.map((item) => (
          <button
            className={selectedHistory?.id === item.id ? "active" : ""}
            key={item.id}
            onClick={() => setSelectedHistoryId(selectedHistory?.id === item.id ? "" : item.id)}
            type="button"
          >
            <FileText size={15} />
            <span>
              <strong>{item.title}</strong>
              <small>{item.date} · {item.type}{item.report ? " · Bericht vorhanden" : " · ohne Bericht"}</small>
            </span>
            <Badge value={item.job?.status ?? "Bericht"} />
          </button>
        ))}
        {history.length === 0 && <p>Noch keine Aufträge oder Berichte vorhanden.</p>}
      </div>
      {selectedHistory && (
        <section className="history-detail">
          <div className="history-detail-head">
            <div>
              <h3>{selectedHistory.title}</h3>
              <span>{selectedHistory.date} · {object.name}</span>
            </div>
            <div className="row-actions">
              <IconAction label={`PDF für ${selectedHistory.title} herunterladen`} onClick={() => selectedReport && void downloadCustomerReportPdf(selectedReport, object, selectedJob, reportCustomer)}><FileDown size={16} /></IconAction>
              <IconAction
                label={`Bericht ${selectedHistory.title} an Kunden senden`}
                onClick={() => selectedReport && onSendReport(selectedReport)}
              >
                <Send size={16} />
              </IconAction>
            </div>
          </div>
          <dl>
            {selectedJob && <div><dt>Auftragstyp</dt><dd>{selectedJob.type}</dd></div>}
            {selectedJob && <div><dt>Status</dt><dd>{selectedJob.status}</dd></div>}
            {selectedJob && <div><dt>Bearbeiter</dt><dd>{selectedJob.assignedTo}</dd></div>}
            {selectedJob && <div><dt>Zeit</dt><dd>{selectedJob.workMinutes} min.</dd></div>}
            {selectedJob && <div><dt>Material</dt><dd>{selectedJob.material}</dd></div>}
            {selectedReport && <div><dt>Kundensichtbar</dt><dd>{selectedReport.visibleToCustomer ? "Ja" : "Nein"}</dd></div>}
          </dl>
          {selectedJob && (
            <div className="history-block">
              <strong>Auftragsbeschreibung</strong>
              <p>{selectedJob.description}</p>
            </div>
          )}
          {selectedReport ? (
            <>
              <CustomerReportCard customer={reportCustomer} job={selectedJob} object={object} report={selectedReport} sentAt={sentAt} />
              <div className="history-block internal">
                <strong>Interne Notizen</strong>
                <p>{selectedReport.internalNotes}</p>
              </div>
              <label className="report-comment-editor">
                <span>Kommentar vor dem Senden</span>
                <textarea
                  disabled={Boolean(sentAt)}
                  value={selectedReport.customerComment}
                  onChange={(event) => onUpdateReport({ ...selectedReport, customerComment: event.target.value })}
                  placeholder={sentAt ? "Bericht wurde bereits gesendet und ist gesperrt." : "Kommentar ergänzen, der im Kundenbericht erscheinen soll."}
                />
              </label>
              <div className="send-status">
                <strong>{sentAt ? "Gesendet" : "Noch nicht an Kunden gesendet"}</strong>
                <span>Betreff: {reportSubject}</span>
                <span>An: {reportRecipientEmail(object, reportCustomer) || "Keine E-Mail-Adresse hinterlegt"}</span>
                <span>Kopie: info@kolaretorp.se</span>
                <span>Anhang: {reportPdfName}</span>
                <span>Body: {mailBody}</span>
                {sentAt && <span>Zeitstempel: {sentAt}</span>}
              </div>
            </>
          ) : (
            <div className="history-block">
              <strong>Bericht</strong>
              <p>Für diesen Auftrag wurde noch kein Bericht erzeugt.</p>
            </div>
          )}
        </section>
      )}
    </section>
  );
}

function ObjectForm({
  customers,
  newObject,
  setNewObject,
  onSubmit,
  submitLabel,
}: {
  customers: CustomerRecord[];
  newObject: NewObjectFormState;
  setNewObject: (value: NewObjectFormState) => void;
  onSubmit: () => void;
  submitLabel: string;
}) {
  const photoItems = newObject.mediaItems.filter((item) => item.type === "Bild");
  const fileItems = newObject.mediaItems.filter((item) => item.type !== "Bild");
  const [previewDocument, setPreviewDocument] = useState<MediaItem | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<MediaItem | null>(null);

  function update(key: keyof typeof newObject, value: string) {
    setNewObject({ ...newObject, [key]: value });
  }

  function selectOwner(customerId: string) {
    const customer = customers.find((item) => item.id === customerId);
    if (!customer) {
      setNewObject({ ...newObject, ownerCustomerId: "" });
      return;
    }

    setNewObject({
      ...newObject,
      ownerCustomerId: customer.id,
      owner: customer.name,
      ownerEmail: customer.email,
      ownerPhone: customer.phone,
      ownerAddress: customer.address,
      billingAddress: newObject.billingAddressMode === "Eigentümeradresse" ? customer.address : newObject.billingAddress,
    });
  }

  function updateBillingMode(mode: ObjectRecord["billingAddressMode"]) {
    setNewObject({
      ...newObject,
      billingAddressMode: mode,
      billingAddress:
        mode === "Objektadresse"
          ? newObject.address
          : mode === "Eigentümeradresse"
            ? newObject.ownerAddress
            : newObject.billingAddress,
    });
  }

  async function addMedia(files: FileList | null, type: MediaItem["type"], source: MediaItem["source"]) {
    if (!files?.length) return;

    const hasPrimaryImage = newObject.mediaItems.some((item) => item.type === "Bild" && item.isPrimary);
    const added = await Promise.all(Array.from(files).map(async (file, index) => ({
      id: `MED-${Date.now()}-${index}-${file.name}`,
      type,
      name: file.name,
      description: type === "Dokument" ? newObject.documentDescription.trim() : "",
      source,
      previewUrl: type === "Bild" ? await fileToImagePreview(file, 900, 0.62) : await fileToDocumentPreview(file),
      isPrimary: type === "Bild" && !hasPrimaryImage && index === 0,
    })));
    const mediaItems = [...newObject.mediaItems, ...added];

    setNewObject({
      ...newObject,
      mediaItems,
      images: String(mediaItems.filter((item) => item.type === "Bild").length),
      documents: String(mediaItems.filter((item) => item.type === "Dokument").length),
      floorPlans: String(mediaItems.filter((item) => item.type === "Grundriss").length),
      documentDescription: type === "Dokument" ? "" : newObject.documentDescription,
    });
  }

  function updateMediaDescription(id: string, description: string) {
    setNewObject({
      ...newObject,
      mediaItems: newObject.mediaItems.map((item) => (item.id === id ? { ...item, description } : item)),
    });
  }

  function removeMedia(id: string) {
    const removed = newObject.mediaItems.find((item) => item.id === id);
    const remainingItems = newObject.mediaItems.filter((item) => item.id !== id);
    const nextPrimaryImageId = removed?.isPrimary && !remainingItems.some((item) => item.type === "Bild" && item.isPrimary)
      ? remainingItems.find((item) => item.type === "Bild")?.id
      : undefined;
    const mediaItems = remainingItems.map((item) => (
      item.id === nextPrimaryImageId ? { ...item, isPrimary: true } : item
    ));

    setNewObject({
      ...newObject,
      mediaItems,
      images: String(mediaItems.filter((item) => item.type === "Bild").length),
      documents: String(mediaItems.filter((item) => item.type === "Dokument").length),
      floorPlans: String(mediaItems.filter((item) => item.type === "Grundriss").length),
    });
  }

  function setPrimaryImage(id: string) {
    setNewObject({
      ...newObject,
      mediaItems: newObject.mediaItems.map((item) => ({ ...item, isPrimary: item.id === id && item.type === "Bild" })),
    });
  }

  function moveMedia(id: string, direction: -1 | 1) {
    const index = newObject.mediaItems.findIndex((item) => item.id === id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= newObject.mediaItems.length) return;

    const mediaItems = [...newObject.mediaItems];
    [mediaItems[index], mediaItems[targetIndex]] = [mediaItems[targetIndex], mediaItems[index]];
    setNewObject({ ...newObject, mediaItems });
  }

  return (
    <div className="form-grid">
      <h3>Basisdaten</h3>
      <label><span>Objekt</span><input value={newObject.name} onChange={(event) => update("name", event.target.value)} /></label>
      <label><span>Status</span>
        <select value={newObject.status} onChange={(event) => update("status", event.target.value)}>
          <option>Saison aktiv</option>
          <option>Kontrolle offen</option>
          <option>Winterruhe</option>
        </select>
      </label>
      <label className="wide">
        <span>Eigentümer aus Kunden</span>
        <select value={newObject.ownerCustomerId} onChange={(event) => selectOwner(event.target.value)}>
          <option value="">Manuell pflegen</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>{customer.name}</option>
          ))}
        </select>
      </label>
      <label><span>Eigentümer</span><input value={newObject.owner} onChange={(event) => update("owner", event.target.value)} /></label>
      <label><span>E-Mail Eigentümer</span><input type="email" value={newObject.ownerEmail} onChange={(event) => update("ownerEmail", event.target.value)} /></label>
      <label><span>Telefon Eigentümer</span><input value={newObject.ownerPhone} onChange={(event) => update("ownerPhone", event.target.value)} /></label>
      <label><span>Ort/Region</span><input value={newObject.region} onChange={(event) => update("region", event.target.value)} /></label>
      <label className="wide"><span>Eigentümeradresse</span><input value={newObject.ownerAddress} onChange={(event) => update("ownerAddress", event.target.value)} /></label>
      <label className="wide"><span>Objektadresse</span><input value={newObject.address} onChange={(event) => update("address", event.target.value)} /></label>
      <label>
        <span>Rechnungsadresse verwenden</span>
        <select value={newObject.billingAddressMode} onChange={(event) => updateBillingMode(event.target.value as ObjectRecord["billingAddressMode"])}>
          <option>Eigentümeradresse</option>
          <option>Objektadresse</option>
          <option>Abweichend</option>
        </select>
      </label>
      <label>
        <span>Rechnungsadresse</span>
        <input
          disabled={newObject.billingAddressMode !== "Abweichend"}
          value={newObject.billingAddressMode === "Objektadresse" ? newObject.address : newObject.billingAddressMode === "Eigentümeradresse" ? newObject.ownerAddress : newObject.billingAddress}
          onChange={(event) => update("billingAddress", event.target.value)}
        />
      </label>
      <h3>Objektmerkmale</h3>
      <label><span>Größe m²</span><input type="number" value={newObject.sizeSqm} onChange={(event) => update("sizeSqm", event.target.value)} /></label>
      <label><span>Grundstück m²</span><input type="number" value={newObject.plotSqm} onChange={(event) => update("plotSqm", event.target.value)} /></label>
      <label><span>Baujahr</span><input type="number" value={newObject.buildYear} onChange={(event) => update("buildYear", event.target.value)} /></label>
      <label><span>Zimmer</span><input type="number" value={newObject.rooms} onChange={(event) => update("rooms", event.target.value)} /></label>
      <label><span>Betten</span><input type="number" value={newObject.beds} onChange={(event) => update("beds", event.target.value)} /></label>
      <label><span>Bäder</span><input type="number" value={newObject.bathrooms} onChange={(event) => update("bathrooms", event.target.value)} /></label>
      <label>
        <span>Betreuungspaket</span>
        <select value={newObject.carePackage} onChange={(event) => update("carePackage", event.target.value)}>
          <option>Basis</option>
          <option>Plus</option>
          <option>Komfort</option>
          <option>Premium</option>
        </select>
      </label>
      <h3>Zugang & Technik</h3>
      <label><span>Zugang / Schlüssel</span><textarea value={newObject.keySafe} onChange={(event) => update("keySafe", event.target.value)} /></label>
      <label><span>Alarmanlage</span><textarea value={newObject.alarm} onChange={(event) => update("alarm", event.target.value)} /></label>
      <label><span>Parken</span><textarea value={newObject.parking} onChange={(event) => update("parking", event.target.value)} /></label>
      <label><span>Zugangshinweise</span><textarea value={newObject.accessNotes} onChange={(event) => update("accessNotes", event.target.value)} /></label>
      <label><span>Heizung</span><input value={newObject.heating} onChange={(event) => update("heating", event.target.value)} /></label>
      <label><span>Wasser</span><input value={newObject.water} onChange={(event) => update("water", event.target.value)} /></label>
      <label><span>Abwasser</span><input value={newObject.septic} onChange={(event) => update("septic", event.target.value)} /></label>
      <label><span>Internet</span><input value={newObject.internet} onChange={(event) => update("internet", event.target.value)} /></label>
      <h3>Dokumentation & Planung</h3>
      <section className="wide object-attachment-section">
        <div className="attachment-section-head">
          <div>
            <h3>Fotos zum Objekt</h3>
            <span>{photoItems.length} Fotos</span>
          </div>
          <label className="ghost-button attachment-upload">
            <Camera size={16} />
            Neues Foto hinzufügen
            <input aria-label="Neues Foto hinzufügen" accept="image/*" capture="environment" multiple type="file" onChange={(event) => void addMedia(event.target.files, "Bild", "Kamera")} />
          </label>
        </div>
        {photoItems.length > 0 ? (
          <div className="object-photo-gallery">
            {photoItems.map((item) => (
              <article className={item.isPrimary ? "primary" : ""} key={item.id}>
                <button
                  aria-label={`Foto ${item.name} Vorschau öffnen`}
                  className="object-photo-tile"
                  onClick={() => setPreviewPhoto(item)}
                  style={{ backgroundImage: `url(${item.previewUrl})` }}
                  type="button"
                />
                <input
                  aria-label={`Kurzbeschreibung ${item.name}`}
                  placeholder="Kurzbeschreibung zum Foto"
                  value={item.description}
                  onChange={(event) => updateMediaDescription(item.id, event.target.value)}
                />
                <div className="row-actions">
                  <IconAction label={`${item.name} nach oben verschieben`} onClick={() => moveMedia(item.id, -1)}><ArrowUp size={16} /></IconAction>
                  <IconAction label={`${item.name} nach unten verschieben`} onClick={() => moveMedia(item.id, 1)}><ArrowDown size={16} /></IconAction>
                  <IconAction label={`${item.name} Vorschau öffnen`} onClick={() => setPreviewPhoto(item)}><FileText size={16} /></IconAction>
                  <IconAction label={`${item.name} als Objektbild verwenden`} onClick={() => setPrimaryImage(item.id)}><Home size={16} /></IconAction>
                  <IconAction danger label={`Datei ${item.name} entfernen`} onClick={() => removeMedia(item.id)}><Trash2 size={16} /></IconAction>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-attachment">Noch keine Fotos zum Objekt vorhanden.</p>
        )}
      </section>
      <section className="wide object-attachment-section">
        <div className="attachment-section-head">
          <div>
            <h3>Dokumente zum Objekt</h3>
            <span>{fileItems.length} Dokumente und Grundrisse</span>
          </div>
          <label className="ghost-button attachment-upload">
            <Paperclip size={16} />
            Dokument hinzufügen
            <input aria-label="Dokument hinzufügen" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,image/*" multiple type="file" onChange={(event) => void addMedia(event.target.files, "Dokument", "Upload")} />
          </label>
        </div>
        <label className="wide document-description-field">
          <span>Kurzbeschreibung zum nächsten Dokument</span>
          <input value={newObject.documentDescription} onChange={(event) => update("documentDescription", event.target.value)} placeholder="z.B. Energieausweis, Versicherung, Schlüsselprotokoll" />
        </label>
        {fileItems.length > 0 ? (
          <div className="media-list">
          {fileItems.map((item) => (
            <article key={item.id}>
              <button className="media-thumb media-thumb-empty" onClick={() => setPreviewDocument(item)} type="button" aria-label={`${item.name} Vorschau öffnen`}>
                <FileText size={16} />
              </button>
              <div>
                <button className="document-preview-link" onClick={() => setPreviewDocument(item)} type="button">
                  <strong>{item.type}: {item.name}</strong>
                </button>
                <span>{item.source}</span>
              </div>
              <input
                aria-label={`Kurzbeschreibung ${item.name}`}
                placeholder="Kurzbeschreibung"
                value={item.description}
                onChange={(event) => updateMediaDescription(item.id, event.target.value)}
              />
              <div className="row-actions">
                <IconAction label={`${item.name} Vorschau öffnen`} onClick={() => setPreviewDocument(item)}><FileText size={16} /></IconAction>
                <IconAction label={`${item.name} nach oben verschieben`} onClick={() => moveMedia(item.id, -1)}><ArrowUp size={16} /></IconAction>
                <IconAction label={`${item.name} nach unten verschieben`} onClick={() => moveMedia(item.id, 1)}><ArrowDown size={16} /></IconAction>
              </div>
              <IconAction danger label={`Datei ${item.name} entfernen`} onClick={() => removeMedia(item.id)}><Trash2 size={16} /></IconAction>
            </article>
          ))}
          </div>
        ) : (
          <p className="empty-attachment">Noch keine Dokumente zum Objekt vorhanden.</p>
        )}
      </section>
      {previewDocument && (
        <div className="modal-backdrop nested-backdrop">
          <section aria-labelledby="document-preview-title" aria-modal="true" className="modal document-preview-modal" role="dialog">
            <header>
              <div>
                <p>Dokumentvorschau</p>
                <h2 id="document-preview-title">{previewDocument.name}</h2>
              </div>
              <button aria-label="Dokumentvorschau schließen" onClick={() => setPreviewDocument(null)} type="button">
                <X size={18} />
              </button>
            </header>
            <article className="printable-document">
              <div className="document-preview-meta">
                <span>{previewDocument.type}</span>
                <strong>{previewDocument.name}</strong>
                <small>{previewDocument.description || "Keine Kurzbeschreibung hinterlegt."}</small>
              </div>
              <DocumentPreview item={previewDocument} />
            </article>
            <div className="modal-actions">
              <button className="ghost-button" onClick={() => setPreviewDocument(null)} type="button">Schließen</button>
              <button className="primary-button" onClick={() => window.print()} type="button">
                <Printer size={16} />
                Drucken
              </button>
            </div>
          </section>
        </div>
      )}
      {previewPhoto && (
        <div className="modal-backdrop nested-backdrop">
          <section aria-labelledby="photo-preview-title" aria-modal="true" className="modal document-preview-modal" role="dialog">
            <header>
              <div>
                <p>Fotovorschau</p>
                <h2 id="photo-preview-title">{previewPhoto.name}</h2>
              </div>
              <button aria-label="Fotovorschau schließen" onClick={() => setPreviewPhoto(null)} type="button">
                <X size={18} />
              </button>
            </header>
            <article className="printable-document">
              <div className="document-preview-meta">
                <span>Bild</span>
                <strong>{previewPhoto.name}</strong>
                <small>{previewPhoto.description || "Keine Kurzbeschreibung hinterlegt."}</small>
              </div>
              {previewPhoto.previewUrl ? (
                <img alt={`Vorschau ${previewPhoto.name}`} className="document-preview-image" src={previewPhoto.previewUrl} />
              ) : (
                <div className="document-preview-placeholder">
                  <Camera size={34} />
                  <strong>Keine Bildvorschau verfügbar</strong>
                  <span>Das Foto ist als Eintrag vorhanden, aber ohne gespeicherte Vorschau.</span>
                </div>
              )}
            </article>
            <div className="modal-actions">
              <button className="ghost-button" onClick={() => setPreviewPhoto(null)} type="button">Schließen</button>
              <button className="primary-button" onClick={() => window.print()} type="button">
                <Printer size={16} />
                Drucken
              </button>
            </div>
          </section>
        </div>
      )}
      <label><span>Letzter Besuch</span><input value={newObject.lastVisit} onChange={(event) => update("lastVisit", event.target.value)} /></label>
      <label><span>Nächster Besuch</span><input value={newObject.nextVisit} onChange={(event) => update("nextVisit", event.target.value)} /></label>
      <label className="wide"><span>Ausstattung</span><textarea value={newObject.equipment} onChange={(event) => update("equipment", event.target.value)} placeholder="Pool, Sauna, Kamin" /></label>
      <label className="wide"><span>Hinweise / Risiken</span><textarea value={newObject.risks} onChange={(event) => update("risks", event.target.value)} /></label>
      <button className="primary-button wide" onClick={onSubmit} type="button">{submitLabel}</button>
    </div>
  );
}

function DocumentPreview({ item }: { item: MediaItem }) {
  const source = item.previewUrl ?? "";
  const lowerName = item.name.toLowerCase();
  const isImage = source.startsWith("data:image/");
  const isPdf = source.startsWith("data:application/pdf") || lowerName.endsWith(".pdf");
  const isText = source.startsWith("data:text/");

  if (isImage && source) {
    return <img alt={`Vorschau ${item.name}`} className="document-preview-image" src={source} />;
  }

  if (isPdf && source) {
    return <iframe className="document-preview-frame" src={source} title={`Vorschau ${item.name}`} />;
  }

  if (isText && source) {
    return <iframe className="document-preview-frame" src={source} title={`Vorschau ${item.name}`} />;
  }

  return (
    <div className="document-preview-placeholder">
      <FileText size={34} />
      <strong>Keine direkte Vorschau verfügbar</strong>
      <span>Das Dokument ist hinterlegt. Für große oder Office-Dateien wird eine Metadaten-Vorschau angezeigt.</span>
    </div>
  );
}

function CustomerForm({
  customer,
  setCustomer,
  objects,
  onSubmit,
  submitLabel,
}: {
  customer: CustomerFormState;
  setCustomer: (value: CustomerFormState) => void;
  objects: ObjectRecord[];
  onSubmit: () => void;
  submitLabel: string;
}) {
  function update(key: keyof CustomerFormState, value: string | string[]) {
    setCustomer({ ...customer, [key]: value } as CustomerFormState);
  }

  function assignObject(id: string) {
    if (!id || customer.objects.includes(id)) return;
    update("objects", [...customer.objects, id]);
  }

  function removeObject(id: string) {
    update("objects", customer.objects.filter((objectId) => objectId !== id));
  }

  const availableObjects = objects.filter((object) => !customer.objects.includes(object.id));
  const assignedObjects = objects.filter((object) => customer.objects.includes(object.id));

  return (
    <div className="form-grid">
      <h3>Kundendaten</h3>
      <label><span>Kunde</span><input value={customer.name} onChange={(event) => update("name", event.target.value)} /></label>
      <label><span>Ansprechpartner</span><input value={customer.contact} onChange={(event) => update("contact", event.target.value)} /></label>
      <label><span>E-Mail</span><input type="email" value={customer.email} onChange={(event) => update("email", event.target.value)} /></label>
      <label><span>Telefon</span><input value={customer.phone} onChange={(event) => update("phone", event.target.value)} /></label>
      <label className="wide"><span>Eigentümeradresse / Rechnungsadresse</span><input value={customer.address} onChange={(event) => update("address", event.target.value)} /></label>
      <label><span>Sprache</span><input value={customer.language} onChange={(event) => update("language", event.target.value)} /></label>
      <label>
        <span>Portalstatus</span>
        <select value={customer.portalStatus} onChange={(event) => update("portalStatus", event.target.value)}>
          <option>aktiv</option>
          <option>einladen</option>
          <option>gesperrt</option>
        </select>
      </label>
      <h3>Portalzugang</h3>
      <label><span>Login-E-Mail</span><input type="email" value={customer.portalLoginEmail} onChange={(event) => update("portalLoginEmail", event.target.value)} /></label>
      <label><span>Portal-Passwort</span><input value={customer.portalPassword} onChange={(event) => update("portalPassword", event.target.value)} /></label>
      <div className="wide portal-login-history">
        <span>Login-Verlauf Kundenportal</span>
        {(customer.portalLoginHistory ?? []).length > 0 ? (
          <div>
            {(customer.portalLoginHistory ?? []).map((entry) => (
              <article key={entry.id}>
                <strong>{entry.loggedAt}</strong>
                <span>{entry.email}</span>
                <small>{entry.userAgent}</small>
              </article>
            ))}
          </div>
        ) : (
          <p>Noch keine Kundenportal-Logins protokolliert.</p>
        )}
      </div>
      <label><span>Saldo</span><input value={customer.balance} onChange={(event) => update("balance", event.target.value)} /></label>
      <label className="wide"><span>Notizen / interne Info</span><textarea value={customer.notes} onChange={(event) => update("notes", event.target.value)} /></label>
      <label className="wide">
        <span>Mailtext Einsatzbericht</span>
        <textarea
          value={customer.reportMailBody}
          onChange={(event) => update("reportMailBody", event.target.value)}
          placeholder={defaultReportMailBody}
        />
      </label>
      <label className="wide">
        <span>Objekt zuordnen</span>
        <select value="" onChange={(event) => assignObject(event.target.value)}>
          <option value="">Objekt auswählen</option>
          {availableObjects.map((object) => (
            <option key={object.id} value={object.id}>{object.name} · {object.address}</option>
          ))}
        </select>
      </label>
      <div className="wide check-list">
        <span>Zugeordnete Objekte</span>
        {assignedObjects.map((object) => (
          <div className="assigned-row" key={object.id}>
            <p>{object.name} · {object.address}</p>
            <IconAction danger label={`Objekt ${object.name} entfernen`} onClick={() => removeObject(object.id)}><Trash2 size={16} /></IconAction>
          </div>
        ))}
        {customer.objects.length === 0 && <p>Noch keine Objekte zugeordnet.</p>}
      </div>
      <button className="primary-button wide" onClick={onSubmit} type="button">{submitLabel}</button>
    </div>
  );
}

function JobForm({
  customerMode = false,
  newJob,
  setNewJob,
  objects,
  selectedObject,
  services,
  setSelectedObjectId,
  onSubmit,
  submitLabel,
}: {
  customerMode?: boolean;
  newJob: NewJobFormState;
  setNewJob: (value: NewJobFormState) => void;
  objects: ObjectRecord[];
  selectedObject: ObjectRecord;
  services: ServiceItem[];
  setSelectedObjectId: (id: string) => void;
  onSubmit: () => void;
  submitLabel: string;
}) {
  const weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const recurrenceSummary = newJob.scheduleType === "einmalig"
    ? `Einmaliger Auftrag am ${newJob.dueDate || "gewählten Fälligkeitsdatum"}`
    : scheduleLabel({
        type: "serie",
        frequency: newJob.scheduleFrequency,
        interval: Math.max(Number(newJob.scheduleInterval) || 1, 1),
        weekdays: newJob.scheduleFrequency === "wöchentlich" ? newJob.scheduleWeekdays : [],
        end: newJob.scheduleEnd,
        endDate: newJob.scheduleEnd === "am" ? newJob.scheduleEndDate : "",
        occurrences: newJob.scheduleEnd === "nach" ? Math.max(Number(newJob.scheduleOccurrences) || 1, 1) : 0,
        activeFromMonth: newJob.scheduleActiveFromMonth ? Number(newJob.scheduleActiveFromMonth) : undefined,
        activeToMonth: newJob.scheduleActiveToMonth ? Number(newJob.scheduleActiveToMonth) : undefined,
        yearInterval: Math.max(Number(newJob.scheduleYearInterval) || 1, 1),
      });

  function update(key: keyof typeof newJob, value: string | string[]) {
    setNewJob({ ...newJob, [key]: value });
  }

  function toggleService(serviceId: string) {
    update(
      "serviceIds",
      newJob.serviceIds.includes(serviceId)
        ? newJob.serviceIds.filter((id) => id !== serviceId)
        : [...newJob.serviceIds, serviceId],
    );
  }

  function addCustomChecklistItem() {
    const title = newJob.customChecklistTitle.trim();
    if (!title) return;

    setNewJob({
      ...newJob,
      customChecklistTitle: "",
      customChecklistNote: "",
      customChecklistMinutes: "",
      customServiceChecklist: [
        ...newJob.customServiceChecklist,
        {
          id: `CUSTOM-${Date.now()}`,
          title,
          note: newJob.customChecklistNote.trim() || "Vor Ort prüfen und dokumentieren.",
          defaultMinutes: Number(newJob.customChecklistMinutes) || 0,
        },
      ],
    });
  }

  function removeCustomChecklistItem(id: string) {
    setNewJob({
      ...newJob,
      customServiceChecklist: newJob.customServiceChecklist.filter((item) => item.id !== id),
    });
  }

  function toggleWeekday(day: string) {
    update(
      "scheduleWeekdays",
      newJob.scheduleWeekdays.includes(day)
        ? newJob.scheduleWeekdays.filter((item) => item !== day)
        : [...newJob.scheduleWeekdays, day],
    );
  }

  return (
    <div className="form-grid">
      <label className="wide"><span>Titel</span><input value={newJob.title} onChange={(event) => update("title", event.target.value)} /></label>
      <label>
        <span>Objekt</span>
        <select value={selectedObject.id} onChange={(event) => setSelectedObjectId(event.target.value)}>
          {objects.map((object) => <option key={object.id} value={object.id}>{object.name}</option>)}
        </select>
      </label>
      <label><span>Typ</span><input value={newJob.type} onChange={(event) => update("type", event.target.value)} /></label>
      <label>
        <span>Priorität</span>
        <select value={newJob.priority} onChange={(event) => update("priority", event.target.value)}>
          <option>niedrig</option>
          <option>normal</option>
          <option>hoch</option>
          <option>dringend</option>
        </select>
      </label>
      <label><span>Fällig</span><input type="date" value={newJob.dueDate} onChange={(event) => update("dueDate", event.target.value)} /></label>
      {!customerMode && <label><span>Zuständig</span><input value={newJob.assignedTo} onChange={(event) => update("assignedTo", event.target.value)} /></label>}
      <section className="wide service-assignment">
        <div className="section-heading">
          <span>Leistungen im Auftrag</span>
          <strong>{newJob.serviceIds.length + (newJob.customServiceName.trim() ? 1 : 0)} ausgewählt</strong>
        </div>
        <div className="service-select-grid">
          {services.filter((service) => !service.archived).map((service) => (
            <label className="service-select-card" key={service.id}>
              <input checked={newJob.serviceIds.includes(service.id)} onChange={() => toggleService(service.id)} type="checkbox" />
              <span>
                <strong>{service.name}</strong>
                <small>{service.category} · {serviceRate(service)} · {service.checklist.length} Checkpunkte</small>
              </span>
            </label>
          ))}
        </div>
      </section>
      <section className="wide custom-service-editor">
        <div className="section-heading">
          <span>Eigene Leistung erfassen</span>
          <strong>optional</strong>
        </div>
        <div className="form-grid compact-form">
          <label><span>Leistung</span><input value={newJob.customServiceName} onChange={(event) => update("customServiceName", event.target.value)} /></label>
          <label><span>Kategorie</span><input list="job-custom-service-categories" value={newJob.customServiceCategory} onChange={(event) => update("customServiceCategory", event.target.value)} /></label>
          <datalist id="job-custom-service-categories">
            {[...new Set(services.map((service) => service.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "de")).map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
          <label><span>Einheit</span><input list="job-custom-service-units" value={newJob.customServiceUnit} onChange={(event) => update("customServiceUnit", event.target.value)} /></label>
          <datalist id="job-custom-service-units">
            {[...new Set(services.map((service) => service.unit).filter(Boolean))].sort((a, b) => a.localeCompare(b, "de")).map((unit) => (
              <option key={unit} value={unit} />
            ))}
          </datalist>
          <label><span>Preis</span><input value={newJob.customServicePrice} onChange={(event) => update("customServicePrice", event.target.value)} /></label>
          <label><span>Währung</span><select value={newJob.customServiceCurrency} onChange={(event) => update("customServiceCurrency", event.target.value)}><option>SEK</option><option>EUR</option><option>NOK</option><option>DKK</option></select></label>
          <label className="wide"><span>Beschreibung</span><textarea value={newJob.customServiceDescription} onChange={(event) => update("customServiceDescription", event.target.value)} /></label>
        </div>
        <div className="service-checklist-form">
          <label><span>Checkpunkt</span><input value={newJob.customChecklistTitle} onChange={(event) => update("customChecklistTitle", event.target.value)} /></label>
          <label className="checklist-minutes-field"><span>Standardzeit min.</span><input min="0" type="number" value={newJob.customChecklistMinutes} onChange={(event) => update("customChecklistMinutes", event.target.value)} /></label>
          <label className="wide"><span>Hinweis / Info</span><textarea value={newJob.customChecklistNote} onChange={(event) => update("customChecklistNote", event.target.value)} /></label>
          <button className="ghost-button wide" onClick={addCustomChecklistItem} type="button"><Plus size={16} /> Checklistenpunkt hinzufügen</button>
        </div>
        {newJob.customServiceChecklist.length > 0 && (
          <div className="checklist-preview">
            {newJob.customServiceChecklist.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.note} · {item.defaultMinutes} Min.</span>
                </div>
                <IconAction danger label={`Checklistenpunkt ${item.title} entfernen`} onClick={() => removeCustomChecklistItem(item.id)}><Trash2 size={16} /></IconAction>
              </article>
            ))}
          </div>
        )}
      </section>
      <div className="wide recurrence-editor">
        <div className="recurrence-head">
          <CalendarDays size={18} />
          <div>
            <span>Auftragsart</span>
            <strong>{recurrenceSummary}</strong>
          </div>
        </div>
        <div className="segmented-control">
          <button className={newJob.scheduleType === "einmalig" ? "active" : ""} onClick={() => update("scheduleType", "einmalig")} type="button">Einmalig</button>
          <button className={newJob.scheduleType === "serie" ? "active" : ""} onClick={() => update("scheduleType", "serie")} type="button">Serienauftrag</button>
        </div>
        {newJob.scheduleType === "serie" && (
          <div className="recurrence-grid">
            <label>
              <span>Wiederholen</span>
              <select value={newJob.scheduleFrequency} onChange={(event) => update("scheduleFrequency", event.target.value)}>
                <option>täglich</option>
                <option>wöchentlich</option>
                <option>monatlich</option>
                <option>jährlich</option>
              </select>
            </label>
            <label className="interval-field">
              <span>Intervall</span>
              <input min="1" type="number" value={newJob.scheduleInterval} onChange={(event) => update("scheduleInterval", event.target.value)} />
            </label>
            {newJob.scheduleFrequency === "wöchentlich" && (
              <div className="wide weekday-picker-wrap">
                <div className="weekday-preset-row">
                  <button onClick={() => update("scheduleWeekdays", ["Mo", "Di", "Mi", "Do", "Fr"])} type="button">Werktage</button>
                  <button onClick={() => update("scheduleWeekdays", weekdays)} type="button">Alle Tage</button>
                </div>
                <div className="weekday-picker" aria-label="Wochentage auswählen">
                  {weekdays.map((day) => (
                    <button className={newJob.scheduleWeekdays.includes(day) ? "active" : ""} key={day} onClick={() => toggleWeekday(day)} type="button">{day}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="wide season-grid">
              <label>
                <span>Gültig von</span>
                <select value={newJob.scheduleActiveFromMonth} onChange={(event) => update("scheduleActiveFromMonth", event.target.value)}>
                  <option value="">ganzjährig</option>
                  {monthNames.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
                </select>
              </label>
              <label>
                <span>Gültig bis</span>
                <select value={newJob.scheduleActiveToMonth} onChange={(event) => update("scheduleActiveToMonth", event.target.value)}>
                  <option value="">ganzjährig</option>
                  {monthNames.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
                </select>
              </label>
              <label className="year-interval-field">
                <span>Jahresrhythmus</span>
                <input min="1" type="number" value={newJob.scheduleYearInterval} onChange={(event) => update("scheduleYearInterval", event.target.value)} />
              </label>
            </div>
            <label>
              <span>Ende</span>
              <select value={newJob.scheduleEnd} onChange={(event) => update("scheduleEnd", event.target.value)}>
                <option value="nie">Nie</option>
                <option value="am">Am Datum</option>
                <option value="nach">Nach Terminen</option>
              </select>
            </label>
            {newJob.scheduleEnd === "am" && (
              <label>
                <span>Enddatum</span>
                <input type="date" value={newJob.scheduleEndDate} onChange={(event) => update("scheduleEndDate", event.target.value)} />
              </label>
            )}
            {newJob.scheduleEnd === "nach" && (
              <label>
                <span>Anzahl Termine</span>
                <input min="1" type="number" value={newJob.scheduleOccurrences} onChange={(event) => update("scheduleOccurrences", event.target.value)} />
              </label>
            )}
          </div>
        )}
      </div>
      <label className="wide"><span>Beschreibung</span><textarea value={newJob.description} onChange={(event) => update("description", event.target.value)} /></label>
      {!customerMode && <label className="wide"><span>Interne Notizen</span><textarea value={newJob.internalNotes} onChange={(event) => update("internalNotes", event.target.value)} /></label>}
      <button className="primary-button wide" onClick={onSubmit} type="button">{submitLabel}</button>
    </div>
  );
}

function IconAction({
  children,
  danger = false,
  label,
  onClick,
}: {
  children: ReactNode;
  danger?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={danger ? "icon-button danger" : "icon-button"}
      data-tooltip={label}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function Badge({ value }: { value: string }) {
  return <mark className={statusTone(value)}>{value}</mark>;
}
