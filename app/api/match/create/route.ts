import { NextResponse } from "next/server";

function randomKey(len = 24) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function POST() {
  const airtableToken = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableIdOrName = process.env.AIRTABLE_MATCHES_TABLE; // tbl... 유지

  if (!airtableToken || !baseId || !tableIdOrName) {
    return NextResponse.json(
      { ok: false, message: "Airtable env 설정이 없습니다." },
      { status: 500 }
    );
  }

  const match_id = `m_${Date.now()}_${randomKey(6)}`;

  const a_join_key = `a_${randomKey(28)}`;
  const b_join_key = `b_${randomKey(28)}`;

  // Stream 유저 ID (나중에 user1/user2 연결할 때 이 부분만 바꾸면 됨)
  const a_user_id = `match_${match_id}_a`;
  const b_user_id = `match_${match_id}_b`;

  const channel_type = "messaging";
  const channel_id = `match_${match_id}`;

  const fields: any = {
    match_id,
    status: "active",
    a_join_key,
    b_join_key,
    a_user_id,
    b_user_id,
    channel_type,
    channel_id,
  };

  const createUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(
    tableIdOrName
  )}`;

  const r = await fetch(createUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${airtableToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ records: [{ fields }] }),
  });

  if (!r.ok) {
    const text = await r.text();
    return NextResponse.json(
      { ok: false, message: `Airtable 생성 실패: ${r.status} ${text}` },
      { status: 500 }
    );
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_ORIGIN || "http://localhost:3000";

  return NextResponse.json({
    ok: true,
    match_id,
    a_link: `${origin}/join?match_id=${encodeURIComponent(match_id)}&k=${encodeURIComponent(
      a_join_key
    )}`,
    b_link: `${origin}/join?match_id=${encodeURIComponent(match_id)}&k=${encodeURIComponent(
      b_join_key
    )}`,
  });
}