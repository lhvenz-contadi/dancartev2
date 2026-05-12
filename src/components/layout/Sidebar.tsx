import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  Settings,
  X,
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
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar = ({ activeTab, onChangeTab, isOpen, onClose }: SidebarProps) => {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleItemClick = (tabId: string) => {
    onChangeTab(tabId);
    onClose();
  };

  const renderMenu = (variant: 'mobile' | 'desktop') => (
    <>
      <div className="px-6 py-5 flex items-center justify-between md:justify-center">
        <img src={logo} alt="DancArte" className="w-[160px] h-auto brightness-0 invert" />
        {variant === 'mobile' && (
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-white/70 hover:text-white transition-colors rounded-lg hover:bg-white/10"
            aria-label="Fechar menu"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {menuItems.map(item => (
          <SidebarItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={activeTab === item.id}
            onClick={() => handleItemClick(item.id)}
          />
        ))}
      </nav>
    </>
  );

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Mobile drawer */}
      <motion.aside
        initial={false}
        animate={{ x: isOpen ? 0 : '-100%' }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="fixed left-0 top-0 bottom-0 z-50 w-72 bg-primary text-white flex flex-col shadow-2xl md:hidden"
        aria-hidden={!isOpen}
      >
        {renderMenu('mobile')}
      </motion.aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-primary text-white flex-col shrink-0 z-10 shadow-sm">
        {renderMenu('desktop')}
      </aside>
    </>
  );
};
