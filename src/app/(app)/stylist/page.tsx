"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatMessageBubble } from "@/components/stylist/chat-message";
import { useAuth } from "@/hooks/use-auth";
import { useOutfitStore } from "@/store/outfit-store";
import { useOutfitGenerator } from "@/hooks/use-outfit-generator";
import { getOrCreateSession, addMessage, listMessages } from "@/services/chat-service";
import { uid } from "@/lib/utils";
import type { ChatMessage } from "@/types/chat";

const PROMPT_IDEAS = [
  "I have a college presentation in the morning and a party at night.",
  "I'm going to a friend's birthday tonight.",
  "I have a job interview tomorrow.",
  "I want to look expensive but not overdressed.",
];

export default function StylistPage() {
  const { userId, profile } = useAuth();
  const createDraft = useOutfitStore((s) => s.createDraft);
  const { generate, generating } = useOutfitGenerator();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const session = await getOrCreateSession(userId);
      setSessionId(session.id);
      const existing = await listMessages(session.id);
      setMessages(existing);
    })();
  }, [userId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, generating]);

  async function send(text: string) {
    if (!text.trim() || !sessionId || !userId || !profile) return;

    const userMsg = await addMessage(sessionId, "user", text.trim());
    setMessages((m) => [...m, userMsg]);
    setInput("");

    const generated = await generate({ query: text.trim(), count: 2 });

    const outfits = await Promise.all(
      generated.map((look) =>
        createDraft(userId, {
          name: look.name,
          itemIds: look.itemIds,
          reason: look.reason,
          occasion: null,
          missingItems: look.missingItems,
          source: "stylist-chat",
        })
      )
    );

    const replyText =
      outfits.length > 0
        ? buildReply(text.trim(), outfits.length)
        : "I need a few wardrobe items before I can put outfits together — add some in your Wardrobe first.";

    const assistantMsg = await addMessage(sessionId, "assistant", replyText, outfits);
    setMessages((m) => [...m, assistantMsg]);
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] lg:h-[calc(100vh-6rem)] flex-col">
      <div className="mb-4">
        <h1 className="font-display text-2xl flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" /> Your AI Stylist
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tell me about your day and I&apos;ll build outfits from your wardrobe.
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-6 pr-1 no-scrollbar">
        {messages.length === 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {PROMPT_IDEAS.map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                className="text-left rounded-xl border border-border bg-card px-4 py-3 text-sm hover:border-accent/40 hover:shadow-sm transition-all"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {messages.map((m) => (
          <ChatMessageBubble key={m.id} message={m} />
        ))}

        {generating && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground pl-11">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" />
            </span>
            styling your outfit...
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-4 flex items-end gap-2 rounded-2xl border border-border bg-card p-2"
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Describe your day, occasion, or ask for anything..."
          className="min-h-11 max-h-32 resize-none border-0 shadow-none focus-visible:ring-0"
        />
        <Button type="submit" size="icon" disabled={generating || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

function buildReply(query: string, count: number): string {
  return `Based on "${query}", I put together ${count} look${count > 1 ? "s" : ""} from your wardrobe — take a look below.`;
}
