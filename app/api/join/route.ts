import { NextResponse } from 'next/server';

type JoinResult =
  | { ok: true; redirect_to: string }
  | { ok: false; code: 'not_found' | 'expired' | 'disabled' | 'invalid_key'; message: string };

function getFieldString(fields: any, candidates: string[]) {
  for (const key of candidates) {
    const v = fields?.[key];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
  }
  return '';
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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const match_id = searchParams.get('match_id') || '';
  const k = searchParams.get('k') || '';

  if (!match_id || !k) {
    return NextResponse.json<JoinResult>({
      ok: false,
      code: 'invalid_key',
      message: '링크가 올바르지 않습니다. (match_id 또는 k 누락)',
    });
  }

  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableIdOrName = process.env.AIRTABLE_MATCHES_TABLE; // 지금은 tbl... 사용 중

  if (!token || !baseId || !tableIdOrName) {
    return NextResponse.json<JoinResult>({
      ok: false,
      code: 'not_found',
      message: '서버 설정(Airtable)이 준비되지 않았습니다.',
    });
  }

  // match_id로 레코드 찾기
  const url =
    `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableIdOrName)}` +
    `?filterByFormula=${encodeURIComponent(`{match_id}='${match_id}'`)}` +
    `&maxRecords=1`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!r.ok) {
    const text = await r.text();
    return NextResponse.json<JoinResult>({
      ok: false,
      code: 'not_found',
      message: `Airtable 조회 실패: ${r.status} (${text.slice(0, 80)}...)`,
    });
  }

  const data = await r.json();
  const record = data?.records?.[0];
  if (!record) {
    return NextResponse.json<JoinResult>({
      ok: false,
      code: 'not_found',
      message: '없는 채팅방입니다.',
    });
  }

  const f = record.fields || {};

  // ✅ status 필드명이 'status'일 수도, '상태'일 수도 있으니 둘 다 지원
  const status = getFieldString(f, ['status', '상태']).toLowerCase();

  // ✅ expires_at 필드도 영문/한글 혼용 가능하게
  const expiresAt = getFieldDateMillis(f, ['expires_at', '만료시각', '만료시간']);

  // 상태 우선 차단
  if (status === 'deleted' || status === 'disabled') {
    return NextResponse.json<JoinResult>({
      ok: false,
      code: 'disabled',
      message: '종료된 채팅방입니다.',
    });
  }

  // 만료 체크
  if (status === 'expired' || (expiresAt && Date.now() > expiresAt)) {
    return NextResponse.json<JoinResult>({
      ok: false,
      code: 'expired',
      message: '만료된 채팅방입니다.',
    });
  }

  // join_key 확인 (A/B 재입장 허용)
  const aKey = getFieldString(f, ['a_join_key', 'a_joinkey', 'a_key']);
  const bKey = getFieldString(f, ['b_join_key', 'b_joinkey', 'b_key']);

  if (k !== aKey && k !== bKey) {
    return NextResponse.json<JoinResult>({
      ok: false,
      code: 'invalid_key',
      message: '링크가 올바르지 않습니다. (입장키 불일치)',
    });
  }

  // 정상 입장
  return NextResponse.json<JoinResult>({
    ok: true,
    redirect_to: `/chat?match_id=${encodeURIComponent(match_id)}&k=${encodeURIComponent(k)}`,
  });
}