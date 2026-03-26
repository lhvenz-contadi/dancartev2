import { ReactNode } from 'react';
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
  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F9FA] dark:bg-slate-950 font-sans">
      <Sidebar activeTab={activeTab === 'new-student' ? 'students' : activeTab === 'new-class' ? 'classes' : activeTab} onChangeTab={onChangeTab} />
      
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header title={getTitleFromTab(activeTab)} onLogout={onLogout} />
        <div className="flex-1 overflow-y-auto p-8 bg-white dark:bg-slate-950">
          {children}
        </div>
      </main>
    </div>
  );
};
