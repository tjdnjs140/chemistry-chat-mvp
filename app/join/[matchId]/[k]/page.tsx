export const dynamic = "force-dynamic";

import JoinClient from "../../JoinClient";

export default function Page({
  params,
}: {
  params: { matchId?: string; k?: string };
}) {
  const matchId = typeof params.matchId === "string" ? params.matchId : "";
  const k = typeof params.k === "string" ? params.k : "";

  return <JoinClient initialMatchId={matchId} initialKey={k} />;
}
