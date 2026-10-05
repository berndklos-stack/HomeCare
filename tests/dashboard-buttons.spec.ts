import { expect, test } from "@playwright/test";
import { formatGoogleAddress } from "../app/api/geocode/reverse/route";

test("Reverse Geocoding ergänzt ländliche Ortsnamen ohne normale Straßen zu verändern", () => {
  expect(formatGoogleAddress({
    address_components: [
      { long_name: "126", types: ["street_number"] },
      { long_name: "Gunnabo", types: ["sublocality_level_1"] },
      { long_name: "38291", types: ["postal_code"] },
      { long_name: "Nybro", types: ["postal_town"] },
    ],
  })).toBe("Gunnabo 126, 38291 Nybro");

  expect(formatGoogleAddress({
    address_components: [
      { long_name: "126", types: ["street_number"] },
      { long_name: "Gunnabo", types: ["locality"] },
      { long_name: "38291", types: ["postal_code"] },
      { long_name: "Nybro", types: ["postal_town"] },
    ],
  })).toBe("Gunnabo 126, 38291 Nybro");

  expect(formatGoogleAddress({
    address_components: [
      { long_name: "5", types: ["street_number"] },
      { long_name: "Storgatan", types: ["route"] },
      { long_name: "Centrum", types: ["neighborhood"] },
      { long_name: "38230", types: ["postal_code"] },
      { long_name: "Nybro", types: ["postal_town"] },
    ],
  })).toBe("Storgatan 5, 38230 Nybro");
});

test("Fahrtenentwurf und Standardfahrt bleiben nutzbar", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Koll" })).toBeVisible();

  await page.getByRole("button", { name: "Fahrt", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Fahrt erfassen" });
  await expect(dialog).toBeVisible();

  const vehicle = dialog.getByLabel("Fahrzeug");
  await vehicle.selectOption({ index: 1 });
  await expect(dialog.getByLabel("Start-Km")).not.toHaveValue("");

  await dialog.getByLabel("Startadresse").fill("Kolaretorp 106, 382 93 Nybro");
  await dialog.getByLabel("Zieladresse").fill("Gunnabo 126, 382 91 Nybro");
  await dialog.getByLabel("Zweck / Ärende").fill("Kundenauftrag Gunnabo");
  await dialog.getByRole("button", { name: "Ziel", exact: true }).click();

  const waypointAddress = dialog.getByLabel("Zwischenziel 1", { exact: true });
  await waypointAddress.fill("Nybro centrum");
  await dialog.getByLabel("Notiz zu Zwischenziel 1").fill("Material abholen");
  await expect(waypointAddress).toHaveCSS("border-top-style", "solid");
  await expect(waypointAddress).toHaveCSS("border-top-width", "1px");

  await dialog.getByLabel("Als Standardfahrt speichern", { exact: true }).check();
  await dialog.getByLabel("Wie soll die Standardfahrt heißen?", { exact: true }).fill("Kolaretorp – Gunnabo");
  await dialog.getByRole("button", { name: "Zwischenstand speichern", exact: true }).click();
  await expect(dialog.getByLabel("Standardfahrt wählen").locator("option", { hasText: "Kolaretorp – Gunnabo" })).toHaveCount(1);

  await dialog.getByLabel("Zieladresse").fill("");
  await waypointAddress.fill("");
  await dialog.getByLabel("Standardfahrt wählen").selectOption("");
  await dialog.getByLabel("Standardfahrt wählen").selectOption({ label: "Kolaretorp – Gunnabo" });
  await expect(dialog.getByLabel("Zieladresse")).toHaveValue("Gunnabo 126, 382 91 Nybro");
  await expect(dialog.getByLabel("Zwischenziel 1", { exact: true })).toHaveValue("Nybro centrum");
  await expect(dialog.getByLabel("End-Km")).toBeFocused();

  await dialog.getByLabel("End-Km").fill("12680");
  await dialog.getByRole("button", { name: "Zwischenstand speichern", exact: true }).click();
  await expect(dialog.getByLabel("Standardfahrt wählen").locator("option", { hasText: "Kolaretorp – Gunnabo" })).toHaveCount(1);
  await expect.poll(async () => page.evaluate(() => {
    const resources = JSON.parse(window.localStorage.getItem("kolaretorp-resources") || "[]");
    const trip = resources.flatMap((resource: { logbook: { purpose: string; status: string; endOdometer: string }[] }) => resource.logbook)
      .find((entry: { purpose: string }) => entry.purpose === "Kundenauftrag Gunnabo");
    return trip ? { status: trip.status, endOdometer: trip.endOdometer } : null;
  })).toEqual({ status: "laufend", endOdometer: "12680" });
  await expect.poll(async () => page.evaluate(() => {
    const draft = window.localStorage.getItem("kolaretorp-quick-trip-draft");
    return draft ? JSON.parse(draft).endOdometer : "";
  })).toBe("12680");

  await dialog.getByRole("button", { name: "Fahrt erfassen schließen" }).click();
  await page.getByRole("button", { name: "Fahrt", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Fahrt erfassen" }).getByLabel("End-Km")).toHaveValue("12680");
});
