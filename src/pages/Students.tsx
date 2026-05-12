import { useState, useEffect } from 'react';
import { Search, MoreVertical, Plus, Loader2, UserX, SlidersHorizontal } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { hashColor, getInitials } from '../lib/colors';
import { FAB } from '../components/ui/FAB';
import { BottomSheet } from '../components/ui/BottomSheet';
import { ListCard } from '../components/ui/ListCard';

interface Student {
  id: string;
  full_name: string;
  birth_date: string | null;
  plan: string | null;
  custom_value: number | null;
  status: string;
  photo_url: string | null;
  email: string | null;
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'Ativo', label: 'Ativo' },
  { value: 'Inativo', label: 'Inativo' },
];

export const Students = ({ onAddClick, onSelectStudent }: { onAddClick: () => void; onSelectStudent: (id: string) => void }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFiltersSheet, setShowFiltersSheet] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('students')
        .select('id, full_name, birth_date, plan, custom_value, status, photo_url, email')
        .order('full_name');

      if (!error && data) setStudents(data);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = students.filter(s => {
    const matchName = s.full_name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter ? s.status === statusFilter : true;
    return matchName && matchStatus;
  });

  const renderAvatar = (s: Student) =>
    s.photo_url ? (
      <img src={s.photo_url} alt={s.full_name} className="w-12 h-12 rounded-full object-cover" />
    ) : (
      <div className={cn('w-12 h-12 rounded-full text-white flex items-center justify-center font-bold text-sm', hashColor(s.id))}>
        {getInitials(s.full_name)}
      </div>
    );

  const statusBadge = (status: string) => (
    <span
      className={cn(
        'inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border',
        status === 'Ativo'
          ? 'bg-green-100/50 text-green-500 border-green-200/50'
          : 'bg-slate-100 text-slate-400 border-slate-200',
      )}
    >
      {status}
    </span>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-4 md:space-y-6 pb-24 md:pb-12">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-primary">Alunos</h2>
          <p className="text-accent text-sm mt-1">
            {loading ? 'Carregando...' : `${filtered.length} aluna(s) encontrada(s)`}
          </p>
        </div>
        <button
          onClick={onAddClick}
          className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-secondary text-white font-semibold rounded-full hover:bg-primary transition-all shadow-md shadow-secondary/20"
        >
          <Plus size={18} />
          Nova Aluna
        </button>
      </div>

      <div className="bg-white rounded-2xl md:rounded-[20px] p-2 border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-0 md:min-w-[250px] ml-2">
          <Search className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
          <input
            type="text"
            placeholder="Buscar por nome..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-2 h-11 text-base md:text-sm bg-transparent border-none placeholder-slate-400 focus:outline-none focus:ring-0"
          />
        </div>

        <button
          type="button"
          onClick={() => setShowFiltersSheet(true)}
          className="md:hidden inline-flex items-center justify-center gap-1.5 min-h-11 min-w-11 px-3 rounded-full border border-slate-200 text-slate-600 text-sm font-semibold relative"
          aria-label="Filtros"
        >
          <SlidersHorizontal size={16} />
          {statusFilter && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-secondary" />}
        </button>

        <div className="hidden md:flex items-center gap-2 pr-2">
          <div className="h-8 w-px bg-slate-100 mx-2" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-transparent border border-slate-200 rounded-full px-4 py-2 text-sm text-slate-600 focus:outline-none focus:border-secondary"
          >
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Mobile list */}
      <div className="md:hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-300">
            <Loader2 size={32} className="animate-spin mb-2" />
            <p className="text-sm font-medium">Carregando alunos...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-300">
            <UserX size={40} className="mb-3 opacity-40" />
            <p className="text-sm font-semibold text-slate-400">Nenhuma aluna encontrada</p>
            <p className="text-xs text-slate-300 mt-1">Adicione uma nova aluna para começar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(s => (
              <ListCard
                key={s.id}
                avatar={renderAvatar(s)}
                title={s.full_name}
                subtitle={
                  <div className="space-y-0.5">
                    <p className="truncate">{s.plan ?? 'Sem plano'}</p>
                    {s.email && <p className="truncate text-slate-400">{s.email}</p>}
                  </div>
                }
                meta={statusBadge(s.status)}
                onClick={() => onSelectStudent(s.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-[20px] shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-300">
            <Loader2 size={36} className="animate-spin mb-3" />
            <p className="text-sm font-medium">Carregando alunos...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-300">
            <UserX size={48} className="mb-4 opacity-40" />
            <p className="text-base font-semibold text-slate-400">Nenhuma aluna encontrada</p>
            <p className="text-sm text-slate-300 mt-1">Adicione uma nova aluna para começar.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-50">
                  <th className="px-6 py-5 text-[11px] font-bold uppercase text-slate-400 tracking-wider">Nome</th>
                  <th className="px-6 py-5 text-[11px] font-bold uppercase text-slate-400 tracking-wider">Plano</th>
                  <th className="px-6 py-5 text-[11px] font-bold uppercase text-slate-400 tracking-wider">Mensalidade</th>
                  <th className="px-6 py-5 text-[11px] font-bold uppercase text-slate-400 tracking-wider">Status</th>
                  <th className="px-6 py-5 text-[11px] font-bold uppercase text-slate-400 tracking-wider w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(student => (
                  <tr
                    key={student.id}
                    onClick={() => onSelectStudent(student.id)}
                    className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        {student.photo_url ? (
                          <img src={student.photo_url} alt={student.full_name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className={`w-10 h-10 rounded-full ${hashColor(student.id)} text-white flex items-center justify-center font-bold text-sm shrink-0`}>
                            {getInitials(student.full_name)}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-bold text-primary uppercase">{student.full_name}</p>
                          {student.email && <p className="text-[11px] text-accent mt-0.5">{student.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-primary font-medium">{student.plan || <span className="text-slate-300">—</span>}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-primary font-medium">
                        {student.custom_value
                          ? `R$ ${student.custom_value.toFixed(2)}`
                          : <span className="text-accent text-xs">Sem registro</span>
                        }
                      </p>
                    </td>
                    <td className="px-6 py-4">{statusBadge(student.status)}</td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-slate-300 hover:text-slate-600 transition-colors">
                        <MoreVertical size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <FAB icon={<Plus size={24} />} onClick={onAddClick} label="Nova aluna" />

      <BottomSheet
        open={showFiltersSheet}
        onClose={() => setShowFiltersSheet(false)}
        title="Filtros"
      >
        <div className="space-y-4">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Status</p>
            <div className="space-y-2">
              {STATUS_OPTIONS.map(o => (
                <label
                  key={o.value || 'all'}
                  className={cn(
                    'flex items-center gap-3 p-3 min-h-12 rounded-xl border cursor-pointer transition-colors',
                    statusFilter === o.value ? 'border-secondary bg-secondary/5' : 'border-slate-200',
                  )}
                >
                  <input
                    type="radio"
                    name="status-filter"
                    value={o.value}
                    checked={statusFilter === o.value}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="accent-secondary"
                  />
                  <span className="text-sm font-semibold text-primary">{o.label}</span>
                </label>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowFiltersSheet(false)}
            className="w-full min-h-11 bg-primary text-white rounded-xl font-bold text-sm hover:bg-secondary transition-colors"
          >
            Aplicar
          </button>
        </div>
      </BottomSheet>
    </div>
  );
};
