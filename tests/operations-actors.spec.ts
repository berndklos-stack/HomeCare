import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { attachOperationsActors } from "../lib/server/operationsActors";

test("Buchungsbenutzer werden nur fuer den Mandanten und die gelesenen IDs aufgeloest", async () => {
  const calls: unknown[] = [];
  const query = {
    select: (columns: string) => { calls.push(columns); return query; },
    eq: (column: string, value: string) => { calls.push([column, value]); return query; },
    in: async (column: string, ids: string[]) => { calls.push([column, ids]); return { data: [
      { id: "user-1", display_name: " Bernd Klos ", email: "bernd@example.test" },
      { id: "user-2", display_name: "", email: "office@example.test" },
    ], error: null }; },
  };
  const client = { from: (table: string) => { calls.push(table); return query; } } as unknown as SupabaseClient;
  const rows: Record<string, unknown>[] = [{ actor_user_id: "user-1" }, { actor_user_id: "user-1" }, { actor_user_id: "user-2" }, { actor_user_id: "deleted-user" }];
  await attachOperationsActors(client, "tenant-current", rows);
  expect(calls).toEqual(["homecare_user_profiles", "id,display_name,email", ["tenant_id", "tenant-current"], ["id", ["user-1", "user-2", "deleted-user"]]]);
  expect(rows.map((row) => row.actor_name)).toEqual(["Bernd Klos", "Bernd Klos", "office@example.test", null]);
});

test("Keine Benutzerabfrage ohne Buchungsbenutzer", async () => {
  const client = { from: () => { throw new Error("Unexpected query"); } } as unknown as SupabaseClient;
  await attachOperationsActors(client, "tenant-current", [{ id: "legacy" }]);
});
