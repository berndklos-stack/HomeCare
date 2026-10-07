import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
  expect(fields.find((f: any) => f.WFKey.Value.string === "reminders").WFValue.Value.WFArrayParameterStateItems).toEqual([]);
  expect(find("Full payload").WFDictionaryValue.Value.OutputUUID).toBe(find("Reminders array").UUID);
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
