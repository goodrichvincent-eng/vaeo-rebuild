export interface AnnouncementBarConfig {
  enabled: boolean;
  text: string;
  backgroundColor: string;
  textColor: string;
  linkUrl: string;
  openInNewTab: boolean;
}

export const defaultConfig: AnnouncementBarConfig = {
  enabled: true,
  text: 'Summer 2025',
  backgroundColor: '#000000',
  textColor: '#ffffff',
  linkUrl: '',
  openInNewTab: false,
};

export default function AnnouncementBar(props: Partial<AnnouncementBarConfig> = {}) {
  const config = { ...defaultConfig, ...props };

  if (!config.enabled) return null;

  const className = 'text-center py-2 px-4 text-xs font-semibold tracking-widest uppercase';

  if (config.linkUrl) {
    return (
      <a
        href={config.linkUrl}
        className={`block ${className}`}
        style={{ backgroundColor: config.backgroundColor, color: config.textColor }}
        {...(config.openInNewTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {config.text}
      </a>
    );
  }

  return (
    <div
      className={className}
      style={{ backgroundColor: config.backgroundColor, color: config.textColor }}
    >
      {config.text}
    </div>
  );
}
