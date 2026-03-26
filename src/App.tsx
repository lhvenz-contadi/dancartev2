import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock } from 'lucide-react';

// Layout
import { Layout } from './components/layout/Layout';

// Pages
import { Dashboard } from './pages/Dashboard';
import { Students } from './pages/Students';
import { NewStudentForm } from './pages/NewStudentForm';
import { StudentDetail } from './pages/StudentDetail';
import { Financial } from './pages/Financial';
import { Classes } from './pages/Classes';
import { NewClassForm } from './pages/NewClassForm';
import { SettingsPage } from './pages/Settings';
import { Agenda } from './pages/Agenda';
import { Login } from './pages/Login';
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!session) {
    return <Login />;
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Layout
      activeTab={activeTab}
      onChangeTab={(tab) => { setSelectedStudentId(null); setSelectedClassId(null); setActiveTab(tab); }}
      onLogout={handleLogout}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'new-student' ? (
            <NewStudentForm onCancel={() => setActiveTab('students')} />
          ) : selectedStudentId ? (
            <StudentDetail studentId={selectedStudentId} onBack={() => setSelectedStudentId(null)} />
          ) : activeTab === 'dashboard' ? (
            <Dashboard
              onChangeTab={(tab) => { setSelectedStudentId(null); setSelectedClassId(null); setActiveTab(tab); }}
              onSelectStudent={(id) => { setSelectedStudentId(id); setActiveTab('students'); }}
            />
          ) : activeTab === 'students' ? (
            <Students
              onAddClick={() => setActiveTab('new-student')}
              onSelectStudent={(id) => {
                setSelectedStudentId(id);
                setActiveTab('students');
              }}
            />
          ) : activeTab === 'financial' ? (
            <Financial />
          ) : activeTab === 'new-class' ? (
            <NewClassForm onCancel={() => setActiveTab('classes')} />
          ) : activeTab === 'classes' ? (
            <Classes
              onAddClick={() => setActiveTab('new-class')}
              onSelectClass={(id) => {
                setSelectedClassId(id);
                // TODO: ClassDetail page
              }}
            />
          ) : activeTab === 'settings' ? (
            <SettingsPage />
          ) : activeTab === 'agenda' ? (
            <Agenda onChangeTab={(tab) => { setSelectedStudentId(null); setSelectedClassId(null); setActiveTab(tab); }} />
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 mt-20">
              <Clock size={48} className="mb-4 opacity-20" />
              <p className="text-lg font-medium">Módulo em desenvolvimento</p>
              <p className="text-sm">Esta funcionalidade estará disponível em breve.</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}
