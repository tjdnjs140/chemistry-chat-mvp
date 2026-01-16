import ChatClient from "./ChatClient";

export const dynamic = "force-dynamic";

export default function Page({
  searchParams,
}: {
  searchParams: { match_id?: string; k?: string };
}) {
  return (
    <ChatClient
      initialMatchId={searchParams.match_id ?? ""}
      initialKey={searchParams.k ?? ""}
    />
  );
}
