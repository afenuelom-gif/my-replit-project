import { useLocation } from "wouter";

const ADMIN_TABS = [
  { label: "Feedback", path: "/admin/feedback" },
  { label: "Users", path: "/admin/users" },
];

export function AdminNav() {
  const [location, setLocation] = useLocation();

  return (
    <div className="relative z-10 border-b border-slate-200/80 bg-white/60 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-6">
        <nav className="-mb-px flex gap-6">
          {ADMIN_TABS.map(({ label, path }) => (
            <button
              key={path}
              onClick={() => setLocation(path)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                location === path
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
