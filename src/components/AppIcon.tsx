interface AppIconProps {
  className: string;
}

const AppIcon = ({ className }: AppIconProps) => {
  const iconPath = window.electronAPI ? `${process.env.PUBLIC_URL}/icon.png` : '/icon.png';
  return <img className={className} src={iconPath} alt='' aria-hidden='true' />;
};

export default AppIcon;
