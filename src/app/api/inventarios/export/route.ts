import { NextRequest } from 'next/server';
import { handleExportInventario } from '../exportHelper';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleExportInventario(request);
}
