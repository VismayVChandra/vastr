import type { GeneratedOutfit, StylistContext } from "./stylist-context";

/** One earlier message in the conversation, with the looks it showed (if any). */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  outfits?: { name: string; label: string | null; itemIds: string[] }[];
}

export interface ChatContext extends StylistContext {
  /** Earlier turns, oldest first, not including the new message. */
  history: ChatTurn[];
  /** The message to answer now. */
  message: string;
}

/** A look in a chat reply. `label` is the moment it's for ("Morning · Presentation"). */
export interface ChatLook extends GeneratedOutfit {
  label: string | null;
}

export interface ChatResult {
  reply: string;
  outfits: ChatLook[];
  /** Short tappable next messages. */
  followUps: string[];
  isMock: boolean;
}
