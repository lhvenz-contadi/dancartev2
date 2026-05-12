export const MODALITY_COLORS: Record<string, string> = {
  'Ballet Clássico': 'bg-pink-400',
  Ballet: 'bg-pink-400',
  Jazz: 'bg-purple-400',
  'Contemporâneo': 'bg-blue-400',
  'Hip-Hop': 'bg-orange-400',
  'Hip Hop': 'bg-orange-400',
  Sapateado: 'bg-amber-400',
  'Dança do Ventre': 'bg-teal-400',
  Forró: 'bg-green-400',
  Samba: 'bg-red-400',
  'K-Pop': 'bg-violet-400',
  Stiletto: 'bg-rose-400',
  'Baby Class': 'bg-yellow-400',
};

export const MODALITY_HEX: Record<string, string> = {
  'Ballet Clássico': '#f472b6',
  Ballet: '#f472b6',
  Jazz: '#c084fc',
  'Contemporâneo': '#60a5fa',
  'Hip-Hop': '#fb923c',
  'Hip Hop': '#fb923c',
  Sapateado: '#fbbf24',
  'Dança do Ventre': '#2dd4bf',
  Forró: '#4ade80',
  Samba: '#f87171',
  'K-Pop': '#a78bfa',
  Stiletto: '#fb7185',
  'Baby Class': '#facc15',
};

export const FALLBACK_COLORS = [
  '#60a5fa', '#a78bfa', '#34d399', '#f472b6', '#fbbf24', '#fb923c',
];

export const getModalityDot = (mod: string | null) =>
  mod ? (MODALITY_COLORS[mod] ?? 'bg-cyan-400') : 'bg-slate-300';

export const getModalityHex = (mod: string | null, idx = 0): string =>
  mod
    ? (MODALITY_HEX[mod] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length])
    : FALLBACK_COLORS[idx % FALLBACK_COLORS.length];

export const AVATAR_COLORS = [
  'bg-[#B84B4B]', 'bg-secondary', 'bg-primary', 'bg-[#7B4BB8]',
  'bg-[#4BB87B]', 'bg-[#B8944B]',
];

export const hashColor = (id: string) =>
  AVATAR_COLORS[(id?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];

export const getInitials = (name: string) =>
  name.split(' ').slice(0, 2).map(n => n[0] ?? '').join('').toUpperCase();

// ── Full 4-field modality palette (bg + border + text + dot classes) ────────
export interface ModalityColorFull {
  bg: string;
  border: string;
  text: string;
  dot: string;
}

export const MODALITY_COLORS_FULL: Record<string, ModalityColorFull> = {
  'Ballet Clássico': { bg: 'bg-pink-100',    border: 'border-pink-300',    text: 'text-pink-700',    dot: 'bg-pink-400' },
  Ballet:            { bg: 'bg-pink-100',    border: 'border-pink-300',    text: 'text-pink-700',    dot: 'bg-pink-400' },
  Jazz:              { bg: 'bg-purple-100',  border: 'border-purple-300',  text: 'text-purple-700',  dot: 'bg-purple-400' },
  'Contemporâneo':   { bg: 'bg-blue-100',    border: 'border-blue-300',    text: 'text-blue-700',    dot: 'bg-blue-400' },
  'Hip-Hop':         { bg: 'bg-orange-100',  border: 'border-orange-300',  text: 'text-orange-700',  dot: 'bg-orange-400' },
  'Hip Hop':         { bg: 'bg-orange-100',  border: 'border-orange-300',  text: 'text-orange-700',  dot: 'bg-orange-400' },
  Sapateado:         { bg: 'bg-amber-100',   border: 'border-amber-300',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  'Dança do Ventre': { bg: 'bg-teal-100',    border: 'border-teal-300',    text: 'text-teal-700',    dot: 'bg-teal-400' },
  Forró:             { bg: 'bg-green-100',   border: 'border-green-300',   text: 'text-green-700',   dot: 'bg-green-400' },
  Samba:             { bg: 'bg-red-100',     border: 'border-red-300',     text: 'text-red-700',     dot: 'bg-red-400' },
  'K-Pop':           { bg: 'bg-violet-100',  border: 'border-violet-300',  text: 'text-violet-700',  dot: 'bg-violet-400' },
  Stiletto:          { bg: 'bg-rose-100',    border: 'border-rose-300',    text: 'text-rose-700',    dot: 'bg-rose-400' },
  'Baby Class':      { bg: 'bg-yellow-100',  border: 'border-yellow-300',  text: 'text-yellow-700',  dot: 'bg-yellow-400' },
};

export const FALLBACK_COLORS_FULL: ModalityColorFull[] = [
  { bg: 'bg-cyan-100',    border: 'border-cyan-300',    text: 'text-cyan-700',    dot: 'bg-cyan-400' },
  { bg: 'bg-lime-100',    border: 'border-lime-300',    text: 'text-lime-700',    dot: 'bg-lime-400' },
  { bg: 'bg-fuchsia-100', border: 'border-fuchsia-300', text: 'text-fuchsia-700', dot: 'bg-fuchsia-400' },
  { bg: 'bg-sky-100',     border: 'border-sky-300',     text: 'text-sky-700',     dot: 'bg-sky-400' },
  { bg: 'bg-indigo-100',  border: 'border-indigo-300',  text: 'text-indigo-700',  dot: 'bg-indigo-400' },
];

export const getModalityColorFull = (modality: string | null): ModalityColorFull => {
  if (!modality) return FALLBACK_COLORS_FULL[0];
  if (MODALITY_COLORS_FULL[modality]) return MODALITY_COLORS_FULL[modality];
  let hash = 0;
  for (let i = 0; i < modality.length; i++) {
    hash = modality.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FALLBACK_COLORS_FULL[Math.abs(hash) % FALLBACK_COLORS_FULL.length];
};
