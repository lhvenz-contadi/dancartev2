import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  Wallet, 
  CalendarCheck, 
  GraduationCap, 
  Calendar, 
  MessageSquare, 
  BarChart3,
  Settings
} from 'lucide-react';
import { SidebarItem } from './SidebarItem';

const menuItems = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'students', icon: Users, label: 'Alunos' },
  { id: 'classes', icon: BookOpen, label: 'Turmas' },
  { id: 'financial', icon: Wallet, label: 'Financeiro' },
  { id: 'attendance', icon: CalendarCheck, label: 'Frequência' },
  { id: 'teachers', icon: GraduationCap, label: 'Professores' },
  { id: 'agenda', icon: Calendar, label: 'Agenda' },
  { id: 'communication', icon: MessageSquare, label: 'Comunicação' },
  { id: 'reports', icon: BarChart3, label: 'Relatórios' },
  { id: 'settings', icon: Settings, label: 'Configurações' },
];

interface SidebarProps {
  activeTab: string;
  onChangeTab: (tabId: string) => void;
}

export const Sidebar = ({ activeTab, onChangeTab }: SidebarProps) => {
  return (
    <aside className="w-64 bg-primary text-white flex flex-col shrink-0 z-10 shadow-sm">
      <div className="p-6 flex items-center gap-3">
        <div className="bg-white/10 rounded-lg p-2 shadow-sm flex items-center justify-center">
          <GraduationCap size={24} className="text-white" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-2xl font-black tracking-tight text-white leading-none mt-1">DancArte</h1>
          <span className="text-[10px] text-accent tracking-widest uppercase mt-0.5">Gestão Escolar</span>
        </div>
      </div>
      
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {menuItems.map(item => (
          <SidebarItem 
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={activeTab === item.id}
            onClick={() => onChangeTab(item.id)}
          />
        ))}
      </nav>
    </aside>
  );
};
