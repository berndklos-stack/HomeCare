"use client";

import {
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  Euro,
  FileText,
  Home,
  KeyRound,
  Languages,
  MessageSquareText,
  Moon,
  Plus,
  Search,
  Sun,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import { useState } from "react";
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
type Modal = "object" | "job" | "version" | null;

type ObjectRecord = {
  id: string;
  name: string;
  owner: string;
  ownerEmail: string;
  ownerPhone: string;
  address: string;
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
  };
  nextVisit: string;
  lastVisit: string;
};

type CustomerRecord = {
  id: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  language: string;
  objects: string[];
  balance: string;
  portalStatus: "aktiv" | "einladen" | "gesperrt";
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

type MessageRecord = {
  id: string;
  objectId: string;
  customerId: string;
  channel: "E-Mail" | "Telefon" | "Portal";
  subject: string;
  status: "Entwurf" | "Gesendet" | "Gelesen" | "Rückfrage";
  date: string;
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

type NewObjectFormState = {
  name: string;
  owner: string;
  address: string;
  region: string;
  sizeSqm: string;
  plotSqm: string;
  rooms: string;
  beds: string;
  bathrooms: string;
  carePackage: ObjectRecord["carePackage"];
  keySafe: string;
  equipment: string;
  risks: string;
};

type NewJobFormState = {
  title: string;
  type: string;
  priority: JobRecord["priority"];
  dueDate: string;
  assignedTo: string;
  description: string;
  internalNotes: string;
};

const labels = {
  de: {
    appTitle: "Ferienhausverwaltung",
    subtitle: "Objekte, Einsätze, Berichte und Abrechnung in einer Arbeitszentrale.",
    search: "Suchen",
    newObject: "Neues Objekt",
    newJob: "Neuer Auftrag",
    createObject: "Objekt anlegen",
    createJob: "Auftrag anlegen",
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
    newJob: "Nytt uppdrag",
    createObject: "Skapa objekt",
    createJob: "Skapa uppdrag",
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
    newJob: "New job",
    createObject: "Create property",
    createJob: "Create job",
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
  { id: "reports", label: "Berichte", icon: FileText },
  { id: "communication", label: "Kommunikation", icon: MessageSquareText },
  { id: "billing", label: "Abrechnung", icon: Euro },
  { id: "masterData", label: "Stammdaten", icon: KeyRound },
];

const seedObjects: ObjectRecord[] = [
  {
    id: "OBJ-1001",
    name: "Villa Långsjön",
    owner: "Familie Andersson",
    ownerEmail: "eva.andersson@example.com",
    ownerPhone: "+46 70 118 44 20",
    address: "Långsjövägen 18, 382 92 Orrefors",
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
    media: { images: 18, documents: 6, floorPlans: 1 },
    nextVisit: "31.07.2026",
    lastVisit: "Heute, 09:20",
  },
  {
    id: "OBJ-1002",
    name: "Stuga Nybro",
    owner: "M. Schneider",
    ownerEmail: "markus.schneider@example.com",
    ownerPhone: "+49 171 440 22 18",
    address: "Skogsstigen 7, 382 34 Nybro",
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
    media: { images: 11, documents: 4, floorPlans: 1 },
    nextVisit: "02.08.2026",
    lastVisit: "28.07.2026",
  },
  {
    id: "OBJ-1003",
    name: "Haus am Wald",
    owner: "B. Klos",
    ownerEmail: "bernd@example.com",
    ownerPhone: "+46 76 101 81 86",
    address: "Kolaretorp 106, 382 93 Nybro",
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
    media: { images: 9, documents: 5, floorPlans: 0 },
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
    language: "SV / DE",
    objects: ["OBJ-1001"],
    balance: "0 SEK",
    portalStatus: "aktiv",
  },
  {
    id: "CUS-2",
    name: "M. Schneider",
    contact: "Markus Schneider",
    email: "markus.schneider@example.com",
    phone: "+49 171 440 22 18",
    language: "DE",
    objects: ["OBJ-1002"],
    balance: "1.840 SEK",
    portalStatus: "aktiv",
  },
  {
    id: "CUS-3",
    name: "B. Klos",
    contact: "Bernd Klos",
    email: "bernd@example.com",
    phone: "+46 76 101 81 86",
    language: "DE / EN",
    objects: ["OBJ-1003"],
    balance: "0 SEK",
    portalStatus: "einladen",
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

const seedMessages: MessageRecord[] = [
  {
    id: "MSG-1",
    objectId: "OBJ-1001",
    customerId: "CUS-1",
    channel: "E-Mail",
    subject: "Poolwerte und nächste Kontrolle",
    status: "Entwurf",
    date: "31.07.2026",
  },
  {
    id: "MSG-2",
    objectId: "OBJ-1002",
    customerId: "CUS-2",
    channel: "Portal",
    subject: "Rasenpflege bestätigt",
    status: "Gelesen",
    date: "28.07.2026",
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

const serviceCatalog = [
  { name: "Basis", type: "Paket", price: "2.990 SEK/Jahr", detail: "4 Kontrollen, Fotobericht, E-Mail" },
  { name: "Plus", type: "Paket", price: "5.490 SEK/Jahr", detail: "8 Kontrollen, Briefkastenservice" },
  { name: "Komfort", type: "Paket", price: "7.990 SEK/Jahr", detail: "12 Kontrollen, kleine Handwerkerdienste" },
  { name: "Premium", type: "Paket", price: "9.990 SEK/Jahr", detail: "Priorisierter Notfallservice" },
  { name: "Hauskontrolle", type: "Zusatzleistung", price: "795 SEK/Besuch", detail: "Sichtprüfung und Bericht" },
  { name: "Gartenpflege", type: "Zusatzleistung", price: "595 SEK/Stunde", detail: "Rasen, Hecken, Saisonpflege" },
  { name: "Schlüsselservice", type: "Zusatzleistung", price: "495 SEK/Einsatz", detail: "Übergabe und Zugang" },
  { name: "Reinigung", type: "Zusatzleistung", price: "495 SEK/Stunde", detail: "Innenreinigung und Vorbereitung" },
  { name: "Notdienst", type: "Zusatzleistung", price: "990 SEK", detail: "24/7 nach Aufwand" },
];

function statusTone(status: string) {
  if (["in Arbeit", "Entwurf", "abrechenbar"].includes(status)) return "warning";
  if (["erledigt", "abgerechnet", "aktiv", "Gelesen"].includes(status)) return "good";
  if (["dringend", "gesperrt"].includes(status)) return "danger";
  return "neutral";
}

export default function HomePage() {
  const [section, setSection] = useState<Section>("dashboard");
  const [language, setLanguage] = useState<Language>("de");
  const [theme, setTheme] = useState<Theme>("light");
  const [query, setQuery] = useState("");
  const [selectedObjectId, setSelectedObjectId] = useState("OBJ-1001");
  const [objects, setObjects] = useState(seedObjects);
  const [customers] = useState(seedCustomers);
  const [jobs, setJobs] = useState(seedJobs);
  const [reports] = useState(seedReports);
  const [messages] = useState(seedMessages);
  const [billing] = useState(seedBilling);
  const [modal, setModal] = useState<Modal>(null);
  const [newObject, setNewObject] = useState<NewObjectFormState>({
    name: "",
    owner: "",
    address: "",
    region: "Nybro",
    sizeSqm: "95",
    plotSqm: "1800",
    rooms: "4",
    beds: "6",
    bathrooms: "1",
    carePackage: "Basis" as ObjectRecord["carePackage"],
    keySafe: "",
    equipment: "",
    risks: "",
  });
  const [newJob, setNewJob] = useState<NewJobFormState>({
    title: "",
    type: "Hauskontrolle",
    priority: "normal" as JobRecord["priority"],
    dueDate: "2026-08-05",
    assignedTo: "Johan Berg",
    description: "",
    internalNotes: "",
  });

  const t = labels[language];
  const selectedObject = objects.find((object) => object.id === selectedObjectId) ?? objects[0];
  const objectJobs = jobs.filter((job) => job.objectId === selectedObject.id);
  const objectReports = reports.filter((report) => report.objectId === selectedObject.id);
  const objectMessages = messages.filter((message) => message.objectId === selectedObject.id);
  const objectBilling = billing.filter((item) => item.objectId === selectedObject.id);
  const filteredObjects = objects.filter((object) =>
    [object.name, object.owner, object.address, object.region, object.carePackage]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const dashboardStats = [
    { label: "aktive Objekte", value: objects.length },
    { label: "offene Einsätze", value: jobs.filter((job) => job.status !== "erledigt" && job.status !== "abgerechnet").length },
    { label: "Berichte", value: reports.length },
    { label: "abrechenbar", value: billing.filter((item) => item.status === "abrechenbar").length },
  ];

  function createObject() {
    const id = `OBJ-${1000 + objects.length + 1}`;
    const created: ObjectRecord = {
      id,
      name: newObject.name.trim() || "Neues Ferienhaus",
      owner: newObject.owner.trim() || "Neuer Eigentümer",
      ownerEmail: "kunde@example.com",
      ownerPhone: "-",
      address: newObject.address.trim() || "Adresse offen",
      region: newObject.region,
      sizeSqm: Number(newObject.sizeSqm) || 0,
      plotSqm: Number(newObject.plotSqm) || 0,
      rooms: Number(newObject.rooms) || 0,
      beds: Number(newObject.beds) || 0,
      bathrooms: Number(newObject.bathrooms) || 0,
      buildYear: 1990,
      carePackage: newObject.carePackage,
      status: "Kontrolle offen",
      access: {
        keySafe: newObject.keySafe.trim() || "noch zu pflegen",
        alarm: "noch zu pflegen",
        parking: "noch zu pflegen",
        notes: "Zugang und Besonderheiten ergänzen.",
      },
      equipment: newObject.equipment.split(",").map((item) => item.trim()).filter(Boolean),
      utilities: {
        heating: "noch zu pflegen",
        water: "noch zu pflegen",
        septic: "noch zu pflegen",
        internet: "noch zu pflegen",
      },
      risks: newObject.risks.split(",").map((item) => item.trim()).filter(Boolean),
      media: { images: 0, documents: 0, floorPlans: 0 },
      nextVisit: "noch planen",
      lastVisit: "-",
    };

    setObjects((current) => [created, ...current]);
    setSelectedObjectId(id);
    setSection("objects");
    setModal(null);
  }

  function createJob() {
    const created: JobRecord = {
      id: `JOB-${2410 + jobs.length}`,
      title: newJob.title.trim() || "Neuer Auftrag",
      objectId: selectedObject.id,
      customerId: customers.find((customer) => customer.name === selectedObject.owner)?.id ?? "CUS-1",
      type: newJob.type,
      status: "geplant",
      priority: newJob.priority,
      dueDate: newJob.dueDate,
      assignedTo: newJob.assignedTo,
      description: newJob.description.trim() || "Beschreibung ergänzen.",
      internalNotes: newJob.internalNotes.trim() || "Keine internen Notizen.",
      checklist: ["Zugang prüfen", "Fotos erfassen", "Arbeit dokumentieren", "Bericht vorbereiten"],
      billable: true,
      material: "-",
      workMinutes: 0,
    };

    setJobs((current) => [created, ...current]);
    setSection("jobs");
    setModal(null);
  }

  function startJob(job: JobRecord) {
    setJobs((current) =>
      current.map((item) => (item.id === job.id ? { ...item, status: "in Arbeit" } : item)),
    );
    setSection("field");
  }

  function completeJob(job: JobRecord) {
    setJobs((current) =>
      current.map((item) => (item.id === job.id ? { ...item, status: "erledigt", workMinutes: 90 } : item)),
    );
    setSection("reports");
  }

  return (
    <main className="app" data-ready="true" data-theme={theme}>
      <aside className="sidebar">
        <div className="brand">
          <Home size={28} />
          <div>
            <strong>Kolaretorp</strong>
            <span>Service AB</span>
          </div>
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
          <span>Version</span>
          <strong>v{appVersion.version}</strong>
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p>Kolaretorp Service AB</p>
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
            <button className="primary-button" onClick={() => setModal("job")} type="button">
              <Plus size={16} />
              {t.newJob}
            </button>
          </div>
        </header>

        <div className="quickbar">
          {dashboardStats.map((item) => (
            <article key={item.label}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </article>
          ))}
        </div>

        <section className="layout">
          <div className="main-panel">
            {section === "dashboard" && (
              <Dashboard
                jobs={jobs}
                objects={objects}
                reports={reports}
                setSection={setSection}
              />
            )}
            {section === "objects" && (
              <ObjectsView
                objects={filteredObjects}
                selectedObjectId={selectedObject.id}
                onCreate={() => setModal("object")}
                onSelect={(id) => setSelectedObjectId(id)}
              />
            )}
            {section === "customers" && <CustomersView customers={customers} objects={objects} />}
            {section === "jobs" && (
              <JobsView jobs={jobs} objects={objects} onCreate={() => setModal("job")} onStart={startJob} />
            )}
            {section === "planning" && <PlanningView jobs={jobs} objects={objects} onStart={startJob} />}
            {section === "field" && <FieldView jobs={jobs} selectedObject={selectedObject} onComplete={completeJob} />}
            {section === "reports" && <ReportsView reports={reports} objects={objects} />}
            {section === "communication" && <CommunicationView messages={messages} objects={objects} customers={customers} />}
            {section === "billing" && <BillingView billing={billing} objects={objects} />}
            {section === "masterData" && <MasterDataView services={serviceCatalog} />}
          </div>

          <ObjectFile
            billing={objectBilling}
            jobs={objectJobs}
            messages={objectMessages}
            object={selectedObject}
            reports={objectReports}
          />
        </section>
      </section>

      {modal && (
        <div className="modal-backdrop">
          <section className="modal" role="dialog" aria-modal="true">
            <header>
              <div>
                <p>{modal === "object" ? "Objektstammdaten" : modal === "job" ? "Auftrag" : "Änderungsverlauf"}</p>
                <h2>{modal === "object" ? t.newObject : modal === "job" ? t.newJob : `v${appVersion.version}`}</h2>
              </div>
              <button aria-label={t.close} onClick={() => setModal(null)} type="button">
                <X size={18} />
              </button>
            </header>
            {modal === "object" && (
              <ObjectForm
                newObject={newObject}
                setNewObject={setNewObject}
                onSubmit={createObject}
                submitLabel={t.createObject}
              />
            )}
            {modal === "job" && (
              <JobForm
                newJob={newJob}
                objects={objects}
                selectedObject={selectedObject}
                setNewJob={setNewJob}
                setSelectedObjectId={setSelectedObjectId}
                onSubmit={createJob}
                submitLabel={t.createJob}
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
    { label: "Berichte freigeben", value: reports.length, text: "Dokumentationen", section: "reports" as Section },
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
  objects,
  selectedObjectId,
  onCreate,
  onSelect,
}: {
  objects: ObjectRecord[];
  selectedObjectId: string;
  onCreate: () => void;
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
      <div className="object-list">
        {objects.map((object) => (
          <button
            className={selectedObjectId === object.id ? "selected" : ""}
            key={object.id}
            onClick={() => onSelect(object.id)}
            type="button"
          >
            <div>
              <strong>{object.name}</strong>
              <span>{object.owner}</span>
            </div>
            <span>{object.region}</span>
            <span>{object.sizeSqm} m² · {object.rooms} Zi. · {object.beds} Betten</span>
            <span>{object.carePackage}</span>
            <Badge value={object.status} />
          </button>
        ))}
      </div>
    </section>
  );
}

function CustomersView({ customers, objects }: { customers: CustomerRecord[]; objects: ObjectRecord[] }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <p>Eigentümer</p>
          <h2>Kundenübersicht</h2>
        </div>
      </div>
      <div className="table-list">
        {customers.map((customer) => (
          <article key={customer.id}>
            <div>
              <strong>{customer.name}</strong>
              <span>{customer.contact} · {customer.language}</span>
            </div>
            <span>{objects.filter((object) => customer.objects.includes(object.id)).map((object) => object.name).join(", ")}</span>
            <span>{customer.balance}</span>
            <Badge value={customer.portalStatus} />
          </article>
        ))}
      </div>
    </section>
  );
}

function JobsView({
  jobs,
  objects,
  onCreate,
  onStart,
}: {
  jobs: JobRecord[];
  objects: ObjectRecord[];
  onCreate: () => void;
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
      <div className="table-list">
        {jobs.map((job) => (
          <article key={job.id}>
            <div>
              <strong>{job.title}</strong>
              <span>{objects.find((object) => object.id === job.objectId)?.name} · {job.description}</span>
            </div>
            <span>{job.priority}</span>
            <span>{job.dueDate}</span>
            <Badge value={job.status} />
            <button className="row-action" onClick={() => onStart(job)} type="button">Starten</button>
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

function FieldView({ jobs, selectedObject, onComplete }: { jobs: JobRecord[]; selectedObject: ObjectRecord; onComplete: (job: JobRecord) => void }) {
  const active = jobs.find((job) => job.status === "in Arbeit") ?? jobs[0];
  return (
    <section className="field-shell">
      <div className="phone-card">
        <p>Mobil vor Ort</p>
        <h2>{active.title}</h2>
        <span>{selectedObject.name}</span>
        <div className="checklist">
          {active.checklist.map((item, index) => (
            <label key={item}>
              <input type="checkbox" defaultChecked={index < 2} />
              <span>{item}</span>
            </label>
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

function ReportsView({ reports, objects }: { reports: ReportRecord[]; objects: ObjectRecord[] }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <p>Dokumentation</p>
          <h2>Berichtsübersicht</h2>
        </div>
      </div>
      <div className="table-list">
        {reports.map((report) => (
          <article key={report.id}>
            <div>
              <strong>{report.title}</strong>
              <span>{report.summary}</span>
            </div>
            <span>{objects.find((object) => object.id === report.objectId)?.name}</span>
            <span>{report.media.join(", ")}</span>
            <Badge value={report.visibleToCustomer ? "Kunde sichtbar" : "intern"} />
          </article>
        ))}
      </div>
    </section>
  );
}

function CommunicationView({ messages, objects, customers }: { messages: MessageRecord[]; objects: ObjectRecord[]; customers: CustomerRecord[] }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <p>Kundenkontakt</p>
          <h2>Kommunikation</h2>
        </div>
      </div>
      <div className="table-list">
        {messages.map((message) => (
          <article key={message.id}>
            <div>
              <strong>{message.subject}</strong>
              <span>{customers.find((customer) => customer.id === message.customerId)?.name}</span>
            </div>
            <span>{objects.find((object) => object.id === message.objectId)?.name}</span>
            <span>{message.channel}</span>
            <Badge value={message.status} />
          </article>
        ))}
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

function MasterDataView({ services }: { services: typeof serviceCatalog }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <p>Stammdaten</p>
          <h2>Leistungen und Pakete</h2>
        </div>
      </div>
      <div className="service-catalog">
        {services.map((service) => (
          <article key={service.name}>
            <span>{service.type}</span>
            <strong>{service.name}</strong>
            <small>{service.detail}</small>
            <mark>{service.price}</mark>
          </article>
        ))}
      </div>
    </section>
  );
}

function ObjectFile({
  object,
  jobs,
  reports,
  messages,
  billing,
}: {
  object: ObjectRecord;
  jobs: JobRecord[];
  reports: ReportRecord[];
  messages: MessageRecord[];
  billing: BillingRecord[];
}) {
  return (
    <aside className="object-file">
      <div className="object-file-head">
        <p>Objektakte</p>
        <h2>{object.name}</h2>
        <Badge value={object.status} />
      </div>
      <section>
        <h3>Stammdaten</h3>
        <dl>
          <div><dt>Eigentümer</dt><dd>{object.owner}</dd></div>
          <div><dt>Adresse</dt><dd>{object.address}</dd></div>
          <div><dt>Größe</dt><dd>{object.sizeSqm} m² · {object.plotSqm} m² Grundstück</dd></div>
          <div><dt>Zimmer</dt><dd>{object.rooms} Zimmer · {object.beds} Betten · {object.bathrooms} Bad</dd></div>
          <div><dt>Paket</dt><dd>{object.carePackage}</dd></div>
        </dl>
      </section>
      <section>
        <h3>Zugang & Technik</h3>
        <dl>
          <div><dt>Schlüssel</dt><dd>{object.access.keySafe}</dd></div>
          <div><dt>Alarm</dt><dd>{object.access.alarm}</dd></div>
          <div><dt>Heizung</dt><dd>{object.utilities.heating}</dd></div>
          <div><dt>Wasser</dt><dd>{object.utilities.water}</dd></div>
        </dl>
      </section>
      <section>
        <h3>Ausstattung</h3>
        <div className="tags">
          {object.equipment.map((item) => <span key={item}>{item}</span>)}
        </div>
      </section>
      <section>
        <h3>Hinweise</h3>
        {object.risks.map((risk) => (
          <p className="warning-line" key={risk}><AlertTriangle size={14} /> {risk}</p>
        ))}
      </section>
      <section>
        <h3>Medien</h3>
        <div className="mini-stats">
          <span>{object.media.images} Bilder</span>
          <span>{object.media.documents} Dokumente</span>
          <span>{object.media.floorPlans} Grundrisse</span>
        </div>
      </section>
      <section>
        <h3>Protokoll</h3>
        <div className="activity-list">
          <span>{jobs.length} Einsätze</span>
          <span>{reports.length} Berichte</span>
          <span>{messages.length} Nachrichten</span>
          <span>{billing.length} Abrechnungspositionen</span>
        </div>
      </section>
    </aside>
  );
}

function ObjectForm({
  newObject,
  setNewObject,
  onSubmit,
  submitLabel,
}: {
  newObject: NewObjectFormState;
  setNewObject: (value: NewObjectFormState) => void;
  onSubmit: () => void;
  submitLabel: string;
}) {
  function update(key: keyof typeof newObject, value: string) {
    setNewObject({ ...newObject, [key]: value });
  }

  return (
    <div className="form-grid">
      <label><span>Objekt</span><input value={newObject.name} onChange={(event) => update("name", event.target.value)} /></label>
      <label><span>Eigentümer</span><input value={newObject.owner} onChange={(event) => update("owner", event.target.value)} /></label>
      <label className="wide"><span>Adresse</span><input value={newObject.address} onChange={(event) => update("address", event.target.value)} /></label>
      <label><span>Ort/Region</span><input value={newObject.region} onChange={(event) => update("region", event.target.value)} /></label>
      <label><span>Größe m²</span><input type="number" value={newObject.sizeSqm} onChange={(event) => update("sizeSqm", event.target.value)} /></label>
      <label><span>Grundstück m²</span><input type="number" value={newObject.plotSqm} onChange={(event) => update("plotSqm", event.target.value)} /></label>
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
      <label className="wide"><span>Zugang / Schlüssel</span><textarea value={newObject.keySafe} onChange={(event) => update("keySafe", event.target.value)} /></label>
      <label className="wide"><span>Ausstattung</span><textarea value={newObject.equipment} onChange={(event) => update("equipment", event.target.value)} placeholder="Pool, Sauna, Kamin" /></label>
      <label className="wide"><span>Hinweise / Risiken</span><textarea value={newObject.risks} onChange={(event) => update("risks", event.target.value)} /></label>
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
  function update(key: keyof typeof newJob, value: string) {
    setNewJob({ ...newJob, [key]: value });
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
      <label className="wide"><span>Beschreibung</span><textarea value={newJob.description} onChange={(event) => update("description", event.target.value)} /></label>
      <label className="wide"><span>Interne Notizen</span><textarea value={newJob.internalNotes} onChange={(event) => update("internalNotes", event.target.value)} /></label>
      <button className="primary-button wide" onClick={onSubmit} type="button">{submitLabel}</button>
    </div>
  );
}

function Badge({ value }: { value: string }) {
  return <mark className={statusTone(value)}>{value}</mark>;
}
