"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { buttonClass, cn, inputClass } from "./ui";

export type ChatMessage = { id: string; body: string; senderId: string; createdAt: string };

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Dhaka",
});

export function ChatThread({
  conversationId,
  currentUserId,
  initialMessages,
  disabledReason,
}: {
  conversationId: string;
  currentUserId: string;
  initialMessages: ChatMessage[];
  disabledReason?: string | null;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const lastSeen = useRef(initialMessages.at(-1)?.createdAt ?? "");
  const bottomRef = useRef<HTMLDivElement>(null);

  function append(incoming: ChatMessage[]) {
    if (incoming.length === 0) return;
    setMessages((current) => {
      const ids = new Set(current.map((m) => m.id));
      const merged = [...current, ...incoming.filter((m) => !ids.has(m.id))];
      lastSeen.current = merged.at(-1)?.createdAt ?? lastSeen.current;
      return merged;
    });
  }

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/messages/${conversationId}?after=${encodeURIComponent(lastSeen.current)}`, {
          cache: "no-store",
        });
        if (!response.ok || cancelled) return;
        const data = (await response.json()) as { messages: ChatMessage[] };
        if (!cancelled) append(data.messages);
      } catch {
        // retried on next poll
      }
    };
    const timer = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/messages/${conversationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = (await response.json()) as { message?: ChatMessage; error?: string };
      if (!response.ok || !data.message) throw new Error(data.error ?? "Message could not be sent.");
      append([data.message]);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100dvh_-_var(--mobile-nav-height)_-_14rem)] min-h-80 flex-col rounded-xl border border-gray-200 bg-white lg:h-[65vh]">
      <div className="flex-1 space-y-2 overflow-y-auto overscroll-contain p-3 sm:p-4">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-gray-500">No messages yet. Say hello!</p>}
        {messages.map((message) => {
          const mine = message.senderId === currentUserId;
          return (
            <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm sm:max-w-[80%]",
                  mine ? "rounded-br-sm bg-red-600 text-white" : "rounded-bl-sm bg-gray-100 text-gray-900",
                )}
              >
                <p className="whitespace-pre-wrap break-words">{message.body}</p>
                <p className={cn("mt-1 text-[10px]", mine ? "text-red-100" : "text-gray-500")}>
                  {timeFormat.format(new Date(message.createdAt))}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {disabledReason ? (
        <p className="border-t border-gray-200 p-4 text-center text-sm text-gray-500">{disabledReason}</p>
      ) : (
        <form onSubmit={send} className="flex gap-2 border-t border-gray-200 p-2 sm:p-3">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={2000}
            placeholder="Type a message…"
            enterKeyHint="send"
            className={inputClass}
          />
          <button type="submit" disabled={sending || !text.trim()} className={cn(buttonClass.primary, "shrink-0")}>
            Send
          </button>
        </form>
      )}
      {error && <p className="px-4 pb-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
