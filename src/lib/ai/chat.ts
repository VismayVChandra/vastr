import "server-only";
import { getAnthropicClient, getGeminiClient, extractJson } from "./client";
import { chatStylistSystemPrompt } from "./prompts";
import { chatReplySchema } from "./schemas";
import { activeAIProvider, hasAIProvider, TEXT_MODEL } from "./config";
import { GEMINI_REQUEST_OPTIONS, fastJsonConfig, withDeadline, withGeminiFallback } from "./gemini-models";
import { buildWardrobeContext } from "./stylist";
import { planChatMock } from "./mock-chat";
import type { ChatContext, ChatLook, ChatResult } from "./chat-context";

const MAX_TURNS = 10;
/** How long the AI gets before the rule-based stylist answers instead. */
const CHAT_BUDGET_MS = 15_000;

function buildChatPrompt(ctx: ChatContext): string {
  const base = buildWardrobeContext({ ...ctx, query: ctx.message });
  return JSON.stringify(
    {
      ...base,
      // The chat prompt carries the conversation instead of a single request.
      request: undefined,
      conversation: ctx.history.slice(-MAX_TURNS).map((t) => ({
        role: t.role,
        text: t.content,
        outfits: t.outfits?.map((o) => ({ label: o.label, name: o.name, item_ids: o.itemIds })),
      })),
      latest_message: ctx.message,
    },
    null,
    2
  );
}

async function callGemini(prompt: string): Promise<unknown> {
  const result = await withGeminiFallback((modelName) =>
    getGeminiClient()
      .getGenerativeModel(
        {
          model: modelName,
          systemInstruction: chatStylistSystemPrompt(),
          generationConfig: fastJsonConfig(modelName),
        },
        GEMINI_REQUEST_OPTIONS
      )
      .generateContent(prompt)
  );
  return extractJson(result.response.text());
}

async function callAnthropic(prompt: string): Promise<unknown> {
  const message = await getAnthropicClient().messages.create({
    model: TEXT_MODEL,
    max_tokens: 2048,
    system: chatStylistSystemPrompt(),
    messages: [{ role: "user", content: prompt }],
  });
  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("No text response from model");
  return extractJson(textBlock.text);
}

/** Answers one chat message. Uses the AI model when available, otherwise (or on any failure) the rule-based stylist. */
export async function chatWithStylist(ctx: ChatContext): Promise<ChatResult> {
  if (!hasAIProvider || ctx.rulesOnly) return planChatMock(ctx);

  try {
    const prompt = buildChatPrompt(ctx);
    const json = await withDeadline(
      activeAIProvider === "gemini" ? callGemini(prompt) : callAnthropic(prompt),
      CHAT_BUDGET_MS,
      "AI chat"
    );
    const parsed = chatReplySchema.parse(json);

    const validIds = new Set(ctx.wardrobe.map((i) => i.id));
    const outfits: ChatLook[] = parsed.outfits
      .map((o) => ({
        label: o.label?.trim() || null,
        name: o.name,
        itemIds: o.item_ids.filter((id) => validIds.has(id)),
        reason: o.reason,
        missingItems: o.missing_items,
      }))
      .filter((o) => o.itemIds.length > 0);

    // The model offered looks but none of them used real clothes: don't show a reply promising them.
    if (parsed.outfits.length > 0 && outfits.length === 0) {
      throw new Error("Chat reply referenced no valid wardrobe items");
    }

    return {
      reply: parsed.reply,
      outfits,
      followUps: parsed.follow_ups,
      isMock: false,
    };
  } catch (err) {
    console.error(`[ai/chat] ${activeAIProvider} call failed, falling back to rule-based chat:`, err);
    return planChatMock(ctx);
  }
}
