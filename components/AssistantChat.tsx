"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buttonClass, cn, inputClass } from "./ui";

export type AssistantMessage = { id: string; role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "I need O- blood donors near me",
  "Find a hospital with 24 hour emergency",
  "What is Napa used for?",
  "Who can donate blood?",
  "আমার কাছাকাছি অ্যাম্বুলেন্স দরকার",
  "রক্তদানের আগে কী খাওয়া উচিত?",
];

function renderWithLinks(text: string) {
  return text.split(/(\/[a-z][a-z/-]*)/g).map((part, index) =>
    /^\/[a-z][a-z/-]*$/.test(part) ? (
      <Link key={index} href={part} className="font-medium underline">
        {part}
      </Link>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

export function AssistantChat({ initialMessages }: { initialMessages: AssistantMessage[] }) {
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [emergency, setEmergency] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading]);

  async function ask(question: string) {
    const content = question.trim();
    if (!content || loading) return;
    setText("");
    setLoading(true);
    setMessages((current) => [...current, { id: `local-${current.length}`, role: "user", content }]);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });
      const data = (await response.json()) as { reply?: string; emergency?: boolean; error?: string };
      setEmergency(!!data.emergency);
      setMessages((current) => [
        ...current,
        { id: `reply-${current.length}`, role: "assistant", content: data.reply ?? data.error ?? "Sorry, something went wrong." },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        { id: `reply-${current.length}`, role: "assistant", content: "I could not reach the server. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[70vh] flex-col rounded-xl border border-gray-200 bg-white">
      {emergency && (
        <div className="flex flex-wrap items-center gap-2 border-b border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <strong>Possible emergency.</strong>
          <Link href="/emergency" className="rounded-full bg-red-600 px-3 py-1 font-semibold text-white">
            Emergency button
          </Link>
          <a href="tel:999" className="rounded-full border border-red-300 bg-white px-3 py-1 font-semibold text-red-700">
            Call 999
          </a>
        </div>
      )}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="py-6 text-center">
            <p className="font-semibold">Hi! I can help you with donors, hospitals, medicines and health questions.</p>
            <p className="text-sm text-gray-500">আমি বাংলাতেও উত্তর দিতে পারি।</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => ask(suggestion)} className={buttonClass.small}>
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((message) => (
          <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm",
                message.role === "user" ? "rounded-br-sm bg-red-600 text-white" : "rounded-bl-sm bg-gray-100 text-gray-900",
              )}
            >
              {message.role === "assistant" ? renderWithLinks(message.content) : message.content}
            </div>
          </div>
        ))}
        {loading && <p className="text-sm text-gray-500">Assistant is typing…</p>}
        <div ref={bottomRef} />
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          ask(text);
        }}
        className="flex gap-2 border-t border-gray-200 p-3"
      >
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={1000}
          placeholder="Ask in English or বাংলা…"
          className={inputClass}
        />
        <button type="submit" disabled={loading || !text.trim()} className={buttonClass.primary}>
          Ask
        </button>
      </form>
    </div>
  );
}
