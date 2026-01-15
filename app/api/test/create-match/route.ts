import { NextResponse } from "next/server";
import { StreamChat } from "stream-chat";

export async function POST() {
  try {
    const apiKey = process.env.NEXT_PUBLIC_STREAM_KEY;
    const apiSecret = process.env.STREAM_SECRET;

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_STREAM_KEY or STREAM_SECRET in .env.local" },
        { status: 500 }
      );
    }

    // 1) 서버용 Stream 클라이언트 생성 (Secret 사용)
    const serverClient = StreamChat.getInstance(apiKey, apiSecret);

    // 2) 테스트 유저 2명 (매번 새로 만들지 않고, 고정으로 써도 됨)
    const userA = "test_user_a";
    const userB = "test_user_b";

    await serverClient.upsertUsers([
  { id: userA, name: "Test User A" },
  { id: userB, name: "Test User B" },
]);

    // 3) 채널 id 생성 (매번 새 채팅방 만들기)
    const channelId = `match_${Date.now()}`;

    // 4) 채널 생성 (members 2명)
    const channel = serverClient.channel("messaging", channelId, {
       created_by_id: userA, members: [userA, userB],
    });

    await channel.create();


    // 5) 프론트에서 접속할 토큰 발급
    const tokenA = serverClient.createToken(userA);
    const tokenB = serverClient.createToken(userB);

    return NextResponse.json({
      channel_id: channelId,
      users: {
        a: { id: userA, token: tokenA },
        b: { id: userB, token: tokenB },
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}