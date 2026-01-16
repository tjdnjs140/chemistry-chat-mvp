"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

type JoinResult =
  | { ok: true; redirect_to: string }
  | {
      ok: false;
      code: "not_found" | "expired" | "disabled" | "invalid_key";
      message: string;
    };

export default function JoinClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const match_id = useMemo(() => sp.get("match_id") || "", [sp]);
  const k = useMemo(() => sp.get("k") || "", [sp]);

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<JoinResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/join?match_id=${encodeURIComponent(match_id)}&k=${encodeURIComponent(k)}`
        );
        const data = (await res.json()) as JoinResult;

        if (cancelled) return;
        setResult(data);
        setLoading(false);

        if (data.ok) {
          router.replace(data.redirect_to);
        }
      } catch (e) {
        if (cancelled) return;
        setLoading(false);
        setResult({
          ok: false,
          code: "not_found",
          message: "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        });
      }
    }

    if (!match_id || !k) {
      setLoading(false);
      setResult({
        ok: false,
        code: "invalid_key",
        message: "링크가 올바르지 않습니다. (match_id 또는 k 누락)",
      });
      return;
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [match_id, k, router]);

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>채팅방 입장 확인</h1>

      {loading && <p>확인 중입니다… 잠시만 기다려주세요.</p>}

      {!loading && result && !result.ok && (
        <div style={{ padding: 14, border: "1px solid #ddd", borderRadius: 10 }}>
          <p style={{ fontSize: 18, margin: 0 }}>{result.message}</p>
          <p style={{ marginTop: 10, color: "#666" }}>
            (안내 코드: <b>{result.code}</b>)
          </p>
        </div>
      )}
    </div>
  );
}