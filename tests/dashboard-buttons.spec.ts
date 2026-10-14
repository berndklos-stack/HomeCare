import { expect, test } from "@playwright/test";
import { formatGoogleAddress } from "../app/api/geocode/reverse/route";
import { createVehicleStandardTrip } from "./helpers/vehicle-standard-trips";

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

test("Fahrtenentwurf und beim Fahrzeug angelegte Standardfahrt bleiben nutzbar", async ({ page }) => {
  const { dialog: resourceDialog, editor } = await createVehicleStandardTrip(page, "Kolaretorp - Gunnabo");
  await editor.getByRole("button", { name: "Standardfahrt bearbeiten Kolaretorp - Gunnabo", exact: true }).click();
  await editor.getByRole("button", { name: "Zwischenstopp hinzufügen", exact: true }).click();
  await editor.getByLabel("Zwischenstopp 1", { exact: true }).fill("Nybro centrum");
  await editor.getByLabel("Notiz 1", { exact: true }).fill("Material abholen");
  await editor.getByRole("button", { name: "Standardfahrt speichern", exact: true }).click();
  await resourceDialog.getByRole("button", { name: "Ressource schließen", exact: true }).click();
  await page.getByRole("button", { name: "Fahrt", exact: true }).click();
  const trip = page.locator(".quick-trip-page");
  await trip.getByLabel("Standardfahrt wählen", { exact: true }).selectOption({ label: "Kolaretorp - Gunnabo" });
  await expect(trip.getByLabel("Zieladresse", { exact: true })).toHaveValue("Gunnabo");
  await expect(trip.getByLabel("Zwischenziel 1", { exact: true })).toHaveValue("Nybro centrum");
  await expect(trip.getByLabel("End-Km", { exact: true })).toBeFocused();
  await expect(trip.getByLabel("Als Standardfahrt speichern", { exact: true })).toHaveCount(0);
  await trip.getByLabel("End-Km", { exact: true }).fill("12680");
  await trip.getByRole("button", { name: "Zwischenstand speichern", exact: true }).click();
  await expect.poll(async () => page.evaluate(() => {
    const resources = JSON.parse(localStorage.getItem("kolaretorp-resources") || "[]");
    return resources.flatMap((resource: { logbook: { purpose: string; status: string; endOdometer: string }[] }) => resource.logbook)
      .find((entry: { purpose: string }) => entry.purpose === "Kundenauftrag Gunnabo")?.status;
  })).toBe("laufend");
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("kolaretorp-quick-trip-draft") || "{}").endOdometer)).toBe("12680");
  await trip.getByRole("button", { name: "Fahrt erfassen Schließen", exact: true }).click();
  await page.getByRole("button", { name: "Fahrt", exact: true }).click();
  await expect(trip.getByLabel("End-Km", { exact: true })).toHaveValue("12680");
});
