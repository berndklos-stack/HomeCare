import { test, expect } from "@playwright/test";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync, spawnSync } from "node:child_process";

const root = resolve(__dirname, "..");
const manifest = readFileSync(resolve(root, "docs/shortcuts/workcore-erinnerungen.workflow.json"), "utf8");
const workflow = JSON.parse(manifest);
const actions = workflow.WFWorkflowActions as Array<{ WFWorkflowActionIdentifier: string; WFWorkflowActionParameters: Record<string, any> }>;
const find = (name: string) => actions.find((a) => a.WFWorkflowActionParameters.CustomOutputName === name)!.WFWorkflowActionParameters;

test("Vorlage enthält nur lesende Apple-Aktionen und zwei zugangsfreie Importfragen", () => {
  const allowed = ["gettext", "conditional", "alert", "exit", "filter.reminders", "repeat.each", "properties.reminders", "setvariable", "format.date", "dictionary", "date", "setvalueforkey", "downloadurl", "detect.dictionary", "getvalueforkey", "output"];
  for (const action of actions) expect(allowed).toContain(action.WFWorkflowActionIdentifier.replace("is.workflow.actions.", ""));
  expect(workflow.WFWorkflowImportQuestions.map((q: { ActionIndex: number }) => q.ActionIndex)).toEqual([0, 1]);
  for (const question of workflow.WFWorkflowImportQuestions) {
    expect(actions[question.ActionIndex].WFWorkflowActionIdentifier).toBe("is.workflow.actions.gettext");
    expect(actions[question.ActionIndex].WFWorkflowActionParameters[question.ParameterKey]).toBe(question.DefaultValue);
  }
  expect(manifest).not.toMatch(/Bearer [a-f0-9]{64}/i);
  expect(manifest).not.toContain("service_role");
  const filter = find("Open reminders");
  expect(filter.WFContentItemLimitEnabled).toBe(false);
  expect(filter.WFContentItemFilter.Value.WFActionParameterFilterTemplates).toEqual([
    { Operator: 4, Property: "Is Completed", Removable: true, Values: { Bool: false } },
  ]);
  expect(actions.filter((a) => a.WFWorkflowActionIdentifier === "is.workflow.actions.properties.reminders").map((a) => a.WFWorkflowActionParameters.WFContentItemPropertyName)).toEqual(["Title", "List", "Notes", "Due Date"]);
});

test("native Verknüpfungen, Wiederholung und leere Momentaufnahme bleiben gültig", () => {
  const seen = new Set<string>();
  const groups: string[] = [];
  function refs(value: any): void {
    if (!value || typeof value !== "object") return;
    if (value.Type === "ActionOutput") expect(seen.has(value.OutputUUID), value.OutputUUID).toBe(true);
    Object.values(value).forEach(refs);
  }
  for (const { WFWorkflowActionParameters: p } of actions) {
    refs(p);
    expect(seen.has(p.UUID)).toBe(false);
    seen.add(p.UUID);
    if (p.GroupingIdentifier && p.WFControlFlowMode === 0) groups.push(p.GroupingIdentifier);
    if (p.GroupingIdentifier && p.WFControlFlowMode === 2) expect(groups.pop()).toBe(p.GroupingIdentifier);
  }
  expect(groups).toEqual([]);
  const fields = find("Empty payload").WFItems.Value.WFDictionaryFieldValueItems;
  const reminders = fields.find((f: any) => f.WFKey.Value.string === "reminders").WFValue;
  expect(reminders.WFSerializationType).toBe("WFArrayParameterState");
  expect(Array.isArray(reminders.Value)).toBe(true);
  expect(reminders.Value).toEqual([]);
  const value = find("Full payload").WFDictionaryValue;
  expect(value.WFSerializationType).toBe("WFTextTokenString");
  expect(value.Value.string).toBe("\uFFFC");
  expect(value.Value.attachmentsByRange["{0, 1}"].OutputUUID).toBe(find("Reminders array").UUID);
  const row = find("Reminder").WFItems.Value.WFDictionaryFieldValueItems;
  expect(row.map((f: any) => f.WFKey.Value.string)).toEqual(["title", "list", "notes", "date"]);
  expect(find("Clear date").WFInput.Value.OutputUUID).toBe(find("Empty date").UUID);
});

test("einziger HTTP-Aufruf sendet JSON nur an WorkCore; signierter Download erreichbar", async ({ request }) => {
  const calls = actions.filter((a) => a.WFWorkflowActionIdentifier === "is.workflow.actions.downloadurl");
  expect(calls).toHaveLength(1);
  const call = calls[0].WFWorkflowActionParameters;
  expect(call.WFURL).toBe("https://homecare-xi.vercel.app/api/integrations/apple-reminders");
  expect(call.WFHTTPMethod).toBe("PUT");
  expect(call.WFHTTPBodyType).toBe("File");
  expect(call.WFRequestVariable.Value.OutputUUID).toBe(find("JSON body").UUID);
  expect(call.WFHTTPHeaders.Value.WFDictionaryFieldValueItems.map((f: any) => f.WFKey.Value.string)).toEqual(["Authorization", "X-WorkCore-Tenant", "Content-Type"]);
  const local = readFileSync(resolve(root, "public/shortcuts/workcore-erinnerungen.shortcut"));
  expect(local.subarray(0, 4).toString()).toBe("AEA1");
  const response = await request.get("/shortcuts/workcore-erinnerungen.shortcut");
  expect(response.status()).toBe(200);
  expect(await response.body()).toEqual(local);
});

test("alle Wenn-Bedingungen enthalten einen vollständigen Apple-Variablenbezug", () => {
  const conditions = actions.filter((a) => a.WFWorkflowActionIdentifier === "is.workflow.actions.conditional" && a.WFWorkflowActionParameters.WFControlFlowMode === 0);
  expect(conditions).toHaveLength(7);
  expect(conditions.map((a) => a.WFWorkflowActionParameters.WFCondition)).toEqual([101, 4, 101, 4, 100, 100, 100]);
  for (const { WFWorkflowActionParameters: p } of conditions) {
    expect(p.WFInput.Type).toBe("Variable");
    expect(p.WFInput.Variable.WFSerializationType).toBe("WFTextTokenAttachment");
    expect(p.WFInput.Variable.Value.Type).toBe("ActionOutput");
    expect(p.WFInput.Variable.Value.OutputUUID).toBeTruthy();
    if (p.WFCondition === 4) expect(p.WFConditionalActionString).toBeTruthy();
  }
});

test("Apples Serializer reproduziert den alten Bearbeitungsabsturz und akzeptiert die korrigierte Vorlage", () => {
  test.skip(process.platform !== "darwin", "WorkflowKit ist nur auf macOS verfügbar; Strukturtests laufen auf allen Plattformen.");
  const temp = mkdtempSync(join(tmpdir(), "workcore-shortcut-test-"));
  try {
    const validator = join(temp, "validate");
    execFileSync("clang", ["-framework", "Foundation", "-o", validator, resolve(root, "scripts/validate-apple-reminders-shortcut.m")]);
    const bad = JSON.parse(manifest);
    const payload = bad.WFWorkflowActions.find((a: any) => a.WFWorkflowActionParameters.CustomOutputName === "Empty payload");
    payload.WFWorkflowActionParameters.WFItems.Value.WFDictionaryFieldValueItems.find((f: any) => f.WFItemType === 2).WFValue.Value = { WFArrayParameterStateItems: [] };
    const badFile = join(temp, "old-invalid-workflow.json");
    writeFileSync(badFile, JSON.stringify(bad));
    const old = spawnSync(validator, [badFile], { encoding: "utf8" });
    expect(old.status).toBe(1);
    expect(old.stderr).toContain("NSInvalidArgumentException");
    expect(old.stderr).toContain("attempt to insert nil object");
    const badConditional = JSON.parse(manifest);
    const condition = badConditional.WFWorkflowActions.find((a: any) => a.WFWorkflowActionIdentifier === "is.workflow.actions.conditional");
    condition.WFWorkflowActionParameters.WFInput = condition.WFWorkflowActionParameters.WFInput.Variable;
    const badConditionFile = join(temp, "old-invalid-condition.json");
    writeFileSync(badConditionFile, JSON.stringify(badConditional));
    const missing = spawnSync(validator, [badConditionFile], { encoding: "utf8" });
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain("Invalid conditional input: access-empty-if");
    const badValue = JSON.parse(manifest);
    const setter = badValue.WFWorkflowActions.find((a: any) => a.WFWorkflowActionIdentifier === "is.workflow.actions.setvalueforkey");
    setter.WFWorkflowActionParameters.WFDictionaryValue = {
      Value: setter.WFWorkflowActionParameters.WFDictionaryValue.Value.attachmentsByRange["{0, 1}"],
      WFSerializationType: "WFTextTokenAttachment",
    };
    const badValueFile = join(temp, "old-invalid-dictionary-value.json");
    writeFileSync(badValueFile, JSON.stringify(badValue));
    const missingValue = spawnSync(validator, [badValueFile], { encoding: "utf8" });
    expect(missingValue.status).toBe(1);
    expect(missingValue.stderr).toContain("Invalid dictionary value: Full payload");
    const current = spawnSync(validator, [resolve(root, "docs/shortcuts/workcore-erinnerungen.workflow.json")], { encoding: "utf8" });
    expect(current.status, current.stderr).toBe(0);
    expect(current.stdout).toContain("4 parameter states roundtripped");
    expect(current.stdout).toContain("7 conditional inputs roundtripped");
    expect(current.stdout).toContain("1 typed dictionary values roundtripped");
    for (const count of [0, 1, 5]) expect(current.stdout).toContain(`${count} reminder dictionaries preserved`);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
