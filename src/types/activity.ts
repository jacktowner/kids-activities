export type Activity = {
  id: string;
  title: string;
  description: string;
  category: string;
  borough: string;
  venue: string;
  address: string;
  lat: number;
  lng: number;
  ageMin: number;
  ageMax: number;
  isFree: boolean;
  priceMin: number;
  priceMax: number;
  startDate: string;
  endDate: string;
  times: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  imageUrl: string | null;
  featured: boolean;
  ownerId: string | null;
};

export type ActivityFilters = {
  q?: string;
  borough?: string[];
  category?: string;
  age?: number;
  freeOnly?: boolean;
  priceMax?: number;
  dateFrom?: string;
  dateTo?: string;
};
