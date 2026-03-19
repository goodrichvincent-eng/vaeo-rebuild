import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// ── Types ────────────────────────────────────────────────────────────────────

export type ItemType   = 'content_change' | 'seo_fix' | 'image_update' | 'app_config';
export type ItemStatus = 'pending' | 'approved' | 'rejected' | 'deployed';

export interface SavedItem {
  id:          string;
  type:        ItemType;
  title:       string;
  description: string;
  url:         string;
  status:      ItemStatus;
  createdAt:   string;
  updatedAt:   string;
  data:        Record<string, unknown>;
}

export interface ReviewCenterStats {
  totalSaved: number;
  pending:    number;
  approved:   number;
  deployed:   number;
}

export interface ReviewCenterData {
  savedItems: SavedItem[];
  stats:      ReviewCenterStats;
}

// ── File I/O ─────────────────────────────────────────────────────────────────

const DATA_PATH = join(process.cwd(), 'data', 'review-center.json');

function readData(): ReviewCenterData {
  const raw = readFileSync(DATA_PATH, 'utf-8');
  return JSON.parse(raw) as ReviewCenterData;
}

function writeData(data: ReviewCenterData): void {
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function recomputeStats(items: SavedItem[]): ReviewCenterStats {
  return {
    totalSaved: items.length,
    pending:    items.filter(i => i.status === 'pending').length,
    approved:   items.filter(i => i.status === 'approved').length,
    deployed:   items.filter(i => i.status === 'deployed').length,
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getSavedItems(): ReviewCenterData {
  return readData();
}

export function addItem(item: Omit<SavedItem, 'id' | 'createdAt' | 'updatedAt' | 'status'>): SavedItem {
  const data = readData();
  const now  = new Date().toISOString();

  const newItem: SavedItem = {
    ...item,
    id:        crypto.randomUUID(),
    status:    'pending',
    createdAt: now,
    updatedAt: now,
  };

  data.savedItems.push(newItem);
  data.stats = recomputeStats(data.savedItems);
  writeData(data);

  return newItem;
}

export function updateStatus(id: string, status: ItemStatus): SavedItem | null {
  const data  = readData();
  const index = data.savedItems.findIndex(i => i.id === id);
  if (index === -1) return null;

  data.savedItems[index]!.status    = status;
  data.savedItems[index]!.updatedAt = new Date().toISOString();
  data.stats = recomputeStats(data.savedItems);
  writeData(data);

  return data.savedItems[index]!;
}

export function getByStatus(status: ItemStatus): SavedItem[] {
  const data = readData();
  return data.savedItems.filter(i => i.status === status);
}
