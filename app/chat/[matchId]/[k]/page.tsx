export const dynamic = "force-dynamic";

import ChatClient from "../../ChatClient";

export default function Page({
  params,
}: {
  params: { matchId?: string; k?: string };
}) {
  const matchId = typeof params.matchId === "string" ? params.matchId : "";
  const k = typeof params.k === "string" ? params.k : "";

  return <ChatClient initialMatchId={matchId} initialKey={k} />;
}
