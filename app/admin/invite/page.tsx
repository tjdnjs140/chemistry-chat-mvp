import InviteClient from "./InviteClient";

export const dynamic = "force-dynamic";

export default function Page({
  searchParams,
}: {
  searchParams: { match_id?: string };
}) {
  return <InviteClient initialMatchId={searchParams.match_id ?? ""} />;
}