import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Review {
  id: string;
  author: string;
  rating: number;
  title: string;
  body: string;
  createdAt: string;
}

export interface ProductReviewData {
  productId: string;
  productHandle: string;
  averageRating: number;
  reviewCount: number;
  reviews: Review[];
}

let _cache: Record<string, ProductReviewData> | null = null;

function loadReviews(): Record<string, ProductReviewData> {
  if (_cache) return _cache;
  try {
    const filePath = join(process.cwd(), 'data', 'reviews.json');
    const raw = readFileSync(filePath, 'utf-8');
    _cache = JSON.parse(raw) as Record<string, ProductReviewData>;
  } catch {
    _cache = {};
  }
  return _cache;
}

export function getReviewsByHandle(handle: string): ProductReviewData | null {
  return loadReviews()[handle] ?? null;
}

export function getAllReviews(): Record<string, ProductReviewData> {
  return loadReviews();
}
