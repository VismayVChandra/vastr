export const CLOTHING_CATEGORIES = [
  "T-Shirts",
  "Shirts",
  "Tops",
  "Jeans",
  "Trousers",
  "Shorts",
  "Jackets",
  "Sweaters",
  "Dresses",
  "Skirts",
  "Shoes",
  "Accessories",
  "Other",
] as const;
export type ClothingCategory = (typeof CLOTHING_CATEGORIES)[number];

export const SEASONS = ["spring", "summer", "autumn", "winter", "all-season"] as const;
export type Season = (typeof SEASONS)[number];

export const FORMALITY_LEVELS = [
  "very casual",
  "casual",
  "smart casual",
  "semi-formal",
  "formal",
] as const;
export type Formality = (typeof FORMALITY_LEVELS)[number];

export const FITS = ["slim", "regular", "relaxed", "oversized"] as const;
export type Fit = (typeof FITS)[number];

export const STYLE_TAGS = [
  "casual",
  "streetwear",
  "minimal",
  "formal",
  "smart casual",
  "sporty",
  "traditional",
  "experimental",
  "versatile",
  "office",
  "college",
  "evening",
  "athleisure",
] as const;
export type StyleTag = (typeof STYLE_TAGS)[number];

export interface WardrobeItem {
  id: string;
  userId: string;
  imageUrl: string | null;
  name: string;
  category: ClothingCategory;
  subcategory: string | null;
  primaryColor: string;
  secondaryColors: string[];
  pattern: string;
  material: string | null;
  brand: string | null;
  size: string | null;
  fit: Fit;
  season: Season[];
  formality: Formality;
  styleTags: StyleTag[] | string[];
  timesWorn: number;
  lastWornAt: string | null;
  favorite: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type WardrobeItemInput = Omit<
  WardrobeItem,
  "id" | "userId" | "timesWorn" | "lastWornAt" | "createdAt" | "updatedAt" | "archived"
> & { favorite?: boolean };

export interface WardrobeFilters {
  search: string;
  category: ClothingCategory | "All";
  color: string | "All";
  style: string | "All";
  season: Season | "All";
  sort: "recent" | "most-worn" | "least-worn" | "never-worn" | "name";
}

export const DEFAULT_FILTERS: WardrobeFilters = {
  search: "",
  category: "All",
  color: "All",
  style: "All",
  season: "All",
  sort: "recent",
};

export interface AIVisionResult {
  category: ClothingCategory;
  subcategory: string;
  primaryColor: string;
  secondaryColors: string[];
  pattern: string;
  material: string;
  fit: Fit;
  formality: Formality;
  season: Season[];
  styleTags: string[];
  suggestedName: string;
  confidence: number;
}
