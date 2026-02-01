import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireUser';

export async function GET() {
  const user = await requireUser();
  return NextResponse.json(
    { user },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
