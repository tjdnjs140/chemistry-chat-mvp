import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

function pick(sp: SP, key: string) {
  const v = sp[key];
  return typeof v === "string" ? v : "";
}

export default function Page({ searchParams }: { searchParams: SP }) {
  const matchId = pick(searchParams, "match_id");
  const k = pick(searchParams, "k");

  if (!matchId || !k) {
    redirect("/");
  }

  redirect(`/join/${encodeURIComponent(matchId)}/${encodeURIComponent(k)}`);
}
