import type { ReactionType, TextureLevel } from "@/lib/tasting-metadata";

export type FinalPreferenceValue = -1 | 0 | 1;
export type FinalPreferenceLookup = Map<number, FinalPreferenceValue> | Record<number, FinalPreferenceValue>;

export type FoodTastingEntry = {
  slot: 1 | 2 | 3;
  liked: boolean | null;
  tastedOn: string;
  note: string;
  textureLevel: TextureLevel;
  reactionType: ReactionType | null;
};

export type DashboardFood = {
  id: number;
  name: string;
  sortOrder: number;
  isUserOwned: boolean;
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

export type PublicSharePreferenceCounts = {
  liked: number;
  neutral: number;
  disliked: number;
};

export type PublicShareCategoryDiscovery = {
  categoryId: number;
  categoryName: string;
  totalCount: number;
  discoveredCount: number;
  discoveredPercent: number;
};

export type PublicShareCumulativeTastingsPoint = {
  date: string;
  totalTastings: number;
  tastingsOnDay: number;
};

export type PublicShareOverview = {
  introducedCount: number;
  introducedPercent: number;
  totalFoods: number;
  completedCount: number;
  completedPreferenceCounts: PublicSharePreferenceCounts;
  categoryDiscoveryCounts: PublicShareCategoryDiscovery[];
  cumulativeTastings: PublicShareCumulativeTastingsPoint[];
  totalTastings: number;
};

export type AccountPublicShareLink = {
  url: string;
  expiresAt: string;
};

export type FoodTimelineEntry = {
  foodId: number;
  foodName: string;
  categoryName: string;
  slot: 1 | 2 | 3;
  tastedOn: string;
  liked: boolean | null;
  note: string;
  textureLevel: TextureLevel;
  reactionType: ReactionType | null;
};
