import { NextResponse } from 'next/server';

export async function GET() {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_MATCHES_TABLE || 'matches';

  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}?maxRecords=1`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const text = await r.text();

  return NextResponse.json({
    url,
    httpStatus: r.status,
    bodyPreview: text.slice(0, 300),
    hasToken: !!token,
    baseId,
    table,
  });
}