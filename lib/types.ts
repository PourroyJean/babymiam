export type DashboardFood = {
  id: number;
  name: string;
  sortOrder: number;
  exposureCount: number;
  preference: -1 | 0 | 1;
  firstTastedOn: string | null;
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
