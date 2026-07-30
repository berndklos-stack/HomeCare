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
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type Language = "de" | "sv" | "en";
type View = "team" | "owner" | "mobile";

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
    contact: "Kontakt",
    menuOpen: "Menü öffnen",
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
  },
  sv: {
    tagline: "Fritidshusförvaltning i Småland",
    navLabel: "Huvudnavigation",
    nav: ["Översikt", "Objekt", "Uppdrag", "Insatsplan", "Godkännanden"],
    contact: "Kontakt",
    menuOpen: "Öppna meny",
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
  },
  en: {
    tagline: "Holiday home management in Småland",
    navLabel: "Main navigation",
    nav: ["Overview", "Properties", "Jobs", "Schedule", "Approvals"],
    contact: "Contact",
    menuOpen: "Open menu",
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

type AppObject = {
  name: string;
  owner: string;
  location: string;
  status: string;
  lastVisit: string;
};

type LiveData = {
  jobs: AppJob[];
  objects: AppObject[];
  services: string[];
};

type DataState = "loading" | "live" | "demo" | "error";

const demoJobs = [
  {
    id: "KS-2407",
    title: "Poolpflege und Wasserwerte",
    object: "Villa Långsjön",
    owner: "Familie Andersson",
    status: "In Arbeit",
    service: "Poolpflege",
    progress: 68,
  },
  {
    id: "KS-2408",
    title: "Rasen, Hecken und Sichtprüfung",
    object: "Stuga Nybro",
    owner: "M. Schneider",
    status: "Geplant",
    service: "Gartenpflege",
    progress: 22,
  },
  {
    id: "KS-2409",
    title: "Terrassentür justieren",
    object: "Kolaretorp 106",
    owner: "Kolaretorp Service AB",
    status: "Freigabe",
    service: "Reparatur",
    progress: 96,
  },
] satisfies AppJob[];

const demoObjects = [
  {
    name: "Villa Långsjön",
    owner: "Familie Andersson",
    location: "Orrefors",
    status: "Saisonbetrieb",
    lastVisit: "Heute, 09:20",
  },
  {
    name: "Stuga Nybro",
    owner: "M. Schneider",
    location: "Nybro",
    status: "Sommerklar",
    lastVisit: "28.07., 14:10",
  },
  {
    name: "Haus am Wald",
    owner: "B. Klos",
    location: "Småland",
    status: "Kontrolle offen",
    lastVisit: "26.07., 11:45",
  },
] satisfies AppObject[];

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

export default function HomePage() {
  const [view, setView] = useState<View>("team");
  const [language, setLanguage] = useState<Language>("de");
  const [liveData, setLiveData] = useState<LiveData | null>(null);
  const [dataState, setDataState] = useState<DataState>(() =>
    getSupabaseBrowserClient() ? "loading" : "demo",
  );
  const t = translations[language];
  const jobs = liveData?.jobs.length ? liveData.jobs : demoJobs;
  const objects = liveData?.objects.length ? liveData.objects : demoObjects;
  const services = liveData?.services.length
    ? liveData.services
    : (t.servicesList as string[]);
  const activeJob = jobs[0];
  const completedItems = useMemo(
    () => checklistDone.filter(Boolean).length,
    [],
  );
  const liveApprovals = jobs.filter((job) =>
    job.status.toLowerCase().includes("approval"),
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
        status: "Aktiv",
        lastVisit: "-",
      }));

      const mappedJobs = (jobsResult.data ?? []).map((job, index) => ({
        id: `KS-${String(index + 1).padStart(4, "0")}`,
        title: job.title ?? "Auftrag",
        object: nestedName(job.properties, "Objekt"),
        owner: isRecord(job.properties)
          ? nestedName(job.properties.profiles, "Eigentümer")
          : "Eigentümer",
        status: humanizeStatus(job.status ?? "planned"),
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
  }, []);

  return (
    <main className="min-h-screen bg-[#f5f2ea] text-[#18201c]">
      <section className="app-shell">
        <aside className="sidebar">
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
                <button className={index === 0 ? "active" : ""} key={String(t.nav[index])}>
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
            <button className="icon-button" aria-label={String(t.menuOpen)}>
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
              <button className="primary-action">
                <Plus size={18} /> {String(t.newJob)}
              </button>
            </div>
          </header>

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
                <button className="primary-action">
                  {String(t.openReport)} <ChevronRight size={18} />
                </button>
                <button className="secondary-action">{String(t.propertyFile)}</button>
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
                  <button className="icon-button" aria-label={String(t.addJob)}>
                    <Plus size={18} />
                  </button>
                </div>
                <div className="job-list">
                  {jobs.map((job) => (
                    <article className="job-row" key={job.id}>
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
                    </article>
                  ))}
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
                    <button key={service} type="button">
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
                    <article key={object.name}>
                      <div>
                        <strong>{object.name}</strong>
                        <span>{object.owner}</span>
                      </div>
                      <span>
                        <MapPin size={15} /> {object.location}
                      </span>
                      <mark>{object.status}</mark>
                      <small>{object.lastVisit}</small>
                    </article>
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
                    <h3>Villa Långsjön</h3>
                  </div>
                  <mark className="soft">{String(t.ownerView)}</mark>
                </div>
                <div className="owner-summary">
                  <div>
                    <span>{String(t.status)}</span>
                    <strong>{String(t.seasonActive)}</strong>
                  </div>
                  <div>
                    <span>{String(t.nextAppointment)}</span>
                    <strong>{String(t.gardenCareDate)}</strong>
                  </div>
                  <div>
                    <span>{String(t.lastReport)}</span>
                    <strong>{String(t.poolToday)}</strong>
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
                  {t.timeline.map((step, index) => (
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
                    <h3>{String(t.reportDraft)}</h3>
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
                  {t.checklist.map((item, index) => (
                    <label key={String(item)}>
                      <input type="checkbox" defaultChecked={checklistDone[index]} />
                      <span>{String(item)}</span>
                    </label>
                  ))}
                </div>
                <button className="primary-action full">
                  {String(t.sendApproval)} <MailCheck size={18} />
                </button>
              </div>
              <div className="panel field-notes">
                <p className="eyebrow">{String(t.mobileFunctions)}</p>
                <h3>{String(t.mobileTitle)}</h3>
                <p>{String(t.mobileText)}</p>
                <div className="note-grid">
                  {[CheckCircle2, Sparkles, Trees].map((Icon, index) => (
                    <span key={String(t.notes[index])}>
                      <Icon size={17} /> {String(t.notes[index])}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
