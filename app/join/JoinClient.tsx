"use client";

import { useEffect, useMemo, useState } from "react";

export default function JoinClient({
  initialMatchId,
  initialKey,
}: {
  initialMatchId: string;
  initialKey: string;
}) {
  const matchId = (initialMatchId || "").trim();
  const k = (initialKey || "").trim();

  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const targetUrl = useMemo(() => {
    if (!matchId || !k) return "";
    // ✅ 이제 chat도 경로형으로 이동
    return `/chat/${encodeURIComponent(matchId)}/${encodeURIComponent(k)}`;
  }, [matchId, k]);

  useEffect(() => {
    if (!matchId || !k) {
      setError("URL 파라미터(match_id, k)가 부족해요. /join 링크로 들어와야 해요.");
      return;
    }

    setRedirecting(true);
    window.location.replace(targetUrl);
  }, [matchId, k, targetUrl]);

  if (error) {
    return (
      <div
        style={{
          padding: 24,
          fontFamily: "system-ui, sans-serif",
          color: "#fff",
          background: "#000",
          minHeight: "100vh",
        }}
      >
        <h1 style={{ marginTop: 0 }}>채팅 로드 실패</h1>
        <p style={{ color: "#ff4d4f", fontWeight: 700 }}>{error}</p>
        <p style={{ color: "#aaa" }}>
          올바른 진입: <code>/join/&lt;match_id&gt;/&lt;k&gt;</code>
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ marginTop: 0 }}>입장 처리 중...</h2>
      <p style={{ color: "#666" }}>{redirecting ? "채팅으로 이동 중입니다." : "준비 중입니다."}</p>
    </div>
  );
}
