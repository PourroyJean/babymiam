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
