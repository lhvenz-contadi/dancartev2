import { useState, useEffect } from 'react';
import { Plus, Search, Loader2, Users, Clock, MapPin, Inbox } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

interface ClassRow {
  id: string;
  name: string;
  modality: string | null;
  level: string | null;
  teacher: string | null;
  room: string | null;
  max_capacity: number;
  is_active: boolean;
  class_schedules: { weekday: number; start_time: string; end_time: string }[];
  class_students?: { status: string }[];
}

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const formatTime = (t: string) => t?.slice(0, 5) || '';

export const Classes = ({ onAddClick, onSelectClass }: { onAddClick: () => void; onSelectClass: (id: string) => void }) => {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('classes')
        .select('id, name, modality, level, teacher, room, max_capacity, is_active, class_schedules(weekday, start_time, end_time), class_students(status)')
        .order('name');
      setClasses((data as any[]) ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = classes.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.modality ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.teacher ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const getScheduleSummary = (schedules: ClassRow['class_schedules']) => {
    if (!schedules || schedules.length === 0) return null;
    const sorted = [...schedules].sort((a, b) => a.weekday - b.weekday);
    const days = sorted.map(s => WEEKDAY_SHORT[s.weekday]).join(', ');
    const time = `${formatTime(sorted[0].start_time)} - ${formatTime(sorted[0].end_time)}`;
    return { days, time };
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-primary">Turmas</h2>
          <p className="text-accent text-sm mt-1">
            {loading ? 'Carregando...' : `${filtered.length} turma(s) encontrada(s)`}
          </p>
        </div>
        <button
          onClick={onAddClick}
          className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white font-semibold rounded-full hover:bg-primary transition-all shadow-md shadow-secondary/20"
        >
          <Plus size={18} />
          Nova Turma
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-[20px] p-2 border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[250px] ml-2">
          <Search className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
          <input
            type="text"
            placeholder="Buscar por nome, modalidade ou professor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-4 py-2 bg-transparent border-none text-sm placeholder-slate-400 focus:outline-none focus:ring-0"
          />
        </div>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-300">
          <Loader2 size={36} className="animate-spin mb-3" />
          <p className="text-sm font-medium">Carregando turmas...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-300">
          <Inbox size={48} className="mb-4 opacity-40" />
          <p className="text-base font-semibold text-slate-400">Nenhuma turma encontrada</p>
          <p className="text-sm text-slate-300 mt-1">Crie uma nova turma para começar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(cls => {
            const sched = getScheduleSummary(cls.class_schedules);
            const activeStudents = cls.class_students?.filter(s => s.status === 'active').length || 0;
            const occupancyPercentage = cls.max_capacity > 0 ? (activeStudents / cls.max_capacity) * 100 : 0;
            let occupancyColor = 'bg-green-500';
            if (occupancyPercentage > 90) occupancyColor = 'bg-red-500';
            else if (occupancyPercentage > 70) occupancyColor = 'bg-yellow-500';

            return (
              <div
                key={cls.id}
                onClick={() => onSelectClass(cls.id)}
                className="bg-white rounded-[20px] p-6 border border-slate-50 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] hover:shadow-lg hover:border-secondary/20 transition-all cursor-pointer group"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-primary group-hover:text-secondary transition-colors">{cls.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {cls.modality && (
                        <span className="text-[11px] font-semibold text-secondary bg-secondary/10 px-2.5 py-0.5 rounded-full">{cls.modality}</span>
                      )}
                      {cls.level && (
                        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">{cls.level}</span>
                      )}
                    </div>
                  </div>
                  <span className={cn(
                    'text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border',
                    cls.is_active ? 'bg-green-100/50 text-green-500 border-green-200/50' : 'bg-slate-100 text-slate-400 border-slate-200'
                  )}>
                    {cls.is_active ? 'Ativa' : 'Inativa'}
                  </span>
                </div>

                {/* Info rows */}
                <div className="space-y-2 text-sm">
                  {cls.teacher && (
                    <div className="flex items-center gap-2 text-slate-500">
                      <Users size={14} className="text-slate-400 shrink-0" />
                      <span>{cls.teacher}</span>
                    </div>
                  )}
                  {sched && (
                    <div className="flex items-center gap-2 text-slate-500">
                      <Clock size={14} className="text-slate-400 shrink-0" />
                      <span>{sched.days} • {sched.time}</span>
                    </div>
                  )}
                  {cls.room && (
                    <div className="flex items-center gap-2 text-slate-500">
                      <MapPin size={14} className="text-slate-400 shrink-0" />
                      <span>{cls.room}</span>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="mt-5 pt-4 border-t border-slate-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      {activeStudents}/{cls.max_capacity} alunas
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {Math.round(occupancyPercentage)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={cn("h-full rounded-full transition-all", occupancyColor)}
                      style={{ width: `${Math.min(occupancyPercentage, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
