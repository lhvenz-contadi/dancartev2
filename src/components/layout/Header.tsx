import { Search, Bell, LogOut, Menu } from 'lucide-react';

interface HeaderProps {
  title: string;
  onLogout: () => void;
  onToggleSidebar: () => void;
}

export const Header = ({ title, onLogout, onToggleSidebar }: HeaderProps) => {
  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-100 flex items-center px-4 md:px-8 shrink-0">
      <button
        onClick={onToggleSidebar}
        className="md:hidden p-2 -ml-2 text-slate-500 hover:text-secondary transition-colors rounded-lg hover:bg-slate-50"
        aria-label="Abrir menu"
      >
        <Menu size={22} />
      </button>

      <div className="flex-1 flex justify-center md:justify-start">
        <h2 className="text-xl font-bold text-primary capitalize truncate">{title}</h2>
      </div>

      <div className="flex items-center gap-3 md:gap-6">
        <div className="relative group hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-secondary" size={16} />
          <input
            type="text"
            placeholder="Buscar..."
            className="pl-9 pr-4 py-2 w-64 bg-slate-50/80 border border-slate-100 rounded-lg text-sm focus:bg-white focus:outline-none focus:border-secondary transition-all"
          />
        </div>

        <button className="relative p-1.5 text-slate-400 hover:text-secondary transition-colors mt-1" aria-label="Notificações">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-[#F14B4B] rounded-full border border-white" />
        </button>

        <div className="flex items-center gap-3 md:pl-6 md:border-l md:border-slate-100">
          <div className="w-9 h-9 rounded-full bg-secondary text-white font-bold text-sm flex items-center justify-center shadow-sm">
            AV
          </div>
          <div className="hidden sm:block leading-tight">
            <p className="text-[13px] font-semibold text-primary">Amanda Venz</p>
            <p className="text-[11px] text-accent">Proprietária</p>
          </div>
          <button
            onClick={onLogout}
            className="ml-2 p-2 text-slate-400 hover:text-red-500 transition-colors rounded-full hover:bg-red-50"
            title="Sair"
            aria-label="Sair"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
};
