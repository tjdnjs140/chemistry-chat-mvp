export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

type SP = Record<string, string | string[] | undefined>;
const pick = (sp: SP, key: string) => (typeof sp[key] === "string" ? (sp[key] as string) : "");

export default function Page({ searchParams }: { searchParams: SP }) {
  const matchId = pick(searchParams, "match_id");
  const k = pick(searchParams, "k");

  if (!matchId || !k) {
    redirect("/"); // 허브로
  }

  redirect(`/join/${encodeURIComponent(matchId)}/${encodeURIComponent(k)}`);
}
