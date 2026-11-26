import { z } from "zod";
import {
  CLOTHING_CATEGORIES,
  FITS,
  FORMALITY_LEVELS,
  SEASONS,
} from "@/types/wardrobe";
import { BUILDS, CONTRASTS, LEGS, SHOULDERS, TORSOS, UNDERTONES } from "@/types/fit";

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

/** A model that wanders off the allowed values shouldn't sink the whole answer: that field becomes null. */
const lenientEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values).nullish().catch(null);

export const fitAnalysisSchema = z.object({
  usable: z.boolean(),
  reason: z.string().max(300).nullish(),
  undertone: lenientEnum(UNDERTONES),
  contrast: lenientEnum(CONTRASTS),
  build: lenientEnum(BUILDS),
  shoulders: lenientEnum(SHOULDERS),
  torso: lenientEnum(TORSOS),
  legs: lenientEnum(LEGS),
  suits: z.array(z.string().max(80)).max(10).default([]),
  avoid: z.array(z.string().max(80)).max(10).default([]),
  best_colors: z.array(z.string().max(30)).max(10).default([]),
  avoid_colors: z.array(z.string().max(30)).max(8).default([]),
  summary: z.string().max(500).default(""),
});

export type FitAnalysisPayload = z.infer<typeof fitAnalysisSchema>;

export const inspirationSchema = z.object({
  usable: z.boolean(),
  reason: z.string().max(300).nullish(),
  look_name: z.string().max(80).default("Inspiration look"),
  pieces: z.array(z.string().max(120)).max(10).default([]),
  verdict: z.enum(["great", "works_with_tweaks", "not_ideal"]).catch("works_with_tweaks"),
  verdict_reason: z.string().max(900).default(""),
  adjustments: z.array(z.string().max(240)).max(6).default([]),
  from_wardrobe: z
    .object({
      name: z.string().max(80),
      item_ids: z.array(z.string()),
      reason: z.string().max(600),
      missing_items: z.array(missingPieceSchema).default([]),
    })
    .nullish(),
});

export type InspirationPayload = z.infer<typeof inspirationSchema>;

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
