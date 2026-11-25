import { z } from "zod";
import {
  CLOTHING_CATEGORIES,
  FITS,
  FORMALITY_LEVELS,
  SEASONS,
} from "@/types/wardrobe";

export const visionResultSchema = z.object({
  category: z.enum(CLOTHING_CATEGORIES),
  subcategory: z.string().min(1).max(60),
  primary_color: z.string().min(1).max(40),
  secondary_colors: z.array(z.string().max(40)).max(3).default([]),
  pattern: z.string().min(1).max(40),
  material: z.string().min(1).max(60),
  fit: z.enum(FITS),
  formality: z.enum(FORMALITY_LEVELS),
  season: z.array(z.enum(SEASONS)).min(1),
  style_tags: z.array(z.string().max(30)).max(6),
  suggested_name: z.string().min(1).max(60),
  confidence: z.number().min(0).max(1),
});

export type VisionResultPayload = z.infer<typeof visionResultSchema>;

const missingPieceSchema = z.object({
  category: z.string(),
  description: z.string(),
  reason: z.string(),
});

const generatedOutfitSchema = z.object({
  name: z.string().min(1).max(60),
  item_ids: z.array(z.string()).min(1),
  reason: z.string().min(1).max(600),
  missing_items: z.array(missingPieceSchema).default([]),
});

export const outfitGenerationSchema = z.object({
  outfits: z.array(generatedOutfitSchema).min(1).max(4),
  message: z.string().max(1000).optional(),
});

export type OutfitGenerationPayload = z.infer<typeof outfitGenerationSchema>;

const chatLookSchema = generatedOutfitSchema.extend({
  label: z.string().max(60).nullish(),
});

export const chatReplySchema = z.object({
  reply: z.string().min(1).max(1500),
  outfits: z.array(chatLookSchema).max(4).default([]),
  follow_ups: z.array(z.string().min(1).max(40)).max(4).default([]),
});

export type ChatReplyPayload = z.infer<typeof chatReplySchema>;

export const tripPackingSchema = z.object({
  packing_list: z
    .array(
      z.object({
        label: z.string(),
        quantity: z.number().int().min(1).max(30),
        from_wardrobe_item_ids: z.array(z.string()).default([]),
      })
    )
    .min(1),
  missing_items: z
    .array(z.object({ label: z.string(), reason: z.string() }))
    .default([]),
});

export type TripPackingPayload = z.infer<typeof tripPackingSchema>;
