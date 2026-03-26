import React, { useState } from 'react';
import { ChevronLeft, Camera, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useConfigOptions } from '../lib/useConfigOptions';

export const NewStudentForm = ({ onCancel }: { onCancel: () => void }) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { options: planOptions } = useConfigOptions('plan');
  const { options: channelOptions } = useConfigOptions('acquisition_channel');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
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
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');

      let photo_url: string | null = null;

      // Upload photo if selected
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
            .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year
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
      <div className="max-w-[600px] mx-auto text-center py-24 flex flex-col items-center">
        <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-6">
          <CheckCircle size={40} className="text-green-500" />
        </div>
        <h2 className="text-2xl font-black text-primary mb-2">Aluna cadastrada!</h2>
        <p className="text-slate-400 mb-8">O cadastro foi salvo com sucesso no sistema.</p>
        <div className="flex gap-4">
          <button
            onClick={onCancel}
            className="px-6 py-3 bg-secondary text-white rounded-full font-bold hover:bg-primary transition-all shadow-md shadow-secondary/20"
          >
            Ver lista de alunos
          </button>
          <button
            onClick={() => { setSuccess(false); setFormData({ full_name: '', birth_date: '', cpf: '', phone: '', whatsapp: '', email: '', cep: '', street: '', number: '', neighborhood: '', city: '', state: '', enrollment_date: '', plan: '', custom_value: '', due_day: '', acquisition_channel: '', status: 'Ativo', medical_notes: '', general_notes: '' }); setPhotoFile(null); setPhotoPreview(null); }}
            className="px-6 py-3 border border-slate-200 text-primary rounded-full font-bold hover:bg-slate-50 transition-all"
          >
            Cadastrar outra
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1000px] mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onCancel} className="text-slate-400 hover:text-secondary transition-colors">
          <ChevronLeft size={24} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-primary">Nova aluna</h2>
          <p className="text-accent text-[13px] mt-0.5">Preencha os dados para cadastrar uma nova aluna</p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600 font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* DADOS PESSOAIS */}
        <div className="bg-white rounded-[20px] p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-slate-50">
          <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider mb-6">Dados Pessoais</h3>

          <div className="flex flex-col md:flex-row gap-8">
            {/* Foto */}
            <div className="flex flex-col items-center gap-3 w-32 shrink-0">
              <div className="w-24 h-24 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-300 relative group overflow-hidden cursor-pointer hover:border-secondary hover:bg-secondary/5 transition-all">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Camera size={28} className="group-hover:scale-110 transition-transform group-hover:text-secondary" />
                )}
                <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={handlePhotoChange} />
              </div>
              <span className="text-[11px] text-accent text-center font-medium">Adicionar foto</span>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <div>
                <label className="block text-[13px] font-bold text-primary mb-1.5">Nome completo <span className="text-red-500">*</span></label>
                <input required name="full_name" value={formData.full_name} onChange={handleChange} type="text" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none transition-all" />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-primary mb-1.5">Data de nascimento</label>
                <input name="birth_date" value={formData.birth_date} onChange={handleChange} type="date" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none transition-all text-slate-500" />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-primary mb-1.5">CPF</label>
                <input name="cpf" value={formData.cpf} onChange={handleChange} type="text" placeholder="000.000.000-00" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none transition-all placeholder-slate-300 font-medium" />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-primary mb-1.5">Telefone</label>
                <input name="phone" value={formData.phone} onChange={handleChange} type="tel" placeholder="(51) 99999-9999" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none transition-all placeholder-slate-300 font-medium" />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-primary mb-1.5">WhatsApp</label>
                <input name="whatsapp" value={formData.whatsapp} onChange={handleChange} type="tel" placeholder="(51) 99999-9999" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none transition-all placeholder-slate-300 font-medium" />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-primary mb-1.5">E-mail</label>
                <input name="email" value={formData.email} onChange={handleChange} type="email" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none transition-all" />
              </div>
            </div>
          </div>
        </div>

        {/* RESPONSÁVEL (para menores) */}
        <div className="bg-white rounded-[20px] p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-slate-50">
          <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider mb-6">Responsável (Caso seja menor de idade)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-5">
            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">Nome do responsável</label>
              <input name="responsible_name" value={formData.responsible_name} onChange={handleChange} type="text" placeholder="Nome completo" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none transition-all" />
            </div>
            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">CPF do responsável</label>
              <input name="responsible_cpf" value={formData.responsible_cpf} onChange={handleChange} type="text" placeholder="000.000.000-00" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none transition-all placeholder-slate-300 font-medium" />
            </div>
            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">Telefone do responsável</label>
              <input name="responsible_phone" value={formData.responsible_phone} onChange={handleChange} type="tel" placeholder="(51) 99999-9999" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none transition-all placeholder-slate-300 font-medium" />
            </div>
          </div>
        </div>

        {/* ENDEREÇO */}
        <div className="bg-white rounded-[20px] p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-slate-50">
          <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider mb-6">Endereço</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">CEP</label>
              <input name="cep" value={formData.cep} onChange={handleChange} type="text" placeholder="00000-000" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none transition-all placeholder-slate-300 font-medium" />
            </div>
            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">Rua / Logradouro</label>
              <input name="street" value={formData.street} onChange={handleChange} type="text" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none transition-all" />
            </div>
            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">Número</label>
              <input name="number" value={formData.number} onChange={handleChange} type="text" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none transition-all" />
            </div>
            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">Bairro</label>
              <input name="neighborhood" value={formData.neighborhood} onChange={handleChange} type="text" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none transition-all" />
            </div>
            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">Cidade</label>
              <input name="city" value={formData.city} onChange={handleChange} type="text" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none transition-all" />
            </div>
            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">Estado</label>
              <input name="state" value={formData.state} onChange={handleChange} type="text" placeholder="RS" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none transition-all placeholder-slate-300 font-medium" />
            </div>
          </div>
        </div>

        {/* MATRÍCULA */}
        <div className="bg-white rounded-[20px] p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-slate-50">
          <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider mb-6">Matrícula</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">Data de matrícula</label>
              <input name="enrollment_date" value={formData.enrollment_date} onChange={handleChange} type="date" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none transition-all text-slate-500" />
            </div>
            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">Plano</label>
              <select name="plan" value={formData.plan} onChange={handleChange} className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm text-slate-600 bg-white outline-none transition-all cursor-pointer">
                <option value="">Selecione um plano...</option>
                {planOptions.map(p => <option key={p.id} value={p.label}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">Valor personalizado (R$)</label>
              <input name="custom_value" value={formData.custom_value} onChange={handleChange} type="number" step="0.01" placeholder="Deixe em branco para usar o plano" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none transition-all placeholder-slate-300" />
            </div>
            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">Dia do vencimento</label>
              <input name="due_day" value={formData.due_day} onChange={handleChange} type="number" min="1" max="31" placeholder="10" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none transition-all placeholder-slate-300 font-medium" />
            </div>
            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">Como nos conheceu</label>
              <select name="acquisition_channel" value={formData.acquisition_channel} onChange={handleChange} className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm text-slate-600 bg-white outline-none transition-all cursor-pointer">
                <option value="">Selecione...</option>
                {channelOptions.map(c => <option key={c.id} value={c.label}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">Status</label>
              <select name="status" value={formData.status} onChange={handleChange} className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm text-slate-600 bg-white outline-none transition-all cursor-pointer">
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
              </select>
            </div>
          </div>
        </div>

        {/* OBSERVAÇÕES */}
        <div className="bg-white rounded-[20px] p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-slate-50">
          <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider mb-6">Observações</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">Observações médicas / restrições</label>
              <textarea name="medical_notes" value={formData.medical_notes} onChange={handleChange} rows={3} className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-3 text-sm resize-none outline-none transition-all"></textarea>
            </div>
            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">Observações gerais</label>
              <textarea name="general_notes" value={formData.general_notes} onChange={handleChange} rows={3} className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-3 text-sm resize-none outline-none transition-all"></textarea>
            </div>
          </div>
        </div>

        {/* FOOTER BUTTONS */}
        <div className="flex justify-end items-center gap-4 pt-4">
          <button type="button" onClick={onCancel} className="px-6 py-2 rounded-full border border-slate-200 text-primary font-bold hover:bg-slate-50 transition-colors text-sm">
            Cancelar
          </button>
          <button type="submit" disabled={loading} className="px-6 py-2.5 bg-secondary text-white rounded-full font-bold hover:bg-primary transition-all text-sm shadow-md shadow-secondary/20 flex items-center gap-2 disabled:opacity-60">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Salvando...' : 'Cadastrar aluna'}
          </button>
        </div>
      </form>
    </div>
  );
};
