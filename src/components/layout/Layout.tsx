import { ReactNode, useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface LayoutProps {
  activeTab: string;
  onChangeTab: (tabId: string) => void;
  onLogout: () => void;
  children: ReactNode;
}

const getTitleFromTab = (tab: string) => {
  const titles: Record<string, string> = {
    dashboard: 'Dashboard',
    students: 'Alunos',
    'new-student': 'Novo Cadastro',
    'new-class': 'Nova Turma',
    financial: 'Financeiro',
    classes: 'Turmas',
    attendance: 'Frequência',
    teachers: 'Professores',
    agenda: 'Agenda',
    communication: 'Comunicação',
    reports: 'Relatórios'
  };
  return titles[tab] || tab;
};

export const Layout = ({ activeTab, onChangeTab, onLogout, children }: LayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!sidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [sidebarOpen]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const handler = () => {
      if (window.innerWidth >= 768) setSidebarOpen(false);
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [sidebarOpen]);

  const sidebarActiveTab =
    activeTab === 'new-student' ? 'students' :
    activeTab === 'new-class' ? 'classes' :
    activeTab;

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F9FA] dark:bg-slate-950 font-sans">
      <Sidebar
        activeTab={sidebarActiveTab}
        onChangeTab={onChangeTab}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          title={getTitleFromTab(activeTab)}
          onLogout={onLogout}
          onToggleSidebar={() => setSidebarOpen(o => !o)}
        />
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-white dark:bg-slate-950">
          {children}
        </div>
      </main>
    </div>
  );
};
