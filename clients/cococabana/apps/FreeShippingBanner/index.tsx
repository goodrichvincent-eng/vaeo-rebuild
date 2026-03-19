export interface FreeShippingBannerConfig {
  enabled: boolean;
  text: string;
  threshold: string;
  backgroundColor: string;
  textColor: string;
  bold: boolean;
  closeable: boolean;
  linkUrl: string;
}

export const defaultConfig: FreeShippingBannerConfig = {
  enabled: true,
  text: 'Free shipping for orders over',
  threshold: '$50',
  backgroundColor: '#006064',
  textColor: '#ffffff',
  bold: true,
  closeable: false,
  linkUrl: '',
};

export default function FreeShippingBanner(props: Partial<FreeShippingBannerConfig> = {}) {
  const config = { ...defaultConfig, ...props };

  if (!config.enabled) return null;

  const inner = (
    <>
      {config.text}{' '}
      {config.bold ? <strong>{config.threshold}</strong> : config.threshold}
    </>
  );

  const className = 'text-center py-2 px-4 text-xs tracking-widest uppercase';

  if (config.linkUrl) {
    return (
      <a
        href={config.linkUrl}
        className={`block ${className}`}
        style={{ backgroundColor: config.backgroundColor, color: config.textColor }}
      >
        {inner}
      </a>
    );
  }

  return (
    <div
      className={className}
      style={{ backgroundColor: config.backgroundColor, color: config.textColor }}
    >
      {inner}
    </div>
  );
}
