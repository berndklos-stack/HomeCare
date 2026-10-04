import { expect, test } from "@playwright/test";

for (const width of [1440, 390, 360]) for (const theme of ["light", "dark"] as const) {
  test(`Kopfzeile deckt scrollenden Inhalt ab: ${width}px ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem("kolaretorp-field-progress", JSON.stringify({ "HEADER-FIXTURE": {} }));
    });
    await page.goto("/");
    await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
    if (await page.locator("main.app").getAttribute("data-theme") !== theme) {
      await page.getByRole("button", { name: theme === "dark" ? "Dunkelmodus" : "Hellmodus", exact: true }).click();
    }
    const header = page.locator(".topbar");
    const workspace = page.locator(".workspace");
    const sidebarBefore = await page.locator(".sidebar").boundingBox();
    // A full-width, elevated page section exercises both the header surface
    // and the otherwise uncovered workspace gutters while scrolling.
    await workspace.evaluate((element) => {
      const style = getComputedStyle(element);
      const fixture = document.createElement("section");
      fixture.id = "header-scroll-fixture";
      Object.assign(fixture.style, {
        height: "3000px", position: "relative", zIndex: "45", background: "rgb(255, 0, 255)",
        marginLeft: `-${style.paddingLeft}`, marginRight: `-${style.paddingRight}`,
      });
      element.querySelector(".topbar")!.after(fixture);
    });
    const initialHeader = (await header.boundingBox())!;
    expect((await page.locator("#header-scroll-fixture").boundingBox())!.y).toBeGreaterThanOrEqual(initialHeader.y + initialHeader.height);
    await workspace.evaluate((element) => { element.scrollTop = 650; });
    expect(await workspace.evaluate((element) => element.scrollTop)).toBe(650);
    const rect = (await header.boundingBox())!;
    const viewport = (await workspace.boundingBox())!;
    expect(rect.y).toBeGreaterThanOrEqual(viewport.y);
    expect(rect.y + rect.height).toBeLessThan(900);
    expect(await page.locator(".sidebar").boundingBox()).toEqual(sidebarBefore);

    // Changing only the covered content must not change any painted pixel of
    // the header's lower background strip, including both side gutters.
    const clip = { x: viewport.x + 1, y: Math.floor(rect.y + rect.height - 7), width: await workspace.evaluate((element) => element.clientWidth) - 2, height: 4 };
    const before = await page.screenshot({ clip, animations: "disabled" });
    await page.locator("#header-scroll-fixture").evaluate((element) => { (element as HTMLElement).style.background = "rgb(0, 255, 0)"; });
    const after = await page.screenshot({ clip, animations: "disabled" });
    expect(after.equals(before), "Seiteninhalt darf durch keinen Teil der Kopfzeile scheinen").toBe(true);

    const style = await header.evaluate((element) => {
      const css = getComputedStyle(element);
      return { background: css.backgroundColor, opacity: css.opacity, filter: css.backdropFilter, position: css.position };
    });
    expect(style.background).toBe(theme === "dark" ? "rgb(32, 33, 36)" : "rgb(245, 245, 247)");
    expect(style.opacity).toBe("1");
    expect(style.filter).toBe("none");
    expect(style.position).toBe("sticky");
    for (const control of [page.getByRole("textbox", { name: "Suchen", exact: true }), page.getByRole("combobox", { name: "Sprache", exact: true }),
      ...["Fahrt", "Aktualisieren", "Abmelden", theme === "dark" ? "Hellmodus" : "Dunkelmodus"].map((name) => page.getByRole("button", { name, exact: true })), page.locator(".sync-status")]) {
      await expect(control).toBeInViewport();
      expect(await control.evaluate((element) => {
        const r = element.getBoundingClientRect();
        return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      })).toBe(true);
    }
    await expect(header.locator("h1")).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `test-results/header-layering-${width}-${theme}-${test.info().project.name}.png` });
  });
}
