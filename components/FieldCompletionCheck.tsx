"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import styles from "./OperationsWorkspace.module.css";

type AssignedLine = { material_id: string; source_id: string; allocated_quantity: number; material?: { name: string; sku?: string; unit?: string } };
export function FieldAssignedMaterials({ job, date, locations, language, onLoaded }: {
  job: string; date: string; locations: { id: string; name: string }[]; language: "de" | "sv" | "en"; onLoaded: (loaded: boolean | null) => void;
}) {
  const [lines, setLines] = useState<AssignedLine[]>([]), [status, setStatus] = useState("loading"), [retry, setRetry] = useState(0);
  const t = (de: string, sv: string, en: string) => language === "sv" ? sv : language === "en" ? en : de;
  useEffect(() => {
    const controller = new AbortController();
    setLines([]); setStatus("loading"); onLoaded(null);
    void apiFetch(`/api/field-material-review?job=${encodeURIComponent(job)}&date=${encodeURIComponent(date)}`, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (controller.signal.aborted) return;
      setLines(data.lines ?? []); onLoaded(Boolean(data.lines?.length)); setStatus(data.reviewed ? "reviewed" : "ready");
    }).catch(() => { if (!controller.signal.aborted) { setStatus("error"); onLoaded(false); } });
    return () => controller.abort();
  }, [job, date, retry, onLoaded]);
  return <section className={styles.fieldMaterialReview} aria-labelledby="assigned-material-title">
    <h3 id="assigned-material-title">{t("Material auf dem Fahrzeug", "Material på fordonet", "Materials on the vehicle")}</h3>
    {status === "loading" && <p role="status">{t("Material wird geladen…", "Laddar material…", "Loading materials…")}</p>}
    {status === "error" && <><p role="alert">{t("Fahrzeugmaterial konnte nicht geladen werden.", "Fordonsmaterialet kunde inte laddas.", "Could not load vehicle materials.")}</p><button className="ghost-button" type="button" onClick={() => setRetry((value) => value + 1)}>{t("Erneut laden", "Ladda igen", "Reload")}</button></>}
    {status === "reviewed" && <p>{t("Materialverbrauch bereits bestätigt.", "Materialförbrukningen är redan bekräftad.", "Material consumption already confirmed.")}</p>}
    {status === "ready" && !lines.length && <p>{t("Für diesen Auftrag ist kein kommissioniertes Material auf einem Fahrzeug bereitgestellt.", "Inget plockat material har lastats för detta uppdrag.", "No picked materials have been loaded for this job.")}</p>}
    {lines.map((line) => <div className={styles.materialReviewLine} key={`${line.material_id}:${line.source_id}`}>
      <div><strong>{line.material?.sku ? `${line.material.sku} · ` : ""}{line.material?.name}</strong><small>{locations.find((location) => location.id === line.source_id)?.name ?? t("Fahrzeug", "Fordon", "Vehicle")}</small></div>
      <strong>{new Intl.NumberFormat(language).format(line.allocated_quantity)} {line.material?.unit}</strong>
    </div>)}
  </section>;
}

export function FieldCompletionCheck({ language, onCancel, onConfirm }: {
  language: "de" | "sv" | "en"; onCancel: () => void; onConfirm: () => void;
}) {
  const [material, setMaterial] = useState(false), [times, setTimes] = useState(false), [photos, setPhotos] = useState("");
  const t = (de: string, sv: string, en: string) => language === "sv" ? sv : language === "en" ? en : de;
  return <section className={styles.fieldMaterialReview} aria-labelledby="completion-check-title">
    <h3 id="completion-check-title">{t("Abschluss prüfen", "Kontrollera avslut", "Check completion")}</h3>
    <fieldset>
      <legend>{t("Sind alle Angaben korrekt erfasst?", "Är alla uppgifter korrekt registrerade?", "Is everything recorded correctly?")}</legend>
      <label><input type="checkbox" checked={material} onChange={(event) => setMaterial(event.target.checked)} />{t("Material vollständig und korrekt erfasst", "Material fullständigt och korrekt registrerat", "Materials fully and correctly recorded")}</label>
      <label><input type="checkbox" checked={times} onChange={(event) => setTimes(event.target.checked)} />{t("Arbeitszeiten vollständig und korrekt erfasst", "Arbetstider fullständigt och korrekt registrerade", "Work times fully and correctly recorded")}</label>
    </fieldset>
    <fieldset><legend>{t("Wurden Fotos aufgenommen und hinzugefügt?", "Har foton tagits och lagts till?", "Have photos been taken and added?")}</legend>
      <label><input type="radio" name="completion-photos" checked={photos === "yes"} onChange={() => setPhotos("yes")} />{t("Ja, Fotos hinzugefügt", "Ja, foton tillagda", "Yes, photos added")}</label>
      <label><input type="radio" name="completion-photos" checked={photos === "none"} onChange={() => setPhotos("none")} />{t("Fotos nicht erforderlich", "Foton behövs inte", "Photos not required")}</label>
    </fieldset>
    <footer className={styles.actions}><button className="ghost-button" type="button" onClick={onCancel}>{t("Zurück zur Bearbeitung", "Tillbaka till redigering", "Back to editing")}</button><button className="primary-button" type="button" disabled={!material || !times || !photos} onClick={onConfirm}>{t("Angaben bestätigen und fortfahren", "Bekräfta och fortsätt", "Confirm and continue")}</button></footer>
  </section>;
}
