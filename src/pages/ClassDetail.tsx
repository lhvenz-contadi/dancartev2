import React, { useState, useEffect } from 'react';
import {
  ChevronLeft, Loader2, Save, Users, Trash2, Plus, X, Search, Clock,
  MoreVertical, Power, Pencil,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { useConfigOptions } from '../lib/useConfigOptions';
import { WEEKDAY_SHORT, fmtTime, fmtDateBR } from '../lib/format';
import { getInitials, hashColor } from '../lib/colors';
import { FAB } from '../components/ui/FAB';
import { BottomSheet } from '../components/ui/BottomSheet';
import { ListCard } from '../components/ui/ListCard';

interface ClassDetailProps {
  classId: string;
  onBack: () => void;
}

const WEEKDAY_LETTER = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const LEVELS = ['Iniciante', 'Intermediário', 'Avançado', 'Pré-profissional', 'Livre'];

const inputClass =
  'w-full h-11 rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-3.5 text-base outline-none transition-all placeholder-slate-300';
const labelClass = 'block text-[13px] font-bold text-primary mb-1.5';

export const ClassDetail = ({ classId, onBack }: ClassDetailProps) => {
  const [activeTab, setActiveTab] = useState<'dados' | 'alunas'>('dados');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { options: modalities } = useConfigOptions('modality');

  const [formData, setFormData] = useState({
    name: '', modality: '', level: '', teacher: '', room: '',
    max_capacity: '20', min_age: '', max_age: '', is_active: true,
  });

  const [schedules, setSchedules] = useState<
    { id: string; weekday: number; start_time: string; end_time: string }[]
  >([]);
  const [newScheduleDays, setNewScheduleDays] = useState<number[]>([]);
  const [newStartTime, setNewStartTime] = useState('08:00');
  const [newEndTime, setNewEndTime] = useState('09:00');

  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [availableStudents, setAvailableStudents] = useState<any[]>([]);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [searchStudent, setSearchStudent] = useState('');

  const [showActions, setShowActions] = useState(false);
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
      .select('id, full_name, photo_url, plan')
      .eq('status', 'Ativo');

    const enrolledIds = enrolledStudents.map(e => e.student_id);
    const available = (allStudents ?? []).filter(s => !enrolledIds.includes(s.id));
    setAvailableStudents(available);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

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

  const handleToggleActive = async () => {
    setShowActions(false);
    const next = !formData.is_active;
    setSaving(true);
    try {
      await supabase.from('classes').update({ is_active: next }).eq('id', classId);
      setFormData(p => ({ ...p, is_active: next }));
      showToast(next ? 'Turma ativada' : 'Turma desativada');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClass = async () => {
    setShowActions(false);
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
      const { error } = await supabase
        .from('class_students')
        .upsert({ class_id: classId, student_id: studentId, owner_id: user?.id, status: 'active' }, { onConflict: 'class_id, student_id' });
      if (error) throw error;
      await loadEnrolledStudents();
      setAvailableStudents(prev => prev.filter(s => s.id !== studentId));
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

  const filteredAvailable = availableStudents.filter(s =>
    s.full_name?.toLowerCase().includes(searchStudent.toLowerCase()),
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 text-slate-300">
      <Loader2 size={36} className="animate-spin mb-3" />
      <p>Carregando dados da turma...</p>
    </div>
  );

  return (
    <div className="max-w-[900px] mx-auto pb-28 md:pb-12">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5 md:mb-8">
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar"
          className="w-10 h-10 -ml-2 flex items-center justify-center text-slate-400 hover:text-secondary rounded-full"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg md:text-2xl font-bold text-primary leading-tight truncate">
            {formData.name || 'Detalhe da turma'}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn(
              'text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border',
              formData.is_active
                ? 'bg-green-100/50 text-green-600 border-green-200/50'
                : 'bg-slate-100 text-slate-400 border-slate-200',
            )}>
              {formData.is_active ? 'Ativa' : 'Inativa'}
            </span>
            {formData.modality && (
              <span className="text-[10px] font-bold text-slate-500 truncate">{formData.modality}</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowActions(true)}
          aria-label="Mais ações"
          className="w-10 h-10 -mr-2 flex items-center justify-center text-slate-400 hover:text-primary rounded-full"
        >
          <MoreVertical size={20} />
        </button>
      </div>

      {toast && (
        <div className={cn(
          'fixed top-4 inset-x-4 md:inset-x-auto md:right-4 md:left-auto z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-bold flex items-center gap-2',
          toast.type === 'success' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-500 border-red-200',
        )}>
          {toast.msg}
        </div>
      )}

      {/* Tabs */}
      <div
        className="flex overflow-x-auto border-b border-slate-200 mb-5 md:mb-8 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('dados')}
          style={{ scrollSnapAlign: 'center' }}
          className={cn(
            'min-h-12 px-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap shrink-0',
            activeTab === 'dados' ? 'border-primary text-primary' : 'border-transparent text-slate-500',
          )}
        >
          Dados da turma
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('alunas')}
          style={{ scrollSnapAlign: 'center' }}
          className={cn(
            'min-h-12 px-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-2',
            activeTab === 'alunas' ? 'border-primary text-primary' : 'border-transparent text-slate-500',
          )}
        >
          Alunas matriculadas
          <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded-full">
            {enrolledStudents.length}
          </span>
        </button>
      </div>

      {activeTab === 'dados' ? (
        <form onSubmit={handleSaveData} className="space-y-4 md:space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600 font-medium">
              {error}
            </div>
          )}

          {/* Informações básicas */}
          <div className="bg-white rounded-2xl md:rounded-[20px] p-5 md:p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-slate-50">
            <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider mb-5">
              Informações básicas
            </h3>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>
                  Nome da turma <span className="text-red-500">*</span>
                </label>
                <input required name="name" value={formData.name} onChange={handleChange} className={inputClass} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <label className={labelClass}>Modalidade</label>
                  <select
                    name="modality"
                    value={formData.modality}
                    onChange={handleChange}
                    className={cn(inputClass, 'bg-white text-slate-600 cursor-pointer')}
                  >
                    <option value="">Sem modalidade</option>
                    {modalities.map(m => (
                      <option key={m.id} value={m.label}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Nível</label>
                  <select
                    name="level"
                    value={formData.level}
                    onChange={handleChange}
                    className={cn(inputClass, 'bg-white text-slate-600 cursor-pointer')}
                  >
                    <option value="">Selecione...</option>
                    {LEVELS.map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Professor(a)</label>
                  <input name="teacher" value={formData.teacher} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Sala / Local</label>
                  <input name="room" value={formData.room} onChange={handleChange} className={inputClass} />
                </div>
              </div>
            </div>
          </div>

          {/* Capacidade */}
          <div className="bg-white rounded-2xl md:rounded-[20px] p-5 md:p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-slate-50">
            <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider mb-5">
              Capacidade
            </h3>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>
                  Capacidade máxima <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  name="max_capacity"
                  type="number"
                  inputMode="numeric"
                  value={formData.max_capacity}
                  onChange={handleChange}
                  min="1"
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <label className={labelClass}>Idade mínima</label>
                  <input
                    name="min_age"
                    type="number"
                    inputMode="numeric"
                    value={formData.min_age}
                    onChange={handleChange}
                    placeholder="—"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Idade máxima</label>
                  <input
                    name="max_age"
                    type="number"
                    inputMode="numeric"
                    value={formData.max_age}
                    onChange={handleChange}
                    placeholder="—"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={formData.is_active}
              onClick={() => setFormData(p => ({ ...p, is_active: !p.is_active }))}
              className="w-full min-h-11 flex items-center gap-3 mt-6 pt-5 border-t border-slate-100 cursor-pointer text-left"
            >
              <span
                aria-hidden
                className={cn(
                  'relative inline-flex h-7 w-12 items-center rounded-full transition-colors shrink-0',
                  formData.is_active ? 'bg-secondary' : 'bg-slate-300',
                )}
              >
                <span
                  className={cn(
                    'inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm',
                    formData.is_active ? 'translate-x-6' : 'translate-x-1',
                  )}
                />
              </span>
              <span className="text-sm font-semibold text-primary">Turma ativa</span>
            </button>
          </div>

          {/* Horários */}
          <div className="bg-white rounded-2xl md:rounded-[20px] p-5 md:p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-slate-50">
            <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider mb-5">
              Horários da turma
            </h3>

            {schedules.length > 0 && (
              <div className="mb-5 space-y-2">
                {schedules.sort((a, b) => a.weekday - b.weekday).map(s => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Clock size={16} className="text-slate-400 shrink-0" />
                      <span className="text-sm font-bold text-primary shrink-0">{WEEKDAY_SHORT[s.weekday]}</span>
                      <span className="text-sm text-slate-500 truncate">
                        {fmtTime(s.start_time)} – {fmtTime(s.end_time)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteSchedule(s.id)}
                      disabled={saving}
                      aria-label="Remover horário"
                      className="w-10 h-10 -mr-2 flex items-center justify-center text-slate-400 hover:text-red-500 rounded-full shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Adicionar Horário */}
            <div className="border border-slate-200 rounded-xl p-4 md:p-5 bg-slate-50">
              <h4 className="text-[13px] font-bold text-primary mb-3">Adicionar horário</h4>
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-4">
                {WEEKDAY_LETTER.map((letter, idx) => {
                  const active = newScheduleDays.includes(idx);
                  return (
                    <button
                      key={idx}
                      type="button"
                      aria-pressed={active}
                      aria-label={WEEKDAY_SHORT[idx]}
                      onClick={() =>
                        setNewScheduleDays(p => (p.includes(idx) ? p.filter(d => d !== idx) : [...p, idx]))
                      }
                      className={cn(
                        'min-h-12 rounded-xl text-sm font-bold transition-all active:scale-95',
                        active
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-white text-slate-700 border border-slate-200 hover:border-secondary/50',
                      )}
                    >
                      <span className="sm:hidden">{letter}</span>
                      <span className="hidden sm:inline">{WEEKDAY_SHORT[idx]}</span>
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Início</label>
                  <input
                    type="time"
                    value={newStartTime}
                    onChange={e => setNewStartTime(e.target.value)}
                    className={cn(inputClass, 'bg-white')}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Fim</label>
                  <input
                    type="time"
                    value={newEndTime}
                    onChange={e => setNewEndTime(e.target.value)}
                    className={cn(inputClass, 'bg-white')}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddSchedule}
                disabled={saving || newScheduleDays.length === 0}
                className="mt-3 w-full sm:w-auto min-h-11 px-5 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-700 disabled:opacity-50 transition-colors"
              >
                Adicionar
              </button>
            </div>
          </div>

          {/* Save bar */}
          <div
            className="
              fixed inset-x-0 bottom-0 z-30
              bg-white/95 backdrop-blur border-t border-slate-100
              px-4 pt-3
              pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]
              flex justify-end gap-3
              md:static md:bg-transparent md:backdrop-blur-none md:border-0 md:p-0 md:pt-4
            "
          >
            <button
              type="submit"
              disabled={saving}
              className="min-h-11 w-full md:w-auto px-6 bg-secondary text-white rounded-full font-bold hover:bg-primary transition-all text-sm shadow-md shadow-secondary/20 inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Salvar alterações
            </button>
          </div>
        </form>
      ) : (
        /* Aba Alunas */
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base md:text-lg font-bold text-primary">Alunas matriculadas</h3>
              <p className="text-xs md:text-sm text-slate-500 mt-0.5">
                Ocupação: <span className="font-bold text-primary">{enrolledStudents.length} / {formData.max_capacity}</span> vagas
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenAddStudent}
              className="hidden md:inline-flex items-center gap-2 min-h-11 px-4 bg-secondary text-white rounded-full font-bold hover:bg-primary transition-all text-sm shadow-md shadow-secondary/20"
            >
              <Plus size={16} strokeWidth={3} />
              Adicionar aluna
            </button>
          </div>

          {enrolledStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-100">
              <Users size={40} className="mb-3 opacity-30" />
              <p className="font-medium">Nenhuma aluna matriculada nesta turma.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {enrolledStudents.map(e => {
                const photo = e.students?.photo_url;
                const name = e.students?.full_name ?? '—';
                const avatar = photo ? (
                  <img src={photo} alt="" className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className={cn(
                    'w-12 h-12 rounded-full text-white flex items-center justify-center font-bold text-sm',
                    hashColor(e.student_id ?? name),
                  )}>
                    {getInitials(name)}
                  </div>
                );

                return (
                  <ListCard
                    key={e.id}
                    avatar={avatar}
                    title={name}
                    subtitle={
                      <div className="flex items-center gap-2 flex-wrap">
                        {e.students?.plan && (
                          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[11px] font-bold">
                            {e.students.plan}
                          </span>
                        )}
                        {e.enrolled_at && (
                          <span className="text-xs text-slate-400">Desde {fmtDateBR(e.enrolled_at)}</span>
                        )}
                      </div>
                    }
                    meta={
                      <button
                        type="button"
                        onClick={() => handleUnenrollStudent(e.student_id)}
                        disabled={saving}
                        className="min-h-10 px-3 text-xs font-bold text-red-500 bg-red-50 rounded-full hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        Remover
                      </button>
                    }
                  />
                );
              })}
            </div>
          )}

          <FAB
            icon={<Plus size={24} strokeWidth={3} />}
            onClick={handleOpenAddStudent}
            label="Adicionar aluna à turma"
          />
        </div>
      )}

      {/* Actions BottomSheet (kebab) */}
      <BottomSheet
        open={showActions}
        onClose={() => setShowActions(false)}
        title="Ações da turma"
      >
        <div className="space-y-1 pb-2">
          <button
            type="button"
            onClick={() => { setShowActions(false); setActiveTab('dados'); }}
            className="w-full min-h-12 flex items-center gap-3 px-3 rounded-xl hover:bg-slate-50 text-left text-sm font-semibold text-primary"
          >
            <Pencil size={18} className="text-slate-500" /> Editar dados
          </button>
          <button
            type="button"
            onClick={handleToggleActive}
            className="w-full min-h-12 flex items-center gap-3 px-3 rounded-xl hover:bg-slate-50 text-left text-sm font-semibold text-primary"
          >
            <Power size={18} className="text-slate-500" />
            {formData.is_active ? 'Desativar turma' : 'Ativar turma'}
          </button>
          <button
            type="button"
            onClick={handleDeleteClass}
            className="w-full min-h-12 flex items-center gap-3 px-3 rounded-xl hover:bg-red-50 text-left text-sm font-semibold text-red-600"
          >
            <Trash2 size={18} /> Excluir turma
          </button>
        </div>
      </BottomSheet>

      {/* Add student BottomSheet (mobile-first, also works on desktop) */}
      <BottomSheet
        open={showAddStudent}
        onClose={() => { setShowAddStudent(false); setSearchStudent(''); }}
        title="Matricular aluna"
        maxHeight="90dvh"
      >
        <div className="sticky top-0 -mx-5 -mt-4 px-5 pt-1 pb-3 bg-white border-b border-slate-100">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar aluna..."
              value={searchStudent}
              onChange={e => setSearchStudent(e.target.value)}
              className="w-full h-11 bg-slate-50 rounded-xl pl-10 pr-4 text-base outline-none focus:ring-1 focus:ring-secondary/50 border border-transparent"
            />
          </div>
        </div>

        {filteredAvailable.length === 0 ? (
          <div className="text-center text-sm text-slate-400 py-10">
            Nenhuma aluna ativa disponível.
          </div>
        ) : (
          <div className="space-y-1.5 pt-3">
            {filteredAvailable.map(s => {
              const avatar = s.photo_url ? (
                <img src={s.photo_url} alt="" className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className={cn(
                  'w-12 h-12 rounded-full text-white flex items-center justify-center font-bold text-sm',
                  hashColor(s.id ?? s.full_name),
                )}>
                  {getInitials(s.full_name ?? '')}
                </div>
              );
              return (
                <ListCard
                  key={s.id}
                  avatar={avatar}
                  title={s.full_name}
                  subtitle={s.plan ? <span className="text-xs text-slate-500">{s.plan}</span> : null}
                  meta={
                    <button
                      type="button"
                      onClick={() => handleEnrollStudent(s.id)}
                      disabled={saving}
                      className="min-h-10 px-3 text-xs font-bold text-secondary bg-secondary/10 rounded-full hover:bg-secondary/20 transition-colors disabled:opacity-50"
                    >
                      Matricular
                    </button>
                  }
                />
              );
            })}
          </div>
        )}
      </BottomSheet>
    </div>
  );
};
