import type { Metadata } from "next";
import { AssistantChat, type AssistantMessage } from "@/components/AssistantChat";
import { Alert, PageContainer, PageHeader } from "@/components/ui";
import { AI_DISCLAIMER } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "AI health assistant" };

export default async function AssistantPage() {
  const user = await requireUser();
  const history = await db.aiMessage.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const messages: AssistantMessage[] = history.reverse().map((m) => ({
    id: m.id,
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));

  return (
    <PageContainer className="max-w-3xl space-y-4">
      <PageHeader
        title="AI health assistant"
        description="Ask about donors, blood requests, hospitals, doctors, pharmacies, medicines or general health. English and বাংলা supported."
      />
      <Alert tone="warning">{AI_DISCLAIMER} In an emergency, use the Emergency button or call 999.</Alert>
      <AssistantChat initialMessages={messages} />
    </PageContainer>
  );
}
