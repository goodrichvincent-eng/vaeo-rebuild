import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ProductImage {
  localPath: string;
  width: number;
  height: number;
  alt: string;
}

export interface Variant {
  id: string;
  title: string;
  price: string;
  compareAtPrice: string | null;
  sku: string;
  available: boolean;
  inventoryQty: number;
}

export interface Product {
  id: string;
  title: string;
  handle: string;
  description: string;
  type: string;
  tags: string[];
  status: string;
  vendor: string;
  variants: Variant[];
  options: { name: string; values: string[] }[];
  images: ProductImage[];
  featuredImage: ProductImage | null;
  createdAt: string;
  updatedAt: string;
}

export interface Collection {
  id: string;
  title: string;
  handle: string;
  description: string;
  type: string;
  featuredImage: ProductImage | null;
  productHandles: string[];
  sortOrder: string;
  updatedAt: string;
}

export interface Page {
  id: string;
  title: string;
  handle: string;
  bodyHtml: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export interface NavItem {
  title: string;
  url: string;
  type: string;
}

export interface Navigation {
  main: NavItem[];
  footer: NavItem[];
  all: { handle: string; title: string; items: NavItem[] }[];
}

export interface ShopInfo {
  name: string;
  domain: string;
  myshopifyDomain: string;
  currency: string;
  description: string;
  email: string;
}

export interface ContentData {
  extractedAt: string;
  shop: ShopInfo;
  products: Product[];
  collections: Collection[];
  pages: Page[];
  navigation: Navigation;
  images: Record<string, ProductImage>;
}

let _cache: ContentData | null = null;

export function getContent(): ContentData {
  if (_cache) return _cache;
  const filePath = join(process.cwd(), 'data', 'content.json');
  const raw = readFileSync(filePath, 'utf-8');
  _cache = JSON.parse(raw) as ContentData;
  return _cache;
}

export function getProducts(): Product[] {
  return getContent().products;
}

export function getActiveProducts(): Product[] {
  return getContent().products.filter(p => p.status === 'active');
}

export function getProductByHandle(handle: string): Product | null {
  return getContent().products.find(p => p.handle === handle) ?? null;
}

export function getCollections(): Collection[] {
  return getContent().collections;
}

export function getActiveCollections(): Collection[] {
  // Exclude discontinued/draft collections (those with 0 active products)
  const { products } = getContent();
  const activeHandles = new Set(products.filter(p => p.status === 'active').map(p => p.handle));
  return getContent().collections.filter(col =>
    col.productHandles.some(h => activeHandles.has(h))
  );
}

export function getCollectionByHandle(handle: string): Collection | null {
  return getContent().collections.find(c => c.handle === handle) ?? null;
}

export function getCollectionProducts(collection: Collection): Product[] {
  const { products } = getContent();
  return collection.productHandles
    .map(h => products.find(p => p.handle === h))
    .filter((p): p is Product => p !== undefined);
}

export function getPageByHandle(handle: string): Page | null {
  return getContent().pages.find(p => p.handle === handle) ?? null;
}

export function getNavigation(): Navigation {
  return getContent().navigation;
}

export function getShop(): ShopInfo {
  return getContent().shop;
}

export function formatPrice(price: string, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(parseFloat(price));
}

export function getProductPriceRange(product: Product): { min: string; max: string; same: boolean } {
  const prices = product.variants.map(v => parseFloat(v.price));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return {
    min: formatPrice(String(min)),
    max: formatPrice(String(max)),
    same: min === max,
  };
}
