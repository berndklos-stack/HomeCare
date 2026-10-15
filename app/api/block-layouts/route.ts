import { NextResponse } from 'next/server';
import { isAuthError, requireApiAuth } from '@/lib/server/apiAuth';
import { validateBlockLayout, type BlockLayouts } from '@/lib/blockLayouts';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store' };

function e2e(request: Request) {
  return process.env.NODE_ENV !== 'production' && process.env.WORKCORE_E2E_AUTH_BYPASS === '1'
    && request.headers.get('x-workcore-e2e-bypass') === '1';
}

export async function GET(request: Request) {
  if (e2e(request)) return NextResponse.json({ orders: {} }, { headers });
  const auth = await requireApiAuth(request, 'data.read');
  if (isAuthError(auth)) return auth;
  const { data, error } = await auth.client.from('homecare_user_block_layouts')
    .select('scope_key,block_order').eq('tenant_id', auth.tenantId).eq('user_id', auth.user.id);
  if (error) return NextResponse.json({ error: 'BLOCK_LAYOUTS_UNAVAILABLE' }, { status: 503, headers });
  const orders: BlockLayouts = {};
  try {
    for (const row of data ?? []) {
      const layout = validateBlockLayout(row.scope_key, row.block_order);
      Object.defineProperty(orders, layout.scope, { value: layout.order, enumerable: true, configurable: true, writable: true });
    }
  } catch {
    return NextResponse.json({ error: 'BLOCK_LAYOUTS_UNAVAILABLE' }, { status: 503, headers });
  }
  return NextResponse.json({ orders }, { headers });
}

export async function PATCH(request: Request) {
  if (e2e(request)) return NextResponse.json({ error: 'E2E_WRITE_DISABLED' }, { status: 503, headers });
  const auth = await requireApiAuth(request, 'data.read');
  if (isAuthError(auth)) return auth;
  let layout: ReturnType<typeof validateBlockLayout>;
  try {
    const body = await request.json();
    layout = validateBlockLayout(body.scope, body.order);
  } catch {
    return NextResponse.json({ error: 'INVALID_BLOCK_LAYOUT' }, { status: 400, headers });
  }
  const { data, error } = await auth.client.rpc('homecare_update_block_layout', {
    p_tenant_id: auth.tenantId, p_scope_key: layout.scope, p_block_order: layout.order,
  });
  if (error) return NextResponse.json({ error: 'BLOCK_LAYOUT_SAVE_FAILED' }, { status: 503, headers });
  try {
    const saved = validateBlockLayout(data?.scope_key, data?.block_order);
    if (saved.scope !== layout.scope) throw new Error('INVALID_BLOCK_LAYOUT_RESPONSE');
    return NextResponse.json(saved, { headers });
  } catch {
    return NextResponse.json({ error: 'BLOCK_LAYOUT_SAVE_FAILED' }, { status: 503, headers });
  }
}
