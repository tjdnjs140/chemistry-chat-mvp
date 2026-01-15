"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

function buildJoinLink(baseUrl: string, matchId: string, k: string) {
  const url = new URL("/join", baseUrl);
  url.searchParams.set("match_id", matchId);
  url.searchParams.set("k", k);
  return url.toString();
}

export default function AdminInvitePage() {
  const params = useSearchParams();
  const initialMatchId = params.get("match_id") || "";

  const [matchId, setMatchId] = useState(initialMatchId);
  const [aKey, setAKey] = useState("");
  const [bKey, setBKey] = useState("");

  const [loadingKeys, setLoadingKeys] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const baseUrl = useMemo(() => {
    if (typeof window === "undefined") return "http://localhost:3000";
    return window.location.origin;
  }, []);

  const aLink = useMemo(() => {
    if (!matchId || !aKey) return "";
    return buildJoinLink(baseUrl, matchId, aKey);
  }, [baseUrl, matchId, aKey]);

  const bLink = useMemo(() => {
    if (!matchId || !bKey) return "";
    return buildJoinLink(baseUrl, matchId, bKey);
  }, [baseUrl, matchId, bKey]);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      alert("복사에 실패했습니다. 링크를 드래그해서 수동 복사해주세요.");
    }
  };

  const loadKeys = async (m: string) => {
    if (!m) return;
    setLoadingKeys(true);
    setLoadError(null);

    try {
      const res = await fetch(`/api/admin/invite?match_id=${encodeURIComponent(m)}`);
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        setLoadError(json?.message || `키 로드 실패: ${res.status}`);
        setAKey("");
        setBKey("");
        return;
      }

      setAKey(json.a_join_key || "");
      setBKey(json.b_join_key || "");
    } catch (e: any) {
      setLoadError(e?.message || "키 로드 중 네트워크 오류");
      setAKey("");
      setBKey("");
    } finally {
      setLoadingKeys(false);
    }
  };

  // 최초 진입 시 URL의 match_id로 자동 로드
  useEffect(() => {
    if (initialMatchId) loadKeys(initialMatchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMatchId]);

  return (
    <div style={{ padding: 20, fontFamily: "system-ui, sans-serif", maxWidth: 860, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 6 }}>관리자 초대 링크 생성</h1>
      <p style={{ marginTop: 0, color: "#666", lineHeight: 1.5 }}>
        알림톡 연동 전 MVP 테스트용입니다. Airtable에서 <b>a_join_key / b_join_key</b>를 자동으로 불러옵니다.
        <br />
        아래 링크를 복사해서 <b>카톡/문자</b>로 수동 발송하세요.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 16 }}>
        <label style={{ fontSize: 13, color: "#333" }}>
          match_id
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <input
              value={matchId}
              onChange={(e) => setMatchId(e.target.value.trim())}
              placeholder="m_..."
              style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            />
            <button
              onClick={() => loadKeys(matchId)}
              disabled={!matchId || loadingKeys}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "#111",
                color: "#fff",
                minWidth: 120,
              }}
            >
              {loadingKeys ? "불러오는 중..." : "키 불러오기"}
            </button>
          </div>
        </label>

        {loadError && (
          <div style={{ color: "#b00020", fontSize: 13 }}>
            키 로드 실패: {loadError}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ fontSize: 13, color: "#333" }}>
            A 키(k) (자동 로드)
            <input
              value={aKey}
              onChange={(e) => setAKey(e.target.value.trim())}
              placeholder="a_..."
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd", marginTop: 6 }}
            />
          </label>
          <label style={{ fontSize: 13, color: "#333" }}>
            B 키(k) (자동 로드)
            <input
              value={bKey}
              onChange={(e) => setBKey(e.target.value.trim())}
              placeholder="b_..."
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd", marginTop: 6 }}
            />
          </label>
        </div>
      </div>

      <div style={{ marginTop: 18, padding: 14, border: "1px solid #eee", borderRadius: 12, background: "#fafafa" }}>
        <h3 style={{ marginTop: 0 }}>A 초대 링크</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <code style={{ background: "#fff", border: "1px solid #eee", padding: "8px 10px", borderRadius: 10, wordBreak: "break-all", flex: "1 1 520px" }}>
            {aLink || "(match_id와 A키가 필요합니다)"}
          </code>
          <button
            onClick={() => aLink && copy(aLink, "A")}
            disabled={!aLink}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#111", color: "#fff" }}
          >
            A 링크 복사
          </button>
          <button
            onClick={() => aLink && window.open(aLink, "_blank")}
            disabled={!aLink}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", color: "#111" }}
          >
            A로 열기
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12, padding: 14, border: "1px solid #eee", borderRadius: 12, background: "#fafafa" }}>
        <h3 style={{ marginTop: 0 }}>B 초대 링크</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <code style={{ background: "#fff", border: "1px solid #eee", padding: "8px 10px", borderRadius: 10, wordBreak: "break-all", flex: "1 1 520px" }}>
            {bLink || "(match_id와 B키가 필요합니다)"}
          </code>
          <button
            onClick={() => bLink && copy(bLink, "B")}
            disabled={!bLink}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#111", color: "#fff" }}
          >
            B 링크 복사
          </button>
          <button
            onClick={() => bLink && window.open(bLink, "_blank")}
            disabled={!bLink}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", color: "#111" }}
          >
            B로 열기
          </button>
        </div>
      </div>

      <div style={{ marginTop: 14, color: "#666", fontSize: 13, lineHeight: 1.6 }}>
        {copied && <div style={{ color: "#0a7a2f" }}>✓ {copied} 링크를 복사했습니다.</div>}
        <div>
          팁: A/B를 각각 새 탭으로 열어 <b>2탭 테스트</b>를 하면 실제 두 명이 없어도 전체 플로우를 재현할 수 있습니다.
        </div>
      </div>
    </div>
  );
}
