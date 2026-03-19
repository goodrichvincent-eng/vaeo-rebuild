export interface ReviewBadgeConfig {
  enabled: boolean;
  showStars: boolean;
  showCount: boolean;
  starColor: string;
  textColor: string;
}

export const defaultConfig: ReviewBadgeConfig = {
  enabled: true,
  showStars: true,
  showCount: true,
  starColor: '#000000',
  textColor: '#6b7280',
};

interface ReviewBadgeProps extends Partial<ReviewBadgeConfig> {
  rating: number;
  reviewCount: number;
}

function Star({ filled, half, color }: { filled: boolean; half: boolean; color: string }) {
  if (half) {
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24">
        <defs>
          <linearGradient id="halfStar">
            <stop offset="50%" stopColor={color} />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <polygon
          points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
          fill={`url(#halfStar)`}
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <polygon
        points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
        fill={filled ? color : 'transparent'}
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ReviewBadge({ rating, reviewCount, ...props }: ReviewBadgeProps) {
  const config = { ...defaultConfig, ...props };

  if (!config.enabled) return null;

  const fullStars = Math.floor(rating);
  const hasHalf   = rating - fullStars >= 0.25 && rating - fullStars < 0.75;
  const roundedUp = rating - fullStars >= 0.75;

  const stars = Array.from({ length: 5 }, (_, i) => {
    if (i < fullStars || (roundedUp && i === fullStars)) return 'full';
    if (i === fullStars && hasHalf) return 'half';
    return 'empty';
  });

  return (
    <div className="inline-flex items-center gap-1.5">
      {config.showStars && (
        <div className="flex items-center gap-0.5">
          {stars.map((type, i) => (
            <Star
              key={i}
              filled={type === 'full'}
              half={type === 'half'}
              color={config.starColor}
            />
          ))}
        </div>
      )}
      <span className="text-sm" style={{ color: config.textColor }}>
        {rating.toFixed(1)}
      </span>
      {config.showCount && (
        <span className="text-sm" style={{ color: config.textColor }}>
          ({reviewCount.toLocaleString()} review{reviewCount !== 1 ? 's' : ''})
        </span>
      )}
    </div>
  );
}
