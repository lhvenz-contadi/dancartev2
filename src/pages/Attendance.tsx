import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ClipboardCheck, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Loader2, Calendar, CheckCircle2, XCircle, Clock, FileText,
  Save, UserCheck, Users, BarChart2, X, Search,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { useConfigOptions } from '../lib/useConfigOptions';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScheduleItem {
  scheduleId: string;
  class_id:   string;
  class_name: string;
  modality:   string | null;
  teacher:    string | null;
  room:       string | null;
  start_time: string;
  end_time:   string;
}

interface StudentRow {
  id:        string;
  full_name: string;
  photo_url: string | null;
}

type AttStatus = 'present' | 'absent' | 'late' | 'justified';

interface AttRecord { status: AttStatus; notes: string }

interface ClassSummary { enrolled: number; recorded: number; present: number }

interface HistoryRow {
  date:       string;
  class_id:   string;
  class_name: string;
  modality:   string | null;
  total:      number;
  present:    number;
  absent:     number;
  late:       number;
  justified:  number;
  rate:       number;
}

interface DetailEntry {
  date:       string;
  class_id:   string;
  class_name: string;
  modality:   string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_CFG: Record<AttStatus, {
  label: string; Icon: any;
  activeBg: string; activeText: string;
  border: string; hoverBg: string; idleText: string;
  badge: string;
}> = {
  present:   { label: 'Presente',    Icon: CheckCircle2, activeBg: 'bg-green-500', activeText: 'text-white', border: 'border-green-300',  hoverBg: 'hover:bg-green-50',  idleText: 'text-green-700',  badge: 'bg-green-50 text-green-700 border-green-200' },
  absent:    { label: 'Ausente',     Icon: XCircle,      activeBg: 'bg-red-500',   activeText: 'text-white', border: 'border-red-300',    hoverBg: 'hover:bg-red-50',    idleText: 'text-red-700',    badge: 'bg-red-50 text-red-700 border-red-200' },
  late:      { label: 'Atraso',      Icon: Clock,        activeBg: 'bg-amber-500', activeText: 'text-white', border: 'border-amber-300',  hoverBg: 'hover:bg-amber-50',  idleText: 'text-amber-700',  badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  justified: { label: 'Justificada', Icon: FileText,     activeBg: 'bg-blue-500',  activeText: 'text-white', border: 'border-blue-300',   hoverBg: 'hover:bg-blue-50',   idleText: 'text-blue-700',   badge: 'bg-blue-50 text-blue-700 border-blue-200' },
};

const STATUSES: AttStatus[] = ['present', 'absent', 'late', 'justified'];

const MONTHS   = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const WEEKDAYS = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];

const MODALITY_DOTS: Record<string, string> = {
  'Ballet Clássico': 'bg-pink-400',  Ballet: 'bg-pink-400',
  Jazz:              'bg-purple-400', 'Contemporâneo': 'bg-blue-400',
  'Hip-Hop':         'bg-orange-400', 'Hip Hop': 'bg-orange-400',
  Sapateado:         'bg-amber-400',  'Dança do Ventre': 'bg-teal-400',
  Forró:             'bg-green-400',  Samba: 'bg-red-400',
  'K-Pop':           'bg-violet-400', Stiletto: 'bg-rose-400',
  'Baby Class':      'bg-yellow-400',
};
const AVATAR_COLORS = ['bg-[#B84B4B]','bg-secondary','bg-primary','bg-[#7B4BB8]','bg-[#4BB87B]','bg-[#B8944B]'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const toDateStr   = (d: Date)   => d.toISOString().slice(0, 10);
const addDays     = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const fmtTime     = (t: string) => t?.slice(0, 5) ?? '';
const fmtShort    = (s: string) => { const [y,m,d] = s.split('-'); return `${d}/${m}/${y}`; };
const hashColor   = (id: string) => AVATAR_COLORS[id.charCodeAt(0) % AVATAR_COLORS.length];
const initials    = (name: string) => name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
const modalityDot = (mod: string | null) => mod ? (MODALITY_DOTS[mod] ?? 'bg-cyan-400') : 'bg-slate-300';

const rateColor = (rate: number) =>
  rate > 80 ? 'bg-green-100 text-green-700' :
  rate > 60 ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-700';

const defaultFrom = () => {
  const d = new Date(); d.setDate(d.getDate() - 30);
  return toDateStr(d);
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const Attendance = ({ onChangeTab }: { onChangeTab?: (tab: string) => void }) => {
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  // Page-level tab
  const [activeTab, setActiveTab] = useState<'day' | 'history'>('day');

  // Day view
  const [selectedDate,   setSelectedDate]   = useState(today);
  const [filterModality, setFilterModality] = useState('');
  const [filterClassId,  setFilterClassId]  = useState('');
  const [schedules,      setSchedules]      = useState<ScheduleItem[]>([]);
  const [summaries,      setSummaries]      = useState<Record<string, ClassSummary>>({});
  const [loading,        setLoading]        = useState(true);

  const { options: modalityOptions } = useConfigOptions('modality');

  const dateStr   = toDateStr(selectedDate);
  const dateLabel = `${WEEKDAYS[selectedDate.getDay()]}, ${selectedDate.getDate()} de ${MONTHS[selectedDate.getMonth()]} de ${selectedDate.getFullYear()}`;

  // ── Load schedules + summaries ─────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    const weekday = selectedDate.getDay();
    const ds = toDateStr(selectedDate);

    const { data: raw } = await supabase
      .from('class_schedules')
      .select('id, start_time, end_time, classes(id, name, modality, teacher, room, is_active)')
      .eq('weekday', weekday);

    const items: ScheduleItem[] = ((raw ?? []) as any[])
      .filter(s => s.classes?.is_active)
      .map(s => ({
        scheduleId: s.id,
        class_id:   s.classes.id,
        class_name: s.classes.name,
        modality:   s.classes.modality ?? null,
        teacher:    s.classes.teacher  ?? null,
        room:       s.classes.room     ?? null,
        start_time: s.start_time,
        end_time:   s.end_time,
      }))
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    setSchedules(items);

    if (items.length > 0) {
      const ids = [...new Set(items.map(i => i.class_id))];
      const [attRes, enrollRes] = await Promise.all([
        supabase.from('attendance').select('class_id, student_id, status').eq('date', ds).in('class_id', ids),
        supabase.from('class_students').select('class_id, student_id').eq('status', 'active').in('class_id', ids),
      ]);
      const attRows    = (attRes.data    ?? []) as { class_id: string; student_id: string; status: AttStatus }[];
      const enrollRows = (enrollRes.data ?? []) as { class_id: string; student_id: string }[];

      const map: Record<string, ClassSummary> = {};
      ids.forEach(id => { map[id] = { enrolled: 0, recorded: 0, present: 0 }; });
      enrollRows.forEach(r => { if (map[r.class_id]) map[r.class_id].enrolled++; });
      attRows.forEach(r => {
        if (map[r.class_id]) {
          map[r.class_id].recorded++;
          if (r.status === 'present' || r.status === 'late') map[r.class_id].present++;
        }
      });
      setSummaries(map);
    } else {
      setSummaries({});
    }
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => { load(); }, [load]);

  const refreshSummary = useCallback(async (classId: string) => {
    const ds = toDateStr(selectedDate);
    const [attRes, enrollRes] = await Promise.all([
      supabase.from('attendance').select('student_id, status').eq('class_id', classId).eq('date', ds),
      supabase.from('class_students').select('student_id').eq('class_id', classId).eq('status', 'active'),
    ]);
    const attRows  = (attRes.data  ?? []) as { student_id: string; status: AttStatus }[];
    const enrolled = (enrollRes.data ?? []).length;
    const present  = attRows.filter(r => r.status === 'present' || r.status === 'late').length;
    setSummaries(prev => ({ ...prev, [classId]: { enrolled, recorded: attRows.length, present } }));
  }, [selectedDate]);

  // ── Derived filter options ─────────────────────────────────────────────
  const classOptions = useMemo(() => {
    const seen = new Set<string>();
    return schedules
      .filter(s => !filterModality || s.modality === filterModality)
      .filter(s => { if (seen.has(s.class_id)) return false; seen.add(s.class_id); return true; });
  }, [schedules, filterModality]);

  const filtered = useMemo(() =>
    schedules.filter(s =>
      (!filterModality || s.modality === filterModality) &&
      (!filterClassId  || s.class_id  === filterClassId)
    ), [schedules, filterModality, filterClassId]);

  return (
    <div className="max-w-[1100px] mx-auto space-y-4 pb-12">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <ClipboardCheck size={24} className="text-secondary shrink-0" />
        <div>
          <h2 className="text-2xl font-bold text-primary">Frequência</h2>
          <p className="text-[13px] text-slate-400 mt-0.5">Controle de presença das aulas</p>
        </div>
      </div>

      {/* ── Page tabs ── */}
      <div className="flex items-center border-b border-slate-100">
        {([
          { id: 'day',     label: 'Chamada do Dia', Icon: ClipboardCheck },
          { id: 'history', label: 'Histórico',       Icon: BarChart2 },
        ] as const).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all',
              activeTab === id
                ? 'border-secondary text-secondary'
                : 'border-transparent text-slate-400 hover:text-slate-600',
            )}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ═══ DAY VIEW ═══ */}
      {activeTab === 'day' && (
        <>
          {/* Context bar */}
          <div className="bg-white rounded-[20px] border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] p-3 flex flex-wrap gap-3 items-center">
            {/* Date navigator */}
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <button onClick={() => setSelectedDate(d => addDays(d, -1))} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-all shrink-0">
                <ChevronLeft size={16} />
              </button>
              <input
                type="date"
                value={dateStr}
                onChange={e => { const d = new Date(e.target.value + 'T00:00:00'); if (!isNaN(d.getTime())) setSelectedDate(d); }}
                className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-secondary/20 shrink-0"
              />
              <button onClick={() => setSelectedDate(d => addDays(d, 1))} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-all shrink-0">
                <ChevronRight size={16} />
              </button>
              <span className="text-sm font-semibold text-slate-600 hidden md:block truncate">{dateLabel}</span>
              {dateStr !== toDateStr(today) && (
                <button onClick={() => setSelectedDate(today)} className="text-xs font-semibold text-secondary border border-secondary/30 px-2.5 py-1.5 rounded-lg hover:bg-secondary/5 transition-all shrink-0">
                  Hoje
                </button>
              )}
            </div>
            {/* Modality filter */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:block">Modalidade</span>
              <select
                value={filterModality}
                onChange={e => { setFilterModality(e.target.value); setFilterClassId(''); }}
                className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-secondary/20 min-w-[130px]"
              >
                <option value="">Todas</option>
                {modalityOptions.map(m => <option key={m.id} value={m.label}>{m.label}</option>)}
              </select>
            </div>
            {/* Class filter */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:block">Turma</span>
              <select
                value={filterClassId}
                onChange={e => setFilterClassId(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-secondary/20 min-w-[140px]"
              >
                <option value="">Todas</option>
                {classOptions.map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
              </select>
            </div>
          </div>

          {/* Cards */}
          {loading ? (
            <div className="bg-white rounded-[20px] border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] flex flex-col items-center justify-center py-20 text-slate-300">
              <Loader2 size={32} className="animate-spin mb-3" />
              <p className="text-sm font-medium">Carregando aulas...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-[20px] border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] flex flex-col items-center justify-center py-20 text-center px-6">
              <Calendar size={48} className="text-slate-200 mb-4" />
              <p className="text-lg font-semibold text-slate-400">Nenhuma aula programada para este dia</p>
              <p className="text-sm text-slate-300 mt-2">
                {filterModality || filterClassId ? 'Tente remover os filtros para ver todas as aulas' : 'Verifique a agenda ou tente outro dia'}
              </p>
              {(filterModality || filterClassId) && (
                <button onClick={() => { setFilterModality(''); setFilterClassId(''); }} className="mt-4 text-sm font-semibold text-secondary hover:underline">
                  Limpar filtros
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(sched => (
                <ClassCard
                  key={`${sched.scheduleId}-${dateStr}`}
                  schedule={sched}
                  dateStr={dateStr}
                  summary={summaries[sched.class_id]}
                  onRefreshSummary={refreshSummary}
                  onGoToClasses={() => onChangeTab?.('classes')}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══ HISTORY VIEW ═══ */}
      {activeTab === 'history' && (
        <HistoryView modalityOptions={modalityOptions} />
      )}
    </div>
  );
};

// ─── History View ─────────────────────────────────────────────────────────────

const HistoryView = ({ modalityOptions }: { modalityOptions: { id: string; label: string }[] }) => {
  const [histFrom,      setHistFrom]      = useState(defaultFrom);
  const [histTo,        setHistTo]        = useState(() => toDateStr(new Date()));
  const [histModality,  setHistModality]  = useState('');
  const [histClassId,   setHistClassId]   = useState('');
  const [allClasses,    setAllClasses]    = useState<{ id: string; name: string }[]>([]);
  const [rows,          setRows]          = useState<HistoryRow[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [detail,        setDetail]        = useState<DetailEntry | null>(null);

  // Load active classes for filter dropdown
  useEffect(() => {
    supabase.from('classes').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => setAllClasses((data ?? []) as { id: string; name: string }[]));
  }, []);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('attendance')
      .select('date, class_id, status, classes(id, name, modality)')
      .gte('date', histFrom)
      .lte('date', histTo)
      .order('date', { ascending: false });

    if (histClassId) query = query.eq('class_id', histClassId);

    const { data } = await query;

    if (data) {
      const map: Record<string, HistoryRow> = {};
      (data as any[]).forEach(r => {
        if (!r.classes) return;
        if (histModality && r.classes.modality !== histModality) return;
        const key = `${r.class_id}|${r.date}`;
        if (!map[key]) {
          map[key] = {
            date: r.date, class_id: r.class_id,
            class_name: r.classes.name, modality: r.classes.modality,
            total: 0, present: 0, absent: 0, late: 0, justified: 0, rate: 0,
          };
        }
        map[key].total++;
        if (r.status === 'present' || r.status === 'late') map[key].present++;
        if (r.status === 'absent')    map[key].absent++;
        if (r.status === 'late')      map[key].late++;
        if (r.status === 'justified') map[key].justified++;
      });

      const result = Object.values(map)
        .map(r => ({ ...r, rate: r.total > 0 ? Math.round((r.present / r.total) * 100) : 0 }))
        .sort((a, b) => b.date.localeCompare(a.date) || a.class_name.localeCompare(b.class_name, 'pt-BR'));

      setRows(result);
    }
    setLoading(false);
  }, [histFrom, histTo, histModality, histClassId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const totalPresent  = rows.reduce((a, r) => a + r.present, 0);
  const totalAbsent   = rows.reduce((a, r) => a + r.absent, 0);
  const totalSessions = rows.length;
  const avgRate       = rows.length > 0 ? Math.round(rows.reduce((a, r) => a + r.rate, 0) / rows.length) : 0;

  return (
    <>
      {/* Filter bar */}
      <div className="bg-white rounded-[20px] border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] p-3 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">De</span>
          <input
            type="date"
            value={histFrom}
            onChange={e => setHistFrom(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-secondary/20"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Até</span>
          <input
            type="date"
            value={histTo}
            onChange={e => setHistTo(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-secondary/20"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:block">Modalidade</span>
          <select
            value={histModality}
            onChange={e => { setHistModality(e.target.value); setHistClassId(''); }}
            className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-secondary/20 min-w-[130px]"
          >
            <option value="">Todas</option>
            {modalityOptions.map(m => <option key={m.id} value={m.label}>{m.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:block">Turma</span>
          <select
            value={histClassId}
            onChange={e => setHistClassId(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-secondary/20 min-w-[140px]"
          >
            <option value="">Todas</option>
            {allClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {(histModality || histClassId) && (
          <button
            onClick={() => { setHistModality(''); setHistClassId(''); }}
            className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors ml-auto"
          >
            <X size={12} /> Limpar
          </button>
        )}
      </div>

      {/* KPI summary strip */}
      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Sessões',       value: String(totalSessions), color: 'text-primary' },
            { label: 'Presenças',     value: String(totalPresent),  color: 'text-green-600' },
            { label: 'Ausências',     value: String(totalAbsent),   color: 'text-red-500' },
            { label: 'Taxa Média',    value: `${avgRate}%`,         color: avgRate > 80 ? 'text-green-600' : avgRate > 60 ? 'text-amber-600' : 'text-red-500' },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-[16px] border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] px-4 py-3">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{k.label}</p>
              <p className={cn('text-2xl font-extrabold mt-0.5', k.color)}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-[20px] border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-300">
            <Loader2 size={32} className="animate-spin mb-3" />
            <p className="text-sm font-medium">Carregando histórico...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <Search size={40} className="text-slate-200 mb-3" />
            <p className="text-base font-semibold text-slate-400">Nenhum registro encontrado</p>
            <p className="text-sm text-slate-300 mt-1">Ajuste o período ou os filtros</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  {['Data','Turma','Modalidade','Total','Presentes','Ausentes','Taxa'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((row, idx) => (
                  <tr
                    key={`${row.class_id}-${row.date}-${idx}`}
                    onClick={() => setDetail({ date: row.date, class_id: row.class_id, class_name: row.class_name, modality: row.modality })}
                    className="hover:bg-slate-50/70 transition-all cursor-pointer group"
                  >
                    <td className="px-5 py-3.5 text-sm font-semibold text-slate-700 whitespace-nowrap">
                      {fmtShort(row.date)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className={cn('w-2 h-2 rounded-full shrink-0', modalityDot(row.modality))} />
                        <span className="text-sm font-semibold text-primary group-hover:text-secondary transition-colors">
                          {row.class_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {row.modality
                        ? <span className="text-xs font-semibold text-secondary bg-secondary/10 px-2 py-0.5 rounded-full">{row.modality}</span>
                        : <span className="text-slate-300">—</span>
                      }
                    </td>
                    <td className="px-5 py-3.5 text-sm font-medium text-slate-600">{row.total}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-bold text-green-600">{row.present}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-bold text-red-500">{row.absent}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn('text-xs font-extrabold px-2.5 py-1 rounded-full', rateColor(row.rate))}>
                        {row.rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/30">
              <p className="text-xs text-slate-400">{rows.length} sessão(ões) no período</p>
            </div>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {detail && (
        <DetailModal
          entry={detail}
          onClose={() => setDetail(null)}
        />
      )}
    </>
  );
};

// ─── Detail Modal ─────────────────────────────────────────────────────────────

interface DetailStudentRow {
  id:        string;
  full_name: string;
  photo_url: string | null;
  status:    AttStatus | null;
  notes:     string | null;
}

const DetailModal = ({ entry, onClose }: { entry: DetailEntry; onClose: () => void }) => {
  const [students, setStudents] = useState<DetailStudentRow[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [attRes, enrollRes] = await Promise.all([
        supabase.from('attendance')
          .select('student_id, status, notes')
          .eq('class_id', entry.class_id)
          .eq('date', entry.date),
        supabase.from('class_students')
          .select('students(id, full_name, photo_url)')
          .eq('class_id', entry.class_id)
          .eq('status', 'active'),
      ]);

      const attMap: Record<string, { status: AttStatus; notes: string | null }> = {};
      ((attRes.data ?? []) as any[]).forEach(r => {
        attMap[r.student_id] = { status: r.status, notes: r.notes };
      });

      const studs: DetailStudentRow[] = ((enrollRes.data ?? []) as any[])
        .map(r => r.students).filter(Boolean)
        .sort((a: StudentRow, b: StudentRow) => a.full_name.localeCompare(b.full_name, 'pt-BR'))
        .map((s: StudentRow) => ({
          ...s,
          status: attMap[s.id]?.status ?? null,
          notes:  attMap[s.id]?.notes  ?? null,
        }));

      setStudents(studs);
      setLoading(false);
    })();
  }, [entry]);

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, justified: 0, unrecorded: 0 };
    students.forEach(s => {
      if (s.status) c[s.status]++;
      else c.unrecorded++;
    });
    return c;
  }, [students]);

  const [y, m, d] = entry.date.split('-');
  const dateLabel = `${d}/${m}/${y}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 bg-white rounded-[20px] shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', modalityDot(entry.modality))} />
              <h3 className="font-bold text-primary">{entry.class_name}</h3>
              {entry.modality && (
                <span className="text-[10px] font-semibold text-secondary bg-secondary/10 px-2 py-0.5 rounded-full">
                  {entry.modality}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400">{dateLabel}</p>

            {/* Status counts */}
            {!loading && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {STATUSES.map(s => counts[s] > 0 && (
                  <span key={s} className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', STATUS_CFG[s].badge)}>
                    {counts[s]} {STATUS_CFG[s].label.toLowerCase()}
                  </span>
                ))}
                {counts.unrecorded > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-100 text-slate-500 border-slate-200">
                    {counts.unrecorded} não registrado{counts.unrecorded > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-all shrink-0 ml-4">
            <X size={18} />
          </button>
        </div>

        {/* Student list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-300">
              <Loader2 size={24} className="animate-spin mr-2" />
              <span className="text-sm">Carregando...</span>
            </div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-slate-400">
              <Users size={32} className="mb-2 opacity-30" />
              <p className="text-sm">Nenhum aluno matriculado</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {students.map((s, idx) => {
                const cfg = s.status ? STATUS_CFG[s.status] : null;
                return (
                  <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="text-[11px] font-bold text-slate-300 w-4 text-right shrink-0">{idx + 1}</span>

                    {s.photo_url ? (
                      <img src={s.photo_url} alt={s.full_name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className={cn('w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-xs shrink-0', hashColor(s.id))}>
                        {initials(s.full_name)}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-primary truncate">{s.full_name}</p>
                      {s.notes && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{s.notes}</p>
                      )}
                    </div>

                    {cfg ? (
                      <span className={cn('flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border shrink-0', cfg.badge)}>
                        <cfg.Icon size={11} />
                        {cfg.label}
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border bg-slate-100 text-slate-400 border-slate-200 shrink-0">
                        Não registrado
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/30">
          <p className="text-xs text-slate-400 text-center">
            {students.length} aluno{students.length !== 1 ? 's' : ''} · {dateLabel}
          </p>
        </div>
      </div>
    </div>
  );
};

// ─── Badge ────────────────────────────────────────────────────────────────────

type BadgeColor = 'gray' | 'yellow' | 'green';

const AttBadge = ({ label, color }: { label: string; color: BadgeColor }) => {
  const styles: Record<BadgeColor, string> = {
    gray:   'bg-slate-100 text-slate-500 border-slate-200',
    yellow: 'bg-amber-50 text-amber-700 border-amber-200',
    green:  'bg-green-50 text-green-700 border-green-200',
  };
  return (
    <span className={cn('text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border', styles[color])}>
      {label}
    </span>
  );
};

// ─── Class Attendance Card ────────────────────────────────────────────────────

const ClassCard = ({
  schedule, dateStr, summary, onRefreshSummary, onGoToClasses,
}: {
  schedule:         ScheduleItem;
  dateStr:          string;
  summary:          ClassSummary | undefined;
  onRefreshSummary: (classId: string) => Promise<void>;
  onGoToClasses:    () => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [records,  setRecords]  = useState<Record<string, AttRecord>>({});
  const [loading,  setLoading]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (expanded) { loadedRef.current = false; loadData(); }
  }, [dateStr]); // eslint-disable-line

  const loadData = useCallback(async () => {
    if (loadedRef.current) return;
    setLoading(true);
    const [studRes, attRes] = await Promise.all([
      supabase.from('class_students').select('students(id, full_name, photo_url)').eq('class_id', schedule.class_id).eq('status', 'active'),
      supabase.from('attendance').select('student_id, status, notes').eq('class_id', schedule.class_id).eq('date', dateStr),
    ]);
    const studs: StudentRow[] = ((studRes.data ?? []) as any[])
      .map(r => r.students).filter(Boolean)
      .sort((a: StudentRow, b: StudentRow) => a.full_name.localeCompare(b.full_name, 'pt-BR'));
    const init: Record<string, AttRecord> = {};
    studs.forEach(s => { init[s.id] = { status: 'present', notes: '' }; });
    ((attRes.data ?? []) as any[]).forEach(r => { init[r.student_id] = { status: r.status as AttStatus, notes: r.notes ?? '' }; });
    setStudents(studs);
    setRecords(init);
    loadedRef.current = true;
    setLoading(false);
  }, [schedule.class_id, dateStr]);

  const toggle = () => { if (!expanded) loadData(); setExpanded(e => !e); };

  const setStatus = (id: string, s: AttStatus) => setRecords(p => ({ ...p, [id]: { ...p[id], status: s } }));
  const setNotes  = (id: string, n: string)    => setRecords(p => ({ ...p, [id]: { ...p[id], notes:  n } }));

  const markAllPresent = () => {
    setRecords(prev => {
      const next = { ...prev };
      students.forEach(s => { next[s.id] = { ...next[s.id], status: 'present' }; });
      return next;
    });
  };

  const save = async () => {
    if (students.length === 0) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const rows = students.map(s => ({
      owner_id: user!.id, class_id: schedule.class_id, student_id: s.id, date: dateStr,
      status: records[s.id]?.status ?? 'present', notes: records[s.id]?.notes || null, recorded_by: user!.id,
    }));
    await supabase.from('attendance').upsert(rows, { onConflict: 'class_id,student_id,date' });
    await onRefreshSummary(schedule.class_id);
    setSaving(false);
    setToast(true);
    setTimeout(() => setToast(false), 2500);
  };

  const badge = useMemo<{ label: string; color: BadgeColor }>(() => {
    if (!summary || summary.enrolled === 0) return { label: 'Sem alunos', color: 'gray' };
    if (summary.recorded === 0)              return { label: 'Pendente',   color: 'gray' };
    if (summary.recorded < summary.enrolled) return { label: 'Parcial',   color: 'yellow' };
    return { label: 'Completa', color: 'green' };
  }, [summary]);

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, justified: 0 };
    Object.values(records).forEach(r => c[r.status]++);
    return c;
  }, [records]);

  return (
    <div className="bg-white rounded-[20px] border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] overflow-hidden">
      <button onClick={toggle} className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50/60 transition-all text-left">
        <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', modalityDot(schedule.modality))} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-primary">{schedule.class_name}</span>
            {schedule.modality && <span className="text-[10px] font-semibold text-secondary bg-secondary/10 px-2 py-0.5 rounded-full hidden sm:inline">{schedule.modality}</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400 flex-wrap">
            <span className="font-medium text-slate-500">{fmtTime(schedule.start_time)} – {fmtTime(schedule.end_time)}</span>
            {schedule.teacher && <><span>·</span><span>{schedule.teacher}</span></>}
            {schedule.room    && <><span>·</span><span>{schedule.room}</span></>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {badge.label === 'Completa' && summary && (
            <span className="text-xs font-semibold text-slate-500 hidden sm:block">{summary.present}/{summary.enrolled} presentes</span>
          )}
          <AttBadge label={badge.label} color={badge.color} />
          {expanded ? <ChevronUp size={16} className="text-slate-400 ml-1" /> : <ChevronDown size={16} className="text-slate-400 ml-1" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100">
          {loading ? (
            <div className="divide-y divide-slate-50">
              {Array(3).fill(0).map((_, i) => <StudentRowSkeleton key={i} />)}
            </div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center px-6">
              <Users size={36} className="text-slate-200 mb-3" />
              <p className="text-sm font-semibold text-slate-400">Nenhum aluno matriculado nesta turma</p>
              <button onClick={onGoToClasses} className="mt-3 text-xs font-semibold text-secondary hover:underline">Ir para Turmas →</button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-5 py-3 bg-slate-50/40 border-b border-slate-50">
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  {(STATUSES).map(s => (
                    <span key={s} className={cn('font-semibold', s==='present'?'text-green-600':s==='absent'?'text-red-500':s==='late'?'text-amber-600':'text-blue-600')}>
                      {counts[s]} {STATUS_CFG[s].label.toLowerCase()}
                    </span>
                  ))}
                </div>
                <button onClick={markAllPresent} className="flex items-center gap-1.5 text-xs font-semibold text-secondary border border-secondary/30 px-3 py-1.5 rounded-lg hover:bg-secondary/5 transition-all">
                  <UserCheck size={13} />Todos Presentes
                </button>
              </div>
              <div className="divide-y divide-slate-50">
                {students.map((s, idx) => (
                  <StudentRow key={s.id} index={idx+1} student={s} record={records[s.id] ?? {status:'present',notes:''}}
                    onStatusChange={st => setStatus(s.id, st)} onNotesChange={n => setNotes(s.id, n)} />
                ))}
              </div>
              <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/20 relative">
                <p className="text-xs text-slate-400">{students.length} aluno{students.length!==1?'s':''} nesta turma</p>
                <button onClick={save} disabled={saving}
                  className={cn('flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition-all',
                    saving ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-secondary text-white hover:bg-primary shadow-md shadow-secondary/20')}>
                  {saving ? <><Loader2 size={14} className="animate-spin"/>Salvando...</> : <><Save size={14}/>Salvar Chamada</>}
                </button>
                {/* Success toast */}
                {toast && (
                  <div className="absolute bottom-full mb-2 right-4 flex items-center gap-2 bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-green-600/25 animate-in slide-in-from-bottom-2 fade-in duration-200">
                    <CheckCircle2 size={16} />Chamada salva!
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Student Row Skeleton ─────────────────────────────────────────────────────

const StudentRowSkeleton = () => (
  <div className="flex items-center gap-3 px-5 py-3">
    <div className="w-4 shrink-0" />
    <div className="w-9 h-9 rounded-full bg-slate-100 animate-pulse shrink-0" />
    <div className="flex-1 space-y-1.5">
      <div className="h-3.5 bg-slate-100 animate-pulse rounded-lg w-36" />
    </div>
    <div className="hidden lg:flex items-center gap-1 shrink-0">
      {[0,1,2,3].map(i => <div key={i} className="h-7 w-[72px] bg-slate-100 animate-pulse rounded-lg" />)}
    </div>
    <div className="lg:hidden flex gap-1 shrink-0">
      {[0,1].map(i => <div key={i} className="h-7 w-20 bg-slate-100 animate-pulse rounded-lg" />)}
    </div>
  </div>
);

// ─── Student Row ──────────────────────────────────────────────────────────────

const StudentRow = ({ index, student, record, onStatusChange, onNotesChange }: {
  index: number; student: StudentRow; record: AttRecord;
  onStatusChange: (s: AttStatus) => void; onNotesChange: (n: string) => void;
}) => (
  <div className={cn('px-4 py-3 transition-all', record.status === 'absent' ? 'opacity-55' : '')}>
    {/* Top row: index + avatar + name + desktop buttons */}
    <div className="flex items-center gap-2.5">
      <span className="text-[11px] font-bold text-slate-300 w-4 text-right shrink-0 select-none">{index}</span>
      {student.photo_url
        ? <img src={student.photo_url} alt={student.full_name} className="w-9 h-9 rounded-full object-cover shrink-0" />
        : <div className={cn('w-9 h-9 rounded-full text-white flex items-center justify-center font-bold text-xs shrink-0', hashColor(student.id))}>{initials(student.full_name)}</div>
      }
      <p className="flex-1 text-sm font-semibold text-primary truncate min-w-0">{student.full_name}</p>
      {/* Desktop (lg+): buttons inline */}
      <div className="hidden lg:flex items-center gap-1 shrink-0">
        {STATUSES.map(s => {
          const cfg = STATUS_CFG[s];
          const active = record.status === s;
          return (
            <button key={s} title={cfg.label} onClick={() => onStatusChange(s)}
              className={cn('flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                active ? cn(cfg.activeBg, cfg.activeText, 'border-transparent shadow-sm') : cn('bg-white border', cfg.border, cfg.idleText, cfg.hoverBg))}>
              <cfg.Icon size={12} />{cfg.label}
            </button>
          );
        })}
      </div>
      {/* Desktop xl: notes inline */}
      <input type="text" placeholder="Obs..." value={record.notes} onChange={e => onNotesChange(e.target.value)}
        className="hidden xl:block text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-secondary/20 w-36 bg-slate-50" />
    </div>
    {/* Mobile (< lg): 2×2 status grid */}
    <div className="lg:hidden mt-2.5 pl-[52px] grid grid-cols-2 gap-1.5">
      {STATUSES.map(s => {
        const cfg = STATUS_CFG[s];
        const active = record.status === s;
        return (
          <button key={s} onClick={() => onStatusChange(s)}
            className={cn('flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all',
              active ? cn(cfg.activeBg, cfg.activeText, 'border-transparent shadow-sm') : cn('bg-white border', cfg.border, cfg.idleText, cfg.hoverBg))}>
            <cfg.Icon size={13} />{cfg.label}
          </button>
        );
      })}
    </div>
    {/* Mobile: notes below */}
    <div className="lg:hidden mt-1.5 pl-[52px]">
      <input type="text" placeholder="Observação..." value={record.notes} onChange={e => onNotesChange(e.target.value)}
        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 text-slate-600 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-secondary/20 bg-slate-50" />
    </div>
  </div>
);
