import { NextResponse } from 'next/server';

export async function GET() {
  const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;

  if (!APPS_SCRIPT_URL) {
    return NextResponse.json({ error: 'APPS_SCRIPT_URL is not defined' }, { status: 500 });
  }

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch from Google: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Proxy Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
