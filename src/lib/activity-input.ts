import type { Prisma } from "@/generated/prisma/client";
import { normalizeCategories, formatCategories } from "@/lib/category";

export function toActivityData(body: Record<string, unknown>): Prisma.ActivityCreateInput {
  return {
    title: String(body.title ?? "").trim(),
    description: String(body.description ?? "").trim(),
    category: formatCategories(normalizeCategories(body.category)),
    borough: String(body.borough ?? "").trim(),
    venue: String(body.venue ?? "").trim(),
    address: String(body.address ?? "").trim(),
    lat: Number(body.lat),
    lng: Number(body.lng),
    ageMin: Number(body.ageMin),
    ageMax: Number(body.ageMax),
    isFree: Boolean(body.isFree),
    priceMin: Number(body.priceMin ?? 0),
    priceMax: Number(body.priceMax ?? 0),
    startDate: new Date(String(body.startDate)),
    endDate: new Date(String(body.endDate)),
    times: body.times ? String(body.times) : null,
    sourceName: String(body.sourceName ?? "").trim(),
    sourceUrl: String(body.sourceUrl ?? "").trim(),
    imageUrl: body.imageUrl ? String(body.imageUrl) : null,
    featured: Boolean(body.featured),
  };
}
