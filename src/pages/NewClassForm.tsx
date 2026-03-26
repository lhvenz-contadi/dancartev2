import React, { useState } from 'react';
import { ChevronLeft, Loader2, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { useConfigOptions } from '../lib/useConfigOptions';

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
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('09:00');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    if (selectedDays.length === 0) {
      setError('Selecione ao menos um dia da semana.');
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      // Insert the class
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

      // Insert schedule entries for each selected day
      const scheduleInserts = selectedDays.map(weekday => ({
        class_id: classData.id,
        weekday,
        start_time: startTime,
        end_time: endTime,
      }));

      const { error: schedError } = await supabase
        .from('class_schedules')
        .insert(scheduleInserts);

      if (schedError) throw schedError;

      onCancel(); // Go back to list
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar turma.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-[900px] mx-auto space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <button onClick={onCancel} className="text-slate-400 hover:text-secondary transition-colors">
          <ChevronLeft size={24} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-primary leading-tight">Nova turma</h2>
          <p className="text-[13px] text-slate-400 mt-0.5">Preencha os dados para criar uma nova turma</p>
        </div>
      </div>

      {error && <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600 font-medium">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* IDENTIFICAÇÃO */}
        <div className="bg-white rounded-[20px] p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-slate-50">
          <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider mb-6">Identificação</h3>
          <div className="space-y-5">
            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">Nome da turma <span className="text-red-500">*</span></label>
              <input
                required
                name="name"
                value={formData.name}
                onChange={handleChange}
                type="text"
                placeholder="Ex: Ballet Infantil - Terça"
                className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none transition-all"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <div>
                <label className="block text-[13px] font-bold text-primary mb-1.5">Modalidade</label>
                <select
                  name="modality"
                  value={formData.modality}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none bg-white text-slate-600 cursor-pointer"
                >
                  <option value="">Sem modalidade</option>
                  {modalities.map(m => <option key={m.id} value={m.label}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-bold text-primary mb-1.5">Nível</label>
                <select
                  name="level"
                  value={formData.level}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none bg-white text-slate-600 cursor-pointer"
                >
                  <option value="">Selecione...</option>
                  {LEVELS.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">Professor(a)</label>
              <input
                name="teacher"
                value={formData.teacher}
                onChange={handleChange}
                type="text"
                placeholder="Sem professor(a)"
                className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* HORÁRIO */}
        <div className="bg-white rounded-[20px] p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-slate-50">
          <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider mb-6">Horário</h3>
          <div className="space-y-5">
            <div>
              <label className="block text-[13px] font-bold text-primary mb-3">Dias da semana <span className="text-red-500">*</span></label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map(wd => (
                  <button
                    key={wd.value}
                    type="button"
                    onClick={() => toggleDay(wd.value)}
                    className={cn(
                      'px-4 py-2 rounded-full text-sm font-semibold border transition-all',
                      selectedDays.includes(wd.value)
                        ? 'bg-secondary text-white border-secondary'
                        : 'bg-white text-primary border-slate-200 hover:border-secondary/50'
                    )}
                  >
                    {wd.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[13px] font-bold text-primary mb-1.5">Início <span className="text-red-500">*</span></label>
                <input
                  required
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none text-slate-600"
                />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-primary mb-1.5">Término <span className="text-red-500">*</span></label>
                <input
                  required
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none text-slate-600"
                />
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">Sala / Local</label>
              <input
                name="room"
                value={formData.room}
                onChange={handleChange}
                type="text"
                placeholder="Ex: Estúdio 1"
                className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none transition-all placeholder-slate-300"
              />
            </div>
          </div>
        </div>

        {/* CAPACIDADE */}
        <div className="bg-white rounded-[20px] p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-slate-50">
          <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider mb-6">Capacidade</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">Capacidade máxima <span className="text-red-500">*</span></label>
              <input
                required
                name="max_capacity"
                value={formData.max_capacity}
                onChange={handleChange}
                type="number"
                min="1"
                className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none"
              />
            </div>
            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">Idade mínima</label>
              <input
                name="min_age"
                value={formData.min_age}
                onChange={handleChange}
                type="number"
                min="0"
                placeholder="—"
                className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none placeholder-slate-300"
              />
            </div>
            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">Idade máxima</label>
              <input
                name="max_age"
                value={formData.max_age}
                onChange={handleChange}
                type="number"
                min="0"
                placeholder="—"
                className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none placeholder-slate-300"
              />
            </div>
          </div>

          {/* Toggle active */}
          <div className="flex items-center gap-3 mt-6 pt-6 border-t border-slate-50">
            <button
              type="button"
              onClick={() => setFormData(p => ({ ...p, is_active: !p.is_active }))}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                formData.is_active ? 'bg-secondary' : 'bg-slate-300'
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  formData.is_active ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
            <span className="text-sm font-semibold text-primary">Turma ativa</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end items-center gap-4 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 rounded-full border border-slate-200 text-primary font-bold hover:bg-slate-50 transition-colors text-sm"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-secondary text-white rounded-full font-bold hover:bg-primary transition-all text-sm shadow-md shadow-secondary/20 flex items-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Salvando...' : 'Criar turma'}
          </button>
        </div>
      </form>
    </div>
  );
};
