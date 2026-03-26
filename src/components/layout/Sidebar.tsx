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
import logo from '../../assets/Logotipo.png';

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
      <div className="px-6 py-5 flex items-center justify-center">
        <img src={logo} alt="DancArte" className="w-[160px] h-auto brightness-0 invert" />
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
