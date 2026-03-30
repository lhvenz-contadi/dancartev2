import React, { useState, useEffect } from 'react';
import { ChevronLeft, Loader2, Save, Users, Trash2, Plus, X, Search, Clock, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { useConfigOptions } from '../lib/useConfigOptions';

interface ClassDetailProps {
  classId: string;
  onBack: () => void;
}

const WEEKDAYS = [
  { label: 'Dom', value: 0 },
  { label: 'Seg', value: 1 },
  { label: 'Ter', value: 2 },
  { label: 'Qua', value: 3 },
  { label: 'Qui', value: 4 },
  { label: 'Sex', value: 5 },
  { label: 'Sáb', value: 6 },
];

const LEVELS = ['Iniciante', 'Intermediário', 'Avançado', 'Pré-profissional', 'Livre'];

export const ClassDetail = ({ classId, onBack }: ClassDetailProps) => {
  const [activeTab, setActiveTab] = useState<'dados' | 'alunas'>('dados');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { options: modalities } = useConfigOptions('modality');
  
  // Dados Gerais
  const [formData, setFormData] = useState({
    name: '', modality: '', level: '', teacher: '', room: '',
    max_capacity: '20', min_age: '', max_age: '', is_active: true,
  });
  
  // Schedules
  const [schedules, setSchedules] = useState<{ id: string; weekday: number; start_time: string; end_time: string }[]>([]);
  const [newScheduleDays, setNewScheduleDays] = useState<number[]>([]);
  const [newStartTime, setNewStartTime] = useState('08:00');
  const [newEndTime, setNewEndTime] = useState('09:00');

  // Students
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [availableStudents, setAvailableStudents] = useState<any[]>([]);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [searchStudent, setSearchStudent] = useState('');

  // Notificações
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadClassData();
    // eslint-disable-next-line
  }, [classId]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadClassData = async () => {
    setLoading(true);
    // Dados da Turma
    const { data: cls, error: clsError } = await supabase
      .from('classes')
      .select('*, class_schedules(*)')
      .eq('id', classId)
      .single();

    if (clsError || !cls) {
      setError('Erro ao carregar dados da turma.');
      setLoading(false);
      return;
    }

    setFormData({
      name: cls.name ?? '',
      modality: cls.modality ?? '',
      level: cls.level ?? '',
      teacher: cls.teacher ?? '',
      room: cls.room ?? '',
      max_capacity: cls.max_capacity?.toString() ?? '20',
      min_age: cls.min_age?.toString() ?? '',
      max_age: cls.max_age?.toString() ?? '',
      is_active: cls.is_active ?? true,
    });
    setSchedules(cls.class_schedules ?? []);

    // Alunas Matriculadas
    await loadEnrolledStudents();
    setLoading(false);
  };

  const loadEnrolledStudents = async () => {
    const { data } = await supabase
      .from('class_students')
      .select('*, students(id, full_name, photo_url, plan)')
      .eq('class_id', classId)
      .eq('status', 'active');
    setEnrolledStudents(data ?? []);
  };

  const loadAvailableStudents = async () => {
    const { data: allStudents } = await supabase
      .from('students')
      .select('id, full_name, photo_url')
      .eq('status', 'Ativo');
    
    // Filtrar quem já está
    const enrolledIds = enrolledStudents.map(e => e.student_id);
    const available = (allStudents ?? []).filter(s => !enrolledIds.includes(s.id));
    setAvailableStudents(available);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  // SALVAR DADOS DA TURMA
  const handleSaveData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    setSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('classes')
        .update({
          name: formData.name,
          modality: formData.modality || null,
          level: formData.level || null,
          teacher: formData.teacher || null,
          room: formData.room || null,
          max_capacity: parseInt(formData.max_capacity) || 20,
          min_age: formData.min_age ? parseInt(formData.min_age) : null,
          max_age: formData.max_age ? parseInt(formData.max_age) : null,
          is_active: formData.is_active,
        })
        .eq('id', classId);

      if (updateError) throw updateError;
      showToast('Alterações salvas com sucesso!');
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar turma.');
    } finally {
      setSaving(false);
    }
  };

  // EXCLUIR TURMA
  const handleDeleteClass = async () => {
    if (!window.confirm('Tem certeza? Esta ação não pode ser desfeita.')) return;
    setSaving(true);
    try {
      await supabase.from('classes').delete().eq('id', classId);
      onBack();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir turma');
      setSaving(false);
    }
  };

  // SCHEDULES
  const handleAddSchedule = async () => {
    if (newScheduleDays.length === 0) return alert('Selecione pelo menos um dia.');
    setSaving(true);
    try {
      const inserts = newScheduleDays.map(weekday => ({
        class_id: classId,
        weekday,
        start_time: newStartTime,
        end_time: newEndTime,
      }));
      const { data, error } = await supabase.from('class_schedules').insert(inserts).select();
      if (error) throw error;
      setSchedules(prev => [...prev, ...data]);
      setNewScheduleDays([]);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    setSaving(true);
    try {
      await supabase.from('class_schedules').delete().eq('id', id);
      setSchedules(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ALUNAS
  const handleOpenAddStudent = () => {
    loadAvailableStudents();
    setShowAddStudent(true);
  };

  const handleEnrollStudent = async (studentId: string) => {
    const isFull = enrolledStudents.length >= parseInt(formData.max_capacity || '20');
    if (isFull && !window.confirm('Turma lotada! Deseja pular o limite de capacidade e matricular mesmo assim?')) return;
    
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // Insert or update (if previously inactive)
      const { error } = await supabase
        .from('class_students')
        .upsert({ class_id: classId, student_id: studentId, owner_id: user?.id, status: 'active' }, { onConflict: 'class_id, student_id' });
      if (error) throw error;
      await loadEnrolledStudents();
      setAvailableStudents(prev => prev.filter(s => s.id !== studentId)); // Remove da lista do modal
      showToast('Aluna matriculada!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUnenrollStudent = async (studentId: string) => {
    if (!window.confirm('Confirmar remoção da aluna da turma?')) return;
    setSaving(true);
    try {
      await supabase.from('class_students').update({ status: 'inactive' }).eq('class_id', classId).eq('student_id', studentId);
      await loadEnrolledStudents();
      showToast('Aluna removida da turma');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 text-slate-300">
      <Loader2 size={36} className="animate-spin mb-3" />
      <p>Carregando dados da turma...</p>
    </div>
  );

  return (
    <div className="max-w-[900px] mx-auto pb-12">
      {/* Page Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-slate-400 hover:text-secondary transition-colors shrink-0">
            <ChevronLeft size={24} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-primary leading-tight">{formData.name}</h2>
              <span className={cn(
                'text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border',
                formData.is_active ? 'bg-green-100/50 text-green-500 border-green-200/50' : 'bg-slate-100 text-slate-400 border-slate-200'
              )}>
                {formData.is_active ? 'Ativa' : 'Inativa'}
              </span>
            </div>
            <p className="text-[13px] text-slate-400 mt-1">Detalhes e gerenciamento da turma</p>
          </div>
        </div>
        <button
          onClick={handleDeleteClass}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-50 rounded-full border border-transparent hover:border-red-100 transition-colors"
        >
          <Trash2 size={16} />
          Excluir Turma
        </button>
      </div>

      {toast && (
        <div className={cn("fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-bold flex items-center gap-2 animate-in slide-in-from-top-4", 
          toast.type === 'success' ? "bg-green-50 text-green-600 border-green-200" : "bg-red-50 text-red-500 border-red-200"
        )}>
          {toast.msg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-slate-200 mb-8">
        <button
          onClick={() => setActiveTab('dados')}
          className={cn('pb-3 text-sm font-bold border-b-2 transition-colors',
            activeTab === 'dados' ? 'border-secondary text-secondary' : 'border-transparent text-slate-400 hover:text-slate-600'
          )}
        >
          Dados da Turma
        </button>
        <button
          onClick={() => setActiveTab('alunas')}
          className={cn('pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2',
            activeTab === 'alunas' ? 'border-secondary text-secondary' : 'border-transparent text-slate-400 hover:text-slate-600'
          )}
        >
          Alunas Matriculadas
          <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded-full">{enrolledStudents.length}</span>
        </button>
      </div>

      {/* TABS CONTENT */}
      {activeTab === 'dados' ? (
        <form onSubmit={handleSaveData} className="space-y-6">
          {error && <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600 font-medium">{error}</div>}
          
          {/* Identificação e Capacidade */}
          <div className="bg-white rounded-[20px] p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-slate-50">
            <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider mb-6">Informações Básicas</h3>
            <div className="space-y-5">
              <div>
                <label className="block text-[13px] font-bold text-primary mb-1.5">Nome da turma <span className="text-red-500">*</span></label>
                <input required name="name" value={formData.name} onChange={handleChange} className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[13px] font-bold text-primary mb-1.5">Modalidade</label>
                  <select name="modality" value={formData.modality} onChange={handleChange} className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm bg-white">
                    <option value="">Sem modalidade</option>
                    {modalities.map(m => <option key={m.id} value={m.label}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-primary mb-1.5">Nível</label>
                  <select name="level" value={formData.level} onChange={handleChange} className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm bg-white">
                    <option value="">Selecione...</option>
                    {LEVELS.map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-primary mb-1.5">Professor(a)</label>
                  <input name="teacher" value={formData.teacher} onChange={handleChange} className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-primary mb-1.5">Sala / Local</label>
                  <input name="room" value={formData.room} onChange={handleChange} className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm" />
                </div>
              </div>

              <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider pt-4 mb-2">Capacidade</h3>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <label className="block text-[13px] font-bold text-primary mb-1.5">Máximo <span className="text-red-500">*</span></label>
                  <input required name="max_capacity" type="number" value={formData.max_capacity} onChange={handleChange} min="1" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-primary mb-1.5">Início</label>
                  <input name="min_age" type="number" value={formData.min_age} onChange={handleChange} placeholder="Idade min" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-primary mb-1.5">Fim</label>
                  <input name="max_age" type="number" value={formData.max_age} onChange={handleChange} placeholder="Idade max" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" />
                </div>
              </div>

              {/* Toggle active */}
              <div className="flex items-center gap-3 mt-6 pt-6 border-t border-slate-50">
                <button type="button" onClick={() => setFormData(p => ({ ...p, is_active: !p.is_active }))} className={cn('relative inline-flex h-6 w-11 rounded-full transition-colors', formData.is_active ? 'bg-secondary' : 'bg-slate-300')}>
                  <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white transition-transform mt-1 ml-1', formData.is_active ? 'translate-x-5' : 'translate-x-0')}/>
                </button>
                <span className="text-sm font-semibold text-primary">Turma ativa</span>
              </div>
            </div>
            
            <div className="flex justify-end pt-6">
              <button type="submit" disabled={saving} className="px-6 py-2.5 bg-secondary text-white rounded-full font-bold hover:bg-primary transition-all text-sm flex items-center gap-2 disabled:opacity-60">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Salvar Alterações
              </button>
            </div>
          </div>

          {/* Horários */}
          <div className="bg-white rounded-[20px] p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-slate-50">
            <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider mb-6">Horários da Turma</h3>
            
            {schedules.length > 0 && (
              <div className="mb-6 space-y-2">
                {schedules.sort((a,b)=>a.weekday - b.weekday).map(s => (
                  <div key={s.id} className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <Clock size={16} className="text-slate-400" />
                      <span className="text-sm font-bold text-primary">{WEEKDAYS[s.weekday].label}</span>
                      <span className="text-sm text-slate-500">{s.start_time.slice(0,5)} - {s.end_time.slice(0,5)}</span>
                    </div>
                    <button type="button" onClick={() => handleDeleteSchedule(s.id)} disabled={saving} className="text-slate-400 hover:text-red-500 transition-colors p-1">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Novo Horário */}
            <div className="border border-slate-200 rounded-xl p-5 bg-slate-50">
              <h4 className="text-[13px] font-bold text-primary mb-4">Adicionar Horário</h4>
              <div className="flex flex-wrap gap-2 mb-4">
                {WEEKDAYS.map(wd => (
                  <button key={wd.value} type="button" onClick={() => setNewScheduleDays(p => p.includes(wd.value) ? p.filter(d => d !== wd.value) : [...p, wd.value])}
                    className={cn('px-3 py-1.5 rounded-full text-xs font-bold border transition-all', newScheduleDays.includes(wd.value) ? 'bg-secondary text-white border-secondary' : 'bg-white text-slate-500 border-slate-200 hover:border-secondary/50')}>
                    {wd.label}
                  </button>
                ))}
              </div>
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="block text-[12px] font-bold text-primary mb-1">Início</label>
                  <input type="time" value={newStartTime} onChange={e=>setNewStartTime(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white" />
                </div>
                <div className="flex-1">
                  <label className="block text-[12px] font-bold text-primary mb-1">Fim</label>
                  <input type="time" value={newEndTime} onChange={e=>setNewEndTime(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white" />
                </div>
                <button type="button" onClick={handleAddSchedule} disabled={saving || newScheduleDays.length === 0} className="px-5 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-700 disabled:opacity-50 transition-colors">
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        /* Aba Alunas */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-primary">Alunas Matriculadas</h3>
              <p className="text-sm text-slate-500 mt-1">
                Ocupação: <span className="font-bold text-primary">{enrolledStudents.length} / {formData.max_capacity}</span> vagas
              </p>
            </div>
            <button onClick={handleOpenAddStudent} className="flex items-center gap-2 px-4 py-2.5 bg-secondary text-white rounded-full font-bold hover:bg-primary transition-all text-sm shadow-md shadow-secondary/20">
              <Plus size={16} strokeWidth={3} />
              Adicionar Aluna
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {enrolledStudents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Users size={40} className="mb-3 opacity-30" />
                <p className="font-medium">Nenhuma aluna matriculada nesta turma.</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <tbody>
                  {enrolledStudents.map(e => (
                    <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {e.students?.photo_url ? (
                            <img src={e.students.photo_url} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary font-bold text-sm">
                              {e.students?.full_name?.substring(0,2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-bold text-primary">{e.students?.full_name}</p>
                            <p className="text-xs text-slate-400">Desde {new Date(e.enrolled_at).toLocaleDateString('pt-BR')}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-500">
                        {e.students?.plan ? <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-[11px] font-bold">{e.students.plan}</span> : 'Sem plano'}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button onClick={() => handleUnenrollStudent(e.student_id)} disabled={saving} className="text-xs font-bold text-red-500 hover:text-red-600 border border-transparent hover:border-red-100 bg-red-50 px-3 py-1.5 rounded-full transition-all disabled:opacity-50">
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Modal Adicionar Aluna */}
      {showAddStudent && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAddStudent(false)}>
          <div onClick={ev => ev.stopPropagation()} className="bg-white rounded-[24px] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-lg font-black text-primary">Matricular Aluna</h3>
              <button onClick={() => setShowAddStudent(false)} className="text-slate-400 hover:text-slate-600 bg-white shadow-sm border border-slate-100 rounded-full p-2"><X size={16} /></button>
            </div>
            
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar aluna..."
                  value={searchStudent}
                  onChange={e => setSearchStudent(e.target.value)}
                  className="w-full bg-slate-50 rounded-xl py-2 pl-9 pr-4 text-sm outline-none focus:ring-1 focus:ring-secondary/50 focus:border-secondary border border-transparent"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {availableStudents.filter(s => s.full_name?.toLowerCase().includes(searchStudent.toLowerCase())).length === 0 ? (
                <div className="text-center text-sm text-slate-400 py-10">Nenhuma aluna ativa encontrada fora da turma.</div>
              ) : (
                <div className="space-y-1">
                  {availableStudents.filter(s => s.full_name?.toLowerCase().includes(searchStudent.toLowerCase())).map(s => (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        {s.photo_url ? (
                          <img src={s.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs">
                            {s.full_name?.substring(0,2).toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm font-semibold text-primary">{s.full_name}</span>
                      </div>
                      <button onClick={() => handleEnrollStudent(s.id)} disabled={saving} className="text-xs font-bold text-secondary bg-secondary/10 px-3 py-1.5 rounded-full hover:bg-secondary/20 transition-colors disabled:opacity-50">
                        Adicionar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
