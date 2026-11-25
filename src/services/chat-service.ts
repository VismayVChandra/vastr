import { usesSupabase } from "@/lib/demo";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { chatMessageCollection, chatSessionCollection } from "@/lib/store/local-db";
import { uid } from "@/lib/utils";
import type { ChatMessage, ChatSession } from "@/types/chat";
import type { Outfit } from "@/types/outfit";

export async function getOrCreateSession(userId: string): Promise<ChatSession> {
  if (usesSupabase()) {
    const supabase = getSupabaseBrowserClient()!;
    const { data: existing } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) {
      return {
        id: existing.id,
        userId: existing.user_id,
        title: existing.title,
        createdAt: existing.created_at,
        updatedAt: existing.updated_at,
      };
    }
    const { data, error } = await supabase
      .from("chat_sessions")
      .insert({ user_id: userId, title: "Your AI Stylist" })
      .select("*")
      .single();
    if (error) throw error;
    return {
      id: data.id,
      userId: data.user_id,
      title: data.title,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  const existing = chatSessionCollection.list().find((s) => s.userId === userId);
  if (existing) return existing;
  const now = new Date().toISOString();
  return chatSessionCollection.insert({
    id: uid(),
    userId,
    title: "Your AI Stylist",
    createdAt: now,
    updatedAt: now,
  });
}

export async function listMessages(sessionId: string): Promise<ChatMessage[]> {
  if (usesSupabase()) {
    const supabase = getSupabaseBrowserClient()!;
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      role: r.role as ChatMessage["role"],
      content: r.content,
      outfits: (r.outfits as Outfit[]) ?? null,
      createdAt: r.created_at,
    }));
  }
  return chatMessageCollection
    .list()
    .filter((m) => m.sessionId === sessionId)
    .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
}

export async function addMessage(
  sessionId: string,
  role: ChatMessage["role"],
  content: string,
  outfits: Outfit[] | null = null
): Promise<ChatMessage> {
  if (usesSupabase()) {
    const supabase = getSupabaseBrowserClient()!;
    const { data, error } = await supabase
      .from("chat_messages")
      .insert({ session_id: sessionId, role, content, outfits: outfits as unknown as never })
      .select("*")
      .single();
    if (error) throw error;
    return {
      id: data.id,
      sessionId: data.session_id,
      role: data.role as ChatMessage["role"],
      content: data.content,
      outfits: (data.outfits as Outfit[]) ?? null,
      createdAt: data.created_at,
    };
  }
  return chatMessageCollection.insert({
    id: uid(),
    sessionId,
    role,
    content,
    outfits,
    createdAt: new Date().toISOString(),
  });
}
