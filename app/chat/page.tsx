export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

type SP = Record<string, string | string[] | undefined>;
const pick = (sp: SP, key: string) => (typeof sp[key] === "string" ? (sp[key] as string) : "");

export default function Page({ searchParams }: { searchParams: SP }) {
  const matchId = pick(searchParams, "match_id");
  const k = pick(searchParams, "k");

  // k가 없거나 깨진 경우(=현재 네가 겪는 상황) → join으로 유도
  if (!matchId || !k) {
    redirect("/join");
  }

  redirect(`/chat/${encodeURIComponent(matchId)}/${encodeURIComponent(k)}`);
}
