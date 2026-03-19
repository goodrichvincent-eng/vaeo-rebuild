import { NextResponse } from 'next/server';
import {
  getSavedItems,
  addItem,
  updateStatus,
  type ItemType,
  type ItemStatus,
} from '@/lib/review-center';

/**
 * GET /api/review-center
 * Returns all saved items and stats.
 */
export async function GET() {
  try {
    const data = getSavedItems();
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/review-center
 * Adds a new item. Body: { type, title, description, url, data }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      type?:        string;
      title?:       string;
      description?: string;
      url?:         string;
      data?:        Record<string, unknown>;
    };

    if (!body.type || !body.title) {
      return NextResponse.json(
        { error: 'type and title are required' },
        { status: 400 },
      );
    }

    const validTypes: ItemType[] = ['content_change', 'seo_fix', 'image_update', 'app_config'];
    if (!validTypes.includes(body.type as ItemType)) {
      return NextResponse.json(
        { error: `type must be one of: ${validTypes.join(', ')}` },
        { status: 400 },
      );
    }

    const item = addItem({
      type:        body.type as ItemType,
      title:       body.title,
      description: body.description ?? '',
      url:         body.url ?? '',
      data:        body.data ?? {},
    });

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * PATCH /api/review-center?id=xxx
 * Updates an item's status. Body: { status }
 */
export async function PATCH(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 });
    }

    const body = await req.json() as { status?: string };

    const validStatuses: ItemStatus[] = ['pending', 'approved', 'rejected', 'deployed'];
    if (!body.status || !validStatuses.includes(body.status as ItemStatus)) {
      return NextResponse.json(
        { error: `status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 },
      );
    }

    const updated = updateStatus(id, body.status as ItemStatus);
    if (!updated) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
