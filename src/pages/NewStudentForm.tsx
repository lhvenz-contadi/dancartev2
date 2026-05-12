import React, { useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronDown, Camera, Loader2, CheckCircle, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useConfigOptions } from '../lib/useConfigOptions';
import { cn } from '../lib/utils';

type SectionKey = 'personal' | 'address' | 'plan' | 'responsible' | 'notes' | 'photo';

const initialFormData = {
  full_name: '',
  birth_date: '',
  cpf: '',
  phone: '',
  whatsapp: '',
  email: '',
  cep: '',
  street: '',
  number: '',
  neighborhood: '',
  city: '',
  state: '',
  enrollment_date: '',
  plan: '',
  custom_value: '',
  due_day: '',
  acquisition_channel: '',
  status: 'Ativo',
  responsible_name: '',
  responsible_cpf: '',
  responsible_phone: '',
  medical_notes: '',
  general_notes: '',
};

const inputClass =
  'w-full h-11 rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-3.5 text-base outline-none transition-all placeholder-slate-300';

const labelClass = 'block text-[13px] font-bold text-primary mb-1.5';

interface SectionProps {
  sectionKey: SectionKey;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  hasError?: boolean;
  children: ReactNode;
}

const Section = ({ title, isOpen, onToggle, hasError, children }: SectionProps) => (
  <div
    className={cn(
      'bg-white rounded-2xl md:rounded-[20px] shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-slate-50 overflow-hidden',
      hasError && 'border-l-4 border-l-red-500',
    )}
  >
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between gap-3 px-5 py-4 md:px-8 md:pt-7 md:pb-2 md:cursor-default"
      aria-expanded={isOpen}
    >
      <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider flex items-center gap-2 text-left">
        {title}
        {hasError && <span className="w-2 h-2 rounded-full bg-red-500" aria-hidden />}
      </h3>
      <ChevronDown
        size={18}
        className={cn(
          'text-slate-400 transition-transform shrink-0 md:hidden',
          isOpen && 'rotate-180',
        )}
        aria-hidden
      />
    </button>
    <div
      className={cn(
        'grid transition-[grid-template-rows] duration-200 ease-out md:grid-rows-[1fr]',
        isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      )}
    >
      <div className="overflow-hidden">
        <div className="px-5 pb-5 md:px-8 md:pb-8">{children}</div>
      </div>
    </div>
  </div>
);

export const NewStudentForm = ({ onCancel }: { onCancel: () => void }) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { options: planOptions } = useConfigOptions('plan');
  const { options: channelOptions } = useConfigOptions('acquisition_channel');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [formData, setFormData] = useState(initialFormData);

  const [openSections, setOpenSections] = useState<Set<SectionKey>>(new Set(['personal']));
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const toggleSection = (key: SectionKey) =>
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const isOpen = (key: SectionKey) => openSections.has(key);

  const personalHasError = attemptedSubmit && !formData.full_name.trim();

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttemptedSubmit(true);

    if (!formData.full_name.trim()) {
      setOpenSections(prev => new Set(prev).add('personal'));
      setError('Informe o nome completo da aluna.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');

      let photo_url: string | null = null;

      if (photoFile) {
        const ext = photoFile.name.split('.').pop();
        const filePath = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('student-photos')
          .upload(filePath, photoFile, { upsert: true });

        if (uploadError) {
          console.warn('Falha ao enviar foto:', uploadError.message);
        } else {
          const { data: signedData } = await supabase.storage
            .from('student-photos')
            .createSignedUrl(filePath, 60 * 60 * 24 * 365);
          photo_url = signedData?.signedUrl ?? null;
        }
      }

      const { error: insertError } = await supabase.from('students').insert({
        full_name: formData.full_name,
        birth_date: formData.birth_date || null,
        cpf: formData.cpf || null,
        phone: formData.phone || null,
        whatsapp: formData.whatsapp || null,
        email: formData.email || null,
        photo_url,
        cep: formData.cep || null,
        street: formData.street || null,
        number: formData.number || null,
        neighborhood: formData.neighborhood || null,
        city: formData.city || null,
        state: formData.state || null,
        enrollment_date: formData.enrollment_date || null,
        plan: formData.plan || null,
        custom_value: formData.custom_value ? parseFloat(formData.custom_value) : null,
        due_day: formData.due_day ? parseInt(formData.due_day) : null,
        acquisition_channel: formData.acquisition_channel || null,
        status: formData.status,
        responsible_name: formData.responsible_name || null,
        responsible_cpf: formData.responsible_cpf || null,
        responsible_phone: formData.responsible_phone || null,
        medical_notes: formData.medical_notes || null,
        general_notes: formData.general_notes || null,
        owner_id: user.id,
      });

      if (insertError) throw insertError;

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao cadastrar aluna.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-[600px] mx-auto text-center py-16 md:py-24 flex flex-col items-center px-4">
        <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-6">
          <CheckCircle size={40} className="text-green-500" />
        </div>
        <h2 className="text-2xl font-black text-primary mb-2">Aluna cadastrada!</h2>
        <p className="text-slate-400 mb-8">O cadastro foi salvo com sucesso no sistema.</p>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button
            onClick={onCancel}
            className="min-h-11 px-6 bg-secondary text-white rounded-full font-bold hover:bg-primary transition-all shadow-md shadow-secondary/20"
          >
            Ver lista de alunos
          </button>
          <button
            onClick={() => {
              setSuccess(false);
              setFormData(initialFormData);
              setPhotoFile(null);
              setPhotoPreview(null);
              setAttemptedSubmit(false);
            }}
            className="min-h-11 px-6 border border-slate-200 text-primary rounded-full font-bold hover:bg-slate-50 transition-all"
          >
            Cadastrar outra
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1000px] mx-auto pb-28 md:pb-12">
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
          <h2 className="text-xl md:text-2xl font-bold text-primary leading-tight">Nova aluna</h2>
          <p className="text-accent text-[13px] mt-0.5">
            Preencha os dados para cadastrar uma nova aluna
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600 font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
        <Section
          sectionKey="personal"
          title="Dados pessoais"
          isOpen={isOpen('personal')}
          onToggle={() => toggleSection('personal')}
          hasError={personalHasError}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <div className="sm:col-span-2">
              <label className={labelClass}>
                Nome completo <span className="text-red-500">*</span>
              </label>
              <input
                required
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                type="text"
                autoComplete="name"
                className={inputClass}
              />
              {personalHasError && (
                <p className="text-red-600 text-sm mt-1">Informe o nome completo.</p>
              )}
            </div>
            <div>
              <label className={labelClass}>Data de nascimento</label>
              <input
                name="birth_date"
                value={formData.birth_date}
                onChange={handleChange}
                type="date"
                className={cn(inputClass, 'text-slate-600')}
              />
            </div>
            <div>
              <label className={labelClass}>CPF</label>
              <input
                name="cpf"
                value={formData.cpf}
                onChange={handleChange}
                type="text"
                inputMode="numeric"
                placeholder="000.000.000-00"
                className={cn(inputClass, 'font-medium')}
              />
            </div>
            <div>
              <label className={labelClass}>Telefone</label>
              <input
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                type="tel"
                autoComplete="tel"
                placeholder="(51) 99999-9999"
                className={cn(inputClass, 'font-medium')}
              />
            </div>
            <div>
              <label className={labelClass}>WhatsApp</label>
              <input
                name="whatsapp"
                value={formData.whatsapp}
                onChange={handleChange}
                type="tel"
                placeholder="(51) 99999-9999"
                className={cn(inputClass, 'font-medium')}
              />
            </div>
            <div>
              <label className={labelClass}>E-mail</label>
              <input
                name="email"
                value={formData.email}
                onChange={handleChange}
                type="email"
                autoComplete="email"
                className={inputClass}
              />
            </div>
          </div>
        </Section>

        <Section
          sectionKey="address"
          title="Endereço"
          isOpen={isOpen('address')}
          onToggle={() => toggleSection('address')}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <label className={labelClass}>CEP</label>
              <input
                name="cep"
                value={formData.cep}
                onChange={handleChange}
                type="text"
                inputMode="numeric"
                placeholder="00000-000"
                className={cn(inputClass, 'font-medium')}
              />
            </div>
            <div>
              <label className={labelClass}>Rua / Logradouro</label>
              <input
                name="street"
                value={formData.street}
                onChange={handleChange}
                type="text"
                autoComplete="street-address"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Número</label>
              <input
                name="number"
                value={formData.number}
                onChange={handleChange}
                type="text"
                inputMode="numeric"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Bairro</label>
              <input
                name="neighborhood"
                value={formData.neighborhood}
                onChange={handleChange}
                type="text"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Cidade</label>
              <input
                name="city"
                value={formData.city}
                onChange={handleChange}
                type="text"
                autoComplete="address-level2"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Estado</label>
              <input
                name="state"
                value={formData.state}
                onChange={handleChange}
                type="text"
                autoComplete="address-level1"
                placeholder="RS"
                className={cn(inputClass, 'font-medium')}
              />
            </div>
          </div>
        </Section>

        <Section
          sectionKey="plan"
          title="Plano e mensalidade"
          isOpen={isOpen('plan')}
          onToggle={() => toggleSection('plan')}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <label className={labelClass}>Data de matrícula</label>
              <input
                name="enrollment_date"
                value={formData.enrollment_date}
                onChange={handleChange}
                type="date"
                className={cn(inputClass, 'text-slate-600')}
              />
            </div>
            <div>
              <label className={labelClass}>Plano</label>
              <select
                name="plan"
                value={formData.plan}
                onChange={handleChange}
                className={cn(inputClass, 'bg-white text-slate-600 cursor-pointer')}
              >
                <option value="">Selecione um plano...</option>
                {planOptions.map(p => (
                  <option key={p.id} value={p.label}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Valor personalizado (R$)</label>
              <input
                name="custom_value"
                value={formData.custom_value}
                onChange={handleChange}
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="Deixe em branco para usar o plano"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Dia do vencimento</label>
              <input
                name="due_day"
                value={formData.due_day}
                onChange={handleChange}
                type="number"
                inputMode="numeric"
                min="1"
                max="31"
                placeholder="10"
                className={cn(inputClass, 'font-medium')}
              />
            </div>
            <div>
              <label className={labelClass}>Como nos conheceu</label>
              <select
                name="acquisition_channel"
                value={formData.acquisition_channel}
                onChange={handleChange}
                className={cn(inputClass, 'bg-white text-slate-600 cursor-pointer')}
              >
                <option value="">Selecione...</option>
                {channelOptions.map(c => (
                  <option key={c.id} value={c.label}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className={cn(inputClass, 'bg-white text-slate-600 cursor-pointer')}
              >
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
              </select>
            </div>
          </div>
        </Section>

        <Section
          sectionKey="responsible"
          title="Responsável (menor de idade)"
          isOpen={isOpen('responsible')}
          onToggle={() => toggleSection('responsible')}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
            <div>
              <label className={labelClass}>Nome do responsável</label>
              <input
                name="responsible_name"
                value={formData.responsible_name}
                onChange={handleChange}
                type="text"
                placeholder="Nome completo"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>CPF do responsável</label>
              <input
                name="responsible_cpf"
                value={formData.responsible_cpf}
                onChange={handleChange}
                type="text"
                inputMode="numeric"
                placeholder="000.000.000-00"
                className={cn(inputClass, 'font-medium')}
              />
            </div>
            <div>
              <label className={labelClass}>Telefone do responsável</label>
              <input
                name="responsible_phone"
                value={formData.responsible_phone}
                onChange={handleChange}
                type="tel"
                placeholder="(51) 99999-9999"
                className={cn(inputClass, 'font-medium')}
              />
            </div>
          </div>
        </Section>

        <Section
          sectionKey="notes"
          title="Observações"
          isOpen={isOpen('notes')}
          onToggle={() => toggleSection('notes')}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <label className={labelClass}>Observações médicas / restrições</label>
              <textarea
                name="medical_notes"
                value={formData.medical_notes}
                onChange={handleChange}
                rows={3}
                className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-3.5 py-2.5 text-base resize-none outline-none transition-all"
              />
            </div>
            <div>
              <label className={labelClass}>Observações gerais</label>
              <textarea
                name="general_notes"
                value={formData.general_notes}
                onChange={handleChange}
                rows={3}
                className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-3.5 py-2.5 text-base resize-none outline-none transition-all"
              />
            </div>
          </div>
        </Section>

        <Section
          sectionKey="photo"
          title="Foto"
          isOpen={isOpen('photo')}
          onToggle={() => toggleSection('photo')}
        >
          <div className="flex flex-col items-center gap-3">
            <label className="cursor-pointer flex flex-col items-center gap-3 min-h-32 active:scale-[0.98] transition-transform">
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-slate-50 border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-300 overflow-hidden hover:border-secondary hover:bg-secondary/5 transition-all">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Pré-visualização da foto"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Camera size={32} aria-hidden />
                )}
              </div>
              <span className="text-sm text-accent font-medium">
                {photoPreview ? 'Trocar foto' : 'Adicionar foto'}
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={handlePhotoChange}
              />
            </label>
            {photoPreview && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="min-h-10 px-3 inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-700"
              >
                <Trash2 size={14} aria-hidden /> Remover
              </button>
            )}
          </div>
        </Section>

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
            disabled={loading}
            className="min-h-11 flex-1 md:flex-none px-6 bg-secondary text-white rounded-full font-bold hover:bg-primary transition-all text-sm shadow-md shadow-secondary/20 inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 size={16} className="animate-spin" aria-hidden />}
            {loading ? 'Salvando...' : 'Cadastrar aluna'}
          </button>
        </div>
      </form>
    </div>
  );
};
