import { useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  Users, Wallet, AlertTriangle, CalendarCheck, Calendar,
  TrendingUp, TrendingDown, ArrowRight, CheckCircle2, Clock,
  BookOpen, UserPlus, DollarSign, Loader2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

// ─── Types ─────────────────────────────────────────────────────────────────

interface KpiData {
  activeStudents: number;
  prevActiveStudents: number;
  monthRevenue: number;
  prevMonthRevenue: number;
  delinquencyRate: number;
  prevDelinquencyRate: number;
  occupancyRate: number;
  classesToday: number;
  attendanceDoneToday: number;
}

interface RevenuePoint { month: string; value: number }

interface ModalityData { modality: string; count: number }

interface OverduePayment {
  id: string;
  student_id: string;
  student_name: string;
  amount: number;
  due_date: string;
  daysLate: number;
}

interface TodayClass {
  id: string;
  class_id: string;
  class_name: string;
  modality: string | null;
  teacher: string | null;
  room: string | null;
  start_time: string;
  end_time: string;
  enrolled: number;
  max_capacity: number;
}

interface ActivityItem {
  id: string;
  type: 'student' | 'payment' | 'class';
  description: string;
  timestamp: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtTime = (t: string) => t?.slice(0, 5) ?? '';

const relativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2)  return 'agora mesmo';
  if (mins < 60) return `há ${mins} minutos`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `há ${hrs} hora${hrs > 1 ? 's' : ''}`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'ontem';
  if (days < 7)  return `há ${days} dias`;
  return new Date(iso).toLocaleDateString('pt-BR');
};

const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// Modality color palette (same as Agenda)
const MODALITY_COLORS: Record<string, string> = {
  'Ballet Clássico': 'bg-pink-400',
  Ballet:            'bg-pink-400',
  Jazz:              'bg-purple-400',
  'Contemporâneo':   'bg-blue-400',
  'Hip-Hop':         'bg-orange-400',
  'Hip Hop':         'bg-orange-400',
  Sapateado:         'bg-amber-400',
  'Dança do Ventre': 'bg-teal-400',
  Forró:             'bg-green-400',
  Samba:             'bg-red-400',
  'K-Pop':           'bg-violet-400',
  Stiletto:          'bg-rose-400',
  'Baby Class':      'bg-yellow-400',
};

const MODALITY_HEX: Record<string, string> = {
  'Ballet Clássico': '#f472b6',
  Ballet:            '#f472b6',
  Jazz:              '#c084fc',
  'Contemporâneo':   '#60a5fa',
  'Hip-Hop':         '#fb923c',
  'Hip Hop':         '#fb923c',
  Sapateado:         '#fbbf24',
  'Dança do Ventre': '#2dd4bf',
  Forró:             '#4ade80',
  Samba:             '#f87171',
  'K-Pop':           '#a78bfa',
  Stiletto:          '#fb7185',
  'Baby Class':      '#facc15',
};

const FALLBACK_COLORS = ['#60a5fa','#a78bfa','#34d399','#f472b6','#fbbf24','#fb923c'];

const getModalityDot = (mod: string | null) =>
  mod ? (MODALITY_COLORS[mod] ?? 'bg-cyan-400') : 'bg-slate-300';

const getModalityHex = (mod: string | null, idx = 0): string =>
  mod ? (MODALITY_HEX[mod] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length])
      : FALLBACK_COLORS[idx % FALLBACK_COLORS.length];

// ─── Skeleton ──────────────────────────────────────────────────────────────

const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('animate-pulse bg-slate-100 rounded-lg', className)} />
);

// ─── Main Component ────────────────────────────────────────────────────────

export const Dashboard = ({
  onChangeTab,
  onSelectStudent,
}: {
  onChangeTab?: (tab: string) => void;
  onSelectStudent?: (id: string) => void;
}) => {
  const today = new Date();
  const dayNames = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
  const greeting = today.getHours() < 12 ? 'Bom dia' : today.getHours() < 18 ? 'Boa tarde' : 'Boa noite';
  const todayLabel = `${dayNames[today.getDay()]}, ${today.getDate()} de ${['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][today.getMonth()]} de ${today.getFullYear()}`;

  const [userName, setUserName] = useState('');
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);
  const [modalities, setModalities] = useState<ModalityData[]>([]);
  const [overdue, setOverdue] = useState<OverduePayment[]>([]);
  const [todayClasses, setTodayClasses] = useState<TodayClass[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  const [loadingKpi,      setLoadingKpi]      = useState(true);
  const [loadingRevenue,  setLoadingRevenue]  = useState(true);
  const [loadingMod,      setLoadingMod]      = useState(true);
  const [loadingOverdue,  setLoadingOverdue]  = useState(true);
  const [loadingToday,    setLoadingToday]    = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);

  // ── Auth user ──────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata;
      setUserName(meta?.full_name ?? meta?.name ?? data.user?.email?.split('@')[0] ?? 'Gestora');
    });
  }, []);

  // ── Date helpers ───────────────────────────────────────────────────────
  const monthStart = (d = today) => new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd   = (d = today) => new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  const prevMonth  = () => { const d = new Date(today); d.setMonth(d.getMonth() - 1); return d; };

  const loadAll = useCallback(async () => {
    // ── KPIs ─────────────────────────────────────────────────────────────
    setLoadingKpi(true);
    (async () => {
      const todayStr = today.toISOString().slice(0, 10);
      const pm = prevMonth();

      const [
        { count: activeNow },
        { count: activePrev },
        { data: revNow },
        { data: revPrev },
        { data: allPmts },
        { data: classesData },
        { data: schedToday },
        { data: attToday },
      ] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact', head: true })
          .not('status', 'in', '("Inativo","inativo","Cancelado","cancelado")'),
        supabase.from('students').select('id', { count: 'exact', head: true })
          .not('status', 'in', '("Inativo","inativo","Cancelado","cancelado")')
          .lt('enrollment_date', monthStart()),
        supabase.from('payments').select('paid_amount, amount')
          .eq('status', 'Pago')
          .gte('paid_date', monthStart())
          .lte('paid_date', monthEnd()),
        supabase.from('payments').select('paid_amount, amount')
          .eq('status', 'Pago')
          .gte('paid_date', monthStart(pm))
          .lte('paid_date', monthEnd(pm)),
        supabase.from('payments').select('status, due_date')
          .gte('due_date', monthStart())
          .lte('due_date', monthEnd()),
        supabase.from('classes').select('id, max_capacity, student_classes(count)')
          .eq('is_active', true),
        supabase.from('class_schedules').select('id, classes(is_active)')
          .eq('weekday', today.getDay()),
        supabase.from('attendance').select('class_id')
          .eq('date', todayStr),
      ]);

      const sumRevNow  = (revNow  ?? []).reduce((a, p: any) => a + (p.paid_amount ?? p.amount ?? 0), 0);
      const sumRevPrev = (revPrev ?? []).reduce((a, p: any) => a + (p.paid_amount ?? p.amount ?? 0), 0);

      const monthPmts  = allPmts ?? [];
      const totalPmts  = monthPmts.length || 1;
      const overduePmts = monthPmts.filter((p: any) => p.status === 'Atrasado' || (p.due_date < todayStr && p.status !== 'Pago' && p.status !== 'Cancelado')).length;
      const delinqRate = Math.round((overduePmts / totalPmts) * 100);

      let totalEnrolled = 0, totalCapacity = 0;
      (classesData ?? []).forEach((c: any) => {
        const enrolled = c.student_classes?.[0]?.count ?? 0;
        totalEnrolled += enrolled;
        totalCapacity += (c.max_capacity ?? 0);
      });
      const occRate = totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 100) : 0;

      const activeToday = (schedToday ?? []).filter((s: any) => s.classes?.is_active).length;
      const doneClassIds = new Set((attToday ?? []).map((r: any) => r.class_id));
      const attendanceDoneToday = doneClassIds.size;

      setKpi({
        activeStudents: activeNow ?? 0,
        prevActiveStudents: activePrev ?? 0,
        monthRevenue: sumRevNow,
        prevMonthRevenue: sumRevPrev,
        delinquencyRate: delinqRate,
        prevDelinquencyRate: 0,
        occupancyRate: occRate,
        classesToday: activeToday,
        attendanceDoneToday,
      });
      setLoadingKpi(false);
    })();

    // ── Revenue history ───────────────────────────────────────────────────
    setLoadingRevenue(true);
    (async () => {
      const points: RevenuePoint[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const { data } = await supabase.from('payments')
          .select('paid_amount, amount')
          .eq('status', 'Pago')
          .gte('paid_date', monthStart(d))
          .lte('paid_date', monthEnd(d));
        const total = (data ?? []).reduce((a: number, p: any) => a + (p.paid_amount ?? p.amount ?? 0), 0);
        points.push({ month: MONTHS_SHORT[d.getMonth()], value: total });
      }
      setRevenue(points);
      setLoadingRevenue(false);
    })();

    // ── Modality distribution ─────────────────────────────────────────────
    setLoadingMod(true);
    (async () => {
      const { data } = await supabase
        .from('student_classes')
        .select('classes(modality)')
        .not('classes', 'is', null);
      if (data) {
        const counts: Record<string, number> = {};
        (data as any[]).forEach(r => {
          const mod = r.classes?.modality ?? 'Sem modalidade';
          counts[mod] = (counts[mod] ?? 0) + 1;
        });
        setModalities(
          Object.entries(counts)
            .map(([modality, count]) => ({ modality, count }))
            .sort((a, b) => b.count - a.count)
        );
      }
      setLoadingMod(false);
    })();

    // ── Overdue payments ──────────────────────────────────────────────────
    setLoadingOverdue(true);
    (async () => {
      const todayStr = today.toISOString().slice(0, 10);
      const { data } = await supabase
        .from('payments')
        .select('id, student_id, amount, due_date, students(id, full_name)')
        .or('status.eq.Atrasado,and(status.eq.Pendente,due_date.lt.' + todayStr + ')')
        .order('due_date', { ascending: true })
        .limit(6);
      if (data) {
        setOverdue((data as any[]).map(p => ({
          id: p.id,
          student_id: p.student_id,
          student_name: p.students?.full_name ?? 'Aluno',
          amount: p.amount,
          due_date: p.due_date,
          daysLate: Math.max(0, Math.floor((today.getTime() - new Date(p.due_date).getTime()) / 86400000)),
        })));
      }
      setLoadingOverdue(false);
    })();

    // ── Today's classes ───────────────────────────────────────────────────
    setLoadingToday(true);
    (async () => {
      const { data } = await supabase
        .from('class_schedules')
        .select('id, start_time, end_time, classes(id, name, modality, teacher, room, max_capacity, is_active, student_classes(count))')
        .eq('weekday', today.getDay())
        .order('start_time');
      if (data) {
        setTodayClasses(
          (data as any[])
            .filter(s => s.classes?.is_active)
            .map(s => ({
              id: s.id,
              class_id: s.classes?.id,
              class_name: s.classes?.name ?? '',
              modality: s.classes?.modality ?? null,
              teacher: s.classes?.teacher ?? null,
              room: s.classes?.room ?? null,
              start_time: s.start_time,
              end_time: s.end_time,
              enrolled: s.classes?.student_classes?.[0]?.count ?? 0,
              max_capacity: s.classes?.max_capacity ?? 0,
            }))
        );
      }
      setLoadingToday(false);
    })();

    // ── Recent activity ───────────────────────────────────────────────────
    setLoadingActivity(true);
    (async () => {
      const [studentsRes, paymentsRes, classesRes] = await Promise.all([
        supabase.from('students').select('id, full_name, created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('payments').select('id, amount, paid_amount, paid_date, students(full_name)').eq('status', 'Pago').order('paid_date', { ascending: false }).limit(5),
        supabase.from('classes').select('id, name, created_at').order('created_at', { ascending: false }).limit(4),
      ]);

      const items: ActivityItem[] = [];
      (studentsRes.data ?? []).forEach((s: any) => {
        items.push({ id: `s-${s.id}`, type: 'student', description: `${s.full_name} foi cadastrado(a) como aluno`, timestamp: s.created_at });
      });
      (paymentsRes.data ?? []).forEach((p: any) => {
        const val = fmtBRL(p.paid_amount ?? p.amount);
        items.push({ id: `p-${p.id}`, type: 'payment', description: `${p.students?.full_name ?? 'Aluno'} realizou pagamento de ${val}`, timestamp: p.paid_date });
      });
      (classesRes.data ?? []).forEach((c: any) => {
        items.push({ id: `c-${c.id}`, type: 'class', description: `Turma "${c.name}" foi criada`, timestamp: c.created_at });
      });
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivity(items.slice(0, 10));
      setLoadingActivity(false);
    })();
  }, []);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadAll]);

  const navigate = (tab: string) => onChangeTab?.(tab);

  // ── Revenue chart scale ────────────────────────────────────────────────
  const maxRev = revenue.length ? Math.max(...revenue.map(r => r.value), 1) : 1;
  const refLine = revenue.length >= 3 ? revenue.slice(-3).reduce((a, r) => a + r.value, 0) / 3 : 0;

  // ── Donut chart ────────────────────────────────────────────────────────
  const totalMod = modalities.reduce((a, m) => a + m.count, 0) || 1;
  const donutRadius = 52, donutCx = 64, donutCy = 64, stroke = 22;
  const circumference = 2 * Math.PI * donutRadius;
  let donutOffset = 0;
  const donutSegments = modalities.map((m, i) => {
    const pct = m.count / totalMod;
    const dash = pct * circumference;
    const gap  = circumference - dash;
    const seg  = { ...m, dash, gap, offset: donutOffset, hex: getModalityHex(m.modality, i) };
    donutOffset += dash;
    return seg;
  });

  // ── Current time for today's schedule ────────────────────────────────
  const nowMins = today.getHours() * 60 + today.getMinutes();
  const parseTimeMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-12">

      {/* ── Greeting ── */}
      <div>
        <h2 className="text-2xl font-bold text-primary">
          {greeting}{userName ? `, ${userName.split(' ')[0]}` : ''}! 👋
        </h2>
        <p className="text-sm text-slate-400 mt-0.5">{todayLabel}</p>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          label="Alunos Ativos"
          value={loadingKpi ? null : String(kpi?.activeStudents ?? 0)}
          icon={<Users size={20} />}
          delta={loadingKpi ? null : (kpi?.activeStudents ?? 0) - (kpi?.prevActiveStudents ?? 0)}
          deltaLabel="vs mês anterior"
          deltaType="absolute"
          onClick={() => navigate('students')}
        />
        <KpiCard
          label="Receita do Mês"
          value={loadingKpi ? null : fmtBRL(kpi?.monthRevenue ?? 0)}
          icon={<Wallet size={20} />}
          delta={loadingKpi ? null : kpi?.prevMonthRevenue ? ((kpi.monthRevenue - kpi.prevMonthRevenue) / kpi.prevMonthRevenue) * 100 : null}
          deltaLabel="vs mês anterior"
          deltaType="percent"
          onClick={() => navigate('financial')}
        />
        <KpiCard
          label="Inadimplência"
          value={loadingKpi ? null : `${kpi?.delinquencyRate ?? 0}%`}
          icon={<AlertTriangle size={20} />}
          delta={null}
          deltaLabel=""
          deltaType="percent"
          statusColor={
            (kpi?.delinquencyRate ?? 0) > 15 ? 'red' :
            (kpi?.delinquencyRate ?? 0) > 5  ? 'orange' : 'green'
          }
          onClick={() => navigate('financial')}
        />
        <KpiCard
          label="Ocupação Média"
          value={loadingKpi ? null : `${kpi?.occupancyRate ?? 0}%`}
          icon={<CalendarCheck size={20} />}
          delta={null}
          deltaLabel=""
          deltaType="percent"
          statusColor={
            (kpi?.occupancyRate ?? 0) > 70 ? 'green' :
            (kpi?.occupancyRate ?? 0) > 40 ? 'orange' : 'red'
          }
          onClick={() => navigate('classes')}
        />
        <KpiCard
          label="Aulas Hoje"
          value={loadingKpi ? null : String(kpi?.classesToday ?? 0)}
          icon={<Calendar size={20} />}
          delta={null}
          deltaLabel="programadas"
          deltaType="absolute"
          onClick={() => navigate('agenda')}
          foot={!loadingKpi && (kpi?.classesToday ?? 0) > 0 ? (
            <div className="flex items-center gap-1.5">
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-secondary rounded-full transition-all duration-500"
                  style={{ width: `${Math.round(((kpi?.attendanceDoneToday ?? 0) / (kpi?.classesToday ?? 1)) * 100)}%` }}
                />
              </div>
              <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                {kpi?.attendanceDoneToday ?? 0}/{kpi?.classesToday ?? 0} chamadas
              </span>
            </div>
          ) : undefined}
        />
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Revenue bar chart */}
        <div className="lg:col-span-3 bg-white rounded-[20px] border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-primary">Receita Mensal</h3>
              <p className="text-xs text-slate-400 mt-0.5">Últimos 6 meses</p>
            </div>
            {refLine > 0 && (
              <span className="text-xs text-slate-400 border border-dashed border-slate-300 px-2.5 py-1 rounded-full">
                Referência: {fmtBRL(refLine)}
              </span>
            )}
          </div>
          {loadingRevenue ? (
            <div className="flex items-end gap-3 h-44">
              {Array(6).fill(0).map((_, i) => (
                <Skeleton key={i} className={`flex-1 rounded-xl`} style={{ height: `${30 + i * 10}%` } as any} />
              ))}
            </div>
          ) : (
            <div className="relative h-44">
              {/* Reference line */}
              {refLine > 0 && (
                <div
                  className="absolute left-0 right-0 border-t border-dashed border-slate-300 z-10 pointer-events-none"
                  style={{ bottom: `${(refLine / maxRev) * 100}%` }}
                />
              )}
              <div className="absolute inset-0 flex items-end gap-2">
                {revenue.map((r, i) => {
                  const h = (r.value / maxRev) * 100;
                  const isLast = i === revenue.length - 1;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                      <div className="w-full flex-1 flex items-end">
                        <div
                          className="w-full rounded-t-xl transition-all relative"
                          style={{ height: `${Math.max(h, 3)}%`, background: isLast ? '#2056A0' : '#93c5fd' }}
                        >
                          <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap z-20 pointer-events-none">
                            {fmtBRL(r.value)}
                          </div>
                        </div>
                      </div>
                      <span className={cn('text-[11px] font-bold', isLast ? 'text-secondary' : 'text-slate-400')}>
                        {r.month}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Donut chart */}
        <div className="lg:col-span-2 bg-white rounded-[20px] border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] p-5">
          <div className="mb-5">
            <h3 className="font-bold text-primary">Alunos por Modalidade</h3>
            <p className="text-xs text-slate-400 mt-0.5">Distribuição atual</p>
          </div>
          {loadingMod ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 size={28} className="animate-spin text-slate-200" />
            </div>
          ) : modalities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <BookOpen size={28} className="text-slate-200 mb-2" />
              <p className="text-sm text-slate-400">Nenhuma modalidade com alunos</p>
              <button onClick={() => navigate('classes')} className="mt-2 text-xs font-semibold text-secondary hover:underline">Cadastrar Turma</button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <svg viewBox="0 0 128 128" className="w-28 h-28 shrink-0 -rotate-90">
                {donutSegments.map((seg, i) => (
                  <circle
                    key={i}
                    cx={donutCx}
                    cy={donutCy}
                    r={donutRadius}
                    fill="none"
                    stroke={seg.hex}
                    strokeWidth={stroke}
                    strokeDasharray={`${seg.dash} ${seg.gap}`}
                    strokeDashoffset={-seg.offset}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate('classes')}
                  />
                ))}
              </svg>
              <div className="flex-1 space-y-1.5 overflow-hidden">
                {modalities.slice(0, 6).map((m, i) => (
                  <div key={m.modality} className="flex items-center gap-2 cursor-pointer hover:opacity-75 transition-opacity" onClick={() => navigate('classes')}>
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: getModalityHex(m.modality, i) }} />
                    <span className="text-[11px] font-medium text-slate-600 truncate flex-1">{m.modality}</span>
                    <span className="text-[11px] font-bold text-slate-500 shrink-0">{m.count}</span>
                  </div>
                ))}
                {modalities.length > 6 && (
                  <p className="text-[10px] text-slate-400 pl-4">+{modalities.length - 6} mais</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Operational Lists ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Overdue payments */}
        <div className="bg-white rounded-[20px] border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] flex flex-col">
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-50">
            <div className="flex items-center gap-2.5">
              <h3 className="font-bold text-primary">Mensalidades Atrasadas</h3>
              {!loadingOverdue && overdue.length > 0 && (
                <span className="text-xs font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{overdue.length}</span>
              )}
            </div>
            {overdue.length > 0 && (
              <button onClick={() => navigate('financial')} className="text-xs font-semibold text-secondary hover:underline flex items-center gap-1">
                Ver todos <ArrowRight size={12} />
              </button>
            )}
          </div>
          <div className="flex-1 p-3">
            {loadingOverdue ? (
              <div className="space-y-2">
                {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
              </div>
            ) : overdue.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 size={32} className="text-green-400 mb-2" />
                <p className="text-sm font-semibold text-slate-600">Nenhuma mensalidade em atraso! 🎉</p>
                <p className="text-xs text-slate-400 mt-1">Todos os pagamentos estão em dia</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {overdue.slice(0, 5).map(p => (
                  <button
                    key={p.id}
                    onClick={() => onSelectStudent?.(p.student_id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-all text-left group"
                  >
                    <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0 text-xs font-bold text-red-600">
                      {p.student_name.split(' ').slice(0, 2).map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{p.student_name}</p>
                      <p className="text-xs text-slate-400">{fmtBRL(p.amount)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                        {p.daysLate}d atraso
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Today's classes */}
        <div className="bg-white rounded-[20px] border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] flex flex-col">
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-50">
            <div>
              <h3 className="font-bold text-primary">Agenda de Hoje</h3>
              <p className="text-xs text-slate-400 mt-0.5">{today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            </div>
            <button onClick={() => navigate('agenda')} className="text-xs font-semibold text-secondary hover:underline flex items-center gap-1">
              Agenda <ArrowRight size={12} />
            </button>
          </div>
          <div className="flex-1 p-3">
            {loadingToday ? (
              <div className="space-y-2">
                {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
              </div>
            ) : todayClasses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar size={32} className="text-slate-200 mb-2" />
                <p className="text-sm font-semibold text-slate-500">Sem aulas programadas para hoje</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {todayClasses.map(cls => {
                  const startM = parseTimeMins(cls.start_time);
                  const endM   = parseTimeMins(cls.end_time);
                  const isNow  = nowMins >= startM && nowMins < endM;
                  const isDone = nowMins >= endM;
                  return (
                    <div
                      key={cls.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl transition-all',
                        isNow  ? 'bg-secondary/8 border border-secondary/20' : 'hover:bg-slate-50',
                        isDone ? 'opacity-40' : '',
                      )}
                    >
                      <div className={cn('w-1.5 h-10 rounded-full shrink-0', getModalityDot(cls.modality), isNow && 'animate-pulse')} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate">{cls.class_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-400">{fmtTime(cls.start_time)} – {fmtTime(cls.end_time)}</span>
                          {cls.teacher && <span className="text-xs text-slate-300">·</span>}
                          {cls.teacher && <span className="text-xs text-slate-400 truncate">{cls.teacher}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full',
                          cls.enrolled >= cls.max_capacity ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'
                        )}>
                          {cls.enrolled}/{cls.max_capacity}
                        </span>
                        {isNow && (
                          <p className="text-[9px] font-bold text-secondary mt-0.5">Em andamento</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Recent Activity ── */}
      <div className="bg-white rounded-[20px] border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] p-5">
        <h3 className="font-bold text-primary mb-4">Atividade Recente</h3>
        {loadingActivity ? (
          <div className="space-y-3">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 rounded w-3/4" />
                  <Skeleton className="h-2.5 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : activity.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Nenhuma atividade recente</p>
        ) : (
          <div className="relative">
            <div className="absolute left-4 top-4 bottom-4 w-px bg-slate-100" />
            <div className="space-y-1">
              {activity.map(item => {
                const Icon = item.type === 'student' ? UserPlus : item.type === 'payment' ? DollarSign : BookOpen;
                const iconColor = item.type === 'student' ? 'bg-blue-100 text-secondary' : item.type === 'payment' ? 'bg-green-100 text-green-600' : 'bg-purple-100 text-purple-600';
                return (
                  <div key={item.id} className="flex items-start gap-3 pl-0 py-2 hover:bg-slate-50 rounded-xl px-2 transition-all">
                    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0 relative z-10', iconColor)}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <p className="text-sm text-slate-700">{item.description}</p>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0 pt-1 whitespace-nowrap">{relativeTime(item.timestamp)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

const KpiCard = ({
  label, value, icon, delta, deltaLabel, deltaType, statusColor, foot, onClick,
}: {
  label: string;
  value: string | null;
  icon: ReactNode;
  delta: number | null;
  deltaLabel: string;
  deltaType: 'absolute' | 'percent';
  statusColor?: 'green' | 'orange' | 'red';
  foot?: ReactNode;
  onClick?: () => void;
}) => {
  const isLoading = value === null;
  const deltaPositive = (delta ?? 0) > 0;
  const deltaZero     = (delta ?? 0) === 0;

  const statusColors = {
    green:  'text-green-600',
    orange: 'text-orange-500',
    red:    'text-red-500',
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-[20px] border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] p-4 flex flex-col gap-2',
        onClick && 'cursor-pointer hover:shadow-md hover:border-secondary/20 transition-all',
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider leading-tight">{label}</p>
        <div className="w-8 h-8 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary shrink-0">
          {icon}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-8 w-24 rounded-lg" />
      ) : (
        <p className={cn('text-2xl font-extrabold', statusColor ? statusColors[statusColor] : 'text-primary')}>
          {value}
        </p>
      )}

      {delta !== null && !isLoading ? (
        <div className="flex items-center gap-1">
          {!deltaZero && (
            deltaPositive
              ? <TrendingUp size={12} className="text-green-500" />
              : <TrendingDown size={12} className="text-red-400" />
          )}
          <span className={cn(
            'text-[11px] font-semibold',
            deltaZero ? 'text-slate-400' :
            deltaPositive ? 'text-green-600' : 'text-red-500'
          )}>
            {deltaZero ? '' : (deltaPositive ? '+' : '')}
            {deltaType === 'percent'
              ? `${delta!.toFixed(1)}%`
              : String(delta)}
          </span>
          <span className="text-[11px] text-slate-400">{deltaLabel}</span>
        </div>
      ) : statusColor ? (
        <div className={cn('text-[11px] font-semibold', statusColors[statusColor])}>
          {statusColor === 'green' ? '● Saudável' : statusColor === 'orange' ? '● Atenção' : '● Crítico'}
        </div>
      ) : isLoading ? (
        <Skeleton className="h-3 w-20 rounded" />
      ) : (
        <span className="text-[11px] text-slate-400">{deltaLabel}</span>
      )}
      {foot && <div className="mt-1">{foot}</div>}
    </div>
  );
};
