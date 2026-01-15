import { NextResponse } from "next/server";

type MatchState = {
  match_id: string;
  user_a_id: string;
  user_b_id: string;
  a_sent_first: boolean;
  b_sent_first: boolean;
  started_at: number | null; // epoch ms
  expires_at: number | null; // epoch ms
};

const HARD_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function getFieldString(fields: any, candidates: string[]) {
  for (const key of candidates) {
    const v = fields?.[key];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
  }
  return "";
}

function getFieldBool(fields: any, candidates: string[], defaultValue = false) {
  for (const key of candidates) {
    const v = fields?.[key];
    if (v === undefined || v === null) continue;
    if (typeof v === "boolean") return v;
    if (v === 1 || v === "1" || v === "true") return true;
    if (v === 0 || v === "0" || v === "false") return false;
  }
  return defaultValue;
}

function getFieldDateMillis(fields: any, candidates: string[]) {
  for (const key of candidates) {
    const v = fields?.[key];
    if (!v) continue;
    const t = new Date(v).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return null;
}

function toISO(ms: number) {
  return new Date(ms).toISOString();
}

function getAirtableEnv() {
  const airtableToken = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableIdOrName = process.env.AIRTABLE_MATCHES_TABLE;

  if (!airtableToken || !baseId || !tableIdOrName) {
    throw new Error("Airtable env 설정(AIRTABLE_TOKEN/BASE_ID/MATCHES_TABLE)이 없습니다.");
  }
  return { airtableToken, baseId, tableIdOrName };
}

function escapeAirtableFormulaValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function airtableFindMatchRecord(match_id: string) {
  const { airtableToken, baseId, tableIdOrName } = getAirtableEnv();

  const safeMatchId = escapeAirtableFormulaValue(match_id);

  const url =
    `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableIdOrName)}` +
    `?filterByFormula=${encodeURIComponent(`{match_id}='${safeMatchId}'`)}` +
    `&maxRecords=1`;

  const r = await fetch(url, { headers: { Authorization: `Bearer ${airtableToken}` } });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Airtable 조회 실패: ${r.status} ${text}`);
  }

  const data = await r.json();
  const record = data?.records?.[0];
  return record || null;
}

async function airtablePatchRecord(recordId: string, fields: Record<string, any>) {
  const { airtableToken, baseId, tableIdOrName } = getAirtableEnv();

  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(
    tableIdOrName
  )}/${recordId}`;

  const r = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${airtableToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });

  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Airtable PATCH 실패: ${r.status} ${text}`);
  }

  return await r.json();
}

function isHardExpired(expiresAtMs: number | null) {
  if (!expiresAtMs) return false;
  return Date.now() > expiresAtMs + HARD_TTL_MS;
}

// GET /api/match/state?match_id=...
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const match_id = searchParams.get("match_id");

  if (!match_id) {
    return NextResponse.json({ error: "match_id is required" }, { status: 400 });
  }

  try {
    const record = await airtableFindMatchRecord(match_id);
    if (!record) return NextResponse.json({ data: null }, { status: 200 });

    const f = record.fields || {};

    const user_a_id = getFieldString(f, ["a_user_id", "user_a_id"]);
    const user_b_id = getFieldString(f, ["b_user_id", "user_b_id"]);

    const a_sent_first = getFieldBool(f, ["a_sent_first"], false);
    const b_sent_first = getFieldBool(f, ["b_sent_first"], false);

    const started_at = getFieldDateMillis(f, ["started_at"]);
    const expires_at = getFieldDateMillis(f, ["expires_at"]);

    // ✅ 24시간 경과 시: “사라짐”(soft delete)
    if (isHardExpired(expires_at)) {
      return NextResponse.json(
        { data: null, error: "대화가 종료된 후 24시간이 지나 삭제되었습니다." },
        { status: 410 } // Gone
      );
    }

    const data: MatchState = {
      match_id,
      user_a_id,
      user_b_id,
      a_sent_first,
      b_sent_first,
      started_at,
      expires_at,
    };

    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}

// POST /api/match/state
// body: { match_id, user_id }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { match_id, user_id } = body || {};

    if (!match_id || !user_id) {
      return NextResponse.json({ error: "match_id, user_id are required" }, { status: 400 });
    }

    const record = await airtableFindMatchRecord(match_id);
    if (!record) {
      return NextResponse.json({ error: "match not found in Airtable" }, { status: 404 });
    }

    const f = record.fields || {};

    const user_a_id = getFieldString(f, ["a_user_id", "user_a_id"]);
    const user_b_id = getFieldString(f, ["b_user_id", "user_b_id"]);

    let a_sent_first = getFieldBool(f, ["a_sent_first"], false);
    let b_sent_first = getFieldBool(f, ["b_sent_first"], false);
    let started_at = getFieldDateMillis(f, ["started_at"]);
    let expires_at = getFieldDateMillis(f, ["expires_at"]);

    // ✅ 24시간 경과 시: 더 이상 상태 변경 금지(안전장치)
    if (isHardExpired(expires_at)) {
      return NextResponse.json(
        { error: "대화가 종료된 후 24시간이 지나 더 이상 갱신할 수 없습니다." },
        { status: 410 }
      );
    }

    // ✅ 추가 보완: 매치 멤버가 아닌 user_id는 차단(데이터 오염 방지)
    const isA = user_id === user_a_id;
    const isB = user_id === user_b_id;
    if (!isA && !isB) {
      return NextResponse.json(
        { error: "user_id is not a member of this match" },
        { status: 403 }
      );
    }

    // 누가 보냈는지 반영
    if (isA) a_sent_first = true;
    if (isB) b_sent_first = true;

    const patchFields: Record<string, any> = { a_sent_first, b_sent_first };

    // 둘 다 한 번씩 보냈고 아직 시작 전이면 15분 시작
    if (a_sent_first && b_sent_first && !started_at) {
      const started = Date.now();
      const expires = started + 15 * 60 * 1000;

      started_at = started;
      expires_at = expires;

      patchFields.started_at = toISO(started);
      patchFields.expires_at = toISO(expires);
    }

    await airtablePatchRecord(record.id, patchFields);

    const dataOut: MatchState = {
      match_id,
      user_a_id,
      user_b_id,
      a_sent_first,
      b_sent_first,
      started_at,
      expires_at,
    };

    return NextResponse.json({ data: dataOut });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
