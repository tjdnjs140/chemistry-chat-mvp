import { Suspense } from "react";
import ChatClient from "./ChatClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>로딩중...</div>}>
      <ChatClient />
    </Suspense>
  );
}
