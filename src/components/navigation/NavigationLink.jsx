import { NavLink } from 'react-router-dom';
import { Tooltip } from '../ui/Tooltip';

export function NavigationLink({
  to,
  label,
  icon: Icon = null,
  end = false,
  collapsed = false,
  largeTouch = false,
  onClick,
  className = '',
}) {
  const linkNode = (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        [
          'group relative flex items-center gap-3 rounded-[var(--radius-sm)] transition-colors duration-150',
          largeTouch ? 'min-h-[46px] px-3.5 py-2.5 text-sm' : 'min-h-[40px] px-3 py-2 text-[13px]',
          collapsed ? 'justify-center px-0' : '',
          isActive
            ? 'bg-fire/18 text-cream font-semibold'
            : 'text-sand/85 hover:text-cream hover:bg-white/6 font-normal',
          className,
        ]
          .filter(Boolean)
          .join(' ')
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden="true"
              className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-fire rounded-r-[2px]"
            />
          )}
          {Icon && (
            <Icon
              className={`shrink-0 ${largeTouch ? 'h-5 w-5' : 'h-[18px] w-[18px]'} ${
                isActive ? 'text-fire-hover' : 'text-sand/75 group-hover:text-cream'
              }`}
              aria-hidden="true"
            />
          )}
          {!collapsed && <span className="truncate">{label}</span>}
          {collapsed && <span className="sr-only">{label}</span>}
        </>
      )}
    </NavLink>
  );

  if (collapsed) {
    return (
      <Tooltip content={label} position="right">
        {linkNode}
      </Tooltip>
    );
  }

  return linkNode;
}
