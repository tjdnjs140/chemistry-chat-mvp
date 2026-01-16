export const dynamic = "force-dynamic";

import JoinClient from "./JoinClient";

type SP = Record<string, string | string[] | undefined>;

function pick(sp: SP, key: string) {
  const v = sp[key];
  return typeof v === "string" ? v : "";
}

export default function Page({ searchParams }: { searchParams: SP }) {
  const matchId = pick(searchParams, "match_id");
  const k = pick(searchParams, "k");

  // ✅ 서버에서 먼저 잡아서 클라로 넘김(카톡/새탭에서도 안정적)
  return <JoinClient initialMatchId={matchId} initialKey={k} />;
}
