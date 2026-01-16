"use client";

import { useEffect, useMemo, useState } from "react";

type MatchState = {
  match_id: string;
  user_a_id: string;
  user_b_id: string;
  a_sent_first: boolean;
  b_sent_first: boolean;
  started_at: number | null;
  expires_at: number | null;
};

const LS_KEY = "chemistry_test_hub_v1";

function getAppOrigin() {
  const envOrigin = (process.env.NEXT_PUBLIC_APP_ORIGIN || "").trim();
  if (envOrigin) return envOrigin.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

// ✅ 무조건 path 기반 join/chat 링크 생성 (쿼리 금지)
function buildPathLink(kind: "join" | "chat", matchId: string, k: string) {
  const origin = getAppOrigin() || "http://localhost:3000";
  const base = origin.replace(/\/+$/, "");
  return `${base}/${kind}/${encodeURIComponent(matchId)}/${encodeURIComponent(k)}`;
}

function formatMMSS(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function TestHubClient() {
  const [matchId, setMatchId] = useState("");
  const [aKey, setAKey] = useState("");
  const [bKey, setBKey] = useState("");

  const [copied, setCopied] = useState<string | null>(null);

  const [state, setState] = useState<MatchState | null>(null);
  const [stateError, setStateError] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState(false);

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const v = JSON.parse(raw);
      setMatchId(v.matchId ?? "");
      setAKey(v.aKey ?? "");
      setBKey(v.bKey ?? "");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const aJoin = useMemo(() => {
    if (!matchId || !aKey) return "";
    return buildPathLink("join", matchId, aKey);
  }, [matchId, aKey]);

  const bJoin = useMemo(() => {
    if (!matchId || !bKey) return "";
    return buildPathLink("join", matchId, bKey);
  }, [matchId, bKey]);

  // (옵션) 운영자 디버그용: path 기반 chat 링크도 제공 (원하면 카드 제거 가능)
  const aChat = useMemo(() => {
    if (!matchId || !aKey) return "";
    return buildPathLink("chat", matchId, aKey);
  }, [matchId, aKey]);

  const bChat = useMemo(() => {
    if (!matchId || !bKey) return "";
    return buildPathLink("chat", matchId, bKey);
  }, [matchId, bKey]);

  const saveLocal = (next?: { matchId?: string; aKey?: string; bKey?: string }) => {
    try {
      const payload = {
        matchId: (next?.matchId ?? matchId).trim(),
        aKey: (next?.aKey ?? aKey).trim(),
        bKey: (next?.bKey ?? bKey).trim(),
      };
      localStorage.setItem(LS_KEY, JSON.stringify(payload));
      return payload;
    } catch {
      return null;
    }
  };

  const clearLocal = () => {
    try {
      localStorage.removeItem(LS_KEY);
      setMatchId("");
      setAKey("");
      setBKey("");
      setState(null);
      setStateError(null);
      setCreateError(null);
      alert("초기화 완료");
    } catch {
      alert("초기화 실패");
    }
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      alert("복사 실패: 링크를 드래그해서 수동 복사해주세요.");
    }
  };

  const openNewTab = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const safeJsonParse = (raw: string) => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const createMatch = async () => {
    setCreating(true);
    setCreateError(null);

    try {
      const res = await fetch("/api/match/create", { method: "POST" });
      const raw = await res.text();
      const json = safeJsonParse(raw);

      if (!res.ok) {
        const msg =
          json?.message ||
          json?.error ||
          `생성 실패: ${res.status}${raw ? ` / ${raw.slice(0, 200)}` : ""}`;
        setCreateError(msg);
        return;
      }

      if (!json?.ok) {
        setCreateError(json?.message || "생성 실패: ok=false");
        return;
      }

      const nextMatchId = String(json.match_id || "").trim();
      const nextAKey = String(json.a_join_key || "").trim();
      const nextBKey = String(json.b_join_key || "").trim();

      if (!nextMatchId || !nextAKey || !nextBKey) {
        setCreateError(
          "생성 응답은 받았지만 match_id/a_join_key/b_join_key가 비어 있습니다. route.ts 응답 형태를 확인하세요."
        );
        return;
      }

      setMatchId(nextMatchId);
      setAKey(nextAKey);
      setBKey(nextBKey);
      saveLocal({ matchId: nextMatchId, aKey: nextAKey, bKey: nextBKey });

      alert("생성 완료! 아래 Join 링크(A/B)를 복사해서 테스트하세요.");
    } catch (e: any) {
      setCreateError(e?.message || "네트워크 오류로 생성 실패");
    } finally {
      setCreating(false);
    }
  };

  const fetchState = async () => {
    const m = matchId.trim();
    if (!m) {
      setStateError("match_id를 먼저 입력하세요.");
      return;
    }

    setLoadingState(true);
    setStateError(null);

    try {
      const res = await fetch(`/api/match/state?match_id=${encodeURIComponent(m)}`);
      const raw = await res.text();
      const json = safeJsonParse(raw);

      if (!res.ok) {
        setState(null);
        setStateError(json?.error || json?.message || `상태 조회 실패: ${res.status}`);
        return;
      }

      const nextState: MatchState | null = json?.data ?? null;
      setState(nextState);
    } catch (e: any) {
      setState(null);
      setStateError(e?.message || "네트워크 오류로 상태 조회 실패");
    } finally {
      setLoadingState(false);
    }
  };

  const started = !!state?.started_at && !!state?.expires_at;
  const expired = !!state?.expires_at && state.expires_at <= now;
  const remainingMs = state?.expires_at ? state.expires_at - now : 0;

  const canMakeLinks = !!matchId && !!aKey && !!bKey;

  return (
    <div
      style={{
        padding: 20,
        fontFamily: "system-ui, sans-serif",
        maxWidth: 980,
        margin: "0 auto",
        lineHeight: 1.5,
      }}
    >
      <h1 style={{ marginBottom: 6 }}>Chemistry Chat — 테스트 허브</h1>
      <p style={{ marginTop: 0, color: "#666" }}>
        PC/모바일에서 링크 깨짐 방지를 위해 <b>쿼리 링크를 완전히 제거</b>하고
        <b> /join/&lt;match_id&gt;/&lt;k&gt; </b> 형태만 사용합니다.
        <br />
        배포 도메인 고정은 <b>NEXT_PUBLIC_APP_ORIGIN</b> 값을 사용합니다.
      </p>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          marginTop: 14,
          padding: 12,
          border: "1px solid #eee",
          borderRadius: 12,
          background: "#fafafa",
        }}
      >
        <button
          onClick={() => (window.location.href = "/admin/invite")}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#111",
            color: "#fff",
          }}
        >
          관리자 초대 링크 생성(/admin/invite)
        </button>

        <button
          onClick={() => openNewTab("/join")}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fff",
            color: "#111",
          }}
        >
          Join 페이지 열기(/join)
        </button>
      </div>

      <div
        style={{
          marginTop: 14,
          padding: 14,
          border: "1px solid #eee",
          borderRadius: 12,
        }}
      >
        <h3 style={{ margin: "0 0 10px 0" }}>테스트 값 입력</h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={createMatch}
              disabled={creating}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "#111",
                color: "#fff",
                minWidth: 240,
              }}
            >
              {creating ? "생성 중..." : "원클릭 생성(에어테이블 저장)"}
            </button>

            <button
              onClick={() => {
                const p = saveLocal();
                if (p) alert("저장 완료");
                else alert("저장 실패(브라우저 설정/권한 확인)");
              }}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "#111",
                color: "#fff",
              }}
            >
              저장(브라우저에 기억)
            </button>

            <button
              onClick={clearLocal}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "#fff",
                color: "#111",
              }}
            >
              초기화(저장값 삭제)
            </button>

            <button
              onClick={fetchState}
              disabled={!matchId || loadingState}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "#fff",
                color: "#111",
              }}
            >
              {loadingState ? "상태 조회 중..." : "상태 조회(/api/match/state)"}
            </button>
          </div>

          {createError && (
            <div style={{ color: "#b00020", fontSize: 13 }}>생성 오류: {createError}</div>
          )}

          {copied && (
            <div style={{ color: "#0a7a2f", fontSize: 13 }}>✓ {copied} 링크를 복사했습니다.</div>
          )}

          <label style={{ fontSize: 13, color: "#333" }}>
            match_id
            <input
              value={matchId}
              onChange={(e) => setMatchId(e.target.value.trim())}
              placeholder="m_..."
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 10,
                border: "1px solid #ddd",
                marginTop: 6,
              }}
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ fontSize: 13, color: "#333" }}>
              A key (k)
              <input
                value={aKey}
                onChange={(e) => setAKey(e.target.value.trim())}
                placeholder="a_..."
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  marginTop: 6,
                }}
              />
            </label>

            <label style={{ fontSize: 13, color: "#333" }}>
              B key (k)
              <input
                value={bKey}
                onChange={(e) => setBKey(e.target.value.trim())}
                placeholder="b_..."
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  marginTop: 6,
                }}
              />
            </label>
          </div>

          {stateError && (
            <div style={{ color: "#b00020", fontSize: 13 }}>상태 조회 오류: {stateError}</div>
          )}
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          padding: 14,
          border: "1px solid #eee",
          borderRadius: 12,
          background: "#fafafa",
        }}
      >
        <h3 style={{ marginTop: 0 }}>매치 상태(간이 모니터)</h3>
        {!state && <div style={{ fontSize: 13, color: "#666" }}>상태 조회를 눌러 확인하세요.</div>}

        {state && (
          <div style={{ fontSize: 13, color: "#333", display: "grid", gap: 6 }}>
            <div>
              started: <b>{String(started)}</b> / expired: <b>{String(expired)}</b>
            </div>
            <div>
              a_sent_first: <b>{String(state.a_sent_first)}</b> / b_sent_first:{" "}
              <b>{String(state.b_sent_first)}</b>
            </div>
            {started && !expired && (
              <div>
                남은 시간: <b>{formatMMSS(remainingMs)}</b>
              </div>
            )}
            {expired && <div style={{ color: "#b00020" }}>만료됨(대화 종료)</div>}
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
        <LinkCard
          title="A Join 링크 (PC/모바일 공통 안정)"
          url={aJoin}
          disabled={!matchId || !aKey}
          onCopy={() => copy(aJoin, "A Join")}
          onOpen={() => openNewTab(aJoin)}
        />
        <LinkCard
          title="B Join 링크 (PC/모바일 공통 안정)"
          url={bJoin}
          disabled={!matchId || !bKey}
          onCopy={() => copy(bJoin, "B Join")}
          onOpen={() => openNewTab(bJoin)}
        />
        <LinkCard
          title="(디버그) A Chat 링크 (Path 기반)"
          url={aChat}
          disabled={!matchId || !aKey}
          onCopy={() => copy(aChat, "A Chat")}
          onOpen={() => openNewTab(aChat)}
        />
        <LinkCard
          title="(디버그) B Chat 링크 (Path 기반)"
          url={bChat}
          disabled={!matchId || !bKey}
          onCopy={() => copy(bChat, "B Chat")}
          onOpen={() => openNewTab(bChat)}
        />
      </div>

      <div
        style={{
          marginTop: 14,
          padding: 14,
          border: "1px solid #eee",
          borderRadius: 12,
        }}
      >
        <h3 style={{ marginTop: 0 }}>2탭 테스트(원클릭)</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            disabled={!canMakeLinks}
            onClick={() => openNewTab(aJoin)}
            style={btnPrimary(!canMakeLinks)}
          >
            A 참가(Join) 새 탭
          </button>
          <button
            disabled={!canMakeLinks}
            onClick={() => openNewTab(bJoin)}
            style={btnPrimary(!canMakeLinks)}
          >
            B 참가(Join) 새 탭
          </button>
        </div>

        {!canMakeLinks && (
          <div style={{ marginTop: 10, fontSize: 13, color: "#666" }}>
            match_id + A/B key를 입력하면 버튼이 활성화됩니다.
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, fontSize: 12, color: "#666" }}>
        <div>
          현재 도메인: <code>{typeof window !== "undefined" ? window.location.origin : ""}</code>
        </div>
        <div>
          링크 기준 도메인: <code>{getAppOrigin()}</code>
        </div>
        <div>
          현재 시간: <code>{new Date(now).toLocaleString()}</code>
        </div>
      </div>
    </div>
  );
}

function LinkCard({
  title,
  url,
  disabled,
  onCopy,
  onOpen,
}: {
  title: string;
  url: string;
  disabled: boolean;
  onCopy: () => void;
  onOpen: () => void;
}) {
  return (
    <div
      style={{
        padding: 14,
        border: "1px solid #eee",
        borderRadius: 12,
        background: "#fafafa",
      }}
    >
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <code
          style={{
            background: "#fff",
            border: "1px solid #eee",
            padding: "8px 10px",
            borderRadius: 10,
            wordBreak: "break-all",
            flex: "1 1 560px",
          }}
        >
          {url || "(값을 입력하면 자동 생성됩니다)"}
        </code>

        <button disabled={disabled || !url} onClick={onCopy} style={btnPrimary(disabled || !url)}>
          복사
        </button>
        <button disabled={disabled || !url} onClick={onOpen} style={btnGhost(disabled || !url)}>
          새 탭 열기
        </button>
      </div>
    </div>
  );
}

function btnPrimary(disabled: boolean) {
  return {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #ddd",
    background: disabled ? "#aaa" : "#111",
    color: "#fff",
    cursor: disabled ? "not-allowed" : "pointer",
  } as const;
}

function btnGhost(disabled: boolean) {
  return {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #ddd",
    background: "#fff",
    color: disabled ? "#888" : "#111",
    cursor: disabled ? "not-allowed" : "pointer",
  } as const;
}
