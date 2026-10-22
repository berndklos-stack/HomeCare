import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Synthetic Auth identity on staging only. No real reset mails or business writes.
const project = 'ealfegjvbyiiporettpq';
const token = execFileSync('security', ['find-generic-password', '-s', 'Supabase CLI', '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const response = await fetch(`https://api.supabase.com/v1/projects/${project}/api-keys`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
assert(response.ok, 'Staging Auth configuration unavailable');
const keys = await response.json();
const service = keys.find(key => key.name === 'service_role')?.api_key;
const anon = keys.find(key => key.name === 'anon')?.api_key;
assert(service && anon, 'Staging Auth keys unavailable');
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(`https://${project}.supabase.co`, service, options);
const browser = createClient(`https://${project}.supabase.co`, anon, options);
let id;
try {
  const email = `workcore-recovery-${randomUUID()}@example.invalid`;
  const created = await admin.auth.admin.createUser({ email, email_confirm: true, password: `${randomUUID()}Aa1!` });
  assert(!created.error && created.data.user, 'Synthetic Auth identity creation failed'); id = created.data.user.id;
  const link = await admin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: 'https://homecare-xi.vercel.app/auth/accept' } });
  assert(!link.error && link.data.user.id === id && link.data.properties.hashed_token, 'Recovery link creation failed');
  const verified = await browser.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'recovery' });
  assert(!verified.error && verified.data.user?.id === id, 'Recovery session verification failed');
  const password = `${randomUUID()}Aa1!`;
  const changed = await browser.auth.updateUser({ password });
  assert(!changed.error && changed.data.user.id === id, 'Recovery password update failed');
  await browser.auth.signOut();
  const signedIn = await browser.auth.signInWithPassword({ email, password });
  assert(!signedIn.error && signedIn.data.user.id === id, 'Updated password login failed');
  await browser.auth.signOut();
  console.log(JSON.stringify({ project, recoveryVerified: true, passwordChanged: true, updatedLoginVerified: true }));
} finally {
  if (id) { const deleted = await admin.auth.admin.deleteUser(id); assert(!deleted.error, 'Synthetic Auth identity cleanup failed'); console.log('Synthetic staging Auth identity removed.'); }
}
