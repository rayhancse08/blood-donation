import { NextResponse, type NextRequest } from "next/server";
import { buildAppContext, generateAssistantReply, isEmergencyMessage, type ChatTurn } from "@/lib/ai";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

const MAX_MESSAGES_PER_HOUR = 60;
const MAX_LENGTH = 1000;
const HISTORY_TURNS = 10;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to use the assistant." }, { status: 401 });

  let message = "";
  try {
    const payload = (await request.json()) as { message?: unknown };
    message = typeof payload.message === "string" ? payload.message.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!message) return NextResponse.json({ error: "Please type a question." }, { status: 400 });
  if (message.length > MAX_LENGTH) {
    return NextResponse.json({ error: `Please keep questions under ${MAX_LENGTH} characters.` }, { status: 400 });
  }

  const recentCount = await db.aiMessage.count({
    where: { userId: user.id, role: "user", createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recentCount >= MAX_MESSAGES_PER_HOUR) {
    return NextResponse.json({ error: "You have reached the hourly limit. Please try again later." }, { status: 429 });
  }

  const previous = await db.aiMessage.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: HISTORY_TURNS,
    select: { role: true, content: true },
  });
  await db.aiMessage.create({ data: { userId: user.id, role: "user", content: message } });

  const history: ChatTurn[] = [
    ...previous
      .reverse()
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as ChatTurn["role"], content: m.content })),
    { role: "user", content: message },
  ];

  const emergency = isEmergencyMessage(message);
  const context = await buildAppContext(user, message);
  const reply = await generateAssistantReply(history, context, emergency);
  await db.aiMessage.create({ data: { userId: user.id, role: "assistant", content: reply } });

  return NextResponse.json({ reply, emergency });
}
