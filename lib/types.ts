import type { ReactionType, TextureLevel } from "@/lib/tasting-metadata";

export type FoodTastingEntry = {
  slot: 1 | 2 | 3;
  liked: boolean;
  tastedOn: string;
  note: string;
  textureLevel: TextureLevel | null;
  reactionType: ReactionType | null;
};

export type DashboardFood = {
  id: number;
  name: string;
  sortOrder: number;
  tastings: FoodTastingEntry[];
  tastingCount: number;
  finalPreference: -1 | 0 | 1;
  note: string;
  updatedAt: string | null;
};

export type DashboardCategory = {
  id: number;
  name: string;
  sortOrder: number;
  foods: DashboardFood[];
};

export type ChildProfile = {
  firstName: string;
  birthDate: string;
};

export type ProgressSummary = {
  introducedCount: number;
  totalFoods: number;
  likedCount: number;
  recentFoodNames: string[];
};

export type FoodTimelineEntry = {
  foodId: number;
  foodName: string;
  categoryName: string;
  slot: 1 | 2 | 3;
  tastedOn: string;
  liked: boolean;
  note: string;
  textureLevel: TextureLevel | null;
  reactionType: ReactionType | null;
};

export type PublicShareSnapshot = {
  shareId: string;
  ownerId: number;
  firstName: string | null;
  introducedCount: number;
  totalFoods: number;
  likedCount: number;
  milestone: number | null;
  recentFoods: string[];
  createdAt: string;
  expiresAt: string | null;
};

export type TextureCoachStatus = "no_data" | "aligned" | "watch" | "behind";

export type TextureCoachSnapshot = {
  ageMonths: number;
  targetTextureMin: TextureLevel;
  targetTextureMax: TextureLevel;
  targetLabel: string;
  observedTextureLevel: TextureLevel | null;
  observedLabel: string;
  goalTextureLevel: TextureLevel;
  status: TextureCoachStatus;
  statusLabel: string;
  statusDescription: string;
  actionLabel: string;
  suggestedFoods: string[];
  texturedEntriesCount: number;
  totalEntriesCount: number;
  coveragePercent: number;
};
