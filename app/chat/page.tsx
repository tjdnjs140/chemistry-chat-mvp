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
    // 쿼리로 들어오지 않았거나 파라미터가 깨진 경우: join로 유도
    redirect("/join");
  }

  redirect(`/chat/${encodeURIComponent(matchId)}/${encodeURIComponent(k)}`);
}
