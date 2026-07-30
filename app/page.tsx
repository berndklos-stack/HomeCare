"use client";

import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Hammer,
  Home,
  Languages,
  Leaf,
  MailCheck,
  MapPin,
  Menu,
  PanelLeftClose,
  Plus,
  ShieldCheck,
  Sparkles,
  Trees,
  Waves,
  Wrench,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type Language = "de" | "sv" | "en";
type View = "team" | "owner" | "mobile";
type NavTarget = View | "team-jobs" | "team-schedule";
type ModalMode = "job" | "report" | "property" | null;

const languageLabels: Record<Language, string> = {
  de: "DE",
  sv: "SV",
  en: "EN",
};

const translations = {
  de: {
    tagline: "Ferienhausverwaltung Småland",
    navLabel: "Hauptnavigation",
    nav: ["Überblick", "Objekte", "Aufträge", "Einsatzplan", "Freigaben"],
    navTargets: ["team", "owner", "team-jobs", "team-schedule", "mobile"],
    contact: "Kontakt",
    menuOpen: "Menü öffnen",
    menuClose: "Menü schließen",
    product: "Kolaretorp Service AB",
    headline: "Servicezentrale für Ferienhäuser",
    newJob: "Neuer Auftrag",
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
    close: "Schließen",
    jobTitleLabel: "Titel",
    propertyLabel: "Objekt",
    serviceLabel: "Leistung",
    statusLabel: "Status",
    newJobAdded: "Auftrag wurde lokal angelegt",
    serviceFiltered: "Leistung gefiltert",
    filterAll: "Alle Leistungen",
    selectedJob: "Ausgewählter Auftrag",
    selectedProperty: "Ausgewähltes Objekt",
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
    nav: ["Översikt", "Objekt", "Uppdrag", "Insatsplan", "Godkännanden"],
    navTargets: ["team", "owner", "team-jobs", "team-schedule", "mobile"],
    contact: "Kontakt",
    menuOpen: "Öppna meny",
    menuClose: "Stäng meny",
    product: "Kolaretorp Service AB",
    headline: "Servicecentral för fritidshus",
    newJob: "Nytt uppdrag",
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
    close: "Stäng",
    jobTitleLabel: "Titel",
    propertyLabel: "Objekt",
    serviceLabel: "Tjänst",
    statusLabel: "Status",
    newJobAdded: "Uppdraget skapades lokalt",
    serviceFiltered: "Tjänst filtrerad",
    filterAll: "Alla tjänster",
    selectedJob: "Valt uppdrag",
    selectedProperty: "Valt objekt",
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
    nav: ["Overview", "Properties", "Jobs", "Schedule", "Approvals"],
    navTargets: ["team", "owner", "team-jobs", "team-schedule", "mobile"],
    contact: "Contact",
    menuOpen: "Open menu",
    menuClose: "Close menu",
    product: "Kolaretorp Service AB",
    headline: "Service hub for holiday homes",
    newJob: "New job",
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
    close: "Close",
    jobTitleLabel: "Title",
    propertyLabel: "Property",
    serviceLabel: "Service",
    statusLabel: "Status",
    newJobAdded: "Job was created locally",
    serviceFiltered: "Service filtered",
    filterAll: "All services",
    selectedJob: "Selected job",
    selectedProperty: "Selected property",
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
  const [language, setLanguage] = useState<Language>("de");
  const [liveData, setLiveData] = useState<LiveData | null>(null);
  const [localJobs, setLocalJobs] = useState<AppJob[]>([]);
  const [activeJobId, setActiveJobId] = useState("KS-2407");
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [notice, setNotice] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [checklistState, setChecklistState] = useState(checklistDone);
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newJobObject, setNewJobObject] = useState("Villa Långsjön");
  const [newJobService, setNewJobService] = useState("");
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
  const jobs = [...localJobs, ...(liveData?.jobs.length ? liveData.jobs : demoJobs)];
  const objects = liveData?.objects.length ? liveData.objects : demoObjects;
  const services = liveData?.services.length
    ? liveData.services
    : serviceLabels;
  const activeServiceFilter =
    selectedService && services.includes(selectedService) ? selectedService : null;
  const filteredJobs = activeServiceFilter
    ? jobs.filter((job) => job.service === activeServiceFilter)
    : jobs;
  const activeJob = jobs.find((job) => job.id === activeJobId) ?? jobs[0];
  const activeObject =
    objects.find((object) => object.name === activeJob.object) ?? objects[0];
  const completedItems = useMemo(
    () => checklistState.filter(Boolean).length,
    [checklistState],
  );
  const liveApprovals = jobs.filter((job) =>
    ["approval", "freigabe", "godkännande"].some((status) =>
      job.status.toLowerCase().includes(status),
    ),
  ).length;
  const stats = [objects.length, jobs.length, liveApprovals || 3];
  const dataLabel =
    dataState === "live"
      ? String(t.sourceLive)
      : dataState === "loading"
        ? String(t.sourceLoading)
        : dataState === "error"
          ? String(t.sourceError)
          : String(t.sourceDemo);
  const navTargets = (
    Array.isArray(t.navTargets) ? t.navTargets : ["team", "owner", "team-jobs", "team-schedule", "mobile"]
  ) as NavTarget[];

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2500);
  }

  function changeView(nextView: View) {
    setView(nextView);
    setIsSidebarOpen(false);
  }

  function handleNav(target: NavTarget) {
    if (target === "team-jobs" || target === "team-schedule") {
      changeView("team");
      setModalMode("job");
      return;
    }

    changeView(target);
  }

  function openNewJob() {
    setNewJobTitle("");
    setNewJobObject(objects[0]?.name ?? "");
    setNewJobService(services[0] ?? "");
    setModalMode("job");
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
    setSelectedService(null);
    setModalMode(null);
    changeView("team");
    showNotice(String(t.newJobAdded));
  }

  function selectJob(job: AppJob) {
    setActiveJobId(job.id);
    showNotice(`${String(t.selectedJob)}: ${job.title}`);
  }

  function selectService(service: string) {
    setSelectedService((currentService) =>
      currentService === service ? null : service,
    );
    showNotice(`${String(t.serviceFiltered)}: ${service}`);
  }

  function sendApproval() {
    setLocalJobs((currentJobs) =>
      currentJobs.map((job) =>
        job.id === activeJob.id
          ? {
              ...job,
              status: translatedList(t, "jobStatuses")[2] ?? String(t.status),
              progress: Math.max(job.progress, 92),
            }
          : job,
      ),
    );
    setChecklistState((items) => items.map(() => true));
    showNotice(String(t.approvalSent));
  }

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

      const mappedObjects = (propertiesResult.data ?? []).map((property) => ({
        name: property.name ?? "Objekt",
        owner: nestedName(property.profiles, "Eigentümer"),
        location: property.region ?? property.address ?? "Småland",
        status: translatedStatus(t, "in_progress"),
        lastVisit: "-",
      }));

      const mappedJobs = (jobsResult.data ?? []).map((job, index) => ({
        id: `KS-${String(index + 1).padStart(4, "0")}`,
        title: job.title ?? "Auftrag",
        object: nestedName(job.properties, "Objekt"),
        owner: isRecord(job.properties)
          ? nestedName(job.properties.profiles, "Eigentümer")
          : "Eigentümer",
        status: translatedStatus(t, job.status ?? "planned"),
        service: nestedName(job.service_categories, "Service"),
        progress: getStatusProgress(job.status ?? "planned"),
      }));

      const mappedServices = (servicesResult.data ?? [])
        .map((service) => service.name)
        .filter(Boolean);

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
    <main className="min-h-screen bg-[#f5f2ea] text-[#18201c]">
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
            {[PanelLeftClose, Home, ClipboardCheck, CalendarDays, MailCheck].map(
              (Icon, index) => (
                <button
                  className={
                    navTargets[index] === view ||
                    (view === "team" && navTargets[index]?.startsWith("team"))
                      ? "active"
                      : ""
                  }
                  key={String(t.nav[index])}
                  onClick={() => handleNav(navTargets[index] ?? "team")}
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
              <span className={`data-source ${dataState}`}>{dataLabel}</span>
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
                onClick={() => setView(item)}
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

          {view === "team" && (
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
                        : modalMode === "report"
                          ? String(t.reportDetails)
                          : String(t.propertyDetails)}
                    </p>
                    <h3>
                      {modalMode === "job"
                        ? String(t.newJob)
                        : modalMode === "report"
                          ? activeJob.title
                          : activeObject.name}
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
