import React, { useState } from 'react';
import { ChevronLeft, Loader2, Save, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { useConfigOptions } from '../lib/useConfigOptions';
import { WEEKDAY_SHORT } from '../lib/format';

const WEEKDAY_LETTER = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const LEVELS = ['Iniciante', 'Intermediário', 'Avançado', 'Pré-profissional', 'Livre'];

type DaySchedule = { weekday: number; start_time: string; end_time: string };

const inputClass =
  'w-full h-11 rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-3.5 text-base outline-none transition-all placeholder-slate-300';

const labelClass = 'block text-[13px] font-bold text-primary mb-1.5';

export const NewClassForm = ({ onCancel }: { onCancel: () => void }) => {
  const { options: modalities } = useConfigOptions('modality');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    modality: '',
    level: '',
    teacher: '',
    room: '',
    max_capacity: '20',
    min_age: '',
    max_age: '',
    is_active: true,
  });
  const [schedules, setSchedules] = useState<DaySchedule[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const toggleDay = (weekday: number) => {
    setSchedules(prev => {
      if (prev.some(s => s.weekday === weekday)) {
        return prev.filter(s => s.weekday !== weekday);
      }
      return [...prev, { weekday, start_time: '08:00', end_time: '09:00' }].sort(
        (a, b) => a.weekday - b.weekday,
      );
    });
  };

  const updateScheduleTime = (
    weekday: number,
    field: 'start_time' | 'end_time',
    value: string,
  ) => {
    setSchedules(prev =>
      prev.map(s => (s.weekday === weekday ? { ...s, [field]: value } : s)),
    );
  };

  const removeDay = (weekday: number) => {
    setSchedules(prev => prev.filter(s => s.weekday !== weekday));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    if (schedules.length === 0) {
      setError('Selecione ao menos um dia da semana.');
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { data: classData, error: classError } = await supabase
        .from('classes')
        .insert({
          owner_id: user.id,
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
        .select('id')
        .single();

      if (classError) throw classError;

      const scheduleInserts = schedules.map(s => ({
        class_id: classData.id,
        weekday: s.weekday,
        start_time: s.start_time,
        end_time: s.end_time,
      }));

      const { error: schedError } = await supabase
        .from('class_schedules')
        .insert(scheduleInserts);

      if (schedError) throw schedError;

      onCancel();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar turma.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-[900px] mx-auto pb-28 md:pb-12">
      <div className="flex items-center gap-3 mb-6 md:mb-8">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Voltar"
          className="w-10 h-10 -ml-2 flex items-center justify-center text-slate-400 hover:text-secondary transition-colors rounded-full"
        >
          <ChevronLeft size={24} />
        </button>
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-primary leading-tight">Nova turma</h2>
          <p className="text-[13px] text-slate-400 mt-0.5">
            Preencha os dados para criar uma nova turma
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600 font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
        {/* IDENTIFICAÇÃO */}
        <div className="bg-white rounded-2xl md:rounded-[20px] p-5 md:p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-slate-50">
          <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider mb-5">
            Identificação
          </h3>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>
                Nome da turma <span className="text-red-500">*</span>
              </label>
              <input
                required
                name="name"
                value={formData.name}
                onChange={handleChange}
                type="text"
                placeholder="Ex: Ballet Infantil - Terça"
                className={inputClass}
              />
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
                    <option key={m.id} value={m.label}>
                      {m.label}
                    </option>
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
                  {LEVELS.map(l => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Professor(a)</label>
                <input
                  name="teacher"
                  value={formData.teacher}
                  onChange={handleChange}
                  type="text"
                  placeholder="Sem professor(a)"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Sala / Local</label>
                <input
                  name="room"
                  value={formData.room}
                  onChange={handleChange}
                  type="text"
                  placeholder="Ex: Estúdio 1"
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </div>

        {/* HORÁRIO */}
        <div className="bg-white rounded-2xl md:rounded-[20px] p-5 md:p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-slate-50">
          <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider mb-5">
            Horário
          </h3>
          <div className="space-y-5">
            <div>
              <label className={cn(labelClass, 'mb-3')}>
                Dias da semana <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {WEEKDAY_LETTER.map((letter, idx) => {
                  const active = schedules.some(s => s.weekday === idx);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleDay(idx)}
                      aria-pressed={active}
                      aria-label={WEEKDAY_SHORT[idx]}
                      className={cn(
                        'min-h-12 rounded-xl text-sm font-bold transition-all active:scale-95',
                        active
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                      )}
                    >
                      <span className="sm:hidden">{letter}</span>
                      <span className="hidden sm:inline">{WEEKDAY_SHORT[idx]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {schedules.length > 0 && (
              <div className="space-y-2.5">
                {schedules.map(s => (
                  <div
                    key={s.weekday}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 sm:p-4"
                  >
                    <div className="flex items-center justify-between gap-3 mb-2.5">
                      <span className="text-sm font-bold text-primary">
                        {WEEKDAY_SHORT[s.weekday]}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeDay(s.weekday)}
                        aria-label={`Remover ${WEEKDAY_SHORT[s.weekday]}`}
                        className="w-10 h-10 -mr-2 flex items-center justify-center text-slate-400 hover:text-red-500 rounded-full active:scale-95 transition-all"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          Início
                        </label>
                        <input
                          required
                          type="time"
                          value={s.start_time}
                          onChange={e =>
                            updateScheduleTime(s.weekday, 'start_time', e.target.value)
                          }
                          className={cn(inputClass, 'bg-white text-slate-700')}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          Término
                        </label>
                        <input
                          required
                          type="time"
                          value={s.end_time}
                          onChange={e =>
                            updateScheduleTime(s.weekday, 'end_time', e.target.value)
                          }
                          className={cn(inputClass, 'bg-white text-slate-700')}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {schedules.length === 0 && (
              <p className="text-sm text-slate-400 italic">
                Selecione ao menos um dia para definir os horários.
              </p>
            )}
          </div>
        </div>

        {/* CAPACIDADE */}
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
                value={formData.max_capacity}
                onChange={handleChange}
                type="number"
                inputMode="numeric"
                min="1"
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <label className={labelClass}>Idade mínima</label>
                <input
                  name="min_age"
                  value={formData.min_age}
                  onChange={handleChange}
                  type="number"
                  inputMode="numeric"
                  min="0"
                  placeholder="—"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Idade máxima</label>
                <input
                  name="max_age"
                  value={formData.max_age}
                  onChange={handleChange}
                  type="number"
                  inputMode="numeric"
                  min="0"
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

        <div
          className="
            fixed inset-x-0 bottom-0 z-30
            bg-white/95 backdrop-blur border-t border-slate-100
            px-4 pt-3
            pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]
            flex items-center justify-end gap-3
            md:static md:bg-transparent md:backdrop-blur-none md:border-0 md:p-0 md:pt-4
          "
        >
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 flex-1 md:flex-none px-6 rounded-full border border-slate-200 text-primary font-bold hover:bg-slate-50 transition-colors text-sm"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="min-h-11 flex-1 md:flex-none px-6 bg-secondary text-white rounded-full font-bold hover:bg-primary transition-all text-sm shadow-md shadow-secondary/20 inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" aria-hidden />
            ) : (
              <Save size={16} aria-hidden />
            )}
            {saving ? 'Salvando...' : 'Criar turma'}
          </button>
        </div>
      </form>
    </div>
  );
};
