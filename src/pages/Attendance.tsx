import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ClipboardCheck, ChevronLeft, ChevronRight, ChevronDown,
  Loader2, Calendar, CheckCircle2, XCircle, Clock, FileText,
  Save, UserCheck, Users, BarChart2, Search, Filter,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { useConfigOptions } from '../lib/useConfigOptions';
import { MONTHS, WEEKDAYS_LONG as WEEKDAYS, fmtTime, fmtDateBR } from '../lib/format';
import {
  getModalityDot as modalityDot,
  hashColor,
  getInitials as initials,
} from '../lib/colors';
import { BottomSheet } from '../components/ui/BottomSheet';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScheduleItem {
  scheduleId: string;
  class_id: string;
  class_name: string;
  modality: string | null;
  teacher: string | null;
  room: string | null;
  start_time: string;
  end_time: string;
}

interface StudentRow {
  id: string;
  full_name: string;
  photo_url: string | null;
}

type AttStatus = 'present' | 'absent' | 'late' | 'justified';

interface AttRecord { status: AttStatus; notes: string }

interface HistoryRow {
  date: string;
  class_id: string;
  class_name: string;
  modality: string | null;
  total: number;
  present: number;
  absent: number;
  late: number;
  justified: number;
  rate: number;
}

interface DetailEntry {
  date: string;
  class_id: string;
  class_name: string;
  modality: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PT_STATUS: Record<AttStatus, string> = {
  present: 'Presente',
  absent: 'Falta',
  late: 'Atraso',
  justified: 'Justif.',
};

const STATUS_CFG: Record<AttStatus, {
  label: string;
  short: string;
  Icon: React.FC<any>;
  activeBg: string;
  activeText: string;
  idleBg: string;
  idleText: string;
  badge: string;
}> = {
  present:   { label: 'Presente',    short: 'Presente', Icon: CheckCircle2, activeBg: 'bg-green-500', activeText: 'text-white', idleBg: 'bg-slate-100', idleText: 'text-slate-600', badge: 'bg-green-50 text-green-700 border-green-200' },
  absent:    { label: 'Falta',       short: 'Falta',    Icon: XCircle,      activeBg: 'bg-red-500',   activeText: 'text-white', idleBg: 'bg-slate-100', idleText: 'text-slate-600', badge: 'bg-red-50 text-red-700 border-red-200' },
  late:      { label: 'Atraso',      short: 'Atraso',   Icon: Clock,        activeBg: 'bg-amber-500', activeText: 'text-white', idleBg: 'bg-slate-100', idleText: 'text-slate-600', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  justified: { label: 'Justificada', short: 'Justif.',  Icon: FileText,     activeBg: 'bg-blue-500',  activeText: 'text-white', idleBg: 'bg-slate-100', idleText: 'text-slate-600', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
};

const STATUSES: AttStatus[] = ['present', 'absent', 'late', 'justified'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const toDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

const rateColor = (rate: number) =>
  rate > 80 ? 'bg-green-100 text-green-700' :
  rate > 60 ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-700';

const defaultFrom = () => { const d = new Date(); d.setDate(d.getDate() - 30); return toDateStr(d); };

// ─── Main Component ───────────────────────────────────────────────────────────

export const Attendance = ({ onChangeTab }: { onChangeTab?: (tab: string) => void }) => {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

  const [activeTab, setActiveTab] = useState<'day' | 'history'>('day');
  const [selectedDate, setSelectedDate] = useState(today);
  const [filterClassId, setFilterClassId] = useState('');
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  const dateStr = toDateStr(selectedDate);
  const dateLabel = `${WEEKDAYS[selectedDate.getDay()]}, ${selectedDate.getDate()} de ${MONTHS[selectedDate.getMonth()]}`;

  const load = useCallback(async () => {
    setLoading(true);
    const weekday = selectedDate.getDay();
    const { data: raw } = await supabase
      .from('class_schedules')
      .select('id, start_time, end_time, classes(id, name, modality, teacher, room, is_active)')
      .eq('weekday', weekday);

    const items: ScheduleItem[] = ((raw ?? []) as any[])
      .filter(s => s.classes?.is_active)
      .map(s => ({
        scheduleId: s.id,
        class_id: s.classes.id,
        class_name: s.classes.name,
        modality: s.classes.modality ?? null,
        teacher: s.classes.teacher ?? null,
        room: s.classes.room ?? null,
        start_time: s.start_time,
        end_time: s.end_time,
      }))
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    setSchedules(items);

    // Auto-select first class if there's exactly one or none selected previously
    if (items.length > 0 && !filterClassId) {
      setFilterClassId(items[0].class_id);
    } else if (items.length === 0) {
      setFilterClassId('');
    } else if (filterClassId && !items.some(i => i.class_id === filterClassId)) {
      setFilterClassId(items[0].class_id);
    }
    setLoading(false);
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const classOptions = useMemo(() => {
    const seen = new Set<string>();
    return schedules.filter(s => {
      if (seen.has(s.class_id)) return false;
      seen.add(s.class_id);
      return true;
    });
  }, [schedules]);

  const selectedSchedule = useMemo(
    () => schedules.find(s => s.class_id === filterClassId),
    [schedules, filterClassId],
  );

  return (
    <div className="max-w-[1100px] mx-auto pb-28 md:pb-12">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 md:mb-5">
        <ClipboardCheck size={24} className="text-secondary shrink-0" />
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-primary leading-tight">Frequência</h2>
          <p className="text-[13px] text-slate-400 mt-0.5">Controle de presença das aulas</p>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex overflow-x-auto scrollbar-none border-b border-slate-200 mb-4 md:mb-5 -mx-4 px-4 md:mx-0 md:px-0"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {([
          { id: 'day', label: 'Chamada do dia', Icon: ClipboardCheck },
          { id: 'history', label: 'Histórico', Icon: BarChart2 },
        ] as const).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            style={{ scrollSnapAlign: 'center' }}
            className={cn(
              'min-h-12 px-4 inline-flex items-center gap-2 text-sm font-bold border-b-2 transition-colors whitespace-nowrap shrink-0',
              activeTab === id ? 'border-primary text-primary' : 'border-transparent text-slate-500',
            )}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {activeTab === 'day' ? (
        <DayView
          today={today}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          dateStr={dateStr}
          dateLabel={dateLabel}
          loading={loading}
          schedules={schedules}
          classOptions={classOptions}
          filterClassId={filterClassId}
          setFilterClassId={setFilterClassId}
          selectedSchedule={selectedSchedule}
          onGoToClasses={() => onChangeTab?.('classes')}
        />
      ) : (
        <HistoryView />
      )}
    </div>
  );
};

// ─── Day View ───────────────────────────────────────────────────────────────

interface DayViewProps {
  today: Date;
  selectedDate: Date;
  setSelectedDate: (d: Date) => void;
  dateStr: string;
  dateLabel: string;
  loading: boolean;
  schedules: ScheduleItem[];
  classOptions: ScheduleItem[];
  filterClassId: string;
  setFilterClassId: (id: string) => void;
  selectedSchedule: ScheduleItem | undefined;
  onGoToClasses: () => void;
}

const DayView = ({
  today, selectedDate, setSelectedDate, dateStr, dateLabel,
  loading, schedules, classOptions, filterClassId, setFilterClassId,
  selectedSchedule, onGoToClasses,
}: DayViewProps) => {
  const isToday = dateStr === toDateStr(today);

  return (
    <div className="space-y-4">
      {/* Date navigation */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] p-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setSelectedDate(addDays(selectedDate, -1))}
          aria-label="Dia anterior"
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 shrink-0"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 min-w-0 text-center">
          <p className="text-sm font-bold text-primary truncate">{dateLabel}</p>
        </div>
        {!isToday && (
          <button
            type="button"
            onClick={() => setSelectedDate(today)}
            className="min-h-10 px-3 text-xs font-bold text-secondary border border-secondary/30 rounded-full hover:bg-secondary/5 shrink-0"
          >
            Hoje
          </button>
        )}
        <button
          type="button"
          onClick={() => setSelectedDate(addDays(selectedDate, 1))}
          aria-label="Próximo dia"
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 shrink-0"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 flex flex-col items-center justify-center py-16 text-slate-300">
          <Loader2 size={32} className="animate-spin mb-3" />
          <p className="text-sm font-medium">Carregando aulas...</p>
        </div>
      ) : schedules.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 flex flex-col items-center justify-center py-16 text-center px-6">
          <Calendar size={48} className="text-slate-200 mb-3" />
          <p className="text-base font-semibold text-slate-400">Nenhuma aula programada para este dia</p>
          <p className="text-xs text-slate-400 mt-1">Verifique a agenda ou tente outro dia.</p>
        </div>
      ) : (
        <>
          {/* Class selector */}
          <div>
            <label className="block text-[13px] font-bold text-primary mb-1.5">Turma</label>
            <select
              value={filterClassId}
              onChange={e => setFilterClassId(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200 px-3.5 text-base bg-white text-slate-700 outline-none focus:ring-1 focus:ring-secondary/50 focus:border-secondary"
            >
              {classOptions.map(c => (
                <option key={c.class_id} value={c.class_id}>
                  {fmtTime(c.start_time)} · {c.class_name}
                  {c.modality ? ` (${c.modality})` : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedSchedule && (
            <ChamadaForm
              key={`${selectedSchedule.class_id}-${dateStr}`}
              schedule={selectedSchedule}
              dateStr={dateStr}
              onGoToClasses={onGoToClasses}
            />
          )}
        </>
      )}
    </div>
  );
};

// ─── Chamada Form (single class) ────────────────────────────────────────────

const ChamadaForm = ({
  schedule, dateStr, onGoToClasses,
}: {
  schedule: ScheduleItem;
  dateStr: string;
  onGoToClasses: () => void;
}) => {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [records, setRecords] = useState<Record<string, AttRecord>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [studRes, attRes] = await Promise.all([
        supabase.from('class_students')
          .select('students(id, full_name, photo_url)')
          .eq('class_id', schedule.class_id)
          .eq('status', 'active'),
        supabase.from('attendance')
          .select('student_id, status, notes')
          .eq('class_id', schedule.class_id)
          .eq('date', dateStr),
      ]);
      if (cancelled) return;

      const studs: StudentRow[] = ((studRes.data ?? []) as any[])
        .map(r => r.students).filter(Boolean)
        .sort((a: StudentRow, b: StudentRow) => a.full_name.localeCompare(b.full_name, 'pt-BR'));
      const init: Record<string, AttRecord> = {};
      studs.forEach(s => { init[s.id] = { status: 'present', notes: '' }; });
      ((attRes.data ?? []) as any[]).forEach(r => {
        init[r.student_id] = { status: r.status as AttStatus, notes: r.notes ?? '' };
      });
      setStudents(studs);
      setRecords(init);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [schedule.class_id, dateStr]);

  const setStatus = (id: string, s: AttStatus) =>
    setRecords(p => ({ ...p, [id]: { ...p[id], status: s } }));
  const setNotes = (id: string, n: string) =>
    setRecords(p => ({ ...p, [id]: { ...p[id], notes: n } }));

  const markAllPresent = () =>
    setRecords(prev => {
      const next = { ...prev };
      students.forEach(s => { next[s.id] = { ...next[s.id], status: 'present' }; });
      return next;
    });

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, justified: 0 };
    Object.values(records).forEach(r => c[r.status]++);
    return c;
  }, [records]);

  const presentCount = counts.present + counts.late;
  const total = students.length;

  const save = async () => {
    if (students.length === 0) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const rows = students.map(s => ({
      owner_id: user!.id,
      class_id: schedule.class_id,
      student_id: s.id,
      date: dateStr,
      status: records[s.id]?.status ?? 'present',
      notes: records[s.id]?.notes || null,
      recorded_by: user!.id,
    }));
    await supabase.from('attendance').upsert(rows, { onConflict: 'class_id,student_id,date' });
    setSaving(false);
    setToast(true);
    setTimeout(() => setToast(false), 2500);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 flex items-center justify-center py-12 text-slate-300">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 flex flex-col items-center justify-center py-12 text-center px-6">
        <Users size={36} className="text-slate-200 mb-3" />
        <p className="text-sm font-semibold text-slate-400">Nenhuma aluna matriculada nesta turma</p>
        <button
          type="button"
          onClick={onGoToClasses}
          className="mt-3 min-h-10 px-4 text-sm font-bold text-secondary"
        >
          Ir para turmas →
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-white rounded-2xl border border-slate-100 p-3">
          <p className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-wider">Presentes</p>
          <p className="text-xl md:text-2xl font-extrabold text-green-600 mt-1">{presentCount}/{total}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-3">
          <p className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total</p>
          <p className="text-xl md:text-2xl font-extrabold text-primary mt-1">{total}</p>
        </div>
        <div className="hidden md:block bg-white rounded-2xl border border-slate-100 p-3">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Faltas</p>
          <p className="text-2xl font-extrabold text-red-500 mt-1">{counts.absent}</p>
        </div>
        <div className="hidden md:block bg-white rounded-2xl border border-slate-100 p-3">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Justif.</p>
          <p className="text-2xl font-extrabold text-blue-500 mt-1">{counts.justified}</p>
        </div>
      </div>

      {/* Mark all present */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={markAllPresent}
          className="min-h-10 inline-flex items-center gap-1.5 px-3 text-xs font-bold text-secondary border border-secondary/30 rounded-full hover:bg-secondary/5"
        >
          <UserCheck size={13} /> Todos presentes
        </button>
      </div>

      {/* Student rows */}
      <div className="space-y-2">
        {students.map(s => (
          <StudentCard
            key={s.id}
            student={s}
            record={records[s.id] ?? { status: 'present', notes: '' }}
            onStatusChange={st => setStatus(s.id, st)}
            onNotesChange={n => setNotes(s.id, n)}
          />
        ))}
      </div>

      {/* Sticky save bar */}
      <div
        className="
          fixed inset-x-0 bottom-0 z-30
          bg-white/95 backdrop-blur border-t border-slate-100
          px-4 pt-3
          pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]
          flex items-center justify-between gap-3
          md:static md:bg-transparent md:backdrop-blur-none md:border-0 md:p-0 md:pt-4
        "
      >
        <p className="text-xs text-slate-500 hidden md:block">
          {students.length} aluna{students.length !== 1 ? 's' : ''} nesta turma
        </p>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="w-full md:w-auto min-h-11 px-6 inline-flex items-center justify-center gap-2 bg-secondary text-white rounded-full font-bold text-sm shadow-md shadow-secondary/20 disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Salvando...' : 'Salvar chamada'}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-40 bg-green-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-lg inline-flex items-center gap-2"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)' }}
        >
          <CheckCircle2 size={16} /> Chamada salva!
        </div>
      )}
    </div>
  );
};

// ─── Student Card (single row in chamada) ───────────────────────────────────

const StudentCard = ({
  student, record, onStatusChange, onNotesChange,
}: {
  student: StudentRow;
  record: AttRecord;
  onStatusChange: (s: AttStatus) => void;
  onNotesChange: (n: string) => void;
}) => (
  <div
    className={cn(
      'bg-white rounded-2xl border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] p-3 transition-opacity',
      record.status === 'absent' && 'opacity-70',
    )}
  >
    <div className="flex items-center gap-3">
      {student.photo_url ? (
        <img src={student.photo_url} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
      ) : (
        <div className={cn(
          'w-12 h-12 rounded-full text-white flex items-center justify-center font-bold text-sm shrink-0',
          hashColor(student.id),
        )}>
          {initials(student.full_name)}
        </div>
      )}
      <p className="flex-1 text-sm font-semibold text-primary truncate min-w-0">{student.full_name}</p>
    </div>

    {/* Status buttons */}
    <div className="grid grid-cols-4 gap-1.5 mt-3">
      {STATUSES.map(s => {
        const cfg = STATUS_CFG[s];
        const active = record.status === s;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onStatusChange(s)}
            aria-pressed={active}
            aria-label={cfg.label}
            className={cn(
              'min-h-12 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all border',
              active
                ? cn(cfg.activeBg, cfg.activeText, 'border-transparent shadow-sm')
                : cn(cfg.idleBg, cfg.idleText, 'border-transparent'),
            )}
          >
            <cfg.Icon size={16} />
            <span className="text-[9px] sm:text-[11px] font-bold leading-none truncate max-w-full">{cfg.short}</span>
          </button>
        );
      })}
    </div>

    {/* Notes (always rendered, prominent if justified) */}
    {record.status === 'justified' && (
      <input
        type="text"
        placeholder="Motivo"
        value={record.notes}
        onChange={e => onNotesChange(e.target.value)}
        className="mt-2.5 w-full h-11 rounded-xl border border-blue-200 bg-blue-50 px-3.5 text-base outline-none focus:ring-1 focus:ring-secondary/50 focus:border-secondary"
      />
    )}
    {record.status !== 'justified' && record.notes && (
      <input
        type="text"
        placeholder="Observação"
        value={record.notes}
        onChange={e => onNotesChange(e.target.value)}
        className="mt-2.5 w-full h-11 rounded-xl border border-slate-200 px-3.5 text-base outline-none focus:ring-1 focus:ring-secondary/50 focus:border-secondary"
      />
    )}
    {record.status !== 'justified' && !record.notes && (
      <button
        type="button"
        onClick={() => onNotesChange(' ')}
        className="mt-2 min-h-10 inline-flex items-center gap-1 px-2 text-xs font-semibold text-slate-400 hover:text-secondary"
      >
        <FileText size={12} /> Adicionar observação
      </button>
    )}
  </div>
);

// ─── History View ───────────────────────────────────────────────────────────

const HistoryView = () => {
  const [histFrom, setHistFrom] = useState(defaultFrom);
  const [histTo, setHistTo] = useState(() => toDateStr(new Date()));
  const [histModality, setHistModality] = useState('');
  const [histClassId, setHistClassId] = useState('');
  const [allClasses, setAllClasses] = useState<{ id: string; name: string }[]>([]);
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<DetailEntry | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const { options: modalityOptions } = useConfigOptions('modality');

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
        if (r.status === 'absent') map[key].absent++;
        if (r.status === 'late') map[key].late++;
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

  const totalPresent = rows.reduce((a, r) => a + r.present, 0);
  const totalAbsent = rows.reduce((a, r) => a + r.absent, 0);
  const totalSessions = rows.length;
  const avgRate = rows.length > 0 ? Math.round(rows.reduce((a, r) => a + r.rate, 0) / rows.length) : 0;

  const hasFilters = !!(histModality || histClassId);
  const clearFilters = () => { setHistModality(''); setHistClassId(''); };

  return (
    <div className="space-y-4">
      {/* Filter trigger */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <input
            type="date"
            value={histFrom}
            onChange={e => setHistFrom(e.target.value)}
            aria-label="De"
            className="h-11 rounded-xl border border-slate-200 px-3 text-base text-slate-700 outline-none focus:ring-1 focus:ring-secondary/50 focus:border-secondary min-w-0 flex-1"
          />
          <span className="text-slate-400 text-xs">–</span>
          <input
            type="date"
            value={histTo}
            onChange={e => setHistTo(e.target.value)}
            aria-label="Até"
            className="h-11 rounded-xl border border-slate-200 px-3 text-base text-slate-700 outline-none focus:ring-1 focus:ring-secondary/50 focus:border-secondary min-w-0 flex-1"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowFilters(true)}
          className="min-h-11 inline-flex items-center gap-1.5 px-3 rounded-full border border-slate-200 text-sm font-bold text-primary bg-white shrink-0"
        >
          <Filter size={14} />
          {hasFilters && <span className="w-2 h-2 rounded-full bg-secondary" />}
        </button>
      </div>

      {/* KPIs */}
      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {[
            { label: 'Sessões', value: String(totalSessions), color: 'text-primary' },
            { label: 'Presenças', value: String(totalPresent), color: 'text-green-600' },
            { label: 'Ausências', value: String(totalAbsent), color: 'text-red-500' },
            { label: 'Taxa média', value: `${avgRate}%`, color: avgRate > 80 ? 'text-green-600' : avgRate > 60 ? 'text-amber-600' : 'text-red-500' },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] p-3 md:p-4">
              <p className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-wider">{k.label}</p>
              <p className={cn('text-xl md:text-2xl font-extrabold mt-1', k.color)}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Records */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 flex flex-col items-center justify-center py-16 text-slate-300">
          <Loader2 size={32} className="animate-spin mb-3" />
          <p className="text-sm font-medium">Carregando histórico...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 flex flex-col items-center justify-center py-16 text-center px-6">
          <Search size={40} className="text-slate-200 mb-3" />
          <p className="text-sm font-semibold text-slate-400">Nenhum registro encontrado</p>
          <p className="text-xs text-slate-400 mt-1">Ajuste o período ou os filtros</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const key = `${row.class_id}-${row.date}`;
            const expanded = expandedKey === key;
            return (
              <HistoryDayCard
                key={key}
                row={row}
                expanded={expanded}
                onToggle={() => setExpandedKey(prev => prev === key ? null : key)}
                onOpenDetail={() => setDetail({
                  date: row.date,
                  class_id: row.class_id,
                  class_name: row.class_name,
                  modality: row.modality,
                })}
              />
            );
          })}
          <p className="text-xs text-slate-400 text-center pt-2">
            {rows.length} sessão(ões) no período
          </p>
        </div>
      )}

      {/* Filters sheet */}
      <BottomSheet open={showFilters} onClose={() => setShowFilters(false)} title="Filtros">
        <div className="space-y-4 pb-2">
          <div>
            <label className="block text-[13px] font-bold text-primary mb-1.5">Modalidade</label>
            <select
              value={histModality}
              onChange={e => { setHistModality(e.target.value); setHistClassId(''); }}
              className="w-full h-11 rounded-xl border border-slate-200 px-3.5 text-base bg-white text-slate-700 outline-none focus:ring-1 focus:ring-secondary/50 focus:border-secondary"
            >
              <option value="">Todas</option>
              {modalityOptions.map(m => <option key={m.id} value={m.label}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-bold text-primary mb-1.5">Turma</label>
            <select
              value={histClassId}
              onChange={e => setHistClassId(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200 px-3.5 text-base bg-white text-slate-700 outline-none focus:ring-1 focus:ring-secondary/50 focus:border-secondary"
            >
              <option value="">Todas</option>
              {allClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-1">
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
              className="flex-1 min-h-11 bg-secondary text-white rounded-full font-bold text-sm"
            >
              Aplicar
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Detail sheet */}
      {detail && (
        <DetailSheet entry={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  );
};

// ─── History Day Card (collapsible) ─────────────────────────────────────────

const HistoryDayCard = ({
  row, expanded, onToggle, onOpenDetail,
}: {
  row: HistoryRow;
  expanded: boolean;
  onToggle: () => void;
  onOpenDetail: () => void;
}) => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] overflow-hidden">
    <button
      type="button"
      onClick={onToggle}
      className="w-full p-4 flex items-center gap-3 text-left"
    >
      <div className={cn('w-3 h-3 rounded-full shrink-0', modalityDot(row.modality))} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-primary truncate">{row.class_name}</p>
        <p className="text-xs text-slate-500 mt-0.5">{fmtDateBR(row.date)}</p>
      </div>
      <div className="flex flex-col items-end shrink-0">
        <span className={cn('text-xs font-extrabold px-2 py-0.5 rounded-full', rateColor(row.rate))}>
          {row.rate}%
        </span>
        <span className="text-[10px] text-slate-400 mt-0.5">{row.present}/{row.total}</span>
      </div>
      <ChevronDown size={16} className={cn('text-slate-400 shrink-0 transition-transform', expanded && 'rotate-180')} />
    </button>
    {expanded && (
      <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/40">
        <div className="grid grid-cols-4 gap-2 mb-3">
          <SummaryCell label="Presente" value={row.present - row.late} cls="text-green-600" />
          <SummaryCell label="Atraso" value={row.late} cls="text-amber-600" />
          <SummaryCell label="Falta" value={row.absent} cls="text-red-500" />
          <SummaryCell label="Justif." value={row.justified} cls="text-blue-500" />
        </div>
        <button
          type="button"
          onClick={onOpenDetail}
          className="w-full min-h-11 text-sm font-bold text-secondary border border-secondary/30 rounded-full hover:bg-secondary/5"
        >
          Ver lista completa
        </button>
      </div>
    )}
  </div>
);

const SummaryCell = ({ label, value, cls }: { label: string; value: number; cls: string }) => (
  <div className="bg-white rounded-xl border border-slate-100 p-2 text-center">
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
    <p className={cn('text-lg font-extrabold mt-0.5', cls)}>{value}</p>
  </div>
);

// ─── Detail Sheet ────────────────────────────────────────────────────────────

interface DetailStudentRow {
  id: string;
  full_name: string;
  photo_url: string | null;
  status: AttStatus | null;
  notes: string | null;
}

const DetailSheet = ({ entry, onClose }: { entry: DetailEntry; onClose: () => void }) => {
  const [students, setStudents] = useState<DetailStudentRow[]>([]);
  const [loading, setLoading] = useState(true);

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
          notes: attMap[s.id]?.notes ?? null,
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

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={entry.class_name}
      maxHeight="90dvh"
    >
      <div className="space-y-3 pb-2">
        <p className="text-sm text-slate-500">{fmtDateBR(entry.date)}</p>

        {!loading && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {STATUSES.map(s => counts[s] > 0 && (
              <span key={s} className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', STATUS_CFG[s].badge)}>
                {counts[s]} {PT_STATUS[s].toLowerCase()}
              </span>
            ))}
            {counts.unrecorded > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-100 text-slate-500 border-slate-200">
                {counts.unrecorded} não registrado{counts.unrecorded > 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-300">
            <Loader2 size={20} className="animate-spin mr-2" /> Carregando...
          </div>
        ) : students.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-slate-400">
            <Users size={28} className="mb-2 opacity-30" />
            <p className="text-sm">Nenhuma aluna matriculada</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {students.map(s => {
              const cfg = s.status ? STATUS_CFG[s.status] : null;
              return (
                <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50">
                  {s.photo_url ? (
                    <img src={s.photo_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className={cn(
                      'w-9 h-9 rounded-full text-white flex items-center justify-center font-bold text-xs shrink-0',
                      hashColor(s.id),
                    )}>
                      {initials(s.full_name)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-primary truncate">{s.full_name}</p>
                    {s.notes && <p className="text-[11px] text-slate-400 truncate mt-0.5">{s.notes}</p>}
                  </div>
                  {cfg ? (
                    <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0', cfg.badge)}>
                      <cfg.Icon size={11} /> {PT_STATUS[s.status as AttStatus]}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-100 text-slate-400 border-slate-200 shrink-0">
                      Não registrado
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </BottomSheet>
  );
};
