import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export interface ConfigOption {
  id: string;
  category: string;
  label: string;
  sort_order: number;
  is_active: boolean;
}

const DEFAULTS: Record<string, string[]> = {
  modality: ['Ballet Clássico', 'Jazz', 'Contemporâneo', 'Hip-Hop', 'Sapateado', 'Dança do Ventre', 'Forró', 'Samba', 'K-Pop', 'Stiletto', 'Baby Class', 'Outro'],
  extra_charge: ['Uniforme', 'Figurino', 'Evento', 'Material', 'Matrícula', 'Outro'],
  plan: ['1x/semana', '2x/semana', '3x/semana', 'Livre'],
  acquisition_channel: ['Instagram', 'Indicação', 'Google', 'Outro'],
};

export function useConfigOptions(category: string) {
  const [options, setOptions] = useState<ConfigOption[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('config_options')
      .select('*')
      .eq('category', category)
      .eq('is_active', true)
      .order('sort_order')
      .order('label');

    if (data && data.length > 0) {
      setOptions(data);
    } else {
      // No options found – seed defaults
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

  useEffect(() => { load(); }, [category]);

  return { options, loading, reload: load };
}
