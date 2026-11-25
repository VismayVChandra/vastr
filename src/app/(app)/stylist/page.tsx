"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatMessageBubble } from "@/components/stylist/chat-message";
import { useAuth } from "@/hooks/use-auth";
import { useOutfitStore } from "@/store/outfit-store";
import { toChatTurns, useStylistChat } from "@/hooks/use-stylist-chat";
import {
  getOrCreateSession,
  addMessage,
  listMessages,
  startNewSession,
} from "@/services/chat-service";
import type { ChatMessage } from "@/types/chat";

const PROMPT_IDEAS = [
  "I have a college presentation in the morning and a party at night.",
  "I'm going to a friend's birthday tonight.",
  "I have a job interview tomorrow.",
  "I want to look expensive but not overdressed.",
];

/** Shown under the latest looks when we don't have tailored suggestions (for example after a reload). */
const DEFAULT_FOLLOW_UPS = ["More casual", "Dress it up", "Different shoes", "Something warmer"];

export default function StylistPage() {
  const { userId, profile } = useAuth();
  const createDraft = useOutfitStore((s) => s.createDraft);
  const { ask, thinking } = useStylistChat();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [followUps, setFollowUps] = useState<string[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const session = await getOrCreateSession(userId);
      setSessionId(session.id);
      setMessages(await listMessages(session.id));
    })();
  }, [userId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking, followUps]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || !sessionId || !userId || !profile || thinking) return;

    // The stylist reads the conversation so far, so follow-ups like "more casual" make sense.
    const history = toChatTurns(messages);

    const userMsg = await addMessage(sessionId, "user", message);
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setFollowUps(null);

    try {
      const result = await ask(message, history);

      const outfits = await Promise.all(
        result.outfits.map((look) =>
          createDraft(userId, {
            name: look.name,
            itemIds: look.itemIds,
            reason: look.reason,
            // Which moment the look is for ("Morning · Presentation"), shown on the card.
            occasion: look.label,
            missingItems: look.missingItems,
            source: "stylist-chat",
          })
        )
      );

      const assistantMsg = await addMessage(
        sessionId,
        "assistant",
        result.reply,
        outfits.length > 0 ? outfits : null
      );
      setMessages((m) => [...m, assistantMsg]);
      setFollowUps(result.followUps);
    } catch (err) {
      console.error(err);
      toast.error("I couldn't reach the stylist just now. Please try again.");
    }
  }

  async function newChat() {
    if (!userId || thinking) return;
    const session = await startNewSession(userId);
    setSessionId(session.id);
    setMessages([]);
    setFollowUps(null);
    setInput("");
  }

  const last = messages[messages.length - 1];
  const showChips =
    !thinking && last?.role === "assistant" && (followUps ?? (last.outfits?.length ? DEFAULT_FOLLOW_UPS : [])).length > 0;
  const chips = followUps ?? (last?.outfits?.length ? DEFAULT_FOLLOW_UPS : []);

  return (
    <div className="flex h-[calc(100vh-8rem)] lg:h-[calc(100vh-6rem)] flex-col">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" /> Your AI Stylist
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tell me about your day and I&apos;ll build outfits from your wardrobe.
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" size="sm" onClick={newChat} disabled={thinking}>
            <Plus className="h-3.5 w-3.5" /> New chat
          </Button>
        )}
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

        {thinking && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground pl-11">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" />
            </span>
            styling your outfit...
          </div>
        )}

        {showChips && (
          <div className="flex flex-wrap gap-2 pl-11" data-testid="follow-ups">
            {chips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => send(chip)}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:border-accent/40 hover:shadow-sm transition-all"
              >
                {chip}
              </button>
            ))}
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
          placeholder="Describe your day, or tell me what to change..."
          className="min-h-11 max-h-32 resize-none border-0 shadow-none focus-visible:ring-0"
        />
        <Button type="submit" size="icon" disabled={thinking || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
