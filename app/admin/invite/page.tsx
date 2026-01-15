import dynamicImport from "next/dynamic";

export const dynamic = "force-dynamic";

const InviteClient = dynamicImport(() => import("./InviteClient"), {
  ssr: false,
  loading: () => <div style={{ padding: 16 }}>로딩중...</div>,
});

export default function Page() {
  return <InviteClient />;
}