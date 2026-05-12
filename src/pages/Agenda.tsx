import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2,
  MapPin, Users, X, GraduationCap, BookOpen, ExternalLink,
  ClipboardCheck, Filter,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import {
  MONTHS,
  WEEKDAYS_LONG as WEEKDAYS_FULL,
  WEEKDAY_SHORT as WEEKDAYS_SHORT,
  fmtTime,
} from '../lib/format';
import {
  getModalityColorFull as getModalityColor,
  type ModalityColorFull as ModalityColor,
} from '../lib/colors';
import { BottomSheet } from '../components/ui/BottomSheet';

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

const START_HOUR = 7;
const END_HOUR = 22;
const HOUR_PX = 60;

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

const toDateInput = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const fmtDayLabel = (d: Date) =>
  `${WEEKDAYS_FULL[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3).toLowerCase()}`;

const fmtDayShort = (d: Date) =>
  `${WEEKDAYS_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3).toLowerCase()}`;

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

// ─── Overlap Layout (desktop week grid only) ─────────────────────────────────

interface LayoutItem { sched: ScheduleRow; col: number; totalCols: number }

const computeLayout = (daySchedules: ScheduleRow[]): LayoutItem[] => {
  const sorted = [...daySchedules].sort(
    (a, b) => parseTime(a.start_time).totalMinutes - parseTime(b.start_time).totalMinutes,
  );
  const result: { sched: ScheduleRow; col: number }[] = [];
  const colEnds: number[] = [];

  sorted.forEach(sched => {
    const start = parseTime(sched.start_time).totalMinutes;
    const end = parseTime(sched.end_time).totalMinutes;
    let col = colEnds.findIndex(e => e <= start);
    if (col === -1) col = colEnds.length;
    colEnds[col] = end;
    result.push({ sched, col });
  });

  const totalCols = colEnds.length || 1;
  return result.map(r => ({ ...r, totalCols }));
};

// ─── Main Component ───────────────────────────────────────────────────────────

type ViewMode = 'day' | 'week' | 'month';

const initialView = (): ViewMode => {
  if (typeof window === 'undefined') return 'week';
  return window.matchMedia('(min-width: 768px)').matches ? 'week' : 'day';
};

export const Agenda = ({ onChangeTab }: { onChangeTab?: (tab: string) => void }) => {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

  const [view, setView] = useState<ViewMode>(initialView);
  const [anchorDate, setAnchorDate] = useState(today);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ScheduleRow | null>(null);
  const [modalStudents, setModalStudents] = useState<StudentRow[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [filterModality, setFilterModality] = useState<string[]>([]);
  const [filterClass, setFilterClass] = useState<string[]>([]);
  const [filterTeacher, setFilterTeacher] = useState('');
  const [filterRoom, setFilterRoom] = useState('');

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
        setModalStudents(data.flatMap((r: any) => (r.students ? [r.students] : [])));
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
    if (filterClass.length > 0 && !filterClass.includes(s.classes?.name ?? '')) return false;
    if (filterTeacher && s.classes?.teacher !== filterTeacher) return false;
    if (filterRoom && s.classes?.room !== filterRoom) return false;
    return true;
  }), [schedules, filterModality, filterClass, filterTeacher, filterRoom]);

  const hasFilters = filterModality.length > 0 || filterClass.length > 0 || !!filterTeacher || !!filterRoom;
  const clearFilters = () => { setFilterModality([]); setFilterClass([]); setFilterTeacher(''); setFilterRoom(''); };

  // ── Navigation ───────────────────────────────────────────────────────────
  const navigate = useCallback((dir: number) => {
    setAnchorDate(d => {
      if (view === 'day') return addDays(d, dir);
      if (view === 'week') return addDays(d, dir * 7);
      const nd = new Date(d);
      nd.setMonth(nd.getMonth() + dir);
      return nd;
    });
  }, [view]);

  const weekStart = useMemo(() => getWeekStart(anchorDate), [anchorDate]);
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const hours = useMemo(() => Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i), []);

  const navLabel = useMemo(() => {
    if (view === 'day') return fmtDayLabel(anchorDate);
    if (view === 'week') return fmtWeekRange(weekStart);
    return `${MONTHS[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`;
  }, [view, anchorDate, weekStart]);

  // ── Day data ─────────────────────────────────────────────────────────────
  const daySchedules = useMemo(() => {
    const wd = anchorDate.getDay();
    return filtered
      .filter(s => s.weekday === wd)
      .sort((a, b) => parseTime(a.start_time).totalMinutes - parseTime(b.start_time).totalMinutes);
  }, [filtered, anchorDate]);

  // ── Weekly data ──────────────────────────────────────────────────────────
  const byWeekday = useMemo(() => {
    const g = Array.from({ length: 7 }, () => [] as ScheduleRow[]);
    filtered.forEach(s => { if (s.weekday >= 0 && s.weekday <= 6) g[s.weekday].push(s); });
    g.forEach(arr => arr.sort((a, b) => parseTime(a.start_time).totalMinutes - parseTime(b.start_time).totalMinutes));
    return g;
  }, [filtered]);

  // ── Monthly data ─────────────────────────────────────────────────────────
  const monthDays = useMemo(() => {
    const y = anchorDate.getFullYear(), m = anchorDate.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const cells: (Date | null)[] = Array(first.getDay()).fill(null);
    for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(y, m, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [anchorDate]);

  const monthDaysWithEvents = useMemo(() => {
    const y = anchorDate.getFullYear(), m = anchorDate.getMonth();
    const last = new Date(y, m + 1, 0);
    const days: { date: Date; schedules: ScheduleRow[] }[] = [];
    for (let d = 1; d <= last.getDate(); d++) {
      const date = new Date(y, m, d);
      const wd = date.getDay();
      const schedsForDay = byWeekday[wd];
      if (schedsForDay.length > 0) days.push({ date, schedules: schedsForDay });
    }
    return days;
  }, [anchorDate, byWeekday]);

  const getModalitiesForWeekday = useCallback((wd: number) => {
    const s = new Set<string>();
    filtered.forEach(r => { if (r.weekday === wd && r.classes?.modality) s.add(r.classes.modality); });
    return Array.from(s);
  }, [filtered]);

  const legendModalities = useMemo(() => Array.from(
    new Set(schedules.map(s => s.classes?.modality).filter(Boolean) as string[]),
  ).sort(), [schedules]);

  const isAnchorToday = isSameDay(anchorDate, today);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-[1400px] mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 md:mb-5">
        <CalendarIcon size={24} className="text-secondary shrink-0" />
        <div className="min-w-0">
          <h2 className="text-xl md:text-2xl font-bold text-primary leading-tight">Agenda</h2>
          <p className="text-[13px] text-slate-400 mt-0.5 truncate">{navLabel}</p>
        </div>
      </div>

      {/* View toggle + filter trigger */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div
          className="inline-flex items-center bg-slate-100 rounded-full p-1"
          role="tablist"
          aria-label="Visualização"
        >
          {(['day', 'week', 'month'] as const).map(v => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn(
                'min-h-10 px-3 sm:px-4 rounded-full text-xs sm:text-sm font-semibold transition-all',
                view === v ? 'bg-white text-primary shadow-sm' : 'text-slate-500',
              )}
            >
              {v === 'day' ? 'Dia' : v === 'week' ? 'Semana' : 'Mês'}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowFilters(true)}
          className="min-h-10 inline-flex items-center gap-1.5 px-3 rounded-full border border-slate-200 text-xs sm:text-sm font-bold text-primary bg-white"
        >
          <Filter size={14} /> Filtros
          {hasFilters && <span className="w-2 h-2 rounded-full bg-secondary" />}
        </button>
      </div>

      {/* Date navigation */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] p-2 mb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Período anterior"
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 shrink-0"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          onClick={() => setShowDatePicker(true)}
          className="flex-1 min-h-10 px-2 text-sm font-bold text-primary text-center truncate"
        >
          {navLabel}
        </button>
        {!isAnchorToday && (
          <button
            type="button"
            onClick={() => setAnchorDate(today)}
            className="min-h-10 px-3 text-xs font-bold text-secondary border border-secondary/30 rounded-full hover:bg-secondary/5 shrink-0"
          >
            Hoje
          </button>
        )}
        <button
          type="button"
          onClick={() => navigate(1)}
          aria-label="Próximo período"
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 shrink-0"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Active filter chips */}
      {hasFilters && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {filterModality.map(m => {
            const c = getModalityColor(m);
            return (
              <span key={m} className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border', c.bg, c.border, c.text)}>
                {m}
                <button
                  type="button"
                  aria-label={`Remover ${m}`}
                  onClick={() => setFilterModality(p => p.filter(x => x !== m))}
                  className="w-6 h-6 -mr-1 flex items-center justify-center"
                >
                  <X size={11} />
                </button>
              </span>
            );
          })}
          {filterClass.map(c => (
            <span key={c} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-slate-100 border-slate-200 text-slate-700">
              {c}
              <button
                type="button"
                aria-label={`Remover ${c}`}
                onClick={() => setFilterClass(p => p.filter(x => x !== c))}
                className="w-6 h-6 -mr-1 flex items-center justify-center"
              >
                <X size={11} />
              </button>
            </span>
          ))}
          {filterTeacher && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-slate-100 border-slate-200 text-slate-700">
              Prof: {filterTeacher}
              <button
                type="button"
                onClick={() => setFilterTeacher('')}
                className="w-6 h-6 -mr-1 flex items-center justify-center"
              >
                <X size={11} />
              </button>
            </span>
          )}
          {filterRoom && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-slate-100 border-slate-200 text-slate-700">
              Sala: {filterRoom}
              <button
                type="button"
                onClick={() => setFilterRoom('')}
                className="w-6 h-6 -mr-1 flex items-center justify-center"
              >
                <X size={11} />
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={clearFilters}
            className="ml-auto text-xs font-semibold text-slate-400 hover:text-red-500"
          >
            Limpar todos
          </button>
        </div>
      )}

      {/* Calendar content */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 flex flex-col items-center justify-center h-64 text-slate-300">
          <Loader2 size={36} className="animate-spin mb-3" />
          <p className="text-sm font-medium">Carregando horários...</p>
        </div>
      ) : (
        <>
          {/* DAY view (both breakpoints) */}
          {view === 'day' && (
            <DayList
              schedules={daySchedules}
              date={anchorDate}
              onSelect={setSelected}
            />
          )}

          {/* WEEK view — mobile list, desktop grid */}
          {view === 'week' && (
            <>
              <div className="md:hidden">
                <WeekList weekDates={weekDates} byWeekday={byWeekday} today={today} onSelect={setSelected} />
              </div>
              <div className="hidden md:block bg-white rounded-[20px] shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-slate-50 overflow-hidden">
                <WeeklyView
                  weekDates={weekDates}
                  hours={hours}
                  byWeekday={byWeekday}
                  today={today}
                  onSelect={setSelected}
                />
              </div>
            </>
          )}

          {/* MONTH view — mobile list, desktop grid */}
          {view === 'month' && (
            <>
              <div className="md:hidden">
                <MonthList days={monthDaysWithEvents} today={today} onSelect={setSelected} />
              </div>
              <div className="hidden md:block bg-white rounded-[20px] shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-slate-50 overflow-hidden">
                <MonthlyView
                  anchorDate={anchorDate}
                  monthDays={monthDays}
                  today={today}
                  getModalitiesForWeekday={getModalitiesForWeekday}
                  onSelectDay={date => { setAnchorDate(date); setView('week'); }}
                />
              </div>
            </>
          )}
        </>
      )}

      {/* Legend */}
      {legendModalities.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] px-4 py-3 mt-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Legenda</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
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

      {/* Date picker sheet */}
      <BottomSheet open={showDatePicker} onClose={() => setShowDatePicker(false)} title="Escolher data">
        <div className="space-y-4 pb-2">
          <input
            type="date"
            value={toDateInput(anchorDate)}
            onChange={e => {
              const d = new Date(e.target.value + 'T00:00:00');
              if (!isNaN(d.getTime())) {
                setAnchorDate(d);
                setShowDatePicker(false);
              }
            }}
            className="w-full h-12 rounded-xl border border-slate-200 px-4 text-base text-slate-700 outline-none focus:ring-1 focus:ring-secondary/50 focus:border-secondary"
          />
          <button
            type="button"
            onClick={() => { setAnchorDate(today); setShowDatePicker(false); }}
            className="w-full min-h-11 rounded-full bg-secondary text-white font-bold text-sm"
          >
            Ir para hoje
          </button>
        </div>
      </BottomSheet>

      {/* Filters sheet */}
      <BottomSheet open={showFilters} onClose={() => setShowFilters(false)} title="Filtros" maxHeight="90dvh">
        <div className="space-y-4 pb-2">
          <FilterMultiSelect
            label="Modalidades"
            options={allModalities}
            values={filterModality}
            onChange={setFilterModality}
          />
          <FilterMultiSelect
            label="Turmas"
            options={allClasses}
            values={filterClass}
            onChange={setFilterClass}
          />
          <FilterSingleSelect
            label="Professor(a)"
            options={allTeachers}
            value={filterTeacher}
            onChange={setFilterTeacher}
          />
          {allRooms.length > 0 && (
            <FilterSingleSelect
              label="Sala"
              options={allRooms}
              value={filterRoom}
              onChange={setFilterRoom}
            />
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => { clearFilters(); setShowFilters(false); }}
              className="flex-1 min-h-11 rounded-full border border-slate-200 text-primary font-bold text-sm"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={() => setShowFilters(false)}
              className="flex-1 min-h-11 rounded-full bg-secondary text-white font-bold text-sm"
            >
              Aplicar
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Schedule detail sheet */}
      <ScheduleSheet
        schedule={selected}
        students={modalStudents}
        loadingStudents={loadingStudents}
        onClose={() => setSelected(null)}
        onGoToClass={onChangeTab ? () => { onChangeTab('classes'); setSelected(null); } : undefined}
        onGoToAttendance={onChangeTab ? () => { onChangeTab('attendance'); setSelected(null); } : undefined}
      />
    </div>
  );
};

// ─── Filter helpers (BottomSheet) ────────────────────────────────────────────

const FilterMultiSelect = ({
  label, options, values, onChange,
}: {
  label: string;
  options: string[];
  values: string[];
  onChange: (v: string[]) => void;
}) => {
  if (options.length === 0) return null;
  return (
    <div>
      <p className="text-[13px] font-bold text-primary mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => {
          const active = values.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(active ? values.filter(v => v !== opt) : [...values, opt])}
              className={cn(
                'min-h-10 px-3 rounded-full text-sm font-semibold border transition-all',
                active ? 'bg-secondary text-white border-secondary' : 'bg-white text-slate-700 border-slate-200',
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const FilterSingleSelect = ({
  label, options, value, onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) => {
  if (options.length === 0) return null;
  return (
    <div>
      <p className="text-[13px] font-bold text-primary mb-2">{label}</p>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full h-11 rounded-xl border border-slate-200 px-3.5 text-base bg-white text-slate-700 outline-none focus:ring-1 focus:ring-secondary/50 focus:border-secondary"
      >
        <option value="">Todos</option>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
};

// ─── Day List (mobile + desktop primary day view) ───────────────────────────

const DayList = ({
  schedules, date, onSelect,
}: {
  schedules: ScheduleRow[];
  date: Date;
  onSelect: (s: ScheduleRow) => void;
}) => {
  const isToday = isSameDay(date, new Date(new Date().setHours(0, 0, 0, 0)));

  if (schedules.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 flex flex-col items-center justify-center py-16 text-center px-6">
        <CalendarIcon size={40} className="text-slate-200 mb-3" />
        <p className="text-sm font-semibold text-slate-500">
          {isToday ? 'Nenhuma aula hoje' : 'Nenhuma aula neste dia'}
        </p>
        <p className="text-xs text-slate-400 mt-1">Os horários cadastrados não caem neste dia.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {schedules.map(s => <ScheduleCard key={s.id} schedule={s} onClick={() => onSelect(s)} />)}
    </div>
  );
};

// ─── Schedule Card (used in Day/Week/Month list views) ──────────────────────

const ScheduleCard = ({
  schedule, onClick,
}: {
  schedule: ScheduleRow;
  onClick: () => void;
}) => {
  const cls = schedule.classes;
  const c = getModalityColor(cls?.modality ?? null);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full min-h-16 text-left bg-white rounded-2xl border border-slate-100 border-l-4 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] p-4 active:scale-[0.99] transition-transform',
        c.border.replace('border-', 'border-l-'),
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-start shrink-0">
          <span className="text-sm font-bold text-primary tabular-nums">{fmtTime(schedule.start_time)}</span>
          <span className="text-xs text-slate-400 tabular-nums">{fmtTime(schedule.end_time)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-primary truncate">{cls?.name ?? '—'}</p>
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            {cls?.modality && (
              <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', c.bg, c.text)}>
                {cls.modality}
              </span>
            )}
            {cls?.teacher && (
              <span className="text-xs text-slate-500 inline-flex items-center gap-1">
                <Users size={11} /> {cls.teacher}
              </span>
            )}
            {cls?.room && (
              <span className="text-xs text-slate-500 inline-flex items-center gap-1">
                <MapPin size={11} /> {cls.room}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
};

// ─── Week List (mobile fallback for Week view) ──────────────────────────────

const WeekList = ({
  weekDates, byWeekday, today, onSelect,
}: {
  weekDates: Date[];
  byWeekday: ScheduleRow[][];
  today: Date;
  onSelect: (s: ScheduleRow) => void;
}) => (
  <div className="space-y-4">
    {weekDates.map((date, idx) => {
      const list = byWeekday[date.getDay()];
      if (list.length === 0) return null;
      const isToday = isSameDay(date, today);
      return (
        <div key={idx}>
          <div className={cn(
            'sticky top-0 z-10 bg-slate-50/95 backdrop-blur px-3 py-2 mb-2 rounded-lg flex items-center gap-2',
            isToday && 'bg-secondary/10',
          )}>
            <span className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
              isToday ? 'bg-secondary text-white' : 'bg-white text-slate-700 border border-slate-200',
            )}>
              {date.getDate()}
            </span>
            <span className={cn('text-xs font-bold uppercase tracking-wider', isToday ? 'text-secondary' : 'text-slate-500')}>
              {fmtDayShort(date)}
            </span>
            <span className="ml-auto text-xs text-slate-400">{list.length} {list.length === 1 ? 'aula' : 'aulas'}</span>
          </div>
          <div className="space-y-2">
            {list.map(s => <ScheduleCard key={`${s.id}-${date.getTime()}`} schedule={s} onClick={() => onSelect(s)} />)}
          </div>
        </div>
      );
    })}
  </div>
);

// ─── Month List (mobile fallback for Month view) ────────────────────────────

const MonthList = ({
  days, today, onSelect,
}: {
  days: { date: Date; schedules: ScheduleRow[] }[];
  today: Date;
  onSelect: (s: ScheduleRow) => void;
}) => {
  if (days.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 flex flex-col items-center justify-center py-16 text-center px-6">
        <CalendarIcon size={40} className="text-slate-200 mb-3" />
        <p className="text-sm font-semibold text-slate-500">Nenhuma aula neste mês</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {days.map(({ date, schedules }) => {
        const isToday = isSameDay(date, today);
        return (
          <div key={date.toISOString()}>
            <div className={cn(
              'sticky top-0 z-10 bg-slate-50/95 backdrop-blur px-3 py-2 mb-2 rounded-lg flex items-center gap-2',
              isToday && 'bg-secondary/10',
            )}>
              <span className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                isToday ? 'bg-secondary text-white' : 'bg-white text-slate-700 border border-slate-200',
              )}>
                {date.getDate()}
              </span>
              <span className={cn('text-xs font-bold uppercase tracking-wider', isToday ? 'text-secondary' : 'text-slate-500')}>
                {fmtDayShort(date)}
              </span>
              <span className="ml-auto text-xs text-slate-400">{schedules.length} {schedules.length === 1 ? 'aula' : 'aulas'}</span>
            </div>
            <div className="space-y-2">
              {schedules.map(s => <ScheduleCard key={`${s.id}-${date.toISOString()}`} schedule={s} onClick={() => onSelect(s)} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Weekly View (desktop only, unchanged from original) ────────────────────

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
    <div className="flex-1 overflow-y-auto">
      <div className="flex">
        <div className="w-14 shrink-0 border-r border-slate-100 bg-white sticky left-0 z-10">
          {hours.map(h => (
            <div key={h} className="relative" style={{ height: `${HOUR_PX}px` }}>
              <span className="absolute -top-2.5 right-2 text-[10px] font-bold text-slate-300 select-none">
                {h.toString().padStart(2, '0')}:00
              </span>
            </div>
          ))}
        </div>
        <div className="flex-1 relative">
          <div className="absolute inset-0 pointer-events-none z-0 flex flex-col">
            {hours.map(h => (
              <div key={h} className="border-b border-slate-100" style={{ height: `${HOUR_PX}px` }} />
            ))}
          </div>
          <div className="absolute inset-0 pointer-events-none z-0 flex">
            {weekDates.map((date, idx) => (
              <div key={idx} className={cn(
                'flex-1 border-r border-slate-100 last:border-r-0',
                isSameDay(date, today) && 'bg-secondary/[0.03]',
              )} />
            ))}
          </div>
          <div className="absolute inset-0 z-10 flex">
            {byWeekday.map((daySchedules, dayIdx) => {
              const layout = computeLayout(daySchedules);
              return (
                <div key={dayIdx} className="flex-1 relative">
                  {layout.map(({ sched, col, totalCols }) => {
                    const start = parseTime(sched.start_time);
                    const end = parseTime(sched.end_time);
                    if (start.hour < START_HOUR || start.hour > END_HOUR) return null;

                    const topPx = (start.hour - START_HOUR) * HOUR_PX + (start.minute / 60) * HOUR_PX;
                    const heightPx = Math.max(((end.totalMinutes - start.totalMinutes) / 60) * HOUR_PX, 18);
                    const colW = 100 / totalCols;
                    const c = getModalityColor(sched.classes?.modality ?? null);

                    return (
                      <div
                        key={sched.id}
                        onClick={() => onSelect(sched)}
                        style={{
                          top: `${topPx}px`,
                          height: `${heightPx}px`,
                          left: `calc(${col * colW}% + 2px)`,
                          width: `calc(${colW}% - 4px)`,
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

// ─── Monthly View (desktop only, unchanged) ─────────────────────────────────

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
    <div className="grid grid-cols-7 mb-2">
      {WEEKDAYS_SHORT.map(d => (
        <div key={d} className="text-center text-[11px] font-extrabold uppercase tracking-wider text-slate-400 py-1.5">
          {d}
        </div>
      ))}
    </div>
    <div className="grid grid-cols-7 gap-1">
      {monthDays.map((date, idx) => {
        if (!date) return <div key={idx} className="min-h-[80px]" />;
        const isToday = isSameDay(date, today);
        const isCurMon = date.getMonth() === anchorDate.getMonth();
        const modalities = getModalitiesForWeekday(date.getDay());
        return (
          <button
            key={idx}
            type="button"
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

// ─── Schedule Detail Sheet (BottomSheet replaces side drawer) ───────────────

const ScheduleSheet = ({
  schedule, students, loadingStudents, onClose, onGoToClass, onGoToAttendance,
}: {
  schedule: ScheduleRow | null;
  students: StudentRow[];
  loadingStudents: boolean;
  onClose: () => void;
  onGoToClass?: () => void;
  onGoToAttendance?: () => void;
}) => {
  if (!schedule) {
    return <BottomSheet open={false} onClose={onClose} maxHeight="90dvh">{null}</BottomSheet>;
  }
  const cls = schedule.classes;
  const c = getModalityColor(cls?.modality ?? null);

  return (
    <BottomSheet open onClose={onClose} title={cls?.name ?? 'Aula'} maxHeight="90dvh">
      <div className="space-y-4 pb-2">
        {/* Modality + time */}
        <div className={cn('p-4 rounded-2xl border', c.bg, c.border)}>
          {cls?.modality && (
            <span className={cn('inline-block text-[10px] font-extrabold uppercase tracking-wider', c.text)}>
              {cls.modality}
            </span>
          )}
          <p className="text-sm text-slate-600 mt-1">
            {WEEKDAYS_FULL[schedule.weekday]} · {fmtTime(schedule.start_time)} – {fmtTime(schedule.end_time)}
          </p>
        </div>

        {/* Info */}
        <div className="space-y-3">
          {cls?.teacher && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                <GraduationCap size={16} className="text-secondary" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Professor(a)</p>
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
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sala</p>
                <p className="text-sm font-semibold text-slate-700">{cls.room}</p>
              </div>
            </div>
          )}
        </div>

        {/* Students */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users size={14} className="text-slate-400" />
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Alunas matriculadas{!loadingStudents && ` (${students.length})`}
            </p>
          </div>
          {loadingStudents ? (
            <div className="flex items-center gap-2 text-slate-300 text-sm py-3">
              <Loader2 size={16} className="animate-spin" /> Carregando...
            </div>
          ) : students.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Nenhuma aluna matriculada</p>
          ) : (
            <div className="space-y-1.5">
              {students.map(s => (
                <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-50">
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

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          {onGoToAttendance && (
            <button
              type="button"
              onClick={onGoToAttendance}
              className="flex-1 min-h-11 inline-flex items-center justify-center gap-2 bg-secondary text-white font-bold rounded-full text-sm shadow-md shadow-secondary/20"
            >
              <ClipboardCheck size={16} /> Fazer chamada
            </button>
          )}
          {onGoToClass && (
            <button
              type="button"
              onClick={onGoToClass}
              className="flex-1 min-h-11 inline-flex items-center justify-center gap-2 border border-slate-200 text-primary font-bold rounded-full text-sm"
            >
              <BookOpen size={16} /> Ir para a turma <ExternalLink size={14} />
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
};
