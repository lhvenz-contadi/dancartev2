import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, GripVertical, Settings2, Music, Receipt, CreditCard, Megaphone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

interface ConfigOption {
  id: string;
  category: string;
  label: string;
  sort_order: number;
  is_active: boolean;
}

const CATEGORIES = [
  { key: 'modality', label: 'Modalidades', icon: Music, description: 'Opções de modalidade de dança para as turmas.' },
  { key: 'extra_charge', label: 'Cobranças Extras', icon: Receipt, description: 'Tipos de cobrança extra para o financeiro.' },
  { key: 'plan', label: 'Planos', icon: CreditCard, description: 'Planos de mensalidade para os alunos.' },
  { key: 'acquisition_channel', label: 'Como nos conheceu', icon: Megaphone, description: 'Canais de aquisição para cadastro de alunos.' },
];

const DEFAULTS: Record<string, string[]> = {
  modality: ['Ballet Clássico', 'Jazz', 'Contemporâneo', 'Hip-Hop', 'Sapateado', 'Dança do Ventre', 'Forró', 'Samba', 'K-Pop', 'Stiletto', 'Baby Class', 'Outro'],
  extra_charge: ['Uniforme', 'Figurino', 'Evento', 'Material', 'Matrícula', 'Outro'],
  plan: ['1x/semana', '2x/semana', '3x/semana', 'Livre'],
  acquisition_channel: ['Instagram', 'Indicação', 'Google', 'Outro'],
};

export const SettingsPage = () => {
  const [activeCategory, setActiveCategory] = useState('modality');
  const [options, setOptions] = useState<ConfigOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const loadOptions = async (category: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('config_options')
      .select('*')
      .eq('category', category)
      .order('sort_order')
      .order('label');

    if (data && data.length > 0) {
      setOptions(data);
    } else {
      // Seed defaults
      const { data: { user } } = await supabase.auth.getUser();
      if (user && DEFAULTS[category]) {
        const inserts = DEFAULTS[category].map((label, idx) => ({
          owner_id: user.id,
          category,
          label,
          sort_order: idx,
          is_active: true,
        }));
        const { data: inserted } = await supabase.from('config_options').insert(inserts).select();
        setOptions(inserted ?? []);
      }
    }
    setLoading(false);
  };

  useEffect(() => { loadOptions(activeCategory); }, [activeCategory]);

  const handleAdd = async () => {
    if (!newLabel.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('config_options').insert({
      owner_id: user?.id,
      category: activeCategory,
      label: newLabel.trim(),
      sort_order: options.length,
      is_active: true,
    });
    setNewLabel('');
    setSaving(false);
    await loadOptions(activeCategory);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('config_options').delete().eq('id', id);
    await loadOptions(activeCategory);
  };

  const handleToggle = async (id: string, current: boolean) => {
    await supabase.from('config_options').update({ is_active: !current }).eq('id', id);
    await loadOptions(activeCategory);
  };

  const activeCfg = CATEGORIES.find(c => c.key === activeCategory)!;
  const ActiveIcon = activeCfg.icon;

  return (
    <div className="max-w-[1000px] mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-primary flex items-center gap-3">
          <Settings2 size={24} className="text-secondary" />
          Configurações
        </h2>
        <p className="text-[13px] text-slate-400 mt-0.5">Gerencie as opções de cadastro do sistema.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar tabs */}
        <div className="md:w-64 shrink-0">
          <div className="bg-white rounded-[20px] p-2 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-slate-50 space-y-1">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.key}
                  onClick={() => { setActiveCategory(cat.key); setNewLabel(''); }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-semibold transition-all',
                    activeCategory === cat.key
                      ? 'bg-secondary/10 text-secondary'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-primary'
                  )}
                >
                  <Icon size={18} />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="bg-white rounded-[20px] p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-slate-50">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                <ActiveIcon size={20} className="text-secondary" />
              </div>
              <div>
                <h3 className="text-base font-bold text-primary">{activeCfg.label}</h3>
                <p className="text-[12px] text-slate-400">{activeCfg.description}</p>
              </div>
            </div>

            {/* Add new */}
            <div className="flex items-center gap-3 mt-6 mb-5">
              <input
                type="text"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder={`Adicionar ${activeCfg.label.toLowerCase().slice(0, -1)}...`}
                className="flex-1 rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none transition-all"
              />
              <button
                onClick={handleAdd}
                disabled={saving || !newLabel.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white rounded-xl font-bold hover:bg-primary transition-all text-sm disabled:opacity-40 shrink-0"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                Adicionar
              </button>
            </div>

            {/* List */}
            {loading ? (
              <div className="flex items-center justify-center py-12 text-slate-300">
                <Loader2 size={24} className="animate-spin" />
              </div>
            ) : options.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Nenhuma opção cadastrada.</p>
            ) : (
              <div className="space-y-1">
                {options.map(opt => (
                  <div
                    key={opt.id}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all group',
                      opt.is_active
                        ? 'bg-white border-slate-100 hover:border-slate-200'
                        : 'bg-slate-50 border-slate-100 opacity-60'
                    )}
                  >
                    <GripVertical size={16} className="text-slate-300 shrink-0 cursor-grab" />
                    <span className={cn('flex-1 text-sm font-medium', opt.is_active ? 'text-primary' : 'text-slate-400 line-through')}>
                      {opt.label}
                    </span>

                    {/* Toggle active */}
                    <button
                      onClick={() => handleToggle(opt.id, opt.is_active)}
                      className={cn(
                        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0',
                        opt.is_active ? 'bg-secondary' : 'bg-slate-300'
                      )}
                    >
                      <span className={cn(
                        'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
                        opt.is_active ? 'translate-x-4.5' : 'translate-x-0.5'
                      )} />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(opt.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[11px] text-slate-400 mt-4 pt-4 border-t border-slate-50">
              {options.filter(o => o.is_active).length} opção(ões) ativa(s) de {options.length} total
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
