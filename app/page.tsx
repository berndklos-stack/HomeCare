"use client";

import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Database,
  Hammer,
  Home,
  Languages,
  Leaf,
  MailCheck,
  MapPin,
  Menu,
  MessageSquare,
  Moon,
  PanelLeftClose,
  Plus,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Sun,
  Trees,
  Users,
  Waves,
  Wrench,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { appVersion, versionHistory } from "@/lib/appVersion";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type Language = "de" | "sv" | "en";
type View = "team" | "owner" | "mobile";
type NavTarget =
  | "overview"
  | "masterData"
  | "objects"
  | "customers"
  | "services"
  | "jobs"
  | "schedule"
  | "communication"
  | "billing"
  | "approvals";
type ModalMode = "job" | "object" | "report" | "property" | "version" | null;
type Theme = "light" | "dark";

const languageLabels: Record<Language, string> = {
  de: "DE",
  sv: "SV",
  en: "EN",
};

const translations = {
  de: {
    tagline: "Ferienhausverwaltung Småland",
    navLabel: "Hauptnavigation",
    nav: [
      "Dashboard",
      "Stammdaten",
      "Objekte",
      "Kunden",
      "Leistungskatalog",
      "Aufträge",
      "Termine",
      "Kommunikation",
      "Abrechnung",
      "Freigaben",
    ],
    navTargets: [
      "overview",
      "masterData",
      "objects",
      "customers",
      "services",
      "jobs",
      "schedule",
      "communication",
      "billing",
      "approvals",
    ],
    contact: "Kontakt",
    menuOpen: "Menü öffnen",
    menuClose: "Menü schließen",
    lightMode: "Hellmodus",
    darkMode: "Dunkelmodus",
    versionLabel: "Version",
    versionHistory: "Änderungsverlauf",
    latestChanges: "Aktuelle Änderungen",
    product: "Kolaretorp Service AB",
    headline: "Servicezentrale für Ferienhäuser",
    newJob: "Neuer Auftrag",
    newObject: "Neues Objekt",
    viewLabel: "Ansicht wählen",
    views: {
      team: "Verwaltung",
      owner: "Kundenportal",
      mobile: "Mobil vor Ort",
    },
    heroKicker: "Heute in Bearbeitung",
    heroText:
      "wird aktuell betreut. Nach Abschluss wird der Bericht intern geprüft und automatisch für die Eigentümer-Mail vorbereitet.",
    openReport: "Bericht öffnen",
    propertyFile: "Objektakte",
    dayStats: "Tageskennzahlen",
    stats: ["aktive Objekte", "offene Einsätze", "Freigaben"],
    sourceLive: "Live-Daten",
    sourceDemo: "Demo-Daten",
    sourceLoading: "Daten werden geladen",
    sourceError: "Supabase nicht lesbar",
    operations: "Operations",
    jobsAndStatus: "Aufträge und Status",
    addJob: "Auftrag hinzufügen",
    createJob: "Auftrag anlegen",
    createObject: "Objekt anlegen",
    close: "Schließen",
    jobTitleLabel: "Titel",
    propertyLabel: "Objekt",
    ownerLabel: "Eigentümer",
    locationLabel: "Ort",
    serviceLabel: "Leistung",
    statusLabel: "Status",
    newJobAdded: "Auftrag wurde lokal angelegt",
    newObjectAdded: "Objekt wurde lokal angelegt",
    serviceFiltered: "Leistung gefiltert",
    filterAll: "Alle Leistungen",
    selectedJob: "Ausgewählter Auftrag",
    selectedProperty: "Ausgewähltes Objekt",
    objectOverview: "Objektübersicht",
    jobOverview: "Auftragsübersicht",
    scheduleOverview: "Einsatzplan",
    approvalOverview: "Freigabeübersicht",
    dashboardJump: "Direkt in den Bereich",
    masterDataOverview: "Stammdatenübersicht",
    customerOverview: "Kundenübersicht",
    serviceOverview: "Leistungskatalog",
    communicationOverview: "Kommunikation",
    billingOverview: "Abrechnung",
    objectsHint: "Objektakten, Zugang, Pflegepakete und Eigentümerzuordnung",
    customersHint: "Eigentümer, Ansprechpartner, Sprache, Portal und offene Salden",
    servicesHint: "Katalog, Preise, Intervalle, SLA und abrechenbare Leistungen",
    jobsHint: "Aufträge, Status, Zuständigkeit und nächste Schritte",
    scheduleHint: "Termine, Teams, Einsatzfenster und mobile Ausführung",
    communicationHint: "Kundenmails, Rückfragen und Vorlagen mit Objektbezug",
    billingHint: "Rechnungen, fällige Posten, Monatsabrechnung und Leistungslinien",
    approvalsHint: "Interne Prüfung vor Kundenversand und Abrechnung",
    records: "Datensätze",
    customerLabel: "Kunde",
    emailLabel: "E-Mail",
    phoneLabel: "Telefon",
    languageLabel: "Sprache",
    balanceLabel: "Saldo",
    serviceCatalog: "Dienstleistungskatalog",
    categoryLabel: "Kategorie",
    intervalLabel: "Intervall",
    priceLabel: "Preis",
    unitLabel: "Einheit",
    slaLabel: "SLA",
    channelLabel: "Kanal",
    subjectLabel: "Betreff",
    dueLabel: "Fällig",
    amountLabel: "Betrag",
    invoiceLabel: "Rechnung",
    nextStepLabel: "Nächster Schritt",
    portalOpened: "Kundenportal vorbereitet",
    messagePrepared: "Nachricht vorbereitet",
    invoicePrepared: "Rechnung vorbereitet",
    catalogSelected: "Katalogposition ausgewählt",
    openCustomers: "Kunden öffnen",
    openServices: "Katalog öffnen",
    openBilling: "Abrechnung öffnen",
    startVisit: "Einsatz starten",
    approveJob: "Freigeben",
    openDetails: "Details öffnen",
    openPortal: "Portal öffnen",
    noApprovals: "Keine offenen Freigaben",
    reportDetails: "Berichtdetails",
    propertyDetails: "Objektdaten",
    noFilteredJobs: "Keine Aufträge für diese Leistung",
    approvalSent: "Auftrag wurde zur Freigabe markiert",
    services: "Leistungen",
    catalog: "Katalog",
    masterData: "Stammdaten",
    properties: "Objekte",
    ownerAccess: "Eigentümerzugang",
    ownerView: "Kundenansicht",
    status: "Status",
    nextAppointment: "Nächster Termin",
    lastReport: "Letzter Bericht",
    seasonActive: "Saisonbetrieb aktiv",
    gardenCareDate: "31.07. Gartenpflege",
    poolToday: "Poolpflege heute",
    orderHistory: "Auftragsverlauf",
    transparency: "Transparenz",
    autoMail: "Automatische Mail nach Freigabe",
    reportDraft: "Berichtsentwurf an Familie Andersson",
    mailText:
      "Enthält erledigte Arbeiten, Fotos, Material, Zeiten, Empfehlungen und nächsten Termin. Versand erfolgt erst nach interner Freigabe.",
    onSite: "Vor Ort",
    currentVisit: "Aktueller Einsatz",
    checksDone: "Checkpunkte erledigt",
    sendApproval: "Zur Freigabe senden",
    mobileFunctions: "Mobile Funktionen",
    mobileTitle: "Alles dabei beim Einsatz",
    mobileText:
      "Stammdaten, Checklisten, Fotos, Zeiten, Materialverbrauch und Berichtsentwurf sind für die Arbeit vor Ort in einer kompakten Ansicht vorbereitet.",
    notes: [
      "Offline-freundliche Eingabe",
      "Bericht aus Checkliste",
      "Saison- und Objektpflege",
    ],
    servicesList: [
      "Hausverwaltung",
      "Gartenpflege",
      "Reparaturen",
      "Baumassnahmen",
      "Poolpflege",
      "Objektkontrollen",
    ],
    jobTitles: [
      "Poolpflege und Wasserwerte",
      "Rasen, Hecken und Sichtprüfung",
      "Terrassentür justieren",
    ],
    jobStatuses: ["In Arbeit", "Geplant", "Freigabe"],
    jobServices: ["Poolpflege", "Gartenpflege", "Reparatur"],
    objectStatuses: ["Saisonbetrieb", "Sommerklar", "Kontrolle offen"],
    lastVisits: ["Heute, 09:20", "28.07., 14:10", "26.07., 11:45"],
    checklist: [
      "Anfahrt und Objektzugang dokumentiert",
      "Fotos vor Arbeitsbeginn hinzugefügt",
      "Wasserwerte und Verbrauchsmaterial erfasst",
      "Abschlussfoto und Notizen ergänzen",
      "Bericht zur Freigabe markieren",
    ],
    timeline: [
      "Einsatz gestartet",
      "Checkliste bearbeitet",
      "Fotos angehängt",
      "Interne Prüfung",
      "Mail an Eigentümer",
    ],
    statusLabels: {
      planned: "Geplant",
      in_progress: "In Arbeit",
      waiting_for_approval: "Freigabe",
      approved: "Freigegeben",
      sent: "Versendet",
      completed: "Erledigt",
      cancelled: "Storniert",
    },
  },
  sv: {
    tagline: "Fritidshusförvaltning i Småland",
    navLabel: "Huvudnavigation",
    nav: [
      "Dashboard",
      "Grunddata",
      "Objekt",
      "Kunder",
      "Tjänstekatalog",
      "Uppdrag",
      "Tider",
      "Kommunikation",
      "Fakturering",
      "Godkännanden",
    ],
    navTargets: [
      "overview",
      "masterData",
      "objects",
      "customers",
      "services",
      "jobs",
      "schedule",
      "communication",
      "billing",
      "approvals",
    ],
    contact: "Kontakt",
    menuOpen: "Öppna meny",
    menuClose: "Stäng meny",
    lightMode: "Ljust läge",
    darkMode: "Mörkt läge",
    versionLabel: "Version",
    versionHistory: "Ändringshistorik",
    latestChanges: "Senaste ändringar",
    product: "Kolaretorp Service AB",
    headline: "Servicecentral för fritidshus",
    newJob: "Nytt uppdrag",
    newObject: "Nytt objekt",
    viewLabel: "Välj vy",
    views: {
      team: "Förvaltning",
      owner: "Kundportal",
      mobile: "Mobilt på plats",
    },
    heroKicker: "Pågår idag",
    heroText:
      "hanteras just nu. Efter avslut kontrolleras rapporten internt och förbereds automatiskt för e-post till ägaren.",
    openReport: "Öppna rapport",
    propertyFile: "Objektakt",
    dayStats: "Dagens nyckeltal",
    stats: ["aktiva objekt", "öppna uppdrag", "godkännanden"],
    sourceLive: "Live-data",
    sourceDemo: "Demo-data",
    sourceLoading: "Data laddas",
    sourceError: "Supabase kan inte läsas",
    operations: "Drift",
    jobsAndStatus: "Uppdrag och status",
    addJob: "Lägg till uppdrag",
    createJob: "Skapa uppdrag",
    createObject: "Skapa objekt",
    close: "Stäng",
    jobTitleLabel: "Titel",
    propertyLabel: "Objekt",
    ownerLabel: "Ägare",
    locationLabel: "Ort",
    serviceLabel: "Tjänst",
    statusLabel: "Status",
    newJobAdded: "Uppdraget skapades lokalt",
    newObjectAdded: "Objektet skapades lokalt",
    serviceFiltered: "Tjänst filtrerad",
    filterAll: "Alla tjänster",
    selectedJob: "Valt uppdrag",
    selectedProperty: "Valt objekt",
    objectOverview: "Objektöversikt",
    jobOverview: "Uppdragsöversikt",
    scheduleOverview: "Insatsplan",
    approvalOverview: "Godkännanden",
    dashboardJump: "Gå direkt till området",
    masterDataOverview: "Grunddataöversikt",
    customerOverview: "Kundöversikt",
    serviceOverview: "Tjänstekatalog",
    communicationOverview: "Kommunikation",
    billingOverview: "Fakturering",
    objectsHint: "Objektakter, åtkomst, skötselpaket och ägarkoppling",
    customersHint: "Ägare, kontaktpersoner, språk, portal och öppna saldon",
    servicesHint: "Katalog, priser, intervall, SLA och fakturerbara tjänster",
    jobsHint: "Uppdrag, status, ansvar och nästa steg",
    scheduleHint: "Tider, team, insatsfönster och mobil utförande",
    communicationHint: "Kundmail, frågor och mallar kopplade till objekt",
    billingHint: "Fakturor, förfallna poster, månadsavräkning och tjänsterader",
    approvalsHint: "Intern kontroll före kundutskick och fakturering",
    records: "Poster",
    customerLabel: "Kund",
    emailLabel: "E-post",
    phoneLabel: "Telefon",
    languageLabel: "Språk",
    balanceLabel: "Saldo",
    serviceCatalog: "Tjänstekatalog",
    categoryLabel: "Kategori",
    intervalLabel: "Intervall",
    priceLabel: "Pris",
    unitLabel: "Enhet",
    slaLabel: "SLA",
    channelLabel: "Kanal",
    subjectLabel: "Ärende",
    dueLabel: "Förfaller",
    amountLabel: "Belopp",
    invoiceLabel: "Faktura",
    nextStepLabel: "Nästa steg",
    portalOpened: "Kundportal förberedd",
    messagePrepared: "Meddelande förberett",
    invoicePrepared: "Faktura förberedd",
    catalogSelected: "Katalogpost vald",
    openCustomers: "Öppna kunder",
    openServices: "Öppna katalog",
    openBilling: "Öppna fakturering",
    startVisit: "Starta insats",
    approveJob: "Godkänn",
    openDetails: "Öppna detaljer",
    openPortal: "Öppna portal",
    noApprovals: "Inga öppna godkännanden",
    reportDetails: "Rapportdetaljer",
    propertyDetails: "Objektdata",
    noFilteredJobs: "Inga uppdrag för den tjänsten",
    approvalSent: "Uppdraget markerades för godkännande",
    services: "Tjänster",
    catalog: "Katalog",
    masterData: "Grunddata",
    properties: "Objekt",
    ownerAccess: "Ägaråtkomst",
    ownerView: "Kundvy",
    status: "Status",
    nextAppointment: "Nästa tid",
    lastReport: "Senaste rapport",
    seasonActive: "Säsongsdrift aktiv",
    gardenCareDate: "31.07. Trädgårdsskötsel",
    poolToday: "Poolskötsel idag",
    orderHistory: "Uppdragshistorik",
    transparency: "Transparens",
    autoMail: "Automatiskt e-post efter godkännande",
    reportDraft: "Rapportutkast till familjen Andersson",
    mailText:
      "Innehåller utfört arbete, foton, material, tider, rekommendationer och nästa tid. Utskick sker först efter intern godkänning.",
    onSite: "På plats",
    currentVisit: "Aktuell insats",
    checksDone: "kontrollpunkter klara",
    sendApproval: "Skicka för godkännande",
    mobileFunctions: "Mobila funktioner",
    mobileTitle: "Allt med vid insatsen",
    mobileText:
      "Grunddata, checklistor, foton, tider, materialförbrukning och rapportutkast är förberedda för arbetet på plats i en kompakt vy.",
    notes: [
      "Offline-vänlig registrering",
      "Rapport från checklista",
      "Säsongs- och objektskötsel",
    ],
    servicesList: [
      "Husförvaltning",
      "Trädgårdsskötsel",
      "Reparationer",
      "Byggåtgärder",
      "Poolskötsel",
      "Objektkontroller",
    ],
    jobTitles: [
      "Poolskötsel och vattenvärden",
      "Gräsmatta, häckar och kontroll",
      "Justera altandörr",
    ],
    jobStatuses: ["Pågår", "Planerat", "Godkännande"],
    jobServices: ["Poolskötsel", "Trädgårdsskötsel", "Reparation"],
    objectStatuses: ["Säsongsdrift", "Sommarklart", "Kontroll öppen"],
    lastVisits: ["Idag, 09:20", "28.07., 14:10", "26.07., 11:45"],
    checklist: [
      "Ankomst och objekttillgång dokumenterad",
      "Foton före arbetsstart tillagda",
      "Vattenvärden och förbrukningsmaterial registrerade",
      "Lägg till slutfoto och noteringar",
      "Markera rapport för godkännande",
    ],
    timeline: [
      "Insats startad",
      "Checklista bearbetad",
      "Foton bifogade",
      "Intern kontroll",
      "E-post till ägare",
    ],
    statusLabels: {
      planned: "Planerat",
      in_progress: "Pågår",
      waiting_for_approval: "Godkännande",
      approved: "Godkänt",
      sent: "Skickat",
      completed: "Klart",
      cancelled: "Avbrutet",
    },
  },
  en: {
    tagline: "Holiday home management in Småland",
    navLabel: "Main navigation",
    nav: [
      "Dashboard",
      "Master data",
      "Properties",
      "Customers",
      "Service catalog",
      "Jobs",
      "Schedule",
      "Communication",
      "Billing",
      "Approvals",
    ],
    navTargets: [
      "overview",
      "masterData",
      "objects",
      "customers",
      "services",
      "jobs",
      "schedule",
      "communication",
      "billing",
      "approvals",
    ],
    contact: "Contact",
    menuOpen: "Open menu",
    menuClose: "Close menu",
    lightMode: "Light mode",
    darkMode: "Dark mode",
    versionLabel: "Version",
    versionHistory: "Change history",
    latestChanges: "Latest changes",
    product: "Kolaretorp Service AB",
    headline: "Service hub for holiday homes",
    newJob: "New job",
    newObject: "New property",
    viewLabel: "Choose view",
    views: {
      team: "Management",
      owner: "Customer portal",
      mobile: "Mobile on site",
    },
    heroKicker: "In progress today",
    heroText:
      "is currently being serviced. After completion, the report is reviewed internally and prepared automatically for the owner email.",
    openReport: "Open report",
    propertyFile: "Property file",
    dayStats: "Daily metrics",
    stats: ["active properties", "open jobs", "approvals"],
    sourceLive: "Live data",
    sourceDemo: "Demo data",
    sourceLoading: "Loading data",
    sourceError: "Supabase not readable",
    operations: "Operations",
    jobsAndStatus: "Jobs and status",
    addJob: "Add job",
    createJob: "Create job",
    createObject: "Create property",
    close: "Close",
    jobTitleLabel: "Title",
    propertyLabel: "Property",
    ownerLabel: "Owner",
    locationLabel: "Location",
    serviceLabel: "Service",
    statusLabel: "Status",
    newJobAdded: "Job was created locally",
    newObjectAdded: "Property was created locally",
    serviceFiltered: "Service filtered",
    filterAll: "All services",
    selectedJob: "Selected job",
    selectedProperty: "Selected property",
    objectOverview: "Property overview",
    jobOverview: "Job overview",
    scheduleOverview: "Schedule",
    approvalOverview: "Approvals",
    dashboardJump: "Open workspace area",
    masterDataOverview: "Master data overview",
    customerOverview: "Customer overview",
    serviceOverview: "Service catalog",
    communicationOverview: "Communication",
    billingOverview: "Billing",
    objectsHint: "Property files, access, care packages and owner assignment",
    customersHint: "Owners, contacts, language, portal and open balances",
    servicesHint: "Catalog, prices, intervals, SLA and billable services",
    jobsHint: "Jobs, status, responsibility and next steps",
    scheduleHint: "Appointments, teams, service windows and mobile execution",
    communicationHint: "Customer email, questions and templates linked to properties",
    billingHint: "Invoices, due items, monthly billing and service lines",
    approvalsHint: "Internal review before customer email and billing",
    records: "Records",
    customerLabel: "Customer",
    emailLabel: "Email",
    phoneLabel: "Phone",
    languageLabel: "Language",
    balanceLabel: "Balance",
    serviceCatalog: "Service catalog",
    categoryLabel: "Category",
    intervalLabel: "Interval",
    priceLabel: "Price",
    unitLabel: "Unit",
    slaLabel: "SLA",
    channelLabel: "Channel",
    subjectLabel: "Subject",
    dueLabel: "Due",
    amountLabel: "Amount",
    invoiceLabel: "Invoice",
    nextStepLabel: "Next step",
    portalOpened: "Customer portal prepared",
    messagePrepared: "Message prepared",
    invoicePrepared: "Invoice prepared",
    catalogSelected: "Catalog item selected",
    openCustomers: "Open customers",
    openServices: "Open catalog",
    openBilling: "Open billing",
    startVisit: "Start visit",
    approveJob: "Approve",
    openDetails: "Open details",
    openPortal: "Open portal",
    noApprovals: "No open approvals",
    reportDetails: "Report details",
    propertyDetails: "Property data",
    noFilteredJobs: "No jobs for this service",
    approvalSent: "Job was marked for approval",
    services: "Services",
    catalog: "Catalog",
    masterData: "Master data",
    properties: "Properties",
    ownerAccess: "Owner access",
    ownerView: "Customer view",
    status: "Status",
    nextAppointment: "Next appointment",
    lastReport: "Last report",
    seasonActive: "Season operation active",
    gardenCareDate: "31.07. Garden care",
    poolToday: "Pool care today",
    orderHistory: "Job history",
    transparency: "Transparency",
    autoMail: "Automatic email after approval",
    reportDraft: "Report draft to the Andersson family",
    mailText:
      "Includes completed work, photos, materials, times, recommendations and the next appointment. Email is sent only after internal approval.",
    onSite: "On site",
    currentVisit: "Current visit",
    checksDone: "checks completed",
    sendApproval: "Send for approval",
    mobileFunctions: "Mobile functions",
    mobileTitle: "Everything ready on site",
    mobileText:
      "Master data, checklists, photos, time entries, material usage and the report draft are prepared for on-site work in a compact view.",
    notes: [
      "Offline-friendly entry",
      "Report from checklist",
      "Season and property care",
    ],
    servicesList: [
      "House management",
      "Garden care",
      "Repairs",
      "Construction work",
      "Pool care",
      "Property checks",
    ],
    jobTitles: [
      "Pool care and water values",
      "Lawn, hedges and visual check",
      "Adjust patio door",
    ],
    jobStatuses: ["In progress", "Planned", "Approval"],
    jobServices: ["Pool care", "Garden care", "Repair"],
    objectStatuses: ["Season operation", "Summer ready", "Check open"],
    lastVisits: ["Today, 09:20", "28.07., 14:10", "26.07., 11:45"],
    checklist: [
      "Arrival and property access documented",
      "Photos before work start added",
      "Water values and consumables recorded",
      "Add final photo and notes",
      "Mark report for approval",
    ],
    timeline: [
      "Visit started",
      "Checklist updated",
      "Photos attached",
      "Internal review",
      "Email to owner",
    ],
    statusLabels: {
      planned: "Planned",
      in_progress: "In progress",
      waiting_for_approval: "Approval",
      approved: "Approved",
      sent: "Sent",
      completed: "Completed",
      cancelled: "Cancelled",
    },
  },
} satisfies Record<Language, Record<string, unknown>>;

const serviceIcons = [Home, Leaf, Wrench, Hammer, Waves, ShieldCheck];
const navIcons = [
  PanelLeftClose,
  Database,
  Home,
  Users,
  BookOpen,
  ClipboardCheck,
  CalendarDays,
  MessageSquare,
  ReceiptText,
  MailCheck,
];

type AppJob = {
  id: string;
  title: string;
  object: string;
  owner: string;
  status: string;
  service: string;
  progress: number;
};

type AppJobSeed = Omit<AppJob, "title" | "status" | "service"> & {
  titleKey: number;
  statusKey: number;
  serviceKey: number;
};

type AppObject = {
  name: string;
  owner: string;
  location: string;
  status: string;
  lastVisit: string;
};

type AppObjectSeed = Omit<AppObject, "status" | "lastVisit"> & {
  statusKey: number;
  lastVisitKey: number;
};

type CustomerRecord = {
  name: string;
  contact: string;
  email: string;
  phone: string;
  language: string;
  objects: string[];
  balance: string;
  nextStep: string;
};

type ServiceCatalogItem = {
  name: string;
  category: string;
  interval: string;
  price: string;
  unit: string;
  sla: string;
};

type MessageRecord = {
  customer: string;
  channel: string;
  subject: string;
  status: string;
  object: string;
  due: string;
};

type InvoiceRecord = {
  number: string;
  customer: string;
  object: string;
  amount: string;
  status: string;
  due: string;
};

type LiveData = {
  jobs: AppJob[];
  objects: AppObject[];
  services: string[];
};

type DataState = "loading" | "live" | "demo" | "error";

const demoJobSeeds = [
  {
    id: "KS-2407",
    titleKey: 0,
    object: "Villa Långsjön",
    owner: "Familie Andersson",
    statusKey: 0,
    serviceKey: 4,
    progress: 68,
  },
  {
    id: "KS-2408",
    titleKey: 1,
    object: "Stuga Nybro",
    owner: "M. Schneider",
    statusKey: 1,
    serviceKey: 1,
    progress: 22,
  },
  {
    id: "KS-2409",
    titleKey: 2,
    object: "Kolaretorp 106",
    owner: "Kolaretorp Service AB",
    statusKey: 2,
    serviceKey: 2,
    progress: 96,
  },
] satisfies AppJobSeed[];

const demoObjectSeeds = [
  {
    name: "Villa Långsjön",
    owner: "Familie Andersson",
    location: "Orrefors",
    statusKey: 0,
    lastVisitKey: 0,
  },
  {
    name: "Stuga Nybro",
    owner: "M. Schneider",
    location: "Nybro",
    statusKey: 1,
    lastVisitKey: 1,
  },
  {
    name: "Haus am Wald",
    owner: "B. Klos",
    location: "Småland",
    statusKey: 2,
    lastVisitKey: 2,
  },
] satisfies AppObjectSeed[];

const customerRecords = [
  {
    name: "Familie Andersson",
    contact: "Eva Andersson",
    email: "eva.andersson@example.com",
    phone: "+46 70 118 44 20",
    language: "SV / DE",
    objects: ["Villa Långsjön"],
    balance: "0 SEK",
    nextStep: "Bericht nach Poolpflege freigeben",
  },
  {
    name: "M. Schneider",
    contact: "Markus Schneider",
    email: "markus.schneider@example.com",
    phone: "+49 171 440 22 18",
    language: "DE",
    objects: ["Stuga Nybro"],
    balance: "1.840 SEK",
    nextStep: "Monatsrechnung vorbereiten",
  },
  {
    name: "B. Klos",
    contact: "Bernd Klos",
    email: "bernd@example.com",
    phone: "+46 76 101 81 86",
    language: "DE / EN",
    objects: ["Haus am Wald"],
    balance: "0 SEK",
    nextStep: "Saisonkontrolle terminieren",
  },
] satisfies CustomerRecord[];

const serviceCatalogItems = [
  {
    name: "Hausverwaltung",
    category: "Betreuung",
    interval: "monatlich",
    price: "1.490 SEK",
    unit: "Pauschale",
    sla: "48h Rückmeldung",
  },
  {
    name: "Gartenpflege",
    category: "Außenbereich",
    interval: "14-tägig",
    price: "540 SEK",
    unit: "Stunde",
    sla: "Saisonplan",
  },
  {
    name: "Reparaturen",
    category: "Technik",
    interval: "nach Bedarf",
    price: "690 SEK",
    unit: "Stunde",
    sla: "Priorität nach Schaden",
  },
  {
    name: "Poolpflege",
    category: "Außenbereich",
    interval: "wöchentlich",
    price: "620 SEK",
    unit: "Termin",
    sla: "Sommerbetrieb",
  },
] satisfies ServiceCatalogItem[];

const messageRecords = [
  {
    customer: "Familie Andersson",
    channel: "E-Mail",
    subject: "Poolwerte und nächste Kontrolle",
    status: "Entwurf",
    object: "Villa Långsjön",
    due: "heute",
  },
  {
    customer: "M. Schneider",
    channel: "Portal",
    subject: "Rasenpflege bestätigt",
    status: "Gesendet",
    object: "Stuga Nybro",
    due: "29.07.",
  },
  {
    customer: "B. Klos",
    channel: "Telefon",
    subject: "Schlüsselcode aktualisieren",
    status: "Rückfrage",
    object: "Haus am Wald",
    due: "01.08.",
  },
] satisfies MessageRecord[];

const invoiceRecords = [
  {
    number: "RE-2026-071",
    customer: "M. Schneider",
    object: "Stuga Nybro",
    amount: "1.840 SEK",
    status: "fällig",
    due: "05.08.2026",
  },
  {
    number: "RE-2026-072",
    customer: "Familie Andersson",
    object: "Villa Långsjön",
    amount: "2.110 SEK",
    status: "Entwurf",
    due: "10.08.2026",
  },
  {
    number: "RE-2026-069",
    customer: "B. Klos",
    object: "Haus am Wald",
    amount: "0 SEK",
    status: "bezahlt",
    due: "25.07.2026",
  },
] satisfies InvoiceRecord[];

const checklistDone = [true, true, true, false, false];

function getStatusProgress(status: string) {
  const normalized = status.toLowerCase();

  if (normalized.includes("completed") || normalized.includes("sent")) {
    return 100;
  }

  if (normalized.includes("approved") || normalized.includes("approval")) {
    return 92;
  }

  if (normalized.includes("progress")) {
    return 68;
  }

  if (normalized.includes("planned")) {
    return 24;
  }

  return 45;
}

function humanizeStatus(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nestedName(value: unknown, fallback: string) {
  if (!isRecord(value)) {
    return fallback;
  }

  const name = value.name ?? value.full_name;
  return typeof name === "string" && name.trim() ? name : fallback;
}

function translatedList(t: Record<string, unknown>, key: string) {
  const value = t[key];
  return Array.isArray(value) ? value.map(String) : [];
}

function translatedStatus(t: Record<string, unknown>, status: string) {
  const labels = t.statusLabels;
  return isRecord(labels) && typeof labels[status] === "string"
    ? labels[status]
    : humanizeStatus(status);
}

export default function HomePage() {
  const [view, setView] = useState<View>("team");
  const [section, setSection] = useState<NavTarget>("overview");
  const [isAppReady, setIsAppReady] = useState(false);
  const [language, setLanguage] = useState<Language>("de");
  const [liveData, setLiveData] = useState<LiveData | null>(null);
  const [localJobs, setLocalJobs] = useState<AppJob[]>([]);
  const [localObjects, setLocalObjects] = useState<AppObject[]>([]);
  const [jobOverrides, setJobOverrides] = useState<Record<string, Partial<AppJob>>>({});
  const [activeJobId, setActiveJobId] = useState("KS-2407");
  const [selectedObjectName, setSelectedObjectName] = useState("Villa Långsjön");
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    const savedTheme = window.localStorage.getItem("kolaretorp-theme");
    return savedTheme === "dark" ? "dark" : "light";
  });
  const [notice, setNotice] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [checklistState, setChecklistState] = useState(checklistDone);
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newJobObject, setNewJobObject] = useState("Villa Långsjön");
  const [newJobService, setNewJobService] = useState("");
  const [newObjectName, setNewObjectName] = useState("");
  const [newObjectOwner, setNewObjectOwner] = useState("");
  const [newObjectLocation, setNewObjectLocation] = useState("");
  const [dataState, setDataState] = useState<DataState>(() =>
    getSupabaseBrowserClient() ? "loading" : "demo",
  );
  const t = translations[language];
  const serviceLabels = translatedList(t, "servicesList");
  const demoJobs = demoJobSeeds.map((job) => ({
    id: job.id,
    object: job.object,
    owner: job.owner,
    progress: job.progress,
    title: translatedList(t, "jobTitles")[job.titleKey] ?? job.object,
    status: translatedList(t, "jobStatuses")[job.statusKey] ?? "",
    service: serviceLabels[job.serviceKey] ?? "",
  }));
  const demoObjects = demoObjectSeeds.map((object) => ({
    name: object.name,
    owner: object.owner,
    location: object.location,
    status: translatedList(t, "objectStatuses")[object.statusKey] ?? "",
    lastVisit: translatedList(t, "lastVisits")[object.lastVisitKey] ?? "",
  }));
  const jobs = [
    ...localJobs,
    ...(liveData?.jobs.length ? liveData.jobs : demoJobs),
  ].map((job) => ({ ...job, ...jobOverrides[job.id] }));
  const objects = [
    ...localObjects,
    ...(liveData?.objects.length ? liveData.objects : demoObjects),
  ];
  const services = liveData?.services.length
    ? liveData.services
    : serviceLabels;
  const activeServiceFilter =
    selectedService && services.includes(selectedService) ? selectedService : null;
  const filteredJobs = activeServiceFilter
    ? jobs.filter((job) => job.service === activeServiceFilter)
    : jobs;
  const approvalJobs = jobs.filter((job) =>
    ["approval", "freigabe", "godkännande"].some((status) =>
      job.status.toLowerCase().includes(status),
    ),
  );
  const activeJob = jobs.find((job) => job.id === activeJobId) ?? jobs[0];
  const activeObject =
    objects.find((object) => object.name === selectedObjectName) ??
    objects.find((object) => object.name === activeJob.object) ??
    objects[0];
  const completedItems = useMemo(
    () => checklistState.filter(Boolean).length,
    [checklistState],
  );
  const stats = [objects.length, jobs.length, approvalJobs.length];
  const moduleCards = [
    {
      target: "masterData",
      title: String(t.masterDataOverview),
      text: `${objects.length + customerRecords.length + serviceCatalogItems.length} ${String(t.records)}`,
      hint: String(t.objectsHint),
      icon: Database,
    },
    {
      target: "objects",
      title: String(t.objectOverview),
      text: `${objects.length} ${String(t.properties)}`,
      hint: String(t.objectsHint),
      icon: Home,
    },
    {
      target: "customers",
      title: String(t.customerOverview),
      text: `${customerRecords.length} ${String(t.records)}`,
      hint: String(t.customersHint),
      icon: Users,
    },
    {
      target: "services",
      title: String(t.serviceOverview),
      text: `${serviceCatalogItems.length} ${String(t.records)}`,
      hint: String(t.servicesHint),
      icon: BookOpen,
    },
    {
      target: "jobs",
      title: String(t.jobOverview),
      text: `${jobs.length} ${String(t.records)}`,
      hint: String(t.jobsHint),
      icon: ClipboardCheck,
    },
    {
      target: "schedule",
      title: String(t.scheduleOverview),
      text: String(t.nextAppointment),
      hint: String(t.scheduleHint),
      icon: CalendarDays,
    },
    {
      target: "communication",
      title: String(t.communicationOverview),
      text: `${messageRecords.length} ${String(t.records)}`,
      hint: String(t.communicationHint),
      icon: MessageSquare,
    },
    {
      target: "billing",
      title: String(t.billingOverview),
      text: `${invoiceRecords.length} ${String(t.records)}`,
      hint: String(t.billingHint),
      icon: ReceiptText,
    },
  ] satisfies Array<{
    target: NavTarget;
    title: string;
    text: string;
    hint: string;
    icon: typeof Home;
  }>;
  const dataLabel =
    dataState === "live"
      ? String(t.sourceLive)
      : dataState === "loading"
        ? String(t.sourceLoading)
        : dataState === "error"
          ? String(t.sourceError)
          : String(t.sourceDemo);
  const navTargets = (
    Array.isArray(t.navTargets)
      ? t.navTargets
      : [
          "overview",
          "masterData",
          "objects",
          "customers",
          "services",
          "jobs",
          "schedule",
          "communication",
          "billing",
          "approvals",
        ]
  ) as NavTarget[];
  const currentVersion = versionHistory[0];

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2500);
  }

  function changeView(nextView: View) {
    setView(nextView);
    if (nextView === "team") {
      setSection("overview");
    }
    setIsSidebarOpen(false);
  }

  function handleNav(target: NavTarget) {
    setView("team");
    setSection(target);
    setModalMode(null);
    setIsSidebarOpen(false);
  }

  function openNewJob() {
    setNewJobTitle("");
    setNewJobObject(objects[0]?.name ?? "");
    setNewJobService(services[0] ?? "");
    setModalMode("job");
  }

  function openNewObject() {
    setNewObjectName("");
    setNewObjectOwner("");
    setNewObjectLocation("");
    setModalMode("object");
  }

  function createLocalObject() {
    const createdObject: AppObject = {
      name: newObjectName.trim() || String(t.newObject),
      owner: newObjectOwner.trim() || "Kolaretorp Service AB",
      location: newObjectLocation.trim() || "Småland",
      status: translatedList(t, "objectStatuses")[1] ?? String(t.status),
      lastVisit: "-",
    };

    setLocalObjects((currentObjects) => [createdObject, ...currentObjects]);
    setSelectedObjectName(createdObject.name);
    setNewJobObject(createdObject.name);
    setSection("objects");
    setModalMode(null);
    showNotice(String(t.newObjectAdded));
  }

  function createLocalJob() {
    const title = newJobTitle.trim() || String(t.newJob);
    const object = objects.find((item) => item.name === newJobObject) ?? objects[0];
    const service = newJobService || services[0] || String(t.services);
    const createdJob: AppJob = {
      id: `KS-${Date.now().toString().slice(-5)}`,
      title,
      object: object?.name ?? newJobObject,
      owner: object?.owner ?? "Kolaretorp Service AB",
      status: translatedList(t, "jobStatuses")[1] ?? String(t.status),
      service,
      progress: 12,
    };

    setLocalJobs((currentJobs) => [createdJob, ...currentJobs]);
    setActiveJobId(createdJob.id);
    setSelectedObjectName(createdJob.object);
    setSelectedService(null);
    setModalMode(null);
    setView("team");
    setSection("jobs");
    showNotice(String(t.newJobAdded));
  }

  function selectJob(job: AppJob) {
    setActiveJobId(job.id);
    setSelectedObjectName(job.object);
    showNotice(`${String(t.selectedJob)}: ${job.title}`);
  }

  function selectService(service: string) {
    setSelectedService((currentService) =>
      currentService === service ? null : service,
    );
    showNotice(`${String(t.serviceFiltered)}: ${service}`);
  }

  function openCustomer(customer: CustomerRecord) {
    setSelectedObjectName(customer.objects[0] ?? selectedObjectName);
    setView("owner");
    showNotice(`${String(t.portalOpened)}: ${customer.name}`);
  }

  function prepareMessage(message: MessageRecord) {
    setSelectedObjectName(message.object);
    setSection("communication");
    showNotice(`${String(t.messagePrepared)}: ${message.subject}`);
  }

  function prepareInvoice(invoice: InvoiceRecord) {
    setSelectedObjectName(invoice.object);
    setSection("billing");
    showNotice(`${String(t.invoicePrepared)}: ${invoice.number}`);
  }

  function selectCatalogItem(item: ServiceCatalogItem) {
    const translatedService =
      services.find((service) => service.toLowerCase() === item.name.toLowerCase()) ??
      item.name;
    selectService(translatedService);
    setSection("jobs");
    showNotice(`${String(t.catalogSelected)}: ${item.name}`);
  }

  function sendApproval() {
    setJobOverrides((currentOverrides) => ({
      ...currentOverrides,
      [activeJob.id]: {
        status: translatedList(t, "jobStatuses")[2] ?? String(t.status),
        progress: Math.max(activeJob.progress, 92),
      },
    }));
    setChecklistState((items) => items.map(() => true));
    showNotice(String(t.approvalSent));
  }

  function approveJob(job: AppJob) {
    setJobOverrides((currentOverrides) => ({
      ...currentOverrides,
      [job.id]: {
        status: translatedStatus(t, "approved"),
        progress: 100,
      },
    }));
    setActiveJobId(job.id);
    showNotice(`${String(t.approveJob)}: ${job.title}`);
  }

  function startVisit(job: AppJob) {
    selectJob(job);
    changeView("mobile");
  }

  function toggleTheme() {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === "dark" ? "light" : "dark";
      window.localStorage.setItem("kolaretorp-theme", nextTheme);
      return nextTheme;
    });
  }

  useEffect(() => {
    const readyTimer = window.setTimeout(() => setIsAppReady(true), 0);
    return () => window.clearTimeout(readyTimer);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const client = getSupabaseBrowserClient();

    if (!client) {
      return;
    }

    const supabase = client;

    async function loadData() {
      const [propertiesResult, jobsResult, servicesResult] = await Promise.all([
        supabase
          .from("properties")
          .select("id,name,address,region,profiles(full_name)")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("jobs")
          .select(
            "id,title,status,property_id,category_id,properties(name,profiles(full_name)),service_categories(name)",
          )
          .order("updated_at", { ascending: false })
          .limit(20),
        supabase
          .from("service_categories")
          .select("name")
          .order("name", { ascending: true })
          .limit(8),
      ]);

      if (!isMounted) {
        return;
      }

      if (propertiesResult.error || jobsResult.error || servicesResult.error) {
        setDataState("error");
        return;
      }

      const mappedObjects = ((propertiesResult.data ?? []) as Record<string, unknown>[]).map((property) => ({
        name: String(property.name ?? "Objekt"),
        owner: nestedName(property.profiles, "Eigentümer"),
        location: String(property.region ?? property.address ?? "Småland"),
        status: translatedStatus(t, "in_progress"),
        lastVisit: "-",
      }));

      const mappedJobs = ((jobsResult.data ?? []) as Record<string, unknown>[]).map((job, index) => ({
        id: `KS-${String(index + 1).padStart(4, "0")}`,
        title: String(job.title ?? "Auftrag"),
        object: nestedName(job.properties, "Objekt"),
        owner: isRecord(job.properties)
          ? nestedName(job.properties.profiles, "Eigentümer")
          : "Eigentümer",
        status: translatedStatus(t, String(job.status ?? "planned")),
        service: nestedName(job.service_categories, "Service"),
        progress: getStatusProgress(String(job.status ?? "planned")),
      }));

      const mappedServices = ((servicesResult.data ?? []) as Record<string, unknown>[])
        .map((service) => service.name)
        .filter((service): service is string => typeof service === "string");

      if (mappedObjects.length || mappedJobs.length || mappedServices.length) {
        setLiveData({
          jobs: mappedJobs,
          objects: mappedObjects,
          services: mappedServices,
        });
        setDataState("live");
      } else {
        setDataState("demo");
      }
    }

    loadData().catch(() => {
      if (isMounted) {
        setDataState("error");
      }
    });

    return () => {
      isMounted = false;
    };
  }, [t]);

  return (
    <main className="min-h-screen" data-ready={isAppReady} data-theme={theme}>
      <section className="app-shell">
        <aside className={`sidebar ${isSidebarOpen ? "open" : ""}`}>
          <div className="brand-block">
            <Image
              src="/kolaretorp-logo-white.png"
              width={320}
              height={134}
              alt="Kolaretorp Service AB"
              priority
            />
            <span>{String(t.tagline)}</span>
          </div>

          <nav className="nav-list" aria-label={String(t.navLabel)}>
            {navIcons.map(
              (Icon, index) => (
                <button
                  className={view === "team" && navTargets[index] === section ? "active" : ""}
                  data-testid={`nav-${navTargets[index] ?? "overview"}`}
                  key={String(t.nav[index])}
                  onClick={() => handleNav(navTargets[index] ?? "overview")}
                  type="button"
                >
                  <Icon size={18} /> {String(t.nav[index])}
                </button>
              ),
            )}
          </nav>

          <div className="sidebar-card">
            <p>{String(t.contact)}</p>
            <strong>Kolaretorp 106, 38293 Nybro</strong>
            <span>info@kolaretorp.se</span>
            <span>076 - 1018186</span>
          </div>
          <button
            className="version-card"
            onClick={() => setModalMode("version")}
            type="button"
          >
            <span>{String(t.versionLabel)}</span>
            <strong>v{appVersion.version}</strong>
            <small>{appVersion.releaseDate}</small>
          </button>
        </aside>

        <div className="workspace">
          <header className="topbar">
            <button
              className="icon-button"
              aria-label={String(isSidebarOpen ? t.menuClose : t.menuOpen)}
              onClick={() => setIsSidebarOpen((open) => !open)}
              type="button"
            >
              <Menu size={20} />
            </button>
            <div>
              <p className="eyebrow">{String(t.product)}</p>
              <h1>{String(t.headline)}</h1>
            </div>
            <div className="topbar-actions">
              <button
                className="version-pill"
                onClick={() => setModalMode("version")}
                type="button"
              >
                v{appVersion.version}
              </button>
              <span className={`data-source ${dataState}`}>{dataLabel}</span>
              <button
                className="theme-toggle"
                aria-label={String(theme === "dark" ? t.lightMode : t.darkMode)}
                onClick={toggleTheme}
                type="button"
              >
                {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
                <span>{String(theme === "dark" ? t.lightMode : t.darkMode)}</span>
              </button>
              <div className="language-switch" aria-label="Language">
                <Languages size={17} />
                {(Object.keys(languageLabels) as Language[]).map((lang) => (
                  <button
                    className={language === lang ? "selected" : ""}
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    type="button"
                  >
                    {languageLabels[lang]}
                  </button>
                ))}
              </div>
              <button className="primary-action" onClick={openNewJob} type="button">
                <Plus size={18} /> {String(t.newJob)}
              </button>
            </div>
          </header>

          {notice && <div className="notice">{notice}</div>}

          <div className="view-switch" role="tablist" aria-label={String(t.viewLabel)}>
            {(["team", "owner", "mobile"] as View[]).map((item) => (
              <button
                className={view === item ? "selected" : ""}
                key={item}
                onClick={() => changeView(item)}
                type="button"
              >
                {String(t.views[item])}
              </button>
            ))}
          </div>

          <section className="hero-panel">
            <div>
              <p className="eyebrow">{String(t.heroKicker)}</p>
              <h2>{activeJob.title}</h2>
              <p>
                {activeJob.object} {String(t.heroText)}
              </p>
              <div className="hero-actions">
                <button
                  className="primary-action"
                  onClick={() => {
                    setModalMode("report");
                    changeView("owner");
                  }}
                  type="button"
                >
                  {String(t.openReport)} <ChevronRight size={18} />
                </button>
                <button
                  className="secondary-action"
                  onClick={() => {
                    setModalMode("property");
                    changeView("owner");
                  }}
                  type="button"
                >
                  {String(t.propertyFile)}
                </button>
              </div>
            </div>
            <div className="hero-stats" aria-label={String(t.dayStats)}>
              {stats.map((value, index) => (
                <div key={String(t.stats[index])}>
                  <strong>{value}</strong>
                  <span>{String(t.stats[index])}</span>
                </div>
              ))}
            </div>
          </section>

          {view === "team" && section === "overview" && (
            <>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">{String(t.dashboardJump)}</p>
                    <h3>Dashboard</h3>
                  </div>
                </div>
                <div className="module-grid">
                  {moduleCards.map((card) => {
                    const Icon = card.icon;

                    return (
                      <button
                        key={card.target}
                        onClick={() => handleNav(card.target)}
                        type="button"
                      >
                        <span className="module-icon">
                          <Icon size={20} />
                        </span>
                        <strong>{card.title}</strong>
                        <small>{card.text}</small>
                        <p>{card.hint}</p>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="content-grid">
              <div className="panel wide">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">{String(t.operations)}</p>
                    <h3>{String(t.jobsAndStatus)}</h3>
                  </div>
                  <button
                    className="icon-button"
                    aria-label={String(t.addJob)}
                    onClick={openNewJob}
                    type="button"
                  >
                    <Plus size={18} />
                  </button>
                </div>
                <div className="job-list">
                  {filteredJobs.map((job) => (
                    <button
                      className={`job-row ${activeJob.id === job.id ? "selected" : ""}`}
                      key={job.id}
                      onClick={() => selectJob(job)}
                      type="button"
                    >
                      <div className="job-icon">
                        <ClipboardCheck size={19} />
                      </div>
                      <div>
                        <strong>{job.title}</strong>
                        <span>
                          {job.object} · {job.owner}
                        </span>
                      </div>
                      <p>{job.service}</p>
                      <div className="progress">
                        <span style={{ width: `${job.progress}%` }} />
                      </div>
                      <mark>{job.status}</mark>
                    </button>
                  ))}
                  {!filteredJobs.length && (
                    <p className="empty-state">{String(t.noFilteredJobs)}</p>
                  )}
                </div>
              </div>

              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">{String(t.services)}</p>
                    <h3>{String(t.catalog)}</h3>
                  </div>
                </div>
                <div className="service-grid">
                  <button
                    className={!activeServiceFilter ? "selected" : ""}
                    onClick={() => {
                      setSelectedService(null);
                      showNotice(String(t.filterAll));
                    }}
                    type="button"
                  >
                    <ClipboardCheck size={20} />
                    <span>{String(t.filterAll)}</span>
                  </button>
                  {services.slice(0, serviceIcons.length).map((service, index) => {
                    const Icon = serviceIcons[index] ?? ClipboardCheck;

                    return (
                    <button
                      className={activeServiceFilter === service ? "selected" : ""}
                      key={service}
                      onClick={() => selectService(service)}
                      type="button"
                    >
                      <Icon size={20} />
                      <span>{service}</span>
                    </button>
                    );
                  })}
                </div>
              </div>

              <div className="panel wide">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">{String(t.masterData)}</p>
                    <h3>{String(t.properties)}</h3>
                  </div>
                </div>
                <div className="object-table">
                  {objects.map((object) => (
                    <button
                      className={activeObject.name === object.name ? "selected" : ""}
                      key={object.name}
                      onClick={() => {
                        setNewJobObject(object.name);
                        setSelectedObjectName(object.name);
                        showNotice(`${String(t.selectedProperty)}: ${object.name}`);
                      }}
                      type="button"
                    >
                      <div>
                        <strong>{object.name}</strong>
                        <span>{object.owner}</span>
                      </div>
                      <span>
                        <MapPin size={15} /> {object.location}
                      </span>
                      <mark>{object.status}</mark>
                      <small>{object.lastVisit}</small>
                    </button>
                  ))}
                </div>
              </div>
            </section>
            </>
          )}

          {view === "team" && section === "masterData" && (
            <section className="content-grid">
              <div className="panel wide">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">{String(t.masterData)}</p>
                    <h3>{String(t.masterDataOverview)}</h3>
                  </div>
                </div>
                <div className="master-grid">
                  {moduleCards.slice(1, 4).map((card) => {
                    const Icon = card.icon;

                    return (
                      <button key={card.target} onClick={() => handleNav(card.target)} type="button">
                        <Icon size={21} />
                        <strong>{card.title}</strong>
                        <span>{card.hint}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">{String(t.records)}</p>
                    <h3>{String(t.nextStepLabel)}</h3>
                  </div>
                </div>
                <div className="quick-actions">
                  <button className="secondary-action" onClick={openNewObject} type="button">
                    <Plus size={18} /> {String(t.newObject)}
                  </button>
                  <button className="secondary-action" onClick={() => handleNav("customers")} type="button">
                    <Users size={18} /> {String(t.openCustomers)}
                  </button>
                  <button className="secondary-action" onClick={() => handleNav("services")} type="button">
                    <BookOpen size={18} /> {String(t.openServices)}
                  </button>
                </div>
              </div>
            </section>
          )}

          {view === "team" && section === "customers" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">{String(t.masterData)}</p>
                  <h3>{String(t.customerOverview)}</h3>
                </div>
              </div>
              <div className="data-table customer-table">
                {customerRecords.map((customer) => (
                  <article key={customer.email}>
                    <div>
                      <span>{String(t.customerLabel)}</span>
                      <strong>{customer.name}</strong>
                      <small>{customer.contact}</small>
                    </div>
                    <div>
                      <span>{String(t.emailLabel)}</span>
                      <strong>{customer.email}</strong>
                      <small>{customer.phone}</small>
                    </div>
                    <div>
                      <span>{String(t.properties)}</span>
                      <strong>{customer.objects.join(", ")}</strong>
                      <small>
                        {String(t.languageLabel)}: {customer.language}
                      </small>
                    </div>
                    <div>
                      <span>{String(t.balanceLabel)}</span>
                      <strong>{customer.balance}</strong>
                      <small>{customer.nextStep}</small>
                    </div>
                    <button className="secondary-action" onClick={() => openCustomer(customer)} type="button">
                      {String(t.openPortal)}
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}

          {view === "team" && section === "services" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">{String(t.catalog)}</p>
                  <h3>{String(t.serviceCatalog)}</h3>
                </div>
              </div>
              <div className="catalog-grid">
                {serviceCatalogItems.map((item) => (
                  <button key={item.name} onClick={() => selectCatalogItem(item)} type="button">
                    <strong>{item.name}</strong>
                    <span>
                      {String(t.categoryLabel)}: {item.category}
                    </span>
                    <small>
                      {item.interval} · {item.price} / {item.unit}
                    </small>
                    <mark>{item.sla}</mark>
                  </button>
                ))}
              </div>
            </section>
          )}

          {view === "team" && section === "jobs" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">{String(t.operations)}</p>
                  <h3>{String(t.jobOverview)}</h3>
                </div>
                <button className="primary-action" onClick={openNewJob} type="button">
                  <Plus size={18} /> {String(t.newJob)}
                </button>
              </div>
              <div className="job-list">
                {filteredJobs.map((job) => (
                  <button
                    className={`job-row ${activeJob.id === job.id ? "selected" : ""}`}
                    key={job.id}
                    onClick={() => selectJob(job)}
                    type="button"
                  >
                    <div className="job-icon">
                      <ClipboardCheck size={19} />
                    </div>
                    <div>
                      <strong>{job.title}</strong>
                      <span>
                        {job.object} · {job.owner}
                      </span>
                    </div>
                    <p>{job.service}</p>
                    <div className="progress">
                      <span style={{ width: `${job.progress}%` }} />
                    </div>
                    <mark>{job.status}</mark>
                  </button>
                ))}
              </div>
            </section>
          )}

          {view === "team" && section === "objects" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">{String(t.masterData)}</p>
                  <h3>{String(t.objectOverview)}</h3>
                </div>
                <button className="primary-action" onClick={openNewObject} type="button">
                  <Plus size={18} /> {String(t.newObject)}
                </button>
              </div>
              <div className="object-table management-table">
                {objects.map((object) => (
                  <button
                    className={activeObject.name === object.name ? "selected" : ""}
                    key={object.name}
                    onClick={() => {
                      setSelectedObjectName(object.name);
                      setNewJobObject(object.name);
                      setModalMode("property");
                    }}
                    type="button"
                  >
                    <div>
                      <strong>{object.name}</strong>
                      <span>{object.owner}</span>
                    </div>
                    <span>
                      <MapPin size={15} /> {object.location}
                    </span>
                    <mark>{object.status}</mark>
                    <small>{object.lastVisit}</small>
                  </button>
                ))}
              </div>
            </section>
          )}

          {view === "team" && section === "schedule" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">{String(t.operations)}</p>
                  <h3>{String(t.scheduleOverview)}</h3>
                </div>
              </div>
              <div className="action-list">
                {jobs.map((job) => (
                  <article key={job.id}>
                    <div>
                      <strong>{job.title}</strong>
                      <span>
                        {job.object} · {job.service}
                      </span>
                    </div>
                    <button className="secondary-action" onClick={() => startVisit(job)} type="button">
                      {String(t.startVisit)}
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}

          {view === "team" && section === "communication" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">{String(t.autoMail)}</p>
                  <h3>{String(t.communicationOverview)}</h3>
                </div>
              </div>
              <div className="data-table communication-table">
                {messageRecords.map((message) => (
                  <article key={`${message.customer}-${message.subject}`}>
                    <div>
                      <span>{String(t.customerLabel)}</span>
                      <strong>{message.customer}</strong>
                      <small>{message.object}</small>
                    </div>
                    <div>
                      <span>{String(t.channelLabel)}</span>
                      <strong>{message.channel}</strong>
                      <small>{message.status}</small>
                    </div>
                    <div>
                      <span>{String(t.subjectLabel)}</span>
                      <strong>{message.subject}</strong>
                      <small>
                        {String(t.dueLabel)}: {message.due}
                      </small>
                    </div>
                    <button className="secondary-action" onClick={() => prepareMessage(message)} type="button">
                      {String(t.openDetails)}
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}

          {view === "team" && section === "billing" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">{String(t.billingHint)}</p>
                  <h3>{String(t.billingOverview)}</h3>
                </div>
                <button className="primary-action" onClick={() => handleNav("jobs")} type="button">
                  <ClipboardCheck size={18} /> {String(t.jobOverview)}
                </button>
              </div>
              <div className="data-table billing-table">
                {invoiceRecords.map((invoice) => (
                  <article key={invoice.number}>
                    <div>
                      <span>{String(t.invoiceLabel)}</span>
                      <strong>{invoice.number}</strong>
                      <small>{invoice.object}</small>
                    </div>
                    <div>
                      <span>{String(t.customerLabel)}</span>
                      <strong>{invoice.customer}</strong>
                      <small>
                        {String(t.dueLabel)}: {invoice.due}
                      </small>
                    </div>
                    <div>
                      <span>{String(t.amountLabel)}</span>
                      <strong>{invoice.amount}</strong>
                      <small>{invoice.status}</small>
                    </div>
                    <button className="secondary-action" onClick={() => prepareInvoice(invoice)} type="button">
                      {String(t.openDetails)}
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}

          {view === "team" && section === "approvals" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">{String(t.autoMail)}</p>
                  <h3>{String(t.approvalOverview)}</h3>
                </div>
              </div>
              <div className="action-list">
                {approvalJobs.map((job) => (
                  <article key={job.id}>
                    <div>
                      <strong>{job.title}</strong>
                      <span>
                        {job.object} · {job.owner}
                      </span>
                    </div>
                    <button className="primary-action" onClick={() => approveJob(job)} type="button">
                      {String(t.approveJob)}
                    </button>
                  </article>
                ))}
                {!approvalJobs.length && (
                  <p className="empty-state">{String(t.noApprovals)}</p>
                )}
              </div>
            </section>
          )}

          {view === "owner" && (
            <section className="owner-view">
              <div className="panel wide">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">{String(t.ownerAccess)}</p>
                    <h3>{activeObject.name}</h3>
                  </div>
                  <mark className="soft">{String(t.ownerView)}</mark>
                </div>
                <div className="owner-summary">
                  <div>
                    <span>{String(t.status)}</span>
                    <strong>{activeObject.status || String(t.seasonActive)}</strong>
                  </div>
                  <div>
                    <span>{String(t.nextAppointment)}</span>
                    <strong>{String(t.gardenCareDate)}</strong>
                  </div>
                  <div>
                    <span>{String(t.lastReport)}</span>
                    <strong>{activeJob.title || String(t.poolToday)}</strong>
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">{String(t.orderHistory)}</p>
                    <h3>{String(t.transparency)}</h3>
                  </div>
                </div>
                <ol className="timeline">
                  {translatedList(t, "timeline").map((step, index) => (
                    <li key={String(step)} className={index < 3 ? "done" : ""}>
                      <span />
                      {String(step)}
                    </li>
                  ))}
                </ol>
              </div>

              <div className="panel wide">
                <div className="mail-preview">
                  <div className="mail-icon">
                    <MailCheck size={26} />
                  </div>
                  <div>
                    <p className="eyebrow">{String(t.autoMail)}</p>
                    <h3>{activeJob.title}</h3>
                    <p>{String(t.mailText)}</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {view === "mobile" && (
            <section className="mobile-work">
              <div className="phone-frame">
                <div className="phone-top">
                  <Image
                    src="/kolaretorp-logo.png"
                    width={134}
                    height={46}
                    alt="Kolaretorp"
                  />
                  <span>{String(t.onSite)}</span>
                </div>
                <div className="field-card">
                  <p className="eyebrow">{String(t.currentVisit)}</p>
                  <h3>{activeJob.title}</h3>
                  <span>{activeJob.object}</span>
                </div>
                <div className="checklist">
                  <div className="check-count">
                    <strong>
                      {completedItems}/{checklistDone.length}
                    </strong>
                    <span>{String(t.checksDone)}</span>
                  </div>
                  {translatedList(t, "checklist").map((item, index) => (
                    <label key={String(item)}>
                      <input
                        type="checkbox"
                        checked={checklistState[index]}
                        onChange={() =>
                          setChecklistState((items) =>
                            items.map((isDone, itemIndex) =>
                              itemIndex === index ? !isDone : isDone,
                            ),
                          )
                        }
                      />
                      <span>{String(item)}</span>
                    </label>
                  ))}
                </div>
                <button className="primary-action full" onClick={sendApproval} type="button">
                  {String(t.sendApproval)} <MailCheck size={18} />
                </button>
              </div>
              <div className="panel field-notes">
                <p className="eyebrow">{String(t.mobileFunctions)}</p>
                <h3>{String(t.mobileTitle)}</h3>
                <p>{String(t.mobileText)}</p>
                <div className="note-grid">
                  {[CheckCircle2, Sparkles, Trees].map((Icon, index) => (
                    <span key={String(translatedList(t, "notes")[index])}>
                      <Icon size={17} /> {String(translatedList(t, "notes")[index])}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          )}

          {modalMode && (
            <div className="modal-backdrop" role="presentation">
              <section className="modal-panel" role="dialog" aria-modal="true">
                <div className="modal-heading">
                  <div>
                    <p className="eyebrow">
                      {modalMode === "job"
                        ? String(t.addJob)
                        : modalMode === "object"
                          ? String(t.newObject)
                        : modalMode === "report"
                          ? String(t.reportDetails)
                          : modalMode === "property"
                            ? String(t.propertyDetails)
                            : String(t.versionHistory)}
                    </p>
                    <h3>
                      {modalMode === "job"
                        ? String(t.newJob)
                        : modalMode === "object"
                          ? String(t.createObject)
                        : modalMode === "report"
                          ? activeJob.title
                          : modalMode === "property"
                            ? activeObject.name
                            : `${appVersion.label} v${appVersion.version}`}
                    </h3>
                  </div>
                  <button
                    className="icon-button"
                    aria-label={String(t.close)}
                    onClick={() => setModalMode(null)}
                    type="button"
                  >
                    <X size={18} />
                  </button>
                </div>

                {modalMode === "job" ? (
                  <div className="job-form">
                    <label>
                      <span>{String(t.jobTitleLabel)}</span>
                      <input
                        value={newJobTitle}
                        onChange={(event) => setNewJobTitle(event.target.value)}
                        placeholder={activeJob.title}
                      />
                    </label>
                    <label>
                      <span>{String(t.propertyLabel)}</span>
                      <select
                        value={newJobObject}
                        onChange={(event) => setNewJobObject(event.target.value)}
                      >
                        {objects.map((object) => (
                          <option key={object.name} value={object.name}>
                            {object.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>{String(t.serviceLabel)}</span>
                      <select
                        value={newJobService || services[0] || ""}
                        onChange={(event) => setNewJobService(event.target.value)}
                      >
                        {services.map((service) => (
                          <option key={service} value={service}>
                            {service}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="primary-action full" onClick={createLocalJob} type="button">
                      <Plus size={18} /> {String(t.createJob)}
                    </button>
                  </div>
                ) : modalMode === "object" ? (
                  <div className="job-form">
                    <label>
                      <span>{String(t.propertyLabel)}</span>
                      <input
                        value={newObjectName}
                        onChange={(event) => setNewObjectName(event.target.value)}
                        placeholder={activeObject.name}
                      />
                    </label>
                    <label>
                      <span>{String(t.ownerLabel)}</span>
                      <input
                        value={newObjectOwner}
                        onChange={(event) => setNewObjectOwner(event.target.value)}
                        placeholder={activeObject.owner}
                      />
                    </label>
                    <label>
                      <span>{String(t.locationLabel)}</span>
                      <input
                        value={newObjectLocation}
                        onChange={(event) => setNewObjectLocation(event.target.value)}
                        placeholder={activeObject.location}
                      />
                    </label>
                    <button className="primary-action full" onClick={createLocalObject} type="button">
                      <Plus size={18} /> {String(t.createObject)}
                    </button>
                  </div>
                ) : modalMode === "version" ? (
                  <div className="version-history">
                    <div className="version-current">
                      <span>{String(t.latestChanges)}</span>
                      <strong>
                        v{currentVersion.version} · {currentVersion.date}
                      </strong>
                    </div>
                    {versionHistory.map((entry) => (
                      <article key={entry.version}>
                        <h4>
                          v{entry.version} <span>{entry.date}</span>
                        </h4>
                        <ul>
                          {entry.changes.map((change) => (
                            <li key={change}>{change}</li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                ) : modalMode === "property" ? (
                  <div className="detail-list">
                    <div>
                      <span>{String(t.propertyLabel)}</span>
                      <strong>{activeObject.name}</strong>
                    </div>
                    <div>
                      <span>{String(t.ownerLabel)}</span>
                      <strong>{activeObject.owner}</strong>
                    </div>
                    <div>
                      <span>{String(t.locationLabel)}</span>
                      <strong>{activeObject.location}</strong>
                    </div>
                    <div>
                      <span>{String(t.statusLabel)}</span>
                      <strong>{activeObject.status}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="detail-list">
                    <div>
                      <span>{String(t.selectedJob)}</span>
                      <strong>{activeJob.title}</strong>
                    </div>
                    <div>
                      <span>{String(t.propertyLabel)}</span>
                      <strong>{activeObject.name}</strong>
                    </div>
                    <div>
                      <span>{String(t.serviceLabel)}</span>
                      <strong>{activeJob.service}</strong>
                    </div>
                    <div>
                      <span>{String(t.statusLabel)}</span>
                      <strong>{activeJob.status}</strong>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
