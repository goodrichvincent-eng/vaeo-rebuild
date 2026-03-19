import type { ProductReviewData } from '@/lib/reviews';

interface ProductReviewsProps {
  data: ProductReviewData | null;
}

function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(i => {
        const filled = i <= Math.round(rating);
        return (
          <svg
            key={i}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill={filled ? '#000' : 'none'}
            stroke="#000"
            strokeWidth="1.5"
          >
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
          </svg>
        );
      })}
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return '';
  }
}

export default function ProductReviews({ data }: ProductReviewsProps) {
  if (!data || data.reviewCount === 0) {
    return (
      <div className="border-t border-gray-200 pt-8 mt-8">
        <h3 id="reviews" className="font-heading text-xl font-normal uppercase tracking-widest mb-4">Reviews</h3>
        <p className="text-sm text-gray-400">Be the first to review this product.</p>
      </div>
    );
  }

  const { averageRating, reviewCount, reviews } = data;

  return (
    <div className="border-t border-gray-200 pt-8 mt-8">
      {/* Summary */}
      <div className="flex items-center gap-4 mb-8">
        <h3 id="reviews" className="font-heading text-xl font-normal uppercase tracking-widest">Reviews</h3>
        <div className="flex items-center gap-2">
          <StarRating rating={averageRating} size={18} />
          <span className="text-sm font-semibold">{averageRating.toFixed(1)}</span>
          <span className="text-sm text-gray-400">({reviewCount.toLocaleString()} reviews)</span>
        </div>
      </div>

      {/* Individual reviews */}
      {reviews.length > 0 ? (
        <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2">
          {reviews.map(review => (
            <div key={review.id} className="border-b border-gray-100 pb-6">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <p className="font-heading text-sm font-normal tracking-wide">{review.author}</p>
                  {review.createdAt && (
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(review.createdAt)}</p>
                  )}
                </div>
                <StarRating rating={review.rating} size={14} />
              </div>
              {review.title && (
                <p className="text-sm font-semibold mb-1">{review.title}</p>
              )}
              {review.body && (
                <p className="text-sm text-gray-600 leading-relaxed">{review.body}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">
          {reviewCount.toLocaleString()} verified reviews — showing summary only.
        </p>
      )}
    </div>
  );
}
