import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2,
  MapPin, Users, X, GraduationCap, BookOpen, ExternalLink,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScheduleRow {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  classes: {
    id: string;
    name: string;
    modality: string | null;
    teacher: string | null;
    room: string | null;
    is_active: boolean;
  } | null;
}

interface StudentRow {
  id: string;
  full_name: string;
  status: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEKDAYS_FULL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const START_HOUR = 7;
const END_HOUR = 22;
const HOUR_PX = 60;

// ─── Color Palette ────────────────────────────────────────────────────────────

interface ModalityColor { bg: string; border: string; text: string; dot: string }

const MODALITY_COLORS: Record<string, ModalityColor> = {
  'Ballet Clássico': { bg: 'bg-pink-100',    border: 'border-pink-300',    text: 'text-pink-700',    dot: 'bg-pink-400' },
  Ballet:           { bg: 'bg-pink-100',    border: 'border-pink-300',    text: 'text-pink-700',    dot: 'bg-pink-400' },
  Jazz:             { bg: 'bg-purple-100',  border: 'border-purple-300',  text: 'text-purple-700',  dot: 'bg-purple-400' },
  'Contemporâneo':  { bg: 'bg-blue-100',    border: 'border-blue-300',    text: 'text-blue-700',    dot: 'bg-blue-400' },
  'Hip-Hop':        { bg: 'bg-orange-100',  border: 'border-orange-300',  text: 'text-orange-700',  dot: 'bg-orange-400' },
  'Hip Hop':        { bg: 'bg-orange-100',  border: 'border-orange-300',  text: 'text-orange-700',  dot: 'bg-orange-400' },
  Sapateado:        { bg: 'bg-amber-100',   border: 'border-amber-300',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  'Dança do Ventre':{ bg: 'bg-teal-100',    border: 'border-teal-300',    text: 'text-teal-700',    dot: 'bg-teal-400' },
  Forró:            { bg: 'bg-green-100',   border: 'border-green-300',   text: 'text-green-700',   dot: 'bg-green-400' },
  Samba:            { bg: 'bg-red-100',     border: 'border-red-300',     text: 'text-red-700',     dot: 'bg-red-400' },
  'K-Pop':          { bg: 'bg-violet-100',  border: 'border-violet-300',  text: 'text-violet-700',  dot: 'bg-violet-400' },
  Stiletto:         { bg: 'bg-rose-100',    border: 'border-rose-300',    text: 'text-rose-700',    dot: 'bg-rose-400' },
  'Baby Class':     { bg: 'bg-yellow-100',  border: 'border-yellow-300',  text: 'text-yellow-700',  dot: 'bg-yellow-400' },
};

const FALLBACK_COLORS: ModalityColor[] = [
  { bg: 'bg-cyan-100',    border: 'border-cyan-300',    text: 'text-cyan-700',    dot: 'bg-cyan-400' },
  { bg: 'bg-lime-100',    border: 'border-lime-300',    text: 'text-lime-700',    dot: 'bg-lime-400' },
  { bg: 'bg-fuchsia-100', border: 'border-fuchsia-300', text: 'text-fuchsia-700', dot: 'bg-fuchsia-400' },
  { bg: 'bg-sky-100',     border: 'border-sky-300',     text: 'text-sky-700',     dot: 'bg-sky-400' },
  { bg: 'bg-indigo-100',  border: 'border-indigo-300',  text: 'text-indigo-700',  dot: 'bg-indigo-400' },
];

const getModalityColor = (modality: string | null): ModalityColor => {
  if (!modality) return FALLBACK_COLORS[0];
  if (MODALITY_COLORS[modality]) return MODALITY_COLORS[modality];
  let hash = 0;
  for (let i = 0; i < modality.length; i++) hash = modality.charCodeAt(i) + ((hash << 5) - hash);
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
};

// ─── Date Helpers ─────────────────────────────────────────────────────────────

const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (date: Date, n: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const parseTime = (time: string) => {
  if (!time) return { hour: 0, minute: 0, totalMinutes: 0 };
  const [h, m] = time.split(':').map(Number);
  return { hour: h, minute: m, totalMinutes: h * 60 + m };
};

const fmtTime = (time: string): string => {
  const { hour, minute } = parseTime(time);
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
};

const fmtWeekRange = (weekStart: Date): string => {
  const end = addDays(weekStart, 6);
  const sDay = weekStart.getDate();
  const eDay = end.getDate();
  const sMon = MONTHS[weekStart.getMonth()];
  const eMon = MONTHS[end.getMonth()];
  const sYear = weekStart.getFullYear();
  const eYear = end.getFullYear();
  if (sYear !== eYear) return `${sDay} de ${sMon}, ${sYear} – ${eDay} de ${eMon}, ${eYear}`;
  if (weekStart.getMonth() !== end.getMonth()) return `${sDay} de ${sMon} – ${eDay} de ${eMon}, ${sYear}`;
  return `${sDay} – ${eDay} de ${sMon}, ${sYear}`;
};

// ─── Overlap Layout ───────────────────────────────────────────────────────────

interface LayoutItem { sched: ScheduleRow; col: number; totalCols: number }

const computeLayout = (daySchedules: ScheduleRow[]): LayoutItem[] => {
  const sorted = [...daySchedules].sort(
    (a, b) => parseTime(a.start_time).totalMinutes - parseTime(b.start_time).totalMinutes
  );
  const result: { sched: ScheduleRow; col: number }[] = [];
  const colEnds: number[] = [];

  sorted.forEach(sched => {
    const start = parseTime(sched.start_time).totalMinutes;
    const end   = parseTime(sched.end_time).totalMinutes;
    let col = colEnds.findIndex(e => e <= start);
    if (col === -1) col = colEnds.length;
    colEnds[col] = end;
    result.push({ sched, col });
  });

  const totalCols = colEnds.length || 1;
  return result.map(r => ({ ...r, totalCols }));
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const Agenda = ({ onChangeTab }: { onChangeTab?: (tab: string) => void }) => {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

  const [view, setView]           = useState<'week' | 'month'>('week');
  const [anchorDate, setAnchorDate] = useState(today);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<ScheduleRow | null>(null);
  const [modalStudents, setModalStudents]     = useState<StudentRow[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Filters
  const [filterModality, setFilterModality] = useState<string[]>([]);
  const [filterClass,    setFilterClass]    = useState<string[]>([]);
  const [filterTeacher,  setFilterTeacher]  = useState('');
  const [filterRoom,     setFilterRoom]     = useState('');

  // ── Data fetching ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('class_schedules')
        .select('id, weekday, start_time, end_time, classes(id, name, modality, teacher, room, is_active)');
      if (!error && data) {
        const active = (data as unknown as ScheduleRow[]).filter(s => s.classes?.is_active);
        setSchedules(active);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selected?.classes?.id) { setModalStudents([]); return; }
    (async () => {
      setLoadingStudents(true);
      const { data, error } = await supabase
        .from('student_classes')
        .select('students(id, full_name, status)')
        .eq('class_id', selected.classes!.id);
      if (!error && data) {
        setModalStudents(data.flatMap((r: any) => r.students ? [r.students] : []));
      } else {
        setModalStudents([]);
      }
      setLoadingStudents(false);
    })();
  }, [selected]);

  // ── Derived filter options ───────────────────────────────────────────────
  const allModalities = useMemo(() => {
    const s = new Set<string>();
    schedules.forEach(r => { if (r.classes?.modality) s.add(r.classes.modality); });
    return Array.from(s).sort();
  }, [schedules]);

  const allClasses = useMemo(() => {
    const s = new Set<string>();
    schedules.forEach(r => {
      if (!r.classes?.name) return;
      if (filterModality.length > 0 && !filterModality.includes(r.classes.modality ?? '')) return;
      s.add(r.classes.name);
    });
    return Array.from(s).sort();
  }, [schedules, filterModality]);

  const allTeachers = useMemo(() => {
    const s = new Set<string>();
    schedules.forEach(r => { if (r.classes?.teacher) s.add(r.classes.teacher); });
    return Array.from(s).sort();
  }, [schedules]);

  const allRooms = useMemo(() => {
    const s = new Set<string>();
    schedules.forEach(r => { if (r.classes?.room) s.add(r.classes.room); });
    return Array.from(s).sort();
  }, [schedules]);

  const filtered = useMemo(() => schedules.filter(s => {
    if (filterModality.length > 0 && !filterModality.includes(s.classes?.modality ?? '')) return false;
    if (filterClass.length > 0    && !filterClass.includes(s.classes?.name ?? ''))         return false;
    if (filterTeacher && s.classes?.teacher !== filterTeacher) return false;
    if (filterRoom    && s.classes?.room !== filterRoom)       return false;
    return true;
  }), [schedules, filterModality, filterClass, filterTeacher, filterRoom]);

  const hasFilters = filterModality.length > 0 || filterClass.length > 0 || filterTeacher || filterRoom;
  const clearFilters = () => { setFilterModality([]); setFilterClass([]); setFilterTeacher(''); setFilterRoom(''); };

  // ── Navigation ───────────────────────────────────────────────────────────
  const navigate = useCallback((dir: number) => {
    setAnchorDate(d => {
      if (view === 'week') return addDays(d, dir * 7);
      const nd = new Date(d);
      nd.setMonth(nd.getMonth() + dir);
      return nd;
    });
  }, [view]);

  const weekStart = useMemo(() => getWeekStart(anchorDate), [anchorDate]);
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const hours     = useMemo(() => Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i), []);

  const periodLabel = useMemo(() => {
    if (view === 'week') return fmtWeekRange(weekStart);
    return `${MONTHS[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`;
  }, [view, weekStart, anchorDate]);

  // ── Weekly data ──────────────────────────────────────────────────────────
  const byWeekday = useMemo(() => {
    const g = Array.from({ length: 7 }, () => [] as ScheduleRow[]);
    filtered.forEach(s => { if (s.weekday >= 0 && s.weekday <= 6) g[s.weekday].push(s); });
    return g;
  }, [filtered]);

  // ── Monthly data ─────────────────────────────────────────────────────────
  const monthDays = useMemo(() => {
    const y = anchorDate.getFullYear(), m = anchorDate.getMonth();
    const first = new Date(y, m, 1);
    const last  = new Date(y, m + 1, 0);
    const cells: (Date | null)[] = Array(first.getDay()).fill(null);
    for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(y, m, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [anchorDate]);

  const getModalitiesForWeekday = useCallback((wd: number) => {
    const s = new Set<string>();
    filtered.forEach(r => { if (r.weekday === wd && r.classes?.modality) s.add(r.classes.modality); });
    return Array.from(s);
  }, [filtered]);

  const legendModalities = useMemo(() => Array.from(
    new Set(schedules.map(s => s.classes?.modality).filter(Boolean) as string[])
  ).sort(), [schedules]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-[1400px] mx-auto space-y-4 pb-12">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <CalendarIcon size={24} className="text-secondary shrink-0 mt-1" />
          <div>
            <h2 className="text-2xl font-bold text-primary">Agenda de Turmas</h2>
            <p className="text-[13px] text-slate-400 mt-0.5">{periodLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* View segmented control */}
          <div className="flex items-center bg-slate-100 rounded-full p-1">
            {(['week', 'month'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'px-4 py-1.5 rounded-full text-sm font-semibold transition-all',
                  view === v
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {v === 'week' ? 'Semana' : 'Mês'}
              </button>
            ))}
          </div>

          {/* Period navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-all"
              aria-label="Período anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setAnchorDate(today)}
              className="px-3 py-1.5 rounded-xl text-sm font-semibold text-secondary border border-secondary/30 hover:bg-secondary/5 transition-all"
            >
              Hoje
            </button>
            <button
              onClick={() => navigate(1)}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-all"
              aria-label="Próximo período"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-[20px] border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] p-3 flex flex-wrap gap-2 items-center min-h-[56px]">
        {/* Modality */}
        <FilterSelect
          label="Modalidade"
          placeholder="+ Adicionar..."
          options={allModalities.filter(m => !filterModality.includes(m))}
          onSelect={v => setFilterModality(p => [...p, v])}
        />

        {/* Class */}
        <FilterSelect
          label="Turma"
          placeholder="+ Adicionar..."
          options={allClasses.filter(c => !filterClass.includes(c))}
          onSelect={v => setFilterClass(p => [...p, v])}
        />

        {/* Teacher */}
        <FilterSelect
          label="Professor"
          placeholder="Todos"
          options={allTeachers}
          value={filterTeacher}
          onSelect={setFilterTeacher}
          clearable
        />

        {/* Room (only if rooms exist) */}
        {allRooms.length > 0 && (
          <FilterSelect
            label="Sala"
            placeholder="Todas"
            options={allRooms}
            value={filterRoom}
            onSelect={setFilterRoom}
            clearable
          />
        )}

        {/* Active chips */}
        {filterModality.map(m => {
          const c = getModalityColor(m);
          return (
            <span key={m} className={cn('flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border', c.bg, c.border, c.text)}>
              {m}
              <button onClick={() => setFilterModality(p => p.filter(x => x !== m))}>
                <X size={11} />
              </button>
            </span>
          );
        })}
        {filterClass.map(c => (
          <span key={c} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-slate-100 border-slate-200 text-slate-700">
            {c}
            <button onClick={() => setFilterClass(p => p.filter(x => x !== c))}>
              <X size={11} />
            </button>
          </span>
        ))}

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="ml-auto flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors"
          >
            <X size={12} />
            Limpar filtros
          </button>
        )}
      </div>

      {/* ── Calendar ── */}
      <div className="bg-white rounded-[20px] shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-slate-50 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-300">
            <Loader2 size={36} className="animate-spin mb-3" />
            <p className="text-sm font-medium">Carregando horários...</p>
          </div>
        ) : view === 'week' ? (
          <WeeklyView
            weekDates={weekDates}
            hours={hours}
            byWeekday={byWeekday}
            today={today}
            onSelect={setSelected}
          />
        ) : (
          <MonthlyView
            anchorDate={anchorDate}
            monthDays={monthDays}
            today={today}
            getModalitiesForWeekday={getModalitiesForWeekday}
            onSelectDay={date => { setAnchorDate(date); setView('week'); }}
          />
        )}
      </div>

      {/* ── Legend ── */}
      {legendModalities.length > 0 && (
        <div className="bg-white rounded-[20px] border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] px-5 py-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Legenda de Modalidades</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {legendModalities.map(mod => {
              const c = getModalityColor(mod);
              return (
                <div key={mod} className="flex items-center gap-2">
                  <span className={cn('w-3 h-3 rounded-full shrink-0', c.dot)} />
                  <span className="text-xs font-medium text-slate-600">{mod}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Detail Drawer ── */}
      {selected && (
        <ScheduleDrawer
          schedule={selected}
          students={modalStudents}
          loadingStudents={loadingStudents}
          onClose={() => setSelected(null)}
          onGoToClass={onChangeTab ? () => { onChangeTab('classes'); setSelected(null); } : undefined}
        />
      )}
    </div>
  );
};

// ─── Filter Select ────────────────────────────────────────────────────────────

const FilterSelect = ({
  label, placeholder, options, value = '', onSelect, clearable = false,
}: {
  label: string;
  placeholder: string;
  options: string[];
  value?: string;
  onSelect: (v: string) => void;
  clearable?: boolean;
}) => (
  <div className="flex items-center gap-1.5">
    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{label}</span>
    <select
      value={value}
      onChange={e => onSelect(e.target.value)}
      className="text-[13px] border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-secondary/20 min-w-[130px] max-w-[160px]"
    >
      <option value="">{placeholder}</option>
      {clearable && value && <option value="">— Limpar —</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

// ─── Weekly View ──────────────────────────────────────────────────────────────

const WeeklyView = ({
  weekDates, hours, byWeekday, today, onSelect,
}: {
  weekDates: Date[];
  hours: number[];
  byWeekday: ScheduleRow[][];
  today: Date;
  onSelect: (s: ScheduleRow) => void;
}) => (
  <div className="flex flex-col" style={{ height: '780px' }}>
    {/* Day headers */}
    <div className="flex border-b border-slate-100 bg-slate-50/60 shrink-0">
      <div className="w-14 shrink-0 border-r border-slate-100" />
      {weekDates.map((date, idx) => {
        const isToday = isSameDay(date, today);
        return (
          <div key={idx} className={cn(
            'flex-1 py-2 text-center border-r border-slate-100 last:border-r-0',
            isToday && 'bg-secondary/5',
          )}>
            <div className={cn('text-[10px] font-extrabold uppercase tracking-wider', isToday ? 'text-secondary' : 'text-slate-400')}>
              {WEEKDAYS_SHORT[idx]}
            </div>
            <div className={cn(
              'mx-auto mt-0.5 w-7 h-7 rounded-full flex items-center justify-center text-[15px] font-bold',
              isToday ? 'bg-secondary text-white' : 'text-slate-700',
            )}>
              {date.getDate()}
            </div>
          </div>
        );
      })}
    </div>

    {/* Scrollable time grid */}
    <div className="flex-1 overflow-y-auto">
      <div className="flex">
        {/* Time axis */}
        <div className="w-14 shrink-0 border-r border-slate-100 bg-white sticky left-0 z-10">
          {hours.map(h => (
            <div key={h} className="relative" style={{ height: `${HOUR_PX}px` }}>
              <span className="absolute -top-2.5 right-2 text-[10px] font-bold text-slate-300 select-none">
                {h.toString().padStart(2, '0')}:00
              </span>
            </div>
          ))}
        </div>

        {/* Grid + events */}
        <div className="flex-1 relative">
          {/* Horizontal hour lines */}
          <div className="absolute inset-0 pointer-events-none z-0 flex flex-col">
            {hours.map(h => (
              <div key={h} className="border-b border-slate-100" style={{ height: `${HOUR_PX}px` }} />
            ))}
          </div>

          {/* Vertical day dividers + today highlight */}
          <div className="absolute inset-0 pointer-events-none z-0 flex">
            {weekDates.map((date, idx) => (
              <div key={idx} className={cn(
                'flex-1 border-r border-slate-100 last:border-r-0',
                isSameDay(date, today) && 'bg-secondary/[0.03]',
              )} />
            ))}
          </div>

          {/* Events */}
          <div className="absolute inset-0 z-10 flex">
            {byWeekday.map((daySchedules, dayIdx) => {
              const layout = computeLayout(daySchedules);
              return (
                <div key={dayIdx} className="flex-1 relative">
                  {layout.map(({ sched, col, totalCols }) => {
                    const start = parseTime(sched.start_time);
                    const end   = parseTime(sched.end_time);
                    if (start.hour < START_HOUR || start.hour > END_HOUR) return null;

                    const topPx    = (start.hour - START_HOUR) * HOUR_PX + (start.minute / 60) * HOUR_PX;
                    const heightPx = Math.max(((end.totalMinutes - start.totalMinutes) / 60) * HOUR_PX, 18);
                    const colW     = 100 / totalCols;
                    const c        = getModalityColor(sched.classes?.modality ?? null);

                    return (
                      <div
                        key={sched.id}
                        onClick={() => onSelect(sched)}
                        style={{
                          top:    `${topPx}px`,
                          height: `${heightPx}px`,
                          left:   `calc(${col * colW}% + 2px)`,
                          width:  `calc(${colW}% - 4px)`,
                        }}
                        className={cn(
                          'absolute rounded-lg border p-1.5 overflow-hidden flex flex-col gap-0.5',
                          'hover:shadow-md hover:z-20 transition-all cursor-pointer shadow-sm',
                          c.bg, c.border,
                        )}
                      >
                        <span className={cn('text-[10px] font-extrabold leading-tight truncate', c.text)}>
                          {sched.classes?.name}
                        </span>
                        <span className={cn('text-[9px] font-semibold opacity-70 leading-none', c.text)}>
                          {fmtTime(sched.start_time)} – {fmtTime(sched.end_time)}
                        </span>
                        {heightPx >= 50 && sched.classes?.teacher && (
                          <div className={cn('flex items-center gap-0.5 text-[9px] opacity-75 truncate mt-auto', c.text)}>
                            <Users size={9} className="shrink-0" />
                            <span className="truncate">{sched.classes.teacher}</span>
                          </div>
                        )}
                        {heightPx >= 66 && sched.classes?.room && (
                          <div className={cn('flex items-center gap-0.5 text-[9px] opacity-75 truncate', c.text)}>
                            <MapPin size={9} className="shrink-0" />
                            <span className="truncate">{sched.classes.room}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  </div>
);

// ─── Monthly View ─────────────────────────────────────────────────────────────

const MonthlyView = ({
  anchorDate, monthDays, today, getModalitiesForWeekday, onSelectDay,
}: {
  anchorDate: Date;
  monthDays: (Date | null)[];
  today: Date;
  getModalitiesForWeekday: (wd: number) => string[];
  onSelectDay: (d: Date) => void;
}) => (
  <div className="p-4">
    {/* Weekday headers */}
    <div className="grid grid-cols-7 mb-2">
      {WEEKDAYS_SHORT.map(d => (
        <div key={d} className="text-center text-[11px] font-extrabold uppercase tracking-wider text-slate-400 py-1.5">
          {d}
        </div>
      ))}
    </div>

    {/* Cells */}
    <div className="grid grid-cols-7 gap-1">
      {monthDays.map((date, idx) => {
        if (!date) return <div key={idx} className="min-h-[80px]" />;

        const isToday   = isSameDay(date, today);
        const isCurMon  = date.getMonth() === anchorDate.getMonth();
        const modalities = getModalitiesForWeekday(date.getDay());

        return (
          <button
            key={idx}
            onClick={() => onSelectDay(date)}
            className={cn(
              'p-2 rounded-xl text-left transition-all hover:bg-slate-50 min-h-[80px] flex flex-col',
              isToday && 'ring-2 ring-secondary/40 bg-secondary/5 hover:bg-secondary/5',
              !isCurMon && 'opacity-35',
            )}
          >
            <span className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
              isToday ? 'bg-secondary text-white' : 'text-slate-700',
            )}>
              {date.getDate()}
            </span>

            {modalities.length > 0 && (
              <div className="flex flex-wrap gap-0.5 mt-1.5">
                {modalities.slice(0, 4).map(mod => {
                  const c = getModalityColor(mod);
                  return <span key={mod} title={mod} className={cn('w-2 h-2 rounded-full', c.dot)} />;
                })}
                {modalities.length > 4 && (
                  <span className="text-[9px] text-slate-400 font-bold">+{modalities.length - 4}</span>
                )}
              </div>
            )}

            {modalities.length > 0 && (
              <div className="mt-1 space-y-0.5 w-full overflow-hidden">
                {modalities.slice(0, 2).map(mod => {
                  const c = getModalityColor(mod);
                  return (
                    <div key={mod} className={cn(
                      'text-[9px] font-semibold px-1.5 py-0.5 rounded-md truncate border',
                      c.bg, c.text, c.border,
                    )}>
                      {mod}
                    </div>
                  );
                })}
                {modalities.length > 2 && (
                  <div className="text-[9px] font-semibold text-slate-400 pl-1">
                    +{modalities.length - 2} mais
                  </div>
                )}
              </div>
            )}
          </button>
        );
      })}
    </div>
  </div>
);

// ─── Schedule Detail Drawer ───────────────────────────────────────────────────

const ScheduleDrawer = ({
  schedule, students, loadingStudents, onClose, onGoToClass,
}: {
  schedule: ScheduleRow;
  students: StudentRow[];
  loadingStudents: boolean;
  onClose: () => void;
  onGoToClass?: () => void;
}) => {
  const cls = schedule.classes;
  const c   = getModalityColor(cls?.modality ?? null);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="relative z-10 w-full max-w-[420px] bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className={cn('px-6 py-5 shrink-0', c.bg)}>
          <div className="flex items-start justify-between">
            <div className="flex-1 mr-4 min-w-0">
              {cls?.modality && (
                <span className={cn('text-[10px] font-extrabold uppercase tracking-wider', c.text)}>
                  {cls.modality}
                </span>
              )}
              <h3 className="text-xl font-bold text-primary mt-0.5 truncate">{cls?.name}</h3>
              <p className="text-sm text-slate-500 mt-1">
                {WEEKDAYS_FULL[schedule.weekday]}
                {' · '}
                {fmtTime(schedule.start_time)} – {fmtTime(schedule.end_time)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-black/10 text-slate-500 transition-all shrink-0"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Class info */}
        <div className="px-6 py-4 border-b border-slate-100 space-y-3 shrink-0">
          {cls?.teacher && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                <GraduationCap size={16} className="text-secondary" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Professor</p>
                <p className="text-sm font-semibold text-slate-700">{cls.teacher}</p>
              </div>
            </div>
          )}
          {cls?.room && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                <MapPin size={16} className="text-secondary" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sala / Espaço</p>
                <p className="text-sm font-semibold text-slate-700">{cls.room}</p>
              </div>
            </div>
          )}
        </div>

        {/* Enrolled students */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Users size={15} className="text-slate-400" />
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Alunos Matriculados
              {!loadingStudents && ` (${students.length})`}
            </p>
          </div>

          {loadingStudents ? (
            <div className="flex items-center gap-2 text-slate-300 text-sm py-4">
              <Loader2 size={16} className="animate-spin" />
              <span>Carregando alunos...</span>
            </div>
          ) : students.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Nenhum aluno matriculado</p>
          ) : (
            <div className="space-y-2">
              {students.map(s => (
                <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all">
                  <div className="w-8 h-8 rounded-full bg-secondary/15 flex items-center justify-center shrink-0">
                    <span className="text-[11px] font-bold text-secondary">
                      {s.full_name?.split(' ').slice(0, 2).map((n: string) => n[0]).join('')}
                    </span>
                  </div>
                  <p className="flex-1 text-sm font-semibold text-slate-700 truncate">{s.full_name}</p>
                  <span className={cn(
                    'text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
                    s.status?.toLowerCase() === 'ativo'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-100 text-slate-500',
                  )}>
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer CTA */}
        {onGoToClass && (
          <div className="px-6 py-4 border-t border-slate-100 shrink-0">
            <button
              onClick={onGoToClass}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-secondary text-white font-semibold rounded-xl hover:bg-primary transition-all text-sm"
            >
              <BookOpen size={16} />
              Ir para a Turma
              <ExternalLink size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
