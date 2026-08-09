"use client";

import Image from "next/image";
import {
  Archive,
  CalendarDays,
  Camera,
  ClipboardList,
  Euro,
  FileDown,
  FileText,
  Home,
  KeyRound,
  Languages,
  Moon,
  Pencil,
  PlayCircle,
  Plus,
  RotateCcw,
  Search,
  Send,
  Sun,
  Trash2,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import { type ReactNode, useState } from "react";
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
  | "masterData";
type Modal = "object" | "customer" | "job" | "version" | null;

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
};

type CustomerRecord = {
  id: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  language: string;
  objects: string[];
  balance: string;
  portalStatus: "aktiv" | "einladen" | "gesperrt";
  notes: string;
  archived?: boolean;
};

type JobRecord = {
  id: string;
  title: string;
  objectId: string;
  customerId: string;
  type: string;
  status: "geplant" | "in Arbeit" | "pausiert" | "erledigt" | "abgerechnet";
  priority: "niedrig" | "normal" | "hoch" | "dringend";
  dueDate: string;
  assignedTo: string;
  description: string;
  internalNotes: string;
  checklist: string[];
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
  scheduleType: JobSchedule["type"];
  scheduleFrequency: JobSchedule["frequency"];
  scheduleInterval: string;
  scheduleWeekdays: string[];
  scheduleEnd: JobSchedule["end"];
  scheduleEndDate: string;
  scheduleOccurrences: string;
};

type CustomerFormState = {
  name: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  language: string;
  balance: string;
  portalStatus: CustomerRecord["portalStatus"];
  objects: string[];
  notes: string;
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
  { id: "masterData", label: "Stammdaten", icon: KeyRound },
];

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
    balance: "0 SEK",
    portalStatus: "einladen",
    objects: [],
    notes: "",
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
    balance: customer.balance,
    portalStatus: customer.portalStatus,
    objects: customer.objects,
    notes: customer.notes,
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
    objects: form.objects,
    balance: form.balance.trim() || "0 SEK",
    portalStatus: form.portalStatus,
    notes: form.notes.trim(),
  };
}

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
        { id: "MED-1001-1", type: "Bild", name: "pooltechnik-vor-ort.jpg", description: "Pooltechnik und Filterdruck beim letzten Einsatz", source: "Kamera" },
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
    objects: ["OBJ-1001"],
    balance: "0 SEK",
    portalStatus: "aktiv",
    notes: "Bevorzugt Kommunikation per E-Mail, Fotos nach jeder Poolpflege mitschicken.",
  },
  {
    id: "CUS-2",
    name: "M. Schneider",
    contact: "Markus Schneider",
    email: "markus.schneider@example.com",
    phone: "+49 171 440 22 18",
    address: "Musterstraße 9, 50667 Köln, Deutschland",
    language: "DE",
    objects: ["OBJ-1002"],
    balance: "1.840 SEK",
    portalStatus: "aktiv",
    notes: "Rechnungsadresse in Deutschland, Rückfragen bitte auf Deutsch.",
  },
  {
    id: "CUS-3",
    name: "B. Klos",
    contact: "Bernd Klos",
    email: "bernd@example.com",
    phone: "+46 76 101 81 86",
    address: "Kolaretorp 106, 382 93 Nybro",
    language: "DE / EN",
    objects: ["OBJ-1003"],
    balance: "0 SEK",
    portalStatus: "einladen",
    notes: "Interner Eigentümer, Werkstattinformationen nicht im Kundenportal anzeigen.",
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
    billable: true,
    material: "pH-Minus, Teststreifen",
    workMinutes: 95,
    schedule: { type: "serie", frequency: "wöchentlich", interval: 1, weekdays: ["Mo"], end: "nie", endDate: "", occurrences: 0 },
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
    billable: true,
    material: "-",
    workMinutes: 120,
    schedule: { type: "serie", frequency: "monatlich", interval: 1, weekdays: [], end: "am", endDate: "2026-10-31", occurrences: 0 },
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

  return `Serie: ${cadence}${days}${end}`;
}

export default function HomePage() {
  const [section, setSection] = useState<Section>("dashboard");
  const [language, setLanguage] = useState<Language>("de");
  const [theme, setTheme] = useState<Theme>("light");
  const [query, setQuery] = useState("");
  const [selectedObjectId, setSelectedObjectId] = useState("OBJ-1001");
  const [objects, setObjects] = useState(seedObjects);
  const [customers, setCustomers] = useState(seedCustomers);
  const [jobs, setJobs] = useState(seedJobs);
  const [reports] = useState(seedReports);
  const [billing] = useState(seedBilling);
  const [services, setServices] = useState(seedServices);
  const [servicePackages, setServicePackages] = useState(seedPackages);
  const [modal, setModal] = useState<Modal>(null);
  const [editingObjectId, setEditingObjectId] = useState<string | null>(null);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [recordNotice, setRecordNotice] = useState("");
  const [newObject, setNewObject] = useState<NewObjectFormState>(emptyObjectForm());
  const [newCustomer, setNewCustomer] = useState<CustomerFormState>(emptyCustomerForm());
  const [newJob, setNewJob] = useState<NewJobFormState>({
    title: "",
    type: "Hauskontrolle",
    priority: "normal" as JobRecord["priority"],
    dueDate: "2026-08-05",
    assignedTo: "Johan Berg",
    description: "",
    internalNotes: "",
    scheduleType: "einmalig",
    scheduleFrequency: "wöchentlich",
    scheduleInterval: "1",
    scheduleWeekdays: [],
    scheduleEnd: "nie",
    scheduleEndDate: "",
    scheduleOccurrences: "10",
  });

  const t = labels[language];
  const activeObjects = objects.filter((object) => !object.archived);
  const archivedObjects = objects.filter((object) => object.archived);
  const activeCustomers = customers.filter((customer) => !customer.archived);
  const archivedCustomers = customers.filter((customer) => customer.archived);
  const selectedObject = activeObjects.find((object) => object.id === selectedObjectId) ?? activeObjects[0] ?? objects[0];
  const showObjectFile = section === "objects";
  const filteredObjects = activeObjects.filter((object) =>
    [object.name, object.owner, object.address, object.region, object.carePackage]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const dashboardStats: Array<{ label: string; value: number; section: Section }> = [
    { label: "aktive Objekte", value: activeObjects.length, section: "objects" },
    { label: "offene Einsätze", value: jobs.filter((job) => job.status !== "erledigt" && job.status !== "abgerechnet").length, section: "planning" },
    { label: "Berichte", value: reports.length, section: "objects" },
    { label: "abrechenbar", value: billing.filter((item) => item.status === "abrechenbar").length, section: "billing" },
  ];

  function openCreateObject() {
    setEditingObjectId(null);
    setNewObject(emptyObjectForm());
    setModal("object");
  }

  function openEditObject(object: ObjectRecord) {
    setEditingObjectId(object.id);
    setNewObject(objectToForm(object));
    setModal("object");
  }

  function saveObject() {
    const id = editingObjectId ?? `OBJ-${1000 + objects.length + 1}`;
    const existingObject = objects.find((object) => object.id === editingObjectId);
    const saved = { ...formToObject(newObject, id), archived: existingObject?.archived };

    setObjects((current) =>
      editingObjectId
        ? current.map((object) => (object.id === editingObjectId ? saved : object))
        : [saved, ...current],
    );
    setCustomers((current) =>
      current.map((customer) => {
        const withoutObject = customer.objects.filter((objectId) => objectId !== id);
        return customer.id === saved.ownerCustomerId
          ? { ...customer, objects: [...withoutObject, id] }
          : { ...customer, objects: withoutObject };
      }),
    );
    setSelectedObjectId(id);
    setSection("objects");
    setEditingObjectId(null);
    setModal(null);
  }

  function archiveObject(object: ObjectRecord) {
    const openJobs = jobs.filter((job) => job.objectId === object.id && !["erledigt", "abgerechnet"].includes(job.status));
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
    setNewJob({
      title: "",
      type: "Hauskontrolle",
      priority: "normal",
      dueDate: "2026-08-05",
      assignedTo: "Johan Berg",
      description: "",
      internalNotes: "",
      scheduleType: "einmalig",
      scheduleFrequency: "wöchentlich",
      scheduleInterval: "1",
      scheduleWeekdays: [],
      scheduleEnd: "nie",
      scheduleEndDate: "",
      scheduleOccurrences: "10",
    });
    setModal("job");
  }

  function openEditJob(job: JobRecord) {
    setEditingJobId(job.id);
    setSelectedObjectId(job.objectId);
    setNewJob({
      title: job.title,
      type: job.type,
      priority: job.priority,
      dueDate: job.dueDate,
      assignedTo: job.assignedTo,
      description: job.description,
      internalNotes: job.internalNotes,
      scheduleType: job.schedule.type,
      scheduleFrequency: job.schedule.frequency,
      scheduleInterval: String(job.schedule.interval),
      scheduleWeekdays: job.schedule.weekdays,
      scheduleEnd: job.schedule.end,
      scheduleEndDate: job.schedule.endDate,
      scheduleOccurrences: String(job.schedule.occurrences || 10),
    });
    setModal("job");
  }

  function saveJob() {
    const id = editingJobId ?? `JOB-${2410 + jobs.length}`;
    const saved: JobRecord = {
      id,
      title: newJob.title.trim() || "Neuer Auftrag",
      objectId: selectedObject.id,
      customerId: selectedObject.ownerCustomerId || customers.find((customer) => customer.name === selectedObject.owner)?.id || "CUS-1",
      type: newJob.type.trim() || "Hauskontrolle",
      status: jobs.find((job) => job.id === editingJobId)?.status ?? "geplant",
      priority: newJob.priority,
      dueDate: newJob.dueDate,
      assignedTo: newJob.assignedTo.trim() || "nicht zugewiesen",
      description: newJob.description.trim() || "Beschreibung ergänzen.",
      internalNotes: newJob.internalNotes.trim() || "Keine internen Notizen.",
      checklist: jobs.find((job) => job.id === editingJobId)?.checklist ?? ["Zugang prüfen", "Fotos erfassen", "Arbeit dokumentieren", "Bericht vorbereiten"],
      billable: jobs.find((job) => job.id === editingJobId)?.billable ?? true,
      material: jobs.find((job) => job.id === editingJobId)?.material ?? "-",
      workMinutes: jobs.find((job) => job.id === editingJobId)?.workMinutes ?? 0,
      schedule: {
        type: newJob.scheduleType,
        frequency: newJob.scheduleFrequency,
        interval: Math.max(Number(newJob.scheduleInterval) || 1, 1),
        weekdays: newJob.scheduleFrequency === "wöchentlich" ? newJob.scheduleWeekdays : [],
        end: newJob.scheduleEnd,
        endDate: newJob.scheduleEnd === "am" ? newJob.scheduleEndDate : "",
        occurrences: newJob.scheduleEnd === "nach" ? Math.max(Number(newJob.scheduleOccurrences) || 1, 1) : 0,
      },
    };

    setJobs((current) =>
      editingJobId
        ? current.map((job) => (job.id === editingJobId ? saved : job))
        : [saved, ...current],
    );
    setEditingJobId(null);
    setSection("jobs");
    setModal(null);
  }

  function startJob(job: JobRecord) {
    setJobs((current) =>
      current.map((item) => (item.id === job.id ? { ...item, status: "in Arbeit" } : item)),
    );
    setActiveJobId(job.id);
    setSelectedObjectId(job.objectId);
    setSection("field");
  }

  function completeJob(job: JobRecord) {
    setJobs((current) =>
      current.map((item) => (item.id === job.id ? { ...item, status: "erledigt", workMinutes: 90 } : item)),
    );
    setSelectedObjectId(job.objectId);
    setSection("objects");
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

        <section className={showObjectFile ? "layout" : "layout full"}>
          <div className="main-panel">
            {section === "dashboard" && (
              <Dashboard
                jobs={jobs}
                objects={activeObjects}
                reports={reports}
                setSection={setSection}
              />
            )}
            {section === "objects" && (
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
              <JobsView jobs={jobs} objects={activeObjects} onCreate={openCreateJob} onEdit={openEditJob} onStart={startJob} />
            )}
            {section === "planning" && <PlanningView jobs={jobs} objects={activeObjects} onStart={startJob} />}
            {section === "field" && (
              <FieldView
                activeJobId={activeJobId}
                jobs={jobs}
                objects={activeObjects}
                packages={servicePackages}
                services={services}
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

          {showObjectFile && (
            <ObjectFile
              jobs={jobs}
              object={selectedObject}
              reports={reports}
            />
          )}
        </section>
      </section>

      {modal && (
        <div className="modal-backdrop">
          <section className={modal === "object" ? "modal modal-large" : "modal"} role="dialog" aria-modal="true">
            <header>
              <div>
                <p>{modal === "object" ? "Objektstammdaten" : modal === "customer" ? "Kundenstammdaten" : modal === "job" ? "Auftrag" : "Änderungsverlauf"}</p>
                <h2>{modal === "object" ? (editingObjectId ? t.editObject : t.newObject) : modal === "customer" ? (editingCustomerId ? t.editCustomer : t.newCustomer) : modal === "job" ? (editingJobId ? "Auftrag bearbeiten" : t.newJob) : `v${appVersion.version}`}</h2>
              </div>
              <button aria-label={t.close} onClick={() => setModal(null)} type="button">
                <X size={18} />
              </button>
            </header>
            {modal === "object" && (
              <ObjectForm
                customers={activeCustomers}
                newObject={newObject}
                setNewObject={setNewObject}
                onSubmit={saveObject}
                submitLabel={editingObjectId ? t.saveObject : t.createObject}
              />
            )}
            {modal === "job" && (
              <JobForm
                newJob={newJob}
                objects={activeObjects}
                selectedObject={selectedObject}
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
                {versionHistory.slice(0, 5).map((entry) => (
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
  jobs,
  objects,
  reports,
  setSection,
}: {
  jobs: JobRecord[];
  objects: ObjectRecord[];
  reports: ReportRecord[];
  setSection: (section: Section) => void;
}) {
  const workBlocks = [
    { label: "Heute steuern", value: jobs.filter((job) => job.status === "in Arbeit").length, text: "laufende Einsätze", section: "planning" as Section },
    { label: "Objekte pflegen", value: objects.length, text: "vollständige Objektakten", section: "objects" as Section },
    { label: "Berichte prüfen", value: reports.length, text: "in Objektakten", section: "objects" as Section },
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
        <div className="table-list">
          {jobs.map((job) => (
            <article key={job.id}>
              <div>
                <strong>{job.title}</strong>
                <span>{job.type} · {job.assignedTo}</span>
              </div>
              <span>{job.dueDate}</span>
              <Badge value={job.status} />
            </article>
          ))}
        </div>
      </section>
    </div>
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
  onCreate,
  onEdit,
  onStart,
}: {
  jobs: JobRecord[];
  objects: ObjectRecord[];
  onCreate: () => void;
  onEdit: (job: JobRecord) => void;
  onStart: (job: JobRecord) => void;
}) {
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
      <div className="table-list job-list">
        {jobs.map((job) => (
          <article className="job-row" key={job.id}>
            <div className="job-row-main">
              <strong>{job.title}</strong>
              <span>{objects.find((object) => object.id === job.objectId)?.name} · {scheduleLabel(job.schedule)} · {job.description}</span>
            </div>
            <div className="job-row-meta">
              <span>{job.dueDate}</span>
              <span>{job.priority}</span>
              <Badge value={job.status} />
            </div>
            <div className="row-actions">
              <IconAction label={`Auftrag ${job.title} bearbeiten`} onClick={() => onEdit(job)}><Pencil size={16} /></IconAction>
              <IconAction label={`Auftrag ${job.title} starten`} onClick={() => onStart(job)}><PlayCircle size={16} /></IconAction>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function PlanningView({ jobs, objects, onStart }: { jobs: JobRecord[]; objects: ObjectRecord[]; onStart: (job: JobRecord) => void }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <p>Disposition</p>
          <h2>Einsatzplanung</h2>
        </div>
      </div>
      <div className="planning-grid">
        {["geplant", "in Arbeit", "erledigt", "abgerechnet"].map((status) => (
          <div key={status}>
            <h3>{status}</h3>
            {jobs.filter((job) => job.status === status).map((job) => (
              <button key={job.id} onClick={() => onStart(job)} type="button">
                <strong>{job.title}</strong>
                <span>{objects.find((object) => object.id === job.objectId)?.name}</span>
                <small>{job.assignedTo} · {job.dueDate}</small>
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
  jobs,
  objects,
  packages,
  services,
  onComplete,
}: {
  activeJobId: string | null;
  jobs: JobRecord[];
  objects: ObjectRecord[];
  packages: ServicePackage[];
  services: ServiceItem[];
  onComplete: (job: JobRecord) => void;
}) {
  const [capturedPhotos, setCapturedPhotos] = useState<Record<string, { name: string; accepted: boolean }>>({});
  const active = jobs.find((job) => job.id === activeJobId) ?? jobs.find((job) => job.status === "in Arbeit") ?? jobs[0];
  const object = objects.find((item) => item.id === active.objectId) ?? objects[0];
  const activePackage = packages.find((servicePackage) => !servicePackage.archived && servicePackage.name === object.carePackage);
  const packageServices = activePackage
    ? activePackage.serviceIds
        .map((id) => services.find((service) => service.id === id && !service.archived))
        .filter(Boolean) as ServiceItem[]
    : [];
  const fieldTasks = packageServices.length > 0
    ? packageServices.flatMap((service) => {
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
      })
    : active.checklist.map((item) => ({
        id: item,
        title: item,
        meta: active.type,
        description: "Aufgabe aus der Auftragscheckliste dokumentieren.",
        defaultMinutes: 0,
      }));

  return (
    <section className="field-shell">
      <div className="phone-card">
        <p>Mobil vor Ort</p>
        <h2>{active.title}</h2>
        <span>{object.name} · {object.address}</span>
        <div className="field-summary">
          <strong>{active.assignedTo}</strong>
          <small>{active.dueDate} · {object.carePackage}</small>
        </div>
        <div className="service-task-list">
          {fieldTasks.map((task, index) => (
            <article key={task.id}>
              <div className="field-task-head">
                <label>
                  <input type="checkbox" defaultChecked={index < 1} />
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
                    type="file"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      setCapturedPhotos({ ...capturedPhotos, [task.id]: { name: file.name, accepted: false } });
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
              <p>{task.description}</p>
              <div className="field-task-inputs">
                <label>
                  <span>Zeit min.</span>
                  <input aria-label={`Zeit ${task.title}`} defaultValue={task.defaultMinutes || ""} inputMode="numeric" min="0" type="number" />
                </label>
                <label>
                  <span>Hinweis / Info</span>
                  <textarea aria-label={`Hinweis ${task.title}`} placeholder="Kurznotiz, Besonderheit oder Rückmeldung" />
                </label>
              </div>
              {capturedPhotos[task.id] && (
                <div className="captured-photo-card">
                  <strong>{capturedPhotos[task.id].accepted ? "Foto übernommen" : "Neues Foto erfasst"}</strong>
                  <span>{capturedPhotos[task.id].name}</span>
                  <div className="row-actions">
                    <button
                      className="ghost-button compact"
                      onClick={() => setCapturedPhotos({ ...capturedPhotos, [task.id]: { ...capturedPhotos[task.id], accepted: true } })}
                      type="button"
                    >
                      Foto benutzen
                    </button>
                    <button
                      className="ghost-button compact"
                      onClick={() => {
                        const nextPhotos = { ...capturedPhotos };
                        delete nextPhotos[task.id];
                        setCapturedPhotos(nextPhotos);
                      }}
                      type="button"
                    >
                      Neues Foto
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
        <textarea defaultValue="Notiz: Zugang geprüft, Fotos ergänzt." aria-label="Einsatznotiz" />
        <button className="primary-button" onClick={() => onComplete(active)} type="button">
          Einsatz abschließen
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

function ObjectFile({
  jobs,
  object,
  reports,
}: {
  jobs: JobRecord[];
  object: ObjectRecord;
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
  const [selectedHistoryId, setSelectedHistoryId] = useState(history[0]?.id ?? "");
  const [sentReports, setSentReports] = useState<string[]>([]);
  const selectedHistory = history.find((item) => item.id === selectedHistoryId) ?? history[0];
  const previewImage = object.media.items.find((item) => item.type === "Bild" && item.previewUrl);
  const selectedReport = selectedHistory?.report;
  const selectedJob = selectedHistory?.job;

  return (
    <aside className="object-file">
      <div className="object-preview">
        {previewImage?.previewUrl ? (
          <div
            aria-label={`Objektfoto ${object.name}`}
            className="object-preview-image"
            role="img"
            style={{ backgroundImage: `url(${previewImage.previewUrl})` }}
          />
        ) : (
          <div>
            <Home size={26} />
            <span>{object.name}</span>
          </div>
        )}
      </div>
      <div className="object-file-head">
        <div>
          <p>Objektakte</p>
          <h2>{object.name}</h2>
          <Badge value={object.status} />
        </div>
      </div>
      <section>
        <h3>Stammdaten</h3>
        <dl>
          <div><dt>Eigentümer</dt><dd>{object.owner}</dd></div>
          <div><dt>Kontakt</dt><dd>{object.ownerEmail} · {object.ownerPhone}</dd></div>
          <div><dt>Objektadresse</dt><dd>{object.address}</dd></div>
        </dl>
      </section>
      <section>
        <h3>Historie / Verlauf</h3>
        <div className="history-list">
          {history.map((item) => (
            <button
              className={selectedHistory?.id === item.id ? "active" : ""}
              key={item.id}
              onClick={() => setSelectedHistoryId(item.id)}
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
      </section>
      {selectedHistory && (
        <section className="history-detail">
          <div className="history-detail-head">
            <div>
              <h3>{selectedHistory.title}</h3>
              <span>{selectedHistory.date} · {object.name}</span>
            </div>
            <div className="row-actions">
              <IconAction label={`PDF für ${selectedHistory.title} ausgeben`} onClick={() => window.print()}><FileDown size={16} /></IconAction>
              <IconAction
                label={`Bericht ${selectedHistory.title} an Kunden senden`}
                onClick={() => selectedReport && setSentReports([...sentReports.filter((id) => id !== selectedReport.id), selectedReport.id])}
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
              <div className="history-block">
                <strong>Kundenbericht</strong>
                <p>{selectedReport.summary}</p>
              </div>
              <div className="history-block internal">
                <strong>Interne Notizen</strong>
                <p>{selectedReport.internalNotes}</p>
              </div>
              <div className="history-media">
                {selectedReport.media.map((item) => <span key={item}>{item}</span>)}
              </div>
              <p className="send-status">
                {sentReports.includes(selectedReport.id)
                  ? `An ${object.ownerEmail} gesendet`
                  : "Noch nicht an Kunden gesendet"}
              </p>
            </>
          ) : (
            <div className="history-block">
              <strong>Bericht</strong>
              <p>Für diesen Auftrag wurde noch kein Bericht erzeugt.</p>
            </div>
          )}
        </section>
      )}
    </aside>
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

  function addMedia(files: FileList | null, type: MediaItem["type"], source: MediaItem["source"]) {
    if (!files?.length) return;

    const added = Array.from(files).map((file, index) => ({
      id: `MED-${Date.now()}-${index}-${file.name}`,
      type,
      name: file.name,
      description: type === "Dokument" ? newObject.documentDescription.trim() : "",
      source,
      previewUrl: type === "Bild" ? URL.createObjectURL(file) : undefined,
    }));
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
    const mediaItems = newObject.mediaItems.filter((item) => item.id !== id);

    setNewObject({
      ...newObject,
      mediaItems,
      images: String(mediaItems.filter((item) => item.type === "Bild").length),
      documents: String(mediaItems.filter((item) => item.type === "Dokument").length),
      floorPlans: String(mediaItems.filter((item) => item.type === "Grundriss").length),
    });
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
      <div className="wide media-summary">
        <span>{newObject.images} Bilder</span>
        <span>{newObject.documents} Dokumente</span>
        <span>{newObject.floorPlans} Grundrisse</span>
      </div>
      <div className="wide upload-grid">
        <label className="upload-card">
          <span>Bilder hochladen</span>
          <input aria-label="Bilder hochladen" accept="image/*" multiple type="file" onChange={(event) => addMedia(event.target.files, "Bild", "Upload")} />
        </label>
        <label className="upload-card">
          <span>Foto mit Handy aufnehmen</span>
          <input aria-label="Foto mit Handy aufnehmen" accept="image/*" capture="environment" type="file" onChange={(event) => addMedia(event.target.files, "Bild", "Kamera")} />
        </label>
        <label>
          <span>Dokument-Kurzbeschreibung</span>
          <input value={newObject.documentDescription} onChange={(event) => update("documentDescription", event.target.value)} placeholder="z.B. Energieausweis, Versicherung, Schlüsselprotokoll" />
        </label>
        <label className="upload-card">
          <span>Dokumente hochladen</span>
          <input aria-label="Dokumente hochladen" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,image/*" multiple type="file" onChange={(event) => addMedia(event.target.files, "Dokument", "Upload")} />
        </label>
        <label className="upload-card">
          <span>Grundrisse hochladen</span>
          <input aria-label="Grundrisse hochladen" accept=".pdf,image/*" multiple type="file" onChange={(event) => addMedia(event.target.files, "Grundriss", "Upload")} />
        </label>
      </div>
      {newObject.mediaItems.length > 0 && (
        <div className="wide media-list">
          {newObject.mediaItems.map((item) => (
            <article key={item.id}>
              <div>
                <strong>{item.type}: {item.name}</strong>
                <span>{item.source}</span>
              </div>
              <input
                aria-label={`Kurzbeschreibung ${item.name}`}
                placeholder="Kurzbeschreibung"
                value={item.description}
                onChange={(event) => updateMediaDescription(item.id, event.target.value)}
              />
              <IconAction danger label={`Datei ${item.name} entfernen`} onClick={() => removeMedia(item.id)}><Trash2 size={16} /></IconAction>
            </article>
          ))}
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
      <label><span>Saldo</span><input value={customer.balance} onChange={(event) => update("balance", event.target.value)} /></label>
      <label className="wide"><span>Notizen / interne Info</span><textarea value={customer.notes} onChange={(event) => update("notes", event.target.value)} /></label>
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
  newJob,
  setNewJob,
  objects,
  selectedObject,
  setSelectedObjectId,
  onSubmit,
  submitLabel,
}: {
  newJob: NewJobFormState;
  setNewJob: (value: NewJobFormState) => void;
  objects: ObjectRecord[];
  selectedObject: ObjectRecord;
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
      });

  function update(key: keyof typeof newJob, value: string | string[]) {
    setNewJob({ ...newJob, [key]: value });
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
      <label><span>Zuständig</span><input value={newJob.assignedTo} onChange={(event) => update("assignedTo", event.target.value)} /></label>
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
            <label>
              <span>Intervall</span>
              <input min="1" type="number" value={newJob.scheduleInterval} onChange={(event) => update("scheduleInterval", event.target.value)} />
            </label>
            {newJob.scheduleFrequency === "wöchentlich" && (
              <div className="wide weekday-picker" aria-label="Wochentage auswählen">
                {weekdays.map((day) => (
                  <button className={newJob.scheduleWeekdays.includes(day) ? "active" : ""} key={day} onClick={() => toggleWeekday(day)} type="button">{day}</button>
                ))}
              </div>
            )}
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
      <label className="wide"><span>Interne Notizen</span><textarea value={newJob.internalNotes} onChange={(event) => update("internalNotes", event.target.value)} /></label>
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
