import { SidebarItem } from './SidebarItem';

export function SidebarGroup({
  label,
  items = [],
  collapsed = false,
  largeTouch = false,
  onNavigate,
}) {
  return (
    <div className="mb-5 last:mb-0">
      {label && !collapsed && (
        <p className="m-0 mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-sand/55">
          {label}
        </p>
      )}
      {collapsed && (
        <div
          aria-hidden="true"
          className="mx-3 my-2 h-px bg-sand/15"
        />
      )}
      <ul className="m-0 p-0 list-none space-y-1">
        {items.map((item) => (
          <SidebarItem
            key={item.to}
            to={item.to}
            label={item.label}
            icon={item.icon}
            end={item.end}
            collapsed={collapsed}
            largeTouch={largeTouch}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
    </div>
  );
}
