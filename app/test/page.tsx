"use client";

import { useState } from "react";

export default function TestPage() {
  // === [신버전] Airtable 기반 매치 생성 상태 ===
  const [mvpLoading, setMvpLoading] = useState(false);
  const [mvpErr, setMvpErr] = useState<string | null>(null);
  const [mvpCreated, setMvpCreated] = useState<null | {
    match_id: string;
    a_link: string;
    b_link: string;
  }>(null);

  const createMvpMatch = async () => {
    setMvpLoading(true);
    setMvpErr(null);
    try {
      const res = await fetch("/api/match/create", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.message || "MVP 매치 생성 실패");
      setMvpCreated({
        match_id: data.match_id,
        a_link: data.a_link,
        b_link: data.b_link,
      });
    } catch (e: any) {
      setMvpErr(e?.message || "Unknown error");
    } finally {
      setMvpLoading(false);
    }
  };

  const open = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // === [구버전] 기존 POC(create-match) 상태 ===
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [created, setCreated] = useState<null | {
    match_id: string;
    channel_id: string;
    a: { id: string; token: string };
    b: { id: string; token: string };
  }>(null);

  const createMatch = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/test/create-match", { method: "POST" });
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "Failed to create match");

      setCreated({
        match_id: data.channel_id,
        channel_id: data.channel_id,
        a: { id: data.users.a.id, token: data.users.a.token },
        b: { id: data.users.b.id, token: data.users.b.token },
      });
    } catch (e: any) {
      setErr(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const openChatInNewTab = (who: "a" | "b") => {
    if (!created) return;

    const user = who === "a" ? created.a : created.b;

    const url =
      `/chat?match_id=${encodeURIComponent(created.match_id)}` +
      `&channel_id=${encodeURIComponent(created.channel_id)}` +
      `&user_id=${encodeURIComponent(user.id)}` +
      `&token=${encodeURIComponent(user.token)}`;

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const reset = () => {
    setCreated(null);
    setErr(null);
  };

  return (
    <div style={{ padding: 20, fontFamily: "system-ui, sans-serif" }}>
      <h1>테스트 페이지</h1>

      {/* ========================= */}
      {/* ✅ 신버전: MVP 루틴 테스트 */}
      {/* ========================= */}
      <div style={{ marginTop: 14, padding: 14, border: "1px solid #ddd", borderRadius: 12 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>✅ 신버전(MVP): Airtable 기반 /join 입장</h2>

        <div style={{ fontSize: 14, color: "#333", lineHeight: 1.6 }}>
          <div>1) 버튼을 누르면 Airtable에 매치 레코드가 자동 생성됩니다.</div>
          <div>2) A 링크 / B 링크를 각각 새 탭에서 열어주세요.</div>
          <div>3) 둘 다 같은 채팅방으로 들어가고, 나갔다가 다시 링크 눌러도 재입장됩니다.</div>
        </div>

        <div style={{ marginTop: 12 }}>
          <button
            onClick={createMvpMatch}
            disabled={mvpLoading}
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              border: "1px solid #ccc",
              background: mvpLoading ? "#eee" : "#111",
              color: mvpLoading ? "#666" : "#fff",
              cursor: mvpLoading ? "not-allowed" : "pointer",
              fontSize: 16,
            }}
          >
            {mvpLoading ? "생성 중..." : "MVP 매치 생성(Airtable)"}
          </button>
        </div>

        {mvpErr && <p style={{ marginTop: 12, color: "crimson" }}>오류: {mvpErr}</p>}

        {mvpCreated && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>
              match_id: <b>{mvpCreated.match_id}</b>
            </div>

            <button
              onClick={() => open(mvpCreated.a_link)}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #ccc",
                background: "#fff",
                cursor: "pointer",
                marginRight: 10,
              }}
            >
              A 링크 열기(/join)
            </button>

            <button
              onClick={() => open(mvpCreated.b_link)}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #ccc",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              B 링크 열기(/join)
            </button>

            <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
              팁: A는 Edge 일반탭, B는 Edge InPrivate(시크릿)에서 열면 가장 안정적이에요.
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
              링크가 길면 복사해서 주소창에 붙여넣어도 됩니다.
            </div>
          </div>
        )}
      </div>

      {/* ========================= */}
      {/* 구버전: 기존 POC 루틴 */}
      {/* ========================= */}
      <div style={{ marginTop: 18, padding: 14, border: "1px dashed #ddd", borderRadius: 12 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>구버전(POC): token을 URL로 넘기는 방식</h2>

        <div style={{ fontSize: 14, color: "#333", lineHeight: 1.6 }}>
          <div>1) 아래 버튼으로 <b>채팅방을 1번만 생성</b>하세요.</div>
          <div>
            2) 생성되면 <b>A로 입장</b>, <b>B로 입장</b>을 각각 눌러 새 탭에서 들어가세요.
          </div>
          <div>
            3) A/B가 <b>서로 한마디씩</b> 보내면 15분 타이머가 시작됩니다.
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <button
            onClick={createMatch}
            disabled={loading || !!created}
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              border: "1px solid #ccc",
              background: loading || created ? "#eee" : "#111",
              color: loading || created ? "#666" : "#fff",
              cursor: loading || created ? "not-allowed" : "pointer",
              fontSize: 16,
            }}
          >
            {created ? "채팅방 생성 완료(재생성 잠김)" : loading ? "생성 중..." : "1) 테스트 매칭(채팅방) 만들기"}
          </button>

          {created && (
            <button
              onClick={reset}
              style={{
                marginLeft: 10,
                padding: "12px 16px",
                borderRadius: 10,
                border: "1px solid #ccc",
                background: "#fff",
                color: "#111",
                cursor: "pointer",
                fontSize: 16,
              }}
            >
              새로 만들기(리셋)
            </button>
          )}
        </div>

        {err && <p style={{ marginTop: 12, color: "crimson" }}>오류: {err}</p>}

        {created && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>
              match_id(channel_id): <b>{created.match_id}</b>
            </div>

            <button
              onClick={() => openChatInNewTab("a")}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #ccc",
                background: "#fff",
                cursor: "pointer",
                marginRight: 10,
              }}
            >
              2-A) A로 입장(새 탭)
            </button>

            <button
              onClick={() => openChatInNewTab("b")}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #ccc",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              2-B) B로 입장(새 탭)
            </button>

            <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
              팁: A는 Edge 일반탭, B는 Edge InPrivate(시크릿)에서 열면 가장 안정적이에요.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}