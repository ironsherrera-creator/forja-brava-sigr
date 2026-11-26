import { NavigationLink } from './NavigationLink';

export function SidebarItem({
  to,
  label,
  icon,
  end = false,
  collapsed = false,
  largeTouch = false,
  onNavigate,
}) {
  return (
    <li>
      <NavigationLink
        to={to}
        label={label}
        icon={icon}
        end={end}
        collapsed={collapsed}
        largeTouch={largeTouch}
        onClick={onNavigate}
      />
    </li>
  );
}
