import { NextResponse } from "next/server";

function escapeAirtableFormulaValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function getFieldString(fields: any, candidates: string[]) {
  for (const key of candidates) {
    const v = fields?.[key];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
  }
  return "";
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const match_id = searchParams.get("match_id") || "";

    if (!match_id) {
      return NextResponse.json({ ok: false, message: "match_id is required" }, { status: 400 });
    }

    const airtableToken = process.env.AIRTABLE_TOKEN;
    const baseId = process.env.AIRTABLE_BASE_ID;
    const tableIdOrName = process.env.AIRTABLE_MATCHES_TABLE;

    if (!airtableToken || !baseId || !tableIdOrName) {
      return NextResponse.json(
        { ok: false, message: "서버 설정(Airtable)이 없습니다." },
        { status: 500 }
      );
    }

    const safeMatchId = escapeAirtableFormulaValue(match_id);

    const url =
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableIdOrName)}` +
      `?filterByFormula=${encodeURIComponent(`{match_id}='${safeMatchId}'`)}` +
      `&maxRecords=1`;

    const r = await fetch(url, { headers: { Authorization: `Bearer ${airtableToken}` } });
    if (!r.ok) {
      const text = await r.text();
      return NextResponse.json(
        { ok: false, message: `Airtable 조회 실패: ${r.status} ${text}` },
        { status: 500 }
      );
    }

    const data = await r.json();
    const record = data?.records?.[0];
    if (!record) {
      return NextResponse.json({ ok: false, message: "없는 match_id 입니다." }, { status: 404 });
    }

    const f = record.fields || {};
    const aKey = getFieldString(f, ["a_join_key"]);
    const bKey = getFieldString(f, ["b_join_key"]);

    if (!aKey || !bKey) {
      return NextResponse.json(
        { ok: false, message: "Airtable에 a_join_key/b_join_key가 없습니다." },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      match_id,
      a_join_key: aKey,
      b_join_key: bKey,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "Unknown error" }, { status: 500 });
  }
}
