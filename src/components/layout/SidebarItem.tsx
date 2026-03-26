import { cn } from '../../lib/utils';
import { LucideIcon } from 'lucide-react';

interface SidebarItemProps {
  key?: string;
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
}

export const SidebarItem = ({ icon: Icon, label, active, onClick }: SidebarItemProps) => (
  <button 
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-[10px] transition-all w-full text-left font-medium group",
      active ? "bg-[#EAF1F8] text-secondary" : "text-slate-300 hover:bg-white/10 hover:text-white"
    )}
  >
    <Icon size={20} className={cn("transition-colors", active ? "text-secondary" : "text-slate-400 group-hover:text-white")} />
    <span className="text-sm">{label}</span>
  </button>
);
