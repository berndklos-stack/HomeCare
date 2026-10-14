import { NextResponse } from 'next/server';
import { isAuthError, requireApiAuth } from '@/lib/server/apiAuth';
import { defaultLayoutPreferences, navigationOrder, orderedIds, validateLayoutOrder, vehicleBlockOrder } from '@/lib/layoutPreferences';

export const runtime = 'nodejs';
function e2e(request: Request) { return process.env.NODE_ENV !== 'production' && process.env.WORKCORE_E2E_AUTH_BYPASS === '1' && request.headers.get('x-workcore-e2e-bypass') === '1'; }
const projection = (row: { navigation_order?: unknown; vehicle_block_order?: unknown } | null) => ({ navigationOrder: orderedIds(row?.navigation_order, navigationOrder), vehicleBlockOrder: orderedIds(row?.vehicle_block_order, vehicleBlockOrder) });
export async function GET(request: Request) {
  // Never access real preferences through the local UI test bypass.
  if (e2e(request)) return NextResponse.json({ preferences: defaultLayoutPreferences() });
  const auth = await requireApiAuth(request, 'data.read');
  if (isAuthError(auth)) return auth;
  const { data, error } = await auth.client.from('homecare_user_layout_preferences').select('navigation_order,vehicle_block_order').eq('tenant_id', auth.tenantId).eq('user_id', auth.user.id).maybeSingle();
  if (error) return NextResponse.json({ error: 'LAYOUT_UNAVAILABLE' }, { status: 503 });
  return NextResponse.json({ preferences: projection(data) }, { headers: { 'Cache-Control': 'private, no-store' } });
}
export async function PATCH(request: Request) {
  if (e2e(request)) return NextResponse.json({ error: 'E2E_WRITE_DISABLED' }, { status: 503 });
  const auth = await requireApiAuth(request, 'data.read');
  if (isAuthError(auth)) return auth;
  let key: unknown, value: unknown;
  try { ({ key, value } = await request.json()); validateLayoutOrder(key, value); }
  catch { return NextResponse.json({ error: 'INVALID_LAYOUT_ORDER' }, { status: 400 }); }
  const { data, error } = await auth.client.rpc('homecare_update_layout_preference', { p_tenant_id: auth.tenantId, p_key: key, p_value: value });
  if (error) return NextResponse.json({ error: 'LAYOUT_SAVE_FAILED' }, { status: 503 });
  return NextResponse.json({ preferences: projection(data) }, { headers: { 'Cache-Control': 'private, no-store' } });
}
