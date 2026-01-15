"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { StreamChat } from "stream-chat";
import {
  Chat,
  Channel,
  ChannelHeader,
  MessageList,
  MessageInput,
  Window,
} from "stream-chat-react";

import "stream-chat-react/dist/css/v2/index.css";

// 클라이언트를 파일 전역으로 고정 (리렌더/개발모드에서도 같은 인스턴스 유지)
let sharedClient: StreamChat | null = null;

type MatchState = {
  match_id: string;
  user_a_id: string;
  user_b_id: string;
  a_sent_first: boolean;
  b_sent_first: boolean;
  started_at: number | null;
  expires_at: number | null;
};

type SessionPayload = {
  ok: true;
  match_id: string;
  channel_type: string;
  channel_id: string;
  user_id: string;
  token: string;
};

function formatMMSS(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function ChatPage() {
  const params = useSearchParams();

  const matchId = params.get("match_id");
  const k = params.get("k"); // join에서 넘어온 입장키(현재 MVP는 유지)

  const apiKey = process.env.NEXT_PUBLIC_STREAM_KEY;

  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // /api/session 결과(채널/유저/토큰)
  const [session, setSession] = useState<SessionPayload | null>(null);

  // 타이머 상태
  const [state, setState] = useState<MatchState | null>(null);
  const [now, setNow] = useState(Date.now());

  // 상태 폴링 안정화용
  const [stateFetchError, setStateFetchError] = useState<string | null>(null);

  // 연속 실패/폴링 중단
  const [pollStopped, setPollStopped] = useState(false);
  const failRef = useRef(0);

  // "내 첫 메시지 기록"은 1회만 보내기(서버/에어테이블 부하 및 중복 방지)
  const sentFirstRef = useRef(false);
  useEffect(() => {
    // matchId 바뀌면 리셋
    sentFirstRef.current = false;
  }, [matchId]);

  // 최신 state를 ref로 유지(클로저로 옛 state를 잡는 문제 방지)
  const stateRef = useRef<MatchState | null>(null);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const chatClient = useMemo(() => {
    if (!apiKey) return null;
    if (!sharedClient) sharedClient = StreamChat.getInstance(apiKey);
    return sharedClient;
  }, [apiKey]);

  // 남은 시간 표시용 tick
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  // 1) /api/session 호출  2) connectUser  3) channel.watch
  useEffect(() => {
    let cancelled = false;

    const connect = async () => {
      setError(null);
      setReady(false);
      setSession(null);

      if (!apiKey) {
        setError("NEXT_PUBLIC_STREAM_KEY가 .env.local에 없어요.");
        return;
      }
      if (!matchId || !k) {
        setError("URL 파라미터(match_id, k)가 부족해요. /join 링크로 들어와야 해요.");
        return;
      }
      if (!chatClient) {
        setError("StreamChat 클라이언트를 만들 수 없어요.");
        return;
      }

      try {
        const res = await fetch(
          `/api/session?match_id=${encodeURIComponent(matchId)}&k=${encodeURIComponent(k)}`
        );
        const json = await res.json();

        if (!res.ok || !json?.ok) {
          setError(json?.message || "세션 생성 실패(만료/종료/없는방일 수 있어요)");
          return;
        }

        if (cancelled) return;

        const nextSession: SessionPayload = json;
        setSession(nextSession);

        // 같은 유저로 이미 연결돼 있으면 재연결하지 않음
        if (chatClient.userID !== nextSession.user_id) {
          if (chatClient.userID) await chatClient.disconnectUser();
          await chatClient.connectUser(
            {
              id: nextSession.user_id,
              name: nextSession.user_id,
            },
            nextSession.token
          );
        }

        const ch = chatClient.channel(nextSession.channel_type, nextSession.channel_id);
        await ch.watch();

        if (!cancelled) setReady(true);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "채팅 연결 실패");
      }
    };

    connect();

    return () => {
      cancelled = true;
    };
  }, [apiKey, matchId, k, chatClient]);

  // === 상태 조회(주기적으로) - 안정화 최종 ===
  // - 기본 5초
  // - 만료면 즉시 중단(최신 stateRef + 응답 기준)
  // - 429 백오프(최대 20초)
  // - 5xx/네트워크 연속 6회 실패 시 폴링 완전 중단 + 재시도 버튼
  const pollRef = useRef<{ timer: any; intervalMs: number }>({
    timer: null,
    intervalMs: 5000,
  });

  useEffect(() => {
    if (!matchId) return;

    let mounted = true;
    const controller = new AbortController();

    const clearPoll = () => {
      if (pollRef.current.timer) {
        clearTimeout(pollRef.current.timer);
        pollRef.current.timer = null;
      }
    };

    const scheduleNext = (ms?: number) => {
      clearPoll();
      const next = ms ?? pollRef.current.intervalMs;
      pollRef.current.timer = setTimeout(fetchState, next);
    };

    const isExpired = (s: MatchState | null) =>
      !!s?.expires_at && s.expires_at <= Date.now();

    const fetchState = async () => {
      if (!mounted) return;

      // 폴링 중단 상태면 끝
      if (pollStopped) {
        clearPoll();
        return;
      }

      // (1) 최신 stateRef 기준으로 만료면 폴링 중단
      if (isExpired(stateRef.current)) {
        clearPoll();
        return;
      }

      try {
        const res = await fetch(`/api/match/state?match_id=${encodeURIComponent(matchId)}`, {
          signal: controller.signal,
        });

        // 429 레이트리밋: 실패로 치지 말고 백오프만 적용
        if (res.status === 429) {
          setStateFetchError("요청이 많아 잠시 대기 후 다시 시도합니다. (429)");
          pollRef.current.intervalMs = Math.min(pollRef.current.intervalMs * 2, 20000);
          scheduleNext(pollRef.current.intervalMs);
          return;
        }

        const json = await res.json();

        if (!res.ok) {
          const msg = json?.error || `state fetch 실패: ${res.status}`;
          setStateFetchError(msg);

          // 403/404/410은 재시도해도 해결될 가능성이 낮아서 중단(운영 안정성)
          if (res.status === 403 || res.status === 404 || res.status === 410) {
            clearPoll();
            setPollStopped(true);
            return;
          }

          // 5xx 등은 연속 실패 카운트로 제어
          failRef.current += 1;
          if (failRef.current >= 6) {
            clearPoll();
            setPollStopped(true);
            setStateFetchError(
              "상태 조회가 반복 실패하여 자동 재시도를 중단했습니다. 아래에서 다시 시도해 주세요."
            );
            return;
          }

          scheduleNext(Math.max(pollRef.current.intervalMs, 10000));
          return;
        }

        const nextState: MatchState | null = json.data ?? null;
        setState(nextState);
        stateRef.current = nextState; // ref 즉시 동기화
        setStateFetchError(null);

        // 성공 시 실패 카운트/중단 플래그 리셋
        failRef.current = 0;
        setPollStopped(false);

        // (2) 이번 응답이 만료면 “즉시” 폴링 중단
        if (isExpired(nextState)) {
          clearPoll();
          return;
        }

        // 정상 회복 시 5초로 원복
        pollRef.current.intervalMs = 5000;
        scheduleNext();
      } catch (e: any) {
        if (e?.name === "AbortError") return;

        failRef.current += 1;

        if (failRef.current >= 6) {
          clearPoll();
          setPollStopped(true);
          setStateFetchError(
            "네트워크 오류가 반복되어 자동 재시도를 중단했습니다. 아래에서 다시 시도해 주세요."
          );
          return;
        }

        setStateFetchError("네트워크 오류로 상태를 불러오지 못했습니다. 재시도 중...");
        scheduleNext(10000);
      }
    };

    pollRef.current.intervalMs = 5000;
    fetchState();

    return () => {
      mounted = false;
      controller.abort();
      clearPoll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, pollStopped]);

  // ✅ 메시지 전송 이벤트를 듣고 “서로 한마디씩” 체크
  // 핵심: message.new는 상대 메시지에도 발생하므로 "내가 보낸 메시지"일 때만 POST해야 함
  useEffect(() => {
    if (!ready || !chatClient || !session || !matchId) return;

    const ch = chatClient.channel(session.channel_type, session.channel_id);

    const handler = async (event: any) => {
      const senderId =
        event?.user?.id ?? event?.message?.user?.id ?? event?.message?.user_id;

      // 내가 보낸 메시지가 아니면 무시
      if (!senderId || senderId !== session.user_id) return;

      // 내 첫 메시지 기록은 1회만
      if (sentFirstRef.current) return;
      sentFirstRef.current = true;

      try {
        await fetch("/api/match/state", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            match_id: matchId,
            user_id: session.user_id,
          }),
        });
      } catch {
        // 조용히 무시(UX 멈춤 방지)
      }
    };

    ch.on("message.new", handler);

    return () => {
      ch.off("message.new", handler);
    };
  }, [ready, chatClient, session, matchId]);

  // ===== Render =====
  if (error) {
    return (
      <div style={{ padding: 20, fontFamily: "system-ui, sans-serif" }}>
        <h2>채팅 로드 실패</h2>
        <p style={{ color: "crimson" }}>{error}</p>
        <p style={{ color: "#666", fontSize: 13 }}>
          올바른 진입: /join?match_id=...&k=... (join이 chat으로 보내줍니다)
        </p>
      </div>
    );
  }

  if (!ready || !chatClient || !matchId || !session) {
    return <div style={{ padding: 20, fontFamily: "system-ui, sans-serif" }}>로딩 중...</div>;
  }

  const channel = chatClient.channel(session.channel_type, session.channel_id);

  const started = !!state?.started_at && !!state?.expires_at;
  const expired = !!state?.expires_at && state.expires_at <= now;
  const remainingMs = state?.expires_at ? state.expires_at - now : 0;

  return (
    <div style={{ height: "100vh" }}>
      {/* 상단 상태바 */}
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid #eee",
          fontFamily: "system-ui, sans-serif",
          background: "#fafafa",
        }}
      >
        {!started && (
          <div style={{ fontSize: 13, color: "#333" }}>
            서로 한마디씩 보내면 <b>15분 대화</b>가 시작돼요.
          </div>
        )}

        {started && !expired && (
          <div style={{ fontSize: 13, color: "#333" }}>
            남은 시간: <b>{formatMMSS(remainingMs)}</b>
          </div>
        )}

        {expired && (
          <div style={{ fontSize: 13, color: "#b00020" }}>
            대화 시간이 종료되었어요. 아래 버튼을 눌러 다음 단계로 이동하세요.
          </div>
        )}

        {/* 운영/디버그용: 만료 전만 표기 */}
        {!expired && stateFetchError && (
          <div style={{ fontSize: 12, color: "#b00020", marginTop: 6 }}>
            상태 동기화: {stateFetchError}
          </div>
        )}

        {/* 폴링 중단 시 재시도 버튼 */}
        {pollStopped && (
          <div style={{ marginTop: 10 }}>
            <button
              onClick={() => {
                failRef.current = 0;
                setPollStopped(false);
                setStateFetchError(null);
                pollRef.current.intervalMs = 5000;

                // 서버가 아직 안 살아났을 때 누르면 "페이지 표시할 수 없음"이 뜰 수 있음.
                // 운영 안정성을 위해 가장 단순/확실한 재시작 방식은 reload.
                window.location.reload();
              }}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ccc",
                background: "#fff",
                fontSize: 15,
              }}
            >
              다시 시도
            </button>
          </div>
        )}

        {/* 만료 후 폴링이 멈췄는지 육안 확인용(원하면 나중에 삭제) */}
        {expired && (
          <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
            (만료됨) 상태 폴링이 중단되어야 정상입니다.
          </div>
        )}
      </div>

      <Chat client={chatClient} theme="messaging light">
        <Channel channel={channel}>
          <Window>
            <ChannelHeader />
            <MessageList />

            {!expired ? (
              <MessageInput />
            ) : (
              <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
                <button
                  onClick={() => {
                    window.location.href = "https://YOUR-SOFTR-PROFILE-URL";
                  }}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1px solid #ccc",
                    background: "#111",
                    color: "#fff",
                    fontSize: 16,
                    marginBottom: 10,
                  }}
                >
                  프로필 공개 보기
                </button>

                <button
                  onClick={() => alert("다음 단계: 연장(둘 다 동의) 로직 붙이기")}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1px solid #ccc",
                    background: "#fff",
                    color: "#111",
                    fontSize: 16,
                  }}
                >
                  15분 연장 제안(둘 다 동의)
                </button>
              </div>
            )}
          </Window>
        </Channel>
      </Chat>
    </div>
  );
}
