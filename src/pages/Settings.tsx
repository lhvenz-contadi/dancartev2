import React, { useState, useEffect, type ReactNode } from 'react';
import {
  Plus, Trash2, Loader2, ChevronDown, Settings2, Music, Receipt,
  CreditCard, Megaphone, AlertTriangle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { BottomSheet } from '../components/ui/BottomSheet';
import { ListCard } from '../components/ui/ListCard';

interface ConfigOption {
  id: string;
  category: string;
  label: string;
  sort_order: number;
  is_active: boolean;
}

type CategoryKey = 'modality' | 'extra_charge' | 'plan' | 'acquisition_channel';

const CATEGORIES: { key: CategoryKey; label: string; icon: React.FC<any>; description: string }[] = [
  { key: 'modality',            label: 'Modalidades',       icon: Music,      description: 'Opções de modalidade de dança para as turmas.' },
  { key: 'extra_charge',        label: 'Cobranças extras',  icon: Receipt,    description: 'Tipos de cobrança extra para o financeiro.' },
  { key: 'plan',                label: 'Planos',            icon: CreditCard, description: 'Planos de mensalidade para os alunos.' },
  { key: 'acquisition_channel', label: 'Como nos conheceu', icon: Megaphone,  description: 'Canais de aquisição para cadastro de alunos.' },
];

const DEFAULTS: Record<CategoryKey, string[]> = {
  modality: ['Ballet Clássico', 'Jazz', 'Contemporâneo', 'Hip-Hop', 'Sapateado', 'Dança do Ventre', 'Forró', 'Samba', 'K-Pop', 'Stiletto', 'Baby Class', 'Outro'],
  extra_charge: ['Uniforme', 'Figurino', 'Evento', 'Material', 'Matrícula', 'Outro'],
  plan: ['1x/semana', '2x/semana', '3x/semana', 'Livre'],
  acquisition_channel: ['Instagram', 'Indicação', 'Google', 'Outro'],
};

const inputClass =
  'w-full h-11 rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-3.5 text-base outline-none transition-all placeholder-slate-300';

// ── Accordion Section (mobile collapse, desktop always open) ────────────────
const CategorySection = ({
  title, icon: Icon, description, count, isOpen, onToggle, children,
}: {
  title: string;
  icon: React.FC<any>;
  description: string;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) => (
  <div className="bg-white rounded-2xl md:rounded-[20px] shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-slate-50 overflow-hidden">
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-4 py-4 md:px-7 md:pt-7 md:pb-3 md:cursor-default text-left"
      aria-expanded={isOpen}
    >
      <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
        <Icon size={18} className="text-secondary" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-primary truncate">{title}</h3>
        <p className="text-xs text-slate-400 truncate">{description}</p>
      </div>
      <span className="text-xs font-bold text-slate-400 tabular-nums shrink-0">{count}</span>
      <ChevronDown
        size={18}
        aria-hidden
        className={cn('text-slate-400 transition-transform shrink-0 md:hidden', isOpen && 'rotate-180')}
      />
    </button>
    <div
      className={cn(
        'grid transition-[grid-template-rows] duration-200 ease-out md:grid-rows-[1fr]',
        isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      )}
    >
      <div className="overflow-hidden">
        <div className="px-4 pb-5 md:px-7 md:pb-7">{children}</div>
      </div>
    </div>
  </div>
);

export const SettingsPage = () => {
  const [byCategory, setByCategory] = useState<Record<CategoryKey, ConfigOption[]>>({
    modality: [], extra_charge: [], plan: [], acquisition_channel: [],
  });
  const [loadingCat, setLoadingCat] = useState<Record<CategoryKey, boolean>>({
    modality: true, extra_charge: true, plan: true, acquisition_channel: true,
  });

  // Mobile: first category open. Desktop always open via CSS.
  const [openSet, setOpenSet] = useState<Set<CategoryKey>>(new Set(['modality']));

  const [editing, setEditing] = useState<ConfigOption | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editSaving, setEditSaving] = useState(false);

  const [toDelete, setToDelete] = useState<ConfigOption | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [addingFor, setAddingFor] = useState<CategoryKey | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  const loadCategory = async (category: CategoryKey) => {
    setLoadingCat(prev => ({ ...prev, [category]: true }));
    const { data } = await supabase
      .from('config_options')
      .select('*')
      .eq('category', category)
      .order('sort_order')
      .order('label');

    if (data && data.length > 0) {
      setByCategory(prev => ({ ...prev, [category]: data }));
    } else {
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
        setByCategory(prev => ({ ...prev, [category]: inserted ?? [] }));
      }
    }
    setLoadingCat(prev => ({ ...prev, [category]: false }));
  };

  useEffect(() => {
    CATEGORIES.forEach(c => loadCategory(c.key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSection = (key: CategoryKey) =>
    setOpenSet(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const openEdit = (opt: ConfigOption) => {
    setEditing(opt);
    setEditLabel(opt.label);
    setEditActive(opt.is_active);
  };

  const saveEdit = async () => {
    if (!editing || !editLabel.trim()) return;
    setEditSaving(true);
    await supabase
      .from('config_options')
      .update({ label: editLabel.trim(), is_active: editActive })
      .eq('id', editing.id);
    setEditSaving(false);
    setEditing(null);
    await loadCategory(editing.category as CategoryKey);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    await supabase.from('config_options').delete().eq('id', toDelete.id);
    const cat = toDelete.category as CategoryKey;
    setToDelete(null);
    setEditing(null);
    setDeleting(false);
    await loadCategory(cat);
  };

  const openAdd = (cat: CategoryKey) => {
    setAddingFor(cat);
    setNewLabel('');
  };

  const saveAdd = async () => {
    if (!addingFor || !newLabel.trim()) return;
    setAddSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('config_options').insert({
      owner_id: user?.id,
      category: addingFor,
      label: newLabel.trim(),
      sort_order: byCategory[addingFor].length,
      is_active: true,
    });
    setAddSaving(false);
    setNewLabel('');
    const cat = addingFor;
    setAddingFor(null);
    await loadCategory(cat);
  };

  return (
    <div className="max-w-[1000px] mx-auto pb-12">
      <div className="flex items-center gap-3 mb-5 md:mb-6">
        <Settings2 size={24} className="text-secondary shrink-0" />
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-primary leading-tight">Configurações</h2>
          <p className="text-[13px] text-slate-400 mt-0.5">
            Gerencie as opções de cadastro do sistema.
          </p>
        </div>
      </div>

      <div className="space-y-4 md:space-y-6 md:grid md:grid-cols-2 md:gap-6 md:space-y-0">
        {CATEGORIES.map(cat => {
          const opts = byCategory[cat.key];
          const isLoading = loadingCat[cat.key];
          return (
            <CategorySection
              key={cat.key}
              title={cat.label}
              icon={cat.icon}
              description={cat.description}
              count={opts.length}
              isOpen={openSet.has(cat.key)}
              onToggle={() => toggleSection(cat.key)}
            >
              {isLoading ? (
                <div className="flex items-center justify-center py-10 text-slate-300">
                  <Loader2 size={22} className="animate-spin" />
                </div>
              ) : opts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-slate-400 mb-3">Nenhuma opção cadastrada.</p>
                  <button
                    type="button"
                    onClick={() => loadCategory(cat.key)}
                    className="min-h-11 px-4 text-sm font-bold text-secondary border border-secondary/30 rounded-full"
                  >
                    Restaurar padrões
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {opts.map(opt => (
                    <ListCard
                      key={opt.id}
                      onClick={() => openEdit(opt)}
                      title={opt.label}
                      className={cn(!opt.is_active && 'opacity-60')}
                      meta={
                        <span
                          className={cn(
                            'text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border',
                            opt.is_active
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200',
                          )}
                        >
                          {opt.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      }
                    />
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => openAdd(cat.key)}
                className="mt-4 w-full min-h-11 inline-flex items-center justify-center gap-2 rounded-full border border-dashed border-slate-300 text-sm font-bold text-secondary hover:bg-secondary/5 transition-colors"
              >
                <Plus size={16} /> Adicionar opção
              </button>
            </CategorySection>
          );
        })}
      </div>

      {/* Edit BottomSheet */}
      <BottomSheet
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Editar opção"
      >
        {editing && (
          <div className="space-y-4 pb-2">
            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">Nome</label>
              <input
                type="text"
                value={editLabel}
                onChange={e => setEditLabel(e.target.value)}
                placeholder="Nome da opção"
                className={inputClass}
                autoFocus
              />
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={editActive}
              onClick={() => setEditActive(p => !p)}
              className="w-full min-h-11 flex items-center gap-3 cursor-pointer text-left"
            >
              <span
                aria-hidden
                className={cn(
                  'relative inline-flex h-7 w-12 items-center rounded-full transition-colors shrink-0',
                  editActive ? 'bg-secondary' : 'bg-slate-300',
                )}
              >
                <span
                  className={cn(
                    'inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm',
                    editActive ? 'translate-x-6' : 'translate-x-1',
                  )}
                />
              </span>
              <span className="text-sm font-semibold text-primary">
                {editActive ? 'Ativa' : 'Inativa'}
              </span>
            </button>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="flex-1 min-h-11 rounded-full border border-slate-200 text-primary font-bold text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={editSaving || !editLabel.trim()}
                className="flex-1 min-h-11 bg-secondary text-white rounded-full font-bold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {editSaving && <Loader2 size={16} className="animate-spin" />}
                Salvar
              </button>
            </div>

            <button
              type="button"
              onClick={() => setToDelete(editing)}
              className="w-full min-h-11 mt-1 rounded-full text-sm font-bold text-red-600 hover:bg-red-50 inline-flex items-center justify-center gap-2"
            >
              <Trash2 size={16} /> Excluir
            </button>
          </div>
        )}
      </BottomSheet>

      {/* Delete confirm BottomSheet */}
      <BottomSheet
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Excluir opção"
      >
        {toDelete && (
          <div className="space-y-4 pb-2">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
              <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium leading-snug">
                Excluir <strong>"{toDelete.label}"</strong>? Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setToDelete(null)}
                className="flex-1 min-h-11 rounded-full border border-slate-200 text-primary font-bold text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 min-h-11 bg-red-500 text-white rounded-full font-bold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Excluir
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* Add BottomSheet */}
      <BottomSheet
        open={!!addingFor}
        onClose={() => { setAddingFor(null); setNewLabel(''); }}
        title={
          addingFor
            ? `Adicionar em ${CATEGORIES.find(c => c.key === addingFor)?.label ?? ''}`
            : 'Adicionar opção'
        }
      >
        {addingFor && (
          <div className="space-y-4 pb-2">
            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">Nome</label>
              <input
                type="text"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newLabel.trim()) saveAdd(); }}
                placeholder="Ex: Pilates"
                className={inputClass}
                autoFocus
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => { setAddingFor(null); setNewLabel(''); }}
                className="flex-1 min-h-11 rounded-full border border-slate-200 text-primary font-bold text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveAdd}
                disabled={addSaving || !newLabel.trim()}
                className="flex-1 min-h-11 bg-secondary text-white rounded-full font-bold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {addSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Adicionar
              </button>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
};
