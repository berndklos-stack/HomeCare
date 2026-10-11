import { expect, test } from "@playwright/test";
import { pickingIdFromMovementNote, stockMovementNote } from "../lib/stockMovementNote";

const id = "de707594-031f-4ab3-bb90-8283c808513a";
test("Buchungsgrund zeigt Kommissioniercode statt technischer ID", () => {
  for (const label of ["Kommissionierung", "Kommissionierung verladen"]) {
    expect(pickingIdFromMovementNote(`${label} ${id}`)).toBe(id);
    expect(stockMovementNote(`${label} ${id}`, "2026-10-11-00002")).toBe(`${label} · 2026-10-11-00002`);
    expect(stockMovementNote(`${label} ${id}`)).toBe(label);
  }
  expect(stockMovementNote("Lieferschein 4321")).toBe("Lieferschein 4321");
  expect(stockMovementNote(`Korrekturbuchung [${id}]: Menge berichtigt`)).toBe("Korrekturbuchung · Menge berichtigt");
  expect(stockMovementNote("Korrekturbuchung [12dc83db-1a3e-f839-cebc-3924bb119753]: komplett zurück")).toBe("Korrekturbuchung · komplett zurück");
  expect(pickingIdFromMovementNote(`Kundenhinweis ${id}`)).toBeNull();
});
