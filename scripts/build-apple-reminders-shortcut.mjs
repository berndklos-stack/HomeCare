import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

// Native Shortcuts workflow: no access to Apple data during generation/signing.
const actions = [];
const id = (name) => {
  const hex = createHash("sha256").update(`workcore-reminders:${name}`).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`.toUpperCase();
};
const token = (Value) => ({ Value, WFSerializationType: "WFTextTokenAttachment" });
const ref = (name) => token({ Type: "ActionOutput", OutputUUID: id(name), OutputName: name });
const variable = (name) => token({ Type: "Variable", VariableName: name });
// Conditional subjects need a typed wrapper, unlike ordinary action inputs.
const subject = (input) => ({ Type: "Variable", Variable: input });
const text = (value) => ({ Value: { string: value }, WFSerializationType: "WFTextTokenString" });
const inline = (attachment) => ({
  Value: { string: "\uFFFC", attachmentsByRange: { "{0, 1}": attachment.Value } },
  WFSerializationType: "WFTextTokenString",
});
function action(type, name, parameters = {}) {
  actions.push({ WFWorkflowActionIdentifier: `is.workflow.actions.${type}`, WFWorkflowActionParameters: {
    ...parameters, UUID: id(name), CustomOutputName: name,
  } });
}
function guard(name, input, message, condition = 101) {
  action("conditional", `${name}-if`, { WFInput: subject(input), WFCondition: condition,
    ...(condition === 4 ? { WFConditionalActionString: message } : {}),
    WFControlFlowMode: 0, GroupingIdentifier: id(name) });
  action("alert", `${name}-alert`, { WFAlertActionTitle: "WorkCore Einrichtung",
    WFAlertActionMessage: "Bitte den Zugang und die Mandantenkennung unter Stammdaten > Tagesmail kopieren und in den ersten beiden Textaktionen eintragen.",
    WFAlertActionCancelButtonShown: false });
  action("exit", `${name}-stop`);
  action("conditional", `${name}-end`, { WFControlFlowMode: 2, GroupingIdentifier: id(name) });
}
function dictionary(name, fields) {
  action("dictionary", name, { WFItems: { Value: { WFDictionaryFieldValueItems: fields.map(([key, value, type = 0]) => ({
    WFItemType: type, WFKey: text(key), WFValue: value,
  })) }, WFSerializationType: "WFDictionaryFieldValue" } });
}

action("gettext", "Authorization", { WFTextActionText: "BEARER_AUS_WORKCORE_EINTRAGEN" });
action("gettext", "Tenant", { WFTextActionText: "MANDANT_AUS_WORKCORE_EINTRAGEN" });
guard("access-empty", ref("Authorization"));
guard("access-placeholder", ref("Authorization"), "BEARER_AUS_WORKCORE_EINTRAGEN", 4);
guard("tenant-empty", ref("Tenant"));
guard("tenant-placeholder", ref("Tenant"), "MANDANT_AUS_WORKCORE_EINTRAGEN", 4);
action("filter.reminders", "Open reminders", {
  WFContentItemFilter: { Value: {
    WFActionParameterFilterPrefix: 1, WFContentPredicateBoundedDate: false,
    WFActionParameterFilterTemplates: [{ Operator: 4, Property: "Is Completed", Removable: true, Values: { Bool: false } }],
  }, WFSerializationType: "WFContentPredicateTableTemplate" },
  WFContentItemLimitEnabled: false,
});
action("repeat.each", "Repeat start", { WFInput: ref("Open reminders"), WFControlFlowMode: 0, GroupingIdentifier: id("repeat") });
for (const [name, property] of [["Title", "Title"], ["List", "List"], ["Notes", "Notes"], ["Due date", "Due Date"]]) {
  action("properties.reminders", name, { WFInput: variable("Repeat Item"), WFContentItemPropertyName: property });
}
action("gettext", "Empty date", { WFTextActionText: "" });
action("setvariable", "Clear date", { WFVariableName: "Due text", WFInput: ref("Empty date") });
action("conditional", "Date if", { WFInput: subject(ref("Due date")), WFCondition: 100, WFControlFlowMode: 0, GroupingIdentifier: id("due-if") });
action("format.date", "Formatted date", { WFDate: ref("Due date"), WFDateFormatStyle: "Custom", WFTimeFormatStyle: "None", WFDateFormat: "yyyy-MM-dd" });
action("setvariable", "Set date", { WFVariableName: "Due text", WFInput: ref("Formatted date") });
action("conditional", "Date end", { WFControlFlowMode: 2, GroupingIdentifier: id("due-if") });
dictionary("Reminder", [["title", inline(ref("Title"))], ["list", inline(ref("List"))],
  ["notes", inline(ref("Notes"))], ["date", inline(variable("Due text"))]]);
action("repeat.each", "Reminders array", { WFControlFlowMode: 2, GroupingIdentifier: id("repeat") });
action("date", "Now", { WFDateActionMode: "Current Date" });
action("format.date", "Timestamp", { WFDate: ref("Now"), WFDateFormatStyle: "Custom", WFTimeFormatStyle: "None", WFDateFormat: "yyyy-MM-dd'T'HH:mm:ssXXX" });
dictionary("Empty payload", [["generatedAt", inline(ref("Timestamp"))], ["reminders", {
  Value: [], WFSerializationType: "WFArrayParameterState",
}, 2]]);
action("setvariable", "Initialize payload", { WFVariableName: "Payload", WFInput: ref("Empty payload") });
action("conditional", "Results if", { WFInput: subject(ref("Reminders array")), WFCondition: 100, WFControlFlowMode: 0, GroupingIdentifier: id("results-if") });
action("setvalueforkey", "Full payload", { WFDictionary: ref("Empty payload"), WFDictionaryKey: "reminders", WFDictionaryValue: ref("Reminders array") });
action("setvariable", "Set payload", { WFVariableName: "Payload", WFInput: ref("Full payload") });
action("conditional", "Results end", { WFControlFlowMode: 2, GroupingIdentifier: id("results-if") });
action("gettext", "JSON body", { WFTextActionText: inline(variable("Payload")) });
const headers = [["Authorization", inline(ref("Authorization"))], ["X-WorkCore-Tenant", inline(ref("Tenant"))], ["Content-Type", text("application/json")]];
action("downloadurl", "Response", {
  WFURL: "https://homecare-xi.vercel.app/api/integrations/apple-reminders", WFHTTPMethod: "PUT", WFHTTPBodyType: "File",
  WFRequestVariable: ref("JSON body"),
  WFFormValues: { Value: { WFDictionaryFieldValueItems: [] }, WFSerializationType: "WFDictionaryFieldValue" },
  WFHTTPHeaders: { Value: { WFDictionaryFieldValueItems: headers.map(([key, value]) => ({ WFItemType: 0, WFKey: text(key), WFValue: value })) }, WFSerializationType: "WFDictionaryFieldValue" },
});
action("detect.dictionary", "Response dictionary", { WFInput: ref("Response") });
action("getvalueforkey", "Error", { WFInput: ref("Response dictionary"), WFGetDictionaryValueType: "Value", WFDictionaryKey: "error" });
action("conditional", "Error if", { WFInput: subject(ref("Error")), WFCondition: 100, WFControlFlowMode: 0, GroupingIdentifier: id("error-if") });
action("alert", "Error message", { WFAlertActionTitle: "WorkCore Uebertragung fehlgeschlagen", WFAlertActionMessage: inline(ref("Error")), WFAlertActionCancelButtonShown: false });
action("exit", "Error stop");
action("conditional", "Error end", { WFControlFlowMode: 2, GroupingIdentifier: id("error-if") });
action("output", "Result", { WFOutput: ref("Response dictionary") });

const workflow = {
  WFWorkflowName: "WorkCore Erinnerungen senden", WFWorkflowClientVersion: "3036.0.4.2",
  WFWorkflowMinimumClientVersion: 900, WFWorkflowMinimumClientVersionString: "900",
  WFWorkflowIcon: { WFWorkflowIconStartColor: 3031607807, WFWorkflowIconGlyphNumber: 61440 },
  WFWorkflowTypes: [], WFWorkflowInputContentItemClasses: [], WFWorkflowActions: actions,
  WFWorkflowImportQuestions: [
    { ActionIndex: 0, ParameterKey: "WFTextActionText", Category: "Parameter", Text: "Authorization aus WorkCore einfuegen (inklusive Bearer). Nicht weitergeben.", DefaultValue: "BEARER_AUS_WORKCORE_EINTRAGEN" },
    { ActionIndex: 1, ParameterKey: "WFTextActionText", Category: "Parameter", Text: "X-WorkCore-Tenant aus WorkCore einfuegen.", DefaultValue: "MANDANT_AUS_WORKCORE_EINTRAGEN" },
  ],
};
mkdirSync(resolve("docs/shortcuts"), { recursive: true });
const manifest = resolve("docs/shortcuts/workcore-erinnerungen.workflow.json");
writeFileSync(manifest, JSON.stringify(workflow, null, 2) + "\n");
const temp = mkdtempSync(join(tmpdir(), "workcore-reminders-"));
const validator = join(temp, "validate-shortcut");
execFileSync("clang", ["-framework", "Foundation", "-o", validator, resolve("scripts/validate-apple-reminders-shortcut.m")]);
execFileSync(validator, [manifest], { stdio: "inherit" });
const unsigned = join(temp, "WorkCore Erinnerungen senden.shortcut");
execFileSync("plutil", ["-convert", "xml1", "-o", unsigned, manifest]);
mkdirSync(resolve("public/shortcuts"), { recursive: true });
const output = resolve("public/shortcuts/workcore-erinnerungen.shortcut");
execFileSync("shortcuts", ["sign", "--mode", "anyone", "--input", unsigned, "--output", output], { stdio: "inherit" });
console.log(`Signed template: ${output}`);
