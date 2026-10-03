import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/library', label: 'Library', icon: '📚' },
  { to: '/import', label: 'Import', icon: '➕' },
  { to: '/search', label: 'Search', icon: '🔍' },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur safe-area-bottom">
      <ul className="mx-auto flex max-w-xl justify-around">
        {tabs.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
                  isActive ? 'text-sky-400' : 'text-slate-500 dark:text-slate-400'
                }`
              }
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
