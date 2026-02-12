export type DashboardFood = {
  id: number;
  name: string;
  sortOrder: number;
  exposureCount: number;
  preference: -1 | 0 | 1;
  firstTastedOn: string | null;
  note: string;
};

export type DashboardCategory = {
  id: number;
  name: string;
  sortOrder: number;
  foods: DashboardFood[];
};
