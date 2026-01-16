"use client";

import { useEffect, useMemo, useState } from "react";

export default function JoinClient({
  initialMatchId,
  initialKey,
}: {
  initialMatchId: string;
  initialKey: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  // 1) props 우선 사용
  const propMatchId = (initialMatchId || "").trim();
  const propKey = (initialKey || "").trim();

  // 2) props가 비면, 현재 URL pathname에서 복구 (노인모드 안전장치)
  //    기대 형태: /join/<matchId>/<k>
  const [pathMatchId, pathKey] = useMemo(() => {
    if (typeof window === "undefined") return ["", ""];

    try {
      const seg = window.location.pathname.split("/").filter(Boolean);
      // seg 예: ["join", "<matchId>", "<k>"]
      if (seg.length >= 3 && seg[0] === "join") {
        const m = decodeURIComponent(seg[1] || "");
        const k = decodeURIComponent(seg[2] || "");
        return [m.trim(), k.trim()];
      }
    } catch {
      // ignore
    }
    return ["", ""];
  }, []);

  const matchId = propMatchId || pathMatchId;
  const k = propKey || pathKey;

  const targetUrl = useMemo(() => {
    if (!matchId || !k) return "";
    return `/chat/${encodeURIComponent(matchId)}/${encodeURIComponent(k)}`;
  }, [matchId, k]);

  useEffect(() => {
    // 디버그 표식(화면/콘솔 둘 다 남김): 지금 실제로 무엇을 들고 있는지
    // (배포에서도 바로 확인 가능)
    try {
      console.log("[JoinClient] origin:", window.location.origin);
      console.log("[JoinClient] pathname:", window.location.pathname);
      console.log("[JoinClient] from props:", { initialMatchId, initialKey });
      console.log("[JoinClient] from path:", { pathMatchId, pathKey });
      console.log("[JoinClient] final:", { matchId, k, targetUrl });
    } catch {
      // ignore
    }

    if (!matchId || !k) {
      setError(
        "URL 파라미터(match_id, k)가 부족해요. /join/<match_id>/<k> 링크로 들어와야 해요. (현재 페이지에서 값 복구도 실패)"
      );
      return;
    }

    setRedirecting(true);
    window.location.replace(targetUrl);
  }, [initialMatchId, initialKey, pathMatchId, pathKey, matchId, k, targetUrl]);

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

        <hr style={{ borderColor: "#222", margin: "16px 0" }} />

        <p style={{ color: "#aaa", marginBottom: 8 }}>현재 주소(진단용):</p>
        <pre
          style={{
            background: "#111",
            border: "1px solid #222",
            padding: 12,
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            color: "#ddd",
          }}
        >{`origin: ${typeof window !== "undefined" ? window.location.origin : ""}
pathname: ${typeof window !== "undefined" ? window.location.pathname : ""}
search: ${typeof window !== "undefined" ? window.location.search : ""}

props:
  initialMatchId: ${propMatchId || "(empty)"}
  initialKey: ${propKey || "(empty)"}

path:
  matchId: ${pathMatchId || "(empty)"}
  key: ${pathKey || "(empty)"}`}</pre>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ marginTop: 0 }}>입장 처리 중...</h2>
      <p style={{ color: "#666" }}>
        {redirecting ? "채팅으로 이동 중입니다." : "준비 중입니다."}
      </p>
    </div>
  );
}
