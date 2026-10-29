import type { CSSProperties } from 'react';

interface AppIconProps {
  className: string;
}

const AppIcon = ({ className }: AppIconProps) => {
  const iconPath = window.electronAPI ? `${process.env.PUBLIC_URL}/icon.png` : '/icon.png';
  const iconMask: CSSProperties = {
    maskImage: `url("${iconPath}")`,
    WebkitMaskImage: `url("${iconPath}")`,
  };

  return <span className={className} style={iconMask} aria-hidden='true' />;
};

export default AppIcon;
