import { NextResponse } from "next/server";
import { StreamChat } from "stream-chat";

const HARD_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function getFieldString(fields: any, candidates: string[]) {
  for (const key of candidates) {
    const v = fields?.[key];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
  }
  return "";
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

function escapeAirtableFormulaValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function isHardExpired(expiresAtMs: number | null) {
  if (!expiresAtMs) return false;
  return Date.now() > expiresAtMs + HARD_TTL_MS;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const match_id = searchParams.get("match_id") || "";
  const k = searchParams.get("k") || "";

  if (!match_id || !k) {
    return NextResponse.json(
      { ok: false, message: "링크가 올바르지 않습니다." },
      { status: 400 }
    );
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

  // 1) Airtable에서 match_id 레코드 찾기
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
    return NextResponse.json({ ok: false, message: "없는 채팅방입니다." }, { status: 404 });
  }

  const f = record.fields || {};
  const status = getFieldString(f, ["status", "상태"]).toLowerCase();
  const expiresAt = getFieldDateMillis(f, ["expires_at", "만료시각", "만료시간"]);

  // ✅ 24시간 경과 시: 완전 종료(사라짐) - match/state와 동일 정책
  if (isHardExpired(expiresAt)) {
    return NextResponse.json(
      { ok: false, message: "대화가 종료된 후 24시간이 지나 삭제되었습니다." },
      { status: 410 }
    );
  }

  // 운영상 강제 종료는 즉시 차단
  if (status === "deleted" || status === "disabled") {
    return NextResponse.json({ ok: false, message: "종료된 채팅방입니다." }, { status: 403 });
  }

  // ✅ 옵션 2: 만료(15분)여도 24시간 이내면 “읽기 전용 접근” 허용
  // -> 여기서는 차단하지 않음 (프론트가 MessageInput을 숨겨 입력을 막음)

  // 입장키 검증
  const aKey = getFieldString(f, ["a_join_key", "a_joinkey", "a_key"]);
  const bKey = getFieldString(f, ["b_join_key", "b_joinkey", "b_key"]);
  if (k !== aKey && k !== bKey) {
    return NextResponse.json(
      { ok: false, message: "입장키가 올바르지 않습니다." },
      { status: 403 }
    );
  }

  // 2) Airtable에 저장된 a_user_id/b_user_id 우선 사용
  const a_user_id = getFieldString(f, ["a_user_id"]);
  const b_user_id = getFieldString(f, ["b_user_id"]);

  // fallback
  const fallbackA = `match_${match_id}_a`;
  const fallbackB = `match_${match_id}_b`;
  const A = a_user_id || fallbackA;
  const B = b_user_id || fallbackB;

  // 3) A/B 판별 -> 이번 요청자의 user_id 결정
  const user_id = k === aKey ? A : B;

  // 4) 채널 정보
  const channel_type = getFieldString(f, ["channel_type"]).trim() || "messaging";
  const channel_id = getFieldString(f, ["channel_id"]).trim() || `match_${match_id}`;

  // 5) Stream 토큰 발급(서버에서)
  const apiKey = process.env.NEXT_PUBLIC_STREAM_KEY;
  const apiSecret = process.env.STREAM_SECRET;
  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      { ok: false, message: "Stream 설정(.env)이 없습니다." },
      { status: 500 }
    );
  }

  const serverClient = StreamChat.getInstance(apiKey, apiSecret);

  // 유저 업서트
  await serverClient.upsertUsers([
    { id: A, name: "익명A" },
    { id: B, name: "익명B" },
  ]);

  // 채널 생성/보장 (이미 있으면 create 에러 -> 무시)
  const channel = serverClient.channel(channel_type, channel_id, {
    created_by_id: A,
    members: [A, B],
  });
  try {
    await channel.create();
  } catch {
    // 이미 생성된 채널이면 무시
  }

  const token = serverClient.createToken(user_id);

  return NextResponse.json({
    ok: true,
    match_id,
    channel_type,
    channel_id,
    user_id,
    token,
  });
}
