import { Suspense } from "react";
import JoinClient from "./JoinClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>로딩중...</div>}>
      <JoinClient />
    </Suspense>
  );
}