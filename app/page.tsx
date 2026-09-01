"use client";

/* eslint-disable @next/next/no-img-element -- Berichtsbilder müssen in Chrome-PDFs als echte img-Elemente erscheinen. */

import Image from "next/image";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Archive,
  CalendarDays,
  CarFront,
  Check,
  ChevronDown,
  ChevronRight,
  Camera,
  ClipboardList,
  Euro,
  FileDown,
  FileOutput,
  FileText,
  Home,
  KeyRound,
  Languages,
  LayoutGrid,
  List,
  LogOut,
  Mail,
  Moon,
  Paperclip,
  Pencil,
  PlayCircle,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  ScanLine,
  Search,
  Send,
  Sun,
  Trash2,
  UserRound,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import { type CSSProperties, type DragEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
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
  carePackage: string;
  status: string;
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
  storagePath?: string;
  isPrimary?: boolean;
};

type CustomerRecord = {
  id: string;
  personalNumber?: string;
  createdAt?: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  phone2?: string;
  address: string;
  billingAddress?: string;
  billingAddressMode?: "Kundenadresse" | "Abweichend";
  language: string;
  portalLoginEmail: string;
  portalPassword: string;
  portalLoginHistory: PortalLoginEntry[];
  objects: string[];
  balance: string;
  portalStatus: "aktiv" | "einladen" | "gesperrt";
  notes: string;
  reportMailBody: string;
  weeklyReportMailBody?: string;
  offerMailBody?: string;
  orderConfirmationMailBody?: string;
  workTimeVisibility?: "service" | "show" | "hide";
  billable?: boolean;
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
  status: "offerte" | "geplant" | "in Arbeit" | "pausiert" | "erledigt" | "abgerechnet" | "storniert";
  statusUpdatedAt?: string;
  resetAt?: string;
  priority: "niedrig" | "normal" | "hoch" | "dringend";
  dueDate: string;
  startDate?: string;
  endDate?: string;
  executionDate?: string;
  executionLog?: JobExecutionLogEntry[];
  assignedTo: string;
  resourceIds?: string[];
  materialItems?: JobMaterialItem[];
  discountType?: "amount" | "percent";
  discountValue?: string;
  discountReason?: string;
  description: string;
  internalNotes: string;
  checklist: string[];
  serviceIds?: string[];
  serviceQuantities?: Record<string, string>;
  serviceDiscounts?: Record<string, LineDiscount>;
  customService?: ServiceItem | null;
  offerNumber?: string;
  offerSentAt?: string;
  orderConfirmationNumber?: string;
  orderConfirmationSentAt?: string;
  billable: boolean;
  material: string;
  workMinutes: number;
  schedule: JobSchedule;
};

type JobExecutionLogEntry = {
  id: string;
  changedAt: string;
  fromAssignedTo: string;
  fromDate: string;
  toAssignedTo: string;
  toDate: string;
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
  attachments?: ReportAttachment[];
  checklistResults: FieldTaskResult[];
  customerComment: string;
  sentAt?: string;
  updatedAt?: string;
};

type ReportAttachment = {
  createdAt: string;
  dataUrl?: string;
  id: string;
  name: string;
  size: number;
  storagePath?: string;
  storageUrl?: string;
  type: string;
};

type SeriesWeekReport = {
  completed: number;
  count: number;
  endDate: string;
  minutes: number;
  occurrences: JobRecord[];
  open: number;
  reportCount: number;
  startDate: string;
  week: number;
  year: number;
};

type FieldTaskResult = {
  id: string;
  title: string;
  meta: string;
  description: string;
  completed: boolean;
  minutes: number;
  showWorkTimeInReport?: boolean;
  note: string;
  photos: FieldPhoto[];
  updatedAt?: string;
};

type FieldTask = {
  id: string;
  title: string;
  meta: string;
  description: string;
  defaultMinutes: number;
  defaultShowWorkTimeInReport?: boolean;
};

type FieldPhoto = {
  id?: string;
  name: string;
  accepted: boolean;
  note?: string;
  previewUrl?: string;
  storagePath?: string;
  createdAt?: string;
};

type FieldTaskProgress = {
  completed: boolean;
  minutes: string;
  showWorkTimeInReport?: boolean;
  note: string;
  photos: FieldPhoto[];
  updatedAt?: string;
};

type BillingRecord = {
  id: string;
  objectId: string;
  customerId: string;
  source: string;
  label: string;
  amount: string;
  createdAt?: string;
  externalExportStatus?: "nicht gesendet" | "gesendet" | "fehler";
  externalExportSystem?: string;
  externalExportedAt?: string;
  cancelledAt?: string;
  dueDate?: string;
  invoiceDate?: string;
  invoiceNumber?: string;
  invoiceStatus?: "entwurf" | "gebucht" | "gesendet" | "bezahlt" | "storniert";
  invoicedAt?: string;
  jobId?: string;
  lines?: BillingLineItem[];
  notes?: string;
  outgoingBookNumber?: string;
  paidAt?: string;
  reportId?: string;
  serviceDate?: string;
  sentAt?: string;
  status: "abrechenbar" | "abgerechnet" | "intern";
};

type BillingLineItem = {
  id: string;
  accountingAccount?: string;
  kind: "Leistung" | "Material" | "Rabatt";
  name: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  currency: string;
  taxRate: string;
  discountType?: LineDiscount["type"];
  discountValue?: string;
};

type LineDiscount = {
  type: "amount" | "percent";
  value: string;
  reason?: string;
};

type MaterialItem = {
  id: string;
  accountingAccount?: string;
  name: string;
  category: string;
  unit: string;
  price: string;
  currency: string;
  taxRate?: string;
  description: string;
  archived?: boolean;
};

type JobMaterialItem = {
  id: string;
  accountingAccount?: string;
  materialId?: string;
  name: string;
  category: string;
  unit: string;
  quantity: string;
  price: string;
  currency: string;
  taxRate?: string;
  discount?: LineDiscount;
  saveToMaster?: boolean;
};

type PortalMessageRecord = {
  id: string;
  customerId: string;
  objectId: string;
  subject: string;
  message: string;
  createdAt: string;
  deliveryError?: string;
  deliveryStatus?: "gespeichert" | "gesendet" | "mail-fehler";
  origin?: "customer" | "office";
  replies?: PortalMessageReplyRecord[];
  sentAt?: string;
  status: "neu" | "gelesen" | "erledigt";
};

type PortalMessageReplyRecord = {
  id: string;
  body: string;
  deliveryError?: string;
  deliveryStatus: "gesendet" | "mail-fehler";
  sentAt: string;
  subject: string;
  to: string;
};

type PersonnelRecord = {
  id: string;
  personnelNumber?: string;
  createdAt?: string;
  firstName: string;
  lastName: string;
  role: string;
  email: string;
  phone: string;
  language: string;
  status: "aktiv" | "pausiert" | "ausgeschieden";
  notes: string;
  archived?: boolean;
};

type VehicleLogEntry = {
  id: string;
  date: string;
  driverId: string;
  tripType: "Dienstfahrt" | "Privatfahrt";
  startAddress: string;
  endAddress: string;
  waypoints?: VehicleWaypoint[];
  startOdometer: string;
  endOdometer: string;
  kilometers: string;
  purpose: string;
  visited: string;
  fuelOrCharge: string;
  fuelReceiptPhoto?: VehicleFuelReceiptPhoto;
  notes: string;
  odometerPhotos?: VehicleOdometerPhoto[];
};

type VehicleWaypoint = {
  address: string;
  id: string;
  odometer?: string;
  note: string;
  photo?: VehicleWaypointPhoto;
};

type VehicleWaypointPhoto = {
  address?: string;
  capturedAt: string;
  id: string;
  name: string;
  previewUrl?: string;
};

type VehicleFuelReceiptPhoto = {
  capturedAt: string;
  id: string;
  name: string;
  previewUrl?: string;
};

type VehicleOdometerPhoto = {
  address?: string;
  capturedAt: string;
  id: string;
  name: string;
  odometerReading?: string;
  previewUrl?: string;
  source: "start" | "end";
};

type ResourceRecord = {
  id: string;
  type: "Fahrzeug" | "Maschine" | "Gerät";
  name: string;
  identifier: string;
  media?: MediaItem[];
  status: string;
  responsiblePersonId: string;
  location: string;
  notes: string;
  logbookYear: string;
  odometerYearStart: string;
  odometerYearEnd: string;
  logbook: VehicleLogEntry[];
  deletedLogbookEntryIds?: string[];
  archived?: boolean;
};

type DailyMailSettings = {
  birthdaySources: string;
  calendarSources: string;
  reminderSources: string;
};

type CompanySettings = {
  address: string;
  bank: string;
  email: string;
  fSkattApproved: boolean;
  name: string;
  organizationNumber: string;
  vatNumber: string;
};

type AppSnapshot = {
  activeJobId: string | null;
  billing?: BillingRecord[];
  customers: CustomerRecord[];
  companySettings?: CompanySettings;
  dailyMailSettings?: DailyMailSettings;
  fieldNotes: Record<string, string>;
  fieldProgress: Record<string, Record<string, FieldTaskProgress>>;
  jobs: JobRecord[];
  materials?: MaterialItem[];
  objects: ObjectRecord[];
  packages: ServicePackage[];
  personnel: PersonnelRecord[];
  portalMessages: PortalMessageRecord[];
  reports: ReportRecord[];
  resources: ResourceRecord[];
  services: ServiceItem[];
  updatedAt?: string;
};

type ServiceItem = {
  id: string;
  accountingAccount?: string;
  name: string;
  category: string;
  unit: string;
  price: string;
  currency: string;
  taxRate?: string;
  showWorkTimeInReports?: boolean;
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
  status: string;
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
  status: JobRecord["status"];
  dueDate: string;
  startDate: string;
  endDate: string;
  assignedTo: string;
  description: string;
  internalNotes: string;
  serviceIds: string[];
  serviceQuantities: Record<string, string>;
  customServiceName: string;
  customServiceCategory: string;
  customServiceUnit: string;
  customServicePrice: string;
  customServiceCurrency: string;
  customServiceDescription: string;
  customServiceQuantity: string;
  serviceDiscounts: Record<string, LineDiscount>;
  customServiceTaxRate: string;
  customServiceChecklist: ServiceChecklistItem[];
  customChecklistTitle: string;
  customChecklistNote: string;
  customChecklistMinutes: string;
  materialItems: JobMaterialItem[];
  materialCategory: string;
  materialCurrency: string;
  materialName: string;
  materialPrice: string;
  materialQuantity: string;
  materialSaveToMaster: boolean;
  materialTaxRate: string;
  materialUnit: string;
  discountType: "amount" | "percent";
  discountValue: string;
  discountReason: string;
  billable: boolean;
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
  personalNumber: string;
  createdAt: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  phone2: string;
  address: string;
  billingAddress: string;
  billingAddressMode: "Kundenadresse" | "Abweichend";
  language: string;
  portalLoginEmail: string;
  portalPassword: string;
  portalLoginHistory: PortalLoginEntry[];
  balance: string;
  portalStatus: CustomerRecord["portalStatus"];
  objects: string[];
  notes: string;
  reportMailBody: string;
  weeklyReportMailBody: string;
  offerMailBody: string;
  orderConfirmationMailBody: string;
  workTimeVisibility: "service" | "show" | "hide";
  billable: boolean;
};

const labels = {
  de: {
    appTitle: "Homecare",
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
    appTitle: "Homecare",
    subtitle: "Objekt, uppdrag, rapporter och fakturering på en arbetsyta.",
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

const navLabels: Record<Language, Record<Section, string>> = {
  de: {
    billing: "Abrechnung",
    communication: "Kommunikation",
    customers: "Kunden",
    dashboard: "Dashboard",
    field: "Mobil vor Ort",
    jobs: "Aufträge",
    masterData: "Stammdaten",
    objects: "Objekte",
    planning: "Einsatzplanung",
    portal: "Kundenportal",
    reports: "Berichte",
  },
  sv: {
    billing: "Fakturering",
    communication: "Kommunikation",
    customers: "Kunder",
    dashboard: "Dashboard",
    field: "Mobilt på plats",
    jobs: "Uppdrag",
    masterData: "Grunddata",
    objects: "Objekt",
    planning: "Planering",
    portal: "Kundportal",
    reports: "Rapporter",
  },
  en: {
    billing: "Billing",
    communication: "Communication",
    customers: "Customers",
    dashboard: "Dashboard",
    field: "Mobile field",
    jobs: "Jobs",
    masterData: "Master data",
    objects: "Properties",
    planning: "Planning",
    portal: "Customer portal",
    reports: "Reports",
  },
};

const navItems: Array<{ id: Section; icon: typeof Home }> = [
  { id: "dashboard", icon: Home },
  { id: "objects", icon: Home },
  { id: "customers", icon: UsersRound },
  { id: "jobs", icon: ClipboardList },
  { id: "planning", icon: CalendarDays },
  { id: "field", icon: Wrench },
  { id: "communication", icon: Mail },
  { id: "billing", icon: Euro },
  { id: "portal", icon: KeyRound },
  { id: "masterData", icon: KeyRound },
];

const swedishUiText: Record<string, string> = {
  "Abbrechen": "Avbryt",
  "Abgeschlossene Berichte": "Avslutade rapporter",
  "Abrechnung": "Fakturering",
  "abrechenbar": "att fakturera",
  "Adresse": "Adress",
  "Aktive Kunden": "Aktiva kunder",
  "Aktive Objekte": "Aktiva objekt",
  "aktive Objekte": "aktiva objekt",
  "Aktuelle Version": "Aktuell version",
  "Alle Tage": "Alla dagar",
  "An": "Till",
  "Angelegt am": "Skapad den",
  "Ansprechpartner": "Kontaktperson",
  "Archivierte Kunden": "Arkiverade kunder",
  "Archivierte Leistungen": "Arkiverade tjänster",
  "Archivierte Objekte": "Arkiverade objekt",
  "Archivierte Pakete": "Arkiverade paket",
  "Archivierte Ressourcen": "Arkiverade resurser",
  "Archiviertes Personal": "Arkiverad personal",
  "Art": "Typ",
  "Auftrag": "Uppdrag",
  "Auftrag auswählen": "Välj uppdrag",
  "Auftrag bearbeiten": "Redigera uppdrag",
  "Auftrag speichern": "Spara uppdrag",
  "Auftragstyp": "Uppdragstyp",
  "Auftragsabwicklung": "Uppdragshantering",
  "Auftragsart": "Uppdragstyp",
  "Auftragsbeschreibung": "Uppdragsbeskrivning",
  "Auftragsübersicht": "Uppdragsöversikt",
  "Aktualisieren": "Uppdatera",
  "Aktualisiere": "Uppdaterar",
  "Ausstattung": "Utrustning",
  "Basisdaten": "Grunduppgifter",
  "Bearbeiter": "Utförare",
  "Bearbeitung abbrechen": "Avbryt redigering",
  "Beschreibung": "Beskrivning",
  "Berichte": "Rapporter",
  "Betreff": "Ämne",
  "Betreuungspaket": "Servicepaket",
  "Bilder": "Bilder",
  "Bilder zur Ressource": "Bilder för resurs",
  "Bild hinzufügen": "Lägg till bild",
  "Checklistenpunkt hinzufügen": "Lägg till checklistpunkt",
  "Dashboard": "Dashboard",
  "Datum": "Datum",
  "Deine Ferienhäuser": "Dina objekt",
  "Deine offenen Aufträge": "Dina öppna uppdrag",
  "Deine Stammdaten": "Dina grunduppgifter",
  "Disposition": "Planering",
  "Dispokalender": "Planeringskalender",
  "Dokument hinzufügen": "Lägg till dokument",
  "Dokumentation & Planung": "Dokumentation och planering",
  "Dokumente zum Objekt": "Dokument för objekt",
  "Dunkelmodus": "Mörkt läge",
  "Eigene Leistung erfassen": "Registrera egen tjänst",
  "Eigentümer": "Ägare",
  "Eigentümer aus Kunden": "Ägare från kunder",
  "Eigentümeradresse": "Ägaradress",
  "Einheit": "Enhet",
  "Einladung senden": "Skicka inbjudan",
  "Einsatz abgeschlossen": "Uppdrag avslutat",
  "Einsatzbericht": "Uppdragsrapport",
  "Einsatzberichte": "Uppdragsrapporter",
  "Einsatzplanung": "Planering",
  "offene Einsätze": "öppna uppdrag",
  "End-Km": "Slut-km",
  "Endet am": "Slutar den",
  "Ende": "Slut",
  "Enddatum": "Slutdatum",
  "Beispiel: Privat|https://calendar.google.com/calendar/ical/.../basic.ics": "Exempel: Privat|https://calendar.google.com/calendar/ical/.../basic.ics",
  "Fahrer": "Förare",
  "Fahrtenbuch": "Körjournal",
  "Fahrtenbuch Jahr": "Körjournalsår",
  "Fahrt": "Körning",
  "Fahrt eintragen": "Registrera körning",
  "Fahrt erfassen": "Registrera körning",
  "Fahrt speichern": "Spara körning",
  "Finanzen": "Ekonomi",
  "Format pro Zeile: Name|ICS-Link": "Format per rad: Namn|ICS-länk",
  "Fotos zum Objekt": "Bilder för objekt",
  "Geburtstagskalender": "Födelsedagskalender",
  "Gerät": "Utrustning",
  "Grundstück m²": "Tomt m²",
  "Heizung": "Värme",
  "Hellmodus": "Ljust läge",
  "Heute": "Idag",
  "Hinweis / Info": "Notering / info",
  "Hinweise / Risiken": "Information / risker",
  "Historie / Verlauf": "Historik",
  "Interne Notizen": "Interna noteringar",
  "Internet": "Internet",
  "Kalender": "Kalender",
  "Kalender heute plus 3 Tage": "Kalender idag plus 3 dagar",
  "Kalenderquellen konfigurieren": "Konfigurera kalenderkällor",
  "Kalenderquellen speichern": "Spara kalenderkällor",
  "Kategorie": "Kategori",
  "Kennzeichen / Inventarnr.": "Registreringsnr / inventarienr",
  "Kacheln": "Kort",
  "Kilometer": "Kilometer",
  "Km-Stand Jahresbeginn": "Mätarställning årets början",
  "Km-Stand Jahresende": "Mätarställning årets slut",
  "Kommunikation": "Kommunikation",
  "Kontakt und Rechnungsadresse": "Kontakt och fakturaadress",
  "Kunden": "Kunder",
  "Kundennummer": "Kundnummer",
  "Kundendaten": "Kunduppgifter",
  "Kundenportal": "Kundportal",
  "Kundenübersicht": "Kundöversikt",
  "Kundensichtbar": "Synlig för kund",
  "Leistung": "Tjänst",
  "Leistung anfragen": "Begär tjänst",
  "Leistungen": "Tjänster",
  "Leistungen auswählen": "Välj tjänster",
  "Leistungen im Auftrag": "Tjänster i uppdraget",
  "Leistungen im Paket": "Tjänster i paketet",
  "Leistungen einzeln erfassen": "Registrera enskilda tjänster",
  "Leistungskatalog": "Tjänstekatalog",
  "Login-Verlauf Kundenportal": "Inloggningshistorik kundportal",
  "Liste": "Lista",
  "Mailtext Einsatzbericht": "Mejltext för uppdragsrapport",
  "Maschine": "Maskin",
  "Material": "Material",
  "Mehrere Leistungen bündeln": "Samla flera tjänster",
  "Mobil vor Ort": "Mobilt på plats",
  "Nachname": "Efternamn",
  "Nachricht": "Meddelande",
  "Nachricht an Kolaretorp Service AB": "Meddelande till Kolaretorp Service AB",
  "Nachrichtenverlauf": "Meddelandehistorik",
  "Nächste Einsätze": "Kommande uppdrag",
  "Nächster Besuch": "Nästa besök",
  "Name": "Namn",
  "Neuer Auftrag": "Nytt uppdrag",
  "Neuer Kunde": "Ny kund",
  "Neues Objekt": "Nytt objekt",
  "Neues Personal anlegen": "Skapa ny personal",
  "Neue Ressource anlegen": "Skapa ny resurs",
  "Nicht zugeordnet": "Inte tilldelad",
  "Notiz": "Notering",
  "Notizen": "Noteringar",
  "Notizen / interne Info": "Noteringar / intern info",
  "Objekt": "Objekt",
  "Objekt auswählen": "Välj objekt",
  "Objekt bearbeiten": "Redigera objekt",
  "Objekt zuordnen": "Tilldela objekt",
  "Objektadresse": "Objektadress",
  "Objektmerkmale": "Objektegenskaper",
  "Objekte": "Objekt",
  "Objekte, Einsätze, Berichte und Abrechnung in einer Arbeitszentrale.": "Objekt, uppdrag, rapporter och fakturering på en arbetsyta.",
  "Objektübersicht": "Objektöversikt",
  "Objektverlauf": "Objekthistorik",
  "Offene Aufträge": "Öppna uppdrag",
  "Pakete": "Paket",
  "Paketbeschreibung": "Paketbeskrivning",
  "Paketname": "Paketnamn",
  "Paketpreis": "Paketpris",
  "Parken": "Parkering",
  "Passwort": "Lösenord",
  "Personal": "Personal",
  "Personalnummer": "Personalnummer",
  "Personal als Kacheln anzeigen": "Visa personal som kort",
  "Personal als Liste anzeigen": "Visa personal som lista",
  "Personal verwalten": "Hantera personal",
  "Personal anlegen": "Skapa personal",
  "Personal speichern": "Spara personal",
  "Portal-Einladung": "Portalinbjudan",
  "Portal-Passwort": "Portallösenord",
  "Portalstatus": "Portalstatus",
  "Preis": "Pris",
  "Priorität": "Prioritet",
  "Rechnungen": "Fakturor",
  "Rechnungsadresse": "Fakturaadress",
  "Rechnungsadresse verwenden": "Använd fakturaadress",
  "Rechnungsübersicht": "Fakturaöversikt",
  "Ressourcen": "Resurser",
  "Ressourcen als Kacheln anzeigen": "Visa resurser som kort",
  "Ressourcen als Liste anzeigen": "Visa resurser som lista",
  "Ressourcen verwalten": "Hantera resurser",
  "Ressource anlegen": "Skapa resurs",
  "Ressource speichern": "Spara resurs",
  "Rhythmus": "Rytm",
  "Rolle": "Roll",
  "Saldo": "Saldo",
  "Schließen": "Stäng",
  "Sprache": "Språk",
  "Stammdaten": "Grunddata",
  "Standort": "Plats",
  "Start-Km": "Start-km",
  "Startadresse": "Startadress",
  "Startet am": "Startar den",
  "Status": "Status",
  "Straße": "Gata",
  "Tagesmail": "Dagligt mejl",
  "Tagesmail jetzt senden": "Skicka dagligt mejl nu",
  "Tagesmail wird gesendet...": "Dagligt mejl skickas...",
  "Telefon": "Telefon",
  "Telefon 2": "Telefon 2",
  "Termin": "Tid",
  "Titel": "Titel",
  "Typ": "Typ",
  "Überfällig": "Försenad",
  "Verantwortlich": "Ansvarig",
  "Versandvorschau": "Förhandsgranskning utskick",
  "Vorname": "Förnamn",
  "Wasser": "Vatten",
  "Woche": "Vecka",
  "Währung": "Valuta",
  "Zeit": "Tid",
  "Zeit / Material": "Tid / material",
  "Zieladresse": "Måladress",
  "Zugeordnete Objekte": "Tilldelade objekt",
  "Zugang & Technik": "Tillträde och teknik",
  "Zugang / Schlüssel": "Tillträde / nyckel",
  "Zugangshinweise": "Tillträdesinformation",
  "Zusammenfassung": "Sammanfattning",
  "Zuständig": "Ansvarig",
  "Zweck / Ärende": "Syfte / ärende",
  "z.B. Einsatzleitung": "t.ex. arbetsledning",
};

const storageKeys = {
  objects: "kolaretorp-objects",
  customers: "kolaretorp-customers",
  jobs: "kolaretorp-jobs",
  reports: "kolaretorp-reports",
  services: "kolaretorp-services",
  materials: "kolaretorp-materials",
  companySettings: "kolaretorp-company-settings",
  packages: "kolaretorp-packages",
  personnel: "kolaretorp-personnel",
  resources: "kolaretorp-resources",
  dailyMailSettings: "kolaretorp-daily-mail-settings",
  billing: "kolaretorp-billing",
  portalMessages: "kolaretorp-portal-messages",
  fieldNotes: "kolaretorp-field-notes",
  fieldProgress: "kolaretorp-field-progress",
  activeJobId: "kolaretorp-active-job-id",
  quickTripDraft: "kolaretorp-quick-trip-draft",
  odometerOcrUsage: "kolaretorp-odometer-ocr-usage",
  updatedAt: "kolaretorp-updated-at",
};

const retryableSyncErrorMessages = [
  "Failed to fetch",
  "NetworkError",
  "Load failed",
  "Supabase-Zeitlimit erreicht",
  "Supabase aktuell überlastet",
];

function isRetryableSyncError(error: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  return retryableSyncErrorMessages.some((retryableMessage) => message.includes(retryableMessage));
}

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
  return recoverReportsFromFieldProgress({
    activeJobId: readStoredValue<string | null>(storageKeys.activeJobId, null),
    billing: readStoredValue<BillingRecord[]>(storageKeys.billing, seedBilling),
    companySettings: readStoredValue<CompanySettings>(storageKeys.companySettings, seedCompanySettings),
    customers: readStoredValue<CustomerRecord[]>(storageKeys.customers, seedCustomers),
    dailyMailSettings: normalizeDailyMailSettings(readStoredValue<Partial<DailyMailSettings>>(storageKeys.dailyMailSettings, seedDailyMailSettings)),
    fieldNotes: readStoredValue<Record<string, string>>(storageKeys.fieldNotes, {}),
    fieldProgress: readStoredValue<Record<string, Record<string, FieldTaskProgress>>>(storageKeys.fieldProgress, {}),
    jobs: readStoredValue<JobRecord[]>(storageKeys.jobs, seedJobs),
    materials: readStoredValue<MaterialItem[]>(storageKeys.materials, seedMaterials),
    objects: readStoredValue<ObjectRecord[]>(storageKeys.objects, seedObjects),
    packages: readStoredValue<ServicePackage[]>(storageKeys.packages, seedPackages),
    personnel: readStoredValue<PersonnelRecord[]>(storageKeys.personnel, seedPersonnel),
    portalMessages: readStoredValue<PortalMessageRecord[]>(storageKeys.portalMessages, []),
    reports: dedupeReports(readStoredValue<ReportRecord[]>(storageKeys.reports, seedReports)),
    resources: readStoredValue<ResourceRecord[]>(storageKeys.resources, seedResources),
    services: readStoredValue<ServiceItem[]>(storageKeys.services, seedServices),
    updatedAt: readStoredValue<string | undefined>(storageKeys.updatedAt, undefined),
  });
}

function hasSavedLocalSnapshot() {
  return [
    storageKeys.customers,
    storageKeys.objects,
    storageKeys.jobs,
    storageKeys.reports,
    storageKeys.fieldProgress,
  ].some((key) => window.localStorage.getItem(key) !== null);
}

function persistLocalSnapshot(snapshot: AppSnapshot) {
  const updatedAt = snapshot.updatedAt ?? new Date().toISOString();
  window.localStorage.setItem(storageKeys.objects, JSON.stringify(snapshot.objects));
  window.localStorage.setItem(storageKeys.billing, JSON.stringify(snapshot.billing ?? seedBilling));
  window.localStorage.setItem(storageKeys.companySettings, JSON.stringify(snapshot.companySettings ?? seedCompanySettings));
  window.localStorage.setItem(storageKeys.customers, JSON.stringify(snapshot.customers));
  window.localStorage.setItem(storageKeys.jobs, JSON.stringify(snapshot.jobs));
  window.localStorage.setItem(storageKeys.materials, JSON.stringify(snapshot.materials ?? seedMaterials));
  window.localStorage.setItem(storageKeys.reports, JSON.stringify(snapshot.reports));
  window.localStorage.setItem(storageKeys.services, JSON.stringify(snapshot.services));
  window.localStorage.setItem(storageKeys.packages, JSON.stringify(snapshot.packages));
  window.localStorage.setItem(storageKeys.personnel, JSON.stringify(snapshot.personnel));
  window.localStorage.setItem(storageKeys.resources, JSON.stringify(snapshot.resources));
  window.localStorage.setItem(storageKeys.dailyMailSettings, JSON.stringify(normalizeDailyMailSettings(snapshot.dailyMailSettings)));
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
    snapshot.billing?.length ?? 0,
    snapshot.companySettings ? Object.values(snapshot.companySettings).join("").length : 0,
    snapshot.customers.length,
    snapshot.jobs.length,
    snapshot.materials?.length ?? 0,
    snapshot.reports.length,
    snapshot.services.length,
    snapshot.packages.length,
    snapshot.personnel?.length ?? 0,
    snapshot.resources?.length ?? 0,
    snapshot.dailyMailSettings ? snapshot.dailyMailSettings.calendarSources.length + snapshot.dailyMailSettings.birthdaySources.length + snapshot.dailyMailSettings.reminderSources.length : 0,
    snapshot.portalMessages?.length ?? 0,
    Object.keys(fieldNotes).length,
    Object.keys(fieldProgress).length,
    objectMedia,
    reportPhotos,
    progressPhotos,
  ].reduce((sum, value) => sum + value, 0);
}

function hasCoreBusinessData(snapshot: AppSnapshot) {
  return snapshot.customers.length > 0 || snapshot.objects.length > 0 || snapshot.jobs.length > 0;
}

function isSuspiciouslyEmptyLocalSnapshot(snapshot: AppSnapshot) {
  return !hasCoreBusinessData(snapshot) && snapshot.services.length === 0 && snapshot.reports.length === 0;
}

function isSeedOnlySnapshot(snapshot: AppSnapshot) {
  return snapshot.customers.length <= seedCustomers.length
    && snapshot.objects.length <= seedObjects.length
    && snapshot.jobs.length <= seedJobs.length
    && snapshot.reports.length <= seedReports.length
    && Object.keys(snapshot.fieldProgress ?? {}).length === 0;
}

function stableStringHash(value: string) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function snapshotContentKey(snapshot: AppSnapshot) {
  const { updatedAt: _updatedAt, ...content } = snapshot;
  const serialized = JSON.stringify(content);
  return `${serialized.length}:${stableStringHash(serialized)}`;
}

function snapshotPatch(snapshot: AppSnapshot): Partial<AppSnapshot> {
  return {
    activeJobId: snapshot.activeJobId,
    billing: snapshot.billing,
    companySettings: snapshot.companySettings,
    customers: snapshot.customers,
    dailyMailSettings: snapshot.dailyMailSettings,
    fieldNotes: snapshot.fieldNotes,
    fieldProgress: snapshot.fieldProgress,
    jobs: snapshot.jobs,
    materials: snapshot.materials,
    objects: snapshot.objects,
    packages: snapshot.packages,
    personnel: snapshot.personnel,
    portalMessages: snapshot.portalMessages,
    reports: snapshot.reports,
    resources: snapshot.resources,
    services: snapshot.services,
    updatedAt: snapshot.updatedAt,
  };
}

function missingLocalReports(remoteReports: ReportRecord[] = [], localReports: ReportRecord[] = []) {
  const remoteKeys = new Set(remoteReports.flatMap((report) => [report.id, reportDedupeKey(report)]));
  return localReports.filter((report) => !remoteKeys.has(report.id) && !remoteKeys.has(reportDedupeKey(report)));
}

function progressHasReportContent(progress: Record<string, FieldTaskProgress>) {
  return Object.values(progress).some((task) => (
    task.completed
    || Boolean(task.note.trim())
    || Boolean(task.minutes.trim())
    || task.photos.length > 0
  ));
}

function reportResultsFromProgress(job: JobRecord, services: ServiceItem[], progress: Record<string, FieldTaskProgress>) {
  const fieldTasks = jobSelectedServices(job, services).length > 0
    ? jobSelectedServices(job, services).flatMap(serviceToFieldTasks)
    : job.checklist.map((item) => ({
        id: item,
        title: item,
        meta: job.type,
        description: "Aufgabe aus der Auftragscheckliste dokumentieren.",
        defaultMinutes: 0,
        defaultShowWorkTimeInReport: true,
      }));

  const taskById = new Map(fieldTasks.map((task) => [task.id, task]));

  return Object.entries(progress).map(([id, task]) => {
    const fieldTask = taskById.get(id);
    return {
      id,
      title: fieldTask?.title ?? id,
      meta: fieldTask?.meta ?? job.type,
      description: fieldTask?.description ?? "Aus gespeicherten Einsatzdaten wiederhergestellt.",
      completed: task.completed,
      minutes: Number(task.minutes) || 0,
      showWorkTimeInReport: task.showWorkTimeInReport ?? fieldTask?.defaultShowWorkTimeInReport ?? true,
      note: task.note.trim(),
      photos: task.photos,
      updatedAt: task.updatedAt,
    };
  });
}

function recoverReportsFromFieldProgress(snapshot: AppSnapshot): AppSnapshot {
  const existingReportKeys = new Set(snapshot.reports.map((report) => `${report.jobId}|${normalizeReportDate(report.date)}`));
  const recoveredReports = snapshot.jobs.flatMap((job) => {
    const workDates = jobWorkDates(job);
    const progressEntries = workDates
      .map((date) => ({ date, progress: snapshot.fieldProgress[fieldProgressKey(job, date)] }))
      .filter((entry) => entry.progress && progressHasReportContent(entry.progress));

    return progressEntries.flatMap(({ date, progress }) => {
      if (existingReportKeys.has(`${job.id}|${date}`)) return [];
      if (!["erledigt", "abgerechnet", "in Arbeit"].includes(job.status)) return [];

      const checklistResults = reportResultsFromProgress(job, snapshot.services, progress);
      const completedCount = checklistResults.filter((item) => item.completed).length;
      const photoCount = checklistResults.reduce((sum, item) => sum + item.photos.length, 0);
      const visibleMinutes = visibleReportWorkMinutes(checklistResults);
      const fieldNote = snapshot.fieldNotes[fieldProgressKey(job, date)]?.trim();

      return [{
        id: `REP-${job.id}-${date}`,
        jobId: job.id,
        objectId: job.objectId,
        title: job.title,
        date,
        visibleToCustomer: true,
        summary: `${workDates.length > 1 ? `Tagesbericht ${date}: ` : ""}${completedCount} von ${checklistResults.length} Checklistenpunkten ausgeführt.${fieldNote ? ` ${fieldNote}` : ""}`,
        internalNotes: job.internalNotes,
        media: reportMediaLabels(photoCount, visibleMinutes, ["aus Einsatzdaten wiederhergestellt"]),
        checklistResults,
        customerComment: "",
        updatedAt: new Date().toISOString(),
      }];
    });
  });

  if (recoveredReports.length === 0) return snapshot;

  return {
    ...snapshot,
    reports: dedupeReports([...recoveredReports, ...snapshot.reports]),
  };
}

function createEntityId(prefix: string) {
  const randomPart = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${randomPart}`;
}

function createReadableNumber(existingNumbers: Array<string | undefined>) {
  const highestNumber = existingNumbers.reduce((highest, value) => {
    const normalized = normalizeReadableNumber(value);
    if (!normalized) return highest;
    return Math.max(highest, Number(normalized));
  }, 0);
  return String(highestNumber + 1).padStart(3, "0");
}

function normalizeReadableNumber(value?: string) {
  const trimmed = value?.trim() ?? "";
  if (!/^\d+$/.test(trimmed)) return "";
  return trimmed.padStart(3, "0");
}

function formatCreatedAt(value?: string) {
  if (!value) return "wird beim Speichern erstellt";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}

function formatCreatedAtWithSeconds(value?: string) {
  if (!value) return "wird beim Speichern erstellt";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "medium" });
}

function formatUpdatedTime(value?: string) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatFileSize(value?: number) {
  if (!value || value < 0) return "unbekannt";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
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

function hasUsefulContactValue(value?: string) {
  const trimmed = value?.trim() ?? "";
  return Boolean(trimmed && trimmed !== "-");
}

function mergeContactValue(primaryValue?: string, secondaryValue?: string, fallback = "") {
  if (hasUsefulContactValue(primaryValue)) return primaryValue?.trim() ?? fallback;
  if (hasUsefulContactValue(secondaryValue)) return secondaryValue?.trim() ?? fallback;
  return primaryValue?.trim() || secondaryValue?.trim() || fallback;
}

function contactFieldValue(value?: string) {
  return hasUsefulContactValue(value) ? value?.trim() ?? "" : "";
}

function mergeCustomersById(primaryCustomers: CustomerRecord[], secondaryCustomers: CustomerRecord[]) {
  const secondaryById = new Map(secondaryCustomers.map((customer) => [customer.id, customer]));
  const primaryIds = new Set(primaryCustomers.map((customer) => customer.id));
  const merged = primaryCustomers.map((primaryCustomer) => {
    const secondaryCustomer = secondaryById.get(primaryCustomer.id);
    if (!secondaryCustomer) return primaryCustomer;

    return {
      ...secondaryCustomer,
      ...primaryCustomer,
      contact: mergeContactValue(primaryCustomer.contact, secondaryCustomer.contact, "Kontakt ergänzen"),
      phone: mergeContactValue(primaryCustomer.phone, secondaryCustomer.phone, "-"),
      phone2: mergeContactValue(primaryCustomer.phone2, secondaryCustomer.phone2),
    };
  });

  secondaryCustomers.forEach((customer) => {
    if (!primaryIds.has(customer.id)) merged.push(customer);
  });

  return merged;
}

function jobStatusScore(job: JobRecord) {
  if (job.status === "abgerechnet") return 5;
  if (job.status === "erledigt") return 4;
  if (job.status === "in Arbeit") return 3;
  if (job.status === "pausiert") return 2;
  if (job.status === "storniert") return 1;
  if (job.status === "offerte") return 0;
  return 0;
}

function mergeJobsById(primaryJobs: JobRecord[], secondaryJobs: JobRecord[]) {
  const jobsById = new Map<string, JobRecord>();

  secondaryJobs.forEach((job) => {
    jobsById.set(job.id, job);
  });
  primaryJobs.forEach((primaryJob) => {
    const secondaryJob = jobsById.get(primaryJob.id);
    if (!secondaryJob) {
      jobsById.set(primaryJob.id, primaryJob);
      return;
    }

    const primaryStatusTime = Date.parse(primaryJob.statusUpdatedAt ?? "");
    const secondaryStatusTime = Date.parse(secondaryJob.statusUpdatedAt ?? "");
    const statusWinner = Number.isFinite(primaryStatusTime) || Number.isFinite(secondaryStatusTime)
      ? (Number.isFinite(primaryStatusTime) ? primaryStatusTime : 0) >= (Number.isFinite(secondaryStatusTime) ? secondaryStatusTime : 0)
        ? primaryJob
        : secondaryJob
      : jobStatusScore(primaryJob) >= jobStatusScore(secondaryJob)
        ? primaryJob
        : secondaryJob;
    const merged = { ...secondaryJob, ...primaryJob };

    jobsById.set(primaryJob.id, {
      ...merged,
      dueDate: statusWinner.dueDate,
      material: statusWinner.material,
      resetAt: statusWinner.resetAt,
      status: statusWinner.status,
      statusUpdatedAt: statusWinner.statusUpdatedAt,
      workMinutes: statusWinner.workMinutes,
    });
  });

  return Array.from(jobsById.values());
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

function mergeOdometerPhotos(primaryPhotos: VehicleOdometerPhoto[] = [], secondaryPhotos: VehicleOdometerPhoto[] = []) {
  const photosById = new Map<string, VehicleOdometerPhoto>();
  [...secondaryPhotos, ...primaryPhotos].forEach((photo) => photosById.set(photo.id, { ...photosById.get(photo.id), ...photo }));
  return Array.from(photosById.values()).sort((first, second) => first.capturedAt.localeCompare(second.capturedAt));
}

function mergeVehicleLogbook(primaryLogbook: VehicleLogEntry[] = [], secondaryLogbook: VehicleLogEntry[] = [], deletedEntryIds: string[] = []) {
  const deletedIds = new Set(deletedEntryIds);
  const secondaryById = new Map(secondaryLogbook.map((entry) => [entry.id, entry]));
  return mergeRecordsById(primaryLogbook, secondaryLogbook)
    .map((entry) => ({
      ...entry,
      odometerPhotos: mergeOdometerPhotos(entry.odometerPhotos, secondaryById.get(entry.id)?.odometerPhotos),
    }))
    .filter((entry) => !deletedIds.has(entry.id))
    .sort((first, second) => first.date.localeCompare(second.date));
}

function mergeResourcesById(primaryResources: ResourceRecord[] = [], secondaryResources: ResourceRecord[] = []) {
  const secondaryById = new Map(secondaryResources.map((resource) => [resource.id, resource]));
  const primaryIds = new Set(primaryResources.map((resource) => resource.id));
  const merged = primaryResources.map((primaryResource) => {
    const secondaryResource = secondaryById.get(primaryResource.id);
    if (!secondaryResource) return primaryResource;
    const deletedLogbookEntryIds = Array.from(new Set([
      ...(secondaryResource.deletedLogbookEntryIds ?? []),
      ...(primaryResource.deletedLogbookEntryIds ?? []),
    ]));
    return {
      ...secondaryResource,
      ...primaryResource,
      deletedLogbookEntryIds,
      logbook: mergeVehicleLogbook(primaryResource.logbook, secondaryResource.logbook, deletedLogbookEntryIds),
    };
  });

  secondaryResources.forEach((resource) => {
    if (!primaryIds.has(resource.id)) merged.push(resource);
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
    const secondaryTasks = secondaryProgress[jobId];
    const taskIds = new Set([...Object.keys(secondaryTasks), ...Object.keys(primaryTasks)]);
    merged[jobId] = Object.fromEntries(Array.from(taskIds).map((taskId) => {
      const primaryTask = primaryTasks[taskId];
      const secondaryTask = secondaryTasks[taskId];
      if (!primaryTask) return [taskId, secondaryTask];
      if (!secondaryTask) return [taskId, primaryTask];

      const primaryTime = Date.parse(primaryTask.updatedAt ?? "");
      const secondaryTime = Date.parse(secondaryTask.updatedAt ?? "");
      const newestTask = Number.isFinite(primaryTime) && Number.isFinite(secondaryTime)
        ? primaryTime >= secondaryTime ? primaryTask : secondaryTask
        : primaryTask;
      const fallbackTask = newestTask === primaryTask ? secondaryTask : primaryTask;
      const photoKeys = new Set<string>();
      const photos = [...(fallbackTask.photos ?? []), ...(newestTask.photos ?? [])].filter((photo) => {
        const key = photo.id ? `id:${photo.id}` : `${photo.name}|${photo.previewUrl ?? ""}`;
        if (photoKeys.has(key)) return false;
        photoKeys.add(key);
        return true;
      });

      return [taskId, {
        ...fallbackTask,
        ...newestTask,
        completed: newestTask.completed || fallbackTask.completed,
        minutes: newestTask.minutes || fallbackTask.minutes,
        note: newestTask.note || fallbackTask.note,
        photos,
      }];
    })) as Record<string, FieldTaskProgress>;
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
  const reports = dedupeReports(mergeRecordsById(primarySnapshot.reports, secondarySnapshot.reports));
  const jobs = mergeJobsById(primarySnapshot.jobs, secondarySnapshot.jobs);
  const activeJobId = primarySnapshot.activeJobId && jobs.some((job) => job.id === primarySnapshot.activeJobId)
    ? primarySnapshot.activeJobId
    : secondarySnapshot.activeJobId && jobs.some((job) => job.id === secondarySnapshot.activeJobId)
      ? secondarySnapshot.activeJobId
      : null;

  return recoverReportsFromFieldProgress({
    activeJobId,
    billing: mergeRecordsById(primarySnapshot.billing ?? seedBilling, secondarySnapshot.billing ?? seedBilling),
    companySettings: { ...seedCompanySettings, ...(secondarySnapshot.companySettings ?? {}), ...(primarySnapshot.companySettings ?? {}) },
    customers: mergeCustomersById(primarySnapshot.customers, secondarySnapshot.customers),
    dailyMailSettings: normalizeDailyMailSettings(primarySnapshot.dailyMailSettings ?? secondarySnapshot.dailyMailSettings ?? seedDailyMailSettings),
    fieldNotes: mergeFieldNotes(primarySnapshot.fieldNotes, secondarySnapshot.fieldNotes),
    fieldProgress: mergeFieldProgress(primarySnapshot.fieldProgress, secondarySnapshot.fieldProgress),
    jobs,
    materials: mergeRecordsById(primarySnapshot.materials ?? seedMaterials, secondarySnapshot.materials ?? seedMaterials),
    objects: mergeObjectsById(primarySnapshot.objects, secondarySnapshot.objects),
    packages: mergeRecordsById(primarySnapshot.packages, secondarySnapshot.packages),
    personnel: mergeRecordsById(primarySnapshot.personnel ?? [], secondarySnapshot.personnel ?? []),
    portalMessages: mergeRecordsById(primarySnapshot.portalMessages ?? [], secondarySnapshot.portalMessages ?? []),
    reports,
    resources: mergeResourcesById(primarySnapshot.resources ?? [], secondarySnapshot.resources ?? []),
    services: mergeRecordsById(primarySnapshot.services, secondarySnapshot.services),
    updatedAt: new Date(Math.max(
      Number.isFinite(remoteTime) ? remoteTime : 0,
      Number.isFinite(localTime) ? localTime : 0,
    )).toISOString(),
  });
}

function reportSummaryNote(summary: string) {
  return summary.replace(/^\d+ von \d+ Checklistenpunkten ausgeführt\.\s*/, "").trim();
}

function visibleReportWorkMinutes(checklistResults: FieldTaskResult[]) {
  return checklistResults
    .filter((item) => item.showWorkTimeInReport !== false)
    .reduce((sum, item) => sum + item.minutes, 0);
}

function reportMediaLabels(photoCount: number, visibleMinutes: number, extraLabels: string[] = []) {
  return [
    `${photoCount} Fotos`,
    ...(visibleMinutes > 0 ? [`${visibleMinutes} Minuten dokumentiert`] : []),
    ...extraLabels,
  ];
}

function isGeneratedWeekCustomerComment(comment: string) {
  return /^\d+\s+von\s+\d+\s+geplanten\s+Einsätzen\s+in\s+KW\s+\d+\s+erledigt\.\s+Zeitraum:\s+\d{4}-\d{2}-\d{2}\s+bis\s+\d{4}-\d{2}-\d{2}\.?$/i.test(comment.trim());
}

function visibleReportCustomerComment(report: ReportRecord) {
  const comment = report.customerComment.trim();
  if (!comment || (report.id.startsWith("WEEK-") && isGeneratedWeekCustomerComment(comment))) return "";
  return comment;
}

function reportAttachmentsLabel(report: ReportRecord) {
  const count = report.attachments?.length ?? 0;
  if (!count) return "";
  return `${count} ${count === 1 ? "Dateianhang" : "Dateianhänge"}`;
}

function reportPhotos(report: ReportRecord) {
  return report.checklistResults.flatMap((item) => (
    item.photos.map((photo) => ({ ...photo, taskTitle: item.title }))
  ));
}

function reportPhotoCount(report: ReportRecord) {
  return reportPhotos(report).length;
}

async function fileToReportAttachment(file: File): Promise<ReportAttachment> {
  if (file.size > 15_000_000) {
    throw new Error(`"${file.name}" ist größer als 15 MB.`);
  }

  const uploaded = await uploadMediaFile(file, "report-attachments");
  if (uploaded) {
    return {
      createdAt: new Date().toISOString(),
      id: globalThis.crypto?.randomUUID?.() ?? `REPORT-FILE-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      size: file.size,
      storagePath: uploaded.path,
      storageUrl: uploaded.url,
      type: file.type || "application/octet-stream",
    };
  }

  return {
    createdAt: new Date().toISOString(),
    dataUrl: await readFileAsDataUrl(file),
    id: globalThis.crypto?.randomUUID?.() ?? `REPORT-FILE-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
  };
}

function dataUrlToBase64(dataUrl: string) {
  return dataUrl.includes(",") ? dataUrl.split(",", 2)[1] : dataUrl;
}

type UploadedMedia = {
  contentType: string;
  name: string;
  path: string;
  size: number;
  url: string;
};

async function uploadMediaFile(file: File | Blob, scope: string, fileName?: string): Promise<UploadedMedia | null> {
  try {
    const formData = new FormData();
    formData.append("scope", scope);
    formData.append("file", file, fileName);
    const response = await fetch("/api/media", {
      body: formData,
      method: "POST",
    });
    if (!response.ok) return null;
    return await response.json() as UploadedMedia;
  } catch (error) {
    console.warn("Medien-Upload ist nicht verfügbar, speichere lokal weiter.", error);
    return null;
  }
}

async function mediaSourceToDataUrl(source: string) {
  if (!source || source.startsWith("data:")) return source;
  const response = await fetch(source);
  if (!response.ok) throw new Error("Mediendatei konnte nicht geladen werden.");
  const blob = await response.blob();
  return await readFileAsDataUrl(blob);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs = 8000): Promise<T> {
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

  const response = await withTimeout(fetch("/api/app-state?compact=1", {
    cache: "no-store",
    headers: { Accept: "application/json" },
  }), 30000);
  const payload = await response.json() as { data?: AppSnapshot | null; error?: string; updatedAt?: string | null };

  if (!response.ok) {
    throw new Error(payload.error || "App-Daten konnten nicht geladen werden.");
  }

  return payload.data ? { ...payload.data, updatedAt: payload.data.updatedAt ?? payload.updatedAt ?? undefined } : null;
}

async function saveSupabaseSnapshotWithFetch(endpoint: string, snapshot: AppSnapshot) {
  const response = await withTimeout(fetch(endpoint, {
    body: JSON.stringify(snapshot),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  }));
  const payload = await response.json() as { error?: string; retry?: boolean; updatedAt?: string };

  if (!response.ok || payload.retry) {
    throw new Error(payload.error || "App-Daten konnten nicht gespeichert werden.");
  }

  return payload.updatedAt ?? snapshot.updatedAt;
}

function saveSupabaseSnapshotWithXhr(endpoint: string, snapshot: AppSnapshot) {
  return new Promise<string | undefined>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", endpoint, true);
    request.setRequestHeader("Content-Type", "application/json");
    request.timeout = 12000;
    request.onload = () => {
      let payload: { error?: string; retry?: boolean; updatedAt?: string } = {};
      try {
        payload = request.responseText ? JSON.parse(request.responseText) : {};
      } catch {
        payload = {};
      }
      if (request.status < 200 || request.status >= 300 || payload.retry) {
        reject(new Error(payload.error || `App-Daten konnten nicht gespeichert werden (${request.status}).`));
        return;
      }
      resolve(payload.updatedAt ?? snapshot.updatedAt);
    };
    request.onerror = () => reject(new Error("Online-Speichern fehlgeschlagen: Netzwerkfehler."));
    request.ontimeout = () => reject(new Error("Online-Speichern fehlgeschlagen: Zeitlimit erreicht."));
    request.send(JSON.stringify(snapshot));
  });
}

function compactPatchForRemote(overrides: Partial<AppSnapshot>) {
  return {
    ...overrides,
    objects: overrides.objects?.map((object) => ({
      ...object,
      media: undefined,
    })),
  };
}

async function saveSupabaseSnapshot(snapshot: AppSnapshot) {
  if (process.env.NEXT_PUBLIC_DISABLE_SUPABASE_SYNC === "1") {
    return snapshot.updatedAt;
  }

  const endpoints = ["/api/app-state"];
  if (typeof window !== "undefined" && window.location.origin.startsWith("http")) {
    endpoints.push(`${window.location.origin}/api/app-state`);
  }
  let lastError: unknown;

  for (const endpoint of endpoints) {
    try {
      return await saveSupabaseSnapshotWithFetch(endpoint, snapshot);
    } catch (error) {
      lastError = error;
    }

    if (typeof window !== "undefined") {
      try {
        return await saveSupabaseSnapshotWithXhr(endpoint, snapshot);
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("App-Daten konnten nicht gespeichert werden.");
}

async function saveSupabasePatch(overrides: Partial<AppSnapshot>) {
  const snapshot = { __patch: true, patch: compactPatchForRemote(overrides) };
  return saveSupabaseSnapshot(snapshot as unknown as AppSnapshot);
}

type ReportTextBackup = Pick<ReportRecord, "checklistResults" | "customerComment" | "date" | "id" | "jobId" | "objectId" | "summary" | "title" | "updatedAt" | "visibleToCustomer">;
type AppBackupRecord = {
  backupUpdatedAt?: string;
  counts?: {
    customers?: number;
    fieldProgress?: number;
    jobs?: number;
    objects?: number;
    reports?: number;
  };
  createdAt: string;
  id: string;
  compressedSizeBytes?: number;
  reason?: string;
  sizeBytes?: number;
  sourceUpdatedAt?: string;
  storagePath?: string;
  storagePaths?: string[];
};

function reportTextBackup(report: ReportRecord): ReportTextBackup {
  return {
    checklistResults: report.checklistResults.map((item) => ({
      completed: item.completed,
      description: item.description,
      id: item.id,
      meta: item.meta,
      minutes: item.minutes,
      note: item.note,
      photos: [],
      showWorkTimeInReport: item.showWorkTimeInReport,
      title: item.title,
      updatedAt: item.updatedAt,
    })),
    customerComment: report.customerComment,
    date: normalizeReportDate(report.date),
    id: report.id,
    jobId: report.jobId,
    objectId: report.objectId,
    summary: report.summary,
    title: report.title,
    updatedAt: report.updatedAt,
    visibleToCustomer: report.visibleToCustomer,
  };
}

function applyReportTextBackups(reports: ReportRecord[], backups: ReportTextBackup[]) {
  if (backups.length === 0) return reports;
  return dedupeReports([
    ...backups.map((backup) => ({
      attachments: [],
      checklistResults: (backup.checklistResults ?? []).map((item) => ({
        completed: item.completed ?? false,
        description: item.description ?? "",
        id: item.id ?? item.title ?? createEntityId("BKP-SCL"),
        meta: item.meta ?? "",
        minutes: item.minutes ?? 0,
        note: item.note ?? "",
        photos: item.photos ?? [],
        showWorkTimeInReport: item.showWorkTimeInReport ?? true,
        title: item.title ?? "",
        updatedAt: item.updatedAt,
      })),
      customerComment: backup.customerComment ?? "",
      date: normalizeReportDate(backup.date),
      id: backup.id,
      internalNotes: "Text-Sicherung aus Bericht-Backup.",
      jobId: backup.jobId,
      media: [],
      objectId: backup.objectId,
      summary: backup.summary ?? "",
      title: backup.title ?? "Bericht",
      updatedAt: backup.updatedAt,
      visibleToCustomer: backup.visibleToCustomer ?? true,
    })),
    ...reports,
  ]);
}

async function loadReportTextBackups() {
  try {
    const response = await withTimeout(fetch("/api/report-backups", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    }), 6000);
    const payload = await response.json() as { data?: ReportTextBackup[]; error?: string };
    if (!response.ok) throw new Error(payload.error || "Bericht-Backups konnten nicht geladen werden.");
    return payload.data ?? [];
  } catch (error) {
    console.warn("Bericht-Backups konnten nicht geladen werden.", error);
    return [];
  }
}

async function saveReportTextBackup(report: ReportRecord) {
  try {
    const response = await withTimeout(fetch("/api/report-backups", {
      body: JSON.stringify(reportTextBackup(report)),
      headers: { "Content-Type": "application/json" },
      method: "PUT",
    }), 6000);
    const payload = await response.json() as { error?: string };
    if (!response.ok) throw new Error(payload.error || "Bericht-Backup konnte nicht gespeichert werden.");
  } catch (error) {
    console.warn("Bericht-Backup konnte nicht gespeichert werden.", error);
  }
}

async function loadAppBackups() {
  const response = await withTimeout(fetch("/api/app-backups", {
    cache: "no-store",
    headers: { Accept: "application/json" },
  }), 8000);
  const payload = await response.json() as { data?: AppBackupRecord[]; error?: string };
  if (!response.ok) throw new Error(payload.error || "Backups konnten nicht geladen werden.");
  return payload.data ?? [];
}

async function createAppBackup(reason = "manual") {
  const response = await withTimeout(fetch("/api/app-backups", {
    body: JSON.stringify({ reason }),
    headers: { "Content-Type": "application/json" },
    method: "PUT",
  }), 20000);
  const payload = await response.json() as { backup?: AppBackupRecord; error?: string };
  if (!response.ok) throw new Error(payload.error || "Backup konnte nicht erstellt werden.");
  return payload.backup;
}

async function restoreAppBackup(backupId: string) {
  const response = await withTimeout(fetch("/api/app-backups", {
    body: JSON.stringify({ id: backupId }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  }), 20000);
  const payload = await response.json() as { error?: string; restoredAt?: string };
  if (!response.ok) throw new Error(payload.error || "Backup konnte nicht wiederhergestellt werden.");
  return payload.restoredAt;
}

async function loadLiveAppVersion() {
  const response = await withTimeout(fetch("/api/version", {
    cache: "no-store",
    headers: { Accept: "application/json" },
  }), 6000);
  const payload = await response.json() as { version?: string };
  return payload.version;
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
    status: "geplant",
    dueDate: "2026-08-05",
    startDate: "2026-08-05",
    endDate: "2026-08-05",
    assignedTo: "Johan Berg",
    description: "",
    internalNotes: "",
    serviceIds: [],
    serviceQuantities: {},
    serviceDiscounts: {},
    customServiceName: "",
    customServiceCategory: "",
    customServiceUnit: "",
    customServicePrice: "",
    customServiceCurrency: "SEK",
    customServiceDescription: "",
    customServiceQuantity: "1",
    customServiceTaxRate: "25",
    customServiceChecklist: [],
    customChecklistTitle: "",
    customChecklistNote: "",
    customChecklistMinutes: "",
    materialItems: [],
    materialCategory: "",
    materialCurrency: "SEK",
    materialName: "",
    materialPrice: "",
    materialQuantity: "1",
    materialSaveToMaster: false,
    materialTaxRate: "25",
    materialUnit: "Stück",
    discountType: "amount",
    discountValue: "",
    discountReason: "",
    billable: true,
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

function uniqueSortedValues(values: string[], fallbackValues: string[] = []) {
  return Array.from(new Set([...fallbackValues, ...values].map((value) => value.trim()).filter(Boolean)))
    .sort((first, second) => first.localeCompare(second, "de"));
}

type AddressParts = {
  city: string;
  postalCode: string;
  street: string;
};

function removeDuplicatedAddressPrefix(address: string) {
  const trimmed = address.trim();
  const duplicateParts = trimmed.split(/\s+·\s+/);

  if (duplicateParts.length < 2) return trimmed;

  const first = duplicateParts[0].trim();
  const rest = duplicateParts.slice(1).join(" · ").trim();

  return first && rest.toLowerCase().startsWith(first.toLowerCase()) ? rest : trimmed;
}

function splitAddressParts(address: string): AddressParts {
  const normalizedAddress = removeDuplicatedAddressPrefix(address);
  const parts = normalizedAddress.split(",").map((part) => part.trim()).filter(Boolean);
  const street = parts[0] ?? "";
  const place = parts.slice(1).join(", ");
  const placeMatch = place.match(/^(\d{3}\s?\d{2}|\d{5})\s+(.+)$/);
  const partialPlaceMatch = place.match(/^(\d[\d\s]{0,5})(?:\s+(.+))?$/);

  if (placeMatch) {
    return {
      city: placeMatch[2].trim(),
      postalCode: placeMatch[1].replace(/\s/g, ""),
      street,
    };
  }

  if (partialPlaceMatch) {
    return {
      city: partialPlaceMatch[2]?.trim() ?? "",
      postalCode: partialPlaceMatch[1].replace(/\s/g, ""),
      street,
    };
  }

  const inlineMatch = normalizedAddress.match(/^(.*?)(?:,\s*)?(\d{3}\s?\d{2}|\d{5})\s+([^,]+)(?:,\s*.*)?$/);
  if (inlineMatch) {
    return {
      city: inlineMatch[3].trim(),
      postalCode: inlineMatch[2].replace(/\s/g, ""),
      street: inlineMatch[1].replace(/,\s*$/, "").trim(),
    };
  }

  return { city: place, postalCode: "", street };
}

function joinAddressParts(parts: AddressParts) {
  const place = [parts.postalCode.trim(), parts.city.trim()].filter(Boolean).join(" ");
  return [parts.street.trim(), place].filter(Boolean).join(", ");
}

function displayAddress(address: string) {
  const trimmed = removeDuplicatedAddressPrefix(address);
  if (!trimmed) return "-";

  return joinAddressParts(splitAddressParts(trimmed)) || trimmed;
}

function updateAddressPart(address: string, key: keyof AddressParts, value: string) {
  return joinAddressParts({ ...splitAddressParts(address), [key]: value });
}

function portalPasswordFromAddress(address: string) {
  const postalCode = splitAddressParts(address).postalCode;
  const houseNumber = address.match(/\b\d+[A-Za-z]?\b/g)?.filter((part) => part.replace(/\D/g, "") !== postalCode)?.[0] ?? "";

  return `${postalCode}${houseNumber}` || "";
}

function portalInviteSubject(customer: CustomerFormState) {
  const prefix = isSwedishCustomerLanguage(customer.language) ? "Inbjudan kundportal" : "Einladung Kundenportal";
  return `${prefix} - Kolaretorp Service AB${customer.name.trim() ? ` - ${customer.name.trim()}` : ""}`;
}

function firstNameFromText(name: string) {
  const cleaned = name
    .replace(/^Familie\s+/i, "")
    .replace(/^Kontakt ergänzen$/i, "")
    .trim();
  return cleaned.split(/\s+/)[0] || "zusammen";
}

function splitNameParts(name: string) {
  const cleaned = name.replace(/^Familie\s+/i, "").trim();
  const [firstName = "", ...lastNameParts] = cleaned.split(/\s+/).filter(Boolean);

  return {
    firstName,
    lastName: lastNameParts.join(" "),
  };
}

function joinNameParts(firstName: string, lastName: string) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}

function portalInviteBody(customer: CustomerFormState) {
  const firstName = firstNameFromText(customer.name.trim() || customer.contact.trim());
  if (isSwedishCustomerLanguage(customer.language)) {
    return [
      `Hej ${firstName},`,
      "",
      "vi har förberett din åtkomst till kundportalen hos Kolaretorp Service AB.",
      "",
      "I portalen kan du se dina objekt, uppdrag, rapporter och meddelanden.",
      "",
      "Inloggningsuppgifter:",
      `Portal: https://homecare-kolaretorp.vercel.app/portal`,
      `Inloggningsmejl: ${customer.portalLoginEmail.trim() || customer.email.trim() || "-"}`,
      `Lösenord: ${customer.portalPassword.trim() || "-"}`,
      "",
      "Logga gärna in med dessa uppgifter i kundportalen.",
      "",
      "Med vänliga hälsningar",
      "Kolaretorp Service AB",
    ].join("\n");
  }

  return [
    `Hej ${firstName},`,
    "",
    "wir haben deinen Zugang zum Kundenportal von Kolaretorp Service AB vorbereitet.",
    "",
    "Im Portal kannst du deine Objekte, Aufträge, Berichte und Nachrichten einsehen.",
    "",
    "Zugangsdaten:",
    `Portal: https://homecare-kolaretorp.vercel.app/portal`,
    `Login-E-Mail: ${customer.portalLoginEmail.trim() || customer.email.trim() || "-"}`,
    `Passwort: ${customer.portalPassword.trim() || "-"}`,
    "",
    "Bitte melde dich mit diesen Daten im Kundenportal an.",
    "",
    "Liebe Grüße",
    "Kolaretorp Service AB",
  ].join("\n");
}

function primaryObjectImage(object: ObjectRecord) {
  return object.media.items.find((item) => item.type === "Bild" && item.isPrimary && item.previewUrl)
    ?? object.media.items.find((item) => item.type === "Bild" && item.previewUrl);
}

function primaryResourceImage(resource: ResourceRecord) {
  return resource.media?.find((item) => item.type === "Bild" && item.isPrimary && item.previewUrl)
    ?? resource.media?.find((item) => item.type === "Bild" && item.previewUrl);
}

function serviceToFieldTasks(service: ServiceItem): FieldTask[] {
  if (service.checklist.length === 0) {
    return [{
      id: service.id,
      title: service.name,
      meta: `${service.category} · ${serviceRate(service)}`,
      description: service.description,
      defaultMinutes: 0,
      defaultShowWorkTimeInReport: service.showWorkTimeInReports ?? true,
    }];
  }

  return service.checklist.map((item) => ({
    id: `${service.id}-${item.id}`,
    title: item.title,
    meta: `${service.name} · ${service.category} · ${serviceRate(service)}`,
    description: item.note,
    defaultMinutes: item.defaultMinutes,
    defaultShowWorkTimeInReport: service.showWorkTimeInReports ?? true,
  }));
}

function jobSelectedServices(job: JobRecord, services: ServiceItem[]) {
  const selected = (job.serviceIds ?? [])
    .map((id) => services.find((service) => service.id === id))
    .filter(Boolean) as ServiceItem[];

  return job.customService ? [...selected, job.customService] : selected;
}

function servicePriceValue(service: ServiceItem) {
  const normalized = service.price.replace(/\s/g, "").replace(",", ".");
  if (normalized.toLowerCase() === "inklusive") return 0;
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function materialLineAmount(item: JobMaterialItem) {
  const quantity = Number(item.quantity.replace(",", ".")) || 0;
  const price = Number(item.price.replace(/\s/g, "").replace(",", ".").match(/-?\d+(?:\.\d+)?/)?.[0] ?? 0);
  return quantity * price;
}

function serviceLineAmount(service: ServiceItem, quantity: string) {
  return (Number(quantity.replace(",", ".")) || 0) * servicePriceValue(service);
}

function jobBillingAmount(job: JobRecord, services: ServiceItem[]) {
  const amount = jobBillingLines(job, services).reduce((sum, line) => sum + lineNetAmount(line), 0);
  return `${Math.round(amount).toLocaleString("sv-SE")} SEK`;
}

function jobBillingLabel(job: JobRecord, services: ServiceItem[]) {
  const selectedServices = jobSelectedServices(job, services).map((service) => service.name);
  const selectedMaterials = (job.materialItems ?? []).map((item) => item.name);
  const labels = [...selectedServices, ...selectedMaterials];
  return labels.length > 0 ? labels.join(", ") : job.title;
}

function discountLineFor(baseLine: BillingLineItem, discount: LineDiscount | undefined, id: string, fallbackName = "Rabatt") {
  const discountValue = decimalValue(discount?.value);
  if (discountValue <= 0) return null;

  const baseNet = lineNetAmount(baseLine);
  if (baseNet <= 0) return null;

  const amount = discount?.type === "percent" ? baseNet * Math.min(discountValue, 100) / 100 : Math.min(discountValue, baseNet);
  return {
    currency: baseLine.currency,
    discountType: discount?.type,
    discountValue: discount?.value,
    id,
    kind: "Rabatt" as const,
    name: discount?.reason?.trim() || fallbackName,
    quantity: "1",
    taxRate: baseLine.taxRate,
    unit: discount?.type === "percent" ? "%" : "Rabatt",
    unitPrice: `-${amount}`,
  };
}

function jobBillingLines(job: JobRecord, services: ServiceItem[]): BillingLineItem[] {
  const serviceLines = jobSelectedServices(job, services).flatMap((service) => {
    const line: BillingLineItem = {
      accountingAccount: service.accountingAccount || defaultAccountingAccount("Leistung", service.name),
      currency: service.currency || "SEK",
      id: `LINE-${job.id}-${service.id}`,
      kind: "Leistung",
      name: service.name,
      quantity: job.serviceQuantities?.[service.id] || "1",
      taxRate: service.taxRate || "25",
      unit: service.unit,
      unitPrice: service.price,
    };
    const discountLine = discountLineFor(line, job.serviceDiscounts?.[service.id], `${line.id}-DISCOUNT`, `Rabatt ${service.name}`);
    return discountLine ? [line, discountLine] : [line];
  });
  const materialLines = (job.materialItems ?? []).flatMap((item) => {
    const line: BillingLineItem = {
      accountingAccount: item.accountingAccount || defaultAccountingAccount("Material", item.name),
      currency: item.currency || "SEK",
      id: `LINE-${job.id}-${item.id}`,
      kind: "Material",
      name: item.name,
      quantity: item.quantity || "1",
      taxRate: item.taxRate || "25",
      unit: item.unit,
      unitPrice: item.price,
    };
    const discountLine = discountLineFor(line, item.discount, `${line.id}-DISCOUNT`, `Rabatt ${item.name}`);
    return discountLine ? [line, discountLine] : [line];
  });

  const baseLines = [...serviceLines, ...materialLines];
  const discountValue = decimalValue(job.discountValue);
  if (discountValue <= 0) return baseLines;

  const baseNet = baseLines.reduce((sum, line) => sum + lineNetAmount(line), 0);
  if (baseNet <= 0) return baseLines;

  const discountAmount = job.discountType === "percent" ? baseNet * Math.min(discountValue, 100) / 100 : Math.min(discountValue, baseNet);
  const discountTaxRate = baseLines[0]?.taxRate || "25";
  const discountCurrency = baseLines[0]?.currency || "SEK";
  const discountLine: BillingLineItem = {
    currency: discountCurrency,
    discountType: job.discountType,
    discountValue: job.discountValue,
    id: `LINE-${job.id}-DISCOUNT`,
    kind: "Rabatt",
    name: job.discountReason?.trim() || "Rabatt",
    quantity: "1",
    taxRate: discountTaxRate,
    unit: job.discountType === "percent" ? "%" : "Rabatt",
    unitPrice: `-${discountAmount}`,
  };

  return [...baseLines, discountLine];
}

function jobBillingEnabled(job: JobRecord) {
  return job.billable;
}

function billableCompletedJobs(jobs: JobRecord[], billing: BillingRecord[]) {
  const billedJobIds = new Set(billing.map((item) => item.jobId || item.source));
  return visibleOperationalJobs(jobs).filter((job) => (
    jobBillingEnabled(job)
    && job.status === "erledigt"
    && !isSeriesMaster(job)
    && !billedJobIds.has(job.id)
  ));
}

function removableBillingDraftForJobIds(item: BillingRecord, jobIds: Set<string>) {
  if (effectiveInvoiceStatus(item) !== "entwurf") return false;
  const itemJobId = item.jobId || "";
  if (itemJobId && jobIds.has(itemJobId)) return true;
  return Array.from(jobIds).some((jobId) => item.source === jobId || item.source.startsWith(`${jobId} ·`));
}

function jobToForm(job: JobRecord): NewJobFormState {
  return {
    ...emptyJobForm(),
    title: job.title,
    type: job.type,
    priority: job.priority,
    status: job.status,
    dueDate: job.dueDate,
    startDate: job.startDate ?? job.dueDate,
    endDate: job.endDate ?? job.dueDate,
    assignedTo: job.assignedTo,
    description: job.description,
    internalNotes: job.internalNotes,
    serviceIds: job.serviceIds ?? [],
    serviceQuantities: job.serviceQuantities ?? {},
    serviceDiscounts: job.customService && job.serviceDiscounts?.[job.customService.id]
      ? { ...(job.serviceDiscounts ?? {}), customService: job.serviceDiscounts[job.customService.id] }
      : job.serviceDiscounts ?? {},
    customServiceName: job.customService?.name ?? "",
    customServiceCategory: job.customService?.category ?? "",
    customServiceUnit: job.customService?.unit ?? "",
    customServicePrice: job.customService?.price ?? "",
    customServiceCurrency: job.customService?.currency ?? "SEK",
    customServiceDescription: job.customService?.description ?? "",
    customServiceQuantity: job.customService ? job.serviceQuantities?.[job.customService.id] ?? "1" : "1",
    customServiceTaxRate: job.customService?.taxRate ?? "25",
    customServiceChecklist: job.customService?.checklist ?? [],
    materialItems: job.materialItems ?? [],
    discountType: job.discountType ?? "amount",
    discountValue: job.discountValue ?? "",
    discountReason: job.discountReason ?? "",
    billable: job.billable,
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
  return firstNameFromText(name);
}

const defaultReportMailBody = "Hallo {Vorname}, anbei der Bericht vom aktuellen Einsatz. Für Rückfragen stehen wir gerne zur Verfügung.";
const defaultWeeklyReportMailBody = "Hallo {Vorname}, anbei der Wochenbericht der letzten Einsätze. Für Rückfragen stehen wir gerne zur Verfügung.";
const defaultOfferMailBody = "Hej {Vorname},\n\nvielen Dank für deine Anfrage und dein Vertrauen.\n\nAnbei findest du unsere Offerte als PDF. Wir haben die vorgesehenen Leistungen und Materialien übersichtlich zusammengestellt, damit du in Ruhe prüfen kannst, ob alles so für dich passt.\n\nWenn du Fragen hast oder etwas angepasst werden soll, melde dich gerne jederzeit. Wenn alles passt, reicht uns eine kurze Bestätigung, dann planen wir den Auftrag verbindlich ein.\n\nLiebe Grüße\nKolaretorp Service AB";
const defaultOrderConfirmationMailBody = "Hej {Vorname},\n\nvielen Dank für deine Bestätigung.\n\nAnbei findest du unsere Auftragsbestätigung als PDF. Darin sind die geplanten Leistungen, Materialien und der geplante Zeitraum zusammengefasst.\n\nWenn etwas nicht passt oder vor der Ausführung noch angepasst werden soll, melde dich gerne jederzeit.\n\nLiebe Grüße\nKolaretorp Service AB";

function isSwedishCustomerLanguage(language: string | undefined) {
  const normalized = (language || "").trim().toLowerCase();
  return /\bsv\b/.test(normalized) || normalized.includes("svenska") || normalized.includes("schwedisch") || normalized.includes("swedish");
}

function customerLocale(customer: CustomerRecord | CustomerFormState | undefined) {
  return isSwedishCustomerLanguage(customer?.language) ? "sv-SE" : "de-DE";
}

function fillCustomerMailTemplate(template: string, customer: CustomerRecord | undefined) {
  const firstName = firstNameFromName(customer?.contact || customer?.name || "");
  return template.replaceAll("{Vorname}", firstName).replaceAll("{Förnamn}", firstName);
}

function customerReportSendBody(customer: CustomerRecord | undefined, report?: ReportRecord) {
  const customBody = report?.id.startsWith("WEEK-")
    ? customer?.weeklyReportMailBody?.trim()
    : customer?.reportMailBody?.trim();
  if (customBody) return fillCustomerMailTemplate(customBody, customer);
  const firstName = firstNameFromName(customer?.contact || customer?.name || "");
  if (isSwedishCustomerLanguage(customer?.language)) {
    return report?.id.startsWith("WEEK-")
      ? `Hej ${firstName},\n\nbifogat hittar du veckorapporten från de senaste uppdragen.\nTack för ditt förtroende.\n\nMed vänliga hälsningar\nKolaretorp Service AB`
      : `Hej ${firstName},\n\nbifogat hittar du rapporten från det senaste uppdraget.\nTack för ditt förtroende.\n\nMed vänliga hälsningar\nKolaretorp Service AB`;
  }
  return fillCustomerMailTemplate(report?.id.startsWith("WEEK-") ? defaultWeeklyReportMailBody : defaultReportMailBody, customer);
}

function customerReportSendSubject(report: ReportRecord, object: ObjectRecord, customer?: CustomerRecord) {
  const swedish = isSwedishCustomerLanguage(customer?.language);
  const reportKind = report.id.startsWith("WEEK-")
    ? (swedish ? "Veckorapport" : "Wochenbericht")
    : (swedish ? "Uppdragsrapport" : "Einsatz - Bericht");
  return `${reportKind} ${swedish ? "från" : "vom"} ${report.date} - ${object.name}`;
}

function reportRecipientEmail(object: ObjectRecord, customer: CustomerRecord | undefined) {
  return object.ownerEmail.trim() || customer?.email.trim() || "";
}

function offerRecipientEmail(object: ObjectRecord, customer: CustomerRecord | undefined) {
  return object.ownerEmail.trim() || customer?.email.trim() || "";
}

function offerNumber(job: JobRecord) {
  return job.offerNumber || `OFF-${new Date().getFullYear()}-${job.id.replace(/\D/g, "").slice(-4).padStart(4, "0")}`;
}

function orderConfirmationNumber(job: JobRecord) {
  return job.orderConfirmationNumber || `AB-${new Date().getFullYear()}-${job.id.replace(/\D/g, "").slice(-4).padStart(4, "0")}`;
}

function offerSendSubject(job: JobRecord, object: ObjectRecord, customer?: CustomerRecord) {
  const label = isSwedishCustomerLanguage(customer?.language) ? "Offert" : "Offerte";
  return `${label} ${offerNumber(job)} - ${job.title} - ${object.name}`;
}

function orderConfirmationSendSubject(job: JobRecord, object: ObjectRecord, customer?: CustomerRecord) {
  const label = isSwedishCustomerLanguage(customer?.language) ? "Orderbekräftelse" : "Auftragsbestätigung";
  return `${label} ${orderConfirmationNumber(job)} - ${job.title} - ${object.name}`;
}

function offerSendBody(customer: CustomerRecord | undefined) {
  const customBody = customer?.offerMailBody?.trim();
  if (customBody) return fillCustomerMailTemplate(customBody, customer);
  const firstName = firstNameFromName(customer?.contact || customer?.name || "");
  if (isSwedishCustomerLanguage(customer?.language)) {
    return `Hej ${firstName},\n\nstort tack för din förfrågan och ditt förtroende.\n\nBifogat hittar du vår offert som PDF. Vi har sammanställt planerade tjänster och material så att du i lugn och ro kan kontrollera att allt stämmer.\n\nHör gärna av dig om du har frågor eller om något ska justeras. Om allt ser bra ut räcker det med en kort bekräftelse, så planerar vi in uppdraget.\n\nMed vänliga hälsningar\nKolaretorp Service AB`;
  }
  return fillCustomerMailTemplate(defaultOfferMailBody, customer);
}

function orderConfirmationSendBody(customer: CustomerRecord | undefined) {
  const customBody = customer?.orderConfirmationMailBody?.trim();
  if (customBody) return fillCustomerMailTemplate(customBody, customer);
  const firstName = firstNameFromName(customer?.contact || customer?.name || "");
  if (isSwedishCustomerLanguage(customer?.language)) {
    return `Hej ${firstName},\n\nstort tack för din bekräftelse.\n\nBifogat hittar du vår orderbekräftelse som PDF. Där framgår de planerade tjänsterna, materialen och den planerade tidsperioden.\n\nHör gärna av dig om något inte stämmer eller om något ska ändras före utförandet.\n\nMed vänliga hälsningar\nKolaretorp Service AB`;
  }
  return fillCustomerMailTemplate(defaultOrderConfirmationMailBody, customer);
}

function defaultCustomerMessageSubject(customer: CustomerRecord | undefined) {
  return isSwedishCustomerLanguage(customer?.language)
    ? "Meddelande från Kolaretorp Service AB"
    : "Nachricht von Kolaretorp Service AB";
}

function decimalValue(value: string | undefined) {
  const normalized = (value || "").replace(/\s/g, "").replace(",", ".");
  return Number(normalized.match(/-?\d+(?:\.\d+)?/)?.[0] ?? 0);
}

function offerLines(job: JobRecord, services: ServiceItem[]): BillingLineItem[] {
  return jobBillingLines(job, services);
}

function lineNetAmount(line: BillingLineItem) {
  return decimalValue(line.quantity) * decimalValue(line.unitPrice);
}

function lineTaxAmount(line: BillingLineItem) {
  return lineNetAmount(line) * (decimalValue(line.taxRate) / 100);
}

function formatMoney(value: number, currency = "SEK") {
  const rounded = Math.round(value * 100) / 100;
  const absolute = Math.abs(rounded);
  const hasDecimals = Math.abs(absolute % 1) > 0.001;
  const sign = rounded < 0 ? "- " : "";
  return `${sign}${absolute.toLocaleString("sv-SE", {
    maximumFractionDigits: hasDecimals ? 2 : 0,
    minimumFractionDigits: hasDecimals ? 2 : 0,
  })} ${currency}`;
}

function offerTotals(lines: BillingLineItem[]) {
  const net = lines.reduce((sum, line) => sum + lineNetAmount(line), 0);
  const tax = lines.reduce((sum, line) => sum + lineTaxAmount(line), 0);
  const currency = lines[0]?.currency || "SEK";
  const taxByRate = lines.reduce<Record<string, number>>((groups, line) => ({
    ...groups,
    [line.taxRate]: (groups[line.taxRate] ?? 0) + lineTaxAmount(line),
  }), {});

  return { currency, gross: net + tax, net, tax, taxByRate };
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function invoiceTotals(item: BillingRecord) {
  if (item.lines?.length) return offerTotals(item.lines);
  const gross = decimalValue(item.amount);
  return { currency: "SEK", gross, net: gross, tax: 0, taxByRate: {} as Record<string, number> };
}

function sieDate(value: string | undefined) {
  return (value || new Date().toISOString().slice(0, 10)).replaceAll("-", "");
}

function sieText(value: string | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[åä]/gi, "a")
    .replace(/[ö]/gi, "o")
    .replace(/[ü]/gi, "u")
    .replace(/[ß]/g, "ss")
    .replace(/"/g, "'")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
}

function sieAmount(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return rounded.toFixed(2);
}

function sieFiscalYear(dateString: string | undefined) {
  const year = Number((dateString || new Date().toISOString().slice(0, 10)).slice(0, 4)) || new Date().getFullYear();
  return {
    end: `${year}1231`,
    start: `${year}0101`,
  };
}

function createSpirisSieFile(item: BillingRecord, object: ObjectRecord, customer: CustomerRecord | undefined, settings: CompanySettings) {
  const lines = item.lines?.length
    ? item.lines
    : [{
      accountingAccount: "3041",
      currency: "SEK",
      id: `${item.id}-LINE`,
      kind: "Leistung" as const,
      name: item.label,
      quantity: "1",
      taxRate: "0",
      unit: "Position",
      unitPrice: String(decimalValue(item.amount)),
    }];
  const totals = invoiceTotals({ ...item, lines });
  const invoiceDate = item.invoiceDate || new Date().toISOString().slice(0, 10);
  const fiscalYear = sieFiscalYear(invoiceDate);
  const accounts = new Map<string, string>([
    ["1510", "Kundfordringar"],
    ["2611", "Utgaende moms 25%"],
  ]);

  lines.forEach((line) => {
    const accounting = lineAccounting(line);
    accounts.set(accounting.account, accounting.label);
  });

  const heading = `${item.invoiceNumber || item.id} ${customer?.name || object.owner || object.name}`;
  const rows = [
    "#FLAGGA 0",
    '#PROGRAM "Homecare" "1.0"',
    "#FORMAT PC8",
    "#SIETYP 4",
    `#GEN ${sieDate(new Date().toISOString().slice(0, 10))}`,
    settings.organizationNumber ? `#ORGNR ${sieText(settings.organizationNumber)}` : "",
    `#FNAMN "${sieText(settings.name || "Kolaretorp Service AB")}"`,
    `#RAR 0 ${fiscalYear.start} ${fiscalYear.end}`,
    "#KPTYP BAS2026",
    "#VALUTA SEK",
    ...Array.from(accounts.entries()).map(([account, label]) => `#KONTO ${account} "${sieText(label)}"`),
    `#VER "" "" ${sieDate(invoiceDate)} "${sieText(heading)}"`,
    "{",
    `#TRANS 1510 {} ${sieAmount(totals.gross)}`,
    ...lines.map((line) => {
      const account = lineAccounting(line).account;
      return `#TRANS ${account} {} ${sieAmount(-lineNetAmount(line))}`;
    }),
    ...Object.entries(totals.taxByRate)
      .filter(([, amount]) => Math.abs(amount) > 0.004)
      .map(([, amount]) => `#TRANS 2611 {} ${sieAmount(-amount)}`),
    "}",
  ].filter(Boolean);

  return `${rows.join("\r\n")}\r\n`;
}

function downloadSpirisSieFile(item: BillingRecord, object: ObjectRecord, customer: CustomerRecord | undefined, settings: CompanySettings) {
  const content = createSpirisSieFile(item, object, customer, settings);
  const fileName = `${safeFileName(`Spiris-SIE-${item.invoiceNumber || item.id}`)}.si`;
  downloadBlob(new Blob([content], { type: "text/plain;charset=ibm437" }), fileName);
}

function effectiveInvoiceStatus(item: BillingRecord) {
  if (item.cancelledAt || item.invoiceStatus === "storniert") return "storniert";
  if (item.paidAt || item.invoiceStatus === "bezahlt") return "bezahlt";
  if (item.dueDate && item.invoiceStatus && ["gebucht", "gesendet"].includes(item.invoiceStatus) && item.dueDate < new Date().toISOString().slice(0, 10)) return "überfällig";
  if (item.sentAt || item.invoiceStatus === "gesendet") return "gesendet";
  if (item.invoicedAt || item.status === "abgerechnet" || item.invoiceStatus === "gebucht") return "gebucht";
  return "entwurf";
}

function nextOutgoingBookNumber(billing: BillingRecord[], invoiceDate: string) {
  const year = invoiceDate.slice(0, 4) || String(new Date().getFullYear());
  const existingCount = billing.filter((item) => (
    (item.outgoingBookNumber || item.invoicedAt)
    && (item.invoiceDate || item.invoicedAt || "").slice(0, 4) === year
  )).length;
  return `AR-${year}-${String(existingCount + 1).padStart(4, "0")}`;
}

function invoiceSubject(item: BillingRecord, object: ObjectRecord, customer?: CustomerRecord) {
  void customer;
  return `Faktura ${item.invoiceNumber || item.id} - ${object.name}`;
}

const vismaChartOfAccounts = [
  { account: "3041", category: "Leistung", label: "Arbeitsleistung / Service" },
  { account: "3051", category: "Leistung", label: "Kommunikation / Bericht" },
  { account: "3055", category: "Leistung", label: "Reinigung" },
  { account: "3056", category: "Leistung", label: "Außenbereich / Pool / Garten" },
  { account: "3058", category: "Material", label: "Weiterberechnetes Material" },
  { account: "3730", category: "Rabatt", label: "Gewährte Rabatte" },
];

const legacyAccountingRules = [
  { account: "3041", match: /arbeit|betreuung|einsatz|kontrolle|pflege|service|stunde|wartung/i, type: "Leistung" },
  { account: "3051", match: /bericht|e-mail|kommunikation|nachricht|rückmeldung/i, type: "Leistung" },
  { account: "3055", match: /reinigung|wäsche|innen/i, type: "Leistung" },
  { account: "3056", match: /pool|garten|außen|aussen/i, type: "Leistung" },
  { account: "3058", match: /material|ersatzteil|filter|chemie|farbe|holz|schraube/i, type: "Material" },
];

function accountingAccountLabel(account: string | undefined) {
  return vismaChartOfAccounts.find((entry) => entry.account === account)?.label || "Konto nicht im Kontenplan";
}

function defaultAccountingAccount(kind: BillingLineItem["kind"], name = "") {
  if (kind === "Rabatt") return "3730";
  const legacyRule = legacyAccountingRules.find((entry) => entry.type === kind && entry.match.test(name));
  if (legacyRule) return legacyRule.account;
  return kind === "Material" ? "3058" : "3041";
}

function lineAccounting(line: BillingLineItem) {
  const account = line.accountingAccount || defaultAccountingAccount(line.kind, line.name);
  return { account, label: accountingAccountLabel(account) };
}

function billingCustomerNumber(customer: CustomerRecord | undefined) {
  return normalizeReadableNumber(customer?.personalNumber) || customer?.id || "Kundennummer fehlt";
}

function vismaTransferRows(item: BillingRecord, customer: CustomerRecord | undefined) {
  return (item.lines ?? []).map((line) => {
    const accounting = lineAccounting(line);
    return {
      account: accounting.account,
      amount: formatMoney(lineNetAmount(line), line.currency),
      customerNumber: billingCustomerNumber(customer),
      currency: line.currency,
      label: accounting.label,
      moms: `${line.taxRate}%`,
      name: line.name,
    };
  });
}

function companyFooterLines(settings: CompanySettings) {
  return [
    settings.name,
    settings.address,
    settings.email,
    settings.organizationNumber ? `Org.-Nr.: ${settings.organizationNumber}` : "Org.-Nr.: bitte ergänzen",
    settings.vatNumber ? `Momsreg.nr/VAT: ${settings.vatNumber}` : "Momsreg.nr/VAT: bitte ergänzen",
    settings.fSkattApproved ? "Godkänd för F-skatt" : "",
    settings.bank ? `Bank: ${settings.bank}` : "Bank: bitte ergänzen",
  ].filter(Boolean);
}

function companyFooterBlocks(settings: CompanySettings) {
  return [
    {
      lines: [settings.name, settings.email],
      title: "Kolaretorp",
    },
    {
      lines: [settings.bank || "Bankdaten bitte ergänzen"],
      title: "Bank",
    },
    {
      lines: [
        settings.organizationNumber ? `Org.-Nr.: ${settings.organizationNumber}` : "Org.-Nr.: bitte ergänzen",
        settings.vatNumber ? `Momsreg.nr/VAT: ${settings.vatNumber}` : "Momsreg.nr/VAT: bitte ergänzen",
        settings.fSkattApproved ? "Godkänd för F-skatt" : "",
      ].filter(Boolean),
      title: "Skatt",
    },
  ];
}

function localizedUnit(unit: string, swedish: boolean) {
  if (!swedish) return unit;
  const normalized = unit.trim().toLowerCase();
  const translations: Record<string, string> = {
    bericht: "rapport",
    besuch: "besök",
    einsatz: "uppdrag",
    kilogramm: "kg",
    liter: "liter",
    meter: "meter",
    nachricht: "meddelande",
    rolle: "rulle",
    stunde: "timme",
    stunden: "timmar",
    stück: "styck",
    stuck: "styck",
  };

  return translations[normalized] ?? unit;
}

function localizedJobStatus(status: JobRecord["status"], swedish: boolean) {
  if (!swedish) return readableJobStatus(status);
  const labels: Record<string, string> = {
    abgerechnet: "fakturerad",
    abrechenbar: "fakturerbar",
    erledigt: "klar",
    offerte: "offert",
    offen: "öppen",
    "in Arbeit": "pågår",
    geplant: "planerad",
  };
  return labels[status] ?? readableJobStatus(status);
}

function cleanDiscount(discount: LineDiscount | undefined) {
  if (!discount || decimalValue(discount.value) <= 0) return undefined;
  return {
    reason: discount.reason?.trim() || "",
    type: discount.type,
    value: discount.value.trim(),
  };
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
  const swedish = isSwedishCustomerLanguage(customer?.language);
  let y = margin;

  function addFooter() {
    const pageCount = pdf.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      pdf.setPage(page);
      pdf.setFontSize(8);
      pdf.setTextColor(120);
      pdf.text(`${swedish ? "Sida" : "Seite"} ${page} ${swedish ? "av" : "von"} ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: "right" });
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

  function reportItemLabel(item: FieldTaskResult, index: number) {
    if (!report.id.startsWith("WEEK-")) return `${index + 1}. ${item.title}`;
    const dateMatch = item.meta.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? item.id.match(/\d{8}/)?.[0]?.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
    return `${dateMatch ?? `${index + 1}.`} · ${item.title}`;
  }

  async function addContainedImage(source: string, x: number, boxY: number, boxWidth: number, boxHeight: number) {
    const imageDataUrl = await mediaSourceToDataUrl(source);
    const image = await loadImage(imageDataUrl);
    const ratio = image?.naturalWidth && image?.naturalHeight ? image.naturalWidth / image.naturalHeight : boxWidth / boxHeight;
    const fitWidth = ratio > boxWidth / boxHeight ? boxWidth : boxHeight * ratio;
    const fitHeight = ratio > boxWidth / boxHeight ? boxWidth / ratio : boxHeight;
    const drawX = x + (boxWidth - fitWidth) / 2;
    const drawY = boxY + (boxHeight - fitHeight) / 2;

    pdf.setDrawColor(220);
    pdf.rect(x, boxY, boxWidth, boxHeight);
    pdf.addImage(imageDataUrl, "JPEG", drawX, drawY, fitWidth, fitHeight, undefined, "FAST");
  }

  function drawCard(x: number, cardY: number, width: number, height: number, fill: [number, number, number] = [250, 250, 251]) {
    pdf.setFillColor(...fill);
    pdf.setDrawColor(225, 228, 233);
    pdf.roundedRect(x, cardY, width, height, 2.2, 2.2, "FD");
  }

  function drawBadge(text: string, x: number, badgeY: number, width = 28) {
    pdf.setFillColor(236, 245, 241);
    pdf.setDrawColor(192, 220, 207);
    pdf.roundedRect(x, badgeY, width, 7, 3.5, 3.5, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.8);
    pdf.setTextColor(41, 111, 85);
    pdf.text(text, x + width / 2, badgeY + 4.7, { align: "center" });
  }

  function drawSectionTitle(title: string) {
    ensureSpace(12);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10.8);
    pdf.setTextColor(18, 22, 28);
    pdf.text(title, margin, y);
    y += 5;
  }

  function drawInfoBox(title: string, rows: Array<[string, string]>, x: number, cardY: number, width: number, height: number) {
    drawCard(x, cardY, width, height);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.8);
    pdf.setTextColor(18, 22, 28);
    pdf.text(title, x + 3.5, cardY + 5.5);
    let rowY = cardY + 10.5;
    rows.forEach(([label, value]) => {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(6.3);
      pdf.setTextColor(105, 111, 122);
      pdf.text(label, x + 3.5, rowY);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.1);
      pdf.setTextColor(18, 22, 28);
      const lines = (pdf.splitTextToSize(value || "-", width - 7) as string[]).slice(0, 2);
      pdf.text(lines, x + 3.5, rowY + 3.4);
      rowY += 8.5 + Math.max(0, lines.length - 1) * 3;
    });
  }

  const contentWidth = pageWidth - margin * 2;
  const reportKind = report.id.startsWith("WEEK-") ? (swedish ? "Veckorapport" : "Wochenbericht") : (swedish ? "Uppdragsrapport" : "Einsatzbericht");
  const customerComment = visibleReportCustomerComment(report);
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");

  drawCard(margin, y, contentWidth, 28, [255, 255, 255]);
  const logoDataUrl = await fetchAssetAsDataUrl("/kolaretorp-logo.png");
  if (logoDataUrl) {
    try {
      pdf.addImage(logoDataUrl, "PNG", margin + 4, y + 4, 48, 5, undefined, "FAST");
    } catch {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(18, 22, 28);
      pdf.text("Kolaretorp Service AB", margin + 4, y + 8);
    }
  } else {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(18, 22, 28);
    pdf.text("Kolaretorp Service AB", margin + 4, y + 8);
  }
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.setTextColor(18, 22, 28);
  pdf.text(reportKind, margin + 4, y + 15);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(105, 111, 122);
  pdf.text(`${swedish ? "Rapportnummer" : "Berichtsnummer"} ${report.id}`, margin + 4, y + 21);
  drawBadge(job?.status ?? "Bericht", pageWidth - margin - 34, y + 4, 30);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.setTextColor(18, 22, 28);
  pdf.text(report.date, pageWidth - margin - 4, y + 21, { align: "right" });
  y += 34;

  const heroY = y;
  drawCard(margin, heroY, contentWidth, 38);
  const imageX = margin + 4;
  const imageY = heroY + 4;
  const objectImageWidth = 48;
  const objectImageHeight = 30;

  const objectImage = primaryObjectImage(object);
  if (objectImage?.previewUrl) {
    try {
      await addContainedImage(objectImage.previewUrl, imageX, imageY, objectImageWidth, objectImageHeight);
    } catch {
      pdf.setDrawColor(210);
      pdf.rect(imageX, imageY, objectImageWidth, objectImageHeight);
    }
  } else {
    pdf.setDrawColor(210);
    pdf.rect(imageX, imageY, objectImageWidth, objectImageHeight);
  }

  const heroTextX = margin + 58;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6.8);
  pdf.setTextColor(33, 111, 148);
  pdf.text(reportKind.toUpperCase(), heroTextX, heroY + 9);
  pdf.setFontSize(13);
  pdf.setTextColor(18, 22, 28);
  pdf.text(object.name, heroTextX, heroY + 17, { maxWidth: contentWidth - 64 });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(105, 111, 122);
  pdf.text(displayAddress(object.address), heroTextX, heroY + 24, { maxWidth: contentWidth - 64 });
  pdf.text(`${report.title} · ${report.date}`, heroTextX, heroY + 31, { maxWidth: contentWidth - 64 });
  y += 44;

  ensureSpace(34);
  const gap = 3;
  const infoBoxWidth = (contentWidth - gap * 3) / 4;
  const infoY = y;
  drawInfoBox("Objekt", [["Objekt", object.name], ["Adresse", displayAddress(object.address)], ["Eigentümer", object.owner]], margin, infoY, infoBoxWidth, 32);
  drawInfoBox("Kunde", [["Kunde", customer?.name ?? object.owner], ["Kontakt", customer?.contact ?? object.owner], ["E-Mail", reportRecipientEmail(object, customer) || "-"]], margin + (infoBoxWidth + gap), infoY, infoBoxWidth, 32);
  drawInfoBox("Auftrag", [["Auftrag", report.title], ["Datum", report.date], ["Rhythmus", job ? scheduleLabel(job.schedule) : "-"]], margin + (infoBoxWidth + gap) * 2, infoY, infoBoxWidth, 32);
  drawInfoBox("Leistung", [["Priorität", job?.priority ?? "-"], ["Bearbeiter", job?.assignedTo ?? "-"], [visibleReportWorkMinutes(report.checklistResults) > 0 ? "Zeit / Material" : "Material", `${visibleReportWorkMinutes(report.checklistResults) > 0 ? `${visibleReportWorkMinutes(report.checklistResults)} min.` : ""}${job?.material?.trim() && job.material.trim() !== "-" ? ` ${job.material.trim()}` : ""}`.trim() || "-"]], margin + (infoBoxWidth + gap) * 3, infoY, infoBoxWidth, 32);
  y += 38;

  const summaryBoxes = customerComment
    ? [{ title: swedish ? "Sammanfattning" : "Zusammenfassung", text: report.summary }, { title: "Kommentar an den Kunden", text: customerComment }]
    : [{ title: swedish ? "Sammanfattning" : "Zusammenfassung", text: report.summary }];
  const summaryWidth = customerComment ? (contentWidth - gap) / 2 : contentWidth;
  const summaryLines = summaryBoxes.map((box) => pdf.splitTextToSize(box.text || "-", summaryWidth - 8) as string[]);
  const summaryHeight = Math.max(22, ...summaryLines.map((lines) => 11 + lines.length * 4));
  ensureSpace(summaryHeight + 8);
  summaryBoxes.forEach((box, index) => {
    const x = margin + index * (summaryWidth + gap);
    drawCard(x, y, summaryWidth, summaryHeight);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(18, 22, 28);
    pdf.text(box.title, x + 4, y + 6);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(105, 111, 122);
    pdf.text(summaryLines[index], x + 4, y + 11);
  });
  y += summaryHeight + 8;

  drawSectionTitle(swedish ? "Kontroll på plats" : "Kontrolle vor Ort");

  for (const [index, item] of report.checklistResults.entries()) {
    const noteLines = pdf.splitTextToSize(item.note || "Keine zusätzliche Info erfasst.", contentWidth - 8) as string[];
    const descriptionLines = item.description ? pdf.splitTextToSize(item.description, contentWidth - 8) as string[] : [];
    const imagePhotos = item.photos.filter((photo) => photo.previewUrl);
    const photoRows = Math.ceil(imagePhotos.length / 3);
    const taskHeight = 31 + descriptionLines.length * 3.6 + noteLines.length * 3.8 + photoRows * 35;
    ensureSpace(taskHeight + 4);
    const taskY = y;
    drawCard(margin, taskY, contentWidth, taskHeight);
    drawBadge(item.completed ? (swedish ? "utfört" : "ausgeführt") : (swedish ? "ej utfört" : "nicht ausgeführt"), margin + 4, taskY + 4, item.completed ? 28 : 34);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.7);
    pdf.setTextColor(18, 22, 28);
    pdf.text(reportItemLabel(item, index), margin + 36, taskY + 9, { maxWidth: contentWidth - 78 });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(105, 111, 122);
    pdf.text(item.meta, margin + 36, taskY + 14, { maxWidth: contentWidth - 78 });
    if (item.showWorkTimeInReport !== false) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.2);
      pdf.setTextColor(105, 111, 122);
      pdf.text(`${item.minutes || 0} min.`, pageWidth - margin - 4, taskY + 9, { align: "right" });
    }
    let innerY = taskY + 21;
    if (descriptionLines.length) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(105, 111, 122);
      pdf.text(descriptionLines, margin + 4, innerY);
      innerY += descriptionLines.length * 3.6 + 2;
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.8);
    pdf.setTextColor(105, 111, 122);
    pdf.text("Hinweis / Info", margin + 4, innerY);
    innerY += 3.8;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.text(noteLines, margin + 4, innerY);
    innerY += noteLines.length * 3.8 + 4;

    if (imagePhotos.length) {
      const photoGap = 3;
      const photoBoxWidth = (contentWidth - 8 - photoGap * 2) / 3;
      const photoBoxHeight = 30;
      for (let photoIndex = 0; photoIndex < imagePhotos.length; photoIndex += 3) {
        const rowPhotos = imagePhotos.slice(photoIndex, photoIndex + 3);
        for (const [rowIndex, photo] of rowPhotos.entries()) {
          const previewUrl = photo.previewUrl;
          if (!previewUrl) continue;
          const photoX = margin + 4 + rowIndex * (photoBoxWidth + photoGap);
          try {
            await addContainedImage(previewUrl, photoX, innerY, photoBoxWidth, photoBoxHeight);
          } catch {
            pdf.rect(photoX, innerY, photoBoxWidth, photoBoxHeight);
          }
        }
        innerY += photoBoxHeight + 5;
      }
    }
    y += taskHeight + 4;
  }

  if (report.attachments?.length) {
    ensureSpace(18 + report.attachments.length * 5);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(20);
    pdf.text(swedish ? "Bilagor" : "Dateianhänge", margin, y);
    y += 7;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    report.attachments.forEach((attachment) => {
      addWrappedText(`${attachment.name} (${attachment.type || "Datei"})`, margin + 4, pageWidth - margin * 2 - 8, 4.2);
    });
  }

  addFooter();
  return pdf.output("blob");
}

async function createOfferPdfBlob(job: JobRecord, object: ObjectRecord, customer: CustomerRecord | undefined, services: ServiceItem[], companySettings: CompanySettings, documentType: "offer" | "confirmation" = "offer") {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const lines = offerLines(job, services);
  const totals = offerTotals(lines);
  const swedish = isSwedishCustomerLanguage(customer?.language);
  const isConfirmation = documentType === "confirmation";
  let y = margin;

  function addFooter() {
    const pageCount = pdf.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      pdf.setPage(page);
      pdf.setDrawColor(215);
      pdf.line(margin, pageHeight - 30, pageWidth - margin, pageHeight - 30);
      const footerBlocks = companyFooterBlocks(companySettings);
      const pageLabel = `${swedish ? "Sida" : "Seite"} ${page} ${swedish ? "av" : "von"} ${pageCount}`;
      const footerWidth = pageWidth - margin * 2 - 22;
      const blockWidth = footerWidth / footerBlocks.length;
      footerBlocks.forEach((block, index) => {
        const x = margin + index * blockWidth;
        pdf.setDrawColor(232);
        if (index > 0) pdf.line(x - 5, pageHeight - 27, x - 5, pageHeight - 12);
        pdf.setTextColor(135);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(6.6);
        pdf.text(block.title, x, pageHeight - 24);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.2);
        pdf.setTextColor(92);
        block.lines.slice(0, 3).forEach((line, lineIndex) => {
          pdf.text(line, x, pageHeight - 19 + lineIndex * 4.2, { maxWidth: blockWidth - 9 });
        });
      });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.2);
      pdf.setTextColor(92);
      pdf.text(pageLabel, pageWidth - margin, pageHeight - 8, { align: "right" });
    }
    pdf.setTextColor(20);
  }

  function addText(text: string, x: number, maxWidth: number, fontSize = 10, lineGap = 5) {
    pdf.setFontSize(fontSize);
    const wrapped = pdf.splitTextToSize(text || "-", maxWidth);
    pdf.text(wrapped, x, y);
    y += wrapped.length * lineGap;
  }

  function ensureSpace(height: number) {
    if (y + height < pageHeight - 30) return;
    pdf.addPage();
    y = margin;
  }

  const logoData = await fetchAssetAsDataUrl("/kolaretorp-logo.png");
  if (logoData) {
    const logoImage = await loadImage(logoData);
    if (logoImage) {
      const logoWidth = 55;
      const logoHeight = logoWidth * (logoImage.naturalHeight / logoImage.naturalWidth);
      pdf.addImage(logoData, "PNG", margin, y, logoWidth, Math.min(logoHeight, 18));
    }
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text(isConfirmation ? (swedish ? "Orderbekräftelse" : "Auftragsbestätigung") : (swedish ? "Offert" : "Offerte"), pageWidth - margin, y + 8, { align: "right" });
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(isConfirmation ? orderConfirmationNumber(job) : offerNumber(job), pageWidth - margin, y + 15, { align: "right" });
  y += 28;

  pdf.setFont("helvetica", "bold");
  addText(companySettings.name, margin, 80, 11, 5);
  pdf.setFont("helvetica", "normal");
  addText(`${displayAddress(companySettings.address)}\n${companySettings.email}`, margin, 80, 9, 4);
  y += 4;

  const rightX = 118;
  const topY = 42;
  pdf.setFont("helvetica", "bold");
  pdf.text(swedish ? "Kund" : "Kunde", rightX, topY);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(pdf.splitTextToSize(`${customer?.name ?? object.owner}\n${displayAddress(customer?.billingAddress || customer?.address || object.billingAddress || object.address)}\n${customer?.email || object.ownerEmail || ""}`, 76), rightX, topY + 6);

  y = 78;
  pdf.setFont("helvetica", "bold");
  addText(job.title, margin, pageWidth - margin * 2, 14, 6);

  const meta = [
    `${isConfirmation ? (swedish ? "Bekräftelsedatum" : "Bestätigungsdatum") : "Offertdatum"}: ${new Date().toLocaleDateString(customerLocale(customer))}`,
    `${swedish ? "Planerad period" : "Geplanter Zeitraum"}: ${localizedJobDateRangeLabel(job, swedish)}`,
    `Objekt: ${object.name}, ${displayAddress(object.address)}`,
    `Status: ${localizedJobStatus(job.status, swedish)}`,
  ];
  pdf.setFontSize(9);
  meta.forEach((item) => {
    pdf.text(item, margin, y);
    y += 5;
  });
  y += 8;

  if (job.description.trim()) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    addText(job.description, margin, pageWidth - margin * 2, 9, 5);
    y += 8;
  }

  pdf.setFont("helvetica", "bold");
  pdf.text(swedish ? "Rad" : "Position", margin, y);
  pdf.text(swedish ? "Antal" : "Menge", 105, y);
  pdf.text(swedish ? "Pris" : "Preis", 130, y);
  pdf.text("Moms", 155, y);
  pdf.text("Netto", pageWidth - margin, y, { align: "right" });
  y += 3;
  pdf.line(margin, y, pageWidth - margin, y);
  y += 7;
  pdf.setFont("helvetica", "normal");

  lines.forEach((line, index) => {
    ensureSpace(18);
    const isDiscount = line.kind === "Rabatt";
    const nextLine = lines[index + 1];
    const endsPositionGroup = isDiscount || nextLine?.kind !== "Rabatt";
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(isDiscount ? 8 : 9);
    pdf.setTextColor(isDiscount ? 110 : 20);
    const kindLabel = swedish && line.kind === "Leistung" ? "Tjänst" : swedish && line.kind === "Material" ? "Material" : line.kind;
    const discountMeta = isDiscount && line.discountType === "percent" && line.discountValue
      ? ` (${decimalValue(line.discountValue).toLocaleString("sv-SE", { maximumFractionDigits: 2 })} %)`
      : "";
    const labelX = isDiscount ? margin + 8 : margin;
    const labelWidth = isDiscount ? 82 : 84;
    const lineLabel = isDiscount
      ? `${line.name.toLowerCase() === "rabatt" ? "Rabatt" : line.name}${discountMeta}`
      : `${kindLabel}: ${line.name}`;
    const wrappedName = pdf.splitTextToSize(lineLabel, labelWidth);
    pdf.text(wrappedName, labelX, y);
    if (isDiscount) {
      pdf.text(formatMoney(lineNetAmount(line), line.currency), pageWidth - margin, y, { align: "right" });
    } else {
      pdf.text(`${line.quantity} ${localizedUnit(line.unit, swedish)}`, 105, y);
      pdf.text(`${line.unitPrice} ${line.currency}`, 130, y);
      pdf.text(`${line.taxRate}%`, 155, y);
      pdf.text(formatMoney(lineNetAmount(line), line.currency), pageWidth - margin, y, { align: "right" });
    }
    y += Math.max(isDiscount ? 5.2 : 7, wrappedName.length * 4.2);
    if (endsPositionGroup && index < lines.length - 1) {
      y += 1.6;
      pdf.setDrawColor(232);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 4.5;
    }
    pdf.setTextColor(20);
  });

  if (lines.length === 0) {
    addText(swedish ? "Inga tjänste- eller materialrader har registrerats ännu." : "Noch keine Leistungs- oder Materialpositionen erfasst.", margin, pageWidth - margin * 2, 10, 5);
  }

  y += 5;
  pdf.line(110, y, pageWidth - margin, y);
  y += 7;
  pdf.setFont("helvetica", "bold");
  pdf.text("Netto", 130, y);
  pdf.text(formatMoney(totals.net, totals.currency), pageWidth - margin, y, { align: "right" });
  y += 6;
  Object.entries(totals.taxByRate).forEach(([taxRate, amount]) => {
    pdf.text(`Moms ${taxRate}%`, 130, y);
    pdf.text(formatMoney(amount, totals.currency), pageWidth - margin, y, { align: "right" });
    y += 6;
  });
  pdf.text(swedish ? "Totalt inkl. moms" : "Gesamt inkl. Moms", 130, y);
  pdf.text(formatMoney(totals.gross, totals.currency), pageWidth - margin, y, { align: "right" });

  y += 14;
  pdf.setFont("helvetica", "normal");
  addText(
    isConfirmation
      ? (swedish ? "Denna orderbekräftelse baseras på överenskomna tjänste- och materialrader. Hör av dig om något behöver justeras före utförandet." : "Diese Auftragsbestätigung basiert auf den vereinbarten Leistungs- und Materialpositionen. Bitte melde dich, falls vor der Ausführung noch etwas angepasst werden soll.")
      : (swedish ? "Denna offert baseras på aktuellt registrerade tjänste- och materialrader. Ändringar kan göras efter avstämning." : "Diese Offerte basiert auf den aktuell erfassten Leistungs- und Materialpositionen. Änderungen nach Rücksprache bleiben vorbehalten."),
    margin,
    pageWidth - margin * 2,
    9,
    4,
  );

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

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function downloadCustomerReportPdf(report: ReportRecord, object: ObjectRecord, job: JobRecord | undefined, customer: CustomerRecord | undefined) {
  const pdfBlob = await createReportPdfBlob(report, object, job, customer);
  const fileName = `${safeFileName(customerReportSendSubject(report, object, customer))}.pdf`;
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function sendCustomerReportMail(report: ReportRecord, object: ObjectRecord, job: JobRecord | undefined, customer: CustomerRecord | undefined, body?: string) {
  const recipientEmail = reportRecipientEmail(object, customer);
  if (!recipientEmail) throw new Error("Keine Empfängeradresse in den Objekt- oder Kundendaten gefunden.");

  const pdfBlob = await createReportPdfBlob(report, object, job, customer);
  const fileName = `${safeFileName(customerReportSendSubject(report, object, customer))}.pdf`;
  const attachmentBase64 = await blobToBase64(pdfBlob);
  const extraAttachments = (await Promise.all((report.attachments ?? []).map(async (attachment) => {
    const source = attachment.dataUrl || attachment.storageUrl;
    if (!source) return null;
    const dataUrl = await mediaSourceToDataUrl(source);
    return {
      content: dataUrlToBase64(dataUrl),
      contentType: attachment.type,
      filename: attachment.name,
    };
  }))).filter((attachment): attachment is { content: string; contentType: string; filename: string } => Boolean(attachment));
  const response = await fetch("/api/reports/send", {
    body: JSON.stringify({
      attachmentBase64,
      attachments: extraAttachments,
      body: body?.trim() || customerReportSendBody(customer, report),
      cc: "info@kolaretorp.se",
      filename: fileName,
      subject: customerReportSendSubject(report, object, customer),
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

async function downloadOfferPdf(job: JobRecord, object: ObjectRecord, customer: CustomerRecord | undefined, services: ServiceItem[], companySettings: CompanySettings) {
  const pdfBlob = await createOfferPdfBlob(job, object, customer, services, companySettings);
  const fileName = `${safeFileName(offerSendSubject(job, object, customer))}.pdf`;
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function sendOfferMail(job: JobRecord, object: ObjectRecord, customer: CustomerRecord | undefined, services: ServiceItem[], companySettings: CompanySettings, body?: string) {
  const recipientEmail = offerRecipientEmail(object, customer);
  if (!recipientEmail) throw new Error("Keine Empfängeradresse in den Objekt- oder Kundendaten gefunden.");

  const pdfBlob = await createOfferPdfBlob(job, object, customer, services, companySettings);
  const fileName = `${safeFileName(offerSendSubject(job, object, customer))}.pdf`;
  const attachmentBase64 = await blobToBase64(pdfBlob);
  const response = await fetch("/api/reports/send", {
    body: JSON.stringify({
      attachmentBase64,
      body: body?.trim() || offerSendBody(customer),
      cc: "info@kolaretorp.se",
      filename: fileName,
      subject: offerSendSubject(job, object, customer),
      to: recipientEmail,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const payload = await response.json() as { error?: string; sent?: boolean };

  if (!response.ok || !payload.sent) {
    throw new Error(payload.error || "Offerte konnte nicht gesendet werden.");
  }
}

async function downloadOrderConfirmationPdf(job: JobRecord, object: ObjectRecord, customer: CustomerRecord | undefined, services: ServiceItem[], companySettings: CompanySettings) {
  const pdfBlob = await createOfferPdfBlob(job, object, customer, services, companySettings, "confirmation");
  const fileName = `${safeFileName(orderConfirmationSendSubject(job, object, customer))}.pdf`;
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function createInvoicePdfBlob(item: BillingRecord, object: ObjectRecord, customer: CustomerRecord | undefined, companySettings: CompanySettings) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const lines = item.lines?.length ? item.lines : [{
    currency: "SEK",
    id: `${item.id}-LINE`,
    kind: "Leistung" as const,
    name: item.label,
    quantity: "1",
    taxRate: "0",
    unit: "Position",
    unitPrice: String(decimalValue(item.amount)),
  }];
  const totals = invoiceTotals({ ...item, lines });
  void customer;
  const swedish = true;
  let y = margin;

  function ensureSpace(height: number) {
    if (y + height < pageHeight - 32) return;
    pdf.addPage();
    y = margin;
  }

  function addWrapped(text: string, x: number, width: number, fontSize = 9, lineHeight = 4.5) {
    pdf.setFontSize(fontSize);
    const wrapped = pdf.splitTextToSize(text || "-", width);
    pdf.text(wrapped, x, y);
    y += wrapped.length * lineHeight;
  }

  const logoData = await fetchAssetAsDataUrl("/kolaretorp-logo.png");
  if (logoData) {
    try {
      const logoImage = await loadImage(logoData);
      const logoWidth = 55;
      const logoHeight = logoWidth * (logoImage?.naturalHeight ? logoImage.naturalHeight / logoImage.naturalWidth : 0.12);
      pdf.addImage(logoData, "PNG", margin, y, logoWidth, Math.min(logoHeight, 18));
    } catch {
      pdf.text(companySettings.name, margin, y + 8);
    }
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text(swedish ? "Faktura" : "Rechnung", pageWidth - margin, y + 8, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(item.invoiceNumber || item.id, pageWidth - margin, y + 15, { align: "right" });
  y += 28;

  pdf.setFont("helvetica", "bold");
  addWrapped(companySettings.name, margin, 82, 11, 5);
  pdf.setFont("helvetica", "normal");
  addWrapped(`${displayAddress(companySettings.address)}\n${companySettings.email}`, margin, 82, 9, 4);

  const recipientX = 118;
  const recipientAddress = customer?.billingAddress || customer?.address || object.billingAddress || object.address;
  pdf.setFont("helvetica", "bold");
  pdf.text(swedish ? "Kund" : "Kunde", recipientX, 44);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(pdf.splitTextToSize(`${customer?.name || object.owner}\n${displayAddress(recipientAddress)}\n${customer?.email || object.ownerEmail || ""}`, 76), recipientX, 50);

  y = 80;
  const meta = [
    `${swedish ? "Fakturadatum" : "Rechnungsdatum"}: ${item.invoiceDate || new Date().toISOString().slice(0, 10)}`,
    `${swedish ? "Förfallodatum" : "Fällig am"}: ${item.dueDate || addDays(item.invoiceDate || new Date().toISOString().slice(0, 10), 30)}`,
    `${swedish ? "Utfört datum" : "Leistungsdatum"}: ${item.serviceDate || "-"}`,
    `Objekt: ${object.name}, ${displayAddress(object.address)}`,
  ];
  pdf.setFontSize(9);
  meta.forEach((row) => {
    pdf.text(row, margin, y);
    y += 5;
  });
  y += 8;

  pdf.setFont("helvetica", "bold");
  pdf.text(swedish ? "Rad" : "Position", margin, y);
  pdf.text(swedish ? "Antal" : "Menge", 105, y);
  pdf.text(swedish ? "Pris" : "Preis", 130, y);
  pdf.text("Moms", 155, y);
  pdf.text("Netto", pageWidth - margin, y, { align: "right" });
  y += 3;
  pdf.line(margin, y, pageWidth - margin, y);
  y += 7;

  lines.forEach((line) => {
    ensureSpace(18);
    pdf.setFont("helvetica", line.kind === "Rabatt" ? "italic" : "normal");
    pdf.setFontSize(line.kind === "Rabatt" ? 8 : 9);
    const nameLines = pdf.splitTextToSize(line.name, 84);
    pdf.text(nameLines, margin, y);
    pdf.text(`${line.quantity} ${localizedUnit(line.unit, swedish)}`, 105, y);
    pdf.text(formatMoney(decimalValue(line.unitPrice), line.currency), 130, y);
    pdf.text(`${line.taxRate}%`, 155, y);
    pdf.text(formatMoney(lineNetAmount(line), line.currency), pageWidth - margin, y, { align: "right" });
    y += Math.max(7, nameLines.length * 4.5 + 2);
  });

  y += 4;
  pdf.line(118, y, pageWidth - margin, y);
  y += 7;
  pdf.setFont("helvetica", "normal");
  pdf.text("Netto", 130, y);
  pdf.text(formatMoney(totals.net, totals.currency), pageWidth - margin, y, { align: "right" });
  y += 6;
  Object.entries(totals.taxByRate).forEach(([rate, value]) => {
    pdf.text(`Moms ${rate}%`, 130, y);
    pdf.text(formatMoney(value, totals.currency), pageWidth - margin, y, { align: "right" });
    y += 6;
  });
  pdf.setFont("helvetica", "bold");
  pdf.text("Brutto", 130, y);
  pdf.text(formatMoney(totals.gross, totals.currency), pageWidth - margin, y, { align: "right" });
  y += 12;

  pdf.setFont("helvetica", "normal");
  addWrapped(companySettings.bank ? `${swedish ? "Betalning" : "Zahlung"}: ${companySettings.bank}` : "Bankdaten bitte in den Firmeneinstellungen ergänzen.", margin, pageWidth - margin * 2, 9, 4.5);

  const footerBlocks = companyFooterBlocks(companySettings);
  pdf.setDrawColor(215);
  pdf.line(margin, pageHeight - 30, pageWidth - margin, pageHeight - 30);
  footerBlocks.forEach((block, index) => {
    const blockWidth = (pageWidth - margin * 2) / footerBlocks.length;
    const x = margin + index * blockWidth;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.6);
    pdf.text(block.title, x, pageHeight - 24);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.2);
    block.lines.slice(0, 3).forEach((line, lineIndex) => {
      pdf.text(line, x, pageHeight - 19 + lineIndex * 4.2, { maxWidth: blockWidth - 8 });
    });
  });

  return pdf.output("blob");
}

async function downloadInvoicePdf(item: BillingRecord, object: ObjectRecord, customer: CustomerRecord | undefined, companySettings: CompanySettings) {
  const pdfBlob = await createInvoicePdfBlob(item, object, customer, companySettings);
  const fileName = `${safeFileName(invoiceSubject(item, object, customer))}.pdf`;
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function sendOrderConfirmationMail(job: JobRecord, object: ObjectRecord, customer: CustomerRecord | undefined, services: ServiceItem[], companySettings: CompanySettings, body?: string) {
  const recipientEmail = offerRecipientEmail(object, customer);
  if (!recipientEmail) throw new Error("Keine Empfängeradresse in den Objekt- oder Kundendaten gefunden.");

  const pdfBlob = await createOfferPdfBlob(job, object, customer, services, companySettings, "confirmation");
  const fileName = `${safeFileName(orderConfirmationSendSubject(job, object, customer))}.pdf`;
  const attachmentBase64 = await blobToBase64(pdfBlob);
  const response = await fetch("/api/reports/send", {
    body: JSON.stringify({
      attachmentBase64,
      body: body?.trim() || orderConfirmationSendBody(customer),
      cc: "info@kolaretorp.se",
      filename: fileName,
      subject: orderConfirmationSendSubject(job, object, customer),
      to: recipientEmail,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const payload = await response.json() as { error?: string; sent?: boolean };

  if (!response.ok || !payload.sent) {
    throw new Error(payload.error || "Auftragsbestätigung konnte nicht gesendet werden.");
  }
}

async function notifyPortalActivity(subject: string, body: string, replyTo?: string, to?: string, bcc?: string) {
  const response = await fetch("/api/portal/notify", {
    body: JSON.stringify({ bcc, body, replyTo, subject, to }),
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

function readFileAsDataUrl(file: Blob) {
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl);
  return await response.blob();
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

  try {
    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return dataUrl;
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", quality);
  } catch (error) {
    console.warn("Bildvorschau konnte nicht verkleinert werden.", error);
    return dataUrl;
  }
}

function previewByteSize(previewUrl?: string) {
  if (!previewUrl) return 0;
  const base64 = previewUrl.split(",", 2)[1] ?? previewUrl;
  return Math.round((base64.length * 3) / 4);
}

async function fileToFieldPhotoPreview(file: File) {
  const attempts = [
    { maxSize: 720, quality: 0.54 },
    { maxSize: 560, quality: 0.48 },
    { maxSize: 420, quality: 0.42 },
  ];

  let previewUrl = "";
  for (const attempt of attempts) {
    previewUrl = await fileToImagePreview(file, attempt.maxSize, attempt.quality);
    if (previewByteSize(previewUrl) <= 260_000) {
      return previewUrl;
    }
  }

  return previewUrl;
}

function readAscii(view: DataView, offset: number, length: number) {
  let value = "";
  for (let index = 0; index < length; index += 1) value += String.fromCharCode(view.getUint8(offset + index));
  return value.replace(/\0+$/, "");
}

function readExifValue(view: DataView, tiffOffset: number, valueOffset: number, type: number, count: number, littleEndian: boolean) {
  const byteLength = type === 2 ? count : type === 5 ? count * 8 : count * 2;
  const offset = byteLength <= 4 ? valueOffset : tiffOffset + view.getUint32(valueOffset, littleEndian);

  if (type === 2) return readAscii(view, offset, count);
  if (type === 3) return view.getUint16(offset, littleEndian);
  if (type === 4) return view.getUint32(offset, littleEndian);
  if (type === 5) {
    return Array.from({ length: count }, (_, index) => {
      const numerator = view.getUint32(offset + index * 8, littleEndian);
      const denominator = view.getUint32(offset + index * 8 + 4, littleEndian) || 1;
      return numerator / denominator;
    });
  }
  return undefined;
}

function readExifGpsCoordinates(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;

  let offset = 2;
  while (offset + 4 < view.byteLength) {
    const marker = view.getUint16(offset);
    const length = view.getUint16(offset + 2);
    if (marker === 0xffe1 && readAscii(view, offset + 4, 6) === "Exif") {
      const tiffOffset = offset + 10;
      const littleEndian = readAscii(view, tiffOffset, 2) === "II";
      const firstIfdOffset = tiffOffset + view.getUint32(tiffOffset + 4, littleEndian);
      const entries = view.getUint16(firstIfdOffset, littleEndian);
      let gpsIfdOffset = 0;

      for (let index = 0; index < entries; index += 1) {
        const entryOffset = firstIfdOffset + 2 + index * 12;
        if (view.getUint16(entryOffset, littleEndian) === 0x8825) {
          gpsIfdOffset = tiffOffset + view.getUint32(entryOffset + 8, littleEndian);
          break;
        }
      }
      if (!gpsIfdOffset) return null;

      const gpsEntries = view.getUint16(gpsIfdOffset, littleEndian);
      let latRef = "";
      let lonRef = "";
      let lat: number[] | undefined;
      let lon: number[] | undefined;

      for (let index = 0; index < gpsEntries; index += 1) {
        const entryOffset = gpsIfdOffset + 2 + index * 12;
        const tag = view.getUint16(entryOffset, littleEndian);
        const type = view.getUint16(entryOffset + 2, littleEndian);
        const count = view.getUint32(entryOffset + 4, littleEndian);
        const value = readExifValue(view, tiffOffset, entryOffset + 8, type, count, littleEndian);
        if (tag === 1 && typeof value === "string") latRef = value;
        if (tag === 2 && Array.isArray(value)) lat = value;
        if (tag === 3 && typeof value === "string") lonRef = value;
        if (tag === 4 && Array.isArray(value)) lon = value;
      }

      if (!lat || !lon) return null;
      const latitude = (lat[0] ?? 0) + (lat[1] ?? 0) / 60 + (lat[2] ?? 0) / 3600;
      const longitude = (lon[0] ?? 0) + (lon[1] ?? 0) / 60 + (lon[2] ?? 0) / 3600;
      return {
        latitude: latRef === "S" ? -latitude : latitude,
        longitude: lonRef === "W" ? -longitude : longitude,
      };
    }
    offset += 2 + length;
  }

  return null;
}

async function reverseGeocode(latitude: number, longitude: number) {
  const fallback = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return fallback;
    const result = await response.json() as { display_name?: string };
    return result.display_name || fallback;
  } catch {
    return fallback;
  }
}

function currentDeviceCoordinates() {
  return new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }),
      () => resolve(null),
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 9000 },
    );
  });
}

async function addressFromTripPhoto(file: File) {
  const [previewUrl, buffer] = await Promise.all([
    fileToFieldPhotoPreview(file),
    file.arrayBuffer(),
  ]);
  const photoCoordinates = readExifGpsCoordinates(buffer);
  const coordinates = photoCoordinates ?? await currentDeviceCoordinates();
  const address = coordinates ? await reverseGeocode(coordinates.latitude, coordinates.longitude) : "";

  return {
    address,
    previewUrl,
    source: photoCoordinates ? "Fotodaten" : coordinates ? "Geräteposition" : "manuell",
  };
}

async function odometerFromTripPhoto(file: File) {
  const imageDataUrl = await fileToImagePreview(file, 1100, 0.72);
  return odometerFromImageDataUrl(imageDataUrl);
}

async function odometerFromImageSource(source: string) {
  if (source.startsWith("data:image/")) return odometerFromImageDataUrl(source);
  const response = await fetch(source);
  if (!response.ok) throw new Error("Tachofoto konnte nicht geladen werden.");
  return odometerFromImageDataUrl(await readFileAsDataUrl(await response.blob()));
}

async function odometerFromImageDataUrl(imageDataUrl: string) {
  const response = await fetch("/api/odometer", {
    body: JSON.stringify({ imageDataUrl }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const payload = await response.json() as { error?: string; odometer?: string };
  if (!response.ok) throw new Error(payload.error || "Kilometerstand konnte nicht gelesen werden.");
  return payload.odometer?.trim() || "";
}

function calculatedTripKilometers(startOdometer: string, endOdometer: string) {
  const start = Number(startOdometer);
  const end = Number(endOdometer);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "";
  return String(Math.round(end - start));
}

async function fileToDocumentPreview(file: File) {
  if (file.type.startsWith("image/")) return fileToImagePreview(file, 1100, 0.7);
  const uploaded = await uploadMediaFile(file, "object-documents");
  if (uploaded) return uploaded.url;
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
    ownerEmail: form.ownerEmail.trim(),
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
    personalNumber: "",
    createdAt: "",
    name: "",
    contact: "",
    email: "",
    phone: "",
    phone2: "",
    address: "",
    billingAddress: "",
    billingAddressMode: "Kundenadresse",
    language: "Deutsch",
    portalLoginEmail: "",
    portalPassword: "",
    portalLoginHistory: [],
    balance: "0 SEK",
    portalStatus: "einladen",
    objects: [],
    notes: "",
    reportMailBody: defaultReportMailBody,
    weeklyReportMailBody: defaultWeeklyReportMailBody,
    offerMailBody: defaultOfferMailBody,
    orderConfirmationMailBody: defaultOrderConfirmationMailBody,
    workTimeVisibility: "service",
    billable: true,
  };
}

function customerToForm(customer: CustomerRecord): CustomerFormState {
  return {
    personalNumber: normalizeReadableNumber(customer.personalNumber),
    createdAt: customer.createdAt || "",
    name: customer.name,
    contact: customer.contact,
    email: customer.email,
    phone: customer.phone,
    phone2: customer.phone2 || "",
    address: customer.address,
    billingAddress: customer.billingAddress || customer.address,
    billingAddressMode: customer.billingAddressMode || "Kundenadresse",
    language: customer.language,
    portalLoginEmail: customer.portalLoginEmail || customer.email,
    portalPassword: customer.portalPassword || "",
    portalLoginHistory: customer.portalLoginHistory ?? [],
    balance: customer.balance,
    portalStatus: customer.portalStatus,
    objects: customer.objects,
    notes: customer.notes,
    reportMailBody: customer.reportMailBody || defaultReportMailBody,
    weeklyReportMailBody: customer.weeklyReportMailBody || defaultWeeklyReportMailBody,
    offerMailBody: customer.offerMailBody || defaultOfferMailBody,
    orderConfirmationMailBody: customer.orderConfirmationMailBody || defaultOrderConfirmationMailBody,
    workTimeVisibility: customer.workTimeVisibility ?? "service",
    billable: customer.billable ?? true,
  };
}

function formToCustomer(form: CustomerFormState, id: string, existingCustomer?: CustomerRecord, generatedPersonalNumber?: string): CustomerRecord {
  const email = form.email.trim();
  const portalLoginEmail = form.portalLoginEmail.trim();
  const address = form.address.trim() || "Eigentümeradresse offen";
  const billingAddress = form.billingAddressMode === "Abweichend"
    ? form.billingAddress.trim() || address
    : address;
  const createdAt = existingCustomer?.createdAt || form.createdAt || new Date().toISOString();

  return {
    id,
    personalNumber: normalizeReadableNumber(form.personalNumber) || normalizeReadableNumber(existingCustomer?.personalNumber) || generatedPersonalNumber || "001",
    createdAt,
    name: form.name.trim() || "Neuer Kunde",
    contact: form.contact.trim() || "Kontakt ergänzen",
    email,
    phone: mergeContactValue(form.phone, existingCustomer?.phone, "-"),
    phone2: mergeContactValue(form.phone2, existingCustomer?.phone2),
    address,
    billingAddress,
    billingAddressMode: form.billingAddressMode,
    language: form.language.trim() || "Deutsch",
    portalLoginEmail: portalLoginEmail || email,
    portalPassword: form.portalPassword.trim(),
    portalLoginHistory: form.portalLoginHistory ?? [],
    objects: form.objects,
    balance: form.balance.trim() || "0 SEK",
    portalStatus: form.portalStatus,
    notes: form.notes.trim(),
    reportMailBody: form.reportMailBody.trim() || defaultReportMailBody,
    weeklyReportMailBody: form.weeklyReportMailBody.trim() || defaultWeeklyReportMailBody,
    offerMailBody: form.offerMailBody.trim() || defaultOfferMailBody,
    orderConfirmationMailBody: form.orderConfirmationMailBody.trim() || defaultOrderConfirmationMailBody,
    workTimeVisibility: form.workTimeVisibility,
    billable: form.billable,
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
  { id: "SVC-1", accountingAccount: "3041", name: "Hauskontrolle", category: "Kontrolle", unit: "Besuch", price: "795", currency: "SEK", description: "Sichtprüfung von Haus, Grundstück und Zugang mit Kurzbericht", checklist: [
    { id: "SVC-1-1", title: "Zugang prüfen", note: "Schlüsselsafe, Türen, Fenster und Alarmstatus dokumentieren.", defaultMinutes: 10 },
    { id: "SVC-1-2", title: "Außenrunde durchführen", note: "Fassade, Dach, Terrasse, Zufahrt und sichtbare Schäden prüfen.", defaultMinutes: 20 },
    { id: "SVC-1-3", title: "Innenkontrolle abschließen", note: "Wasser, Heizung, Strom, Gerüche und Auffälligkeiten erfassen.", defaultMinutes: 20 },
  ] },
  { id: "SVC-2", accountingAccount: "3051", name: "Fotobericht", category: "Dokumentation", unit: "Bericht", price: "inklusive", currency: "SEK", description: "Strukturierte Fotos und kurze Zusammenfassung nach dem Einsatz", checklist: [
    { id: "SVC-2-1", title: "Vorher-Fotos erfassen", note: "Relevante Räume und Außenbereiche fotografieren.", defaultMinutes: 10 },
    { id: "SVC-2-2", title: "Nachher-Fotos ergänzen", note: "Erledigte Arbeiten und besondere Feststellungen dokumentieren.", defaultMinutes: 10 },
  ] },
  { id: "SVC-3", accountingAccount: "3051", name: "E-Mail Rückmeldung", category: "Kommunikation", unit: "Nachricht", price: "inklusive", currency: "SEK", description: "Statusmeldung an Eigentümer nach Besuch oder Einsatz", checklist: [
    { id: "SVC-3-1", title: "Kundenzusammenfassung vorbereiten", note: "Nur kundenfreigegebene Hinweise aufnehmen.", defaultMinutes: 8 },
  ] },
  { id: "SVC-4", accountingAccount: "3041", name: "Briefkastenservice", category: "Betreuung", unit: "Besuch", price: "inklusive", currency: "SEK", description: "Briefkasten leeren, relevante Post fotografieren und melden", checklist: [
    { id: "SVC-4-1", title: "Briefkasten leeren", note: "Post sortieren und wichtige Briefe fotografieren.", defaultMinutes: 10 },
  ] },
  { id: "SVC-5", accountingAccount: "3056", name: "Gartenpflege", category: "Außenanlage", unit: "Stunde", price: "595", currency: "SEK", description: "Rasen, Hecken, Saisonpflege und Sichtkontrolle außen", checklist: [
    { id: "SVC-5-1", title: "Rasen und Wege prüfen", note: "Pflegebedarf, Hindernisse und Wetterlage notieren.", defaultMinutes: 15 },
    { id: "SVC-5-2", title: "Gartenarbeit ausführen", note: "Arbeitszeit und besondere Arbeiten sauber erfassen.", defaultMinutes: 60 },
  ] },
  { id: "SVC-6", accountingAccount: "3041", name: "Schlüsselservice", category: "Zugang", unit: "Einsatz", price: "495", currency: "SEK", description: "Schlüsselübergabe, Zugangsdokumentation und Schlüsselverwaltung", checklist: [
    { id: "SVC-6-1", title: "Schlüsselbestand prüfen", note: "Schlüsselnummer, Ablageort und Übergabe dokumentieren.", defaultMinutes: 15 },
  ] },
  { id: "SVC-7", accountingAccount: "3055", name: "Reinigung", category: "Innenbereich", unit: "Stunde", price: "495", currency: "SEK", description: "Innenreinigung und Vorbereitung für Eigentümer oder Gäste", checklist: [
    { id: "SVC-7-1", title: "Räume reinigen", note: "Bad, Küche, Wohnräume und Schlafräume nach Standard prüfen.", defaultMinutes: 90 },
  ] },
  { id: "SVC-8", accountingAccount: "3041", name: "Notdienst", category: "Sonderleistung", unit: "Einsatz", price: "990", currency: "SEK", description: "Priorisierte Hilfe bei akuten Problemen nach Aufwand", checklist: [
    { id: "SVC-8-1", title: "Problem aufnehmen", note: "Ursache, Sofortmaßnahme und Folgeauftrag dokumentieren.", defaultMinutes: 30 },
  ] },
];

const seedMaterials: MaterialItem[] = [
  { id: "MAT-1", accountingAccount: "3058", name: "Müllsäcke", category: "Verbrauchsmaterial", unit: "Rolle", price: "49", currency: "SEK", description: "Standard-Müllsäcke für Reinigung und Garten" },
  { id: "MAT-2", accountingAccount: "3058", name: "Reinigungsmittel", category: "Reinigung", unit: "Stück", price: "79", currency: "SEK", description: "Allgemeines Reinigungsmittel" },
  { id: "MAT-3", accountingAccount: "3058", name: "Rasenmäherbenzin", category: "Garten", unit: "Liter", price: "24", currency: "SEK", description: "Kraftstoff für Gartenarbeiten" },
];

const seedPackages: ServicePackage[] = [
  { id: "PKG-1", name: "Basis", price: "2.990 SEK/Jahr", description: "Grundbetreuung mit 4 Kontrollen pro Jahr", serviceIds: ["SVC-1", "SVC-2", "SVC-3"] },
  { id: "PKG-2", name: "Plus", price: "5.490 SEK/Jahr", description: "Erweiterte Betreuung mit 8 Kontrollen und Briefkastenservice", serviceIds: ["SVC-1", "SVC-2", "SVC-3", "SVC-4"] },
  { id: "PKG-3", name: "Komfort", price: "7.990 SEK/Jahr", description: "Regelmäßige Betreuung mit 12 Kontrollen und kleinen Zusatzdiensten", serviceIds: ["SVC-1", "SVC-2", "SVC-3", "SVC-4", "SVC-5", "SVC-6"] },
  { id: "PKG-4", name: "Premium", price: "9.990 SEK/Jahr", description: "Alles inklusive mit priorisiertem Notfallservice", serviceIds: ["SVC-1", "SVC-2", "SVC-3", "SVC-4", "SVC-5", "SVC-6", "SVC-7", "SVC-8"] },
];

const seedPersonnel: PersonnelRecord[] = [
  {
    id: "PER-1",
    firstName: "Bernd",
    lastName: "Klos",
    role: "Einsatzleitung",
    email: "info@kolaretorp.se",
    phone: "+46 76 101 81 86",
    language: "DE / SV",
    status: "aktiv",
    notes: "Hauptkontakt für Einsatzplanung und Kundenkommunikation.",
  },
  {
    id: "PER-2",
    firstName: "Anna",
    lastName: "Lind",
    role: "Gartenpflege",
    email: "",
    phone: "",
    language: "SV",
    status: "aktiv",
    notes: "Saisonale Außenpflege und Sichtkontrollen.",
  },
];

const seedResources: ResourceRecord[] = [
  {
    id: "RES-1",
    type: "Fahrzeug",
    name: "Servicebil Kolaretorp",
    identifier: "ABC123",
    status: "aktiv",
    responsiblePersonId: "PER-1",
    location: "Kolaretorp 106",
    notes: "Fahrzeugfahrten laufend nach Skatteverket-Empfehlung dokumentieren.",
    media: [],
    logbookYear: "2026",
    odometerYearStart: "12500",
    odometerYearEnd: "",
    logbook: [
      {
        id: "LOG-1",
        date: "2026-08-20",
        driverId: "PER-1",
        tripType: "Dienstfahrt",
        startAddress: "Kolaretorp 106, 382 93 Nybro",
        endAddress: "Långsjövägen 18, 382 92 Orrefors",
        startOdometer: "12610",
        endOdometer: "12648",
        kilometers: "38",
        purpose: "Kundenauftrag Hauskontrolle",
        visited: "Villa Långsjön / Eva Andersson",
        fuelOrCharge: "",
        notes: "Hin- und Rückfahrt als ein Einsatzblock erfasst.",
      },
    ],
  },
  {
    id: "RES-2",
    type: "Maschine",
    name: "Rasenmäher Husqvarna",
    identifier: "HM-01",
    status: "aktiv",
    responsiblePersonId: "PER-2",
    location: "Werkstatt Kolaretorp",
    notes: "Serviceintervall vor Saisonstart prüfen.",
    media: [],
    logbookYear: "2026",
    odometerYearStart: "",
    odometerYearEnd: "",
    logbook: [],
  },
];

const seedDailyMailSettings: DailyMailSettings = {
  birthdaySources: "",
  calendarSources: "",
  reminderSources: "",
};

function normalizeDailyMailSettings(settings?: Partial<DailyMailSettings>): DailyMailSettings {
  return {
    birthdaySources: settings?.birthdaySources ?? "",
    calendarSources: settings?.calendarSources ?? "",
    reminderSources: settings?.reminderSources ?? "",
  };
}

const seedCompanySettings: CompanySettings = {
  address: "Kolaretorp 106, 382 93 Nybro",
  bank: "",
  email: "info@kolaretorp.se",
  fSkattApproved: true,
  name: "Kolaretorp Service AB",
  organizationNumber: "",
  vatNumber: "",
};

function statusTone(status: string) {
  if (["offerte", "in Arbeit", "Entwurf", "abrechenbar", "entwurf", "gebucht", "gesendet"].includes(status)) return "warning";
  if (["erledigt", "abgerechnet", "aktiv", "Gelesen", "bezahlt"].includes(status)) return "good";
  if (["dringend", "gesperrt", "überfällig", "storniert"].includes(status)) return "danger";
  return "neutral";
}

function serviceRate(service: ServiceItem) {
  const price = service.price.trim();
  const hasCurrency = /\b(SEK|EUR|USD|NOK|DKK)\b/i.test(price);
  const amount = price.toLowerCase() === "inklusive" || hasCurrency ? price : `${price} ${service.currency || "SEK"}`;
  const priceIncludesTax = /inkl|moms|vat/i.test(price);
  const taxLabel = priceIncludesTax ? "inkl. Moms" : `zzgl. ${service.taxRate || "25"}% Moms`;
  return `${amount}/${service.unit} ${taxLabel}`;
}

function materialRate(material: Pick<MaterialItem | JobMaterialItem, "currency" | "price" | "taxRate" | "unit">) {
  const price = material.price.trim();
  const hasCurrency = /\b(SEK|EUR|USD|NOK|DKK)\b/i.test(price);
  const amount = price.toLowerCase() === "inklusive" || hasCurrency ? price : `${price} ${material.currency || "SEK"}`;
  const priceIncludesTax = /inkl|moms|vat/i.test(price);
  const taxLabel = priceIncludesTax ? "inkl. Moms" : `zzgl. ${material.taxRate || "25"}% Moms`;
  return `${amount}/${material.unit} ${taxLabel}`;
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
  const reportType = report.id.startsWith("WEEK-") ? "week" : "day";
  return [
    reportType,
    report.jobId,
    normalizeReportDate(report.date),
  ].join("|");
}

function reportCompletenessScore(report: ReportRecord) {
  const checklistResults = report.checklistResults ?? [];
  const photoCount = checklistResults.reduce((sum, item) => sum + (item.photos ?? []).length, 0);
  const noteCount = checklistResults.filter((item) => (item.note ?? "").trim()).length;

  return [
    report.sentAt ? 100 : 0,
    (report.customerComment ?? "").trim() ? 20 : 0,
    checklistResults.length * 4,
    photoCount * 3,
    (report.attachments?.length ?? 0) * 3,
    noteCount * 2,
    (report.summary ?? "").trim() ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);
}

function reportChangedTime(report: ReportRecord) {
  return Date.parse(report.updatedAt ?? report.sentAt ?? "");
}

function chooseReportText(primaryText: string, fallbackText: string, primaryTime: number, fallbackTime: number) {
  const primaryClean = primaryText.trim();
  const fallbackClean = fallbackText.trim();
  if (!primaryClean && fallbackClean) return fallbackText;
  if (primaryClean && !fallbackClean) return primaryText;
  if (primaryClean.length < fallbackClean.length && fallbackClean.includes(primaryClean)) return fallbackText;
  if (fallbackClean.length < primaryClean.length && primaryClean.includes(fallbackClean)) return primaryText;
  if (Number.isFinite(primaryTime) && Number.isFinite(fallbackTime) && primaryTime !== fallbackTime) {
    return primaryTime > fallbackTime ? primaryText : fallbackText;
  }
  if (Number.isFinite(primaryTime) && !Number.isFinite(fallbackTime)) return primaryText || fallbackText;
  if (!Number.isFinite(primaryTime) && Number.isFinite(fallbackTime)) return fallbackText || primaryText;
  return primaryText.length >= fallbackText.length ? primaryText : fallbackText;
}

function chooseReportChecklistItem(existing: FieldTaskResult | undefined, item: FieldTaskResult, reportIsPrimary: boolean) {
  if (!existing) return item;
  const existingTime = Date.parse(existing.updatedAt ?? "");
  const itemTime = Date.parse(item.updatedAt ?? "");
  const newerItem = Number.isFinite(existingTime) || Number.isFinite(itemTime)
    ? !Number.isFinite(existingTime) || (Number.isFinite(itemTime) && itemTime >= existingTime) ? item : existing
    : reportIsPrimary ? item : existing;
  const fallbackItem = newerItem === item ? existing : item;
  const photoKeys = new Set<string>();
  const photos = [...(fallbackItem.photos ?? []), ...(newerItem.photos ?? [])].filter((photo) => {
    const key = photo.id ? `id:${photo.id}` : `${photo.name}|${photo.previewUrl ?? ""}`;
    if (photoKeys.has(key)) return false;
    photoKeys.add(key);
    return true;
  });

  return {
    ...fallbackItem,
    ...newerItem,
    completed: newerItem.completed || fallbackItem.completed,
    minutes: newerItem.minutes || fallbackItem.minutes,
    note: chooseReportText(newerItem.note ?? "", fallbackItem.note ?? "", Date.parse(newerItem.updatedAt ?? ""), Date.parse(fallbackItem.updatedAt ?? "")),
    photos,
  };
}

function mergeReportPair(first: ReportRecord, second: ReportRecord) {
  const primary = reportCompletenessScore(second) >= reportCompletenessScore(first) ? second : first;
  const fallback = primary === first ? second : first;
  const primaryTime = reportChangedTime(primary);
  const fallbackTime = reportChangedTime(fallback);
  const checklistById = new Map<string, FieldTaskResult>();

  (fallback.checklistResults ?? []).forEach((item) => {
    checklistById.set(item.id, item);
  });
  (primary.checklistResults ?? []).forEach((item) => {
    const existing = checklistById.get(item.id);
    checklistById.set(item.id, chooseReportChecklistItem(existing, item, true));
  });
  const attachmentsById = new Map<string, ReportAttachment>();
  [...(fallback.attachments ?? []), ...(primary.attachments ?? [])].forEach((attachment) => {
    attachmentsById.set(attachment.id, { ...attachmentsById.get(attachment.id), ...attachment });
  });

  return {
    ...fallback,
    ...primary,
    checklistResults: Array.from(checklistById.values()),
    customerComment: chooseReportText(primary.customerComment ?? "", fallback.customerComment ?? "", primaryTime, fallbackTime),
    date: normalizeReportDate(primary.date),
    media: Array.from(new Set([...(fallback.media ?? []), ...(primary.media ?? [])])),
    summary: chooseReportText(primary.summary ?? "", fallback.summary ?? "", primaryTime, fallbackTime),
    attachments: Array.from(attachmentsById.values()).sort((firstAttachment, secondAttachment) => (firstAttachment.createdAt ?? "").localeCompare(secondAttachment.createdAt ?? "")),
    sentAt: primary.sentAt ?? fallback.sentAt,
    updatedAt: Number.isFinite(primaryTime) && Number.isFinite(fallbackTime)
      ? (primaryTime >= fallbackTime ? primary.updatedAt ?? primary.sentAt : fallback.updatedAt ?? fallback.sentAt)
      : primary.updatedAt ?? fallback.updatedAt,
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
    startDate: date,
    endDate: date,
    resourceIds: master.resourceIds ?? [],
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
  if (hasReport) {
    const syncedOccurrence = ["erledigt", "abgerechnet", "storniert"].includes(occurrence.status)
      ? occurrence
      : { ...occurrence, status: "erledigt" as const };
    return syncedOccurrence.billable === master.billable
      ? syncedOccurrence
      : { ...syncedOccurrence, billable: master.billable };
  }
  if (["erledigt", "abgerechnet", "storniert"].includes(occurrence.status)) {
    return occurrence.billable === master.billable ? occurrence : { ...occurrence, billable: master.billable };
  }

  return {
    ...occurrence,
    title: master.title,
    objectId: master.objectId,
    customerId: master.customerId,
    type: master.type,
    priority: master.priority,
    assignedTo: isUnassignedJobAssignee(occurrence.assignedTo) ? master.assignedTo : occurrence.assignedTo,
    resourceIds: occurrence.resourceIds?.length ? occurrence.resourceIds : master.resourceIds ?? [],
    description: master.description,
    internalNotes: master.internalNotes,
    checklist: master.checklist,
    serviceIds: master.serviceIds,
    customService: master.customService,
    materialItems: master.materialItems,
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
    if (!isSeriesMaster(job) || job.status === "offerte") return job;
    const openDates = openSeriesDates(job, reports);
    const hasOpenOccurrence = openDates.some((date) => !existingOccurrenceDates.get(job.id)?.has(date));

    if (hasOpenOccurrence) changed = true;
    return job;
  });

  nextJobs
    .filter((job) => isSeriesMaster(job) && job.status !== "offerte")
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

  sortedByExecutionDate(operational)
    .filter((job) => job.seriesMasterId && !["offerte", "erledigt", "abgerechnet", "storniert"].includes(job.status))
    .forEach((job) => {
      if (!job.seriesMasterId || nextBySeries.has(job.seriesMasterId)) return;
      nextBySeries.set(job.seriesMasterId, job);
    });

  return operational.filter((job) => !job.seriesMasterId || nextBySeries.get(job.seriesMasterId)?.id === job.id);
}

function dashboardWorkJobs(jobs: JobRecord[]) {
  const openJobs = jobs.filter((job) => !["offerte", "erledigt", "abgerechnet", "storniert"].includes(job.status));
  const groupedOccurrences = openJobs.reduce<Record<string, JobRecord[]>>((groups, job) => {
    if (!job.seriesMasterId) return groups;
    return {
      ...groups,
      [job.seriesMasterId]: [...(groups[job.seriesMasterId] ?? []), job],
    };
  }, {});
  const standaloneJobs = openJobs.filter((job) => !isSeriesMaster(job) && !job.seriesMasterId);
  const nextSeriesOccurrences = Object.values(groupedOccurrences).flatMap((occurrences) => sortedByExecutionDate(occurrences).slice(0, 5));

  return sortedByExecutionDate([...standaloneJobs, ...nextSeriesOccurrences]);
}

function recurringJobHint(job: JobRecord, allJobs: JobRecord[]) {
  if (!job.seriesMasterId) return "";
  const master = allJobs.find((item) => item.id === job.seriesMasterId);
  return master ? `Serienauftrag · ${master.title} · ${scheduleLabel(master.schedule).replace(/^Serie:\s*/, "")}` : "Serienauftrag";
}

function sortedByDueDate(jobs: JobRecord[]) {
  return [...jobs].sort((first, second) => {
    const firstDate = parseJobDate(first.dueDate)?.getTime() ?? 0;
    const secondDate = parseJobDate(second.dueDate)?.getTime() ?? 0;
    return firstDate - secondDate;
  });
}

function sortedByExecutionDate(jobs: JobRecord[]) {
  return [...jobs].sort((first, second) => {
    const firstDate = parseJobDate(jobExecutionDate(first))?.getTime() ?? 0;
    const secondDate = parseJobDate(jobExecutionDate(second))?.getTime() ?? 0;
    return firstDate - secondDate;
  });
}

function addDaysValue(value: string, days: number) {
  const date = new Date(`${normalizeReportDate(value)}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function startOfIsoWeekValue(value: string) {
  const date = new Date(`${value}T12:00:00`);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function isoWeekNumber(value: string) {
  const date = new Date(`${value}T12:00:00`);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() + 4 - day);
  const yearStart = new Date(`${date.getFullYear()}-01-01T12:00:00`);
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function isoWeekYear(value: string) {
  const date = new Date(`${value}T12:00:00`);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() + 4 - day);
  return date.getFullYear();
}

function splitWorkMinutes(value: string) {
  const total = Math.max(Number(value) || 0, 0);
  return {
    hours: total >= 60 ? String(Math.floor(total / 60)) : "",
    minutes: total % 60 ? String(total % 60) : "",
  };
}

function combineWorkMinutes(hours: string, minutes: string) {
  const safeHours = Math.max(Number(hours) || 0, 0);
  const safeMinutes = Math.max(Number(minutes) || 0, 0);
  return String((safeHours * 60) + Math.min(safeMinutes, 59));
}

function readableJobStatus(status: JobRecord["status"]) {
  if (status === "offerte") return "Offerte";
  if (status === "geplant") return "offen";
  if (status === "in Arbeit") return "in Bearbeitung";
  return status;
}

function isUnassignedJobAssignee(value: string) {
  return ["", "-", "nicht zugewiesen", "nicht zugeordnet"].includes(value.trim().toLowerCase());
}

function jobExecutionDate(job: JobRecord) {
  return normalizeReportDate(job.executionDate || job.startDate || job.dueDate);
}

function jobOriginalStartDate(job: JobRecord) {
  return normalizeReportDate(job.startDate || job.dueDate);
}

function jobOriginalEndDate(job: JobRecord) {
  return normalizeReportDate(job.endDate || job.startDate || job.dueDate);
}

function jobDurationDays(job: JobRecord) {
  const start = parseJobDate(jobOriginalStartDate(job))?.getTime() ?? 0;
  const end = parseJobDate(jobOriginalEndDate(job))?.getTime() ?? start;
  return Math.max(Math.round((end - start) / 86400000), 0);
}

function jobExecutionEndDate(job: JobRecord) {
  return addDaysValue(jobExecutionDate(job), jobDurationDays(job));
}

function jobWorkDates(job: JobRecord) {
  const dates: string[] = [];
  const days = jobDurationDays(job);
  for (let index = 0; index <= days; index += 1) {
    dates.push(addDaysValue(jobExecutionDate(job), index));
  }
  return dates;
}

function defaultFieldWorkDate(job: JobRecord) {
  const today = new Date().toISOString().slice(0, 10);
  return jobCoversExecutionDate(job, today) ? today : jobExecutionDate(job);
}

function fieldProgressKey(job: JobRecord, date: string) {
  return jobWorkDates(job).length > 1 ? `${job.id}::${date}` : job.id;
}

function jobCoversExecutionDate(job: JobRecord, date: string) {
  const value = normalizeReportDate(date);
  return value >= jobExecutionDate(job) && value <= jobExecutionEndDate(job);
}

function jobDateRangeLabel(job: JobRecord) {
  const start = jobExecutionDate(job);
  const end = jobExecutionEndDate(job);
  return start === end ? start : `${start} bis ${end}`;
}

function localizedJobDateRangeLabel(job: JobRecord, swedish: boolean) {
  const start = jobExecutionDate(job);
  const end = jobExecutionEndDate(job);
  return start === end ? start : `${start} ${swedish ? "till" : "bis"} ${end}`;
}

function jobOriginalDateRangeLabel(job: JobRecord) {
  const start = jobOriginalStartDate(job);
  const end = jobOriginalEndDate(job);
  return start === end ? start : `${start} bis ${end}`;
}

const jobGroupPalette = [
  { bg: "rgba(14, 165, 233, 0.12)", color: "#0284c7" },
  { bg: "rgba(34, 197, 94, 0.12)", color: "#16a34a" },
  { bg: "rgba(245, 158, 11, 0.14)", color: "#d97706" },
  { bg: "rgba(239, 68, 68, 0.11)", color: "#dc2626" },
  { bg: "rgba(20, 184, 166, 0.12)", color: "#0d9488" },
  { bg: "rgba(99, 102, 241, 0.12)", color: "#4f46e5" },
  { bg: "rgba(236, 72, 153, 0.11)", color: "#db2777" },
  { bg: "rgba(132, 204, 22, 0.13)", color: "#65a30d" },
];

function jobGroupId(job: JobRecord) {
  return job.seriesMasterId || job.id;
}

function hashString(value: string) {
  return [...value].reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 0);
}

function jobGroupStyle(job: JobRecord): CSSProperties {
  const color = jobGroupPalette[hashString(jobGroupId(job)) % jobGroupPalette.length];
  return {
    "--job-group-bg": color.bg,
    "--job-group-color": color.color,
  } as CSSProperties;
}

function seriesSummary(master: JobRecord, occurrences: JobRecord[], reports: ReportRecord[]) {
  const completedDates = [
    ...occurrences.filter((job) => ["erledigt", "abgerechnet"].includes(job.status)).map((job) => job.dueDate),
    ...reports.filter((report) => report.jobId === master.id || report.jobId.startsWith(`${master.id}-OCC-`)).map((report) => report.date),
    ...(["erledigt", "abgerechnet"].includes(master.status) ? [master.dueDate] : []),
  ]
    .filter(Boolean)
    .sort((first, second) => (parseJobDate(second)?.getTime() ?? 0) - (parseJobDate(first)?.getTime() ?? 0));
  const nextJob = sortedByExecutionDate(occurrences).find((job) => !["offerte", "erledigt", "abgerechnet", "storniert"].includes(job.status));

  return {
    lastDone: completedDates[0] ?? "noch keiner",
    nextDate: nextJob ? jobExecutionDate(nextJob) : "kein offener",
    nextStatus: nextJob ? readableJobStatus(nextJob.status) : "abgeschlossen",
    rhythm: scheduleLabel(master.schedule).replace(/^Serie:\s*/, ""),
  };
}

function seriesWeekReports(occurrences: JobRecord[], reports: ReportRecord[]) {
  const reportsByJobId = new Map(dedupeReports(reports).map((report) => [report.jobId, report]));
  const grouped = new Map<string, SeriesWeekReport>();

  sortedByExecutionDate(occurrences).forEach((occurrence) => {
    const executionDate = jobExecutionDate(occurrence);
    const year = isoWeekYear(executionDate);
    const week = isoWeekNumber(executionDate);
    const key = `${year}-${week}`;
    const report = reportsByJobId.get(occurrence.id);
    const existing = grouped.get(key) ?? {
      completed: 0,
      count: 0,
      endDate: executionDate,
      minutes: 0,
      occurrences: [],
      open: 0,
      reportCount: 0,
      startDate: executionDate,
      week,
      year,
    };
    const done = ["erledigt", "abgerechnet"].includes(occurrence.status);

    grouped.set(key, {
      ...existing,
      completed: existing.completed + Number(done),
      count: existing.count + 1,
      endDate: executionDate > existing.endDate ? executionDate : existing.endDate,
      minutes: existing.minutes + (report?.checklistResults.reduce((sum, item) => sum + (item.minutes || 0), 0) ?? 0),
      occurrences: [...existing.occurrences, occurrence],
      open: existing.open + Number(!done && occurrence.status !== "storniert"),
      reportCount: existing.reportCount + Number(Boolean(report)),
      startDate: executionDate < existing.startDate ? executionDate : existing.startDate,
    });
  });

  return Array.from(grouped.values()).sort((first, second) => (
    first.year - second.year || first.week - second.week
  ));
}

function nextRelevantJobDate(job: JobRecord, occurrences: JobRecord[]) {
  const nextOccurrence = sortedByExecutionDate(occurrences).find((item) => !["offerte", "erledigt", "abgerechnet", "storniert"].includes(item.status));
  return parseJobDate(nextOccurrence ? jobExecutionDate(nextOccurrence) : jobExecutionDate(job))?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

function jobSortGroup(job: JobRecord, occurrences: JobRecord[]) {
  const statuses = occurrences.length > 0 ? occurrences.map((item) => item.status) : [job.status];
  if (statuses.some((status) => status === "in Arbeit")) return 0;
  if (statuses.some((status) => status === "offerte" || status === "geplant" || status === "pausiert")) return 1;
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
  const [appLoadError, setAppLoadError] = useState("");
  const [appUpdatedAt, setAppUpdatedAt] = useState<string | undefined>(undefined);
  const [supabaseSyncDisabled, setSupabaseSyncDisabled] = useState(false);
  const [customers, setCustomers] = useState(seedCustomers);
  const [jobs, setJobs] = useState(seedJobs);
  const [reports, setReports] = useState(seedReports);
  const reportsRef = useRef(seedReports);
  const [billing, setBilling] = useState(seedBilling);
  const [companySettings, setCompanySettings] = useState(seedCompanySettings);
  const [materials, setMaterials] = useState(seedMaterials);
  const [services, setServices] = useState(seedServices);
  const [servicePackages, setServicePackages] = useState(seedPackages);
  const [personnel, setPersonnel] = useState(seedPersonnel);
  const [resources, setResources] = useState(seedResources);
  const [dailyMailSettings, setDailyMailSettings] = useState(seedDailyMailSettings);
  const [portalMessages, setPortalMessages] = useState<PortalMessageRecord[]>([]);
  const [portalCustomerId, setPortalCustomerId] = useState("");
  const [fieldNotes, setFieldNotes] = useState<Record<string, string>>({});
  const [fieldProgress, setFieldProgress] = useState<Record<string, Record<string, FieldTaskProgress>>>({});
  const [fieldWorkDates, setFieldWorkDates] = useState<Record<string, string>>({});
  const [modal, setModal] = useState<Modal>(null);
  const [editingObjectId, setEditingObjectId] = useState<string | null>(null);
  const [objectEditorOpen, setObjectEditorOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editingFieldReportId, setEditingFieldReportId] = useState<string | null>(null);
  const [completedReportPromptId, setCompletedReportPromptId] = useState<string | null>(null);
  const [sendPreviewReportId, setSendPreviewReportId] = useState<string | null>(null);
  const [sendPreviewReportBody, setSendPreviewReportBody] = useState("");
  const [sendPreviewOfferId, setSendPreviewOfferId] = useState<string | null>(null);
  const [sendPreviewOfferBody, setSendPreviewOfferBody] = useState("");
  const [sendPreviewConfirmationId, setSendPreviewConfirmationId] = useState<string | null>(null);
  const [sendPreviewConfirmationBody, setSendPreviewConfirmationBody] = useState("");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [customerMessageTargetId, setCustomerMessageTargetId] = useState<string | null>(null);
  const [customerMessageForm, setCustomerMessageForm] = useState({ message: "", subject: "" });
  const [customerMessageSending, setCustomerMessageSending] = useState(false);
  const [quickTripOpen, setQuickTripOpen] = useState(false);
  const [dailyMailSending, setDailyMailSending] = useState(false);
  const [manualRefreshRunning, setManualRefreshRunning] = useState(false);
  const [quickTripForm, setQuickTripForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    driverId: "",
    endAddress: "",
    endOdometer: "",
    fuelOrCharge: "",
    fuelReceiptPhoto: undefined as VehicleFuelReceiptPhoto | undefined,
    kilometers: "",
    purpose: "",
    resourceId: "",
    startAddress: "",
    startOdometer: "",
    tripType: "Dienstfahrt" as VehicleLogEntry["tripType"],
    visited: "",
    waypoints: [] as VehicleWaypoint[],
    odometerPhotos: [] as VehicleOdometerPhoto[],
  });
  const [quickTripDraftLoaded, setQuickTripDraftLoaded] = useState(false);
  const [recordNotice, setRecordNotice] = useState("");
  const [newObject, setNewObject] = useState<NewObjectFormState>(emptyObjectForm());
  const [newCustomer, setNewCustomer] = useState<CustomerFormState>(emptyCustomerForm());
  const [newJob, setNewJob] = useState<NewJobFormState>(emptyJobForm());
  const skipNextAutoSaveRef = useRef(false);
  const explicitPersistAtRef = useRef(0);
  const lastRemoteSnapshotKeyRef = useRef<string | null>(null);
  const pendingRemoteSnapshotKeyRef = useRef<string | null>(null);
  const remoteSaveTimerRef = useRef<number | null>(null);
  const remoteSyncRunningRef = useRef(false);

  const scheduleRemoteSave = useCallback((snapshot: AppSnapshot, delayMs = 2200) => {
    if (supabaseSyncDisabled) return;
    const snapshotKey = snapshotContentKey(snapshot);
    if (snapshotKey === lastRemoteSnapshotKeyRef.current || snapshotKey === pendingRemoteSnapshotKeyRef.current) return;
    pendingRemoteSnapshotKeyRef.current = snapshotKey;
    if (remoteSaveTimerRef.current) window.clearTimeout(remoteSaveTimerRef.current);

    remoteSaveTimerRef.current = window.setTimeout(() => {
      remoteSaveTimerRef.current = null;
      void saveSupabasePatch(snapshotPatch(snapshot))
        .then((savedAt) => {
          lastRemoteSnapshotKeyRef.current = snapshotKey;
          pendingRemoteSnapshotKeyRef.current = null;
          if (savedAt) setAppUpdatedAt(savedAt);
        })
        .catch((error) => {
          pendingRemoteSnapshotKeyRef.current = null;
          console.warn("App-Daten konnten nicht nach Supabase synchronisiert werden.", error);
          if (!isRetryableSyncError(error)) setSupabaseSyncDisabled(true);
        });
    }, delayMs);
  }, [supabaseSyncDisabled]);

  useEffect(() => () => {
    if (remoteSaveTimerRef.current) window.clearTimeout(remoteSaveTimerRef.current);
  }, []);

  useEffect(() => {
    if (!appStorageReady || quickTripDraftLoaded) return;
    try {
      const savedDraft = window.localStorage.getItem(storageKeys.quickTripDraft);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft) as Partial<typeof quickTripForm>;
        setQuickTripForm((current) => ({
          ...current,
          ...parsed,
          odometerPhotos: parsed.odometerPhotos ?? [],
          waypoints: parsed.waypoints ?? [],
        }));
      }
    } catch (error) {
      console.warn("Fahrten-Entwurf konnte nicht geladen werden.", error);
    } finally {
      setQuickTripDraftLoaded(true);
    }
  }, [appStorageReady, quickTripDraftLoaded, quickTripForm]);

  useEffect(() => {
    if (!appStorageReady || !quickTripDraftLoaded) return;
    try {
      window.localStorage.setItem(storageKeys.quickTripDraft, JSON.stringify(quickTripForm));
    } catch (error) {
      console.warn("Fahrten-Entwurf konnte nicht gespeichert werden.", error);
    }
  }, [appStorageReady, quickTripDraftLoaded, quickTripForm]);

  function applySnapshot(snapshot: AppSnapshot) {
    const normalizedReports = dedupeReports(snapshot.reports);
    const normalizedJobs = ensureSeriesOccurrences(snapshot.jobs, normalizedReports);
    setObjects(snapshot.objects);
    setBilling(snapshot.billing ?? seedBilling);
    setCompanySettings({ ...seedCompanySettings, ...(snapshot.companySettings ?? {}) });
    setCustomers(snapshot.customers);
    setJobs(normalizedJobs);
    setMaterials(snapshot.materials ?? seedMaterials);
    reportsRef.current = normalizedReports;
    setReports(normalizedReports);
    setServices(snapshot.services);
    setServicePackages(snapshot.packages);
    setPersonnel(snapshot.personnel ?? seedPersonnel);
    setResources(snapshot.resources ?? seedResources);
    setDailyMailSettings(normalizeDailyMailSettings(snapshot.dailyMailSettings));
    setPortalMessages(snapshot.portalMessages ?? []);
    setFieldNotes(snapshot.fieldNotes ?? {});
    setFieldProgress(snapshot.fieldProgress);
    setActiveJobId(snapshot.activeJobId && normalizedJobs.some((job) => job.id === snapshot.activeJobId) ? snapshot.activeJobId : null);
    setAppUpdatedAt(snapshot.updatedAt);
  }

  useEffect(() => {
    reportsRef.current = reports;
  }, [reports]);

  useEffect(() => {
    let cancelled = false;

    async function loadSnapshot() {
      setAppLoadError("");
      const hasLocalData = hasSavedLocalSnapshot();
      const localSnapshot = readLocalSnapshot();
      const reportBackups = await loadReportTextBackups();
      const localSnapshotWithBackups = {
        ...localSnapshot,
        reports: applyReportTextBackups(localSnapshot.reports, reportBackups),
      };
      const localSnapshotIsSuspiciouslyEmpty = !hasLocalData
        || isSuspiciouslyEmptyLocalSnapshot(localSnapshotWithBackups)
        || isSeedOnlySnapshot(localSnapshotWithBackups);
      if (!cancelled && !localSnapshotIsSuspiciouslyEmpty) applySnapshot(localSnapshotWithBackups);
      let remoteSnapshotWasApplied = false;

      try {
        const remoteSnapshot = await loadSupabaseSnapshot();
        if (cancelled) return;

        if (remoteSnapshot) {
          lastRemoteSnapshotKeyRef.current = snapshotContentKey(remoteSnapshot);
          skipNextAutoSaveRef.current = true;
          const baseMergedSnapshot = localSnapshotIsSuspiciouslyEmpty
            ? recoverReportsFromFieldProgress(remoteSnapshot)
            : mergeSnapshots(remoteSnapshot, localSnapshotWithBackups);
          const mergedSnapshot = {
            ...baseMergedSnapshot,
            reports: applyReportTextBackups(baseMergedSnapshot.reports, reportBackups),
          };
          applySnapshot(mergedSnapshot);
          remoteSnapshotWasApplied = true;
          persistLocalSnapshot(mergedSnapshot);
          if (!cancelled) setAppStorageReady(true);
          if (JSON.stringify(mergedSnapshot) !== JSON.stringify(remoteSnapshot)) {
            void saveSupabasePatch(snapshotPatch(mergedSnapshot))
              .then((savedAt) => {
                lastRemoteSnapshotKeyRef.current = snapshotContentKey(mergedSnapshot);
                if (!cancelled && savedAt) setAppUpdatedAt(savedAt);
              })
              .catch((error) => {
                console.warn("Zusammengeführter App-Stand konnte nicht sofort online gespeichert werden.", error);
              });
          }
        } else {
          if (localSnapshotIsSuspiciouslyEmpty) {
            console.warn("Leerer lokaler Speicher wurde nicht als Online-Datenbestand gespeichert.");
            return;
          }
          const savedAt = await saveSupabaseSnapshot(localSnapshotWithBackups);
          lastRemoteSnapshotKeyRef.current = snapshotContentKey(localSnapshotWithBackups);
          if (!cancelled) setAppUpdatedAt(savedAt);
        }
      } catch (error) {
        console.warn("Supabase-Synchronisation ist nicht verfügbar. Lokaler Speicher bleibt aktiv.", error);
        if (localSnapshotIsSuspiciouslyEmpty) {
          if (!cancelled) setAppLoadError(error instanceof Error ? error.message : "Online-Daten konnten nicht geladen werden.");
          return;
        }
        if (!cancelled && !isRetryableSyncError(error)) setSupabaseSyncDisabled(true);
      } finally {
        if (!cancelled && (!localSnapshotIsSuspiciouslyEmpty || remoteSnapshotWasApplied)) setAppStorageReady(true);
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
    if (Date.now() - explicitPersistAtRef.current < 1200) return;
    const snapshotUpdatedAt = new Date().toISOString();
    const snapshot: AppSnapshot = {
      activeJobId,
      billing,
      companySettings,
      customers,
      dailyMailSettings,
      fieldNotes,
      fieldProgress,
      jobs,
      materials,
      objects,
      packages: servicePackages,
      personnel,
      portalMessages,
      reports,
      resources,
      services,
      updatedAt: snapshotUpdatedAt,
    };

    try {
      persistLocalSnapshot(snapshot);
    } catch (error) {
      console.warn("App-Daten konnten nicht lokal gespeichert werden.", error);
    }
    setAppUpdatedAt(snapshotUpdatedAt);

    scheduleRemoteSave(snapshot, 2600);
  }, [activeJobId, appStorageReady, billing, companySettings, customers, dailyMailSettings, fieldNotes, fieldProgress, jobs, materials, objects, personnel, portalMessages, reports, resources, scheduleRemoteSave, servicePackages, services]);

  const currentSnapshot = useCallback((overrides: Partial<AppSnapshot> = {}): AppSnapshot => ({
    activeJobId,
    billing,
    companySettings,
    customers,
    dailyMailSettings,
    fieldNotes,
    fieldProgress,
    jobs,
    materials,
    objects,
    packages: servicePackages,
    personnel,
    portalMessages,
    reports,
    resources,
    services,
    updatedAt: appUpdatedAt,
    ...overrides,
  }), [activeJobId, appUpdatedAt, billing, companySettings, customers, dailyMailSettings, fieldNotes, fieldProgress, jobs, materials, objects, personnel, portalMessages, reports, resources, servicePackages, services]);

  const syncRemoteSnapshot = useCallback(async (force = false) => {
    if (!appStorageReady || remoteSyncRunningRef.current) return;
    if (supabaseSyncDisabled && !force) return;
    if (force && remoteSaveTimerRef.current) {
      window.clearTimeout(remoteSaveTimerRef.current);
      remoteSaveTimerRef.current = null;
      pendingRemoteSnapshotKeyRef.current = null;
    }
    remoteSyncRunningRef.current = true;

    try {
      const remoteSnapshot = await loadSupabaseSnapshot();
      if (!remoteSnapshot) return;

      const localSnapshot = currentSnapshot();
      const remoteTime = Date.parse(remoteSnapshot.updatedAt ?? "");
      const localTime = Date.parse(localSnapshot.updatedAt ?? "");
      const remoteHasNewerData = Number.isFinite(remoteTime) && (!Number.isFinite(localTime) || remoteTime > localTime);
      const localHasNewerData = Number.isFinite(localTime) && (!Number.isFinite(remoteTime) || localTime > remoteTime);
      const remoteHasMoreData = snapshotWeight(remoteSnapshot) > snapshotWeight(localSnapshot);
      const reportBackups = await loadReportTextBackups();
      const baseMergedSnapshot = mergeSnapshots(remoteSnapshot, localSnapshot);
      const mergedSnapshot = {
        ...baseMergedSnapshot,
        reports: applyReportTextBackups(baseMergedSnapshot.reports, reportBackups),
      };
      const mergedDiffersFromRemote = JSON.stringify(mergedSnapshot) !== JSON.stringify(remoteSnapshot);
      const mergedDiffersFromLocal = JSON.stringify(mergedSnapshot) !== JSON.stringify(localSnapshot);
      const missingReports = missingLocalReports(remoteSnapshot.reports, localSnapshot.reports);

      if (!force && !remoteHasNewerData && !localHasNewerData && !remoteHasMoreData && !mergedDiffersFromRemote && !mergedDiffersFromLocal) return;

      skipNextAutoSaveRef.current = true;
      applySnapshot(mergedSnapshot);
      persistLocalSnapshot(mergedSnapshot);

      if (mergedDiffersFromRemote) {
        const savedAt = await saveSupabasePatch(snapshotPatch(mergedSnapshot));
        lastRemoteSnapshotKeyRef.current = snapshotContentKey(mergedSnapshot);
        setAppUpdatedAt(savedAt);
        if (force) {
          setRecordNotice(missingReports.length > 0
            ? `${missingReports.length} lokaler Bericht wurde online zusammengeführt.`
            : "Lokale Änderungen wurden online zusammengeführt.");
        }
      } else {
        lastRemoteSnapshotKeyRef.current = snapshotContentKey(remoteSnapshot);
      }
      if (force) setSupabaseSyncDisabled(false);
    } catch (error) {
      console.warn("App-Daten konnten nicht automatisch aktualisiert werden.", error);
      if (!isRetryableSyncError(error)) setSupabaseSyncDisabled(true);
    } finally {
      remoteSyncRunningRef.current = false;
    }
  }, [appStorageReady, currentSnapshot, supabaseSyncDisabled]);

  useEffect(() => {
    if (!appStorageReady) return;
    const fastSyncSections: Section[] = ["dashboard", "field", "jobs", "planning"];
    const intervalMs = fastSyncSections.includes(section) ? 15000 : 60000;

    const intervalId = supabaseSyncDisabled
      ? undefined
      : window.setInterval(() => {
          void syncRemoteSnapshot();
        }, intervalMs);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void syncRemoteSnapshot(true);
      }
    }

    function handleStorageChange(event: StorageEvent) {
      if (Object.values(storageKeys).includes(event.key ?? "")) {
        void syncRemoteSnapshot(true);
      }
    }

    function handleOnline() {
      setSupabaseSyncDisabled(false);
      void syncRemoteSnapshot(true);
    }

    function handleFocus() {
      void syncRemoteSnapshot(true);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("storage", handleStorageChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalId) window.clearInterval(intervalId);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("storage", handleStorageChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [appStorageReady, section, supabaseSyncDisabled, syncRemoteSnapshot]);

  function persistSnapshotNow(overrides: Partial<AppSnapshot> = {}, options: { forceRemote?: boolean } = {}) {
    const snapshotUpdatedAt = new Date().toISOString();
    const snapshot = currentSnapshot({ ...overrides, updatedAt: snapshotUpdatedAt });
    explicitPersistAtRef.current = Date.now();
    try {
      persistLocalSnapshot(snapshot);
    } catch (error) {
      console.warn("App-Daten konnten nicht sofort lokal gespeichert werden.", error);
    }
    setAppUpdatedAt(snapshotUpdatedAt);

    if (options.forceRemote) {
      if (remoteSaveTimerRef.current) {
        window.clearTimeout(remoteSaveTimerRef.current);
        remoteSaveTimerRef.current = null;
      }
      pendingRemoteSnapshotKeyRef.current = null;
      const snapshotKey = snapshotContentKey(snapshot);
      void saveSupabasePatch({ ...overrides, updatedAt: snapshotUpdatedAt })
        .then((savedAt) => {
          lastRemoteSnapshotKeyRef.current = snapshotKey;
          setAppUpdatedAt(savedAt);
          setSupabaseSyncDisabled(false);
          setRecordNotice("Online gespeichert.");
        })
        .catch((error) => {
          console.warn("App-Daten konnten nicht sofort online gespeichert werden.", error);
          setRecordNotice(error instanceof Error ? `Online-Speichern fehlgeschlagen: ${error.message}` : "Online-Speichern fehlgeschlagen.");
        });
      return;
    }

    scheduleRemoteSave(snapshot, 0);
  }

  const t = labels[language];
  const tx = (value: string) => (language === "sv" ? swedishUiText[value] ?? value : value);
  const activeObjects = objects.filter((object) => !object.archived);
  const archivedObjects = objects.filter((object) => object.archived);
  const activeCustomers = customers.filter((customer) => !customer.archived);
  const archivedCustomers = customers.filter((customer) => customer.archived);
  const upcomingOperationalJobs = nextOperationalJobs(jobs);
  const selectedObject = activeObjects.find((object) => object.id === selectedObjectId) ?? activeObjects[0] ?? objects[0];
  const editingObject = objects.find((object) => object.id === editingObjectId);
  const editingCustomer = customers.find((customer) => customer.id === editingCustomerId);
  const isInactiveObject = (object: ObjectRecord) => /inaktiv|pausiert|winterruhe|verkauft|gekündigt|gekuendigt/i.test(object.status);
  const filteredObjects = activeObjects.filter((object) =>
    [object.name, object.owner, object.address, object.region, object.carePackage]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase()),
  ).sort((first, second) => (
    Number(isInactiveObject(first)) - Number(isInactiveObject(second))
    || first.name.localeCompare(second.name, "de")
  ));
  const currentFieldJobId = activeJobId
    ?? upcomingOperationalJobs.find((job) => job.status === "in Arbeit")?.id
    ?? upcomingOperationalJobs.find((job) => !["offerte", "erledigt", "abgerechnet", "storniert"].includes(job.status))?.id
    ?? "";
  const currentFieldJob = currentFieldJobId ? jobs.find((job) => job.id === currentFieldJobId) : undefined;
  const currentFieldWorkDate = currentFieldJob
    ? fieldWorkDates[currentFieldJob.id] ?? defaultFieldWorkDate(currentFieldJob)
    : "";
  const currentFieldProgressKey = currentFieldJob
    ? fieldProgressKey(currentFieldJob, currentFieldWorkDate)
    : currentFieldJobId;
  const dashboardStats: Array<{ label: string; value: number; section: Section }> = [
    { label: tx("aktive Objekte"), value: activeObjects.length, section: "objects" },
    { label: tx("offene Einsätze"), value: upcomingOperationalJobs.filter((job) => !["offerte", "erledigt", "abgerechnet", "storniert"].includes(job.status)).length, section: "planning" },
    { label: tx("Berichte"), value: reports.length, section: "reports" },
    { label: tx("abrechenbar"), value: billing.filter((item) => item.status === "abrechenbar").length, section: "billing" },
  ];
  const customerLanguageOptions = uniqueSortedValues(customers.map((customer) => customer.language), ["Deutsch", "Svenska", "English", "DE", "SV", "EN", "SV / DE", "DE / EN"]);
  const objectStatusOptions = uniqueSortedValues(objects.map((object) => object.status), ["Saison aktiv", "Kontrolle offen", "Winterruhe"]);
  const activeVehicles = resources.filter((resource) => resource.type === "Fahrzeug" && !resource.archived);
  const quickTripAddressOptions = uniqueSortedValues(
    resources.flatMap((resource) => resource.logbook.flatMap((entry) => [
      entry.startAddress,
      entry.endAddress,
      ...(entry.waypoints ?? []).map((waypoint) => waypoint.address),
    ])),
    objects.map((object) => object.address),
  );
  const quickTripPurposeOptions = uniqueSortedValues(
    resources.flatMap((resource) => resource.logbook.map((entry) => entry.purpose)),
    ["Kundenauftrag", "Material holen", "Besichtigung", "Service / Wartung", "Privatfahrt"],
  );

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
    persistSnapshotNow({ customers: nextCustomers, objects: nextObjects }, { forceRemote: true });
    setSelectedObjectId(id);
    setSection("objects");
    setEditingObjectId(null);
    setObjectEditorOpen(false);
  }

  function autosaveObject(form: NewObjectFormState) {
    if (!editingObjectId) return;

    const existingObject = objects.find((object) => object.id === editingObjectId);
    if (!existingObject) return;

    const saved = { ...formToObject(form, editingObjectId), archived: existingObject.archived };
    const nextObjects = objects.map((object) => (object.id === editingObjectId ? saved : object));
    const nextCustomers = customers.map((customer) => {
      const withoutObject = customer.objects.filter((objectId) => objectId !== editingObjectId);
      return customer.id === saved.ownerCustomerId
        ? { ...customer, objects: [...withoutObject, editingObjectId] }
        : { ...customer, objects: withoutObject };
    });

    setObjects(nextObjects);
    setCustomers(nextCustomers);
    persistSnapshotNow({ customers: nextCustomers, objects: nextObjects });
    setSelectedObjectId(editingObjectId);
  }

  function archiveObject(object: ObjectRecord) {
    const openJobs = jobs.filter((job) => job.objectId === object.id && !["offerte", "erledigt", "abgerechnet", "storniert"].includes(job.status));
    if (openJobs.length > 0) {
      setRecordNotice(`Objekt "${object.name}" kann nicht archiviert werden: offene Einsätze ${openJobs.map((job) => job.title).join(", ")}.`);
      return false;
    }

    const nextObjects = objects.map((item) => (item.id === object.id ? { ...item, archived: true } : item));
    const nextCustomers = customers.map((customer) => ({ ...customer, objects: customer.objects.filter((id) => id !== object.id) }));
    setObjects(nextObjects);
    setCustomers(nextCustomers);
    persistSnapshotNow({ customers: nextCustomers, objects: nextObjects }, { forceRemote: true });
    setSelectedObjectId(activeObjects.find((item) => item.id !== object.id)?.id ?? "");
    setRecordNotice(`Objekt "${object.name}" wurde archiviert.`);
    return true;
  }

  function deleteObject(object: ObjectRecord) {
    if (!object.archived) return false;
    const nextObjects = objects.filter((item) => item.id !== object.id);
    const nextCustomers = customers.map((customer) => ({ ...customer, objects: customer.objects.filter((id) => id !== object.id) }));
    setObjects(nextObjects);
    setCustomers(nextCustomers);
    persistSnapshotNow({ customers: nextCustomers, objects: nextObjects }, { forceRemote: true });
    setRecordNotice(`Archiviertes Objekt "${object.name}" wurde endgültig gelöscht.`);
    return true;
  }

  function restoreObject(object: ObjectRecord) {
    const nextObjects = objects.map((item) => (item.id === object.id ? { ...item, archived: false } : item));
    const nextCustomers = customers.map((customer) =>
        customer.id === object.ownerCustomerId && !customer.archived && !customer.objects.includes(object.id)
          ? { ...customer, objects: [...customer.objects, object.id] }
          : customer,
    );
    setObjects(nextObjects);
    setCustomers(nextCustomers);
    persistSnapshotNow({ customers: nextCustomers, objects: nextObjects }, { forceRemote: true });
    setSelectedObjectId(object.id);
    setRecordNotice(`Objekt "${object.name}" wurde wieder aktiviert.`);
    return true;
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

  function openCustomerMessage(customer: CustomerRecord) {
    setCustomerMessageTargetId(customer.id);
    setCustomerMessageForm({
      message: "",
      subject: defaultCustomerMessageSubject(customer),
    });
  }

  async function sendCustomerMessage() {
    const customer = customers.find((item) => item.id === customerMessageTargetId);
    if (!customer) return;

    const to = customer.email.trim();
    const subject = customerMessageForm.subject.trim() || defaultCustomerMessageSubject(customer);
    const message = customerMessageForm.message.trim();
    const objectId = customer.objects[0] ?? "";
    const createdAt = new Date().toISOString();
    const baseMessage: PortalMessageRecord = {
      createdAt,
      customerId: customer.id,
      deliveryStatus: "gespeichert",
      id: `MSG-${Date.now()}`,
      message,
      objectId,
      origin: "office",
      status: "neu",
      subject,
    };

    if (!to || !message) {
      setRecordNotice(!to ? `Bei "${customer.name}" ist keine E-Mail-Adresse hinterlegt.` : "Bitte Nachrichtentext erfassen.");
      return;
    }

    setCustomerMessageSending(true);
    try {
      await notifyPortalActivity(subject, message, "info@kolaretorp.se", to, "info@kolaretorp.se");
      const savedMessage: PortalMessageRecord = {
        ...baseMessage,
        deliveryStatus: "gesendet",
        sentAt: new Date().toISOString(),
      };
      const nextMessages = [savedMessage, ...portalMessages];

      setPortalMessages(nextMessages);
      persistSnapshotNow({ portalMessages: nextMessages }, { forceRemote: true });
      setRecordNotice(`Nachricht an ${customer.name} wurde gesendet und im Kundenportal dokumentiert.`);
      setCustomerMessageTargetId(null);
      setCustomerMessageForm({ message: "", subject: "" });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Nachricht konnte nicht gesendet werden.";
      const failedMessage: PortalMessageRecord = {
        ...baseMessage,
        deliveryError: messageText,
        deliveryStatus: "mail-fehler",
      };
      const nextMessages = [failedMessage, ...portalMessages];

      setPortalMessages(nextMessages);
      persistSnapshotNow({ portalMessages: nextMessages }, { forceRemote: true });
      setRecordNotice(`Nachricht dokumentiert, aber Mailversand fehlgeschlagen: ${messageText}`);
    } finally {
      setCustomerMessageSending(false);
    }
  }

  function saveCustomer() {
    const id = editingCustomerId ?? createEntityId("CUS");
    const existingCustomer = customers.find((customer) => customer.id === editingCustomerId);
    const generatedPersonalNumber = createReadableNumber(customers.filter((customer) => customer !== existingCustomer).map((customer) => customer.personalNumber));
    const saved = { ...formToCustomer(newCustomer, id, existingCustomer, generatedPersonalNumber), archived: existingCustomer?.archived };
    const nextCustomers = editingCustomerId
      ? customers.map((customer) => (customer.id === editingCustomerId ? saved : customer))
      : [saved, ...customers];
    const nextObjects = objects.map((object) => {
      if (saved.objects.includes(object.id)) {
        const customerBillingAddress = saved.billingAddressMode === "Abweichend" ? saved.billingAddress || saved.address : saved.address;
        const billingAddress = object.billingAddressMode === "Eigentümeradresse" ? customerBillingAddress : object.billingAddress;

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
    });

    setCustomers(nextCustomers);
    setObjects(nextObjects);
    persistSnapshotNow({ customers: nextCustomers, objects: nextObjects }, { forceRemote: true });
    setEditingCustomerId(null);
    setSection("customers");
    setModal(null);
  }

  function autosaveCustomer(form: CustomerFormState) {
    if (!editingCustomerId) return;

    const existingCustomer = customers.find((customer) => customer.id === editingCustomerId);
    if (!existingCustomer) return;

    const generatedPersonalNumber = createReadableNumber(customers.filter((customer) => customer !== existingCustomer).map((customer) => customer.personalNumber));
    const saved = { ...formToCustomer(form, editingCustomerId, existingCustomer, generatedPersonalNumber), archived: existingCustomer.archived };
    const nextCustomers = customers.map((customer) => (customer.id === editingCustomerId ? saved : customer));
    const nextObjects = objects.map((object) => {
      if (saved.objects.includes(object.id)) {
        const customerBillingAddress = saved.billingAddressMode === "Abweichend" ? saved.billingAddress || saved.address : saved.address;
        const billingAddress = object.billingAddressMode === "Eigentümeradresse" ? customerBillingAddress : object.billingAddress;

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
    });

    setCustomers(nextCustomers);
    setObjects(nextObjects);
    persistSnapshotNow({ customers: nextCustomers, objects: nextObjects });
  }

  function archiveCustomer(customer: CustomerRecord) {
    const assignedObjects = activeObjects.filter((object) => customer.objects.includes(object.id));
    if (assignedObjects.length > 0) {
      setRecordNotice(`Kunde "${customer.name}" kann nicht archiviert werden: noch zugeordnete Objekte ${assignedObjects.map((object) => object.name).join(", ")}.`);
      return false;
    }

    const nextCustomers = customers.map((item) => (item === customer ? { ...item, archived: true } : item));
    setCustomers(nextCustomers);
    persistSnapshotNow({ customers: nextCustomers }, { forceRemote: true });
    setRecordNotice(`Kunde "${customer.name}" wurde archiviert.`);
    return true;
  }

  function deleteCustomer(customer: CustomerRecord) {
    if (!customer.archived) return false;
    const nextCustomers = customers.filter((item) => item !== customer);
    const nextObjects = objects.map((object) => (object.ownerCustomerId === customer.id ? { ...object, ownerCustomerId: "" } : object));
    setCustomers(nextCustomers);
    setObjects(nextObjects);
    persistSnapshotNow({ customers: nextCustomers, objects: nextObjects }, { forceRemote: true });
    setRecordNotice(`Archivierter Kunde "${customer.name}" wurde endgültig gelöscht.`);
    return true;
  }

  function restoreCustomer(customer: CustomerRecord) {
    const nextCustomers = customers.map((item) => (item === customer ? { ...item, archived: false } : item));
    setCustomers(nextCustomers);
    persistSnapshotNow({ customers: nextCustomers }, { forceRemote: true });
    setRecordNotice(`Kunde "${customer.name}" wurde wieder aktiviert.`);
    return true;
  }

  function openCreateJob() {
    const ownerCustomer = customers.find((customer) => customer.id === selectedObject.ownerCustomerId || customer.name === selectedObject.owner);
    setEditingJobId(null);
    setNewJob({ ...emptyJobForm(), billable: ownerCustomer?.billable ?? true });
    setModal("job");
  }

  function selectJobObject(id: string) {
    setSelectedObjectId(id);
    if (editingJobId) return;
    const object = activeObjects.find((entry) => entry.id === id) ?? objects.find((entry) => entry.id === id);
    const ownerCustomer = customers.find((customer) => customer.id === object?.ownerCustomerId || customer.name === object?.owner);
    setNewJob((current) => ({ ...current, billable: ownerCustomer?.billable ?? true }));
  }

  function openEditJob(job: JobRecord) {
    setEditingJobId(job.id);
    setSelectedObjectId(job.objectId);
    setNewJob(jobToForm(job));
    setModal("job");
  }

  function cancelJob(job: JobRecord) {
    const statusUpdatedAt = new Date().toISOString();
    const nextJobs = jobs.map((item) => (
      item.id === job.id || (isSeriesMaster(job) && item.seriesMasterId === job.id)
        ? { ...item, status: "storniert" as const, statusUpdatedAt }
        : item
    ));
    setJobs(nextJobs);
    persistSnapshotNow({ jobs: nextJobs }, { forceRemote: true });
  }

  function restoreJob(job: JobRecord) {
    const statusUpdatedAt = new Date().toISOString();
    const nextJobs = jobs.map((item) => (
      item.id === job.id ? { ...item, status: "geplant" as const, statusUpdatedAt } : item
    ));
    setJobs(nextJobs);
    persistSnapshotNow({ jobs: nextJobs }, { forceRemote: true });
  }

  function confirmOffer(job: JobRecord) {
    setEditingJobId(job.id);
    setSelectedObjectId(job.objectId);
    setNewJob({ ...jobToForm(job), status: "geplant" });
    setModal("job");
    setRecordNotice(`Bitte Auftrag "${job.title}" prüfen und speichern. Danach kann die Auftragsbestätigung gesendet werden.`);
  }

  function createBillingRecordFromJob(job: JobRecord, sourceReports = reports, invoiceIndex = billing.length + 1): BillingRecord {
    const report = sourceReports.find((item) => item.jobId === job.id);

    return {
      amount: jobBillingAmount(job, services),
      dueDate: addDays(new Date().toISOString().slice(0, 10), 30),
      createdAt: new Date().toISOString(),
      customerId: job.customerId,
      externalExportStatus: "nicht gesendet",
      externalExportSystem: "Spiris / Visma Buchhaltung",
      id: `BIL-${job.id}`,
      invoiceDate: new Date().toISOString().slice(0, 10),
      invoiceNumber: `INV-${new Date().getFullYear()}-${String(invoiceIndex).padStart(4, "0")}`,
      invoiceStatus: "entwurf",
      jobId: job.id,
      label: jobBillingLabel(job, services),
      lines: jobBillingLines(job, services),
      notes: report?.summary || job.description,
      objectId: job.objectId,
      reportId: report?.id,
      serviceDate: jobExecutionDate(job),
      source: report ? `${job.id} · ${report.id}` : job.id,
      status: "abrechenbar",
    };
  }

  function ensureBillingForJobs(sourceJobs: JobRecord[], sourceBilling = billing, sourceReports = reports) {
    const existingJobIds = new Set(sourceBilling.map((item) => item.jobId || item.source));
    const nextItems = billableCompletedJobs(sourceJobs, sourceBilling)
      .filter((job) => !existingJobIds.has(job.id))
      .map((job, index) => createBillingRecordFromJob(job, sourceReports, sourceBilling.length + index + 1));

    return nextItems.length > 0 ? [...nextItems, ...sourceBilling] : sourceBilling;
  }

  function moveJobToBilling(job: JobRecord) {
    const statusUpdatedAt = new Date().toISOString();
    const normalizedJob = job.status === "erledigt" ? job : { ...job, status: "erledigt" as const, statusUpdatedAt };
    if (!jobBillingEnabled(normalizedJob)) {
      setRecordNotice(`Auftrag "${job.title}" ist von der Abrechnung ausgeschlossen.`);
      return;
    }
    const nextJobs = jobs.map((item) => (item.id === job.id ? normalizedJob : item));
    const nextBilling = ensureBillingForJobs(nextJobs, billing, reports);
    setJobs(nextJobs);
    setBilling(nextBilling);
    persistSnapshotNow({ billing: nextBilling, jobs: nextJobs }, { forceRemote: true });
    setRecordNotice(`Auftrag "${job.title}" steht jetzt in der Abrechnung.`);
  }

  function collectBillableJobs() {
    const nextBilling = ensureBillingForJobs(jobs, billing, reports);
    setBilling(nextBilling);
    persistSnapshotNow({ billing: nextBilling }, { forceRemote: true });
    setRecordNotice(nextBilling.length === billing.length ? "Keine neuen erledigten Aufträge für die Abrechnung gefunden." : "Erledigte Aufträge wurden in die Abrechnung übernommen.");
  }

  function markBillingInvoiced(item: BillingRecord) {
    const invoiceDate = item.invoiceDate || new Date().toISOString().slice(0, 10);
    const statusUpdatedAt = new Date().toISOString();
    const nextBilling = billing.map((entry) => (
      entry.id === item.id
        ? {
            ...entry,
            dueDate: entry.dueDate || addDays(invoiceDate, 30),
            invoiceDate,
            invoiceStatus: "gebucht" as const,
            invoicedAt: entry.invoicedAt || new Date().toISOString(),
            outgoingBookNumber: entry.outgoingBookNumber || nextOutgoingBookNumber(billing, invoiceDate),
            status: "abgerechnet" as const,
          }
        : entry
    ));
    const nextJobs = item.jobId
      ? jobs.map((job) => (job.id === item.jobId ? { ...job, status: "abgerechnet" as const, statusUpdatedAt } : job))
      : jobs;
    setBilling(nextBilling);
    setJobs(nextJobs);
    persistSnapshotNow({ billing: nextBilling, jobs: nextJobs }, { forceRemote: true });
    setRecordNotice(`Rechnung "${item.invoiceNumber || item.label}" wurde gebucht und ins Ausgangsbuch übernommen.`);
  }

  function markBillingExported(item: BillingRecord) {
    if (item.externalExportStatus === "gesendet") {
      setRecordNotice(`Rechnung "${item.invoiceNumber || item.label}" wurde bereits an Spiris übergeben. Für eine erneute Übergabe bitte zuerst zurücksetzen.`);
      return;
    }

    const object = objects.find((entry) => entry.id === item.objectId);
    const customer = customers.find((entry) => entry.id === item.customerId || entry.id === object?.ownerCustomerId || entry.name === object?.owner);
    if (!object) {
      setRecordNotice(`Spiris-Datei konnte nicht erstellt werden: Objekt zur Rechnung "${item.invoiceNumber || item.label}" fehlt.`);
      return;
    }

    downloadSpirisSieFile(item, object, customer, companySettings);

    const nextBilling = billing.map((entry) => (
      entry.id === item.id
        ? {
            ...entry,
            externalExportStatus: "gesendet" as const,
            externalExportSystem: entry.externalExportSystem || "Spiris / Visma Buchhaltung",
            externalExportedAt: new Date().toISOString(),
          }
        : entry
    ));
    setBilling(nextBilling);
    persistSnapshotNow({ billing: nextBilling }, { forceRemote: true });
    setRecordNotice(`Spiris-SIE-Datei für Rechnung "${item.invoiceNumber || item.label}" wurde erstellt und die Übergabe markiert.`);
  }

  function resetBillingExport(item: BillingRecord) {
    const nextBilling = billing.map((entry) => (
      entry.id === item.id
        ? {
            ...entry,
            externalExportStatus: "nicht gesendet" as const,
            externalExportedAt: undefined,
          }
        : entry
    ));
    setBilling(nextBilling);
    persistSnapshotNow({ billing: nextBilling }, { forceRemote: true });
    setRecordNotice(`Spiris-Übergabe für Rechnung "${item.invoiceNumber || item.label}" wurde zurückgesetzt.`);
  }

  function markInvoiceSent(item: BillingRecord) {
    const nextBilling = billing.map((entry) => (
      entry.id === item.id
        ? { ...entry, invoiceStatus: "gesendet" as const, sentAt: entry.sentAt || new Date().toISOString() }
        : entry
    ));
    setBilling(nextBilling);
    persistSnapshotNow({ billing: nextBilling }, { forceRemote: true });
    setRecordNotice(`Rechnung "${item.invoiceNumber || item.label}" wurde als versendet markiert.`);
  }

  function markInvoicePaid(item: BillingRecord) {
    const nextBilling = billing.map((entry) => (
      entry.id === item.id
        ? { ...entry, invoiceStatus: "bezahlt" as const, paidAt: entry.paidAt || new Date().toISOString() }
        : entry
    ));
    setBilling(nextBilling);
    persistSnapshotNow({ billing: nextBilling }, { forceRemote: true });
    setRecordNotice(`Zahlung für Rechnung "${item.invoiceNumber || item.label}" wurde erfasst.`);
  }

  function cancelInvoice(item: BillingRecord) {
    const statusUpdatedAt = new Date().toISOString();
    const nextBilling = billing.map((entry) => (
      entry.id === item.id
        ? { ...entry, cancelledAt: entry.cancelledAt || statusUpdatedAt, invoiceStatus: "storniert" as const, status: "intern" as const }
        : entry
    ));
    const nextJobs = item.jobId
      ? jobs.map((job) => (job.id === item.jobId ? { ...job, status: "erledigt" as const, statusUpdatedAt } : job))
      : jobs;
    setBilling(nextBilling);
    setJobs(nextJobs);
    persistSnapshotNow({ billing: nextBilling, jobs: nextJobs }, { forceRemote: true });
    setRecordNotice(`Rechnung "${item.invoiceNumber || item.label}" wurde storniert.`);
  }

  function removeBillingDraft(item: BillingRecord) {
    if (effectiveInvoiceStatus(item) !== "entwurf") {
      setRecordNotice("Nur noch nicht gebuchte Abrechnungseinträge können direkt entfernt werden. Gebuchte Rechnungen bitte stornieren.");
      return;
    }

    const relatedJobId = item.jobId || item.source.split(" · ")[0];
    const nextBilling = billing.filter((entry) => entry.id !== item.id);
    const nextJobs = relatedJobId
      ? jobs.map((job) => (job.id === relatedJobId ? { ...job, billable: false } : job))
      : jobs;
    setBilling(nextBilling);
    setJobs(nextJobs);
    persistSnapshotNow({ billing: nextBilling, jobs: nextJobs }, { forceRemote: true });
    setRecordNotice(`"${item.invoiceNumber || item.label}" wurde aus der Abrechnung entfernt und der Auftrag ist nicht mehr abrechenbar.`);
  }

  function saveJob() {
    const id = editingJobId ?? `JOB-${2410 + jobs.length}`;
    const existingJob = jobs.find((job) => job.id === editingJobId);
    const customServiceName = newJob.customServiceName.trim();
    const customServiceId = existingJob?.customService?.id ?? `JOB-SVC-${id}`;
    const customService: ServiceItem | null = customServiceName
      ? {
          accountingAccount: defaultAccountingAccount("Leistung", customServiceName),
          id: customServiceId,
          name: customServiceName,
          category: newJob.customServiceCategory.trim() || "Sonderleistung",
          unit: newJob.customServiceUnit.trim() || "Einsatz",
          price: newJob.customServicePrice.trim() || "0",
          currency: newJob.customServiceCurrency.trim() || "SEK",
          taxRate: newJob.customServiceTaxRate.trim() || "25",
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
    const startDate = newJob.startDate || newJob.dueDate;
    const endDate = (newJob.endDate || startDate) < startDate ? startDate : (newJob.endDate || startDate);
    const newMasterMaterials: MaterialItem[] = [];
    const materialItems = newJob.materialItems.map((item) => {
      if (!item.saveToMaster || item.materialId) return { ...item, accountingAccount: item.accountingAccount || defaultAccountingAccount("Material", item.name), discount: cleanDiscount(item.discount), saveToMaster: false };

      const materialId = createEntityId("MAT");
      newMasterMaterials.push({
        accountingAccount: item.accountingAccount || defaultAccountingAccount("Material", item.name),
        archived: false,
        category: item.category.trim() || "Material",
        currency: item.currency || "SEK",
        description: `Aus Offerte/Auftrag ${id} übernommen.`,
        id: materialId,
        name: item.name.trim(),
        price: item.price.trim() || "0",
        taxRate: item.taxRate || "25",
        unit: item.unit.trim() || "Stück",
      });

      return { ...item, accountingAccount: item.accountingAccount || defaultAccountingAccount("Material", item.name), discount: cleanDiscount(item.discount), id: item.id || materialId, materialId, saveToMaster: false };
    });
    const serviceDiscounts: Record<string, LineDiscount> = {};
    Object.entries(newJob.serviceDiscounts).forEach(([serviceId, discount]) => {
      const cleaned = cleanDiscount(discount);
      if (cleaned) serviceDiscounts[serviceId] = cleaned;
    });
    const serviceQuantities = {
      ...newJob.serviceQuantities,
      ...(customService ? { [customService.id]: newJob.customServiceQuantity.trim() || "1" } : {}),
    };
    if (customService) {
      const customDiscount = cleanDiscount(newJob.serviceDiscounts.customService ?? newJob.serviceDiscounts[customService.id]);
      if (customDiscount) serviceDiscounts[customService.id] = customDiscount;
      delete serviceDiscounts.customService;
    }
    const hasDiscount = decimalValue(newJob.discountValue) > 0;
    const statusUpdatedAt = !existingJob || existingJob.status !== newJob.status
      ? new Date().toISOString()
      : existingJob.statusUpdatedAt;
    const saved: JobRecord = {
      id,
      seriesMasterId: existingJob?.seriesMasterId,
      seriesOccurrenceDate: existingJob?.seriesOccurrenceDate,
      seriesExcludedDates: existingJob?.seriesExcludedDates,
      title: newJob.title.trim() || "Neuer Auftrag",
      objectId: selectedObject.id,
      customerId: selectedObject.ownerCustomerId || customers.find((customer) => customer.name === selectedObject.owner)?.id || "CUS-1",
      type: newJob.type.trim() || customService?.name || "Hauskontrolle",
      status: newJob.status,
      statusUpdatedAt,
      priority: newJob.priority,
      dueDate: endDate,
      startDate,
      endDate,
      executionDate: existingJob?.executionDate,
      executionLog: existingJob?.executionLog ?? [],
      assignedTo: newJob.assignedTo.trim() || "nicht zugewiesen",
      resourceIds: existingJob?.resourceIds ?? [],
      materialItems,
      discountType: newJob.discountType,
      discountValue: hasDiscount ? newJob.discountValue.trim() : "",
      discountReason: hasDiscount ? newJob.discountReason.trim() : "",
      description: newJob.description.trim() || "Beschreibung ergänzen.",
      internalNotes: newJob.internalNotes.trim() || "Keine internen Notizen.",
      checklist: checklist.length > 0 ? checklist : existingJob?.checklist ?? ["Auftrag dokumentieren"],
      serviceIds: newJob.serviceIds,
      serviceQuantities,
      serviceDiscounts,
      customService,
      offerNumber: existingJob?.offerNumber,
      offerSentAt: existingJob?.offerSentAt,
      orderConfirmationNumber: existingJob?.orderConfirmationNumber,
      orderConfirmationSentAt: existingJob?.orderConfirmationSentAt,
      billable: newJob.billable,
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

    const nextMaterials = newMasterMaterials.length > 0 ? [...newMasterMaterials, ...materials] : materials;
    const reportJobIds = new Set(reports.map((report) => report.jobId));
    const withoutOldOccurrences = editingJobId && isSeriesMaster(saved)
      ? jobs.filter((job) => job.seriesMasterId !== editingJobId || reportJobIds.has(job.id) || job.status !== "geplant")
      : jobs;
    const nextJobs = ensureSeriesOccurrences(
      editingJobId
        ? withoutOldOccurrences.map((job) => (job.id === editingJobId ? saved : job))
        : [saved, ...withoutOldOccurrences],
      reports,
    );
    const nonBillableJobIds = new Set<string>();
    if (!saved.billable) {
      if (isSeriesMaster(saved)) {
        nextJobs
          .filter((job) => job.seriesMasterId === saved.id)
          .forEach((job) => nonBillableJobIds.add(job.id));
      } else {
        nonBillableJobIds.add(saved.id);
      }
    }
    const nextBilling = nonBillableJobIds.size > 0
      ? billing.filter((item) => !removableBillingDraftForJobIds(item, nonBillableJobIds))
      : billing;

    if (newMasterMaterials.length > 0) setMaterials(nextMaterials);
    setJobs(nextJobs);
    if (nextBilling !== billing) setBilling(nextBilling);
    persistSnapshotNow({ billing: nextBilling, jobs: nextJobs, materials: nextMaterials }, { forceRemote: true });
    setEditingJobId(null);
    setSection("jobs");
    setModal(null);
  }

  function startJob(job: JobRecord) {
    const statusUpdatedAt = new Date().toISOString();
    const nextJobs = jobs.map((item) => (item.id === job.id ? { ...item, status: "in Arbeit" as const, statusUpdatedAt } : item));
    setJobs(nextJobs);
    setActiveJobId(job.id);
    setFieldWorkDates((current) => ({ ...current, [job.id]: current[job.id] ?? defaultFieldWorkDate(job) }));
    setEditingFieldReportId(null);
    persistSnapshotNow({ activeJobId: job.id, jobs: nextJobs }, { forceRemote: true });
    setSelectedObjectId(job.objectId);
    setSection("field");
  }

  function assignJobResources(job: JobRecord, resourceIds: string[]) {
    const nextJobs = jobs.map((item) => (item.id === job.id ? { ...item, resourceIds } : item));
    setJobs(nextJobs);
    persistSnapshotNow({ jobs: nextJobs }, { forceRemote: true });
  }

  function assignJobPersonnel(job: JobRecord, assignedTo: string) {
    const nextJobs = jobs.map((item) => (item.id === job.id ? { ...item, assignedTo } : item));
    setJobs(nextJobs);
    persistSnapshotNow({ jobs: nextJobs }, { forceRemote: true });
  }

  function moveJobExecution(job: JobRecord, toDate: string, assignedTo: string) {
    const fromDate = jobExecutionDate(job);
    const toAssignedTo = assignedTo || "nicht zugewiesen";
    if (fromDate === toDate && job.assignedTo === toAssignedTo) return;

    const nextJobs = jobs.map((item) => {
      if (item.id !== job.id) return item;
      return {
        ...item,
        assignedTo: toAssignedTo,
        executionDate: toDate,
        executionLog: [
          ...(item.executionLog ?? []),
          {
            id: `MOVE-${item.id}-${Date.now()}`,
            changedAt: new Date().toISOString(),
            fromAssignedTo: item.assignedTo || "nicht zugewiesen",
            fromDate,
            toAssignedTo,
            toDate,
          },
        ],
      };
    });
    setJobs(nextJobs);
    persistSnapshotNow({ jobs: nextJobs }, { forceRemote: true });
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
          showWorkTimeInReport: item.showWorkTimeInReport ?? true,
          note: item.note,
          photos: item.photos,
          updatedAt: item.updatedAt,
        },
      ]),
    ) as Record<string, FieldTaskProgress>;
    const reportDate = normalizeReportDate(report.date);
    const progressKey = fieldProgressKey(job, reportDate);
    const nextFieldProgress = { ...fieldProgress, [progressKey]: reportProgress };
    const nextFieldNotes = { ...fieldNotes, [progressKey]: reportSummaryNote(report.summary) };

    setFieldProgress(nextFieldProgress);
    setFieldNotes(nextFieldNotes);
    setActiveJobId(job.id);
    setFieldWorkDates((current) => ({ ...current, [job.id]: reportDate }));
    setEditingFieldReportId(report.id);
    persistSnapshotNow({ activeJobId: job.id, fieldNotes: nextFieldNotes, fieldProgress: nextFieldProgress }, { forceRemote: true });
    setSelectedObjectId(job.objectId);
    setSection("field");
  }

  function clearActiveJob(job?: JobRecord, nextStatus: JobRecord["status"] = "geplant", material?: string) {
    const targetJobId = job?.id ?? activeJobId ?? jobs.find((item) => item.status === "in Arbeit")?.id;
    if (!targetJobId) return;
    const savedMaterial = material?.trim() || job?.material?.trim() || "-";
    const nextJobs = jobs.map((item) => (
      item.id === targetJobId
        ? {
            ...item,
            material: savedMaterial,
            status: nextStatus,
            statusUpdatedAt: item.status === nextStatus ? item.statusUpdatedAt : new Date().toISOString(),
          }
        : item
    ));
    setJobs(nextJobs);
    setActiveJobId(null);
    setEditingFieldReportId(null);
    persistSnapshotNow({ activeJobId: null, jobs: nextJobs }, { forceRemote: true });
  }

  function updateJobMaterial(job: JobRecord, material: string) {
    const savedMaterial = material.trim() || "-";
    const nextJobs = jobs.map((item) => (item.id === job.id ? { ...item, material: savedMaterial } : item));
    setJobs(nextJobs);
    persistSnapshotNow({ jobs: nextJobs }, { forceRemote: true });
  }

  function completeJob(job: JobRecord, checklistResults: FieldTaskResult[], fieldNote: string, workDate?: string, reportAttachments: ReportAttachment[] = [], fieldMaterial?: string) {
    const executionDate = normalizeReportDate(workDate || jobExecutionDate(job));
    const savedMaterial = fieldMaterial?.trim() || job.material?.trim() || "-";
    const workDates = jobWorkDates(job);
    const isMultiDayJob = workDates.length > 1;
    const existingReport = editingFieldReportId
      ? reports.find((report) => report.id === editingFieldReportId)
      : reports.find((report) => report.jobId === job.id && report.date === executionDate);
    const isReportEdit = Boolean(editingFieldReportId && existingReport);
    const nextDueDate = isReportEdit || isMultiDayJob ? null : nextSeriesDueDate(job);
    const reportUpdatedAt = new Date().toISOString();
    const normalizedResults = checklistResults.map((item) => ({
      ...item,
      minutes: item.completed ? item.minutes : 0,
      updatedAt: item.updatedAt ?? reportUpdatedAt,
    }));
    const workMinutes = normalizedResults.reduce((sum, item) => sum + item.minutes, 0);
    const visibleMinutes = visibleReportWorkMinutes(normalizedResults);
    const completedCount = normalizedResults.filter((item) => item.completed).length;
    const photoCount = normalizedResults.reduce((sum, item) => sum + item.photos.length, 0);
    const reportId = existingReport?.id ?? (isMultiDayJob ? `REP-${job.id}-${executionDate}` : `REP-${Date.now()}`);
    const summaryPrefix = isMultiDayJob ? `Tagesbericht ${executionDate}: ` : "";
    const summary = `${summaryPrefix}${completedCount} von ${checklistResults.length} Checklistenpunkten ausgeführt.${fieldNote.trim() ? ` ${fieldNote.trim()}` : ""}`;
    const nextSchedule = job.schedule.type === "serie" && nextDueDate && job.schedule.end === "nach"
      ? { ...job.schedule, occurrences: Math.max(job.schedule.occurrences - 1, 0) }
      : job.schedule;
    const coveredReportDates = new Set([
      ...reports.filter((report) => report.id !== reportId && report.jobId === job.id).map((report) => normalizeReportDate(report.date)),
      executionDate,
    ]);
    const allWorkDatesReported = !isMultiDayJob || workDates.every((date) => coveredReportDates.has(date));
    const nextOpenWorkDate = workDates.find((date) => date > executionDate && !coveredReportDates.has(date))
      ?? workDates.find((date) => !coveredReportDates.has(date))
      ?? executionDate;
    const nextJobStatus = isReportEdit
      ? job.status
      : isMultiDayJob && !allWorkDatesReported ? "in Arbeit" as const
        : job.schedule.type === "serie" && nextDueDate ? "geplant" as const : "erledigt" as const;
    const nextJobs = jobs.map((item) => (
      item.id === job.id
        ? {
            ...item,
            dueDate: nextDueDate ?? item.dueDate,
            material: savedMaterial,
            schedule: nextSchedule,
            status: nextJobStatus,
            statusUpdatedAt: isReportEdit || item.status === nextJobStatus ? item.statusUpdatedAt : new Date().toISOString(),
            workMinutes,
          }
        : item
    ));
    const savedReport: ReportRecord = {
      id: reportId,
      jobId: job.id,
      objectId: job.objectId,
      title: job.title,
      date: existingReport?.date ?? executionDate,
      visibleToCustomer: existingReport?.visibleToCustomer ?? true,
      summary: existingReport?.summary ?? summary,
      internalNotes: job.internalNotes,
      media: reportMediaLabels(photoCount, visibleMinutes),
      attachments: existingReport?.attachments ?? reportAttachments,
      checklistResults: normalizedResults,
      customerComment: existingReport?.customerComment ?? "",
      sentAt: existingReport?.sentAt,
      updatedAt: reportUpdatedAt,
    };
    const nextReports = dedupeReports([
      savedReport,
      ...reports.filter((report) => report.id !== reportId && (job.schedule.type === "serie" || isMultiDayJob || report.jobId !== job.id)),
    ]);
    void saveReportTextBackup(savedReport);
    const nextObjects = objects.map((object) => (object.id === job.objectId ? { ...object, lastVisit: executionDate } : object));
    const nextBilling = ensureBillingForJobs(nextJobs, billing, nextReports);
    const nextFieldProgress = { ...fieldProgress };
    const nextFieldNotes = { ...fieldNotes };
    delete nextFieldProgress[fieldProgressKey(job, executionDate)];
    delete nextFieldNotes[fieldProgressKey(job, executionDate)];

    setJobs(nextJobs);
    setBilling(nextBilling);
    reportsRef.current = nextReports;
    setReports(nextReports);
    setObjects(nextObjects);
    setFieldNotes(nextFieldNotes);
    setFieldProgress(nextFieldProgress);
    setActiveJobId(nextJobStatus === "in Arbeit" ? job.id : null);
    if (nextJobStatus === "in Arbeit") {
      setFieldWorkDates((current) => ({ ...current, [job.id]: nextOpenWorkDate }));
    }
    setEditingFieldReportId(null);
    persistSnapshotNow({
      activeJobId: nextJobStatus === "in Arbeit" ? job.id : null,
      billing: nextBilling,
      fieldNotes: nextFieldNotes,
      fieldProgress: nextFieldProgress,
      jobs: nextJobs,
      objects: nextObjects,
      reports: nextReports,
    }, { forceRemote: true });
    setSelectedObjectId(job.objectId);
    if (nextJobStatus === "in Arbeit") {
      setSection("field");
      setRecordNotice(`Tagesbericht ${executionDate} gespeichert.`);
    } else {
      setSection("objects");
      if (!isReportEdit) setCompletedReportPromptId(reportId);
    }
  }

  function updateReportRecord(report: ReportRecord, options: { forceRemote?: boolean } = {}) {
    const stampedReport = { ...report, updatedAt: new Date().toISOString() };
    const baseReports = reportsRef.current.length ? reportsRef.current : reports;
    const replaced = baseReports.some((item) => item.id === stampedReport.id);
    const nextReports = dedupeReports(replaced
      ? baseReports.map((item) => (item.id === stampedReport.id ? stampedReport : item))
      : [stampedReport, ...baseReports]);
    reportsRef.current = nextReports;
    setReports(nextReports);
    void saveReportTextBackup(stampedReport);
    persistSnapshotNow({ reports: nextReports }, { forceRemote: options.forceRemote });
  }

  function sendReportToCustomer(report: ReportRecord) {
    const object = objects.find((item) => item.id === report.objectId);
    const customer = object
      ? customers.find((item) => item.id === object.ownerCustomerId || item.name === object.owner)
      : undefined;
    setSendPreviewReportBody(customerReportSendBody(customer, report));
    setSendPreviewReportId(report.id);
  }

  function sendOfferToCustomer(job: JobRecord) {
    const object = objects.find((item) => item.id === job.objectId);
    const customer = object
      ? customers.find((item) => item.id === job.customerId || item.id === object.ownerCustomerId || item.name === object.owner)
      : customers.find((item) => item.id === job.customerId);
    setSendPreviewOfferBody(offerSendBody(customer));
    setSendPreviewOfferId(job.id);
  }

  function sendOrderConfirmationToCustomer(job: JobRecord) {
    const object = objects.find((item) => item.id === job.objectId);
    const customer = object
      ? customers.find((item) => item.id === job.customerId || item.id === object.ownerCustomerId || item.name === object.owner)
      : customers.find((item) => item.id === job.customerId);
    setSendPreviewConfirmationBody(orderConfirmationSendBody(customer));
    setSendPreviewConfirmationId(job.id);
  }

  async function downloadJobOffer(job: JobRecord) {
    const object = objects.find((item) => item.id === job.objectId);
    const customer = customers.find((item) => item.id === job.customerId || item.id === object?.ownerCustomerId || item.name === object?.owner);
    if (!object) return;
    await downloadOfferPdf(job, object, customer, services, companySettings);
  }

  async function downloadJobOrderConfirmation(job: JobRecord) {
    const object = objects.find((item) => item.id === job.objectId);
    const customer = customers.find((item) => item.id === job.customerId || item.id === object?.ownerCustomerId || item.name === object?.owner);
    if (!object) return;
    await downloadOrderConfirmationPdf(job, object, customer, services, companySettings);
  }

  async function downloadBillingInvoice(item: BillingRecord) {
    const object = objects.find((entry) => entry.id === item.objectId);
    const customer = customers.find((entry) => entry.id === item.customerId || entry.id === object?.ownerCustomerId || entry.name === object?.owner);
    if (!object) return;
    await downloadInvoicePdf(item, object, customer, companySettings);
  }

  async function confirmSendOfferToCustomer(job: JobRecord) {
    const object = objects.find((item) => item.id === job.objectId);
    const customer = customers.find((item) => item.id === job.customerId || item.id === object?.ownerCustomerId || item.name === object?.owner);
    if (!object) return;

    try {
      await sendOfferMail(job, object, customer, services, companySettings, sendPreviewOfferBody);
      const sentAt = new Date().toISOString();
      const nextJobs = jobs.map((item) => (
        item.id === job.id ? { ...item, offerNumber: offerNumber(job), offerSentAt: sentAt } : item
      ));
      setJobs(nextJobs);
      persistSnapshotNow({ jobs: nextJobs }, { forceRemote: true });
      setSendPreviewOfferId(null);
      setRecordNotice(`Offerte "${job.title}" wurde gesendet.`);
    } catch (error) {
      setRecordNotice(error instanceof Error ? `Offerte konnte nicht gesendet werden: ${error.message}` : "Offerte konnte nicht gesendet werden.");
    }
  }

  async function confirmSendOrderConfirmationToCustomer(job: JobRecord) {
    const object = objects.find((item) => item.id === job.objectId);
    const customer = customers.find((item) => item.id === job.customerId || item.id === object?.ownerCustomerId || item.name === object?.owner);
    if (!object) return;

    try {
      await sendOrderConfirmationMail(job, object, customer, services, companySettings, sendPreviewConfirmationBody);
      const sentAt = new Date().toISOString();
      const nextJobs = jobs.map((item) => (
        item.id === job.id ? { ...item, orderConfirmationNumber: orderConfirmationNumber(job), orderConfirmationSentAt: sentAt } : item
      ));
      setJobs(nextJobs);
      persistSnapshotNow({ jobs: nextJobs }, { forceRemote: true });
      setSendPreviewConfirmationId(null);
      setRecordNotice(`Auftragsbestätigung "${job.title}" wurde gesendet.`);
    } catch (error) {
      setRecordNotice(error instanceof Error ? `Auftragsbestätigung konnte nicht gesendet werden: ${error.message}` : "Auftragsbestätigung konnte nicht gesendet werden.");
    }
  }

  function createSeriesWeekReport(master: JobRecord, week: SeriesWeekReport) {
    const object = objects.find((item) => item.id === master.objectId);
    if (!object) {
      setRecordNotice("Wochenbericht konnte nicht erzeugt werden: Objekt fehlt.");
      return;
    }

    const reportsByJobId = new Map(dedupeReports(reports).map((report) => [report.jobId, report]));
    const checklistResults: FieldTaskResult[] = week.occurrences.map((occurrence) => {
      const occurrenceReport = reportsByJobId.get(occurrence.id);
      const occurrenceDate = normalizeReportDate(occurrence.seriesOccurrenceDate || occurrence.dueDate);
      const occurrenceProgress = fieldProgress[fieldProgressKey(occurrence, occurrenceDate)];
      const progressResults = occurrenceProgress && progressHasReportContent(occurrenceProgress)
        ? reportResultsFromProgress(occurrence, services, occurrenceProgress)
        : [];
      const sourceResults = occurrenceReport?.checklistResults.length ? occurrenceReport.checklistResults : progressResults;
      const minutes = sourceResults.length > 0
        ? sourceResults.reduce((sum, item) => sum + (item.minutes || 0), 0)
        : occurrence.workMinutes ?? 0;
      const reportNotes = sourceResults
        .map((item) => item.note.trim())
        .filter(Boolean)
        .join(" · ");
      const progressUpdatedAt = progressResults
        .map((item) => Date.parse(item.updatedAt ?? ""))
        .filter(Number.isFinite)
        .sort((first, second) => second - first)[0];
      const executionLabel = jobDateRangeLabel(occurrence) === jobOriginalDateRangeLabel(occurrence)
        ? jobDateRangeLabel(occurrence)
        : `Einsatz ${jobDateRangeLabel(occurrence)} · Original ${jobOriginalDateRangeLabel(occurrence)}`;

      return {
        completed: ["erledigt", "abgerechnet"].includes(occurrence.status),
        description: occurrence.description || master.description,
        id: `WEEK-${occurrence.id}`,
        meta: `${executionLabel} · ${occurrence.assignedTo || "nicht zugewiesen"} · ${readableJobStatus(occurrence.status)}`,
        minutes,
        showWorkTimeInReport: occurrenceReport
          ? occurrenceReport.checklistResults.some((item) => item.showWorkTimeInReport !== false && item.minutes > 0)
          : true,
        note: reportNotes || occurrenceReport?.summary || "Kein Tagesbericht für diesen Teilauftrag vorhanden.",
        photos: sourceResults.flatMap((item) => item.photos),
        title: occurrence.title,
        updatedAt: occurrenceReport?.updatedAt
          ?? (progressUpdatedAt ? new Date(progressUpdatedAt).toISOString() : new Date().toISOString()),
      };
    });
    const visibleMinutes = visibleReportWorkMinutes(checklistResults);
    const title = `Wochenbericht KW ${week.week} ${week.year} - ${master.title}`;
    const reportId = `WEEK-${master.id}-${week.year}-KW${String(week.week).padStart(2, "0")}`;
    const existingWeekReport = reports.find((report) => report.id === reportId);
    const existingCustomerComment = existingWeekReport && !isGeneratedWeekCustomerComment(existingWeekReport.customerComment)
      ? existingWeekReport.customerComment
      : "";
    const nextReport: ReportRecord = {
      checklistResults,
      customerComment: existingCustomerComment,
      date: week.startDate,
      id: reportId,
      internalNotes: `Automatisch erzeugter Wochenbericht für Serienauftrag ${master.id}. Enthält Teilaufträge: ${week.occurrences.map((item) => item.id).join(", ")}`,
      jobId: master.id,
      media: reportMediaLabels(0, visibleMinutes, [`${week.count} Teilaufträge`, `${week.reportCount} Tagesberichte`]).filter((item) => item !== "0 Fotos"),
      objectId: master.objectId,
      sentAt: existingWeekReport?.sentAt,
      summary: existingWeekReport?.summary ?? `Wochenbericht für ${object.name}: ${week.completed} erledigt, ${week.open} offen, ${week.reportCount} Tagesberichte im Zeitraum ${week.startDate} bis ${week.endDate}.`,
      attachments: existingWeekReport?.attachments ?? [],
      title,
      updatedAt: new Date().toISOString(),
      visibleToCustomer: true,
    };
    const nextReports = dedupeReports([
      nextReport,
      ...reports.filter((report) => report.id !== reportId),
    ]);
    void saveReportTextBackup(nextReport);

    setReports(nextReports);
    persistSnapshotNow({ reports: nextReports });
    setSection("reports");
    setSendPreviewReportBody(customerReportSendBody(customers.find((customer) => customer.id === object.ownerCustomerId || customer.name === object.owner), nextReport));
    setSendPreviewReportId(reportId);
    setRecordNotice(`Wochenbericht KW ${week.week} ${week.year} wurde erzeugt und zum Senden geöffnet.`);
  }

  async function createPortalMessage(customer: CustomerRecord, objectId: string, subject: string, message: string) {
    const object = objects.find((item) => item.id === objectId);
    const createdAt = new Date().toISOString();
    const savedMessage: PortalMessageRecord = {
      id: `MSG-${Date.now()}`,
      customerId: customer.id,
      objectId,
      subject: subject.trim() || "Nachricht aus dem Kundenportal",
      message: message.trim(),
      createdAt,
      deliveryStatus: "gespeichert",
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
      const sentMessage: PortalMessageRecord = {
        ...savedMessage,
        deliveryStatus: "gesendet",
        sentAt: new Date().toISOString(),
      };
      const sentMessages = nextMessages.map((item) => (item.id === sentMessage.id ? sentMessage : item));

      setPortalMessages(sentMessages);
      persistSnapshotNow({ portalMessages: sentMessages }, { forceRemote: true });
      setRecordNotice("Nachricht aus dem Kundenportal wurde gespeichert und per E-Mail gemeldet.");
      return { mailSent: true };
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Benachrichtigung konnte nicht gesendet werden.";
      const failedMessage: PortalMessageRecord = {
        ...savedMessage,
        deliveryError: messageText,
        deliveryStatus: "mail-fehler",
      };
      const failedMessages = nextMessages.map((item) => (item.id === failedMessage.id ? failedMessage : item));

      setPortalMessages(failedMessages);
      persistSnapshotNow({ portalMessages: failedMessages }, { forceRemote: true });
      setRecordNotice(`Nachricht gespeichert, aber Mailversand fehlgeschlagen: ${messageText}`);
      return { error: messageText, mailSent: false };
    }
  }

  async function sendPortalMessageReply(messageId: string, replyBody: string) {
    const message = portalMessages.find((item) => item.id === messageId);
    if (!message) return { error: "Nachricht wurde nicht gefunden.", mailSent: false };

    const customer = customers.find((item) => item.id === message.customerId);
    const object = objects.find((item) => item.id === message.objectId);
    const to = customer?.email.trim() || "";
    if (!to) return { error: "Beim Kunden ist keine E-Mail-Adresse hinterlegt.", mailSent: false };

    const subject = message.subject.toLowerCase().startsWith("re:") ? message.subject : `Re: ${message.subject}`;
    const sentAt = new Date().toISOString();
    const swedish = isSwedishCustomerLanguage(customer?.language);
    const body = [
      replyBody.trim(),
      "",
      "",
      swedish ? "----- Ursprungligt meddelande från kundportalen -----" : "----- Ursprüngliche Anfrage aus dem Kundenportal -----",
      `${swedish ? "Kund" : "Kunde"}: ${customer?.name ?? (swedish ? "Okänd kund" : "Kunde unbekannt")}`,
      `Objekt: ${object?.name ?? "Objekt offen"}`,
      `${swedish ? "Skickat" : "Gesendet"}: ${formatCreatedAt(message.sentAt || message.createdAt)}`,
      "",
      message.message,
    ].join("\n");

    try {
      await notifyPortalActivity(subject, body, "info@kolaretorp.se", to, "info@kolaretorp.se");

      const reply: PortalMessageReplyRecord = {
        body: replyBody.trim(),
        deliveryStatus: "gesendet",
        id: `MSG-REPLY-${Date.now()}`,
        sentAt,
        subject,
        to,
      };
      const nextMessages = portalMessages.map((item) => (
        item.id === messageId
          ? { ...item, replies: [reply, ...(item.replies ?? [])], status: "gelesen" as const }
          : item
      ));

      setPortalMessages(nextMessages);
      persistSnapshotNow({ portalMessages: nextMessages }, { forceRemote: true });
      setRecordNotice(`Antwort an ${customer?.name ?? to} wurde gesendet und dokumentiert.`);
      return { mailSent: true };
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Antwort konnte nicht gesendet werden.";
      const reply: PortalMessageReplyRecord = {
        body: replyBody.trim(),
        deliveryError: messageText,
        deliveryStatus: "mail-fehler",
        id: `MSG-REPLY-${Date.now()}`,
        sentAt,
        subject,
        to,
      };
      const nextMessages = portalMessages.map((item) => (
        item.id === messageId
          ? { ...item, replies: [reply, ...(item.replies ?? [])] }
          : item
      ));

      setPortalMessages(nextMessages);
      persistSnapshotNow({ portalMessages: nextMessages }, { forceRemote: true });
      setRecordNotice(`Antwort wurde dokumentiert, aber Mailversand fehlgeschlagen: ${messageText}`);
      return { error: messageText, mailSent: false };
    }
  }

  function updatePortalCustomer(customerId: string, updates: Pick<CustomerRecord, "email" | "phone" | "phone2">) {
    const nextCustomers = customers.map((customer) => (
      customer.id === customerId
        ? { ...customer, email: updates.email.trim(), phone: updates.phone.trim() || customer.phone, phone2: (updates.phone2 ?? "").trim() }
        : customer
    ));
    setCustomers(nextCustomers);
    persistSnapshotNow({ customers: nextCustomers }, { forceRemote: true });
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

  function latestLogbookEntry(vehicle?: ResourceRecord) {
    return vehicle?.logbook
      .filter((entry) => entry.endOdometer.trim())
      .sort((first, second) => `${second.date}-${second.id}`.localeCompare(`${first.date}-${first.id}`))[0];
  }

  function quickTripDefaultsForVehicle(vehicleId: string) {
    const vehicle = resources.find((resource) => resource.id === vehicleId && resource.type === "Fahrzeug");
    const latestEntry = latestLogbookEntry(vehicle);
    return {
      endAddress: latestEntry?.endAddress ?? "",
      startOdometer: latestEntry?.endOdometer ?? vehicle?.odometerYearStart ?? "",
    };
  }

  function openQuickTrip() {
    setQuickTripForm((current) => ({
      ...current,
      date: current.date || new Date().toISOString().slice(0, 10),
      driverId: current.driverId || personnel.find((person) => !person.archived)?.id || "",
      resourceId: current.resourceId || activeVehicles[0]?.id || "",
      startAddress: current.startAddress || quickTripDefaultsForVehicle(current.resourceId || activeVehicles[0]?.id || "").endAddress,
      startOdometer: current.startOdometer || quickTripDefaultsForVehicle(current.resourceId || activeVehicles[0]?.id || "").startOdometer,
    }));
    setQuickTripOpen(true);
  }

  function reserveOdometerOcrUse() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const current = JSON.parse(window.localStorage.getItem(storageKeys.odometerOcrUsage) || "{}") as { count?: number; date?: string };
      const count = current.date === today ? current.count ?? 0 : 0;
      if (count >= 20) {
        setRecordNotice("Tageslimit für automatische KM-Erkennung erreicht. Bitte KM-Stand manuell eintragen.");
        return false;
      }
      window.localStorage.setItem(storageKeys.odometerOcrUsage, JSON.stringify({ count: count + 1, date: today }));
      return true;
    } catch {
      return true;
    }
  }

  function applyQuickTripOdometer(source: VehicleOdometerPhoto["source"], odometerReading: string) {
    setQuickTripForm((current) => {
      const nextStartOdometer = source === "start" ? odometerReading : current.startOdometer;
      const nextEndOdometer = source === "end" ? odometerReading : current.endOdometer;
      const nextKilometers = calculatedTripKilometers(nextStartOdometer, nextEndOdometer) || current.kilometers;
      return {
        ...current,
        [source === "start" ? "startOdometer" : "endOdometer"]: odometerReading,
        kilometers: nextKilometers,
        odometerPhotos: current.odometerPhotos.map((photo) => (
          photo.source === source ? { ...photo, odometerReading } : photo
        )),
      };
    });
  }

  async function readQuickTripOdometerFromPhoto(source: VehicleOdometerPhoto["source"]) {
    const photo = quickTripForm.odometerPhotos.find((item) => item.source === source);
    if (!photo?.previewUrl) {
      setRecordNotice("Bitte zuerst ein Tachofoto aufnehmen.");
      return;
    }
    if (!reserveOdometerOcrUse()) return;
    setRecordNotice("KM-Stand wird aus Tachofoto gelesen...");
    try {
      const odometerReading = await odometerFromImageSource(photo.previewUrl);
      if (!odometerReading) {
        setRecordNotice("Kein eindeutiger KM-Stand erkannt. Bitte manuell eintragen.");
        return;
      }
      applyQuickTripOdometer(source, odometerReading);
      setRecordNotice(`KM-Stand ${odometerReading} aus Tachofoto übernommen.`);
    } catch (error) {
      console.warn("Kilometerstand konnte nicht gelesen werden.", error);
      setRecordNotice("KM-Stand konnte nicht gelesen werden. Bitte manuell eintragen.");
    }
  }

  async function captureQuickTripPhoto(file: File, source: VehicleOdometerPhoto["source"]) {
    setRecordNotice(source === "start" ? "Startfoto wird verarbeitet..." : "Endfoto wird verarbeitet...");
    try {
      const result = await addressFromTripPhoto(file);
      let odometerReading = "";
      const targetOdometer = source === "start" ? quickTripForm.startOdometer : quickTripForm.endOdometer;
      if (!targetOdometer.trim() && reserveOdometerOcrUse()) {
        try {
          odometerReading = await odometerFromTripPhoto(file);
        } catch (error) {
          console.warn("Kilometerstand konnte nicht automatisch gelesen werden.", error);
        }
      }
      const photo: VehicleOdometerPhoto = {
        address: result.address,
        capturedAt: new Date().toISOString(),
        id: globalThis.crypto?.randomUUID?.() ?? `TRIP-PHOTO-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        odometerReading,
        previewUrl: result.previewUrl,
        source,
      };

      setQuickTripForm((current) => {
        const nextStartOdometer = source === "start" && odometerReading ? odometerReading : current.startOdometer;
        const nextEndOdometer = source === "end" && odometerReading ? odometerReading : current.endOdometer;
        const nextKilometers = calculatedTripKilometers(nextStartOdometer, nextEndOdometer) || current.kilometers;
        return {
          ...current,
          [source === "start" ? "startAddress" : "endAddress"]: result.address || current[source === "start" ? "startAddress" : "endAddress"],
          [source === "start" ? "startOdometer" : "endOdometer"]: odometerReading || current[source === "start" ? "startOdometer" : "endOdometer"],
          kilometers: nextKilometers,
          odometerPhotos: [
            ...current.odometerPhotos.filter((item) => item.source !== source),
            photo,
          ],
        };
      });
      const parts = [
        result.address ? `${source === "start" ? "Startadresse" : "Zieladresse"} aus ${result.source}` : "Foto gespeichert",
        odometerReading ? `KM-Stand ${odometerReading} übernommen` : "KM-Stand bitte prüfen/ergänzen",
      ];
      setRecordNotice(`${parts.join(" · ")}.`);
    } catch (error) {
      console.warn("Tachofoto konnte nicht verarbeitet werden.", error);
      setRecordNotice("Foto konnte nicht verarbeitet werden. Bitte Adresse manuell erfassen.");
    }
  }

  async function captureQuickTripWaypointPhoto(file: File, waypointId: string) {
    setRecordNotice("Zwischenziel-Foto wird verarbeitet...");
    try {
      const result = await addressFromTripPhoto(file);
      const photo: VehicleWaypointPhoto = {
        address: result.address,
        capturedAt: new Date().toISOString(),
        id: globalThis.crypto?.randomUUID?.() ?? `WAY-PHOTO-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        previewUrl: result.previewUrl,
      };
      setQuickTripForm((current) => ({
        ...current,
        waypoints: current.waypoints.map((waypoint) => (
          waypoint.id === waypointId
            ? { ...waypoint, address: result.address || waypoint.address, photo }
            : waypoint
        )),
      }));
      setRecordNotice(result.address ? "Zwischenziel-Adresse aus Foto übernommen." : "Zwischenziel-Foto gespeichert. Adresse bitte manuell ergänzen.");
    } catch (error) {
      console.warn("Zwischenziel-Foto konnte nicht verarbeitet werden.", error);
      setRecordNotice("Zwischenziel-Foto konnte nicht verarbeitet werden. Bitte Adresse manuell erfassen.");
    }
  }

  async function captureQuickTripFuelReceipt(file: File) {
    setRecordNotice("Tank-/Ladebeleg wird gespeichert...");
    try {
      const photo: VehicleFuelReceiptPhoto = {
        capturedAt: new Date().toISOString(),
        id: globalThis.crypto?.randomUUID?.() ?? `FUEL-RECEIPT-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        previewUrl: await fileToImagePreview(file, 1100, 0.7),
      };
      setQuickTripForm((current) => ({ ...current, fuelReceiptPhoto: photo }));
      setRecordNotice("Tank-/Ladebeleg wurde zur Fahrt gespeichert.");
    } catch (error) {
      console.warn("Tank-/Ladebeleg konnte nicht gespeichert werden.", error);
      setRecordNotice("Tank-/Ladebeleg konnte nicht gespeichert werden.");
    }
  }

  function saveQuickTrip() {
    const vehicle = resources.find((resource) => resource.id === quickTripForm.resourceId && resource.type === "Fahrzeug");
    if (!vehicle) {
      setRecordNotice("Bitte zuerst ein Fahrzeug für die Fahrt auswählen.");
      return;
    }

    const kilometers = quickTripForm.kilometers.trim()
      || String(Math.max(0, (Number(quickTripForm.endOdometer) || 0) - (Number(quickTripForm.startOdometer) || 0)) || "");
    const requiredFields = [
      quickTripForm.date,
      quickTripForm.startAddress,
      quickTripForm.endAddress,
      quickTripForm.startOdometer,
      quickTripForm.endOdometer,
      kilometers,
      quickTripForm.purpose,
      quickTripForm.tripType === "Privatfahrt" ? "privat" : quickTripForm.visited,
    ];
    if (requiredFields.some((field) => !field.trim())) {
      setRecordNotice("Für die Quickfahrt bitte Datum, Start/Ziel, Kilometerstände, Kilometer, Zweck und Namen erfassen.");
      return;
    }

    const entry: VehicleLogEntry = {
      date: quickTripForm.date,
      driverId: quickTripForm.driverId,
      endAddress: quickTripForm.endAddress.trim(),
      endOdometer: quickTripForm.endOdometer.trim(),
      fuelOrCharge: quickTripForm.fuelOrCharge.trim(),
      fuelReceiptPhoto: quickTripForm.fuelReceiptPhoto,
      id: `LOG-${vehicle.id}-${quickTripForm.date.replace(/\D/g, "")}-${vehicle.logbook.length + 1}`,
      kilometers,
      notes: "Über Quickbutton erfasst.",
      odometerPhotos: quickTripForm.odometerPhotos,
      purpose: quickTripForm.purpose.trim(),
      startAddress: quickTripForm.startAddress.trim(),
      startOdometer: quickTripForm.startOdometer.trim(),
      tripType: quickTripForm.tripType,
      visited: quickTripForm.tripType === "Privatfahrt" ? "" : quickTripForm.visited.trim(),
      waypoints: quickTripForm.waypoints
        .map((waypoint) => ({ ...waypoint, address: waypoint.address.trim(), note: waypoint.note.trim(), odometer: (waypoint.odometer ?? "").trim() }))
        .filter((waypoint) => waypoint.address || waypoint.photo?.previewUrl),
    };
    const nextResources = resources.map((resource) => (
      resource.id === vehicle.id
        ? { ...resource, logbook: [...resource.logbook, entry].sort((first, second) => first.date.localeCompare(second.date)) }
        : resource
    ));

    setResources(nextResources);
    persistSnapshotNow({ resources: nextResources }, { forceRemote: true });
    setQuickTripOpen(false);
    setRecordNotice(`Fahrt vom ${entry.date} wurde im Fahrtenbuch gespeichert.`);
    setQuickTripForm({
      date: new Date().toISOString().slice(0, 10),
      driverId: quickTripForm.driverId,
      endAddress: "",
      endOdometer: entry.endOdometer,
      fuelOrCharge: "",
      fuelReceiptPhoto: undefined,
      kilometers: "",
      purpose: "",
      resourceId: vehicle.id,
      startAddress: entry.endAddress,
      startOdometer: entry.endOdometer,
      tripType: "Dienstfahrt",
      visited: "",
      waypoints: [],
      odometerPhotos: [],
    });
  }

  async function sendDailyMailNow() {
    setDailyMailSending(true);
    setRecordNotice("");

    try {
      const response = await fetch("/api/cron/daily-jobs", { method: "POST" });
      const payload = await response.json() as { error?: string; openJobCount?: number; sent?: boolean };

      if (!response.ok || !payload.sent) {
        throw new Error(payload.error || "Tagesmail konnte nicht gesendet werden.");
      }

      setRecordNotice(`Tagesmail wurde gesendet (${payload.openJobCount ?? 0} aktive Aufträge).`);
    } catch (error) {
      setRecordNotice(error instanceof Error ? error.message : "Tagesmail konnte nicht gesendet werden.");
    } finally {
      setDailyMailSending(false);
    }
  }

  async function refreshAppDataNow() {
    if (manualRefreshRunning) return;
    setManualRefreshRunning(true);
    setRecordNotice("Daten werden aktualisiert...");

    try {
      setSupabaseSyncDisabled(false);
      const liveVersion = await loadLiveAppVersion();
      if (liveVersion && liveVersion !== appVersion.version) {
        setRecordNotice(`Neue Version ${liveVersion} wird geladen...`);
        window.location.reload();
        return;
      }
      await syncRemoteSnapshot(true);
      setRecordNotice(`Daten aktualisiert: ${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`);
    } catch (error) {
      setRecordNotice(error instanceof Error ? error.message : "Daten konnten nicht aktualisiert werden.");
    } finally {
      setManualRefreshRunning(false);
    }
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
    const nextReport = { ...report, sentAt: report.sentAt ?? timestamp, updatedAt: new Date().toISOString() };

    try {
      await sendCustomerReportMail(nextReport, reportObject, reportJob, reportCustomer, sendPreviewReportBody);
      updateReportRecord(nextReport);
      setSendPreviewReportId(null);
      setSendPreviewReportBody("");
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
  const sendPreviewOffer = sendPreviewOfferId ? jobs.find((job) => job.id === sendPreviewOfferId) : undefined;
  const sendPreviewOfferObject = sendPreviewOffer ? objects.find((object) => object.id === sendPreviewOffer.objectId) : undefined;
  const sendPreviewOfferCustomer = sendPreviewOffer && sendPreviewOfferObject
    ? customers.find((customer) => customer.id === sendPreviewOffer.customerId || customer.id === sendPreviewOfferObject.ownerCustomerId || customer.name === sendPreviewOfferObject.owner)
    : undefined;
  const sendPreviewConfirmation = sendPreviewConfirmationId ? jobs.find((job) => job.id === sendPreviewConfirmationId) : undefined;
  const sendPreviewConfirmationObject = sendPreviewConfirmation ? objects.find((object) => object.id === sendPreviewConfirmation.objectId) : undefined;
  const sendPreviewConfirmationCustomer = sendPreviewConfirmation && sendPreviewConfirmationObject
    ? customers.find((customer) => customer.id === sendPreviewConfirmation.customerId || customer.id === sendPreviewConfirmationObject.ownerCustomerId || customer.name === sendPreviewConfirmationObject.owner)
    : undefined;
  const completedPromptReport = completedReportPromptId ? reports.find((report) => report.id === completedReportPromptId) : undefined;
  const completedPromptObject = completedPromptReport ? objects.find((object) => object.id === completedPromptReport.objectId) : undefined;
  const completedPromptJob = completedPromptReport ? jobs.find((job) => job.id === completedPromptReport.jobId) : undefined;
  const completedPromptCustomer = completedPromptObject
    ? customers.find((customer) => customer.id === completedPromptObject.ownerCustomerId || customer.name === completedPromptObject.owner)
    : undefined;
  const customerMessageTarget = customerMessageTargetId ? customers.find((customer) => customer.id === customerMessageTargetId) : undefined;

  if (portalOnly) {
    const portalLoggedIn = Boolean(portalCustomerId);
    return (
      <main className={`app portal-app ${portalLoggedIn ? "" : "portal-login-app"}`} data-ready="true" data-theme={theme}>
        <section className="workspace portal-workspace">
          <header className="topbar portal-topbar">
            {portalLoggedIn ? (
              <div className="portal-brand-head">
                <Image alt="Kolaretorp Service AB" height={36} priority src={theme === "dark" ? "/brand/kolaretorp-logo-white.png" : "/kolaretorp-logo.png"} width={285} />
              </div>
            ) : <span aria-hidden="true" />}
            <div className="toolbar">
              <button aria-label={theme === "dark" ? t.light : t.dark} className="ghost-button icon-button theme-toggle" data-tooltip={theme === "dark" ? t.light : t.dark} onClick={() => setTheme(theme === "dark" ? "light" : "dark")} type="button">
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
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

  if (!appStorageReady) {
    return (
      <main className="app" data-ready="false" data-theme={theme}>
        <section className="workspace">
          <header className="topbar">
            <div>
              <h1>Homecare</h1>
              <p>Online-Daten werden geladen...</p>
            </div>
            <div className="toolbar">
              <button aria-label={theme === "dark" ? t.light : t.dark} className="ghost-button icon-button theme-toggle" data-tooltip={theme === "dark" ? t.light : t.dark} onClick={() => setTheme(theme === "dark" ? "light" : "dark")} type="button">
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>
          </header>
          <section className="panel">
            <div className="panel-title">
              <div>
                <p>Datenbestand</p>
                <h2>{appLoadError ? "Online-Daten konnten nicht geladen werden" : "Serverdaten werden geladen"}</h2>
                <span>{appLoadError || "Der lokale Startzustand wird nicht angezeigt, damit keine Demo-Daten mit echten Daten verwechselt werden."}</span>
              </div>
            </div>
            {appLoadError && (
              <div className="row-actions">
                <button className="primary-button" onClick={() => window.location.reload()} type="button">
                  <RefreshCw size={16} />
                  Neu laden
                </button>
                <button
                  className="ghost-button"
                  onClick={() => {
                    Object.values(storageKeys).forEach((key) => window.localStorage.removeItem(key));
                    window.location.reload();
                  }}
                  type="button"
                >
                  <Trash2 size={16} />
                  Lokalen Cache leeren
                </button>
              </div>
            )}
          </section>
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
        <nav aria-label={language === "sv" ? "Huvudnavigation" : "Hauptnavigation"}>
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
                {navLabels[language][item.id]}
              </button>
            );
          })}
        </nav>
        <button className="version" onClick={() => setModal("version")} type="button">
          <span>{tx("Aktuelle Version")}</span>
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
            <button className="ghost-button" onClick={openQuickTrip} type="button">
              <CarFront size={16} />
              {tx("Fahrt")}
            </button>
            <button className={`ghost-button refresh-button ${manualRefreshRunning ? "running" : ""}`} disabled={manualRefreshRunning} onClick={() => void refreshAppDataNow()} type="button">
              <RefreshCw size={16} />
              {manualRefreshRunning ? tx("Aktualisiere") : tx("Aktualisieren")}
            </button>
            {formatUpdatedTime(appUpdatedAt) && <p className="toolbar-notice" role="status">Daten aktualisiert: {formatUpdatedTime(appUpdatedAt)}</p>}
            <button aria-label={theme === "dark" ? t.light : t.dark} className="ghost-button icon-button theme-toggle" data-tooltip={theme === "dark" ? t.light : t.dark} onClick={() => setTheme(theme === "dark" ? "light" : "dark")} type="button">
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
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
                objectStatusOptions={objectStatusOptions}
                onArchive={editingObject ? () => {
                  if (archiveObject(editingObject)) closeObjectEditor();
                } : undefined}
                onBack={closeObjectEditor}
                onAutoSave={editingObjectId ? autosaveObject : undefined}
                onDelete={editingObject?.archived ? () => {
                  if (deleteObject(editingObject)) closeObjectEditor();
                } : undefined}
                onRestore={editingObject?.archived ? () => {
                  if (restoreObject(editingObject)) closeObjectEditor();
                } : undefined}
                onSubmit={saveObject}
                onSendReport={sendReportToCustomer}
                onUpdateReport={updateReportRecord}
                packages={servicePackages}
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
                selectedObjectId={selectedObject.id}
                onCreate={openCreateObject}
                onEdit={openEditObject}
                onSelect={(id) => setSelectedObjectId(id)}
              />
            )}
            {section === "customers" && (
              <CustomersView
                archivedCustomers={archivedCustomers}
                customers={activeCustomers}
                objects={activeObjects}
                onCreate={openCreateCustomer}
                onEdit={openEditCustomer}
                onMessage={openCustomerMessage}
              />
            )}
            {section === "jobs" && (
              <JobsView
                jobs={jobs}
                objects={activeObjects}
                onCancel={cancelJob}
                onConfirmOffer={confirmOffer}
                onCreate={openCreateJob}
                onCreateWeekReport={createSeriesWeekReport}
                onDownloadOffer={downloadJobOffer}
                onDownloadOrderConfirmation={downloadJobOrderConfirmation}
                onEdit={openEditJob}
                onMoveToBilling={moveJobToBilling}
                onRestore={restoreJob}
                onSendOrderConfirmation={sendOrderConfirmationToCustomer}
                onSendOffer={sendOfferToCustomer}
                onStart={startJob}
                reports={reports}
              />
            )}
            {section === "planning" && (
              <PlanningView
                allJobs={jobs}
                jobs={jobs}
                objects={activeObjects}
                onAssignPersonnel={assignJobPersonnel}
                onAssignResources={assignJobResources}
                onEdit={openEditJob}
                onMoveJob={moveJobExecution}
                personnel={personnel}
                resources={resources}
              />
            )}
            {section === "reports" && <ReportsView customers={customers} jobs={jobs} objects={objects} onEditInField={editReportInField} onSendReport={sendReportToCustomer} onUpdateReport={updateReportRecord} reports={reports} />}
            {section === "communication" && (
              <CommunicationView
                customers={customers}
                messages={portalMessages}
                objects={objects}
                onSendReply={sendPortalMessageReply}
              />
            )}
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
                customers={customers}
                objects={activeObjects}
                packages={servicePackages}
                services={services}
                reports={reports}
                selectedWorkDate={currentFieldWorkDate}
                fieldNote={currentFieldProgressKey ? fieldNotes[currentFieldProgressKey] ?? "" : ""}
                progress={currentFieldProgressKey ? fieldProgress[currentFieldProgressKey] ?? {} : {}}
                editingReportId={editingFieldReportId}
                onSelectJob={startJob}
                onSelectReport={editReportInField}
                onSendReport={sendReportToCustomer}
                onUpdateJobMaterial={updateJobMaterial}
                onUpdateReport={updateReportRecord}
                onClearActiveJob={clearActiveJob}
                onSelectWorkDate={(jobId, date) => setFieldWorkDates((current) => ({ ...current, [jobId]: date }))}
                onProgressChange={(jobId, progress) => setFieldProgress((current) => {
                  const nextProgress = { ...current, [jobId]: progress };
                  persistSnapshotNow({ fieldProgress: nextProgress }, { forceRemote: true });
                  return nextProgress;
                })}
                onFieldNoteChange={(jobId, note) => setFieldNotes((current) => {
                  const nextNotes = { ...current, [jobId]: note };
                  persistSnapshotNow({ fieldNotes: nextNotes }, { forceRemote: true });
                  return nextNotes;
                })}
                onComplete={completeJob}
              />
            )}
            {section === "billing" && (
              <BillingView
                billing={billing}
                customers={customers}
                jobs={jobs}
                objects={activeObjects}
                onCollectBillable={collectBillableJobs}
                onDownloadInvoice={downloadBillingInvoice}
                onCancelInvoice={cancelInvoice}
                onMarkExported={markBillingExported}
                onMarkInvoiced={markBillingInvoiced}
                onMarkPaid={markInvoicePaid}
                onMarkSent={markInvoiceSent}
                onRemoveBillingDraft={removeBillingDraft}
                onResetExport={resetBillingExport}
                reports={reports}
                services={services}
              />
            )}
            {section === "masterData" && (
              <MasterDataView
                companySettings={companySettings}
                customers={activeCustomers}
                dailyMailSettings={dailyMailSettings}
                objects={activeObjects}
                onSendDailyMail={sendDailyMailNow}
                materials={materials}
                packages={servicePackages}
                personnel={personnel}
                resources={resources}
                services={services}
                dailyMailSending={dailyMailSending}
                translate={tx}
                setCompanySettings={setCompanySettings}
                setMaterials={setMaterials}
                setPackages={setServicePackages}
                setPersonnel={setPersonnel}
                onPersistResources={(nextResources) => persistSnapshotNow({ resources: nextResources }, { forceRemote: true })}
                setResources={setResources}
                setServices={setServices}
                setDailyMailSettings={setDailyMailSettings}
              />
            )}
          </div>
        </section>
      </section>

      {quickTripOpen && (
        <div className="modal-backdrop">
          <section className="modal quick-trip-modal" role="dialog" aria-modal="true" aria-labelledby="quick-trip-title">
            <header>
              <div>
                <p>Fahrtenbuch</p>
                <h2 id="quick-trip-title">Fahrt erfassen</h2>
              </div>
              <button aria-label="Fahrt erfassen schließen" onClick={() => setQuickTripOpen(false)} type="button">
                <X size={18} />
              </button>
            </header>
            <div className="form-grid compact-form">
              <label><span>Fahrzeug</span>
                <select value={quickTripForm.resourceId} onChange={(event) => {
                  const defaults = quickTripDefaultsForVehicle(event.target.value);
                  setQuickTripForm({
                    ...quickTripForm,
                    resourceId: event.target.value,
                    startAddress: defaults.endAddress,
                    startOdometer: defaults.startOdometer,
                  });
                }}>
                  <option value="">Fahrzeug auswählen</option>
                  {activeVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name} · {vehicle.identifier}</option>)}
                </select>
              </label>
              <label><span>Datum</span><input type="date" value={quickTripForm.date} onChange={(event) => setQuickTripForm({ ...quickTripForm, date: event.target.value })} /></label>
              <label><span>Fahrer</span>
                <select value={quickTripForm.driverId} onChange={(event) => setQuickTripForm({ ...quickTripForm, driverId: event.target.value })}>
                  <option value="">Nicht zugeordnet</option>
                  {personnel.filter((person) => !person.archived).map((person) => <option key={person.id} value={person.id}>{person.firstName} {person.lastName}</option>)}
                </select>
              </label>
              <label><span>Art</span>
                <select value={quickTripForm.tripType} onChange={(event) => setQuickTripForm({ ...quickTripForm, tripType: event.target.value as VehicleLogEntry["tripType"] })}>
                  <option>Dienstfahrt</option>
                  <option>Privatfahrt</option>
                </select>
              </label>
              <label><span>Start-Km</span><input inputMode="numeric" value={quickTripForm.startOdometer} onChange={(event) => setQuickTripForm({ ...quickTripForm, startOdometer: event.target.value })} /></label>
              <label><span>End-Km</span><input inputMode="numeric" value={quickTripForm.endOdometer} onChange={(event) => setQuickTripForm({ ...quickTripForm, endOdometer: event.target.value })} /></label>
              <label><span>Kilometer</span><input inputMode="numeric" placeholder="wird aus Km-Ständen berechnet" value={quickTripForm.kilometers} onChange={(event) => setQuickTripForm({ ...quickTripForm, kilometers: event.target.value })} /></label>
              <div className="wide trip-photo-grid">
                {(["start", "end"] as const).map((source) => {
                  const photo = quickTripForm.odometerPhotos.find((item) => item.source === source);
                  return (
                    <div className="trip-photo-capture" key={source}>
                      <span>{source === "start" ? "Startfoto Tacho" : "Endfoto Tacho"}</span>
                      <strong>{photo ? photo.name : source === "start" ? "Beim Losfahren aufnehmen" : "Beim Abstellen aufnehmen"}</strong>
                      {photo?.previewUrl ? <img alt={`${source === "start" ? "Start" : "Ende"} Tachofoto`} src={photo.previewUrl} /> : <Camera size={18} />}
                      {photo?.odometerReading && <small>KM-Stand: {photo.odometerReading}</small>}
                      {photo?.address && <small>{photo.address}</small>}
                      <div className="trip-photo-actions">
                        <label className="ghost-button">
                          <Camera size={15} />
                          Foto wählen
                          <input
                            accept="image/*"
                            aria-label={source === "start" ? "Startfoto Tacho aufnehmen" : "Endfoto Tacho aufnehmen"}
                            capture="environment"
                            type="file"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) void captureQuickTripPhoto(file, source);
                              event.currentTarget.value = "";
                            }}
                          />
                        </label>
                        {photo?.previewUrl && (
                          <button className="ghost-button" type="button" onClick={() => void readQuickTripOdometerFromPhoto(source)}>
                            <ScanLine size={15} />
                            KM lesen
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <label><span>Zweck / Ärende</span><input list="quick-trip-purpose-options" value={quickTripForm.purpose} onChange={(event) => setQuickTripForm({ ...quickTripForm, purpose: event.target.value })} /></label>
              <datalist id="quick-trip-purpose-options">
                {quickTripPurposeOptions.map((purpose) => <option key={purpose} value={purpose} />)}
              </datalist>
              <label className="wide"><span>Startadresse</span><input list="quick-trip-address-options" value={quickTripForm.startAddress} onChange={(event) => setQuickTripForm({ ...quickTripForm, startAddress: event.target.value })} /></label>
              <label className="wide"><span>Zieladresse</span><input list="quick-trip-address-options" value={quickTripForm.endAddress} onChange={(event) => setQuickTripForm({ ...quickTripForm, endAddress: event.target.value })} /></label>
              <datalist id="quick-trip-address-options">
                {quickTripAddressOptions.map((address) => <option key={address} value={address} />)}
              </datalist>
              <div className="wide waypoint-editor">
                <div className="waypoint-editor-head">
                  <span>Zwischenziele</span>
                  <button
                    className="ghost-button"
                    onClick={() => setQuickTripForm({
                      ...quickTripForm,
                      waypoints: [
                        ...quickTripForm.waypoints,
                        { address: "", id: globalThis.crypto?.randomUUID?.() ?? `WAY-${Date.now()}`, note: "", odometer: "" },
                      ],
                    })}
                    type="button"
                  >
                    <Plus size={14} />
                    Ziel
                  </button>
                </div>
                {quickTripForm.waypoints.map((waypoint, waypointIndex) => (
                  <div className="waypoint-row-wrap" key={waypoint.id}>
                    <div className="waypoint-row waypoint-row-with-photo">
                      <input
                        aria-label={`Zwischenziel ${waypointIndex + 1}`}
                        list="quick-trip-address-options"
                        placeholder={`Zwischenziel ${waypointIndex + 1}`}
                        value={waypoint.address}
                        onChange={(event) => setQuickTripForm({
                          ...quickTripForm,
                          waypoints: quickTripForm.waypoints.map((item) => (
                            item.id === waypoint.id ? { ...item, address: event.target.value } : item
                          )),
                        })}
                      />
                      <input
                        aria-label={`Notiz zu Zwischenziel ${waypointIndex + 1}`}
                        placeholder="Notiz"
                        value={waypoint.note}
                        onChange={(event) => setQuickTripForm({
                          ...quickTripForm,
                          waypoints: quickTripForm.waypoints.map((item) => (
                            item.id === waypoint.id ? { ...item, note: event.target.value } : item
                          )),
                        })}
                      />
                      <input
                        aria-label={`KM-Stand zu Zwischenziel ${waypointIndex + 1}`}
                        inputMode="numeric"
                        placeholder="KM"
                        value={waypoint.odometer ?? ""}
                        onChange={(event) => setQuickTripForm({
                          ...quickTripForm,
                          waypoints: quickTripForm.waypoints.map((item) => (
                            item.id === waypoint.id ? { ...item, odometer: event.target.value } : item
                          )),
                        })}
                      />
                      <label className="icon-button waypoint-photo-button" data-tooltip={`Foto zu Zwischenziel ${waypointIndex + 1}`}>
                        <Camera size={14} />
                        <input
                          accept="image/*"
                          aria-label={`Foto zu Zwischenziel ${waypointIndex + 1} aufnehmen`}
                          capture="environment"
                          type="file"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) void captureQuickTripWaypointPhoto(file, waypoint.id);
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>
                      <button
                        aria-label={`Zwischenziel ${waypointIndex + 1} löschen`}
                        className="icon-button"
                        onClick={() => setQuickTripForm({ ...quickTripForm, waypoints: quickTripForm.waypoints.filter((item) => item.id !== waypoint.id) })}
                        type="button"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {waypoint.photo && (
                      <div className="waypoint-photo-preview">
                        {waypoint.photo.previewUrl && <img alt={`Foto zu Zwischenziel ${waypointIndex + 1}`} src={waypoint.photo.previewUrl} />}
                        <small>{waypoint.photo.address || waypoint.photo.name}</small>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="wide voice-input-row">
                <label><span>Name / besucht bei</span><input disabled={quickTripForm.tripType === "Privatfahrt"} value={quickTripForm.visited} onChange={(event) => setQuickTripForm({ ...quickTripForm, visited: event.target.value })} /></label>
              </div>
              <label className="wide"><span>Tanken / Laden</span><input placeholder="z.B. Diesel 42 l, laddning 18 kWh" value={quickTripForm.fuelOrCharge} onChange={(event) => setQuickTripForm({ ...quickTripForm, fuelOrCharge: event.target.value })} /></label>
              <div className="wide receipt-photo-field">
                <label className="ghost-button">
                  <Paperclip size={15} />
                  Tank-/Ladebeleg scannen
                  <input
                    accept="image/*"
                    aria-label="Tank- oder Ladebeleg scannen"
                    capture="environment"
                    type="file"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void captureQuickTripFuelReceipt(file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                {quickTripForm.fuelReceiptPhoto?.previewUrl && (
                  <div className="receipt-photo-preview">
                    <img alt="Tank- oder Ladebeleg" src={quickTripForm.fuelReceiptPhoto.previewUrl} />
                    <small>{quickTripForm.fuelReceiptPhoto.name}</small>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-actions">
              <button className="ghost-button" onClick={() => setQuickTripOpen(false)} type="button">Abbrechen</button>
              <button className="primary-button" onClick={saveQuickTrip} type="button">
                <Check size={16} />
                Fahrt speichern
              </button>
            </div>
          </section>
        </div>
      )}

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
                  setSendPreviewReportBody(customerReportSendBody(completedPromptCustomer, completedPromptReport));
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
              <button aria-label="Versandvorschau schließen" onClick={() => { setSendPreviewReportId(null); setSendPreviewReportBody(""); }} type="button">
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
                <strong>{customerReportSendSubject(sendPreviewReport, sendPreviewObject, sendPreviewCustomer)}</strong>
              </div>
              <div className="wide">
                <span>PDF-Anhang</span>
                <strong>{safeFileName(customerReportSendSubject(sendPreviewReport, sendPreviewObject, sendPreviewCustomer))}.pdf</strong>
              </div>
              {(sendPreviewReport.attachments ?? []).length > 0 && (
                <div className="wide">
                  <span>Weitere Anhänge</span>
                  <strong>{(sendPreviewReport.attachments ?? []).map((attachment) => attachment.name).join(", ")}</strong>
                </div>
              )}
              <div className="wide">
                <span>Nachricht</span>
                <textarea
                  value={sendPreviewReportBody}
                  onChange={(event) => setSendPreviewReportBody(event.target.value)}
                />
              </div>
            </div>
            <ReportAttachmentEditor disabled={Boolean(sendPreviewReport.sentAt)} onUpdateReport={updateReportRecord} report={sendPreviewReport} />
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
              <button className="ghost-button" onClick={() => { setSendPreviewReportId(null); setSendPreviewReportBody(""); }} type="button">Abbrechen</button>
              <button className="primary-button" onClick={() => void confirmSendReportToCustomer(sendPreviewReport)} type="button">
                <Send size={16} />
                Jetzt senden
              </button>
            </div>
          </section>
        </div>
      )}

      {sendPreviewOffer && sendPreviewOfferObject && (
        <div className="modal-backdrop">
          <section className="modal send-preview-modal" role="dialog" aria-modal="true" aria-labelledby="offer-send-preview-title">
            <header>
              <div>
                <p>Versandvorschau</p>
                <h2 id="offer-send-preview-title">Offerte senden</h2>
              </div>
              <button aria-label="Offertenvorschau schließen" onClick={() => setSendPreviewOfferId(null)} type="button">
                <X size={18} />
              </button>
            </header>
            <div className="send-preview-grid">
              <div>
                <span>An</span>
                <strong>{offerRecipientEmail(sendPreviewOfferObject, sendPreviewOfferCustomer) || "Keine E-Mail-Adresse hinterlegt"}</strong>
              </div>
              <div>
                <span>Kopie</span>
                <strong>info@kolaretorp.se</strong>
              </div>
              <div>
                <span>Betreff</span>
                <strong>{offerSendSubject(sendPreviewOffer, sendPreviewOfferObject, sendPreviewOfferCustomer)}</strong>
              </div>
              <div>
                <span>Anhang</span>
                <strong>{safeFileName(offerSendSubject(sendPreviewOffer, sendPreviewOfferObject, sendPreviewOfferCustomer))}.pdf</strong>
              </div>
              <div className="wide">
                <span>Mailtext</span>
                <textarea
                  value={sendPreviewOfferBody}
                  onChange={(event) => setSendPreviewOfferBody(event.target.value)}
                />
              </div>
            </div>
            <div className="send-preview-grid">
              <div>
                <span>Offerte</span>
                <strong>{offerNumber(sendPreviewOffer)}</strong>
              </div>
              <div>
                <span>Objekt</span>
                <strong>{sendPreviewOfferObject.name}</strong>
              </div>
              <div>
                <span>Zeitraum</span>
                <strong>{jobDateRangeLabel(sendPreviewOffer)}</strong>
              </div>
              <div>
                <span>Summe inkl. Moms</span>
                <strong>{formatMoney(offerTotals(offerLines(sendPreviewOffer, services)).gross, offerTotals(offerLines(sendPreviewOffer, services)).currency)}</strong>
              </div>
            </div>
            <div className="modal-actions">
              <button className="ghost-button" onClick={() => void downloadJobOffer(sendPreviewOffer)} type="button">
                <FileDown size={16} />
                PDF herunterladen
              </button>
              <button className="ghost-button" onClick={() => setSendPreviewOfferId(null)} type="button">Abbrechen</button>
              <button className="primary-button" disabled={!offerRecipientEmail(sendPreviewOfferObject, sendPreviewOfferCustomer)} onClick={() => void confirmSendOfferToCustomer(sendPreviewOffer)} type="button">
                <Send size={16} />
                Jetzt senden
              </button>
            </div>
          </section>
        </div>
      )}

      {sendPreviewConfirmation && sendPreviewConfirmationObject && (
        <div className="modal-backdrop">
          <section className="modal send-preview-modal" role="dialog" aria-modal="true" aria-labelledby="confirmation-send-preview-title">
            <header>
              <div>
                <p>Versandvorschau</p>
                <h2 id="confirmation-send-preview-title">Auftragsbestätigung senden</h2>
              </div>
              <button aria-label="Auftragsbestätigung schließen" onClick={() => setSendPreviewConfirmationId(null)} type="button">
                <X size={18} />
              </button>
            </header>
            <div className="send-preview-grid">
              <div>
                <span>An</span>
                <strong>{offerRecipientEmail(sendPreviewConfirmationObject, sendPreviewConfirmationCustomer) || "Keine E-Mail-Adresse hinterlegt"}</strong>
              </div>
              <div>
                <span>Kopie</span>
                <strong>info@kolaretorp.se</strong>
              </div>
              <div>
                <span>Betreff</span>
                <strong>{orderConfirmationSendSubject(sendPreviewConfirmation, sendPreviewConfirmationObject, sendPreviewConfirmationCustomer)}</strong>
              </div>
              <div>
                <span>Anhang</span>
                <strong>{safeFileName(orderConfirmationSendSubject(sendPreviewConfirmation, sendPreviewConfirmationObject, sendPreviewConfirmationCustomer))}.pdf</strong>
              </div>
              <div className="wide">
                <span>Mailtext</span>
                <textarea
                  value={sendPreviewConfirmationBody}
                  onChange={(event) => setSendPreviewConfirmationBody(event.target.value)}
                />
              </div>
            </div>
            <div className="send-preview-grid">
              <div>
                <span>Bestätigung</span>
                <strong>{orderConfirmationNumber(sendPreviewConfirmation)}</strong>
              </div>
              <div>
                <span>Objekt</span>
                <strong>{sendPreviewConfirmationObject.name}</strong>
              </div>
              <div>
                <span>Zeitraum</span>
                <strong>{jobDateRangeLabel(sendPreviewConfirmation)}</strong>
              </div>
              <div>
                <span>Summe inkl. Moms</span>
                <strong>{formatMoney(offerTotals(offerLines(sendPreviewConfirmation, services)).gross, offerTotals(offerLines(sendPreviewConfirmation, services)).currency)}</strong>
              </div>
            </div>
            <div className="modal-actions">
              <button className="ghost-button" onClick={() => void downloadJobOrderConfirmation(sendPreviewConfirmation)} type="button">
                <FileDown size={16} />
                PDF herunterladen
              </button>
              <button className="ghost-button" onClick={() => setSendPreviewConfirmationId(null)} type="button">Abbrechen</button>
              <button className="primary-button" disabled={!offerRecipientEmail(sendPreviewConfirmationObject, sendPreviewConfirmationCustomer)} onClick={() => void confirmSendOrderConfirmationToCustomer(sendPreviewConfirmation)} type="button">
                <Send size={16} />
                Jetzt senden
              </button>
            </div>
          </section>
        </div>
      )}

      {modal && (
        <div className="modal-backdrop">
          <section className={modal === "job" ? "modal job-editor-modal" : "modal"} role="dialog" aria-modal="true">
            <header>
              <div>
                <p>{modal === "customer" ? "Kundenstammdaten" : modal === "job" ? "Auftrag" : "Änderungsverlauf"}</p>
                <h2>{modal === "customer" ? (editingCustomerId ? t.editCustomer : t.newCustomer) : modal === "job" ? (editingJobId ? "Auftrag bearbeiten" : t.newJob) : `v${appVersion.version}`}</h2>
              </div>
              <div className="modal-header-actions">
                {modal === "customer" && editingCustomer && (
                  <button className="ghost-button compact" onClick={() => openCustomerMessage(editingCustomer)} type="button">
                    <Mail size={16} />
                    Nachricht an Kunde
                  </button>
                )}
                <button aria-label={t.close} onClick={() => setModal(null)} type="button">
                  <X size={18} />
                </button>
              </div>
            </header>
            {modal === "job" && (
              <JobForm
                newJob={newJob}
                objects={activeObjects}
                selectedObject={selectedObject}
                materials={materials}
                services={services}
                setNewJob={setNewJob}
                setSelectedObjectId={selectJobObject}
                onSubmit={saveJob}
                submitLabel={editingJobId ? t.saveJob : t.createJob}
              />
            )}
            {modal === "customer" && (
              <CustomerForm
                customer={newCustomer}
                languageOptions={customerLanguageOptions}
                objects={activeObjects}
                isArchived={Boolean(editingCustomer?.archived)}
                onAutoSave={editingCustomerId ? autosaveCustomer : undefined}
                onArchive={editingCustomer ? () => {
                  if (archiveCustomer(editingCustomer)) {
                    setEditingCustomerId(null);
                    setModal(null);
                  }
                } : undefined}
                onDelete={editingCustomer?.archived ? () => {
                  if (deleteCustomer(editingCustomer)) {
                    setEditingCustomerId(null);
                    setModal(null);
                  }
                } : undefined}
                onRestore={editingCustomer?.archived ? () => {
                  if (restoreCustomer(editingCustomer)) {
                    setEditingCustomerId(null);
                    setModal(null);
                  }
                } : undefined}
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

      {customerMessageTarget && (
        <div className="modal-backdrop">
          <section className="modal send-preview-modal customer-message-modal" role="dialog" aria-modal="true" aria-labelledby="customer-message-title">
            <header>
              <div>
                <p>Kundenkommunikation</p>
                <h2 id="customer-message-title">Nachricht an Kunde</h2>
              </div>
              <button aria-label="Nachricht schließen" onClick={() => setCustomerMessageTargetId(null)} type="button">
                <X size={18} />
              </button>
            </header>
            <div className="send-preview-grid">
              <div>
                <span>Kunde</span>
                <strong>{customerMessageTarget.name}</strong>
              </div>
              <div>
                <span>An</span>
                <strong>{customerMessageTarget.email || "Keine E-Mail-Adresse hinterlegt"}</strong>
              </div>
              <div>
                <span>Antwort an</span>
                <strong>info@kolaretorp.se</strong>
              </div>
              <div>
                <span>Blindkopie</span>
                <strong>info@kolaretorp.se</strong>
              </div>
            </div>
            <div className="customer-message-compose">
              <label>
                <span>Betreff</span>
                <input
                  value={customerMessageForm.subject}
                  onChange={(event) => setCustomerMessageForm({ ...customerMessageForm, subject: event.target.value })}
                />
              </label>
              <label>
                <span>Nachricht</span>
                <textarea
                  autoFocus
                  placeholder="Nachricht an den Kunden schreiben..."
                  value={customerMessageForm.message}
                  onChange={(event) => setCustomerMessageForm({ ...customerMessageForm, message: event.target.value })}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button className="ghost-button" onClick={() => setCustomerMessageTargetId(null)} type="button">Abbrechen</button>
              <button
                className="primary-button"
                disabled={customerMessageSending || !customerMessageForm.message.trim() || !customerMessageTarget.email.trim()}
                onClick={() => void sendCustomerMessage()}
                type="button"
              >
                <Send size={16} />
                {customerMessageSending ? "Sende..." : "Nachricht senden"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function Dashboard({
  allJobs,
  objects,
  reports,
  setSection,
}: {
  allJobs: JobRecord[];
  objects: ObjectRecord[];
  reports: ReportRecord[];
  setSection: (section: Section) => void;
}) {
  const openDashboardJobs = dashboardWorkJobs(allJobs);
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
            <article className="job-group-tint" key={job.id} style={jobGroupStyle(job)}>
              <div>
                <strong>{job.title}</strong>
                <span>{recurringJobHint(job, allJobs) || `${job.type} · ${job.assignedTo}`}</span>
              </div>
              <span>{jobDateRangeLabel(job)}</span>
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
  onUpdateReport,
  objects,
  reports,
}: {
  customers: CustomerRecord[];
  jobs: JobRecord[];
  onEditInField: (report: ReportRecord) => void;
  onSendReport: (report: ReportRecord) => void;
  onUpdateReport: (report: ReportRecord, options?: { forceRemote?: boolean }) => void;
  objects: ObjectRecord[];
  reports: ReportRecord[];
}) {
  const [selectedReportId, setSelectedReportId] = useState("");
  const [reportQuery, setReportQuery] = useState("");
  const [reportStatusFilter, setReportStatusFilter] = useState("alle");
  const [reportSort, setReportSort] = useState("date-desc");
  const normalizedReports = dedupeReports(reports);
  const filteredReports = normalizedReports
    .filter((report) => {
      const object = objects.find((item) => item.id === report.objectId);
      const job = jobs.find((item) => item.id === report.jobId);
      const haystack = [report.title, report.date, report.summary, object?.name, object?.address, job?.assignedTo, job?.status]
        .join(" ")
        .toLowerCase();
      const statusMatches = reportStatusFilter === "alle"
        || (reportStatusFilter === "gesendet" ? Boolean(report.sentAt) : !report.sentAt);

      return statusMatches && haystack.includes(reportQuery.trim().toLowerCase());
    })
    .sort((first, second) => {
      const firstObject = objects.find((item) => item.id === first.objectId);
      const secondObject = objects.find((item) => item.id === second.objectId);
      const firstJob = jobs.find((item) => item.id === first.jobId);
      const secondJob = jobs.find((item) => item.id === second.jobId);

      if (reportSort === "date-asc") return normalizeReportDate(first.date).localeCompare(normalizeReportDate(second.date));
      if (reportSort === "object") return (firstObject?.name ?? "").localeCompare(secondObject?.name ?? "", "de");
      if (reportSort === "status") return (firstJob?.status ?? "").localeCompare(secondJob?.status ?? "", "de");
      return normalizeReportDate(second.date).localeCompare(normalizeReportDate(first.date));
    });
  const selectedReport = normalizedReports.find((report) => report.id === selectedReportId);
  const selectedObject = selectedReport ? objects.find((object) => object.id === selectedReport.objectId) : undefined;
  const selectedJob = selectedReport ? jobs.find((job) => job.id === selectedReport.jobId) : undefined;
  const selectedCustomer = selectedObject
    ? customers.find((customer) => customer.id === selectedObject.ownerCustomerId || customer.name === selectedObject.owner)
    : undefined;
  const currentSelectedReport = () => dedupeReports(reports).find((report) => report.id === selectedReportId) ?? selectedReport;

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-title">
          <div>
            <p>Berichte</p>
            <h2>Berichtsübersicht</h2>
          </div>
        </div>
        <div className="list-toolbar report-list-toolbar">
          <label>
            <span>Suchen</span>
            <input value={reportQuery} onChange={(event) => setReportQuery(event.target.value)} placeholder="Bericht, Objekt, Datum..." />
          </label>
          <label>
            <span>Status</span>
            <select value={reportStatusFilter} onChange={(event) => setReportStatusFilter(event.target.value)}>
              <option value="alle">Alle Berichte</option>
              <option value="offen">Nicht gesendet</option>
              <option value="gesendet">Gesendet</option>
            </select>
          </label>
          <label>
            <span>Sortieren</span>
            <select value={reportSort} onChange={(event) => setReportSort(event.target.value)}>
              <option value="date-desc">Datum neu zuerst</option>
              <option value="date-asc">Datum alt zuerst</option>
              <option value="object">Objekt A-Z</option>
              <option value="status">Status A-Z</option>
            </select>
          </label>
        </div>
        <div className="table-list report-overview-list">
          {filteredReports.map((report) => {
            const object = objects.find((item) => item.id === report.objectId);
            const job = jobs.find((item) => item.id === report.jobId);

            return (
              <button
                className={selectedReportId === report.id ? "active" : ""}
                key={report.id}
                onClick={() => setSelectedReportId((current) => current === report.id ? "" : report.id)}
                type="button"
              >
                <FileText size={16} />
                <span>
                  <strong>{report.title}</strong>
                  <small>{object?.name ?? "Objekt unbekannt"} · {report.date} · {job?.assignedTo ?? "ohne Bearbeiter"} · {reportPhotoCount(report)} Fotos</small>
                </span>
                <Badge value={job?.status ?? "Bericht"} />
              </button>
            );
          })}
          {filteredReports.length === 0 && <p>Noch keine passenden Berichte vorhanden.</p>}
        </div>
      </section>
      {selectedReport && selectedObject && (
        <div className="modal-backdrop">
          <section className="modal send-preview-modal report-detail-modal" role="dialog" aria-modal="true" aria-labelledby="report-detail-title">
            <header>
              <div>
                <p>{selectedObject.name} · {displayAddress(selectedObject.address)}</p>
                <h2 id="report-detail-title">{selectedReport.title}</h2>
              </div>
              <div className="modal-header-actions">
                <IconAction label={`Bericht ${selectedReport.title} mobil nachbearbeiten`} onClick={() => { onEditInField(selectedReport); setSelectedReportId(""); }}><Pencil size={16} /></IconAction>
                <IconAction label={`PDF für ${selectedReport.title} herunterladen`} onClick={() => void downloadCustomerReportPdf(selectedReport, selectedObject, selectedJob, selectedCustomer)}><FileDown size={16} /></IconAction>
                <IconAction label={`Bericht ${selectedReport.title} an Kunden senden`} onClick={() => { onSendReport(selectedReport); setSelectedReportId(""); }}><Send size={16} /></IconAction>
                <button aria-label={`Bericht ${selectedReport.title} schließen`} onClick={() => { onUpdateReport(currentSelectedReport() ?? selectedReport, { forceRemote: true }); setSelectedReportId(""); }} type="button">
                  <X size={18} />
                </button>
              </div>
            </header>
            <div className="send-preview-report">
              <CustomerReportCard customer={selectedCustomer} job={selectedJob} object={selectedObject} report={selectedReport} sentAt={selectedReport.sentAt} />
            </div>
            <label className="report-comment-editor">
              <span>Berichtstext</span>
              <textarea
                disabled={Boolean(selectedReport.sentAt)}
                value={selectedReport.summary}
                onChange={(event) => onUpdateReport({ ...(currentSelectedReport() ?? selectedReport), summary: event.target.value })}
                onBlur={(event) => onUpdateReport({ ...(currentSelectedReport() ?? selectedReport), summary: event.currentTarget.value }, { forceRemote: true })}
                placeholder={selectedReport.sentAt ? "Bericht wurde bereits gesendet und ist gesperrt." : "Berichtstext für den Kundenbericht anpassen."}
              />
            </label>
            <label className="report-comment-editor">
              <span>Kommentar vor dem Senden</span>
              <textarea
                disabled={Boolean(selectedReport.sentAt)}
                value={visibleReportCustomerComment(selectedReport)}
                onChange={(event) => onUpdateReport({ ...(currentSelectedReport() ?? selectedReport), customerComment: event.target.value })}
                onBlur={(event) => onUpdateReport({ ...(currentSelectedReport() ?? selectedReport), customerComment: event.currentTarget.value }, { forceRemote: true })}
                placeholder={selectedReport.sentAt ? "Bericht wurde bereits gesendet und ist gesperrt." : "Kommentar ergänzen, der im Kundenbericht erscheinen soll."}
              />
            </label>
            <ReportAttachmentEditor disabled={Boolean(selectedReport.sentAt)} onUpdateReport={onUpdateReport} report={selectedReport} />
          </section>
        </div>
      )}
    </div>
  );
}

function ReportAttachmentEditor({
  disabled,
  onUpdateReport,
  report,
}: {
  disabled: boolean;
  onUpdateReport: (report: ReportRecord, options?: { forceRemote?: boolean }) => void;
  report: ReportRecord;
}) {
  const [notice, setNotice] = useState("");

  async function addAttachments(files: FileList | null) {
    const selectedFiles = Array.from(files ?? []);
    if (!selectedFiles.length) return;

    try {
      const attachments = await Promise.all(selectedFiles.map((file) => fileToReportAttachment(file)));
      onUpdateReport({ ...report, attachments: [...(report.attachments ?? []), ...attachments] }, { forceRemote: true });
      setNotice(`${attachments.length} ${attachments.length === 1 ? "Datei wurde" : "Dateien wurden"} angehängt.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Datei konnte nicht angehängt werden.");
    }
  }

  return (
    <div className="report-attachment-editor">
      <label className="report-comment-editor">
        <span className="inline-icon-label"><Paperclip size={14} /> Dateianhänge</span>
        <input
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          disabled={disabled}
          multiple
          type="file"
          onChange={(event) => {
            void addAttachments(event.target.files);
            event.currentTarget.value = "";
          }}
        />
      </label>
      {notice && <small>{notice}</small>}
      {(report.attachments ?? []).length > 0 && (
        <div className="history-media">
          {(report.attachments ?? []).map((attachment) => (
            <span key={attachment.id}>
              {attachment.name}
              {!disabled && (
                <button
                  aria-label={`Anhang ${attachment.name} entfernen`}
                  onClick={() => onUpdateReport({ ...report, attachments: (report.attachments ?? []).filter((item) => item.id !== attachment.id) }, { forceRemote: true })}
                  type="button"
                >
                  <X size={12} />
                </button>
              )}
            </span>
          ))}
        </div>
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
  const reportKind = report.id.startsWith("WEEK-") ? "Wochenbericht" : "Einsatzbericht";
  const visibleWorkMinutes = visibleReportWorkMinutes(report.checklistResults);
  const attachmentLabel = reportAttachmentsLabel(report);
  const photos = reportPhotos(report);
  const visibleMedia = [
    ...report.media.filter((item) => visibleWorkMinutes > 0 || !/minuten/i.test(item)),
    ...(attachmentLabel ? [attachmentLabel] : []),
  ];
  const materialText = job?.material?.trim() ?? "";
  const customerComment = visibleReportCustomerComment(report);
  const reportTaskTitle = (item: FieldTaskResult) => {
    if (!report.id.startsWith("WEEK-")) return item.title;
    const dateMatch = item.meta.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? item.id.match(/\d{8}/)?.[0]?.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
    return dateMatch ? `${dateMatch} · ${item.title}` : item.title;
  };

  return (
    <article className="customer-report-card printable-report">
      <div className="customer-report-head">
        <div>
          <img alt="Kolaretorp Service AB" className="customer-report-logo" src="/kolaretorp-logo.png" />
          <h3>{reportKind}</h3>
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
          <span>{reportKind}</span>
          <strong>{object.name}</strong>
          <span>{displayAddress(object.address)}</span>
          <small>{report.title} · {report.date}</small>
        </div>
      </div>
      <div className="report-info-grid">
        <section>
          <strong>Objekt</strong>
          <dl>
            <div><dt>Objekt</dt><dd>{object.name}</dd></div>
            <div><dt>Adresse</dt><dd>{displayAddress(object.address)}</dd></div>
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
            {job && (visibleWorkMinutes > 0 || materialText) && <div><dt>{visibleWorkMinutes > 0 ? "Zeit / Material" : "Material"}</dt><dd>{visibleWorkMinutes > 0 ? `${visibleWorkMinutes} min.${materialText ? " · " : ""}` : ""}{materialText}</dd></div>}
          </dl>
        </section>
      </div>
      {photos.length > 0 && (
        <div className="report-photo-summary">
          <strong>Bilder</strong>
          <div>
            {photos.map((photo, photoIndex) => (
              <figure key={`${photo.id ?? photo.name}-${photoIndex}-summary`}>
                {photo.previewUrl ? (
                  <img alt={`Berichtsfoto ${photo.name}`} src={photo.previewUrl} />
                ) : (
                  <div className="report-gallery-placeholder">
                    <Camera size={18} />
                    <span>Foto erfasst</span>
                  </div>
                )}
                <figcaption>{photo.taskTitle}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}
      <div className="report-summary-grid">
        <section>
          <strong>Zusammenfassung</strong>
          <p>{report.summary}</p>
        </section>
        {customerComment && (
          <section>
            <strong>Kommentar an den Kunden</strong>
            <p>{customerComment}</p>
          </section>
        )}
      </div>
      {report.checklistResults.length > 0 ? (
        <div className="report-checklist">
          <strong>Kontrolle vor Ort</strong>
          <div className="report-task-list">
            {report.checklistResults.map((item) => (
              <article key={item.id}>
                <div>
                  <Badge value={item.completed ? "ausgeführt" : "nicht ausgeführt"} />
                  <strong>{reportTaskTitle(item)}</strong>
                  <span>{item.meta}</span>
                </div>
                <p>{item.description}</p>
                <dl>
                  {item.showWorkTimeInReport !== false && <div><dt>Zeit</dt><dd>{item.minutes} min.</dd></div>}
                  <div><dt>Hinweis / Info</dt><dd>{item.note || "Keine zusätzliche Info erfasst."}</dd></div>
                  <div><dt>Bilder</dt><dd>{item.photos.length > 0 ? `${item.photos.length} ${item.photos.length === 1 ? "Foto" : "Fotos"} erfasst` : "Keine Bilder erfasst."}</dd></div>
                </dl>
                {item.photos.length > 0 && (
                  <div className="report-point-photos">
                    {item.photos.map((photo) => (
                      <figure key={`${item.id}-${photo.id ?? photo.name}-inline`}>
                        {photo.previewUrl ? (
                          <img alt={`Kontrollfoto ${photo.name}`} src={photo.previewUrl} />
                        ) : (
                          <div className="report-gallery-placeholder">
                            <Camera size={18} />
                            <span>Foto erfasst</span>
                          </div>
                        )}
                        <figcaption>{photo.note?.trim() ? `${photo.name}: ${photo.note.trim()}` : photo.name}</figcaption>
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
        {visibleMedia.map((item) => <span key={item}>{item}</span>)}
      </div>
      {(report.attachments ?? []).length > 0 && (
        <div className="report-attachment-list">
          <strong>Dateianhänge</strong>
          {(report.attachments ?? []).map((attachment) => (
            <span key={attachment.id}>{attachment.name}</span>
          ))}
        </div>
      )}
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
  selectedObjectId,
  onCreate,
  onEdit,
  onSelect,
}: {
  archivedObjects: ObjectRecord[];
  objects: ObjectRecord[];
  selectedObjectId: string;
  onCreate: () => void;
  onEdit: (object: ObjectRecord) => void;
  onSelect: (id: string) => void;
}) {
  const [activeObjectsOpen, setActiveObjectsOpen] = useState(true);
  const [archivedObjectsOpen, setArchivedObjectsOpen] = useState(false);

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
      <div className="active-fold-group">
        <button className="job-fold-toggle" onClick={() => setActiveObjectsOpen((open) => !open)} type="button">
          {activeObjectsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span>Aktive Objekte</span>
          <small>{objects.length}</small>
        </button>
        {activeObjectsOpen && (
          <div className="object-list">
            {objects.map((object) => (
              <article
                className={selectedObjectId === object.id ? "selected clickable-record-row" : "clickable-record-row"}
                key={object.id}
                onClick={() => {
                  onSelect(object.id);
                  onEdit(object);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(object.id);
                    onEdit(object);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="object-row-main">
                  <ObjectThumbnail object={object} />
                  <div>
                    <strong>{object.name}</strong>
                    <span>{object.owner}</span>
                  </div>
                  <span>{object.region}</span>
                  <span>{object.sizeSqm} m² · {object.rooms} Zi. · {object.beds} Betten</span>
                  <span>{object.carePackage}</span>
                  <Badge value={object.status} />
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      {archivedObjects.length > 0 && (
        <div className="archive-section archive-fold-group">
          <button className="job-fold-toggle" onClick={() => setArchivedObjectsOpen((open) => !open)} type="button">
            {archivedObjectsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span>Archivierte Objekte</span>
            <small>{archivedObjects.length}</small>
          </button>
          {archivedObjectsOpen && (
            <div className="table-list compact-list archive-list">
              {archivedObjects.map((object) => (
                <article
                  className="clickable-record-row"
                  key={object.id}
                  onClick={() => onEdit(object)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onEdit(object);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div>
                    <strong>{object.name}</strong>
                    <span>{displayAddress(object.address)}</span>
                  </div>
                  <Badge value="archiviert" />
                </article>
              ))}
            </div>
          )}
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
  objects,
  onCreate,
  onEdit,
  onMessage,
}: {
  archivedCustomers: CustomerRecord[];
  customers: CustomerRecord[];
  objects: ObjectRecord[];
  onCreate: () => void;
  onEdit: (customer: CustomerRecord) => void;
  onMessage: (customer: CustomerRecord) => void;
}) {
  const [activeCustomersOpen, setActiveCustomersOpen] = useState(true);
  const [archivedCustomersOpen, setArchivedCustomersOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerSort, setCustomerSort] = useState("name-asc");
  const customerMatchesQuery = (customer: CustomerRecord) => {
    const text = [
      customer.name,
      customer.contact,
      customer.email,
      customer.phone,
      customer.phone2,
      customer.language,
      customer.notes,
      normalizeReadableNumber(customer.personalNumber),
      ...objects.filter((object) => customer.objects.includes(object.id)).flatMap((object) => [object.name, object.address, object.region]),
    ].join(" ").toLowerCase();

    return text.includes(customerQuery.trim().toLowerCase());
  };
  const sortCustomers = (items: CustomerRecord[]) => [...items].sort((first, second) => {
    const firstObjectNames = objects.filter((object) => first.objects.includes(object.id)).map((object) => object.name).join(", ");
    const secondObjectNames = objects.filter((object) => second.objects.includes(object.id)).map((object) => object.name).join(", ");

    if (customerSort === "name-desc") return second.name.localeCompare(first.name, "de", { sensitivity: "base" });
    if (customerSort === "created-desc") return (second.createdAt || "").localeCompare(first.createdAt || "");
    if (customerSort === "created-asc") return (first.createdAt || "").localeCompare(second.createdAt || "");
    if (customerSort === "object-asc") return firstObjectNames.localeCompare(secondObjectNames, "de", { sensitivity: "base" });
    return first.name.localeCompare(second.name, "de", { sensitivity: "base" });
  });
  const visibleCustomers = sortCustomers(customers.filter(customerMatchesQuery));
  const visibleArchivedCustomers = sortCustomers(archivedCustomers.filter(customerMatchesQuery));

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
      <div className="list-toolbar">
        <label>
          <span>Kunden suchen</span>
          <input
            placeholder="Name, Telefon, E-Mail, Objekt..."
            type="search"
            value={customerQuery}
            onChange={(event) => setCustomerQuery(event.target.value)}
          />
        </label>
        <label>
          <span>Sortieren</span>
          <select value={customerSort} onChange={(event) => setCustomerSort(event.target.value)}>
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
            <option value="created-desc">Neueste zuerst</option>
            <option value="created-asc">Älteste zuerst</option>
            <option value="object-asc">Objekt A-Z</option>
          </select>
        </label>
      </div>
      <div className="active-fold-group">
        <button className="job-fold-toggle" onClick={() => setActiveCustomersOpen((open) => !open)} type="button">
          {activeCustomersOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span>Aktive Kunden</span>
          <small>{visibleCustomers.length}</small>
        </button>
        {activeCustomersOpen && (
          <div className="table-list">
            {visibleCustomers.map((customer) => (
              <article
                className="customer-row customer-row-with-actions clickable-record-row"
                key={customer.id}
                onClick={() => onEdit(customer)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onEdit(customer);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="customer-row-main">
                  <div>
                  <strong>{customer.name}</strong>
                    <span>{[customer.contact, customer.email, customer.phone, customer.phone2, customer.language, customer.notes].filter(Boolean).join(" · ")}</span>
                    <small>Kundennummer: {normalizeReadableNumber(customer.personalNumber) || "fehlt"} · angelegt am: {formatCreatedAt(customer.createdAt)}</small>
                  </div>
                  <span>{objects.filter((object) => customer.objects.includes(object.id)).map((object) => object.name).join(", ") || "Keine Objekte"}</span>
                  <span>{customer.balance}</span>
                  <Badge value={customer.portalStatus} />
                </div>
                <div className="row-actions">
                  <button
                    aria-label={`Nachricht an ${customer.name} senden`}
                    className="icon-button"
                    data-tooltip={`Nachricht an ${customer.name} senden`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onMessage(customer);
                    }}
                    type="button"
                  >
                    <Mail size={16} />
                  </button>
                </div>
              </article>
            ))}
            {visibleCustomers.length === 0 && <p className="empty-list-note">Keine passenden Kunden gefunden.</p>}
          </div>
        )}
      </div>
      {archivedCustomers.length > 0 && (
        <div className="archive-section archive-fold-group">
          <button className="job-fold-toggle" onClick={() => setArchivedCustomersOpen((open) => !open)} type="button">
            {archivedCustomersOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span>Archivierte Kunden</span>
            <small>{visibleArchivedCustomers.length}</small>
          </button>
          {archivedCustomersOpen && (
            <div className="table-list compact-list archive-list">
              {visibleArchivedCustomers.map((customer) => (
                <article
                  className="clickable-record-row"
                  key={customer.id}
                  onClick={() => onEdit(customer)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onEdit(customer);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div>
                    <strong>{customer.name}</strong>
                    <span>{[customer.contact, customer.email, customer.phone, customer.phone2].filter(Boolean).join(" · ")}</span>
                    <small>Kundennummer: {normalizeReadableNumber(customer.personalNumber) || "fehlt"} · angelegt am: {formatCreatedAt(customer.createdAt)}</small>
                  </div>
                  <Badge value="archiviert" />
                </article>
              ))}
              {visibleArchivedCustomers.length === 0 && <p className="empty-list-note">Keine passenden archivierten Kunden gefunden.</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function JobsView({
  jobs,
  objects,
  onCancel,
  onConfirmOffer,
  onCreate,
  onCreateWeekReport,
  onDownloadOffer,
  onDownloadOrderConfirmation,
  onEdit,
  onMoveToBilling,
  onRestore,
  onSendOrderConfirmation,
  onSendOffer,
  onStart,
  reports,
}: {
  jobs: JobRecord[];
  objects: ObjectRecord[];
  onCancel: (job: JobRecord) => void;
  onConfirmOffer: (job: JobRecord) => void;
  onCreate: () => void;
  onCreateWeekReport: (master: JobRecord, week: SeriesWeekReport) => void;
  onDownloadOffer: (job: JobRecord) => Promise<void>;
  onDownloadOrderConfirmation: (job: JobRecord) => Promise<void>;
  onEdit: (job: JobRecord) => void;
  onMoveToBilling: (job: JobRecord) => void;
  onRestore: (job: JobRecord) => void;
  onSendOrderConfirmation: (job: JobRecord) => void;
  onSendOffer: (job: JobRecord) => void;
  onStart: (job: JobRecord) => void;
  reports: ReportRecord[];
}) {
  const [expandedSeriesIds, setExpandedSeriesIds] = useState<string[]>([]);
  const [activeGroupOpen, setActiveGroupOpen] = useState(true);
  const [completedGroupOpen, setCompletedGroupOpen] = useState(false);
  const [cancelledGroupOpen, setCancelledGroupOpen] = useState(false);
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
  const activeRootJobs = rootJobs.filter((job) => jobSortGroup(job, occurrenceGroups[job.id] ?? []) < 2);
  const completedRootJobs = rootJobs.filter((job) => {
    const group = jobSortGroup(job, occurrenceGroups[job.id] ?? []);
    return group >= 2 && group < 4;
  });
  const cancelledRootJobs = rootJobs.filter((job) => jobSortGroup(job, occurrenceGroups[job.id] ?? []) >= 4);

  function toggleSeries(id: string) {
    setExpandedSeriesIds((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  }

  function renderJobRow(job: JobRecord) {
    const occurrences = sortedByDueDate(occurrenceGroups[job.id] ?? []);
    const isRecurring = isSeriesMaster(job);
    const isExpanded = expandedSeriesIds.includes(job.id);
    const summary = isRecurring ? seriesSummary(job, occurrences, reports) : null;
    const weekReports = isRecurring ? seriesWeekReports(occurrences, reports) : [];

    return (
      <article className={`job-row job-group-tint ${isRecurring ? "series-job-row" : ""}`} key={job.id} style={jobGroupStyle(job)}>
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
          {!isRecurring && job.executionDate && jobDateRangeLabel(job) !== jobOriginalDateRangeLabel(job) && (
            <span>Ausführung: {jobDateRangeLabel(job)} · Original: {jobOriginalDateRangeLabel(job)} · {job.executionLog?.length ?? 0} Verschiebungen</span>
          )}
        </div>
        <div className="job-row-meta">
          <div className="job-row-meta-line">
            <span>{isRecurring ? `${occurrences.length} Teilaufträge` : jobDateRangeLabel(job)}</span>
            <span>{job.priority}</span>
            {!isRecurring && <Badge value={job.status} />}
          </div>
          <div className="row-actions">
            {isRecurring && (
              <IconAction label={`${job.title} Teilaufträge ${isExpanded ? "ausblenden" : "anzeigen"}`} onClick={() => toggleSeries(job.id)}>
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </IconAction>
            )}
            {!isRecurring && job.status === "offerte" && (
              <>
                <IconAction label={`Offerte ${job.title} als PDF herunterladen`} onClick={() => void onDownloadOffer(job)}><FileDown size={16} /></IconAction>
                <IconAction label={`Offerte ${job.title} an Kunden senden`} onClick={() => onSendOffer(job)}><Send size={16} /></IconAction>
                <IconAction label={`Offerte ${job.title} als Auftrag bestätigen`} onClick={() => onConfirmOffer(job)}><Check size={16} /></IconAction>
              </>
            )}
            <IconAction label={`Auftrag ${job.title} bearbeiten`} onClick={() => onEdit(job)}><Pencil size={16} /></IconAction>
            {!isRecurring && !["offerte", "storniert", "erledigt", "abgerechnet"].includes(job.status) && (
              <>
                <IconAction label={`Auftragsbestätigung ${job.title} als PDF herunterladen`} onClick={() => void onDownloadOrderConfirmation(job)}><FileDown size={16} /></IconAction>
                <IconAction label={`Auftragsbestätigung ${job.title} an Kunden senden`} onClick={() => onSendOrderConfirmation(job)}><Send size={16} /></IconAction>
                <IconAction label={`Auftrag ${job.title} starten`} onClick={() => onStart(job)}><PlayCircle size={16} /></IconAction>
              </>
            )}
            {!isRecurring && job.status === "erledigt" && jobBillingEnabled(job) && (
              <IconAction label={`Auftrag ${job.title} in die Abrechnung übernehmen`} onClick={() => onMoveToBilling(job)}><Euro size={16} /></IconAction>
            )}
            {job.status === "storniert" ? (
              <IconAction label={`Auftrag ${job.title} reaktivieren`} onClick={() => onRestore(job)}><RotateCcw size={16} /></IconAction>
            ) : (
              job.status !== "abgerechnet" && <IconAction danger label={`Auftrag ${job.title} stornieren`} onClick={() => onCancel(job)}><X size={16} /></IconAction>
            )}
          </div>
        </div>
        {isRecurring && isExpanded && (
          <div className="series-occurrence-list">
            {weekReports.length > 0 && (
              <div className="series-week-report-list" aria-label="Wochenbericht nach Kalenderwoche">
                {weekReports.map((week) => (
                  <article key={`${week.year}-${week.week}`}>
                    <strong>KW {week.week} · {week.year}</strong>
                    <span>{week.completed}/{week.count} erledigt</span>
                    <span>{week.open} offen</span>
                    <span>{week.reportCount} Berichte</span>
                    <span>{week.minutes} min.</span>
                    <IconAction label={`Wochenbericht KW ${week.week} ${week.year} erstellen und senden`} onClick={() => onCreateWeekReport(job, week)}>
                      <Send size={14} />
                    </IconAction>
                  </article>
                ))}
              </div>
            )}
            {occurrences.map((occurrence) => {
              const occurrenceExecutionDate = jobExecutionDate(occurrence);
              const occurrenceOriginalDate = normalizeReportDate(occurrence.dueDate);
              const occurrenceMoved = occurrenceExecutionDate !== occurrenceOriginalDate;

              return (
                <div className="series-occurrence-row job-group-tint" key={occurrence.id} style={jobGroupStyle(occurrence)}>
                  <div>
                    <strong>{occurrenceMoved ? `Einsatz ${occurrenceExecutionDate}` : occurrenceExecutionDate}</strong>
                    <span>{readableJobStatus(occurrence.status)} · {occurrence.assignedTo}</span>
                    {occurrenceMoved && (
                      <span>Original: {occurrenceOriginalDate} · {occurrence.executionLog?.length ?? 0} Verschiebungen</span>
                    )}
                  </div>
                  <div className="row-actions">
                    <Badge value={occurrence.status} />
                    <IconAction label={`Teilauftrag ${occurrenceExecutionDate} bearbeiten`} onClick={() => onEdit(occurrence)}><Pencil size={16} /></IconAction>
                    {occurrence.status === "offerte" && (
                      <>
                        <IconAction label={`Offerte ${occurrenceExecutionDate} als PDF herunterladen`} onClick={() => void onDownloadOffer(occurrence)}><FileDown size={16} /></IconAction>
                        <IconAction label={`Offerte ${occurrenceExecutionDate} an Kunden senden`} onClick={() => onSendOffer(occurrence)}><Send size={16} /></IconAction>
                        <IconAction label={`Teilauftrag ${occurrenceExecutionDate} als Auftrag bestätigen`} onClick={() => onConfirmOffer(occurrence)}><Check size={16} /></IconAction>
                      </>
                    )}
                    {occurrence.status !== "storniert" && !["offerte", "erledigt", "abgerechnet"].includes(occurrence.status) && (
                      <IconAction label={`Teilauftrag ${occurrenceExecutionDate} starten`} onClick={() => onStart(occurrence)}><PlayCircle size={16} /></IconAction>
                    )}
                    {occurrence.status === "erledigt" && jobBillingEnabled(occurrence) && (
                      <IconAction label={`Teilauftrag ${occurrenceExecutionDate} in die Abrechnung übernehmen`} onClick={() => onMoveToBilling(occurrence)}><Euro size={16} /></IconAction>
                    )}
                    {occurrence.status === "storniert" ? (
                      <IconAction label={`Teilauftrag ${occurrenceExecutionDate} reaktivieren`} onClick={() => onRestore(occurrence)}><RotateCcw size={16} /></IconAction>
                    ) : (
                      <IconAction danger label={`Teilauftrag ${occurrenceExecutionDate} stornieren`} onClick={() => onCancel(occurrence)}><X size={16} /></IconAction>
                    )}
                  </div>
                </div>
              );
            })}
            {occurrences.length === 0 && <span className="muted-line">Für diesen Serienauftrag sind aktuell keine offenen Teilaufträge vorbereitet.</span>}
          </div>
        )}
      </article>
    );
  }

  function renderJobGroup(title: string, count: number, open: boolean, onToggle: () => void, rows: JobRecord[], className = "") {
    if (count === 0) return null;

    return (
      <div className={`job-fold-group ${className}`}>
        <button className="job-fold-toggle" onClick={onToggle} type="button">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span>{title}</span>
          <small>{count}</small>
        </button>
        {open && (
          <div className="table-list job-list">
            {rows.map(renderJobRow)}
          </div>
        )}
      </div>
    );
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
        {["alle", "offerte", "geplant", "in Arbeit", "pausiert", "erledigt", "abgerechnet", "storniert"].map((status) => (
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
      {renderJobGroup("Aktive Aufträge", activeRootJobs.length, activeGroupOpen, () => setActiveGroupOpen((open) => !open), activeRootJobs)}
      {activeRootJobs.length === 0 && completedRootJobs.length === 0 && cancelledRootJobs.length === 0 && <span className="muted-line">Keine Aufträge für diesen Status.</span>}
      {renderJobGroup("Erledigte Aufträge", completedRootJobs.length, completedGroupOpen, () => setCompletedGroupOpen((open) => !open), completedRootJobs)}
      {renderJobGroup("Stornierte Aufträge", cancelledRootJobs.length, cancelledGroupOpen, () => setCancelledGroupOpen((open) => !open), cancelledRootJobs, "job-list-cancelled")}
    </section>
  );
}

function PlanningView({
  allJobs,
  jobs,
  objects,
  onAssignPersonnel,
  onAssignResources,
  onEdit,
  onMoveJob,
  personnel,
  resources,
}: {
  allJobs: JobRecord[];
  jobs: JobRecord[];
  objects: ObjectRecord[];
  onAssignPersonnel: (job: JobRecord, assignedTo: string) => void;
  onAssignResources: (job: JobRecord, resourceIds: string[]) => void;
  onEdit: (job: JobRecord) => void;
  onMoveJob: (job: JobRecord, toDate: string, assignedTo: string) => void;
  personnel: PersonnelRecord[];
  resources: ResourceRecord[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const currentWeekStart = startOfIsoWeekValue(today);
  const [planningStartDate, setPlanningStartDate] = useState(currentWeekStart);
  const planningDateInputRef = useRef<HTMLInputElement>(null);
  const activeJobs = visibleOperationalJobs(jobs)
    .filter((job) => !["offerte", "erledigt", "abgerechnet", "storniert"].includes(job.status))
    .sort((first, second) => jobExecutionDate(first).localeCompare(jobExecutionDate(second)) || first.title.localeCompare(second.title, "de"));
  const overdueJobs = activeJobs.filter((job) => jobExecutionEndDate(job) < today);
  const weekNumber = isoWeekNumber(planningStartDate);
  const calendarDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${planningStartDate}T12:00:00`);
    date.setDate(date.getDate() + index);
    const value = date.toISOString().slice(0, 10);
    return {
      label: date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", timeZone: "Europe/Stockholm" }),
      title: date.toLocaleDateString("de-DE", { weekday: "short", timeZone: "Europe/Stockholm" }),
      value,
    };
  });
  const activePersonnel = personnel.filter((person) => !person.archived);
  const activeResources = resources.filter((resource) => !resource.archived);
  const assignedNames = uniqueSortedValues(activeJobs.map((job) => job.assignedTo).filter((name) => name && !isUnassignedJobAssignee(name)));
  const dispatcherRows = [
    ...activePersonnel.map((person) => ({
      id: person.id,
      label: `${person.firstName} ${person.lastName}`.trim(),
      meta: person.role,
      names: [`${person.firstName} ${person.lastName}`.trim(), person.firstName, person.lastName].filter(Boolean),
    })),
    ...assignedNames
      .filter((name) => !activePersonnel.some((person) => [`${person.firstName} ${person.lastName}`.trim(), person.firstName, person.lastName].includes(name)))
      .map((name) => ({ id: `assigned-${name}`, label: name, meta: "Zugeordnet", names: [name] })),
    { id: "unassigned", label: "Nicht zugewiesen", meta: "offen", names: ["", "-", "nicht zugewiesen", "nicht zugeordnet"] },
  ];

  function jobsForDate(date: string) {
    return activeJobs.filter((job) => jobCoversExecutionDate(job, date));
  }

  function jobsForRowAndDate(row: typeof dispatcherRows[number], date: string) {
    return jobsForDate(date).filter((job) => {
      const assignedTo = job.assignedTo.trim();
      return row.id === "unassigned"
        ? isUnassignedJobAssignee(assignedTo)
        : row.names.includes(assignedTo);
    });
  }

  function assignedToForRow(row: typeof dispatcherRows[number]) {
    return row.id === "unassigned" ? "nicht zugewiesen" : row.label;
  }

  function handleJobDrop(event: DragEvent<HTMLDivElement>, row: typeof dispatcherRows[number], date: string) {
    event.preventDefault();
    const jobId = event.dataTransfer.getData("text/plain");
    const job = activeJobs.find((item) => item.id === jobId);
    if (!job) return;
    onMoveJob(job, date, assignedToForRow(row));
  }

  function renderDispatchJob(job: JobRecord) {
    const object = objects.find((item) => item.id === job.objectId);
    const assignedResourceIds = job.resourceIds ?? [];
    const assignedResources = assignedResourceIds
      .map((id) => resources.find((resource) => resource.id === id))
      .filter(Boolean) as ResourceRecord[];
    const availableResources = activeResources.filter((resource) => !assignedResourceIds.includes(resource.id));

    function addResource(resourceId: string) {
      if (!resourceId || assignedResourceIds.includes(resourceId)) return;
      onAssignResources(job, [...assignedResourceIds, resourceId]);
    }

    function removeResource(resourceId: string) {
      onAssignResources(job, assignedResourceIds.filter((id) => id !== resourceId));
    }

    function assignPersonnel(assignedTo: string) {
      onAssignPersonnel(job, assignedTo || "nicht zugewiesen");
    }

    return (
      <article
        className={`dispatch-job-card ${job.status === "in Arbeit" ? "active" : ""}`}
        draggable
        key={job.id}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", job.id);
        }}
      >
        <button className="dispatch-job-main" onClick={() => onEdit(job)} type="button">
          <span>{job.priority}</span>
          <strong>{job.title}</strong>
          <small>{object?.name ?? "Objekt offen"}</small>
          <small>{recurringJobHint(job, allJobs) || job.assignedTo || "nicht zugeordnet"}</small>
          {jobDateRangeLabel(job) !== jobOriginalDateRangeLabel(job) && (
            <small>Ausführung {jobDateRangeLabel(job)} · Original {jobOriginalDateRangeLabel(job)}</small>
          )}
          <Badge value={readableJobStatus(job.status)} />
        </button>
        <div className="dispatch-assignment-picker">
          <select aria-label={`Personal für ${job.title} zuweisen`} value={isUnassignedJobAssignee(job.assignedTo) ? "" : job.assignedTo} onChange={(event) => assignPersonnel(event.target.value)}>
            <option value="">Personal +</option>
            {activePersonnel.map((person) => {
              const name = `${person.firstName} ${person.lastName}`.trim();
              return <option key={person.id} value={name}>{name}</option>;
            })}
          </select>
        </div>
        <div className="dispatch-resource-picker">
          <select aria-label={`Ressource für ${job.title} zuordnen`} value="" onChange={(event) => addResource(event.target.value)}>
            <option value="">Ressource +</option>
            {availableResources.map((resource) => (
              <option key={resource.id} value={resource.id}>{resource.name}</option>
            ))}
          </select>
          {assignedResources.length > 0 && (
            <div className="dispatch-resource-tags">
              {assignedResources.map((resource) => (
                <button aria-label={`${resource.name} entfernen`} key={resource.id} onClick={() => removeResource(resource.id)} type="button">
                  <Wrench size={12} />
                  {resource.name}
                  <X size={12} />
                </button>
              ))}
            </div>
          )}
        </div>
      </article>
    );
  }

  function movePlanningWindow(days: number) {
    const date = new Date(`${planningStartDate}T12:00:00`);
    date.setDate(date.getDate() + days);
    setPlanningStartDate(date.toISOString().slice(0, 10));
  }

  function openPlanningDatePicker() {
    planningDateInputRef.current?.showPicker?.();
    planningDateInputRef.current?.focus();
  }

  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <p>Disposition</p>
          <h2>Dispokalender</h2>
        </div>
        <div className="dispatch-controls">
          <button className="ghost-button" onClick={() => movePlanningWindow(-7)} type="button">
            <ChevronRight className="flip-icon" size={16} />
            Woche
          </button>
          <button className="ghost-button" onClick={() => setPlanningStartDate(currentWeekStart)} type="button">Heute</button>
          <button className="ghost-button" onClick={() => movePlanningWindow(7)} type="button">
            Woche
            <ChevronRight size={16} />
          </button>
          <button className="ghost-button dispatch-calendar-button" onClick={openPlanningDatePicker} type="button">
            <CalendarDays size={16} />
            Kalender
          </button>
          <input
            ref={planningDateInputRef}
            aria-label="Datum im Dispokalender auswählen"
            className="dispatch-date-input"
            type="date"
            value={planningStartDate}
            onChange={(event) => setPlanningStartDate(startOfIsoWeekValue(event.target.value))}
          />
        </div>
      </div>
      <div className="dispatch-calendar">
        {overdueJobs.length > 0 && (
          <section className="dispatch-day dispatch-overdue">
            <header>
              <CalendarDays size={16} />
              <div>
                <strong>Überfällig</strong>
                <span>{overdueJobs.length} offen</span>
              </div>
            </header>
            <div className="dispatch-day-jobs">
              {overdueJobs.map(renderDispatchJob)}
            </div>
          </section>
        )}
        <div
          className="dispatcher-board"
          style={{
            gridTemplateColumns: `140px repeat(${calendarDays.length}, minmax(135px, 1fr))`,
            minWidth: `${140 + calendarDays.length * 135}px`,
          }}
        >
          <div className="dispatcher-corner">
            <strong>KW {weekNumber}</strong>
            <span>Personal</span>
          </div>
          {calendarDays.map((day) => (
            <div className={day.value === today ? "dispatcher-day-head today" : "dispatcher-day-head"} key={day.value}>
              <strong>{day.title}</strong>
              <span>{day.label}</span>
            </div>
          ))}
          {dispatcherRows.map((row) => (
            <div className="dispatcher-row-fragment" key={row.id}>
              <div className="dispatcher-person">
                <strong>{row.label}</strong>
                <span>{row.meta}</span>
              </div>
              {calendarDays.map((day) => {
                const dayJobs = jobsForRowAndDate(row, day.value);
                return (
                  <div
                    className={day.value === today ? "dispatcher-cell today" : "dispatcher-cell"}
                    key={`${row.id}-${day.value}`}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(event) => handleJobDrop(event, row, day.value)}
                  >
                    {dayJobs.map(renderDispatchJob)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FieldView({
  activeJobId,
  allJobs,
  customers,
  editingReportId,
  objects,
  packages,
  reports,
  services,
  selectedWorkDate,
  fieldNote,
  progress,
  onSelectJob,
  onSelectReport,
  onSelectWorkDate,
  onClearActiveJob,
  onFieldNoteChange,
  onProgressChange,
  onSendReport,
  onUpdateJobMaterial,
  onUpdateReport,
  onComplete,
}: {
  activeJobId: string | null;
  allJobs: JobRecord[];
  customers: CustomerRecord[];
  editingReportId: string | null;
  objects: ObjectRecord[];
  packages: ServicePackage[];
  reports: ReportRecord[];
  services: ServiceItem[];
  selectedWorkDate: string;
  fieldNote: string;
  progress: Record<string, FieldTaskProgress>;
  onSelectJob: (job: JobRecord) => void;
  onSelectReport: (report: ReportRecord) => void;
  onSelectWorkDate: (jobId: string, date: string) => void;
  onClearActiveJob: (job: JobRecord, nextStatus?: JobRecord["status"], material?: string) => void;
  onFieldNoteChange: (jobId: string, note: string) => void;
  onProgressChange: (jobId: string, progress: Record<string, FieldTaskProgress>) => void;
  onSendReport: (report: ReportRecord) => void;
  onUpdateJobMaterial: (job: JobRecord, material: string) => void;
  onUpdateReport: (report: ReportRecord, options?: { forceRemote?: boolean }) => void;
  onComplete: (job: JobRecord, checklistResults: FieldTaskResult[], fieldNote: string, workDate?: string, reportAttachments?: ReportAttachment[], fieldMaterial?: string) => void;
}) {
  const [showCompletedReports, setShowCompletedReports] = useState(false);
  const [showSentReports, setShowSentReports] = useState(false);
  const [closeStatusPrompt, setCloseStatusPrompt] = useState(false);
  const [materialDraft, setMaterialDraft] = useState("");
  const [pendingReportAttachments, setPendingReportAttachments] = useState<ReportAttachment[]>([]);
  const [pendingAttachmentNotice, setPendingAttachmentNotice] = useState("");
  const [photoNoteDraft, setPhotoNoteDraft] = useState("");
  const [photoNoteEditor, setPhotoNoteEditor] = useState<{ photoId: string; taskId: string } | null>(null);
  const progressRef = useRef(progress);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    const active = activeJobId ? allJobs.find((job) => job.id === activeJobId) : undefined;
    setMaterialDraft(active?.material?.trim() === "-" ? "" : active?.material ?? "");
    setPendingReportAttachments([]);
    setPendingAttachmentNotice("");
  }, [activeJobId, allJobs]);

  const fieldOpenJobs = dashboardWorkJobs(allJobs);
  const completedReports = dedupeReports(reports).filter((report) => {
    const job = allJobs.find((item) => item.id === report.jobId);
    return job ? ["erledigt", "geplant", "in Arbeit"].includes(job.status) : true;
  });
  const editableCompletedReports = completedReports.filter((report) => !report.sentAt);
  const sentReports = completedReports.filter((report) => report.sentAt);
  const active = activeJobId ? fieldOpenJobs.find((job) => job.id === activeJobId) ?? allJobs.find((job) => job.id === activeJobId) : undefined;
  const activeReport = editingReportId ? reports.find((report) => report.id === editingReportId) : undefined;
  const reportLocked = Boolean(activeReport?.sentAt);
  if (!active && fieldOpenJobs.length === 0 && completedReports.length === 0) {
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
            {fieldOpenJobs.map((job) => {
              const jobObject = objects.find((item) => item.id === job.objectId);
              const dateLabel = jobDateRangeLabel(job) === jobOriginalDateRangeLabel(job) ? jobDateRangeLabel(job) : `Einsatz ${jobDateRangeLabel(job)} · Original ${jobOriginalDateRangeLabel(job)}`;
              return (
                <button key={job.id} onClick={() => onSelectJob(job)} type="button">
                  <span>
                    <strong>{job.title}</strong>
                    <small>{jobObject?.name ?? "Objekt unbekannt"} · {dateLabel} · {recurringJobHint(job, allJobs) || job.assignedTo}</small>
                  </span>
                  <Badge value={job.status} />
                </button>
              );
            })}
            {fieldOpenJobs.length === 0 && <span>Keine offenen Aufträge.</span>}
          </div>
          <div className="field-job-picker">
            <button className="field-picker-toggle" onClick={() => setShowCompletedReports((current) => !current)} type="button">
              <span>
                <strong>Abgeschlossene Berichte <small className="inline-count">{editableCompletedReports.length}</small></strong>
              </span>
              {showCompletedReports ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            {showCompletedReports && editableCompletedReports.map((report) => {
              const jobObject = objects.find((item) => item.id === report.objectId);
              return (
                <button key={report.id} onClick={() => onSelectReport(report)} type="button">
                  <span>
                    <strong>{report.title}</strong>
                    <small>{jobObject?.name ?? "Objekt unbekannt"} · {report.date}</small>
                  </span>
                  <Badge value="Bericht" />
                </button>
              );
            })}
            {showCompletedReports && editableCompletedReports.length === 0 && <span>Noch keine abgeschlossenen Berichte.</span>}
          </div>
          <div className="field-job-picker">
            <button className="field-picker-toggle" onClick={() => setShowSentReports((current) => !current)} type="button">
              <span>
                <strong>Gesendete Berichte <small className="inline-count">{sentReports.length}</small></strong>
              </span>
              {showSentReports ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            {showSentReports && sentReports.map((report) => {
              const jobObject = objects.find((item) => item.id === report.objectId);
              return (
                <button key={report.id} onClick={() => onSelectReport(report)} type="button">
                  <span>
                    <strong>{report.title}</strong>
                    <small>{jobObject?.name ?? "Objekt unbekannt"} · {report.date}</small>
                  </span>
                  <Badge value="gesendet" />
                </button>
              );
            })}
            {showSentReports && sentReports.length === 0 && <span>Noch keine gesendeten Berichte.</span>}
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
  const customer = customers.find((item) => item.id === activeJob.customerId) ?? customers.find((item) => object?.ownerCustomerId && item.id === object.ownerCustomerId);
  const workDates = jobWorkDates(activeJob);
  const activeWorkDate = selectedWorkDate && workDates.includes(selectedWorkDate) ? selectedWorkDate : workDates[0];
  const reportedWorkDates = new Set(reports.filter((report) => report.jobId === activeJob.id).map((report) => normalizeReportDate(report.date)));
  const isLastOpenWorkDate = workDates.length > 1 && workDates.every((date) => date === activeWorkDate || reportedWorkDates.has(date));
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
        defaultShowWorkTimeInReport: true,
      }));

  function defaultTimeVisibilityForTask(task: FieldTask) {
    return customer?.workTimeVisibility === "show"
      ? true
      : customer?.workTimeVisibility === "hide"
        ? false
        : task.defaultShowWorkTimeInReport ?? true;
  }

  function valueForTask(task: FieldTask, index: number) {
    const customerDefault = defaultTimeVisibilityForTask(task);
    return progress[task.id] ?? {
      completed: index < 1,
      minutes: task.defaultMinutes ? String(task.defaultMinutes) : "",
      note: "",
      photos: [],
      showWorkTimeInReport: customerDefault,
      updatedAt: undefined,
    };
  }

  function updateTask(
    id: string,
    patch: Partial<FieldTaskProgress>,
    currentTask: FieldTaskProgress,
  ) {
    const latestProgress = progressRef.current;
    const latestTask = latestProgress[id] ?? currentTask;
    const nextProgress = { ...latestProgress, [id]: { ...latestTask, ...patch, updatedAt: new Date().toISOString() } };
    progressRef.current = nextProgress;
    onProgressChange(fieldProgressKey(activeJob, activeWorkDate), nextProgress);
  }

  function updateTaskPhotos(
    id: string,
    currentTask: FieldTaskProgress,
    updater: (photos: FieldPhoto[]) => FieldPhoto[],
  ) {
    const latestTask = progressRef.current[id] ?? currentTask;
    updateTask(id, { photos: updater(latestTask.photos ?? []) }, latestTask);
  }

  function createFieldPhoto(file: File, previewUrl?: string): FieldPhoto {
    const photoId = globalThis.crypto?.randomUUID?.() ?? `PHOTO-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return {
      accepted: true,
      createdAt: new Date().toISOString(),
      id: photoId,
      name: file.name,
      ...(previewUrl ? { previewUrl } : {}),
    };
  }

  async function uploadFieldPhotoInBackground(taskId: string, photoId: string, previewUrl: string, fileName: string) {
    try {
      const uploaded = await uploadMediaFile(await dataUrlToBlob(previewUrl), "field-photos", fileName);
      if (!uploaded) return;
      updateTaskPhotos(taskId, progressRef.current[taskId] ?? { completed: false, minutes: "", note: "", photos: [] }, (photos) => (
        photos.map((photo) => (
          photo.id === photoId
            ? { ...photo, previewUrl: uploaded.url, storagePath: uploaded.path }
            : photo
        ))
      ));
    } catch (error) {
      console.warn("Einsatzfoto konnte nicht im Hintergrund hochgeladen werden.", error);
    }
  }

  function openPhotoNoteEditor(taskId: string, photo: FieldPhoto) {
    if (!photo.id) return;
    setPhotoNoteDraft(photo.note ?? "");
    setPhotoNoteEditor({ photoId: photo.id, taskId });
  }

  function savePhotoNote() {
    if (!photoNoteEditor) return;
    const { photoId, taskId } = photoNoteEditor;
    const latestTask = progressRef.current[taskId];
    if (latestTask) {
      updateTaskPhotos(taskId, latestTask, (photos) => photos.map((photo) => (
        photo.id === photoId ? { ...photo, note: photoNoteDraft.trim() } : photo
      )));
    }
    setPhotoNoteEditor(null);
    setPhotoNoteDraft("");
  }

  async function addFieldPhotoFiles(taskId: string, currentTask: FieldTaskProgress, files: FileList | null) {
    const selectedFiles = Array.from(files ?? []);
    if (!selectedFiles.length) return;

    const nextPhotos: FieldPhoto[] = [];
    for (const file of selectedFiles) {
      try {
        const previewUrl = await fileToFieldPhotoPreview(file);
        nextPhotos.push(createFieldPhoto(file, previewUrl));
      } catch (error) {
        console.warn("Einsatzfoto konnte nicht gespeichert werden.", error);
        nextPhotos.push(createFieldPhoto(file));
      }
    }

    updateTaskPhotos(taskId, currentTask, (photos) => [...photos, ...nextPhotos]);
    if (nextPhotos[0]) openPhotoNoteEditor(taskId, nextPhotos[0]);
    nextPhotos.forEach((photo) => {
      if (photo.id && photo.previewUrl?.startsWith("data:")) {
        void uploadFieldPhotoInBackground(taskId, photo.id, photo.previewUrl, photo.name);
      }
    });
  }

  function updateFieldNote(note: string) {
    onFieldNoteChange(fieldProgressKey(activeJob, activeWorkDate), note);
  }

  async function addPendingReportAttachments(files: FileList | null) {
    const selectedFiles = Array.from(files ?? []);
    if (!selectedFiles.length) return;

    try {
      const attachments = await Promise.all(selectedFiles.map((file) => fileToReportAttachment(file)));
      setPendingReportAttachments((current) => [...current, ...attachments]);
      setPendingAttachmentNotice(`${attachments.length} ${attachments.length === 1 ? "Datei wurde" : "Dateien wurden"} vorbereitet.`);
    } catch (error) {
      setPendingAttachmentNotice(error instanceof Error ? error.message : "Datei konnte nicht angehängt werden.");
    }
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
        showWorkTimeInReport: currentTask.showWorkTimeInReport ?? defaultTimeVisibilityForTask(task),
        note: currentTask.note.trim(),
        photos: currentTask.photos,
        updatedAt: currentTask.updatedAt,
      };
    });

    onComplete(activeJob, results, fieldNote, activeWorkDate, pendingReportAttachments, materialDraft);
    setPendingReportAttachments([]);
    setPendingAttachmentNotice("");
  }

  function closeActiveJobWithStatus(nextStatus: JobRecord["status"]) {
    onClearActiveJob(activeJob, nextStatus, materialDraft);
    setCloseStatusPrompt(false);
  }

  function closeActiveJobKeepingStatus() {
    closeActiveJobWithStatus(activeJob.status);
  }

  return (
    <section className="field-shell">
      <div className="phone-card">
        <p>Mobil vor Ort</p>
        <div className="field-job-picker">
          <strong>Offene Aufträge</strong>
          {fieldOpenJobs.map((job) => {
            const jobObject = objects.find((item) => item.id === job.objectId);
            const dateLabel = jobDateRangeLabel(job) === jobOriginalDateRangeLabel(job) ? jobDateRangeLabel(job) : `Einsatz ${jobDateRangeLabel(job)} · Original ${jobOriginalDateRangeLabel(job)}`;
            return (
              <button
                className={job.id === activeJob.id ? "active" : ""}
                key={job.id}
                onClick={() => onSelectJob(job)}
                type="button"
              >
                <span>
                  <strong>{job.title}</strong>
                  <small>{jobObject?.name ?? "Objekt unbekannt"} · {dateLabel} · {recurringJobHint(job, allJobs) || job.assignedTo}</small>
                </span>
                <Badge value={job.status} />
              </button>
            );
          })}
          {fieldOpenJobs.length === 0 && <span>Keine offenen Aufträge.</span>}
        </div>
        <div className="field-job-picker">
          <button className="field-picker-toggle" onClick={() => setShowCompletedReports((current) => !current)} type="button">
            <span>
              <strong>Abgeschlossene Berichte <small className="inline-count">{editableCompletedReports.length}</small></strong>
            </span>
            {showCompletedReports ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          {showCompletedReports && editableCompletedReports.slice(0, 6).map((report) => {
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
                <Badge value="Bericht" />
              </button>
            );
          })}
          {showCompletedReports && editableCompletedReports.length === 0 && <span>Noch keine abgeschlossenen Berichte.</span>}
        </div>
        <div className="field-job-picker">
          <button className="field-picker-toggle" onClick={() => setShowSentReports((current) => !current)} type="button">
            <span>
              <strong>Gesendete Berichte <small className="inline-count">{sentReports.length}</small></strong>
            </span>
            {showSentReports ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          {showSentReports && sentReports.slice(0, 6).map((report) => {
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
                <Badge value="gesendet" />
              </button>
            );
          })}
          {showSentReports && sentReports.length === 0 && <span>Noch keine gesendeten Berichte.</span>}
        </div>
        <div className="modal-backdrop">
          <section className="modal field-work-modal" role="dialog" aria-modal="true" aria-labelledby="field-work-title">
        <div className="field-active-head">
          <h2 id="field-work-title">{editingReportId ? "Bericht nachbearbeiten" : activeJob.title}</h2>
          <div className="row-actions">
            {activeReport && (
              <IconAction label={`Bericht ${activeReport.title} senden`} onClick={() => onSendReport(activeReport)}>
                <Send size={16} />
              </IconAction>
            )}
            <IconAction label={`Auftrag ${activeJob.title} schließen`} onClick={() => setCloseStatusPrompt(true)}>
              <X size={16} />
            </IconAction>
          </div>
        </div>
        {reportLocked && <div className="warning-line">Dieser Bericht wurde am {activeReport?.sentAt} gesendet und ist für Änderungen gesperrt.</div>}
        <span>{object.name} · {displayAddress(object.address)}</span>
        <div className="field-summary">
          <strong>{activeJob.assignedTo}</strong>
          <small>
            {jobDateRangeLabel(activeJob) === jobOriginalDateRangeLabel(activeJob)
              ? jobDateRangeLabel(activeJob)
              : `Einsatz ${jobDateRangeLabel(activeJob)} · Original ${jobOriginalDateRangeLabel(activeJob)}`}
            {" · "}
            {object.carePackage}
          </small>
        </div>
        {workDates.length > 1 && (
          <div className="field-day-picker" aria-label="Arbeitstag auswählen">
            {workDates.map((date) => {
              const hasReport = reports.some((report) => report.jobId === activeJob.id && normalizeReportDate(report.date) === date);
              return (
                <button
                  className={date === activeWorkDate ? "active" : ""}
                  key={date}
                  onClick={() => onSelectWorkDate(activeJob.id, date)}
                  type="button"
                >
                  <span>{date}</span>
                  <small>{hasReport ? "gespeichert" : "offen"}</small>
                </button>
              );
            })}
          </div>
        )}
        <div className="service-task-list">
          {fieldTasks.map((task, index) => {
            const currentTask = valueForTask(task, index);
            const currentTime = splitWorkMinutes(currentTask.minutes);

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
                    multiple
                    type="file"
                    onChange={(event) => {
                      void addFieldPhotoFiles(task.id, currentTask, event.target.files);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
              <p>{task.description}</p>
              <div className="field-task-inputs">
                <div className="field-time-row">
                  <label>
                    <span>Std.</span>
                    <input
                      aria-label={`Stunden ${task.title}`}
                      disabled={!currentTask.completed || reportLocked}
                      value={currentTask.completed ? currentTime.hours : ""}
                      inputMode="numeric"
                      min="0"
                      type="number"
                      onChange={(event) => updateTask(task.id, { minutes: combineWorkMinutes(event.target.value, currentTime.minutes) }, currentTask)}
                    />
                  </label>
                  <label>
                    <span>Min.</span>
                  <input
                    aria-label={`Minuten ${task.title}`}
                    disabled={!currentTask.completed || reportLocked}
                    value={currentTask.completed ? currentTime.minutes : ""}
                    inputMode="numeric"
                    max="59"
                    min="0"
                    type="number"
                    onChange={(event) => updateTask(task.id, { minutes: combineWorkMinutes(currentTime.hours, event.target.value) }, currentTask)}
                  />
                  </label>
                </div>
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
                <label className="checkbox-line field-time-visibility">
                  <input
                    checked={currentTask.showWorkTimeInReport ?? task.defaultShowWorkTimeInReport ?? true}
                    disabled={reportLocked}
                    onChange={(event) => updateTask(task.id, { showWorkTimeInReport: event.target.checked }, currentTask)}
                    type="checkbox"
                  />
                  <span>Zeit im Bericht anzeigen</span>
                </label>
              </div>
              {currentTask.photos.map((photo, photoIndex) => (
                <div className="captured-photo-card" key={`${task.id}-${photo.id ?? photo.name}-${photoIndex}`}>
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
                    {photo.note?.trim() && <small>{photo.note.trim()}</small>}
                  </div>
                  <div className="row-actions">
                    <button
                      aria-label={`Info zu Foto ${photo.name} bearbeiten`}
                      className="icon-button"
                      disabled={reportLocked || !photo.id}
                      onClick={() => openPhotoNoteEditor(task.id, photo)}
                      type="button"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      aria-label="Foto benutzen"
                      className="icon-button"
                      disabled={reportLocked}
                      onClick={() => updateTaskPhotos(task.id, currentTask, (photos) => photos.map((item, index) => (index === photoIndex ? { ...item, accepted: true } : item)))}
                      type="button"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      aria-label="Neues Foto aufnehmen"
                      className="icon-button"
                      disabled={reportLocked}
                      onClick={() => updateTaskPhotos(task.id, currentTask, (photos) => photos.filter((_, index) => index !== photoIndex))}
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
        {photoNoteEditor && (
          <div className="modal-backdrop">
            <article aria-labelledby="photo-note-title" aria-modal="true" className="modal photo-note-modal" role="dialog">
              <header>
                <div>
                  <p>Foto-Info</p>
                  <h2 id="photo-note-title">Kurze Info zum Bild</h2>
                </div>
                <button aria-label="Foto-Info schließen" onClick={() => { setPhotoNoteEditor(null); setPhotoNoteDraft(""); }} type="button">
                  <X size={18} />
                </button>
              </header>
              <label>
                <span>Info</span>
                <textarea
                  autoFocus
                  onChange={(event) => setPhotoNoteDraft(event.target.value)}
                  placeholder="z.B. linke Terrassentür, Schaden am Rahmen, Wasserfleck..."
                  value={photoNoteDraft}
                />
              </label>
              <div className="modal-actions">
                <button className="ghost-button" onClick={() => { setPhotoNoteEditor(null); setPhotoNoteDraft(""); }} type="button">Überspringen</button>
                <button className="primary-button" onClick={savePhotoNote} type="button">Info speichern</button>
              </div>
            </article>
          </div>
        )}
        <label className="report-comment-editor">
          <span>Material</span>
          <textarea
            disabled={reportLocked}
            value={materialDraft}
            onBlur={(event) => onUpdateJobMaterial(activeJob, event.currentTarget.value)}
            onChange={(event) => setMaterialDraft(event.target.value)}
            placeholder="Verbrauchtes Material oder Besonderheiten"
          />
        </label>
        <label className="report-comment-editor">
          <span>Einsatznotiz / Kommentar</span>
          <textarea
            disabled={reportLocked}
            value={fieldNote}
            onBlur={(event) => updateFieldNote(event.currentTarget.value)}
            onChange={(event) => updateFieldNote(event.target.value)}
            aria-label="Einsatznotiz"
            placeholder="Kommentar für den Bericht"
          />
        </label>
        {activeReport ? (
          <ReportAttachmentEditor disabled={reportLocked} onUpdateReport={onUpdateReport} report={activeReport} />
        ) : (
          <div className="report-attachment-editor">
            <label className="report-comment-editor">
              <span className="inline-icon-label"><Paperclip size={14} /> Dateianhänge</span>
              <input
                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                disabled={reportLocked}
                multiple
                type="file"
                onChange={(event) => {
                  void addPendingReportAttachments(event.target.files);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            {pendingAttachmentNotice && <small>{pendingAttachmentNotice}</small>}
            {pendingReportAttachments.length > 0 && (
              <div className="history-media">
                {pendingReportAttachments.map((attachment) => (
                  <span key={attachment.id}>
                    {attachment.name}
                    <button
                      aria-label={`Anhang ${attachment.name} entfernen`}
                      onClick={() => setPendingReportAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                      type="button"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        <button className="primary-button" disabled={reportLocked} onClick={completeActiveJob} type="button">
          {editingReportId ? "Bericht speichern" : workDates.length > 1 ? (isLastOpenWorkDate ? "Letzten Tag speichern und Auftrag abschließen" : "Tagesbericht zwischenspeichern") : "Einsatz abschließen"}
        </button>
          </section>
        </div>
        {closeStatusPrompt && (
          <div className="modal-backdrop field-status-backdrop">
            <section className="modal field-status-modal" role="dialog" aria-modal="true" aria-labelledby="field-status-title">
              <header>
                <div>
                  <p>Mobil vor Ort</p>
                  <h2 id="field-status-title">Status beim Schließen</h2>
                </div>
                <button aria-label="Statusauswahl schließen" onClick={() => setCloseStatusPrompt(false)} type="button">
                  <X size={18} />
                </button>
              </header>
              <div className="send-preview-grid">
                <button className="status-choice-button active" onClick={closeActiveJobKeepingStatus} type="button">
                  <strong>Aktuellen Status beibehalten</strong>
                  <span>Der Auftrag bleibt auf „{activeJob.status}“.</span>
                </button>
                <button className="status-choice-button" disabled={activeJob.status === "in Arbeit"} onClick={() => closeActiveJobWithStatus("in Arbeit")} type="button">
                  <strong>In Arbeit</strong>
                  <span>Der Auftrag bleibt als laufender Einsatz markiert.</span>
                </button>
                <button className="status-choice-button" disabled={activeJob.status === "geplant"} onClick={() => closeActiveJobWithStatus("geplant")} type="button">
                  <strong>Geplant</strong>
                  <span>Der Auftrag wird wieder in die Planung zurückgelegt.</span>
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </section>
  );
}

function BillingView({
  billing,
  customers,
  jobs,
  objects,
  onCancelInvoice,
  onCollectBillable,
  onDownloadInvoice,
  onMarkExported,
  onMarkInvoiced,
  onMarkPaid,
  onMarkSent,
  onRemoveBillingDraft,
  onResetExport,
  reports,
  services,
}: {
  billing: BillingRecord[];
  customers: CustomerRecord[];
  jobs: JobRecord[];
  objects: ObjectRecord[];
  onCancelInvoice: (item: BillingRecord) => void;
  onCollectBillable: () => void;
  onDownloadInvoice: (item: BillingRecord) => void;
  onMarkExported: (item: BillingRecord) => void;
  onMarkInvoiced: (item: BillingRecord) => void;
  onMarkPaid: (item: BillingRecord) => void;
  onMarkSent: (item: BillingRecord) => void;
  onRemoveBillingDraft: (item: BillingRecord) => void;
  onResetExport: (item: BillingRecord) => void;
  reports: ReportRecord[];
  services: ServiceItem[];
}) {
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);
  const [billingQuery, setBillingQuery] = useState("");
  const [billingStatusFilter, setBillingStatusFilter] = useState("entwurf");
  const billableJobs = billableCompletedJobs(jobs, billing);
  const outgoingBook = billing
    .filter((item) => item.invoicedAt || item.outgoingBookNumber)
    .sort((first, second) => (second.invoiceDate || "").localeCompare(first.invoiceDate || ""));
  const bookedInvoices = billing.filter((item) => ["gebucht", "gesendet", "bezahlt", "überfällig"].includes(effectiveInvoiceStatus(item)));
  const openInvoiceTotal = billing
    .filter((item) => ["gebucht", "gesendet", "überfällig"].includes(effectiveInvoiceStatus(item)))
    .reduce((sum, item) => sum + invoiceTotals(item).gross, 0);
  const previewInvoice = billing.find((item) => item.id === previewInvoiceId) ?? null;
  const previewObject = previewInvoice ? objects.find((entry) => entry.id === previewInvoice.objectId) : undefined;
  const previewCustomer = previewInvoice
    ? customers.find((entry) => entry.id === previewInvoice.customerId || entry.id === previewObject?.ownerCustomerId || entry.name === previewObject?.owner)
    : undefined;
  const previewLines = previewInvoice
    ? previewInvoice.lines?.length
      ? previewInvoice.lines
      : [{
        currency: "SEK",
        id: `${previewInvoice.id}-LINE`,
        kind: "Leistung" as const,
        name: previewInvoice.label,
        quantity: "1",
        taxRate: "0",
        unit: "Position",
        unitPrice: String(decimalValue(previewInvoice.amount)),
      }]
    : [];
  const previewTotals = previewInvoice ? invoiceTotals({ ...previewInvoice, lines: previewLines }) : null;
  const billingStatusOptions = ["alle", "entwurf", "gebucht", "gesendet", "überfällig", "bezahlt", "storniert"];
  const billingStatusCounts = billing.reduce<Record<string, number>>((counts, item) => {
    const status = effectiveInvoiceStatus(item);
    counts[status] = (counts[status] ?? 0) + 1;
    counts.alle = (counts.alle ?? 0) + 1;
    return counts;
  }, { alle: 0 });
  const billingSearchValue = billingQuery.trim().toLowerCase();
  const billingMatchesFilter = (item: BillingRecord) => {
    const object = objects.find((entry) => entry.id === item.objectId);
    const customer = customers.find((entry) => entry.id === item.customerId || entry.id === object?.ownerCustomerId || entry.name === object?.owner);
    const report = reports.find((entry) => entry.id === item.reportId);
    const status = effectiveInvoiceStatus(item);
    if (billingStatusFilter !== "alle" && status !== billingStatusFilter) return false;
    if (!billingSearchValue) return true;
    return [
      item.invoiceNumber,
      item.label,
      item.outgoingBookNumber,
      item.invoiceDate,
      item.dueDate,
      item.serviceDate,
      customer?.name,
      billingCustomerNumber(customer),
      object?.name,
      object?.address,
      report?.title,
      item.lines?.map((line) => line.name).join(" "),
    ].filter(Boolean).join(" ").toLowerCase().includes(billingSearchValue);
  };
  const filteredBilling = billing.filter(billingMatchesFilter);
  const renderBillingRow = (item: BillingRecord) => {
    const object = objects.find((entry) => entry.id === item.objectId);
    const customer = customers.find((entry) => entry.id === item.customerId || entry.id === object?.ownerCustomerId || entry.name === object?.owner);
    const invoiceStatus = effectiveInvoiceStatus(item);
    const totals = invoiceTotals(item);
    const transferRows = vismaTransferRows(item, customer);
    const invoiceLabel = item.invoiceNumber || item.label;
    const reportTitle = reports.find((report) => report.id === item.reportId)?.title ?? "-";

    return (
      <article className="billing-row" key={item.id}>
        <div className="billing-row-main">
          <div className="billing-row-heading">
            <strong>{invoiceLabel}</strong>
            <Badge value={invoiceStatus} />
          </div>
          <div className="billing-meta-grid">
            <span><small>Kunde</small>{customer?.name || object?.owner || "Kunde fehlt"}</span>
            <span><small>Kundennr.</small>{billingCustomerNumber(customer)}</span>
            <span><small>Objekt</small>{object?.name || "Objekt fehlt"}</span>
            <span><small>Rechnungsdatum</small>{item.invoiceDate || "-"}</span>
            <span><small>Fällig</small>{item.dueDate || "-"}</span>
            <span><small>Leistungsdatum</small>{item.serviceDate || "-"}</span>
            <span><small>Ausgangsbuch</small>{item.outgoingBookNumber || "noch nicht gebucht"}</span>
            <span><small>Bericht</small>{reportTitle}</span>
          </div>
          <div className="billing-detail-strip">
            {item.lines && item.lines.length > 0 && (
              <div className="billing-lines-preview">
                <span>Positionen</span>
                {item.lines.map((line) => (
                  <small key={line.id}>{line.kind}: {line.name} · {line.quantity} {line.unit} · {line.unitPrice} {line.currency} · Moms {line.taxRate}%</small>
                ))}
              </div>
            )}
            {transferRows.length > 0 && (
              <div className="accounting-preview">
                <span>Kontierung</span>
                {transferRows.map((row) => (
                  <small key={`${item.id}-${row.account}-${row.name}`}>{row.account} {row.label} · {row.amount} · {row.currency} · Moms {row.moms}</small>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="billing-row-side">
          <div className="billing-total-box">
            <strong>{formatMoney(totals.gross, totals.currency)}</strong>
            <span>{formatMoney(totals.net, totals.currency)} netto</span>
            <span>{formatMoney(totals.tax, totals.currency)} Moms</span>
          </div>
          <div className="row-actions billing-actions">
            <IconAction label={`Rechnungsvorschau ${invoiceLabel} öffnen`} onClick={() => setPreviewInvoiceId(item.id)}><FileText size={16} /></IconAction>
            <IconAction label={`Rechnung ${invoiceLabel} als PDF herunterladen`} onClick={() => onDownloadInvoice(item)}><FileDown size={16} /></IconAction>
            {invoiceStatus === "entwurf" && (
              <>
                <IconAction label={`Rechnung ${invoiceLabel} buchen`} onClick={() => onMarkInvoiced(item)}><Check size={16} /></IconAction>
                <IconAction label={`Rechnung ${invoiceLabel} aus Abrechnung entfernen`} onClick={() => onRemoveBillingDraft(item)}><Trash2 size={16} /></IconAction>
              </>
            )}
            {["gebucht", "gesendet", "überfällig"].includes(invoiceStatus) && item.externalExportStatus !== "gesendet" && (
              <IconAction label={`SIE-Datei für Rechnung ${invoiceLabel} für Spiris erstellen`} onClick={() => onMarkExported(item)}><FileOutput size={16} /></IconAction>
            )}
            {item.externalExportStatus === "gesendet" && (
              <IconAction label={`Spiris-Übergabe ${invoiceLabel} zurücksetzen`} onClick={() => onResetExport(item)}><RotateCcw size={16} /></IconAction>
            )}
            {invoiceStatus === "gebucht" && (
              <IconAction label={`Rechnung ${invoiceLabel} als versendet markieren`} onClick={() => onMarkSent(item)}><Mail size={16} /></IconAction>
            )}
            {["gebucht", "gesendet", "überfällig"].includes(invoiceStatus) && (
              <IconAction label={`Rechnung ${invoiceLabel} als bezahlt markieren`} onClick={() => onMarkPaid(item)}><Euro size={16} /></IconAction>
            )}
            {!["bezahlt", "storniert"].includes(invoiceStatus) && (
              <IconAction label={`Rechnung ${invoiceLabel} stornieren`} onClick={() => onCancelInvoice(item)}><X size={16} /></IconAction>
            )}
          </div>
        </div>
        <footer className="message-meta">
          <span>Spiris: {item.externalExportStatus || "nicht gesendet"} · {item.externalExportedAt ? `übergeben ${formatCreatedAt(item.externalExportedAt)}` : "noch nicht übergeben"} · Ziel: {item.externalExportSystem || "Spiris / Visma Buchhaltung"}</span>
          <span>Preisquelle: {services.length} Leistungsstammdaten verfügbar</span>
        </footer>
      </article>
    );
  };

  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <p>Finanzen</p>
          <h2>Rechnungsprozess</h2>
          <span>Homecare erstellt Rechnung und Ausgangsbuch; Spiris / Visma erhält die vollständigen Buchhaltungsdaten.</span>
        </div>
        <button className="primary-button" onClick={onCollectBillable} type="button">
          <Euro size={16} />
          Erledigte Aufträge übernehmen
        </button>
      </div>
      <div className="billing-summary-grid">
        <div>
          <span>Entwürfe</span>
          <strong>{billing.filter((item) => effectiveInvoiceStatus(item) === "entwurf").length}</strong>
        </div>
        <div>
          <span>Gebucht</span>
          <strong>{bookedInvoices.length}</strong>
        </div>
        <div>
          <span>Offen</span>
          <strong>{formatMoney(openInvoiceTotal, "SEK")}</strong>
        </div>
        <div>
          <span>Spiris Übergabe</span>
          <strong>{billing.filter((item) => item.externalExportStatus === "gesendet").length}/{billing.length}</strong>
        </div>
      </div>
      {billableJobs.length > 0 && (
        <div className="warning-line">{billableJobs.length} erledigte Aufträge sind noch nicht in der Abrechnung.</div>
      )}
      <div className="list-toolbar billing-toolbar">
        <label>
          <span>Rechnungen filtern</span>
          <input
            aria-label="Rechnungen filtern"
            onChange={(event) => setBillingQuery(event.target.value)}
            placeholder="Kunde, Objekt, Rechnung, Bericht..."
            type="search"
            value={billingQuery}
          />
        </label>
        <div>
          <span>Status</span>
          <div className="status-filter-bar billing-status-filter" aria-label="Rechnungen nach Status filtern">
            {billingStatusOptions.map((status) => (
              <button
                className={billingStatusFilter === status ? "active" : ""}
                key={status}
                onClick={() => setBillingStatusFilter(status)}
                type="button"
              >
                {status} ({billingStatusCounts[status] ?? 0})
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="table-list">
        {filteredBilling.map(renderBillingRow)}
        {billing.length === 0 && <p>Noch keine Abrechnungspositionen vorhanden.</p>}
        {billing.length > 0 && filteredBilling.length === 0 && <p>Keine Rechnungen zum aktuellen Filter gefunden.</p>}
      </div>
      <div className="outgoing-book">
        <div className="panel-title compact-title">
          <div>
            <p>Buchhaltung</p>
            <h3>Rechnungsausgangsbuch</h3>
          </div>
        </div>
        <div className="table-list compact-list">
          {outgoingBook.map((item) => {
            const object = objects.find((entry) => entry.id === item.objectId);
            const customer = customers.find((entry) => entry.id === item.customerId || entry.id === object?.ownerCustomerId || entry.name === object?.owner);
            const totals = invoiceTotals(item);

            return (
              <article key={`book-${item.id}`}>
                <div>
                  <strong>{item.outgoingBookNumber || item.invoiceNumber}</strong>
                  <span>{item.invoiceNumber} · {customer?.name || "Kunde fehlt"} · Kundennr. {billingCustomerNumber(customer)}</span>
                  <small>{item.invoiceDate || "-"} · {formatMoney(totals.net, totals.currency)} netto · {formatMoney(totals.tax, totals.currency)} Moms · {formatMoney(totals.gross, totals.currency)} brutto</small>
                </div>
                <Badge value={effectiveInvoiceStatus(item)} />
              </article>
            );
          })}
          {outgoingBook.length === 0 && <p>Noch keine gebuchten Ausgangsrechnungen vorhanden.</p>}
        </div>
      </div>
      {previewInvoice && previewTotals && (
        <div className="modal-backdrop">
          <section className="modal invoice-preview-modal" role="dialog" aria-modal="true" aria-labelledby="invoice-preview-title">
            <header>
              <div>
                <p>Rechnungsvorschau</p>
                <h2 id="invoice-preview-title">Faktura {previewInvoice.invoiceNumber || previewInvoice.id}</h2>
              </div>
              <button aria-label="Rechnungsvorschau schließen" onClick={() => setPreviewInvoiceId(null)} type="button">
                <X size={18} />
              </button>
            </header>
            <div className="invoice-preview-sheet">
              <div className="invoice-preview-top">
                <div>
                  <strong>Kolaretorp Service AB</strong>
                  <span>Faktura</span>
                </div>
                <div>
                  <span>Fakturanr.</span>
                  <strong>{previewInvoice.invoiceNumber || previewInvoice.id}</strong>
                </div>
              </div>
              <div className="invoice-preview-addresses">
                <section>
                  <small>Från</small>
                  <strong>Kolaretorp Service AB</strong>
                </section>
                <section>
                  <small>Kund</small>
                  <strong>{previewCustomer?.name || previewObject?.owner || "Kunde fehlt"}</strong>
                  <span>{displayAddress(previewCustomer?.billingAddress || previewCustomer?.address || previewObject?.billingAddress || previewObject?.address || "")}</span>
                  <span>{previewCustomer?.email || previewObject?.ownerEmail || ""}</span>
                </section>
              </div>
              <div className="invoice-preview-meta">
                <span><small>Fakturadatum</small>{previewInvoice.invoiceDate || new Date().toISOString().slice(0, 10)}</span>
                <span><small>Förfallodatum</small>{previewInvoice.dueDate || addDays(previewInvoice.invoiceDate || new Date().toISOString().slice(0, 10), 30)}</span>
                <span><small>Utfört datum</small>{previewInvoice.serviceDate || "-"}</span>
                <span><small>Objekt</small>{previewObject?.name || "Objekt fehlt"}</span>
              </div>
              <div className="invoice-preview-lines">
                <div className="invoice-preview-line invoice-preview-line-head">
                  <span>Rad</span>
                  <span>Antal</span>
                  <span>Pris</span>
                  <span>Moms</span>
                  <span>Netto</span>
                </div>
                {previewLines.map((line) => (
                  <div className="invoice-preview-line" key={line.id}>
                    <span>{line.name}</span>
                    <span>{line.quantity} {localizedUnit(line.unit, true)}</span>
                    <span>{formatMoney(decimalValue(line.unitPrice), line.currency)}</span>
                    <span>{line.taxRate}%</span>
                    <span>{formatMoney(lineNetAmount(line), line.currency)}</span>
                  </div>
                ))}
              </div>
              <div className="invoice-preview-totals">
                <span><small>Netto</small>{formatMoney(previewTotals.net, previewTotals.currency)}</span>
                {Object.entries(previewTotals.taxByRate).map(([rate, value]) => (
                  <span key={rate}><small>Moms {rate}%</small>{formatMoney(value, previewTotals.currency)}</span>
                ))}
                <strong><small>Brutto</small>{formatMoney(previewTotals.gross, previewTotals.currency)}</strong>
              </div>
            </div>
            <div className="modal-actions">
              <button className="ghost-button" onClick={() => setPreviewInvoiceId(null)} type="button">Schließen</button>
              <button className="primary-button" onClick={() => onDownloadInvoice(previewInvoice)} type="button">
                <FileDown size={16} />
                PDF laden
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function CommunicationView({
  customers,
  messages,
  objects,
  onSendReply,
}: {
  customers: CustomerRecord[];
  messages: PortalMessageRecord[];
  objects: ObjectRecord[];
  onSendReply: (messageId: string, body: string) => Promise<{ error?: string; mailSent: boolean }>;
}) {
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replySendingId, setReplySendingId] = useState("");
  const [messageQuery, setMessageQuery] = useState("");
  const [messageSort, setMessageSort] = useState("newest");
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const messageTimestamp = (message: PortalMessageRecord) => {
    const parsed = new Date(message.sentAt || message.createdAt).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };
  const messageSearchText = (message: PortalMessageRecord) => {
    const customer = customers.find((item) => item.id === message.customerId);
    const object = objects.find((item) => item.id === message.objectId);

    return [
      message.subject,
      message.message,
      message.deliveryStatus,
      message.status,
      customer?.name,
      customer?.email,
      object?.name,
      ...(message.replies ?? []).flatMap((reply) => [reply.body, reply.subject, reply.to, reply.deliveryStatus]),
    ].filter(Boolean).join(" ").toLowerCase();
  };
  const sortedMessages = [...messages]
    .filter((message) => messageSearchText(message).includes(messageQuery.trim().toLowerCase()))
    .sort((first, second) => {
      const firstCustomer = customers.find((item) => item.id === first.customerId)?.name ?? "";
      const secondCustomer = customers.find((item) => item.id === second.customerId)?.name ?? "";
      const firstObject = objects.find((item) => item.id === first.objectId)?.name ?? "";
      const secondObject = objects.find((item) => item.id === second.objectId)?.name ?? "";

      if (messageSort === "oldest") return messageTimestamp(first) - messageTimestamp(second);
      if (messageSort === "customer") return firstCustomer.localeCompare(secondCustomer, "de", { sensitivity: "base" });
      if (messageSort === "object") return firstObject.localeCompare(secondObject, "de", { sensitivity: "base" });
      if (messageSort === "status") return (first.deliveryStatus || first.status).localeCompare(second.deliveryStatus || second.status, "de", { sensitivity: "base" });
      return messageTimestamp(second) - messageTimestamp(first);
    });
  const selectedMessage = selectedMessageId ? messages.find((message) => message.id === selectedMessageId) : undefined;
  const selectedCustomer = selectedMessage ? customers.find((customer) => customer.id === selectedMessage.customerId) : undefined;
  const selectedObject = selectedMessage ? objects.find((object) => object.id === selectedMessage.objectId) : undefined;
  const selectedDeliveryLabel = selectedMessage?.deliveryStatus === "mail-fehler"
    ? "Mailfehler"
    : selectedMessage?.deliveryStatus === "gesendet"
      ? "Mail gesendet"
      : "gespeichert";

  async function sendReply(messageId: string) {
    const body = replyDrafts[messageId]?.trim() ?? "";
    if (!body) return;

    setReplySendingId(messageId);
    const result = await onSendReply(messageId, body);
    setReplySendingId("");
    if (result.mailSent) {
      setReplyDrafts((current) => ({ ...current, [messageId]: "" }));
    }
  }

  return (
    <>
    <section className="panel">
      <div className="panel-title">
        <div>
          <p>Kommunikation</p>
          <h2>Kundenportal-Anfragen</h2>
          <span>Gespeicherte Nachrichten aus dem Kundenportal inklusive Mailstatus.</span>
        </div>
      </div>
      <div className="list-toolbar communication-toolbar">
        <label>
          <span>Nachrichten filtern</span>
          <input
            placeholder="Kunde, Objekt, Betreff, Text..."
            type="search"
            value={messageQuery}
            onChange={(event) => setMessageQuery(event.target.value)}
          />
        </label>
        <label>
          <span>Sortieren</span>
          <select value={messageSort} onChange={(event) => setMessageSort(event.target.value)}>
            <option value="newest">Neueste zuerst</option>
            <option value="oldest">Älteste zuerst</option>
            <option value="customer">Kunde A-Z</option>
            <option value="object">Objekt A-Z</option>
            <option value="status">Status A-Z</option>
          </select>
        </label>
      </div>
      <div className="message-list">
        {sortedMessages.map((message) => {
          const customer = customers.find((item) => item.id === message.customerId);
          const object = objects.find((item) => item.id === message.objectId);
          const sentAt = message.sentAt || message.createdAt;
          const deliveryLabel = message.deliveryStatus === "mail-fehler"
            ? "Mailfehler"
            : message.deliveryStatus === "gesendet"
              ? "Mail gesendet"
              : "gespeichert";
          const customerEmail = customer?.email.trim() || "";

          return (
            <article
              className="message-card clickable-record-row"
              key={message.id}
              onClick={() => setSelectedMessageId(message.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedMessageId(message.id);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="message-main">
                <strong>{message.subject}</strong>
                <span>{customer?.name ?? "Kunde unbekannt"} · {object?.name ?? "Objekt offen"}</span>
              </div>
              <p className="message-text">{message.message}</p>
              <div className="message-side">
                <Badge value={deliveryLabel} />
                <span>Erstellt {formatCreatedAt(message.createdAt)}</span>
                <span>Gesendet {message.deliveryStatus === "gesendet" ? formatCreatedAt(sentAt) : "-"}</span>
                {customerEmail ? (
                  <button
                    className="ghost-button compact"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedMessageId(message.id);
                    }}
                    type="button"
                  >
                    <Mail size={15} />
                    Antworten
                  </button>
                ) : (
                  <span>Keine Kunden-E-Mail hinterlegt.</span>
                )}
              </div>
              {message.deliveryError && (
                <footer className="message-meta">
                  <span>Fehler: {message.deliveryError}</span>
                </footer>
              )}
            </article>
          );
        })}
        {sortedMessages.length === 0 && <p>Noch keine passenden Kundenportal-Anfragen vorhanden.</p>}
      </div>
    </section>
    {selectedMessage && (
      <div className="modal-backdrop">
        <section className="modal send-preview-modal communication-detail-modal" role="dialog" aria-modal="true" aria-labelledby="communication-detail-title">
          <header>
            <div>
              <p>Kommunikation</p>
              <h2 id="communication-detail-title">{selectedMessage.subject}</h2>
            </div>
            <button aria-label="Nachricht schließen" onClick={() => setSelectedMessageId(null)} type="button">
              <X size={18} />
            </button>
          </header>
          <div className="send-preview-grid">
            <div>
              <span>Kunde</span>
              <strong>{selectedCustomer?.name ?? "Kunde unbekannt"}</strong>
            </div>
            <div>
              <span>Objekt</span>
              <strong>{selectedObject?.name ?? "Objekt offen"}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{selectedDeliveryLabel}</strong>
            </div>
            <div>
              <span>Zeit</span>
              <strong>{formatCreatedAt(selectedMessage.sentAt || selectedMessage.createdAt)}</strong>
            </div>
          </div>
          <div className="message-detail-body">
            <strong>{selectedMessage.origin === "office" ? "Nachricht von Kolaretorp" : "Anfrage des Kunden"}</strong>
            <p>{selectedMessage.message}</p>
            {selectedMessage.deliveryError && <small>Fehler: {selectedMessage.deliveryError}</small>}
          </div>
          {selectedMessage.replies && selectedMessage.replies.length > 0 && (
            <div className="message-replies">
              <strong>Antworten</strong>
              {selectedMessage.replies.map((reply) => (
                <section key={reply.id}>
                  <span>{reply.deliveryStatus === "gesendet" ? "Gesendet" : "Mailfehler"} an {reply.to} · {formatCreatedAt(reply.sentAt)}</span>
                  <p>{reply.body}</p>
                  {reply.deliveryError && <small>{reply.deliveryError}</small>}
                </section>
              ))}
            </div>
          )}
          {selectedCustomer?.email ? (
            <div className="message-reply-form">
              <label>
                <span>Antwort an {selectedCustomer.email}</span>
                <textarea
                  placeholder="Antwort schreiben..."
                  value={replyDrafts[selectedMessage.id] ?? ""}
                  onChange={(event) => setReplyDrafts((current) => ({ ...current, [selectedMessage.id]: event.target.value }))}
                />
              </label>
              <div className="message-actions">
                <button className="ghost-button" onClick={() => setSelectedMessageId(null)} type="button">Schließen</button>
                <button className="primary-button" disabled={!(replyDrafts[selectedMessage.id] ?? "").trim() || replySendingId === selectedMessage.id} onClick={() => void sendReply(selectedMessage.id)} type="button">
                  <Send size={16} />
                  {replySendingId === selectedMessage.id ? "Sende..." : "Antwort senden"}
                </button>
              </div>
            </div>
          ) : (
            <p className="empty-list-note">Beim Kunden ist keine E-Mail-Adresse hinterlegt.</p>
          )}
        </section>
      </div>
    )}
    </>
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
  onSendMessage: (customer: CustomerRecord, objectId: string, subject: string, message: string) => Promise<{ error?: string; mailSent: boolean }>;
  onUpdateCustomer: (customerId: string, updates: Pick<CustomerRecord, "email" | "phone" | "phone2">) => void;
  reports: ReportRecord[];
  setCustomerId: (id: string) => void;
}) {
  const portalCustomers = customers.filter((customer) => !customer.archived && customer.portalStatus !== "gesperrt");
  const customer = customers.find((item) => item.id === customerId);
  const portalFirstName = customer ? firstNameFromText(customer.name) : "";
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [selectedObjectId, setSelectedObjectId] = useState("");
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [portalProfileEmail, setPortalProfileEmail] = useState("");
  const [portalProfilePhone, setPortalProfilePhone] = useState("");
  const [portalProfilePhone2, setPortalProfilePhone2] = useState("");
  const [portalNotice, setPortalNotice] = useState("");
  const [selectedPortalObjectDetailId, setSelectedPortalObjectDetailId] = useState("");
  const [expandedPortalSeriesIds, setExpandedPortalSeriesIds] = useState<string[]>([]);
  const [selectedPortalReportId, setSelectedPortalReportId] = useState("");
  const [selectedPortalMessageId, setSelectedPortalMessageId] = useState("");

  const customerObjects = customer
    ? objects.filter((object) => !object.archived && (customer.objects.includes(object.id) || object.ownerCustomerId === customer.id))
    : [];
  const currentObjectId = selectedObjectId && customerObjects.some((object) => object.id === selectedObjectId)
    ? selectedObjectId
    : customerObjects[0]?.id ?? "";
  const selectedPortalObjectDetail = customerObjects.find((object) => object.id === selectedPortalObjectDetailId);
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
        return occurrences.some((occurrence) => !["offerte", "erledigt", "abgerechnet", "storniert"].includes(occurrence.status));
      }
      return !["offerte", "erledigt", "abgerechnet", "storniert"].includes(job.status);
    })
    .sort((first, second) => {
      const firstOccurrences = portalOccurrenceGroups[first.id] ?? [];
      const secondOccurrences = portalOccurrenceGroups[second.id] ?? [];
      const groupDiff = jobSortGroup(first, firstOccurrences) - jobSortGroup(second, secondOccurrences);
      return groupDiff || nextRelevantJobDate(first, firstOccurrences) - nextRelevantJobDate(second, secondOccurrences);
    });
  const portalMessages = messages.filter((message) => message.customerId === customer?.id);
  const selectedPortalMessage = portalMessages.find((message) => message.id === selectedPortalMessageId);
  const selectedPortalMessageObject = selectedPortalMessage ? objects.find((object) => object.id === selectedPortalMessage.objectId) : undefined;
  const selectedPortalMessageStatus = selectedPortalMessage?.deliveryStatus === "gesendet"
    ? "gesendet"
    : selectedPortalMessage?.deliveryStatus === "mail-fehler"
      ? "Mailfehler"
      : selectedPortalMessage?.status ?? "gespeichert";
  const portalBilling = billing.filter((item) => customerObjects.some((object) => object.id === item.objectId));

  useEffect(() => {
    if (!customer) return;
    setPortalProfileEmail(customer.email);
    setPortalProfilePhone(contactFieldValue(customer.phone));
    setPortalProfilePhone2(contactFieldValue(customer.phone2));
  }, [customer?.email, customer?.id, customer?.phone, customer?.phone2]);

  function portalObjectNextVisit(objectId: string) {
    const nextJob = sortedByExecutionDate(jobs.filter((job) => (
      job.objectId === objectId
      && !isSeriesMaster(job)
      && !["offerte", "erledigt", "abgerechnet", "storniert"].includes(job.status)
    )))[0];

    return nextJob ? jobDateRangeLabel(nextJob) : "noch nichts geplant";
  }

  function togglePortalSeries(id: string) {
    setExpandedPortalSeriesIds((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  }

  function openPortalObjectDetail(objectId: string) {
    setSelectedObjectId(objectId);
    setSelectedPortalObjectDetailId(objectId);
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
    setPortalProfilePhone(contactFieldValue(matchedCustomer.phone));
    setPortalProfilePhone2(contactFieldValue(matchedCustomer.phone2));
    onRecordLogin(matchedCustomer.id, matchedCustomer.portalLoginEmail || matchedCustomer.email, window.navigator.userAgent);
    setPortalNotice("");
  }

  async function submitMessage() {
    if (!customer || !currentObjectId || !messageBody.trim()) return;
    const result = await onSendMessage(customer, currentObjectId, messageSubject.trim() || "Leistungsanfrage aus dem Kundenportal", messageBody);
    setMessageSubject("");
    setMessageBody("");
    setPortalNotice(result.mailSent
      ? "Deine Leistungsanfrage wurde gesendet."
      : `Deine Leistungsanfrage wurde gespeichert, aber die E-Mail konnte nicht gesendet werden: ${result.error}`);
  }

  function savePortalProfile() {
    if (!customer) return;
    onUpdateCustomer(customer.id, {
      email: portalProfileEmail || customer.email,
      phone: portalProfilePhone || customer.phone,
      phone2: portalProfilePhone2,
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
          <h2>Välkommen im Kundenportal{portalFirstName ? `, ${portalFirstName}!` : "!"}</h2>
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
              <input value={portalProfilePhone} onChange={(event) => setPortalProfilePhone(event.target.value)} />
            </div>
            <div>
              <span>Telefon 2</span>
              <input value={portalProfilePhone2} onChange={(event) => setPortalProfilePhone2(event.target.value)} />
            </div>
            <div>
              <span>Adresse / Rechnungsadresse</span>
              <strong>{displayAddress(customer.address)}</strong>
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
              <h2>Deine Objekte</h2>
            </div>
          </div>
          <div className="portal-object-list">
            {customerObjects.map((object) => (
              <button className={currentObjectId === object.id ? "active" : ""} key={object.id} onClick={() => openPortalObjectDetail(object.id)} type="button">
                <ObjectThumbnail object={object} />
                <span>
                  <strong>{object.name}</strong>
                  <small>{displayAddress(object.address)}</small>
                </span>
                <Badge value={object.status} />
              </button>
            ))}
            {customerObjects.length === 0 && <p>Dir sind noch keine Objekte zugeordnet.</p>}
          </div>
          {selectedPortalObjectDetail && (
            <article className="portal-object-detail">
              <div className="history-detail-head">
                <div>
                  <h3>{selectedPortalObjectDetail.name}</h3>
                  <span>{displayAddress(selectedPortalObjectDetail.address)}</span>
                </div>
                <button aria-label="Objektstammdaten schließen" className="icon-button" onClick={() => setSelectedPortalObjectDetailId("")} type="button">
                  <X size={16} />
                </button>
              </div>
              <div className="portal-object-detail-grid">
                <ObjectThumbnail object={selectedPortalObjectDetail} />
                <dl>
                  <div><dt>Status</dt><dd>{selectedPortalObjectDetail.status}</dd></div>
                  <div><dt>Betreuungspaket</dt><dd>{selectedPortalObjectDetail.carePackage}</dd></div>
                  <div><dt>Region</dt><dd>{selectedPortalObjectDetail.region}</dd></div>
                  <div><dt>Wohnfläche</dt><dd>{selectedPortalObjectDetail.sizeSqm} m²</dd></div>
                  <div><dt>Grundstück</dt><dd>{selectedPortalObjectDetail.plotSqm} m²</dd></div>
                  <div><dt>Räume</dt><dd>{selectedPortalObjectDetail.rooms} Zimmer · {selectedPortalObjectDetail.beds} Betten · {selectedPortalObjectDetail.bathrooms} Bad</dd></div>
                  <div><dt>Baujahr</dt><dd>{selectedPortalObjectDetail.buildYear || "-"}</dd></div>
                  <div><dt>Nächster Besuch</dt><dd>{portalObjectNextVisit(selectedPortalObjectDetail.id)}</dd></div>
                </dl>
              </div>
              <div className="portal-object-detail-sections">
                <section>
                  <strong>Zugang</strong>
                  <span>{selectedPortalObjectDetail.access.keySafe || "-"}</span>
                  <span>Alarm: {selectedPortalObjectDetail.access.alarm || "-"}</span>
                  <span>Parken: {selectedPortalObjectDetail.access.parking || "-"}</span>
                  {selectedPortalObjectDetail.access.notes && <span>{selectedPortalObjectDetail.access.notes}</span>}
                </section>
                <section>
                  <strong>Technik</strong>
                  <span>Heizung: {selectedPortalObjectDetail.utilities.heating || "-"}</span>
                  <span>Wasser: {selectedPortalObjectDetail.utilities.water || "-"}</span>
                  <span>Abwasser: {selectedPortalObjectDetail.utilities.septic || "-"}</span>
                  <span>Internet: {selectedPortalObjectDetail.utilities.internet || "-"}</span>
                </section>
                {selectedPortalObjectDetail.equipment.length > 0 && (
                  <section>
                    <strong>Ausstattung</strong>
                    <span>{selectedPortalObjectDetail.equipment.join(" · ")}</span>
                  </section>
                )}
              </div>
            </article>
          )}
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
              const openOccurrences = occurrences.filter((occurrence) => !["offerte", "erledigt", "abgerechnet", "storniert"].includes(occurrence.status));
              const isRecurring = isSeriesMaster(job);
              const summary = isRecurring ? seriesSummary(job, occurrences, reports) : null;
              const isExpanded = expandedPortalSeriesIds.includes(job.id);

              return (
                <article className="portal-job-item" key={job.id}>
                  <div>
                    <strong>{job.title}</strong>
                    <span>{objects.find((object) => object.id === job.objectId)?.name ?? "Objekt"} · {isRecurring && summary ? summary.rhythm : jobDateRangeLabel(job)}</span>
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
              <h2>Nachricht an Kolaretorp Service AB</h2>
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
              <div className="row-actions">
                <IconAction label={`PDF für ${selectedPortalReport.title} herunterladen`} onClick={() => void downloadCustomerReportPdf(selectedPortalReport, selectedPortalReportObject, selectedPortalReportJob, customer)}><FileDown size={16} /></IconAction>
                <IconAction label={`Bericht ${selectedPortalReport.title} schließen`} onClick={() => setSelectedPortalReportId("")}><X size={16} /></IconAction>
              </div>
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
              <article
                className="portal-message-item clickable-record-row"
                key={message.id}
                onClick={() => setSelectedPortalMessageId(message.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedPortalMessageId(message.id);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div>
                  <strong>{message.subject}</strong>
                  <span>{objects.find((object) => object.id === message.objectId)?.name ?? "Objekt"} · {formatCreatedAt(message.sentAt || message.createdAt)}</span>
                  <p>{message.message}</p>
                  {message.deliveryError && <small>Mailfehler: {message.deliveryError}</small>}
                  {message.replies && message.replies.length > 0 && (
                    <div className="portal-message-replies">
                      {message.replies
                        .filter((reply) => reply.deliveryStatus === "gesendet")
                        .map((reply) => (
                          <section key={reply.id}>
                            <span>Antwort von Kolaretorp · {formatCreatedAt(reply.sentAt)}</span>
                            <p>{reply.body}</p>
                          </section>
                        ))}
                    </div>
                  )}
                </div>
                <Badge value={message.deliveryStatus === "gesendet" ? "gesendet" : message.deliveryStatus === "mail-fehler" ? "Mailfehler" : message.status} />
              </article>
            ))}
            {portalMessages.length === 0 && <p>Du hast noch keine Nachrichten gesendet.</p>}
          </div>
        </section>
      </div>
      {selectedPortalMessage && (
        <div className="modal-backdrop">
          <section className="modal send-preview-modal communication-detail-modal portal-message-modal" role="dialog" aria-modal="true" aria-labelledby="portal-message-detail-title">
            <header>
              <div>
                <p>Kommunikation</p>
                <h2 id="portal-message-detail-title">{selectedPortalMessage.subject}</h2>
              </div>
              <button aria-label="Nachricht schließen" onClick={() => setSelectedPortalMessageId("")} type="button">
                <X size={18} />
              </button>
            </header>
            <div className="send-preview-grid">
              <div>
                <span>Objekt</span>
                <strong>{selectedPortalMessageObject?.name ?? "Objekt"}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{selectedPortalMessageStatus}</strong>
              </div>
              <div>
                <span>Erstellt</span>
                <strong>{formatCreatedAt(selectedPortalMessage.createdAt)}</strong>
              </div>
              <div>
                <span>Gesendet</span>
                <strong>{selectedPortalMessage.deliveryStatus === "gesendet" ? formatCreatedAt(selectedPortalMessage.sentAt || selectedPortalMessage.createdAt) : "-"}</strong>
              </div>
            </div>
            <div className="message-detail-body">
              <strong>{selectedPortalMessage.origin === "office" ? "Nachricht von Kolaretorp" : "Deine Nachricht"}</strong>
              <p>{selectedPortalMessage.message}</p>
              {selectedPortalMessage.deliveryError && <small>Mailfehler: {selectedPortalMessage.deliveryError}</small>}
            </div>
            {selectedPortalMessage.replies && selectedPortalMessage.replies.filter((reply) => reply.deliveryStatus === "gesendet").length > 0 && (
              <div className="message-replies">
                <strong>Antworten</strong>
                {selectedPortalMessage.replies
                  .filter((reply) => reply.deliveryStatus === "gesendet")
                  .map((reply) => (
                    <section key={reply.id}>
                      <span>Antwort von Kolaretorp · {formatCreatedAt(reply.sentAt)}</span>
                      <p>{reply.body}</p>
                    </section>
                  ))}
              </div>
            )}
            <div className="message-actions">
              <button className="ghost-button" onClick={() => setSelectedPortalMessageId("")} type="button">Schließen</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function MasterDataView({
  companySettings,
  customers,
  dailyMailSettings,
  dailyMailSending,
  materials,
  objects,
  onSendDailyMail,
  personnel,
  resources,
  services,
  setPersonnel,
  onPersistResources,
  setResources,
  setServices,
  setMaterials,
  setCompanySettings,
  setDailyMailSettings,
  packages,
  setPackages,
  translate,
}: {
  companySettings: CompanySettings;
  customers: CustomerRecord[];
  dailyMailSettings: DailyMailSettings;
  dailyMailSending: boolean;
  materials: MaterialItem[];
  objects: ObjectRecord[];
  onSendDailyMail: () => Promise<void>;
  personnel: PersonnelRecord[];
  resources: ResourceRecord[];
  services: ServiceItem[];
  setPersonnel: (personnel: PersonnelRecord[]) => void;
  onPersistResources: (resources: ResourceRecord[]) => void;
  setResources: (resources: ResourceRecord[]) => void;
  setServices: (services: ServiceItem[]) => void;
  setMaterials: (materials: MaterialItem[]) => void;
  setCompanySettings: (settings: CompanySettings) => void;
  setDailyMailSettings: (settings: DailyMailSettings) => void;
  packages: ServicePackage[];
  setPackages: (packages: ServicePackage[]) => void;
  translate: (value: string) => string;
}) {
  const tt = translate;
  const [masterDataTab, setMasterDataTab] = useState<"company" | "personal" | "resources" | "services" | "materials" | "mail" | "backups">("company");
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [editingLogEntryId, setEditingLogEntryId] = useState<string | null>(null);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [personEditorOpen, setPersonEditorOpen] = useState(false);
  const [resourceEditorOpen, setResourceEditorOpen] = useState(false);
  const [personViewMode, setPersonViewMode] = useState<"cards" | "list">("list");
  const [resourceViewMode, setResourceViewMode] = useState<"cards" | "list">("list");
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [archiveNotice, setArchiveNotice] = useState("");
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupError, setBackupError] = useState("");
  const [backups, setBackups] = useState<AppBackupRecord[]>([]);
  const [personForm, setPersonForm] = useState({
    createdAt: "",
    email: "",
    firstName: "",
    language: "DE",
    lastName: "",
    notes: "",
    personnelNumber: "",
    phone: "",
    role: "",
    status: "aktiv" as PersonnelRecord["status"],
  });
  const [resourceForm, setResourceForm] = useState({
    identifier: "",
    location: "",
    logbookYear: String(new Date().getFullYear()),
    mediaItems: [] as MediaItem[],
    name: "",
    notes: "",
    odometerYearEnd: "",
    odometerYearStart: "",
    responsiblePersonId: "",
    status: "aktiv",
    type: "Fahrzeug" as ResourceRecord["type"],
  });
  const [logbookForm, setLogbookForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    driverId: "",
    endAddress: "",
    endOdometer: "",
    fuelOrCharge: "",
    fuelReceiptPhoto: undefined as VehicleFuelReceiptPhoto | undefined,
    kilometers: "",
    notes: "",
    purpose: "",
    startAddress: "",
    startOdometer: "",
    tripType: "Dienstfahrt" as VehicleLogEntry["tripType"],
    visited: "",
    waypoints: [] as VehicleWaypoint[],
    odometerPhotos: [] as VehicleOdometerPhoto[],
  });
  const [mailSettingsForm, setMailSettingsForm] = useState(dailyMailSettings);
  const [companySettingsForm, setCompanySettingsForm] = useState(companySettings);
  const [serviceForm, setServiceForm] = useState({
    accountingAccount: "3041",
    name: "",
    category: "",
    unit: "",
    price: "",
    currency: "SEK",
    taxRate: "25",
    showWorkTimeInReports: true,
    description: "",
    checklist: [] as ServiceChecklistItem[],
  });
  const [materialForm, setMaterialForm] = useState({
    accountingAccount: "3058",
    category: "",
    currency: "SEK",
    description: "",
    name: "",
    price: "",
    taxRate: "25",
    unit: "Stück",
  });
  const [serviceChecklistForm, setServiceChecklistForm] = useState({
    title: "",
    note: "",
    defaultMinutes: "",
  });
  const [editingServiceChecklistItemId, setEditingServiceChecklistItemId] = useState<string | null>(null);
  const [packageForm, setPackageForm] = useState({
    name: "",
    price: "",
    description: "",
    serviceIds: [] as string[],
  });
  const activeServices = services.filter((service) => !service.archived);
  const archivedServices = services.filter((service) => service.archived);
  const activeMaterials = materials.filter((material) => !material.archived);
  const archivedMaterials = materials.filter((material) => material.archived);
  const activePackages = packages.filter((servicePackage) => !servicePackage.archived);
  const archivedPackages = packages.filter((servicePackage) => servicePackage.archived);
  const activePersonnel = personnel.filter((person) => !person.archived);
  const archivedPersonnel = personnel.filter((person) => person.archived);
  const activeResources = resources.filter((resource) => !resource.archived);
  const archivedResources = resources.filter((resource) => resource.archived);
  const selectedResource = resources.find((resource) => resource.id === editingResourceId);
  const selectedResourceLogbook = selectedResource?.type === "Fahrzeug" ? selectedResource.logbook : [];
  const resourceStatusOptions = uniqueSortedValues(resources.map((resource) => resource.status), ["aktiv", "Wartung", "reserviert", "defekt"]);
  const categories = Array.from(new Set(activeServices.map((service) => service.category).filter(Boolean)))
    .sort((first, second) => first.localeCompare(second, "de"));
  const serviceUnits = Array.from(new Set(activeServices.map((service) => service.unit).filter(Boolean)))
    .sort((first, second) => first.localeCompare(second, "de"));
  const materialCategories = uniqueSortedValues(materials.map((material) => material.category), ["Verbrauchsmaterial", "Reinigung", "Garten", "Ersatzteil"]);
  const materialUnits = uniqueSortedValues(materials.map((material) => material.unit), ["Stück", "Liter", "Meter", "kg", "Rolle"]);
  const groupedServices = categories.map((category) => ({
    category,
    services: activeServices
      .filter((service) => service.category === category)
      .sort((first, second) => first.name.localeCompare(second.name, "de")),
  }));
  const selectedPackageServices = packageForm.serviceIds
    .map((id) => activeServices.find((service) => service.id === id))
    .filter(Boolean) as ServiceItem[];
  const logbookStats = selectedResourceLogbook.reduce((stats, entry) => {
    const kilometers = Number(entry.kilometers) || 0;
    return {
      businessKm: stats.businessKm + (entry.tripType === "Dienstfahrt" ? kilometers : 0),
      privateKm: stats.privateKm + (entry.tripType === "Privatfahrt" ? kilometers : 0),
      privateTrips: stats.privateTrips + (entry.tripType === "Privatfahrt" ? 1 : 0),
      totalKm: stats.totalKm + kilometers,
    };
  }, { businessKm: 0, privateKm: 0, privateTrips: 0, totalKm: 0 });
  const logbookAddressOptions = uniqueSortedValues(
    resources.flatMap((resource) => resource.logbook.flatMap((entry) => [
      entry.startAddress,
      entry.endAddress,
      ...(entry.waypoints ?? []).map((waypoint) => waypoint.address),
    ])),
    objects.map((object) => object.address),
  );
  const logbookPurposeOptions = uniqueSortedValues(
    resources.flatMap((resource) => resource.logbook.map((entry) => entry.purpose)),
    ["Kundenauftrag", "Material holen", "Besichtigung", "Service / Wartung", "Privatfahrt"],
  );

  useEffect(() => {
    setCompanySettingsForm(companySettings);
  }, [companySettings]);

  useEffect(() => {
    setMailSettingsForm(dailyMailSettings);
  }, [dailyMailSettings]);

  useEffect(() => {
    if (masterDataTab !== "backups") return;
    void refreshBackups();
  }, [masterDataTab]);

  async function refreshBackups() {
    setBackupError("");
    setBackupBusy(true);
    try {
      setBackups(await loadAppBackups());
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : "Backups konnten nicht geladen werden.");
    } finally {
      setBackupBusy(false);
    }
  }

  async function handleCreateBackup() {
    setBackupError("");
    setBackupBusy(true);
    try {
      await createAppBackup("manual-master-data");
      const nextBackups = await loadAppBackups();
      setBackups(nextBackups);
      setArchiveNotice("Backup wurde erstellt.");
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : "Backup konnte nicht erstellt werden.");
    } finally {
      setBackupBusy(false);
    }
  }

  async function handleRestoreBackup(backup: AppBackupRecord) {
    const confirmed = window.confirm(`Backup vom ${formatCreatedAtWithSeconds(backup.createdAt)} wiederherstellen? Der aktuelle Online-Stand wird dadurch ersetzt.`);
    if (!confirmed) return;

    setBackupError("");
    setBackupBusy(true);
    try {
      await restoreAppBackup(backup.id);
      Object.values(storageKeys).forEach((key) => window.localStorage.removeItem(key));
      window.location.reload();
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : "Backup konnte nicht wiederhergestellt werden.");
      setBackupBusy(false);
    }
  }

  function personName(personId: string) {
    const person = personnel.find((item) => item.id === personId);
    return person ? `${person.firstName} ${person.lastName}`.trim() : "Nicht zugeordnet";
  }

  function resetPersonForm() {
    setEditingPersonId(null);
    setPersonEditorOpen(false);
    setPersonForm({ createdAt: "", email: "", firstName: "", language: "DE", lastName: "", notes: "", personnelNumber: "", phone: "", role: "", status: "aktiv" });
  }

  function openCreatePerson() {
    resetPersonForm();
    setPersonEditorOpen(true);
  }

  function editPerson(person: PersonnelRecord) {
    setEditingPersonId(person.id);
    setPersonEditorOpen(true);
    setPersonForm({
      createdAt: person.createdAt || "",
      email: person.email,
      firstName: person.firstName,
      language: person.language,
      lastName: person.lastName,
      notes: person.notes,
      personnelNumber: normalizeReadableNumber(person.personnelNumber),
      phone: person.phone,
      role: person.role,
      status: person.status,
    });
    setMasterDataTab("personal");
  }

  function savePerson() {
    if (!personForm.firstName.trim() || !personForm.lastName.trim()) {
      setArchiveNotice("Bitte Vorname und Nachname beim Personal erfassen.");
      return;
    }

    const existingPerson = personnel.find((person) => person.id === editingPersonId);
    const generatedPersonnelNumber = createReadableNumber(personnel.filter((person) => person !== existingPerson).map((person) => person.personnelNumber));
    const saved: PersonnelRecord = {
      id: editingPersonId ?? createEntityId("PER"),
      createdAt: existingPerson?.createdAt || personForm.createdAt || new Date().toISOString(),
      email: personForm.email.trim(),
      firstName: personForm.firstName.trim(),
      language: personForm.language.trim() || "DE",
      lastName: personForm.lastName.trim(),
      notes: personForm.notes.trim(),
      personnelNumber: normalizeReadableNumber(personForm.personnelNumber) || normalizeReadableNumber(existingPerson?.personnelNumber) || generatedPersonnelNumber,
      phone: personForm.phone.trim(),
      role: personForm.role.trim() || "Mitarbeit",
      status: personForm.status,
      archived: existingPerson?.archived ?? false,
    };

    setPersonnel(editingPersonId ? personnel.map((person) => (person.id === editingPersonId ? saved : person)) : [saved, ...personnel]);
    setArchiveNotice(`Personal "${saved.firstName} ${saved.lastName}" wurde gespeichert.`);
    resetPersonForm();
  }

  function archivePerson(person: PersonnelRecord) {
    setPersonnel(personnel.map((item) => (item.id === person.id ? { ...item, archived: true } : item)));
    setArchiveNotice(`Personal "${person.firstName} ${person.lastName}" wurde archiviert.`);
    if (editingPersonId === person.id) resetPersonForm();
  }

  function restorePerson(person: PersonnelRecord) {
    setPersonnel(personnel.map((item) => (item.id === person.id ? { ...item, archived: false } : item)));
    setArchiveNotice(`Personal "${person.firstName} ${person.lastName}" wurde wieder aktiviert.`);
  }

  function deleteArchivedPerson(person: PersonnelRecord) {
    if (!person.archived) return;
    setPersonnel(personnel.filter((item) => item.id !== person.id));
    setResources(resources.map((resource) => resource.responsiblePersonId === person.id ? { ...resource, responsiblePersonId: "" } : resource));
    setArchiveNotice(`Archiviertes Personal "${person.firstName} ${person.lastName}" wurde endgültig gelöscht.`);
  }

  function resetResourceForm() {
    setEditingResourceId(null);
    setEditingLogEntryId(null);
    setResourceEditorOpen(false);
    setResourceForm({
      identifier: "",
      location: "",
      logbookYear: String(new Date().getFullYear()),
      mediaItems: [],
      name: "",
      notes: "",
      odometerYearEnd: "",
      odometerYearStart: "",
      responsiblePersonId: "",
      status: "aktiv",
      type: "Fahrzeug",
    });
    resetLogbookForm();
  }

  function openCreateResource() {
    resetResourceForm();
    setResourceEditorOpen(true);
  }

  function editResource(resource: ResourceRecord) {
    setEditingResourceId(resource.id);
    setResourceEditorOpen(true);
    setResourceForm({
      identifier: resource.identifier,
      location: resource.location,
      logbookYear: resource.logbookYear || String(new Date().getFullYear()),
      mediaItems: resource.media ?? [],
      name: resource.name,
      notes: resource.notes,
      odometerYearEnd: resource.odometerYearEnd,
      odometerYearStart: resource.odometerYearStart,
      responsiblePersonId: resource.responsiblePersonId,
      status: resource.status,
      type: resource.type,
    });
    setEditingLogEntryId(null);
    resetLogbookForm();
    setMasterDataTab("resources");
  }

  function saveResource() {
    if (!resourceForm.name.trim() || !resourceForm.type.trim()) {
      setArchiveNotice("Bitte Ressourcenname und Typ erfassen.");
      return;
    }

    const existingResource = resources.find((resource) => resource.id === editingResourceId);
    const saved: ResourceRecord = {
      id: editingResourceId ?? `RES-${Date.now()}`,
      identifier: resourceForm.identifier.trim(),
      location: resourceForm.location.trim(),
      logbook: existingResource?.logbook ?? [],
      logbookYear: resourceForm.logbookYear.trim() || String(new Date().getFullYear()),
      media: resourceForm.mediaItems,
      name: resourceForm.name.trim(),
      notes: resourceForm.notes.trim(),
      odometerYearEnd: resourceForm.odometerYearEnd.trim(),
      odometerYearStart: resourceForm.odometerYearStart.trim(),
      responsiblePersonId: resourceForm.responsiblePersonId,
      status: resourceForm.status.trim() || "aktiv",
      type: resourceForm.type,
      archived: existingResource?.archived ?? false,
    };

    const nextResources = editingResourceId ? resources.map((resource) => (resource.id === editingResourceId ? saved : resource)) : [saved, ...resources];
    setResources(nextResources);
    onPersistResources(nextResources);
    setEditingResourceId(saved.id);
    setResourceEditorOpen(true);
    setArchiveNotice(`Ressource "${saved.name}" wurde gespeichert.`);
  }

  function archiveResource(resource: ResourceRecord) {
    const nextResources = resources.map((item) => (item.id === resource.id ? { ...item, archived: true } : item));
    setResources(nextResources);
    onPersistResources(nextResources);
    setArchiveNotice(`Ressource "${resource.name}" wurde archiviert.`);
    if (editingResourceId === resource.id) resetResourceForm();
  }

  function restoreResource(resource: ResourceRecord) {
    const nextResources = resources.map((item) => (item.id === resource.id ? { ...item, archived: false } : item));
    setResources(nextResources);
    onPersistResources(nextResources);
    setArchiveNotice(`Ressource "${resource.name}" wurde wieder aktiviert.`);
  }

  function deleteArchivedResource(resource: ResourceRecord) {
    if (!resource.archived) return;
    const nextResources = resources.filter((item) => item.id !== resource.id);
    setResources(nextResources);
    onPersistResources(nextResources);
    setArchiveNotice(`Archivierte Ressource "${resource.name}" wurde endgültig gelöscht.`);
  }

  async function addResourcePhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    const currentImages = resourceForm.mediaItems.filter((item) => item.type === "Bild");
    const added = await Promise.all(Array.from(files).map(async (file, index) => {
      const previewUrl = await fileToImagePreview(file, 900, 0.62);
      const uploaded = previewUrl ? await uploadMediaFile(await dataUrlToBlob(previewUrl), "resource-photos", file.name) : null;
      return {
        description: "",
        id: `RES-MED-${resourceForm.identifier.trim() || resourceForm.name.trim() || "neu"}-${file.name}-${currentImages.length + index + 1}`,
        isPrimary: currentImages.length === 0 && index === 0,
        name: file.name,
        previewUrl: uploaded?.url ?? previewUrl,
        source: "Kamera" as const,
        storagePath: uploaded?.path,
        type: "Bild" as const,
      };
    }));

    setResourceForm({
      ...resourceForm,
      mediaItems: [...resourceForm.mediaItems, ...added],
    });
  }

  function updateResourcePhotoDescription(id: string, description: string) {
    setResourceForm({
      ...resourceForm,
      mediaItems: resourceForm.mediaItems.map((item) => (item.id === id ? { ...item, description } : item)),
    });
  }

  function setResourcePrimaryPhoto(id: string) {
    setResourceForm({
      ...resourceForm,
      mediaItems: resourceForm.mediaItems.map((item) => ({ ...item, isPrimary: item.id === id && item.type === "Bild" })),
    });
  }

  function removeResourcePhoto(id: string) {
    const removed = resourceForm.mediaItems.find((item) => item.id === id);
    const remainingItems = resourceForm.mediaItems.filter((item) => item.id !== id);
    const nextPrimaryImageId = removed?.isPrimary && !remainingItems.some((item) => item.type === "Bild" && item.isPrimary)
      ? remainingItems.find((item) => item.type === "Bild")?.id
      : undefined;

    setResourceForm({
      ...resourceForm,
      mediaItems: remainingItems.map((item) => nextPrimaryImageId ? { ...item, isPrimary: item.id === nextPrimaryImageId } : item),
    });
  }

  function latestSelectedLogbookEntry() {
    return selectedResource?.logbook
      .filter((entry) => entry.endOdometer.trim())
      .sort((first, second) => `${second.date}-${second.id}`.localeCompare(`${first.date}-${first.id}`))[0];
  }

  function resetLogbookForm() {
    const latestEntry = latestSelectedLogbookEntry();
    setEditingLogEntryId(null);
    setLogbookForm({
      date: new Date().toISOString().slice(0, 10),
      driverId: "",
      endAddress: "",
      endOdometer: "",
      fuelOrCharge: "",
      fuelReceiptPhoto: undefined,
      kilometers: "",
      notes: "",
      purpose: "",
      startAddress: latestEntry?.endAddress ?? "",
      startOdometer: latestEntry?.endOdometer ?? selectedResource?.odometerYearStart ?? "",
      tripType: "Dienstfahrt",
      visited: "",
      waypoints: [],
      odometerPhotos: [],
    });
  }

  function editLogbookEntry(entry: VehicleLogEntry) {
    setEditingLogEntryId(entry.id);
    setLogbookForm({ ...entry, fuelReceiptPhoto: entry.fuelReceiptPhoto, odometerPhotos: entry.odometerPhotos ?? [], waypoints: entry.waypoints ?? [] });
  }

  async function captureLogbookFuelReceipt(file: File) {
    setArchiveNotice("Tank-/Ladebeleg wird gespeichert...");
    try {
      const photo: VehicleFuelReceiptPhoto = {
        capturedAt: new Date().toISOString(),
        id: globalThis.crypto?.randomUUID?.() ?? `FUEL-RECEIPT-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        previewUrl: await fileToImagePreview(file, 1100, 0.7),
      };
      setLogbookForm((current) => ({ ...current, fuelReceiptPhoto: photo }));
      setArchiveNotice("Tank-/Ladebeleg wurde zur Fahrt gespeichert.");
    } catch (error) {
      console.warn("Tank-/Ladebeleg konnte nicht gespeichert werden.", error);
      setArchiveNotice("Tank-/Ladebeleg konnte nicht gespeichert werden.");
    }
  }

  function saveLogbookEntry() {
    if (!selectedResource || selectedResource.type !== "Fahrzeug") {
      setArchiveNotice("Bitte zuerst ein Fahrzeug speichern oder bearbeiten.");
      return;
    }

    const kilometers = logbookForm.kilometers.trim()
      || String(Math.max(0, (Number(logbookForm.endOdometer) || 0) - (Number(logbookForm.startOdometer) || 0)) || "");
    const requiredFields = [
      logbookForm.date,
      logbookForm.startAddress,
      logbookForm.endAddress,
      logbookForm.startOdometer,
      logbookForm.endOdometer,
      kilometers,
      logbookForm.purpose,
      logbookForm.tripType === "Privatfahrt" ? "privat" : logbookForm.visited,
    ];
    if (requiredFields.some((field) => !field.trim())) {
      setArchiveNotice("Für das Fahrtenbuch bitte Datum, Start/Ziel, Kilometerstände, Kilometer, Zweck und Namen erfassen.");
      return;
    }

    const logbookId = editingLogEntryId
      ?? `LOG-${selectedResource.id}-${logbookForm.date.replace(/\D/g, "")}-${selectedResource.logbook.length + 1}`;
    const saved: VehicleLogEntry = {
      ...logbookForm,
      id: logbookId,
      date: logbookForm.date,
      driverId: logbookForm.driverId,
      endAddress: logbookForm.endAddress.trim(),
      endOdometer: logbookForm.endOdometer.trim(),
      fuelOrCharge: logbookForm.fuelOrCharge.trim(),
      kilometers,
      notes: logbookForm.notes.trim(),
      odometerPhotos: logbookForm.odometerPhotos,
      purpose: logbookForm.purpose.trim(),
      startAddress: logbookForm.startAddress.trim(),
      startOdometer: logbookForm.startOdometer.trim(),
      visited: logbookForm.tripType === "Privatfahrt" ? "" : logbookForm.visited.trim(),
      waypoints: logbookForm.waypoints
        .map((waypoint) => ({ ...waypoint, address: waypoint.address.trim(), note: waypoint.note.trim(), odometer: (waypoint.odometer ?? "").trim() }))
        .filter((waypoint) => waypoint.address || waypoint.photo?.previewUrl),
    };

    const nextResources = resources.map((resource) => {
      if (resource.id !== selectedResource.id) return resource;
      const nextLogbook = editingLogEntryId
        ? resource.logbook.map((entry) => (entry.id === editingLogEntryId ? saved : entry))
        : [saved, ...resource.logbook];

      return {
        ...resource,
        deletedLogbookEntryIds: (resource.deletedLogbookEntryIds ?? []).filter((id) => id !== logbookId),
        logbook: nextLogbook.sort((first, second) => first.date.localeCompare(second.date)),
      };
    });
    setResources(nextResources);
    onPersistResources(nextResources);
    setArchiveNotice(`Fahrt vom ${saved.date} wurde gespeichert.`);
    resetLogbookForm();
  }

  function deleteLogbookEntry(entryId: string) {
    if (!selectedResource) return;
    const nextResources = resources.map((resource) => (
      resource.id === selectedResource.id
        ? {
            ...resource,
            deletedLogbookEntryIds: Array.from(new Set([...(resource.deletedLogbookEntryIds ?? []), entryId])),
            logbook: resource.logbook.filter((entry) => entry.id !== entryId),
          }
        : resource
    ));
    setResources(nextResources);
    onPersistResources(nextResources);
    if (editingLogEntryId === entryId) resetLogbookForm();
    setArchiveNotice("Fahrtenbucheintrag wurde gelöscht.");
  }

  function saveMailSettings() {
    setDailyMailSettings({
      birthdaySources: mailSettingsForm.birthdaySources.trim(),
      calendarSources: mailSettingsForm.calendarSources.trim(),
      reminderSources: mailSettingsForm.reminderSources.trim(),
    });
    setArchiveNotice("Tagesmail-Quellen für Kalender, Geburtstage und Erinnerungen wurden gespeichert.");
  }

  function saveCompanySettings() {
    setCompanySettings({
      address: companySettingsForm.address.trim(),
      bank: companySettingsForm.bank.trim(),
      email: companySettingsForm.email.trim(),
      fSkattApproved: companySettingsForm.fSkattApproved,
      name: companySettingsForm.name.trim() || "Kolaretorp Service AB",
      organizationNumber: companySettingsForm.organizationNumber.trim(),
      vatNumber: companySettingsForm.vatNumber.trim(),
    });
    setArchiveNotice("Firmenstammdaten wurden gespeichert.");
  }

  function resetServiceForm() {
    setEditingServiceId(null);
    setEditingServiceChecklistItemId(null);
    setServiceForm({ accountingAccount: "3041", name: "", category: "", unit: "", price: "", currency: "SEK", taxRate: "25", showWorkTimeInReports: true, description: "", checklist: [] });
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
      taxRate: service.taxRate || "25",
      showWorkTimeInReports: service.showWorkTimeInReports ?? true,
      accountingAccount: service.accountingAccount || defaultAccountingAccount("Leistung", service.name),
      description: service.description,
      checklist: service.checklist ?? [],
    });
  }

  function addServiceChecklistItem() {
    if (!serviceChecklistForm.title.trim()) {
      setArchiveNotice("Bitte für den Checklistenpunkt mindestens einen Titel erfassen.");
      return;
    }

    if (editingServiceChecklistItemId) {
      setServiceForm({
        ...serviceForm,
        checklist: serviceForm.checklist.map((item) => (
          item.id === editingServiceChecklistItemId
            ? {
                ...item,
                title: serviceChecklistForm.title.trim(),
                note: serviceChecklistForm.note.trim() || "Hinweis vor Ort ergänzen.",
                defaultMinutes: Number(serviceChecklistForm.defaultMinutes) || 0,
              }
            : item
        )),
      });
      setEditingServiceChecklistItemId(null);
      setServiceChecklistForm({ title: "", note: "", defaultMinutes: "" });
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

  function editServiceChecklistItem(item: ServiceChecklistItem) {
    setEditingServiceChecklistItemId(item.id);
    setServiceChecklistForm({
      title: item.title,
      note: item.note,
      defaultMinutes: item.defaultMinutes ? String(item.defaultMinutes) : "",
    });
  }

  function cancelServiceChecklistEdit() {
    setEditingServiceChecklistItemId(null);
    setServiceChecklistForm({ title: "", note: "", defaultMinutes: "" });
  }

  function removeServiceChecklistItem(id: string) {
    setServiceForm({
      ...serviceForm,
      checklist: serviceForm.checklist.filter((item) => item.id !== id),
    });
    if (editingServiceChecklistItemId === id) cancelServiceChecklistEdit();
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
      taxRate: serviceForm.taxRate.trim() || "25",
      showWorkTimeInReports: serviceForm.showWorkTimeInReports,
      accountingAccount: serviceForm.accountingAccount || defaultAccountingAccount("Leistung", serviceForm.name),
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

  function resetMaterialForm() {
    setEditingMaterialId(null);
    setMaterialForm({ accountingAccount: "3058", category: "", currency: "SEK", description: "", name: "", price: "", taxRate: "25", unit: "Stück" });
  }

  function editMaterial(material: MaterialItem) {
    setEditingMaterialId(material.id);
    setMaterialForm({
      accountingAccount: material.accountingAccount || defaultAccountingAccount("Material", material.name),
      category: material.category,
      currency: material.currency || "SEK",
      description: material.description,
      name: material.name,
      price: material.price,
      taxRate: material.taxRate || "25",
      unit: material.unit,
    });
    setMasterDataTab("materials");
  }

  function saveMaterial() {
    if (!materialForm.name.trim() || !materialForm.unit.trim()) {
      setArchiveNotice("Bitte Materialname und Einheit erfassen.");
      return;
    }

    const existingMaterial = materials.find((material) => material.id === editingMaterialId);
    const saved: MaterialItem = {
      archived: existingMaterial?.archived ?? false,
      accountingAccount: materialForm.accountingAccount || defaultAccountingAccount("Material", materialForm.name),
      category: materialForm.category.trim() || "Material",
      currency: materialForm.currency || "SEK",
      description: materialForm.description.trim() || "Materialposition",
      id: editingMaterialId ?? createEntityId("MAT"),
      name: materialForm.name.trim(),
      price: materialForm.price.trim() || "0",
      taxRate: materialForm.taxRate.trim() || "25",
      unit: materialForm.unit.trim() || "Stück",
    };

    setMaterials(editingMaterialId ? materials.map((material) => (material.id === editingMaterialId ? saved : material)) : [saved, ...materials]);
    setArchiveNotice(`Material "${saved.name}" wurde gespeichert.`);
    resetMaterialForm();
  }

  function archiveMaterial(material: MaterialItem) {
    setMaterials(materials.map((item) => (item.id === material.id ? { ...item, archived: true } : item)));
    setArchiveNotice(`Material "${material.name}" wurde archiviert.`);
    if (editingMaterialId === material.id) resetMaterialForm();
  }

  function restoreMaterial(material: MaterialItem) {
    setMaterials(materials.map((item) => (item.id === material.id ? { ...item, archived: false } : item)));
    setArchiveNotice(`Material "${material.name}" wurde wieder aktiviert.`);
  }

  function deleteArchivedMaterial(material: MaterialItem) {
    if (!material.archived) return;
    setMaterials(materials.filter((item) => item.id !== material.id));
    setArchiveNotice(`Archiviertes Material "${material.name}" wurde endgültig gelöscht.`);
    if (editingMaterialId === material.id) resetMaterialForm();
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
      <div className="segmented-control master-data-tabs">
        <button className={masterDataTab === "company" ? "active" : ""} onClick={() => setMasterDataTab("company")} type="button">
          <Home size={16} />
          Firma
        </button>
        <button className={masterDataTab === "personal" ? "active" : ""} onClick={() => { setMasterDataTab("personal"); resetPersonForm(); }} type="button">
          <UserRound size={16} />
          {tt("Personal")}
        </button>
        <button className={masterDataTab === "resources" ? "active" : ""} onClick={() => { setMasterDataTab("resources"); resetResourceForm(); }} type="button">
          <CarFront size={16} />
          {tt("Ressourcen")}
        </button>
        <button className={masterDataTab === "services" ? "active" : ""} onClick={() => setMasterDataTab("services")} type="button">
          <Wrench size={16} />
          {tt("Leistungen")}
        </button>
        <button className={masterDataTab === "materials" ? "active" : ""} onClick={() => setMasterDataTab("materials")} type="button">
          <Paperclip size={16} />
          Material
        </button>
        <button className={masterDataTab === "mail" ? "active" : ""} onClick={() => setMasterDataTab("mail")} type="button">
          <Mail size={16} />
          {tt("Tagesmail")}
        </button>
        <button className={masterDataTab === "backups" ? "active" : ""} onClick={() => setMasterDataTab("backups")} type="button">
          <Archive size={16} />
          Backups
        </button>
      </div>

      {archiveNotice && <p className="archive-notice">{archiveNotice}</p>}

      {masterDataTab === "backups" && (
        <section className="panel">
          <div className="panel-title">
            <div>
              <p>Sicherheit</p>
              <h2>Backups</h2>
              <span>Server-Backups sichern den kompletten Online-Datenstand. Automatische Backups werden nur noch gebündelt angelegt; manuelle Backups sind jederzeit möglich.</span>
            </div>
            <div className="row-actions">
              <button className="ghost-button" disabled={backupBusy} onClick={() => void refreshBackups()} type="button">
                <RefreshCw size={16} />
                Aktualisieren
              </button>
              <button className="primary-button" disabled={backupBusy} onClick={() => void handleCreateBackup()} type="button">
                <Archive size={16} />
                Backup erstellen
              </button>
            </div>
          </div>
          {backupError && <p className="archive-notice danger">{backupError}</p>}
          <div className="summary-grid">
            <article>
              <span>Letztes Backup</span>
              <strong>{backups[0] ? formatCreatedAtWithSeconds(backups[0].createdAt) : backupBusy ? "wird geladen..." : "kein Backup vorhanden"}</strong>
            </article>
            <article>
              <span>Vorhandene Backups</span>
              <strong>{backups.length}</strong>
            </article>
            <article>
              <span>Aktueller Live-Stand</span>
              <strong>{customers.length} Kunden · {objects.length} Objekte · {services.length} Leistungen</strong>
            </article>
          </div>
          <div className="table-list compact-list">
            {backups.map((backup) => {
              const counts = backup.counts ?? {};
              return (
                <article key={backup.id}>
                  <div>
                    <strong>{formatCreatedAtWithSeconds(backup.createdAt)}</strong>
                    <span>{counts.customers ?? 0} Kunden · {counts.objects ?? 0} Objekte · {counts.jobs ?? 0} Aufträge · {counts.reports ?? 0} Berichte · {counts.fieldProgress ?? 0} mobile Daten</span>
                    <span>{formatFileSize(backup.compressedSizeBytes ?? backup.sizeBytes)} gespeichert · Original {formatFileSize(backup.sizeBytes)} · Quelle: {backup.sourceUpdatedAt ? formatCreatedAtWithSeconds(backup.sourceUpdatedAt) : "unbekannt"} · {backup.reason || "automatisch"}</span>
                    <span>Das ist ein kompletter Datenstand; technische Teile werden bei der Wiederherstellung automatisch zusammengesetzt.</span>
                  </div>
                  <div className="row-actions">
                    <IconAction label={`Backup vom ${formatCreatedAtWithSeconds(backup.createdAt)} wiederherstellen`} onClick={() => void handleRestoreBackup(backup)}>
                      <RotateCcw size={16} />
                    </IconAction>
                  </div>
                </article>
              );
            })}
            {!backupBusy && backups.length === 0 && <p>Noch kein Server-Backup vorhanden.</p>}
            {backupBusy && backups.length === 0 && <p>Backups werden geladen...</p>}
          </div>
        </section>
      )}

      {masterDataTab === "company" && (
        <section className="panel">
          <div className="panel-title">
            <div>
              <p>Stammdaten</p>
              <h2>Firma</h2>
              <span>Diese Angaben erscheinen in Offerten, Rechnungen und der späteren Übergabe an Spiris / Visma Buchhaltung.</span>
            </div>
          </div>
          <div className="form-grid compact-form">
            <label><span>Firmenname</span><input value={companySettingsForm.name} onChange={(event) => setCompanySettingsForm({ ...companySettingsForm, name: event.target.value })} /></label>
            <label><span>E-Mail</span><input type="email" value={companySettingsForm.email} onChange={(event) => setCompanySettingsForm({ ...companySettingsForm, email: event.target.value })} /></label>
            <label className="wide"><span>Adresse</span><AddressFields label="Firmenadresse" value={companySettingsForm.address} onChange={(part, value) => setCompanySettingsForm({ ...companySettingsForm, address: updateAddressPart(companySettingsForm.address, part, value) })} /></label>
            <label><span>Org.-Nummer</span><input value={companySettingsForm.organizationNumber} onChange={(event) => setCompanySettingsForm({ ...companySettingsForm, organizationNumber: event.target.value })} /></label>
            <label><span>Momsreg.nr / VAT</span><input value={companySettingsForm.vatNumber} onChange={(event) => setCompanySettingsForm({ ...companySettingsForm, vatNumber: event.target.value })} placeholder="z.B. SE559123456701" /></label>
            <label><span>Bankverbindung</span><input value={companySettingsForm.bank} onChange={(event) => setCompanySettingsForm({ ...companySettingsForm, bank: event.target.value })} placeholder="z.B. Bankgiro / IBAN / BIC" /></label>
            <label className="checkbox-line wide">
              <input checked={companySettingsForm.fSkattApproved} onChange={(event) => setCompanySettingsForm({ ...companySettingsForm, fSkattApproved: event.target.checked })} type="checkbox" />
              <span>Godkänd för F-skatt auf Offerten und Rechnungen anzeigen</span>
            </label>
            <button className="primary-button wide" onClick={saveCompanySettings} type="button">Firmenstammdaten speichern</button>
          </div>
        </section>
      )}

      {masterDataTab === "mail" && (
        <section className="panel">
          <div className="panel-title">
            <div>
              <p>{tt("Tagesmail")}</p>
              <h2>{tt("Kalenderquellen konfigurieren")}</h2>
            </div>
          </div>
          <div className="form-grid compact-form">
            <label className="wide">
              <span>{tt("Kalender heute plus 3 Tage")}</span>
              <textarea
                placeholder={"Privat|https://...\nArbeit|https://..."}
                value={mailSettingsForm.calendarSources}
                onChange={(event) => setMailSettingsForm({ ...mailSettingsForm, calendarSources: event.target.value })}
              />
            </label>
            <label className="wide">
              <span>{tt("Geburtstagskalender")}</span>
              <textarea
                placeholder={"Geburtstage|https://..."}
                value={mailSettingsForm.birthdaySources}
                onChange={(event) => setMailSettingsForm({ ...mailSettingsForm, birthdaySources: event.target.value })}
              />
            </label>
            <label className="wide">
              <span>Apple Erinnerungen / Aufgaben nächste 5 Tage</span>
              <textarea
                placeholder={"Erinnerungen|https://..."}
                value={mailSettingsForm.reminderSources}
                onChange={(event) => setMailSettingsForm({ ...mailSettingsForm, reminderSources: event.target.value })}
              />
            </label>
            <div className="wide mail-settings-help">
              <strong>{tt("Format pro Zeile: Name|ICS-Link")}</strong>
              <span>{tt("Beispiel: Privat|https://calendar.google.com/calendar/ical/.../basic.ics")}</span>
              <span>Erinnerungen werden aus VTODO/ICS-Quellen gelesen und mit Fälligkeitsdatum bis 5 Tage im Voraus in die Tagesmail aufgenommen.</span>
            </div>
            <button className="primary-button wide" onClick={saveMailSettings} type="button">
              <Check size={16} />
              {tt("Kalenderquellen speichern")}
            </button>
            <button className="ghost-button wide" disabled={dailyMailSending} onClick={() => void onSendDailyMail()} type="button">
              <Mail size={16} />
              {dailyMailSending ? tt("Tagesmail wird gesendet...") : tt("Tagesmail jetzt senden")}
            </button>
          </div>
        </section>
      )}

      {masterDataTab === "personal" && (
        <section className="panel">
          <div className="panel-title">
            <div>
              <p>{tt("Stammdaten")}</p>
              <h2>{tt("Personal verwalten")}</h2>
            </div>
            <button className="primary-button" onClick={openCreatePerson} type="button">
              <Plus size={16} />
              {tt("Neues Personal anlegen")}
            </button>
          </div>
          {personEditorOpen && (
          <div className="form-grid compact-form master-data-editor">
            <div className="wide record-meta-line">
              <span>{tt("Personalnummer")}: {normalizeReadableNumber(personForm.personnelNumber) || "wird beim Speichern erstellt"}</span>
              <span>{tt("Angelegt am")}: {formatCreatedAt(personForm.createdAt)}</span>
            </div>
            <label><span>{tt("Vorname")}</span><input value={personForm.firstName} onChange={(event) => setPersonForm({ ...personForm, firstName: event.target.value })} /></label>
            <label><span>{tt("Nachname")}</span><input value={personForm.lastName} onChange={(event) => setPersonForm({ ...personForm, lastName: event.target.value })} /></label>
            <label><span>{tt("Rolle")}</span><input value={personForm.role} onChange={(event) => setPersonForm({ ...personForm, role: event.target.value })} placeholder={tt("z.B. Einsatzleitung")} /></label>
            <label><span>{tt("Status")}</span>
              <select value={personForm.status} onChange={(event) => setPersonForm({ ...personForm, status: event.target.value as PersonnelRecord["status"] })}>
                <option>aktiv</option>
                <option>pausiert</option>
                <option>ausgeschieden</option>
              </select>
            </label>
            <label><span>{tt("E-Mail")}</span><input type="email" value={personForm.email} onChange={(event) => setPersonForm({ ...personForm, email: event.target.value })} /></label>
            <label><span>{tt("Telefon")}</span><input value={personForm.phone} onChange={(event) => setPersonForm({ ...personForm, phone: event.target.value })} /></label>
            <label><span>{tt("Sprache")}</span><input value={personForm.language} onChange={(event) => setPersonForm({ ...personForm, language: event.target.value })} /></label>
            <label className="wide"><span>{tt("Notizen")}</span><textarea value={personForm.notes} onChange={(event) => setPersonForm({ ...personForm, notes: event.target.value })} /></label>
            <button className="primary-button wide" onClick={savePerson} type="button">{editingPersonId ? tt("Personal speichern") : tt("Personal anlegen")}</button>
            <button className="ghost-button wide" onClick={resetPersonForm} type="button">{tt("Bearbeitung abbrechen")}</button>
          </div>
          )}
          <div className="master-list-toolbar">
            <div className="segmented-control master-view-toggle">
              <button aria-label={tt("Personal als Kacheln anzeigen")} className={personViewMode === "cards" ? "active" : ""} data-tooltip={tt("Kacheln")} onClick={() => setPersonViewMode("cards")} type="button">
                <LayoutGrid size={16} />
              </button>
              <button aria-label={tt("Personal als Liste anzeigen")} className={personViewMode === "list" ? "active" : ""} data-tooltip={tt("Liste")} onClick={() => setPersonViewMode("list")} type="button">
                <List size={16} />
              </button>
            </div>
          </div>
          {personViewMode === "cards" ? (
            <div className="service-catalog personnel-catalog">
              {activePersonnel.map((person) => (
                <article className="clickable-master-card" key={person.id} onClick={() => editPerson(person)}>
                  <span>{person.role}</span>
                  <strong>{person.firstName} {person.lastName}</strong>
                  <small>{tt("Personalnummer")}: {normalizeReadableNumber(person.personnelNumber) || "fehlt"} · {tt("Angelegt am")}: {formatCreatedAt(person.createdAt)}</small>
                  <small>{[person.email, person.phone, person.language].filter(Boolean).join(" · ") || "Kontaktdaten offen"}</small>
                  <small>{person.notes || "Keine Notizen hinterlegt."}</small>
                  <mark>{person.status}</mark>
                  <div className="card-actions" onClick={(event) => event.stopPropagation()}>
                    <IconAction label={`Personal ${person.firstName} ${person.lastName} bearbeiten`} onClick={() => editPerson(person)}><Pencil size={16} /></IconAction>
                    <IconAction danger label={`Personal ${person.firstName} ${person.lastName} archivieren`} onClick={() => archivePerson(person)}><Archive size={16} /></IconAction>
                  </div>
                </article>
              ))}
              {activePersonnel.length === 0 && <p>Noch kein aktives Personal angelegt.</p>}
            </div>
          ) : (
            <div className="table-list compact-list master-table-list">
              {activePersonnel.map((person) => (
                <article className="clickable-master-card" key={person.id} onClick={() => editPerson(person)}>
                  <div>
                    <strong>{person.firstName} {person.lastName}</strong>
                    <span>{tt("Personalnummer")}: {normalizeReadableNumber(person.personnelNumber) || "fehlt"} · {tt("Angelegt am")}: {formatCreatedAt(person.createdAt)}</span>
                    <span>{person.role || "Mitarbeit"} · {[person.email, person.phone, person.language].filter(Boolean).join(" · ") || "Kontaktdaten offen"}</span>
                    <span>{person.notes || "Keine Notizen hinterlegt."}</span>
                  </div>
                  <Badge value={person.status} />
                  <div className="row-actions" onClick={(event) => event.stopPropagation()}>
                    <IconAction label={`Personal ${person.firstName} ${person.lastName} bearbeiten`} onClick={() => editPerson(person)}><Pencil size={16} /></IconAction>
                    <IconAction danger label={`Personal ${person.firstName} ${person.lastName} archivieren`} onClick={() => archivePerson(person)}><Archive size={16} /></IconAction>
                  </div>
                </article>
              ))}
              {activePersonnel.length === 0 && <p>Noch kein aktives Personal angelegt.</p>}
            </div>
          )}
          {archivedPersonnel.length > 0 && (
            <div className="archive-section">
              <h3>Archiviertes Personal</h3>
              <div className="table-list compact-list archive-list">
                {archivedPersonnel.map((person) => (
                  <article key={person.id}>
                    <div>
                      <strong>{person.firstName} {person.lastName}</strong>
                      <span>{tt("Personalnummer")}: {normalizeReadableNumber(person.personnelNumber) || "fehlt"} · {tt("Angelegt am")}: {formatCreatedAt(person.createdAt)}</span>
                      <span>{person.role} · {person.status}</span>
                    </div>
                    <Badge value="archiviert" />
                    <div className="row-actions">
                      <IconAction label={`Archiviertes Personal ${person.firstName} ${person.lastName} bearbeiten`} onClick={() => editPerson(person)}><Pencil size={16} /></IconAction>
                      <IconAction label={`Archiviertes Personal ${person.firstName} ${person.lastName} reaktivieren`} onClick={() => restorePerson(person)}><RotateCcw size={16} /></IconAction>
                      <IconAction danger label={`Archiviertes Personal ${person.firstName} ${person.lastName} löschen`} onClick={() => deleteArchivedPerson(person)}><Trash2 size={16} /></IconAction>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {masterDataTab === "resources" && (
        <section className="panel">
          <div className="panel-title">
            <div>
              <p>{tt("Stammdaten")}</p>
              <h2>{tt("Ressourcen verwalten")}</h2>
            </div>
            <button className="primary-button" onClick={openCreateResource} type="button">
              <Plus size={16} />
              {tt("Neue Ressource anlegen")}
            </button>
          </div>
          {resourceEditorOpen && (
          <div className="form-grid compact-form master-data-editor">
            <label><span>{tt("Typ")}</span>
              <select value={resourceForm.type} onChange={(event) => setResourceForm({ ...resourceForm, type: event.target.value as ResourceRecord["type"] })}>
                <option>Fahrzeug</option>
                <option>Maschine</option>
                <option>Gerät</option>
              </select>
            </label>
            <label><span>{tt("Name")}</span><input value={resourceForm.name} onChange={(event) => setResourceForm({ ...resourceForm, name: event.target.value })} /></label>
            <label><span>{tt("Kennzeichen / Inventarnr.")}</span><input value={resourceForm.identifier} onChange={(event) => setResourceForm({ ...resourceForm, identifier: event.target.value })} /></label>
            <label><span>{tt("Status")}</span>
              <input list="resource-status-options" value={resourceForm.status} onChange={(event) => setResourceForm({ ...resourceForm, status: event.target.value })} />
              <datalist id="resource-status-options">
                {resourceStatusOptions.map((status) => <option key={status} value={status} />)}
              </datalist>
            </label>
            <label><span>{tt("Verantwortlich")}</span>
              <select value={resourceForm.responsiblePersonId} onChange={(event) => setResourceForm({ ...resourceForm, responsiblePersonId: event.target.value })}>
                <option value="">{tt("Nicht zugeordnet")}</option>
                {activePersonnel.map((person) => <option key={person.id} value={person.id}>{person.firstName} {person.lastName}</option>)}
              </select>
            </label>
            <label><span>{tt("Standort")}</span><input value={resourceForm.location} onChange={(event) => setResourceForm({ ...resourceForm, location: event.target.value })} /></label>
            {resourceForm.type === "Fahrzeug" && (
              <>
                <label><span>{tt("Fahrtenbuch Jahr")}</span><input inputMode="numeric" value={resourceForm.logbookYear} onChange={(event) => setResourceForm({ ...resourceForm, logbookYear: event.target.value })} /></label>
                <label><span>{tt("Km-Stand Jahresbeginn")}</span><input inputMode="numeric" value={resourceForm.odometerYearStart} onChange={(event) => setResourceForm({ ...resourceForm, odometerYearStart: event.target.value })} /></label>
                <label><span>{tt("Km-Stand Jahresende")}</span><input inputMode="numeric" value={resourceForm.odometerYearEnd} onChange={(event) => setResourceForm({ ...resourceForm, odometerYearEnd: event.target.value })} /></label>
              </>
            )}
            <label className="wide"><span>{tt("Notizen")}</span><textarea value={resourceForm.notes} onChange={(event) => setResourceForm({ ...resourceForm, notes: event.target.value })} /></label>
            <section className="wide object-attachment-section resource-photo-section">
              <div className="attachment-section-head">
                <div>
                  <h3>{tt("Bilder zur Ressource")}</h3>
                  <span>{resourceForm.mediaItems.filter((item) => item.type === "Bild").length} Bilder</span>
                </div>
                <label className="ghost-button attachment-upload">
                  <Camera size={16} />
                  {tt("Bild hinzufügen")}
                  <input aria-label="Bild zur Ressource hinzufügen" accept="image/*" capture="environment" multiple type="file" onChange={(event) => void addResourcePhotos(event.target.files)} />
                </label>
              </div>
              {resourceForm.mediaItems.length > 0 ? (
                <div className="object-photo-gallery resource-photo-gallery">
                  {resourceForm.mediaItems.map((item) => (
                    <article className={item.isPrimary ? "primary" : ""} key={item.id}>
                      <div
                        aria-label={`Ressourcenbild ${item.name}`}
                        className="object-photo-tile"
                        role="img"
                        style={{ backgroundImage: `url(${item.previewUrl})` }}
                      />
                      <input
                        aria-label={`Kurzbeschreibung ${item.name}`}
                        placeholder="Kurzbeschreibung zum Bild"
                        value={item.description}
                        onChange={(event) => updateResourcePhotoDescription(item.id, event.target.value)}
                      />
                      <div className="row-actions">
                        <IconAction label={`${item.name} als Hauptbild verwenden`} onClick={() => setResourcePrimaryPhoto(item.id)}><CarFront size={16} /></IconAction>
                        <IconAction danger label={`Bild ${item.name} entfernen`} onClick={() => removeResourcePhoto(item.id)}><Trash2 size={16} /></IconAction>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty-attachment">Noch keine Bilder zur Ressource vorhanden.</p>
              )}
            </section>
            <button className="primary-button wide" onClick={saveResource} type="button">{editingResourceId ? tt("Ressource speichern") : tt("Ressource anlegen")}</button>
            <button className="ghost-button wide" onClick={resetResourceForm} type="button">{tt("Bearbeitung abbrechen")}</button>
          </div>
          )}
          <div className="master-list-toolbar">
            <div className="segmented-control master-view-toggle">
              <button aria-label={tt("Ressourcen als Kacheln anzeigen")} className={resourceViewMode === "cards" ? "active" : ""} data-tooltip={tt("Kacheln")} onClick={() => setResourceViewMode("cards")} type="button">
                <LayoutGrid size={16} />
              </button>
              <button aria-label={tt("Ressourcen als Liste anzeigen")} className={resourceViewMode === "list" ? "active" : ""} data-tooltip={tt("Liste")} onClick={() => setResourceViewMode("list")} type="button">
                <List size={16} />
              </button>
            </div>
          </div>
          {resourceViewMode === "cards" ? (
            <div className="service-catalog resource-catalog">
              {activeResources.map((resource) => {
                const previewImage = primaryResourceImage(resource);
                return (
                <article className="resource-master-card clickable-master-card" key={resource.id} onClick={() => editResource(resource)}>
                  {previewImage?.previewUrl ? (
                    <div
                      aria-label={`Vorschaubild ${resource.name}`}
                      className="resource-card-preview"
                      role="img"
                      style={{ backgroundImage: `url(${previewImage.previewUrl})` }}
                    />
                  ) : (
                    <div className="resource-card-preview placeholder" aria-hidden="true">
                      <CarFront size={18} />
                    </div>
                  )}
                  <span>{resource.type}</span>
                  <strong>{resource.name}</strong>
                  <small>{[resource.identifier, resource.location, personName(resource.responsiblePersonId)].filter(Boolean).join(" · ")}</small>
                  <small>{resource.type === "Fahrzeug" ? `${resource.logbook.length} Fahrten · ${resource.logbookYear}` : resource.notes || "Keine Notizen hinterlegt."}</small>
                  <small>{resource.media?.length ?? 0} Bilder</small>
                  <mark>{resource.status}</mark>
                  <div className="card-actions" onClick={(event) => event.stopPropagation()}>
                    <IconAction label={`Ressource ${resource.name} bearbeiten`} onClick={() => editResource(resource)}><Pencil size={16} /></IconAction>
                    <IconAction danger label={`Ressource ${resource.name} archivieren`} onClick={() => archiveResource(resource)}><Archive size={16} /></IconAction>
                  </div>
                </article>
                );
              })}
              {activeResources.length === 0 && <p>Noch keine aktiven Ressourcen angelegt.</p>}
            </div>
          ) : (
            <div className="table-list compact-list master-table-list">
              {activeResources.map((resource) => {
                const previewImage = primaryResourceImage(resource);
                return (
                  <article className="resource-table-row clickable-master-card" key={resource.id} onClick={() => editResource(resource)}>
                    {previewImage?.previewUrl ? (
                      <div
                        aria-label={`Vorschaubild ${resource.name}`}
                        className="resource-table-preview"
                        role="img"
                        style={{ backgroundImage: `url(${previewImage.previewUrl})` }}
                      />
                    ) : (
                      <div className="resource-table-preview placeholder" aria-hidden="true">
                        <CarFront size={18} />
                      </div>
                    )}
                    <div>
                      <strong>{resource.name}</strong>
                      <span>{resource.type} · {[resource.identifier, resource.location, personName(resource.responsiblePersonId)].filter(Boolean).join(" · ") || "Stammdaten offen"}</span>
                      <span>{resource.type === "Fahrzeug" ? `${resource.logbook.length} Fahrten · ${resource.logbookYear}` : resource.notes || "Keine Notizen hinterlegt."}</span>
                    </div>
                    <Badge value={resource.status} />
                    <div className="row-actions" onClick={(event) => event.stopPropagation()}>
                      <IconAction label={`Ressource ${resource.name} bearbeiten`} onClick={() => editResource(resource)}><Pencil size={16} /></IconAction>
                      <IconAction danger label={`Ressource ${resource.name} archivieren`} onClick={() => archiveResource(resource)}><Archive size={16} /></IconAction>
                    </div>
                  </article>
                );
              })}
              {activeResources.length === 0 && <p>Noch keine aktiven Ressourcen angelegt.</p>}
            </div>
          )}
          {resourceEditorOpen && selectedResource?.type === "Fahrzeug" && (
            <section className="vehicle-logbook">
              <div className="panel-title">
                <div>
                  <p>Fahrtenbuch</p>
                  <h2>{selectedResource.name}</h2>
                </div>
              </div>
              <div className="logbook-summary">
                <span><strong>{logbookStats.totalKm}</strong> km gesamt</span>
                <span><strong>{logbookStats.businessKm}</strong> km dienstlich</span>
                <span><strong>{logbookStats.privateKm}</strong> km privat</span>
                <span><strong>{logbookStats.privateTrips}</strong> Privatfahrten</span>
              </div>
              <div className="form-grid compact-form">
                <label><span>Datum</span><input type="date" value={logbookForm.date} onChange={(event) => setLogbookForm({ ...logbookForm, date: event.target.value })} /></label>
                <label><span>Fahrer</span>
                  <select value={logbookForm.driverId} onChange={(event) => setLogbookForm({ ...logbookForm, driverId: event.target.value })}>
                    <option value="">Nicht zugeordnet</option>
                    {activePersonnel.map((person) => <option key={person.id} value={person.id}>{person.firstName} {person.lastName}</option>)}
                  </select>
                </label>
                <label><span>Art</span>
                  <select value={logbookForm.tripType} onChange={(event) => setLogbookForm({ ...logbookForm, tripType: event.target.value as VehicleLogEntry["tripType"] })}>
                    <option>Dienstfahrt</option>
                    <option>Privatfahrt</option>
                  </select>
                </label>
                <label><span>Start-Km</span><input inputMode="numeric" value={logbookForm.startOdometer} onChange={(event) => setLogbookForm({ ...logbookForm, startOdometer: event.target.value })} /></label>
                <label><span>End-Km</span><input inputMode="numeric" value={logbookForm.endOdometer} onChange={(event) => setLogbookForm({ ...logbookForm, endOdometer: event.target.value })} /></label>
                <label><span>Kilometer</span><input inputMode="numeric" value={logbookForm.kilometers} onChange={(event) => setLogbookForm({ ...logbookForm, kilometers: event.target.value })} /></label>
                <label className="wide"><span>Startadresse</span><input list="logbook-address-options" value={logbookForm.startAddress} onChange={(event) => setLogbookForm({ ...logbookForm, startAddress: event.target.value })} /></label>
                <label className="wide"><span>Zieladresse</span><input list="logbook-address-options" value={logbookForm.endAddress} onChange={(event) => setLogbookForm({ ...logbookForm, endAddress: event.target.value })} /></label>
                <datalist id="logbook-address-options">
                  {logbookAddressOptions.map((address) => <option key={address} value={address} />)}
                </datalist>
                <div className="wide waypoint-editor">
                  <div className="waypoint-editor-head">
                    <span>Zwischenziele</span>
                    <button
                      className="ghost-button"
                      onClick={() => setLogbookForm({
                        ...logbookForm,
                        waypoints: [
                          ...logbookForm.waypoints,
                          { address: "", id: globalThis.crypto?.randomUUID?.() ?? `WAY-${Date.now()}`, note: "", odometer: "" },
                        ],
                      })}
                      type="button"
                    >
                      <Plus size={14} />
                      Ziel
                    </button>
                  </div>
                  {logbookForm.waypoints.map((waypoint, waypointIndex) => (
                    <div className="waypoint-row" key={waypoint.id}>
                      <input
                        aria-label={`Zwischenziel ${waypointIndex + 1}`}
                        list="logbook-address-options"
                        placeholder={`Zwischenziel ${waypointIndex + 1}`}
                        value={waypoint.address}
                        onChange={(event) => setLogbookForm({
                          ...logbookForm,
                          waypoints: logbookForm.waypoints.map((item) => (
                            item.id === waypoint.id ? { ...item, address: event.target.value } : item
                          )),
                        })}
                      />
                      <input
                        aria-label={`Notiz zu Zwischenziel ${waypointIndex + 1}`}
                        placeholder="Notiz"
                        value={waypoint.note}
                        onChange={(event) => setLogbookForm({
                          ...logbookForm,
                          waypoints: logbookForm.waypoints.map((item) => (
                            item.id === waypoint.id ? { ...item, note: event.target.value } : item
                          )),
                        })}
                      />
                      <input
                        aria-label={`KM-Stand zu Zwischenziel ${waypointIndex + 1}`}
                        inputMode="numeric"
                        placeholder="KM"
                        value={waypoint.odometer ?? ""}
                        onChange={(event) => setLogbookForm({
                          ...logbookForm,
                          waypoints: logbookForm.waypoints.map((item) => (
                            item.id === waypoint.id ? { ...item, odometer: event.target.value } : item
                          )),
                        })}
                      />
                      <button
                        aria-label={`Zwischenziel ${waypointIndex + 1} löschen`}
                        className="icon-button"
                        onClick={() => setLogbookForm({ ...logbookForm, waypoints: logbookForm.waypoints.filter((item) => item.id !== waypoint.id) })}
                        type="button"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <label><span>Zweck / Ärende</span><input list="logbook-purpose-options" value={logbookForm.purpose} onChange={(event) => setLogbookForm({ ...logbookForm, purpose: event.target.value })} /></label>
                <datalist id="logbook-purpose-options">
                  {logbookPurposeOptions.map((purpose) => <option key={purpose} value={purpose} />)}
                </datalist>
                <label><span>Besucht bei</span><input disabled={logbookForm.tripType === "Privatfahrt"} value={logbookForm.visited} onChange={(event) => setLogbookForm({ ...logbookForm, visited: event.target.value })} /></label>
                <label><span>Tanken / Laden</span><input value={logbookForm.fuelOrCharge} onChange={(event) => setLogbookForm({ ...logbookForm, fuelOrCharge: event.target.value })} /></label>
                <div className="wide receipt-photo-field">
                  <label className="ghost-button">
                    <Paperclip size={15} />
                    Tank-/Ladebeleg scannen
                    <input
                      accept="image/*"
                      aria-label="Tank- oder Ladebeleg scannen"
                      capture="environment"
                      type="file"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void captureLogbookFuelReceipt(file);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  {logbookForm.fuelReceiptPhoto?.previewUrl && (
                    <div className="receipt-photo-preview">
                      <img alt="Tank- oder Ladebeleg" src={logbookForm.fuelReceiptPhoto.previewUrl} />
                      <small>{logbookForm.fuelReceiptPhoto.name}</small>
                    </div>
                  )}
                </div>
                <label className="wide"><span>Notiz</span><textarea value={logbookForm.notes} onChange={(event) => setLogbookForm({ ...logbookForm, notes: event.target.value })} /></label>
                <button className="primary-button wide" onClick={saveLogbookEntry} type="button">{editingLogEntryId ? "Fahrt speichern" : "Fahrt eintragen"}</button>
                {editingLogEntryId && <button className="ghost-button wide" onClick={resetLogbookForm} type="button">Fahrt-Bearbeitung abbrechen</button>}
              </div>
              <div className="table-list compact-list logbook-list">
                {selectedResourceLogbook.map((entry) => (
                  <article key={entry.id}>
                    <div>
                      <strong>{entry.date} · {entry.kilometers} km · {entry.tripType}</strong>
                      <span>{entry.startAddress} → {entry.endAddress}</span>
                      {entry.waypoints?.length ? (
                        <span>Zwischenziele: {entry.waypoints.map((waypoint) => {
                          const details = [waypoint.odometer ? `${waypoint.odometer} km` : "", waypoint.note].filter(Boolean).join(", ");
                          const waypointLabel = waypoint.address || waypoint.photo?.name || "Zwischenziel";
                          return details ? `${waypointLabel} (${details})` : waypointLabel;
                        }).join(" → ")}</span>
                      ) : null}
                      <span>{entry.startOdometer} → {entry.endOdometer} km · {entry.purpose}{entry.visited ? ` · ${entry.visited}` : ""}</span>
                      {entry.odometerPhotos?.length ? (
                        <span>{entry.odometerPhotos.map((photo) => `${photo.source === "start" ? "Startfoto" : "Endfoto"}: ${photo.address || photo.name}`).join(" · ")}</span>
                      ) : null}
                      {(entry.odometerPhotos?.some((photo) => photo.previewUrl) || entry.waypoints?.some((waypoint) => waypoint.photo?.previewUrl) || entry.fuelReceiptPhoto?.previewUrl) ? (
                        <div className="logbook-photo-grid">
                          {entry.odometerPhotos?.filter((photo) => photo.previewUrl).map((photo) => (
                            <figure key={photo.id}>
                              <img alt={photo.source === "start" ? "Startfoto Tacho" : "Endfoto Tacho"} src={photo.previewUrl} />
                              <figcaption>{photo.source === "start" ? "Startfoto" : "Endfoto"}{photo.odometerReading ? ` · ${photo.odometerReading} km` : ""}</figcaption>
                            </figure>
                          ))}
                          {entry.waypoints?.filter((waypoint) => waypoint.photo?.previewUrl).map((waypoint, waypointIndex) => (
                            <figure key={waypoint.photo?.id ?? waypoint.id}>
                              <img alt={`Foto zu Zwischenziel ${waypointIndex + 1}`} src={waypoint.photo?.previewUrl} />
                              <figcaption>{waypoint.address || `Zwischenziel ${waypointIndex + 1}`}{waypoint.odometer ? ` · ${waypoint.odometer} km` : ""}</figcaption>
                            </figure>
                          ))}
                          {entry.fuelReceiptPhoto?.previewUrl && (
                            <figure key={entry.fuelReceiptPhoto.id}>
                              <img alt="Tank- oder Ladebeleg" src={entry.fuelReceiptPhoto.previewUrl} />
                              <figcaption>Tank-/Ladebeleg</figcaption>
                            </figure>
                          )}
                        </div>
                      ) : null}
                    </div>
                    <Badge value={personName(entry.driverId)} />
                    <div className="row-actions">
                      <IconAction label={`Fahrt vom ${entry.date} bearbeiten`} onClick={() => editLogbookEntry(entry)}><Pencil size={16} /></IconAction>
                      <IconAction danger label={`Fahrt vom ${entry.date} löschen`} onClick={() => deleteLogbookEntry(entry.id)}><Trash2 size={16} /></IconAction>
                    </div>
                  </article>
                ))}
                {selectedResourceLogbook.length === 0 && <p>Noch keine Fahrten für dieses Fahrzeug erfasst.</p>}
              </div>
            </section>
          )}
          {archivedResources.length > 0 && (
            <div className="archive-section">
              <h3>Archivierte Ressourcen</h3>
              <div className="table-list compact-list archive-list">
                {archivedResources.map((resource) => (
                  <article key={resource.id}>
                    <div>
                      <strong>{resource.name}</strong>
                      <span>{resource.type} · {resource.identifier || "ohne Kennung"}</span>
                    </div>
                    <Badge value="archiviert" />
                    <div className="row-actions">
                      <IconAction label={`Archivierte Ressource ${resource.name} bearbeiten`} onClick={() => editResource(resource)}><Pencil size={16} /></IconAction>
                      <IconAction label={`Archivierte Ressource ${resource.name} reaktivieren`} onClick={() => restoreResource(resource)}><RotateCcw size={16} /></IconAction>
                      <IconAction danger label={`Archivierte Ressource ${resource.name} löschen`} onClick={() => deleteArchivedResource(resource)}><Trash2 size={16} /></IconAction>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {masterDataTab === "materials" && (
        <section className="panel">
          <div className="panel-title">
            <div>
              <p>Stammdaten</p>
              <h2>Material verwalten</h2>
              <span>Materialpositionen erhalten hier ihr Erlöskonto für die spätere Spiris / Visma-Übergabe.</span>
            </div>
          </div>
          <div className="form-grid compact-form">
            <label><span>Material</span><input required value={materialForm.name} onChange={(event) => setMaterialForm({ ...materialForm, name: event.target.value })} /></label>
            <label><span>Kategorie</span><input list="material-categories" value={materialForm.category} onChange={(event) => setMaterialForm({ ...materialForm, category: event.target.value })} /></label>
            <datalist id="material-categories">
              {materialCategories.map((category) => <option key={category} value={category} />)}
            </datalist>
            <label><span>Einheit</span><input list="material-units" value={materialForm.unit} onChange={(event) => setMaterialForm({ ...materialForm, unit: event.target.value })} /></label>
            <datalist id="material-units">
              {materialUnits.map((unit) => <option key={unit} value={unit} />)}
            </datalist>
            <div className="price-currency-row">
              <label><span>Preis netto</span><input inputMode="decimal" value={materialForm.price} onChange={(event) => setMaterialForm({ ...materialForm, price: event.target.value })} /></label>
              <label><span>Währung</span><select value={materialForm.currency} onChange={(event) => setMaterialForm({ ...materialForm, currency: event.target.value })}><option>SEK</option><option>EUR</option><option>NOK</option><option>DKK</option></select></label>
            </div>
            <label><span>Moms %</span><input inputMode="decimal" value={materialForm.taxRate} onChange={(event) => setMaterialForm({ ...materialForm, taxRate: event.target.value })} /></label>
            <label><span>Erlöskonto</span>
              <select value={materialForm.accountingAccount} onChange={(event) => setMaterialForm({ ...materialForm, accountingAccount: event.target.value })}>
                {vismaChartOfAccounts.filter((account) => account.category === "Material").map((account) => (
                  <option key={account.account} value={account.account}>{account.account} · {account.label}</option>
                ))}
              </select>
            </label>
            <label className="wide"><span>Beschreibung</span><textarea value={materialForm.description} onChange={(event) => setMaterialForm({ ...materialForm, description: event.target.value })} /></label>
            <button className="primary-button wide" onClick={saveMaterial} type="button">{editingMaterialId ? "Material speichern" : "Material anlegen"}</button>
            {editingMaterialId && <button className="ghost-button wide" onClick={resetMaterialForm} type="button">Bearbeitung abbrechen</button>}
          </div>
          <div className="table-list compact-list">
            {activeMaterials.map((material) => (
              <article key={material.id}>
                <div>
                  <strong>{material.name}</strong>
                  <span>{material.category} · {materialRate(material)} · Konto {material.accountingAccount || defaultAccountingAccount("Material", material.name)}</span>
                </div>
                <span>{material.description}</span>
                <div className="row-actions">
                  <IconAction label={`Material ${material.name} bearbeiten`} onClick={() => editMaterial(material)}><Pencil size={16} /></IconAction>
                  <IconAction danger label={`Material ${material.name} archivieren`} onClick={() => archiveMaterial(material)}><Archive size={16} /></IconAction>
                </div>
              </article>
            ))}
            {activeMaterials.length === 0 && <p>Noch kein Material erfasst.</p>}
          </div>
          {archivedMaterials.length > 0 && (
            <div className="archive-section">
              <h3>Archiviertes Material</h3>
              <div className="table-list compact-list archive-list">
                {archivedMaterials.map((material) => (
                  <article key={material.id}>
                    <div>
                      <strong>{material.name}</strong>
                      <span>{material.category} · {materialRate(material)}</span>
                    </div>
                    <Badge value="archiviert" />
                    <div className="row-actions">
                      <IconAction label={`Archiviertes Material ${material.name} bearbeiten`} onClick={() => editMaterial(material)}><Pencil size={16} /></IconAction>
                      <IconAction label={`Archiviertes Material ${material.name} reaktivieren`} onClick={() => restoreMaterial(material)}><RotateCcw size={16} /></IconAction>
                      <IconAction danger label={`Archiviertes Material ${material.name} löschen`} onClick={() => deleteArchivedMaterial(material)}><Trash2 size={16} /></IconAction>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {masterDataTab === "services" && (
        <>
          <section className="panel">
            <div className="panel-title">
              <div>
                <p>Buchhaltung</p>
                <h2>Kontenplan für Spiris / Visma</h2>
                <span>Diese Konten werden bei Leistungen und Material ausgewählt und anschließend in die Rechnungsposition übernommen.</span>
              </div>
            </div>
            <div className="table-list compact-list chart-of-accounts-list">
              {vismaChartOfAccounts.map((account) => (
                <article key={account.account}>
                  <div>
                    <strong>{account.account} · {account.label}</strong>
                    <span>{account.category}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="panel">
        <div className="panel-title">
          <div>
            <p>Stammdaten</p>
            <h2>Leistungen einzeln erfassen</h2>
          </div>
        </div>
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
            <label><span>Preis netto</span><input value={serviceForm.price} onChange={(event) => setServiceForm({ ...serviceForm, price: event.target.value })} placeholder="z.B. 595" /></label>
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
          <label><span>Moms %</span><input inputMode="decimal" value={serviceForm.taxRate} onChange={(event) => setServiceForm({ ...serviceForm, taxRate: event.target.value })} /></label>
          <label><span>Erlöskonto</span>
            <select value={serviceForm.accountingAccount} onChange={(event) => setServiceForm({ ...serviceForm, accountingAccount: event.target.value })}>
              {vismaChartOfAccounts.filter((account) => account.category === "Leistung").map((account) => (
                <option key={account.account} value={account.account}>{account.account} · {account.label}</option>
              ))}
            </select>
          </label>
          <label className="checkbox-line">
            <input checked={serviceForm.showWorkTimeInReports} onChange={(event) => setServiceForm({ ...serviceForm, showWorkTimeInReports: event.target.checked })} type="checkbox" />
            <span>Arbeitszeit im Bericht anzeigen</span>
          </label>
          <label className="wide"><span>Beschreibung</span><textarea value={serviceForm.description} onChange={(event) => setServiceForm({ ...serviceForm, description: event.target.value })} /></label>
          <div className="wide service-checklist-editor">
            <span>Checkliste für Einsatz</span>
            <div className="service-checklist-form">
              <label><span>Punkt</span><input value={serviceChecklistForm.title} onChange={(event) => setServiceChecklistForm({ ...serviceChecklistForm, title: event.target.value })} placeholder="z.B. Zugang prüfen" /></label>
              <label><span>Standardzeit min.</span><input inputMode="numeric" min="0" type="number" value={serviceChecklistForm.defaultMinutes} onChange={(event) => setServiceChecklistForm({ ...serviceChecklistForm, defaultMinutes: event.target.value })} /></label>
              <label className="wide"><span>Hinweis / Info</span><textarea value={serviceChecklistForm.note} onChange={(event) => setServiceChecklistForm({ ...serviceChecklistForm, note: event.target.value })} placeholder="Was soll vor Ort geprüft oder dokumentiert werden?" /></label>
              <button className="ghost-button wide" onClick={addServiceChecklistItem} type="button">
                {editingServiceChecklistItemId ? <Check size={16} /> : <Plus size={16} />}
                {editingServiceChecklistItemId ? "Checklistenpunkt übernehmen" : "Checklistenpunkt hinzufügen"}
              </button>
              {editingServiceChecklistItemId && (
                <button className="ghost-button wide" onClick={cancelServiceChecklistEdit} type="button">
                  <RotateCcw size={16} />
                  Checklistenpunkt-Bearbeitung abbrechen
                </button>
              )}
            </div>
            <div className="checklist-preview">
              {serviceForm.checklist.map((item) => (
                <article key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.note} · {item.defaultMinutes} min.</small>
                  </div>
                  <IconAction label={`Checklistenpunkt ${item.title} bearbeiten`} onClick={() => editServiceChecklistItem(item)}><Pencil size={16} /></IconAction>
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
              <small>{service.checklist?.length ?? 0} Checklistenpunkte · Konto {service.accountingAccount || defaultAccountingAccount("Leistung", service.name)}</small>
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
            <div className="table-list compact-list archive-list">
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
                    <IconAction danger label={`Archivierte Leistung ${service.name} löschen`} onClick={() => deleteArchivedService(service)}><Trash2 size={16} /></IconAction>
                  </div>
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
                    <IconAction danger label={`Archiviertes Paket ${servicePackage.name} löschen`} onClick={() => deleteArchivedPackage(servicePackage)}><Trash2 size={16} /></IconAction>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
        </>
      )}
      {servicePickerOpen && masterDataTab === "services" && (
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
  objectStatusOptions,
  onArchive,
  onBack,
  onAutoSave,
  onDelete,
  onRestore,
  onSendReport,
  onSubmit,
  onUpdateReport,
  packages,
  reports,
  newObject,
  setNewObject,
  submitLabel,
}: {
  customers: CustomerRecord[];
  jobs: JobRecord[];
  object?: ObjectRecord;
  objectStatusOptions: string[];
  onArchive?: () => void;
  onBack: () => void;
  onAutoSave?: (value: NewObjectFormState) => void;
  onDelete?: () => void;
  onRestore?: () => void;
  onSendReport: (report: ReportRecord) => void;
  onSubmit: () => void;
  onUpdateReport: (report: ReportRecord, options?: { forceRemote?: boolean }) => void;
  packages: ServicePackage[];
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
        {object && (
          <div className="record-dialog-actions">
            {object.archived ? (
              <>
                <button className="ghost-button" onClick={onRestore} type="button">
                  <RotateCcw size={16} />
                  Objekt wiederherstellen
                </button>
                <button className="ghost-button danger-action" onClick={onDelete} type="button">
                  <Trash2 size={16} />
                  Objekt endgültig löschen
                </button>
              </>
            ) : (
              <button className="ghost-button danger-action" onClick={onArchive} type="button">
                <Archive size={16} />
                Objekt archivieren
              </button>
            )}
          </div>
        )}
        <ObjectForm
          customers={customers}
          newObject={newObject}
          packages={packages}
          statusOptions={objectStatusOptions}
          setNewObject={setNewObject}
          onAutoSave={onAutoSave}
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
  onUpdateReport: (report: ReportRecord, options?: { forceRemote?: boolean }) => void;
  reports: ReportRecord[];
}) {
  const objectJobs = jobs.filter((job) => job.objectId === object.id);
  const normalizedReports = dedupeReports(reports);
  const objectReports = normalizedReports.filter((report) => report.objectId === object.id);
  const history = [
    ...objectJobs.map((job) => ({
      id: `job-${job.id}`,
      date: jobDateRangeLabel(job),
      sortDate: jobExecutionDate(job),
      status: job.status,
      statusLabel: readableJobStatus(job.status),
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
        sortDate: normalizeReportDate(report.date),
        status: "Bericht",
        statusLabel: "Bericht",
        title: report.title,
        type: "Bericht" as const,
        job: undefined,
        report,
      })),
  ];
  const statusOrder = ["offerte", "in Arbeit", "geplant", "pausiert", "erledigt", "abgerechnet", "storniert", "Bericht"];
  const historyGroups = statusOrder
    .map((status) => ({
      id: status,
      items: history
        .filter((item) => item.status === status)
        .sort((first, second) => first.sortDate.localeCompare(second.sortDate)),
      label: status === "Bericht" ? "Bericht" : readableJobStatus(status as JobRecord["status"]),
    }))
    .filter((group) => group.items.length > 0);
  const [expandedHistoryGroups, setExpandedHistoryGroups] = useState<string[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState("");
  const selectedHistory = history.find((item) => item.id === selectedHistoryId);
  const selectedReport = selectedHistory?.report;
  const currentSelectedReport = () => selectedReport ? dedupeReports(reports).find((report) => report.id === selectedReport.id) ?? selectedReport : undefined;
  const selectedJob = selectedHistory?.job;
  const reportCustomer = customers.find((customer) => customer.id === object.ownerCustomerId || customer.name === object.owner);
  const reportSubject = selectedReport ? customerReportSendSubject(selectedReport, object, reportCustomer) : "";
  const reportPdfName = selectedHistory ? `Einsatzbericht-${object.name}-${selectedHistory.title}.pdf` : "";
  const mailBody = selectedReport ? customerReportSendBody(reportCustomer, selectedReport) : "";
  const sentAt = selectedReport?.sentAt ?? "";
  function toggleHistoryGroup(groupId: string) {
    setExpandedHistoryGroups((current) => (
      current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId]
    ));
  }

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
        {historyGroups.map((group) => {
          const isExpanded = expandedHistoryGroups.includes(group.id);

          return (
            <div className="history-status-group" key={group.id}>
              <button
                aria-expanded={isExpanded}
                className="history-group-toggle"
                onClick={() => toggleHistoryGroup(group.id)}
                type="button"
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span>
                  <strong>{group.label}</strong>
                  <small>{group.items.length} {group.items.length === 1 ? "Eintrag" : "Einträge"}</small>
                </span>
              </button>
              {isExpanded && group.items.map((item) => (
                <button
                  className={selectedHistory?.id === item.id ? "active history-entry" : "history-entry"}
                  key={item.id}
                  onClick={() => setSelectedHistoryId(selectedHistory?.id === item.id ? "" : item.id)}
                  type="button"
                >
                  <FileText size={15} />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.date} · {item.type}{item.report ? " · Bericht vorhanden" : " · ohne Bericht"}</small>
                  </span>
                  <Badge value={item.statusLabel} />
                </button>
              ))}
            </div>
          );
        })}
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
                <span>Berichtstext</span>
                <textarea
                  disabled={Boolean(sentAt)}
                  value={selectedReport.summary}
                  onChange={(event) => onUpdateReport({ ...(currentSelectedReport() ?? selectedReport), summary: event.target.value })}
                  onBlur={(event) => onUpdateReport({ ...(currentSelectedReport() ?? selectedReport), summary: event.currentTarget.value }, { forceRemote: true })}
                  placeholder={sentAt ? "Bericht wurde bereits gesendet und ist gesperrt." : "Berichtstext für den Kundenbericht anpassen."}
                />
              </label>
              <label className="report-comment-editor">
                <span>Kommentar vor dem Senden</span>
                <textarea
                  disabled={Boolean(sentAt)}
                  value={visibleReportCustomerComment(selectedReport)}
                  onChange={(event) => onUpdateReport({ ...(currentSelectedReport() ?? selectedReport), customerComment: event.target.value })}
                  onBlur={(event) => onUpdateReport({ ...(currentSelectedReport() ?? selectedReport), customerComment: event.currentTarget.value }, { forceRemote: true })}
                  placeholder={sentAt ? "Bericht wurde bereits gesendet und ist gesperrt." : "Kommentar ergänzen, der im Kundenbericht erscheinen soll."}
                />
              </label>
              <ReportAttachmentEditor disabled={Boolean(sentAt)} onUpdateReport={onUpdateReport} report={selectedReport} />
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

function AddressFields({
  disabled = false,
  label,
  onChange,
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (part: keyof AddressParts, value: string) => void;
  value: string;
}) {
  const address = splitAddressParts(value);

  return (
    <>
      <div className="wide address-group-title"><strong>{label}</strong></div>
      <label className="wide"><span>Straße</span><input disabled={disabled} value={address.street} onChange={(event) => onChange("street", event.target.value)} /></label>
      <label><span>PLZ</span><input disabled={disabled} value={address.postalCode} onChange={(event) => onChange("postalCode", event.target.value)} /></label>
      <label><span>Ort</span><input disabled={disabled} value={address.city} onChange={(event) => onChange("city", event.target.value)} /></label>
    </>
  );
}

function ObjectForm({
  customers,
  newObject,
  packages,
  setNewObject,
  statusOptions,
  onAutoSave,
  onSubmit,
  submitLabel,
}: {
  customers: CustomerRecord[];
  newObject: NewObjectFormState;
  packages: ServicePackage[];
  setNewObject: (value: NewObjectFormState) => void;
  statusOptions: string[];
  onAutoSave?: (value: NewObjectFormState) => void;
  onSubmit: () => void;
  submitLabel: string;
}) {
  const photoItems = newObject.mediaItems.filter((item) => item.type === "Bild");
  const fileItems = newObject.mediaItems.filter((item) => item.type !== "Bild");
  const [previewDocument, setPreviewDocument] = useState<MediaItem | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<MediaItem | null>(null);
  const objectFormRef = useRef(newObject);
  const packageOptions = uniqueSortedValues(
    packages.filter((servicePackage) => !servicePackage.archived).map((servicePackage) => servicePackage.name),
    [newObject.carePackage, "Basis", "Plus", "Komfort", "Premium"],
  );

  useEffect(() => {
    objectFormRef.current = newObject;
  }, [newObject]);

  function autosaveField() {
    if (!onAutoSave) return;
    window.setTimeout(() => onAutoSave(objectFormRef.current), 0);
  }

  function update(key: keyof typeof newObject, value: string) {
    setNewObject({ ...newObject, [key]: value });
  }

  function updateObjectAddress(key: keyof Pick<NewObjectFormState, "address" | "billingAddress" | "ownerAddress">, part: keyof AddressParts, value: string) {
    const nextAddress = updateAddressPart(newObject[key], part, value);
    setNewObject({
      ...newObject,
      [key]: nextAddress,
      billingAddress:
        key === "address" && newObject.billingAddressMode === "Objektadresse"
          ? nextAddress
          : key === "ownerAddress" && newObject.billingAddressMode === "Eigentümeradresse"
            ? nextAddress
            : newObject.billingAddress,
    });
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
    const added = await Promise.all(Array.from(files).map(async (file, index) => {
      if (type === "Bild") {
        const previewUrl = await fileToImagePreview(file, 900, 0.62);
        const uploaded = previewUrl ? await uploadMediaFile(await dataUrlToBlob(previewUrl), "object-photos", file.name) : null;
        return {
          id: `MED-${Date.now()}-${index}-${file.name}`,
          type,
          name: file.name,
          description: "",
          source,
          previewUrl: uploaded?.url ?? previewUrl,
          storagePath: uploaded?.path,
          isPrimary: !hasPrimaryImage && index === 0,
        };
      }
      const previewUrl = await fileToDocumentPreview(file);
      return {
        id: `MED-${Date.now()}-${index}-${file.name}`,
        type,
        name: file.name,
        description: type === "Dokument" ? newObject.documentDescription.trim() : "",
        source,
        previewUrl,
        isPrimary: false,
      };
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
    <div className="form-grid" onBlurCapture={autosaveField}>
      <h3>Basisdaten</h3>
      <label><span>Objekt</span><input value={newObject.name} onChange={(event) => update("name", event.target.value)} /></label>
      <label><span>Status</span>
        <input list="object-status-options" value={newObject.status} onChange={(event) => update("status", event.target.value)} />
        <datalist id="object-status-options">
          {statusOptions.map((status) => <option key={status} value={status} />)}
        </datalist>
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
      <AddressFields
        label="Eigentümeradresse"
        value={newObject.ownerAddress}
        onChange={(part, value) => updateObjectAddress("ownerAddress", part, value)}
      />
      <AddressFields
        label="Objektadresse"
        value={newObject.address}
        onChange={(part, value) => updateObjectAddress("address", part, value)}
      />
      <label>
        <span>Rechnungsadresse verwenden</span>
        <select value={newObject.billingAddressMode} onChange={(event) => updateBillingMode(event.target.value as ObjectRecord["billingAddressMode"])}>
          <option>Eigentümeradresse</option>
          <option>Objektadresse</option>
          <option>Abweichend</option>
        </select>
      </label>
      <AddressFields
        disabled={newObject.billingAddressMode !== "Abweichend"}
        label="Rechnungsadresse"
        value={newObject.billingAddressMode === "Objektadresse" ? newObject.address : newObject.billingAddressMode === "Eigentümeradresse" ? newObject.ownerAddress : newObject.billingAddress}
        onChange={(part, value) => updateObjectAddress("billingAddress", part, value)}
      />
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
          {packageOptions.map((option) => <option key={option} value={option}>{option}</option>)}
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
  const isImage = source.startsWith("data:image/") || /\.(avif|gif|jpe?g|png|webp)(\?|$)/i.test(source) || /\.(avif|gif|jpe?g|png|webp)$/i.test(lowerName);
  const isPdf = source.startsWith("data:application/pdf") || lowerName.endsWith(".pdf");
  const isText = source.startsWith("data:text/") || lowerName.endsWith(".txt");

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
  isArchived = false,
  languageOptions,
  setCustomer,
  objects,
  onArchive,
  onAutoSave,
  onDelete,
  onRestore,
  onSubmit,
  submitLabel,
}: {
  customer: CustomerFormState;
  isArchived?: boolean;
  languageOptions: string[];
  setCustomer: (value: CustomerFormState) => void;
  objects: ObjectRecord[];
  onArchive?: () => void;
  onAutoSave?: (value: CustomerFormState) => void;
  onDelete?: () => void;
  onRestore?: () => void;
  onSubmit: () => void;
  submitLabel: string;
}) {
  const [loginHistoryOpen, setLoginHistoryOpen] = useState(false);
  const [mailTextsOpen, setMailTextsOpen] = useState(false);
  const [portalInvitePreview, setPortalInvitePreview] = useState<{ body: string; subject: string; to: string } | null>(null);
  const [portalInviteNotice, setPortalInviteNotice] = useState("");
  const [portalInviteSending, setPortalInviteSending] = useState(false);
  const customerFormRef = useRef(customer);

  useEffect(() => {
    customerFormRef.current = customer;
  }, [customer]);

  function autosaveField() {
    if (!onAutoSave) return;
    window.setTimeout(() => onAutoSave(customerFormRef.current), 0);
  }

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

  function inviteToPortal() {
    const invitedCustomer: CustomerFormState = {
      ...customer,
      portalLoginEmail: customer.portalLoginEmail.trim() || customer.email.trim(),
      portalPassword: portalPasswordFromAddress(customer.address),
      portalStatus: "aktiv",
    };

    setCustomer(invitedCustomer);
    setPortalInviteNotice("");
    setPortalInvitePreview({
      body: portalInviteBody(invitedCustomer),
      subject: portalInviteSubject(invitedCustomer),
      to: invitedCustomer.email.trim(),
    });
  }

  async function sendPortalInvite() {
    if (!portalInvitePreview || !portalInvitePreview.to.trim()) {
      setPortalInviteNotice("Bitte zuerst eine Empfänger-E-Mail erfassen.");
      return;
    }

    setPortalInviteSending(true);
    setPortalInviteNotice("");

    try {
      const response = await fetch("/api/portal/notify", {
        body: JSON.stringify({
          body: portalInvitePreview.body,
          replyTo: "info@kolaretorp.se",
          subject: portalInvitePreview.subject,
          to: portalInvitePreview.to,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json() as { error?: string; sent?: boolean };

      if (!response.ok || !payload.sent) {
        throw new Error(payload.error || "Einladung konnte nicht gesendet werden.");
      }

      setPortalInvitePreview(null);
      onSubmit();
    } catch (error) {
      setPortalInviteNotice(error instanceof Error ? error.message : "Einladung konnte nicht gesendet werden.");
    } finally {
      setPortalInviteSending(false);
    }
  }

  const availableObjects = objects.filter((object) => !customer.objects.includes(object.id));
  const assignedObjects = objects.filter((object) => customer.objects.includes(object.id));
  const customerNameParts = splitNameParts(customer.name);

  function updateCustomerName(part: "firstName" | "lastName", value: string) {
    update(
      "name",
      part === "firstName"
        ? joinNameParts(value, customerNameParts.lastName)
        : joinNameParts(customerNameParts.firstName, value),
    );
  }

  return (
    <div className="form-grid" onBlurCapture={autosaveField}>
      <h3>Kundendaten</h3>
      <div className="wide record-meta-line">
        <span>Kundennummer: {normalizeReadableNumber(customer.personalNumber) || "wird beim Speichern erstellt"}</span>
        <span>angelegt am: {formatCreatedAt(customer.createdAt)}</span>
      </div>
      <label><span>Vorname</span><input value={customerNameParts.firstName} onChange={(event) => updateCustomerName("firstName", event.target.value)} /></label>
      <label><span>Nachname</span><input value={customerNameParts.lastName} onChange={(event) => updateCustomerName("lastName", event.target.value)} /></label>
      <label><span>Ansprechpartner</span><input value={customer.contact} onChange={(event) => update("contact", event.target.value)} /></label>
      <label><span>E-Mail</span><input type="email" value={customer.email} onChange={(event) => update("email", event.target.value)} /></label>
      <label><span>Telefon</span><input value={customer.phone} onChange={(event) => update("phone", event.target.value)} /></label>
      <label><span>Telefon 2</span><input value={customer.phone2} onChange={(event) => update("phone2", event.target.value)} /></label>
      <AddressFields
        label="Adresse"
        value={customer.address}
        onChange={(part, value) => update("address", updateAddressPart(customer.address, part, value))}
      />
      <label>
        <span>Rechnungsadresse</span>
        <select
          value={customer.billingAddressMode}
          onChange={(event) => update("billingAddressMode", event.target.value)}
        >
          <option>Kundenadresse</option>
          <option>Abweichend</option>
        </select>
      </label>
      {customer.billingAddressMode === "Abweichend" && (
        <AddressFields
          label="Abweichende Rechnungsadresse"
          value={customer.billingAddress}
          onChange={(part, value) => update("billingAddress", updateAddressPart(customer.billingAddress, part, value))}
        />
      )}
      <label><span>Sprache</span>
        <input list="customer-language-options" value={customer.language} onChange={(event) => update("language", event.target.value)} />
        <datalist id="customer-language-options">
          {languageOptions.map((language) => <option key={language} value={language} />)}
        </datalist>
      </label>
      <label>
        <span>Portalstatus</span>
        <select value={customer.portalStatus} onChange={(event) => update("portalStatus", event.target.value)}>
          <option>aktiv</option>
          <option>einladen</option>
          <option>gesperrt</option>
        </select>
      </label>
      <section className="wide customer-preference-card">
        <div>
          <strong>Abrechnung</strong>
          <span>Standard für neue Aufträge dieses Kunden.</span>
        </div>
        <label className="checkbox-line">
          <input
            checked={customer.billable}
            onChange={(event) => setCustomer({ ...customer, billable: event.target.checked })}
            type="checkbox"
          />
          <span>Neue Aufträge in Abrechnung übernehmen</span>
        </label>
      </section>
      <h3>Portalzugang</h3>
      <label><span>Login-E-Mail</span><input type="email" value={customer.portalLoginEmail} onChange={(event) => update("portalLoginEmail", event.target.value)} /></label>
      <label><span>Portal-Passwort</span><input value={customer.portalPassword} onChange={(event) => update("portalPassword", event.target.value)} /></label>
      <button className="ghost-button wide" onClick={inviteToPortal} type="button">
        <KeyRound size={16} />
        Kunden ins Portal einladen
      </button>
      {portalInvitePreview && (
        <div className="modal-backdrop nested-backdrop">
          <section aria-labelledby="portal-invite-title" aria-modal="true" className="modal send-preview-modal" role="dialog">
            <header>
              <div>
                <p>Portal-Einladung</p>
                <h2 id="portal-invite-title">Einladung senden</h2>
              </div>
              <button aria-label="Einladungsvorschau schließen" onClick={() => setPortalInvitePreview(null)} type="button">
                <X size={18} />
              </button>
            </header>
            {portalInviteNotice && <div className="warning-line">{portalInviteNotice}</div>}
            <div className="send-preview-grid">
              <label className="wide">
                <span>An</span>
                <input type="email" value={portalInvitePreview.to} onChange={(event) => setPortalInvitePreview({ ...portalInvitePreview, to: event.target.value })} />
              </label>
              <label className="wide">
                <span>Betreff</span>
                <input value={portalInvitePreview.subject} onChange={(event) => setPortalInvitePreview({ ...portalInvitePreview, subject: event.target.value })} />
              </label>
              <label className="wide">
                <span>Nachricht</span>
                <textarea value={portalInvitePreview.body} onChange={(event) => setPortalInvitePreview({ ...portalInvitePreview, body: event.target.value })} />
              </label>
            </div>
            <div className="modal-actions">
              <button className="ghost-button" onClick={() => setPortalInvitePreview(null)} type="button">Abbrechen</button>
              <button className="primary-button" disabled={portalInviteSending} onClick={() => void sendPortalInvite()} type="button">
                <Send size={16} />
                {portalInviteSending ? "Senden..." : "Senden und Kundendaten speichern"}
              </button>
            </div>
          </section>
        </div>
      )}
      <div className="wide portal-login-history">
        <button className="job-fold-toggle" onClick={() => setLoginHistoryOpen((open) => !open)} type="button">
          {loginHistoryOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span>Login-Verlauf Kundenportal</span>
          <small>{(customer.portalLoginHistory ?? []).length}</small>
        </button>
        {loginHistoryOpen && (customer.portalLoginHistory ?? []).length > 0 ? (
          <div>
            {(customer.portalLoginHistory ?? []).map((entry) => (
              <article key={entry.id}>
                <strong>{entry.loggedAt}</strong>
                <span>{entry.email}</span>
                <small>{entry.userAgent}</small>
              </article>
            ))}
          </div>
        ) : loginHistoryOpen ? (
          <p>Noch keine Kundenportal-Logins protokolliert.</p>
        ) : null}
      </div>
      <label><span>Saldo</span><input value={customer.balance} onChange={(event) => update("balance", event.target.value)} /></label>
      <label className="wide"><span>Notizen / interne Info</span><textarea value={customer.notes} onChange={(event) => update("notes", event.target.value)} /></label>
      <label>
        <span>Zeit im Bericht</span>
        <select value={customer.workTimeVisibility} onChange={(event) => update("workTimeVisibility", event.target.value)}>
          <option value="service">Aus Leistung übernehmen</option>
          <option value="show">Immer anzeigen</option>
          <option value="hide">Immer ausblenden</option>
        </select>
      </label>
      <section className="wide customer-fold-section">
        <button className="job-fold-toggle" onClick={() => setMailTextsOpen((open) => !open)} type="button">
          {mailTextsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span>Mailtexte</span>
          <small>Einzelbericht, Wochenbericht, Offerte, Auftragsbestätigung</small>
        </button>
        {mailTextsOpen && (
          <div className="customer-mail-text-grid">
            <label className="wide">
              <span>Einzelbericht</span>
              <textarea
                value={customer.reportMailBody}
                onChange={(event) => update("reportMailBody", event.target.value)}
                placeholder={defaultReportMailBody}
              />
            </label>
            <label className="wide">
              <span>Wochenbericht</span>
              <textarea
                value={customer.weeklyReportMailBody}
                onChange={(event) => update("weeklyReportMailBody", event.target.value)}
                placeholder={defaultWeeklyReportMailBody}
              />
            </label>
            <label className="wide">
              <span>Offerte</span>
              <textarea
                value={customer.offerMailBody}
                onChange={(event) => update("offerMailBody", event.target.value)}
                placeholder={defaultOfferMailBody}
              />
            </label>
            <label className="wide">
              <span>Auftragsbestätigung</span>
              <textarea
                value={customer.orderConfirmationMailBody}
                onChange={(event) => update("orderConfirmationMailBody", event.target.value)}
                placeholder={defaultOrderConfirmationMailBody}
              />
            </label>
            <p className="customer-mail-text-hint">Platzhalter: {"{Vorname}"} wird beim Versand automatisch ersetzt.</p>
          </div>
        )}
      </section>
      <label className="wide">
        <span>Objekt zuordnen</span>
        <select value="" onChange={(event) => assignObject(event.target.value)}>
          <option value="">Objekt auswählen</option>
          {availableObjects.map((object) => (
            <option key={object.id} value={object.id}>{object.name} · {displayAddress(object.address)}</option>
          ))}
        </select>
      </label>
      <div className="wide check-list">
        <span>Zugeordnete Objekte</span>
        {assignedObjects.map((object) => (
          <div className="assigned-row" key={object.id}>
            <p>{object.name} · {displayAddress(object.address)}</p>
            <IconAction danger label={`Objekt ${object.name} entfernen`} onClick={() => removeObject(object.id)}><Trash2 size={16} /></IconAction>
          </div>
        ))}
        {customer.objects.length === 0 && <p>Noch keine Objekte zugeordnet.</p>}
      </div>
      <button className="primary-button wide" onClick={onSubmit} type="button">{submitLabel}</button>
      {(onArchive || onRestore || onDelete) && (
        <div className="wide record-dialog-actions">
          {isArchived ? (
            <>
              <button className="ghost-button" onClick={onRestore} type="button">
                <RotateCcw size={16} />
                Kunde wiederherstellen
              </button>
              <button className="ghost-button danger-action" onClick={onDelete} type="button">
                <Trash2 size={16} />
                Kunde endgültig löschen
              </button>
            </>
          ) : (
            <button className="ghost-button danger-action" onClick={onArchive} type="button">
              <Archive size={16} />
              Kunde archivieren
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function JobForm({
  customerMode = false,
  materials,
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
  materials: MaterialItem[];
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
  const [serviceEntryMode, setServiceEntryMode] = useState<"" | "catalog" | "manual">("");
  const [materialEntryMode, setMaterialEntryMode] = useState<"" | "catalog" | "manual">("");
  const recurrenceSummary = newJob.scheduleType === "einmalig"
    ? `Einmaliger Auftrag ${newJob.startDate === newJob.endDate ? `am ${newJob.startDate}` : `von ${newJob.startDate} bis ${newJob.endDate}`}`
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

  function updateStartDate(value: string) {
    setNewJob({
      ...newJob,
      dueDate: newJob.endDate === newJob.startDate || !newJob.endDate ? value : newJob.dueDate,
      endDate: newJob.endDate === newJob.startDate || !newJob.endDate ? value : newJob.endDate,
      startDate: value,
    });
  }

  function updateEndDate(value: string) {
    const endDate = value && value < newJob.startDate ? newJob.startDate : value;
    setNewJob({ ...newJob, dueDate: endDate || newJob.startDate, endDate });
  }

  function toggleService(serviceId: string) {
    const selected = newJob.serviceIds.includes(serviceId);
    const nextQuantities = { ...newJob.serviceQuantities };
    if (selected) {
      delete nextQuantities[serviceId];
    } else {
      nextQuantities[serviceId] = nextQuantities[serviceId] || "1";
    }
    setNewJob({
      ...newJob,
      serviceIds: selected ? newJob.serviceIds.filter((id) => id !== serviceId) : [...newJob.serviceIds, serviceId],
      serviceQuantities: nextQuantities,
    });
  }

  function addServiceFromCatalog(serviceId: string) {
    if (!serviceId || newJob.serviceIds.includes(serviceId)) return;
    setNewJob({
      ...newJob,
      serviceIds: [...newJob.serviceIds, serviceId],
      serviceQuantities: {
        ...newJob.serviceQuantities,
        [serviceId]: newJob.serviceQuantities[serviceId] || "1",
      },
    });
    setServiceEntryMode("");
  }

  function removeServiceFromJob(serviceId: string) {
    const nextQuantities = { ...newJob.serviceQuantities };
    const nextDiscounts = { ...newJob.serviceDiscounts };
    delete nextQuantities[serviceId];
    delete nextDiscounts[serviceId];
    setNewJob({
      ...newJob,
      serviceDiscounts: nextDiscounts,
      serviceIds: newJob.serviceIds.filter((id) => id !== serviceId),
      serviceQuantities: nextQuantities,
    });
  }

  function updateServiceQuantity(serviceId: string, quantity: string) {
    setNewJob({
      ...newJob,
      serviceQuantities: {
        ...newJob.serviceQuantities,
        [serviceId]: quantity,
      },
    });
  }

  function updateServiceDiscount(serviceId: string, discount: LineDiscount | undefined) {
    const nextDiscounts = { ...newJob.serviceDiscounts };
    if (discount) {
      nextDiscounts[serviceId] = discount;
    } else {
      delete nextDiscounts[serviceId];
    }
    setNewJob({ ...newJob, serviceDiscounts: nextDiscounts });
  }

  function changeServiceDiscount(serviceId: string, updates: Partial<LineDiscount>) {
    updateServiceDiscount(serviceId, {
      ...(newJob.serviceDiscounts[serviceId] ?? { reason: "", type: "amount", value: "0" }),
      ...updates,
    });
  }

  function changeMaterialDiscount(id: string, updates: Partial<LineDiscount>) {
    const current = newJob.materialItems.find((item) => item.id === id)?.discount;
    updateMaterialItem(id, {
      discount: {
        ...(current ?? { reason: "", type: "amount", value: "0" }),
        ...updates,
      },
    });
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

  function addMaterialFromCatalog(materialId: string) {
    const material = materials.find((item) => item.id === materialId);
    if (!material) return;

    setNewJob({
      ...newJob,
      materialItems: [
        ...newJob.materialItems,
        {
          accountingAccount: material.accountingAccount || defaultAccountingAccount("Material", material.name),
          category: material.category,
          currency: material.currency || "SEK",
          id: `JOB-MAT-${Date.now()}`,
          materialId: material.id,
          name: material.name,
          price: material.price,
          quantity: "1",
          taxRate: material.taxRate || "25",
          unit: material.unit,
        },
      ],
    });
  }

  function addFreeMaterial() {
    if (!newJob.materialName.trim()) return;

    setNewJob({
      ...newJob,
      materialCategory: "",
      materialName: "",
      materialPrice: "",
      materialQuantity: "1",
      materialUnit: "Stück",
      materialItems: [
        ...newJob.materialItems,
        {
          accountingAccount: defaultAccountingAccount("Material", newJob.materialName),
          category: newJob.materialCategory.trim() || "Material",
          currency: newJob.materialCurrency || "SEK",
          id: `JOB-MAT-${Date.now()}`,
          name: newJob.materialName.trim(),
          price: newJob.materialPrice.trim() || "0",
          quantity: newJob.materialQuantity.trim() || "1",
          saveToMaster: newJob.materialSaveToMaster,
          taxRate: newJob.materialTaxRate.trim() || "25",
          unit: newJob.materialUnit.trim() || "Stück",
        },
      ],
    });
  }

  function updateMaterialItem(id: string, updates: Partial<JobMaterialItem>) {
    setNewJob({
      ...newJob,
      materialItems: newJob.materialItems.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    });
  }

  function removeMaterialItem(id: string) {
    setNewJob({
      ...newJob,
      materialItems: newJob.materialItems.filter((item) => item.id !== id),
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
      {!customerMode && (
        <label>
          <span>Status</span>
          <select value={newJob.status} onChange={(event) => update("status", event.target.value as JobRecord["status"])}>
            <option value="offerte">Offerte</option>
            <option value="geplant">Auftrag geplant</option>
            <option value="in Arbeit">in Arbeit</option>
            <option value="pausiert">pausiert</option>
            <option value="erledigt">erledigt</option>
            <option value="abgerechnet">abgerechnet</option>
            <option value="storniert">storniert</option>
          </select>
        </label>
      )}
      <section className="wide customer-preference-card job-billing-card">
        <div>
          <strong>Abrechnung</strong>
          <span>Steuert, ob dieser Auftrag als Rechnungsentwurf vorbereitet wird.</span>
        </div>
        <label className="checkbox-line">
          <input
            checked={newJob.billable}
            onChange={(event) => setNewJob({ ...newJob, billable: event.target.checked })}
            type="checkbox"
          />
          <span>Auftrag in Abrechnung übernehmen</span>
        </label>
      </section>
      <div className="wide job-date-row">
        <label><span>Startet am</span><input type="date" value={newJob.startDate} onChange={(event) => updateStartDate(event.target.value)} /></label>
        <label><span>Endet am</span><input min={newJob.startDate} type="date" value={newJob.endDate} onChange={(event) => updateEndDate(event.target.value)} /></label>
      </div>
      {!customerMode && <label><span>Zuständig</span><input value={newJob.assignedTo} onChange={(event) => update("assignedTo", event.target.value)} /></label>}
      <section className="wide job-position-section">
        <div className="section-heading">
          <span>Leistungen</span>
          <strong>{newJob.serviceIds.length + (newJob.customServiceName.trim() ? 1 : 0)} Positionen</strong>
        </div>
        <div className="position-action-row">
          <button className="ghost-button" onClick={() => setServiceEntryMode(serviceEntryMode === "catalog" ? "" : "catalog")} type="button">
            <Plus size={16} />
            Leistung hinzufügen
          </button>
          <button className="ghost-button" onClick={() => setServiceEntryMode(serviceEntryMode === "manual" ? "" : "manual")} type="button">
            <Plus size={16} />
            Leistung manuell
          </button>
        </div>
        {serviceEntryMode === "catalog" && (
          <div className="add-position-panel">
            <label>
              <span>Angelegte Leistung auswählen</span>
              <select defaultValue="" onChange={(event) => {
                addServiceFromCatalog(event.target.value);
                event.currentTarget.value = "";
              }}>
                <option value="">Leistung auswählen...</option>
                {services.filter((service) => !service.archived && !newJob.serviceIds.includes(service.id)).map((service) => (
                  <option key={service.id} value={service.id}>{service.name} · {serviceRate(service)}</option>
                ))}
              </select>
            </label>
          </div>
        )}
        {newJob.serviceIds.length > 0 && (
          <div className="table-list compact-list job-position-list">
            {newJob.serviceIds.map((serviceId) => {
              const service = services.find((item) => item.id === serviceId);
              if (!service) return null;
              return (
                <article key={service.id}>
                  <div className="material-position-main">
                    <strong>{service.name}</strong>
                    <span>{service.category} · {serviceRate(service)}</span>
                  </div>
                  <label className="material-position-quantity"><span>Menge</span><input inputMode="decimal" value={newJob.serviceQuantities[service.id] || "1"} onChange={(event) => updateServiceQuantity(service.id, event.target.value)} /></label>
                  <strong className="material-position-total">{formatMoney(serviceLineAmount(service, newJob.serviceQuantities[service.id] || "1"), service.currency)}</strong>
                  <IconAction danger label={`Leistung ${service.name} entfernen`} onClick={() => removeServiceFromJob(service.id)}><Trash2 size={16} /></IconAction>
                  <div className="line-discount-editor material-line-discount">
                    {newJob.serviceDiscounts[service.id] ? (
                      <>
                        <select onChange={(event) => changeServiceDiscount(service.id, { type: event.target.value as LineDiscount["type"] })} value={newJob.serviceDiscounts[service.id].type}>
                          <option value="amount">Rabatt SEK</option>
                          <option value="percent">Rabatt %</option>
                        </select>
                        <input inputMode="decimal" onChange={(event) => changeServiceDiscount(service.id, { value: event.target.value })} placeholder="Wert" value={newJob.serviceDiscounts[service.id].value} />
                        <input onChange={(event) => changeServiceDiscount(service.id, { reason: event.target.value })} placeholder="Grund" value={newJob.serviceDiscounts[service.id].reason ?? ""} />
                        <IconAction danger label={`Rabatt ${service.name} entfernen`} onClick={() => updateServiceDiscount(service.id, undefined)}><Trash2 size={16} /></IconAction>
                      </>
                    ) : (
                      <button onClick={() => updateServiceDiscount(service.id, { reason: `Rabatt ${service.name}`, type: "amount", value: "0" })} type="button">
                        Rabatt hinzufügen
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {(serviceEntryMode === "manual" || newJob.customServiceName.trim()) && (
          <div className="add-position-panel">
            <div className="section-heading">
              <span>Manuelle Leistung</span>
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
              <label><span>Menge</span><input inputMode="decimal" value={newJob.customServiceQuantity} onChange={(event) => update("customServiceQuantity", event.target.value)} /></label>
              <label><span>Preis netto</span><input value={newJob.customServicePrice} onChange={(event) => update("customServicePrice", event.target.value)} /></label>
              <label><span>Währung</span><select value={newJob.customServiceCurrency} onChange={(event) => update("customServiceCurrency", event.target.value)}><option>SEK</option><option>EUR</option><option>NOK</option><option>DKK</option></select></label>
              <label><span>Moms %</span><input inputMode="decimal" value={newJob.customServiceTaxRate} onChange={(event) => update("customServiceTaxRate", event.target.value)} /></label>
              <div className="wide line-discount-editor">
                {newJob.serviceDiscounts.customService ? (
                  <>
                    <select onChange={(event) => changeServiceDiscount("customService", { type: event.target.value as LineDiscount["type"] })} value={newJob.serviceDiscounts.customService.type}>
                      <option value="amount">Rabatt SEK</option>
                      <option value="percent">Rabatt %</option>
                    </select>
                    <input inputMode="decimal" onChange={(event) => changeServiceDiscount("customService", { value: event.target.value })} placeholder="Wert" value={newJob.serviceDiscounts.customService.value} />
                    <input onChange={(event) => changeServiceDiscount("customService", { reason: event.target.value })} placeholder="Grund" value={newJob.serviceDiscounts.customService.reason ?? ""} />
                    <IconAction danger label="Rabatt für Leistung entfernen" onClick={() => updateServiceDiscount("customService", undefined)}><Trash2 size={16} /></IconAction>
                  </>
                ) : (
                  <button disabled={!newJob.customServiceName.trim()} onClick={() => updateServiceDiscount("customService", { reason: "Rabatt", type: "amount", value: "0" })} type="button">
                    Rabatt für Leistung hinzufügen
                  </button>
                )}
              </div>
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
          </div>
        )}
      </section>
      <section className="wide job-position-section">
        <div className="section-heading">
          <span>Material</span>
          <strong>{newJob.materialItems.length} Positionen</strong>
        </div>
        <div className="position-action-row">
          <button className="ghost-button" onClick={() => setMaterialEntryMode(materialEntryMode === "catalog" ? "" : "catalog")} type="button">
            <Plus size={16} />
            Material hinzufügen
          </button>
          <button className="ghost-button" onClick={() => setMaterialEntryMode(materialEntryMode === "manual" ? "" : "manual")} type="button">
            <Plus size={16} />
            Material manuell
          </button>
        </div>
        {materialEntryMode === "catalog" && (
          <div className="add-position-panel">
            <label>
              <span>Material aus Stammdaten auswählen</span>
              <select defaultValue="" onChange={(event) => {
                addMaterialFromCatalog(event.target.value);
                event.currentTarget.value = "";
                setMaterialEntryMode("");
              }}>
                <option value="">Material auswählen...</option>
                {materials.filter((material) => !material.archived).map((material) => (
                  <option key={material.id} value={material.id}>{material.name} · {materialRate(material)}</option>
                ))}
              </select>
            </label>
          </div>
        )}
        {materialEntryMode === "manual" && (
          <div className="add-position-panel form-grid compact-form">
            <label><span>Freies Material</span><input value={newJob.materialName} onChange={(event) => update("materialName", event.target.value)} placeholder="z.B. Filter, Farbe, Schrauben" /></label>
            <label><span>Kategorie</span><input value={newJob.materialCategory} onChange={(event) => update("materialCategory", event.target.value)} /></label>
            <label><span>Einheit</span><input value={newJob.materialUnit} onChange={(event) => update("materialUnit", event.target.value)} /></label>
            <label><span>Menge</span><input inputMode="decimal" value={newJob.materialQuantity} onChange={(event) => update("materialQuantity", event.target.value)} /></label>
            <label><span>Moms %</span><input inputMode="decimal" value={newJob.materialTaxRate} onChange={(event) => update("materialTaxRate", event.target.value)} /></label>
            <div className="price-currency-row">
              <label><span>Preis netto</span><input inputMode="decimal" value={newJob.materialPrice} onChange={(event) => update("materialPrice", event.target.value)} /></label>
              <label><span>Währung</span><select value={newJob.materialCurrency} onChange={(event) => update("materialCurrency", event.target.value)}><option>SEK</option><option>EUR</option><option>NOK</option><option>DKK</option></select></label>
            </div>
            <label className="checkbox-line wide">
              <input checked={newJob.materialSaveToMaster} onChange={(event) => setNewJob({ ...newJob, materialSaveToMaster: event.target.checked })} type="checkbox" />
              <span>Freies Material beim Speichern in Stammdaten übernehmen</span>
            </label>
            <button className="ghost-button wide" disabled={!newJob.materialName.trim()} onClick={() => { addFreeMaterial(); setMaterialEntryMode(""); }} type="button">
              <Plus size={16} />
              Materialposition hinzufügen
            </button>
          </div>
        )}
        {newJob.materialItems.length > 0 && (
          <div className="table-list compact-list material-position-list">
            {newJob.materialItems.map((item) => (
              <article key={item.id}>
                <div className="material-position-main">
                  <strong>{item.name}</strong>
                  <span>{item.category} · {item.quantity} {item.unit} · {materialRate(item)}</span>
                </div>
                <label className="material-position-quantity"><span>Menge</span><input value={item.quantity} onChange={(event) => updateMaterialItem(item.id, { quantity: event.target.value })} /></label>
                <strong className="material-position-total">{Math.round(materialLineAmount(item)).toLocaleString("sv-SE")} {item.currency}</strong>
                <IconAction danger label={`Material ${item.name} entfernen`} onClick={() => removeMaterialItem(item.id)}><Trash2 size={16} /></IconAction>
                <div className="line-discount-editor material-line-discount">
                  {item.discount ? (
                    <>
                      <select onChange={(event) => changeMaterialDiscount(item.id, { type: event.target.value as LineDiscount["type"] })} value={item.discount.type}>
                        <option value="amount">Rabatt SEK</option>
                        <option value="percent">Rabatt %</option>
                      </select>
                      <input inputMode="decimal" onChange={(event) => changeMaterialDiscount(item.id, { value: event.target.value })} placeholder="Wert" value={item.discount.value} />
                      <input onChange={(event) => changeMaterialDiscount(item.id, { reason: event.target.value })} placeholder="Grund" value={item.discount.reason ?? ""} />
                      <IconAction danger label={`Rabatt ${item.name} entfernen`} onClick={() => updateMaterialItem(item.id, { discount: undefined })}><Trash2 size={16} /></IconAction>
                    </>
                  ) : (
                    <button onClick={() => updateMaterialItem(item.id, { discount: { reason: `Rabatt ${item.name}`, type: "amount", value: "0" } })} type="button">
                      Rabatt hinzufügen
                    </button>
                  )}
                </div>
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
      {newJob.discountValue.trim() ? (
        <section className="wide job-position-section">
          <div className="section-heading">
            <span>Pauschaler Rabatt</span>
            <strong>{newJob.discountValue}{newJob.discountType === "percent" ? "%" : " SEK"}</strong>
          </div>
          <div className="compact-form global-discount-grid">
            <label>
              <span>Rabattart</span>
              <select value={newJob.discountType} onChange={(event) => update("discountType", event.target.value as NewJobFormState["discountType"])}>
                <option value="amount">Betrag</option>
                <option value="percent">Prozent</option>
              </select>
            </label>
            <label>
              <span>{newJob.discountType === "percent" ? "Rabatt %" : "Rabattbetrag"}</span>
              <input inputMode="decimal" placeholder={newJob.discountType === "percent" ? "z.B. 10" : "z.B. 500"} value={newJob.discountValue} onChange={(event) => update("discountValue", event.target.value)} />
            </label>
            <label>
              <span>Bezeichnung / Grund</span>
              <input placeholder="z.B. Kundenrabatt" value={newJob.discountReason} onChange={(event) => update("discountReason", event.target.value)} />
            </label>
            <div className="field-action-cell">
              <IconAction danger label="Pauschalen Rabatt entfernen" onClick={() => setNewJob({ ...newJob, discountReason: "", discountValue: "" })}><Trash2 size={16} /></IconAction>
            </div>
          </div>
        </section>
      ) : (
        <button className="ghost-button wide" onClick={() => setNewJob({ ...newJob, discountReason: "Rabatt", discountType: "amount", discountValue: "0" })} type="button">
          <Plus size={16} />
          Pauschalen Rabatt hinzufügen
        </button>
      )}
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
