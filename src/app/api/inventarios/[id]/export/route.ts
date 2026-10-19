import { NextRequest } from 'next/server';
import { handleExportInventario } from '../../exportHelper';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  return handleExportInventario(request, context);
}
