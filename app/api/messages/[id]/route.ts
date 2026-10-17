import { after, NextResponse, type NextRequest } from "next/server";
import type { ChatMessage } from "@/components/ChatThread";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isBlockedBetween } from "@/lib/donors";
import { notifyUsers } from "@/lib/notify";

const MAX_LENGTH = 2000;

async function loadConversation(id: string, userId: string) {
  return db.conversation.findFirst({
    where: { id, OR: [{ userAId: userId }, { userBId: userId }] },
  });
}

function toChatMessage(message: { id: string; body: string; senderId: string; createdAt: Date }): ChatMessage {
  return { id: message.id, body: message.body, senderId: message.senderId, createdAt: message.createdAt.toISOString() };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await params;
  const conversation = await loadConversation(id, user.id);
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const afterParam = request.nextUrl.searchParams.get("after");
  const afterDate = afterParam ? new Date(afterParam) : null;
  const messages = await db.message.findMany({
    where: {
      conversationId: id,
      ...(afterDate && !Number.isNaN(afterDate.getTime()) ? { createdAt: { gt: afterDate } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  if (messages.some((m) => m.senderId !== user.id && !m.readAt)) {
    await db.message.updateMany({
      where: { conversationId: id, senderId: { not: user.id }, readAt: null },
      data: { readAt: new Date() },
    });
  }

  return NextResponse.json({ messages: messages.map(toChatMessage) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await params;
  const conversation = await loadConversation(id, user.id);
  if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  let text = "";
  try {
    const payload = (await request.json()) as { body?: unknown };
    text = typeof payload.body === "string" ? payload.body.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!text) return NextResponse.json({ error: "Message cannot be empty." }, { status: 400 });
  if (text.length > MAX_LENGTH) return NextResponse.json({ error: `Messages can be at most ${MAX_LENGTH} characters.` }, { status: 400 });

  const otherId = conversation.userAId === user.id ? conversation.userBId : conversation.userAId;
  const other = await db.user.findUnique({ where: { id: otherId }, select: { isSuspended: true } });
  if (!other || other.isSuspended || (await isBlockedBetween(user.id, otherId))) {
    return NextResponse.json({ error: "You can no longer message this user." }, { status: 403 });
  }

  const message = await db.message.create({ data: { conversationId: id, senderId: user.id, body: text } });
  await db.conversation.update({ where: { id }, data: { lastMessageAt: message.createdAt } });

  const link = `/messages/${id}`;
  after(async () => {
    const pending = await db.notification.count({
      where: { userId: otherId, type: "MESSAGE", link, readAt: null },
    });
    if (pending === 0) {
      await notifyUsers([otherId], {
        type: "MESSAGE",
        title: `New message from ${user.name ?? "a user"}`,
        body: text.length > 120 ? `${text.slice(0, 117)}…` : text,
        link,
      });
    }
  });

  return NextResponse.json({ message: toChatMessage(message) });
}
