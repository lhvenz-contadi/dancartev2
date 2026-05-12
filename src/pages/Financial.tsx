import React, { useState, useEffect } from 'react';
import {
  Plus, Download, Sparkles, TrendingUp, Clock, AlertTriangle, Calendar,
  Loader2, Inbox, CheckCircle2, XCircle, CreditCard, X, Users, SlidersHorizontal,
  Pencil, Ban,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { useConfigOptions } from '../lib/useConfigOptions';
import { fmtBRL, fmtDateBR, MONTHS } from '../lib/format';
import { hashColor, getInitials } from '../lib/colors';
import { FAB } from '../components/ui/FAB';
import { BottomSheet } from '../components/ui/BottomSheet';
import { ListCard, type ListCardStatus } from '../components/ui/ListCard';

interface PaymentRow {
  id: string;
  reference_month: string;
  due_date: string;
  paid_date: string | null;
  amount: number;
  paid_amount: number | null;
  status: string;
  payment_method: string | null;
  type: string | null;
  description: string | null;
  students: { full_name: string } | null;
}

interface Student {
  id: string;
  full_name: string;
  status: string;
  custom_value: number;
  due_day: number;
}

const statusCfg: Record<string, { label: string; color: string; icon: React.FC<any>; listStatus: ListCardStatus }> = {
  Pago:      { label: 'Pago',      color: 'bg-green-100 text-green-600 border-green-200',  icon: CheckCircle2,   listStatus: 'success' },
  Pendente:  { label: 'Pendente',  color: 'bg-blue-100 text-secondary border-blue-200',    icon: Clock,          listStatus: 'warning' },
  Atrasado:  { label: 'Atrasado',  color: 'bg-red-100 text-red-500 border-red-200',        icon: AlertTriangle,  listStatus: 'danger'  },
  Cancelado: { label: 'Cancelado', color: 'bg-slate-100 text-slate-400 border-slate-200',  icon: XCircle,        listStatus: 'neutral' },
};

const PAYMENT_METHODS = ['PIX', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência'];

export const Financial = () => {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { options: chargeTypeOptions } = useConfigOptions('extra_charge');
  const [filterMonth, setFilterMonth] = useState(MONTHS[new Date().getMonth()]);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMethod, setFilterMethod] = useState('');
  const [showRegisterModal, setShowRegisterModal] = useState<PaymentRow | null>(null);
  const [registerMethod, setRegisterMethod] = useState('');
  const [registerDate, setRegisterDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [totalActiveStudents, setTotalActiveStudents] = useState(0);
  const [avgTuition, setAvgTuition] = useState(0);

  const [showExtraModal, setShowExtraModal] = useState(false);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [extra, setExtra] = useState({
    type: '', description: '', recipient: 'all' as 'all' | 'individual',
    studentId: '', amount: '', installments: '1', dueDate: '',
  });

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [genRecipient, setGenRecipient] = useState<'all' | 'individual'>('all');
  const [genStudentId, setGenStudentId] = useState('');
  const [genYear, setGenYear] = useState(new Date().getFullYear());
  const [genMonths, setGenMonths] = useState<number[]>([]);
  const [generating, setGenerating] = useState(false);

  const [showFiltersSheet, setShowFiltersSheet] = useState(false);
  const [showActionsSheet, setShowActionsSheet] = useState(false);
  const [detailPayment, setDetailPayment] = useState<PaymentRow | null>(null);

  const loadPayments = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('payments')
      .select('id, reference_month, due_date, paid_date, amount, paid_amount, status, payment_method, type, description, students(full_name)')
      .order('due_date', { ascending: false });
    setPayments((data as any[]) ?? []);
    setLoading(false);
  };

  const loadStudentStats = async () => {
    const { count } = await supabase.from('students').select('id', { count: 'exact', head: true }).eq('status', 'Ativo');
    setTotalActiveStudents(count ?? 0);
    const { data } = await supabase.from('students').select('custom_value').eq('status', 'Ativo').not('custom_value', 'is', null);
    if (data && data.length > 0) {
      const total = data.reduce((sum, s) => sum + (s.custom_value ?? 0), 0);
      setAvgTuition(total / data.length);
    }
  };

  const loadStudents = async () => {
    const { data } = await supabase.from('students').select('id, full_name, status, custom_value, due_day').eq('status', 'Ativo').order('full_name');
    setAllStudents(data ?? []);
  };

  useEffect(() => { loadPayments(); loadStudentStats(); loadStudents(); }, []);

  // Auto-detect overdue (pre-existing tech debt — see CLAUDE.md §20.2)
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    payments.forEach(async (p) => {
      if (p.status === 'Pendente' && p.due_date < today) {
        await supabase.from('payments').update({ status: 'Atrasado' }).eq('id', p.id);
      }
    });
  }, [payments]);

  const filtered = payments.filter(p => {
    const matchMonth = p.reference_month.toLowerCase().includes(filterMonth.toLowerCase());
    const matchYear = p.reference_month.includes(filterYear);
    const matchStatus = filterStatus ? p.status === filterStatus : true;
    const matchMethod = filterMethod ? p.payment_method === filterMethod : true;
    return matchMonth && matchYear && matchStatus && matchMethod;
  });

  const totalPaid = filtered.filter(p => p.status === 'Pago').reduce((s, p) => s + (p.paid_amount ?? p.amount), 0);
  const totalPending = filtered.filter(p => p.status === 'Pendente').reduce((s, p) => s + p.amount, 0);
  const totalOverdue = filtered.filter(p => p.status === 'Atrasado').reduce((s, p) => s + p.amount, 0);
  const forecastNext = totalActiveStudents * avgTuition;

  const handleRegisterPayment = async () => {
    if (!showRegisterModal) return;
    setSaving(true);
    await supabase.from('payments').update({
      status: 'Pago', paid_date: registerDate,
      paid_amount: showRegisterModal.amount, payment_method: registerMethod || null,
    }).eq('id', showRegisterModal.id);
    setSaving(false);
    setShowRegisterModal(null);
    setRegisterMethod('');
    await loadPayments();
  };

  const handleCancelPayment = async (id: string) => {
    await supabase.from('payments').update({ status: 'Cancelado' }).eq('id', id);
    setDetailPayment(null);
    await loadPayments();
  };

  const handleExtraCharge = async () => {
    if (!extra.type || !extra.amount || !extra.dueDate) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const totalAmount = parseFloat(extra.amount);
    const numInstallments = parseInt(extra.installments) || 1;
    const installmentAmount = Math.round((totalAmount / numInstallments) * 100) / 100;

    let targetStudents: string[] = [];
    if (extra.recipient === 'individual') {
      if (extra.studentId) targetStudents = [extra.studentId];
    } else {
      targetStudents = allStudents.map(s => s.id);
    }

    const today = new Date().toISOString().split('T')[0];
    const inserts: any[] = [];
    for (const sid of targetStudents) {
      for (let i = 0; i < numInstallments; i++) {
        const dd = new Date(extra.dueDate + 'T00:00:00');
        dd.setMonth(dd.getMonth() + i);
        const dueStr = dd.toISOString().split('T')[0];
        const ref = numInstallments > 1
          ? `${extra.description || extra.type} ${i + 1}/${numInstallments}`
          : (extra.description || extra.type);
        inserts.push({
          student_id: sid, owner_id: user?.id,
          reference_month: ref,
          due_date: dueStr,
          amount: installmentAmount,
          status: dueStr < today ? 'Atrasado' : 'Pendente',
          type: extra.type,
          description: extra.description || null,
        });
      }
    }
    if (inserts.length > 0) await supabase.from('payments').insert(inserts);
    setSaving(false);
    setShowExtraModal(false);
    setExtra({ type: '', description: '', recipient: 'all', studentId: '', amount: '', installments: '1', dueDate: '' });
    await loadPayments();
  };

  const handleGenerate = async () => {
    if (genMonths.length === 0) return;
    setGenerating(true);
    const { data: { user } } = await supabase.auth.getUser();

    let targetStudents: Student[] = [];
    if (genRecipient === 'individual') {
      const s = allStudents.find(st => st.id === genStudentId);
      if (s) targetStudents = [s];
    } else {
      targetStudents = allStudents;
    }

    const today = new Date().toISOString().split('T')[0];
    const monthRefs = genMonths.map(idx => `${MONTHS[idx]}/${genYear}`);

    const { data: existing } = await supabase
      .from('payments')
      .select('student_id, reference_month')
      .in('reference_month', monthRefs)
      .eq('type', 'Mensalidade')
      .in('student_id', targetStudents.map(s => s.id));

    const existingMap = new Set(existing?.map(e => `${e.student_id}-${e.reference_month}`) || []);
    const inserts: any[] = [];

    for (const student of targetStudents) {
      for (const monthIdx of genMonths) {
        const monthName = MONTHS[monthIdx];
        const refMonth = `${monthName}/${genYear}`;
        if (existingMap.has(`${student.id}-${refMonth}`)) continue;
        const dueDay = student.due_day || 10;
        const dueStr = `${genYear}-${String(monthIdx + 1).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
        inserts.push({
          student_id: student.id,
          owner_id: user?.id,
          reference_month: refMonth,
          due_date: dueStr,
          amount: student.custom_value || 0,
          status: dueStr < today ? 'Atrasado' : 'Pendente',
          type: 'Mensalidade',
          description: null,
        });
      }
    }

    if (inserts.length > 0) {
      const CHUNK_SIZE = 500;
      for (let i = 0; i < inserts.length; i += CHUNK_SIZE) {
        await supabase.from('payments').insert(inserts.slice(i, i + CHUNK_SIZE));
      }
    }

    setGenerating(false);
    setShowGenerateModal(false);
    setGenMonths([]);
    await loadPayments();
  };

  const toggleGenMonth = (idx: number) => {
    setGenMonths(prev => prev.includes(idx) ? prev.filter(m => m !== idx) : [...prev, idx]);
  };

  const toggleAllGenMonths = () => {
    if (genMonths.length === 12) setGenMonths([]);
    else setGenMonths([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  };

  const renderPaymentAvatar = (p: PaymentRow) => {
    const name = p.students?.full_name ?? '?';
    return (
      <div className={cn('w-12 h-12 rounded-full text-white flex items-center justify-center font-bold text-sm', hashColor(name))}>
        {getInitials(name)}
      </div>
    );
  };

  const activeFiltersCount = (filterStatus ? 1 : 0) + (filterMethod ? 1 : 0);
  const detailCfg = detailPayment ? (statusCfg[detailPayment.status] ?? statusCfg['Pendente']) : null;

  return (
    <div className="max-w-[1200px] mx-auto space-y-4 md:space-y-6 pb-24 md:pb-12">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-primary">Financeiro</h2>
          <p className="text-[13px] text-slate-400 mt-0.5">{filterMonth} {filterYear} • {filtered.length} lançamento(s)</p>
        </div>
        <div className="hidden md:flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-secondary text-secondary font-bold hover:bg-secondary/5 transition-all text-sm"
          >
            <Sparkles size={16} />
            Gerar Mensalidades
          </button>
          <button
            onClick={() => setShowExtraModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white rounded-full font-bold hover:bg-primary transition-all text-sm shadow-md shadow-secondary/20"
          >
            <Plus size={16} strokeWidth={3} />
            Nova Cobrança Extra
          </button>
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all text-sm">
            <Download size={16} />
            Exportar Excel
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KpiCard
          icon={<TrendingUp size={18} className="text-green-500" />}
          iconBg="bg-green-50"
          label="Receita do mês"
          value={fmtBRL(totalPaid)}
          valueColor="text-green-500"
          hint="pagamentos confirmados"
        />
        <KpiCard
          icon={<Clock size={18} className="text-secondary" />}
          iconBg="bg-secondary/10"
          label="A receber"
          value={fmtBRL(totalPending)}
          valueColor="text-secondary"
          hint="pendentes no prazo"
        />
        <KpiCard
          icon={<AlertTriangle size={18} className="text-red-500" />}
          iconBg="bg-red-50"
          label="Em atraso"
          value={fmtBRL(totalOverdue)}
          valueColor="text-red-500"
          hint="fora do prazo"
        />
        <KpiCard
          icon={<Calendar size={18} className="text-secondary" />}
          iconBg="bg-secondary/10"
          label="Previsão próx."
          value={fmtBRL(forecastNext)}
          valueColor="text-secondary"
          hint="baseado em alunos ativos"
        />
      </div>

      {/* Mobile: filter trigger */}
      <div className="md:hidden flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowFiltersSheet(true)}
          className="inline-flex items-center gap-2 min-h-11 px-4 rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-700"
        >
          <SlidersHorizontal size={16} />
          {filterMonth.slice(0, 3)} {filterYear}
          {activeFiltersCount > 0 && (
            <span className="bg-secondary text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">{activeFiltersCount}</span>
          )}
        </button>
      </div>

      {/* Desktop filters */}
      <div className="hidden md:flex flex-wrap items-center gap-3">
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="px-4 py-2 bg-white border border-slate-200 rounded-full text-[13px] font-medium text-slate-700 outline-none hover:bg-slate-50 cursor-pointer">
          {MONTHS.map(m => <option key={m}>{m}</option>)}
        </select>
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="px-4 py-2 bg-white border border-slate-200 rounded-full text-[13px] font-medium text-slate-700 outline-none hover:bg-slate-50 cursor-pointer">
          {[2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-4 py-2 bg-white border border-slate-200 rounded-full text-[13px] font-medium text-slate-700 outline-none hover:bg-slate-50 cursor-pointer">
          <option value="">Todos os status</option>
          <option>Pago</option><option>Pendente</option><option>Atrasado</option><option>Cancelado</option>
        </select>
        <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)} className="px-4 py-2 bg-white border border-slate-200 rounded-full text-[13px] font-medium text-slate-700 outline-none hover:bg-slate-50 cursor-pointer">
          <option value="">Todas as formas</option>
          {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
        </select>
      </div>

      {/* Mobile: ListCard list */}
      <div className="md:hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-300">
            <Loader2 size={32} className="animate-spin mb-2" />
            <p className="text-sm">Carregando lançamentos...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-300">
            <Inbox size={40} className="mb-3 opacity-40" />
            <p className="text-sm font-semibold text-slate-400">Nenhum pagamento encontrado</p>
            <p className="text-xs text-slate-300 mt-1">Ajuste os filtros para ver mais.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(p => {
              const cfg = statusCfg[p.status] ?? statusCfg['Pendente'];
              return (
                <ListCard
                  key={p.id}
                  avatar={renderPaymentAvatar(p)}
                  title={p.students?.full_name ?? '—'}
                  subtitle={
                    <p className="truncate">{p.reference_month} · {p.type ?? 'Mensalidade'}</p>
                  }
                  meta={
                    <>
                      <span className="text-sm font-bold text-primary whitespace-nowrap">{fmtBRL(p.amount)}</span>
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border tracking-wider', cfg.color)}>
                        {cfg.label}
                      </span>
                    </>
                  }
                  status={cfg.listStatus}
                  onClick={() => setDetailPayment(p)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-[20px] shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-slate-50 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-slate-300"><Loader2 size={32} className="animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-300">
            <Inbox size={40} className="mb-3 opacity-40" />
            <h3 className="text-[15px] font-bold text-slate-400 mb-1">Nenhum pagamento encontrado</h3>
            <p className="text-[13px] text-slate-400">Tente ajustar os filtros de mês ou status.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-50">
                  <th className="px-5 py-4 text-[11px] font-bold uppercase text-slate-400 tracking-wider">Aluna</th>
                  <th className="px-5 py-4 text-[11px] font-bold uppercase text-slate-400 tracking-wider">Tipo</th>
                  <th className="px-5 py-4 text-[11px] font-bold uppercase text-slate-400 tracking-wider">Valor</th>
                  <th className="px-5 py-4 text-[11px] font-bold uppercase text-slate-400 tracking-wider">Vencimento</th>
                  <th className="px-5 py-4 text-[11px] font-bold uppercase text-slate-400 tracking-wider">Status</th>
                  <th className="px-5 py-4 text-[11px] font-bold uppercase text-slate-400 tracking-wider">Pago em</th>
                  <th className="px-5 py-4 text-[11px] font-bold uppercase text-slate-400 tracking-wider">Forma</th>
                  <th className="px-5 py-4 text-[11px] font-bold uppercase text-slate-400 tracking-wider w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(p => {
                  const cfg = statusCfg[p.status] ?? statusCfg['Pendente'];
                  const Icon = cfg.icon;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <p className="text-sm font-bold text-primary uppercase">{p.students?.full_name ?? '—'}</p>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-500">{p.type || 'Mensalidade'}</td>
                      <td className="px-5 py-4 text-sm font-bold text-primary">{fmtBRL(p.amount)}</td>
                      <td className="px-5 py-4 text-sm text-slate-500">{fmtDateBR(p.due_date)}</td>
                      <td className="px-5 py-4">
                        <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border tracking-wider', cfg.color)}>
                          <Icon size={11} />{cfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-500">
                        {p.paid_date ? fmtDateBR(p.paid_date) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-500">{p.payment_method || <span className="text-slate-300">—</span>}</td>
                      <td className="px-5 py-4">
                        {p.status !== 'Pago' && p.status !== 'Cancelado' && (
                          <button
                            onClick={() => { setShowRegisterModal(p); setRegisterDate(new Date().toISOString().split('T')[0]); setRegisterMethod(''); }}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-secondary text-white rounded-full text-[11px] font-bold hover:bg-primary transition-all whitespace-nowrap"
                          >
                            <CreditCard size={13} />
                            Registrar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FAB to open action menu (mobile) */}
      <FAB
        icon={<Plus size={26} />}
        onClick={() => setShowActionsSheet(true)}
        label="Ações financeiras"
      />

      {/* Mobile: Actions BottomSheet */}
      <BottomSheet
        open={showActionsSheet}
        onClose={() => setShowActionsSheet(false)}
        title="Novo lançamento"
      >
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => { setShowActionsSheet(false); setShowGenerateModal(true); }}
            className="w-full flex items-center gap-3 p-4 min-h-14 rounded-2xl border border-secondary/30 bg-secondary/5 text-left active:bg-secondary/10 transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary shrink-0">
              <Sparkles size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-primary">Gerar mensalidades</p>
              <p className="text-xs text-slate-500 mt-0.5">Em lote para todas as alunas ou individual</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => { setShowActionsSheet(false); setShowExtraModal(true); }}
            className="w-full flex items-center gap-3 p-4 min-h-14 rounded-2xl border border-slate-200 text-left active:bg-slate-50 transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Plus size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-primary">Cobrança extra</p>
              <p className="text-xs text-slate-500 mt-0.5">Uniforme, figurino, evento, etc.</p>
            </div>
          </button>
        </div>
      </BottomSheet>

      {/* Mobile: Filters BottomSheet */}
      <BottomSheet
        open={showFiltersSheet}
        onClose={() => setShowFiltersSheet(false)}
        title="Filtros"
      >
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Mês</label>
            <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="w-full px-4 h-11 bg-white border border-slate-200 rounded-xl text-base text-slate-700 outline-none focus:border-secondary">
              {MONTHS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Ano</label>
            <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="w-full px-4 h-11 bg-white border border-slate-200 rounded-xl text-base text-slate-700 outline-none focus:border-secondary">
              {[2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full px-4 h-11 bg-white border border-slate-200 rounded-xl text-base text-slate-700 outline-none focus:border-secondary">
              <option value="">Todos os status</option>
              <option>Pago</option><option>Pendente</option><option>Atrasado</option><option>Cancelado</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Forma de pagamento</label>
            <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)} className="w-full px-4 h-11 bg-white border border-slate-200 rounded-xl text-base text-slate-700 outline-none focus:border-secondary">
              <option value="">Todas as formas</option>
              {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => { setFilterStatus(''); setFilterMethod(''); }}
              className="flex-1 min-h-11 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={() => setShowFiltersSheet(false)}
              className="flex-1 min-h-11 bg-primary text-white rounded-xl font-bold text-sm"
            >
              Aplicar
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Mobile: Payment detail BottomSheet */}
      <BottomSheet
        open={!!detailPayment}
        onClose={() => setDetailPayment(null)}
        title={detailPayment?.students?.full_name ?? 'Pagamento'}
      >
        {detailPayment && detailCfg && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-2xl p-4 text-center">
              <p className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">Valor</p>
              <p className="text-3xl font-black text-primary mt-1">{fmtBRL(detailPayment.amount)}</p>
              <span className={cn('inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border tracking-wider', detailCfg.color)}>
                <detailCfg.icon size={11} />{detailCfg.label}
              </span>
            </div>

            <dl className="space-y-2 text-sm">
              <DetailRow label="Referência" value={detailPayment.reference_month} />
              <DetailRow label="Tipo" value={detailPayment.type ?? 'Mensalidade'} />
              <DetailRow label="Vencimento" value={fmtDateBR(detailPayment.due_date)} />
              {detailPayment.paid_date && <DetailRow label="Pago em" value={fmtDateBR(detailPayment.paid_date)} />}
              {detailPayment.payment_method && <DetailRow label="Forma" value={detailPayment.payment_method} />}
              {detailPayment.description && <DetailRow label="Descrição" value={detailPayment.description} />}
            </dl>

            <div className="space-y-2 pt-2">
              {detailPayment.status !== 'Pago' && detailPayment.status !== 'Cancelado' && (
                <button
                  type="button"
                  onClick={() => {
                    setShowRegisterModal(detailPayment);
                    setRegisterDate(new Date().toISOString().split('T')[0]);
                    setRegisterMethod('');
                    setDetailPayment(null);
                  }}
                  className="w-full min-h-11 inline-flex items-center justify-center gap-2 bg-green-500 text-white rounded-xl font-bold text-sm hover:bg-green-600"
                >
                  <CheckCircle2 size={18} />
                  Marcar como pago
                </button>
              )}
              <button
                type="button"
                disabled
                className="w-full min-h-11 inline-flex items-center justify-center gap-2 border border-slate-200 text-slate-400 rounded-xl font-bold text-sm cursor-not-allowed"
                title="Em breve"
              >
                <Pencil size={16} />
                Editar (em breve)
              </button>
              {detailPayment.status !== 'Pago' && detailPayment.status !== 'Cancelado' && (
                <button
                  type="button"
                  onClick={() => handleCancelPayment(detailPayment.id)}
                  className="w-full min-h-11 inline-flex items-center justify-center gap-2 border border-red-200 text-red-500 rounded-xl font-bold text-sm hover:bg-red-50"
                >
                  <Ban size={16} />
                  Cancelar pagamento
                </button>
              )}
            </div>
          </div>
        )}
      </BottomSheet>

      {/* Register Payment Modal (centered, used on desktop + as mobile flow) */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setShowRegisterModal(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-t-3xl md:rounded-3xl p-5 md:p-8 w-full md:max-w-md shadow-2xl space-y-5 max-h-[90dvh] overflow-y-auto" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 1.25rem)' }}>
            <h3 className="text-lg font-black text-primary">Registrar pagamento</h3>
            <p className="text-sm text-slate-400">
              <span className="font-bold text-primary">{showRegisterModal.students?.full_name}</span> — {showRegisterModal.reference_month}
            </p>
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <p className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">Valor</p>
              <p className="text-3xl font-black text-primary mt-1">{fmtBRL(showRegisterModal.amount)}</p>
            </div>
            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">Forma de pagamento</label>
              <select value={registerMethod} onChange={e => setRegisterMethod(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 h-11 text-base md:text-sm outline-none focus:border-secondary bg-white">
                <option value="">Selecione...</option>
                {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">Data do pagamento</label>
              <input type="date" value={registerDate} onChange={e => setRegisterDate(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 h-11 text-base md:text-sm outline-none focus:border-secondary text-slate-500" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowRegisterModal(null)} className="flex-1 min-h-11 rounded-xl border border-slate-200 text-primary font-bold hover:bg-slate-50 transition-colors text-sm">Cancelar</button>
              <button onClick={handleRegisterPayment} disabled={saving} className="flex-1 min-h-11 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Confirmar pagamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extra Charge Modal */}
      {showExtraModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setShowExtraModal(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-t-3xl md:rounded-3xl p-5 md:p-8 w-full md:max-w-lg shadow-2xl space-y-5 max-h-[90dvh] overflow-y-auto" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 1.25rem)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-primary">Nova Cobrança Extra</h3>
              <button onClick={() => setShowExtraModal(false)} className="w-10 h-10 -mr-2 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full"><X size={20} /></button>
            </div>

            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">Tipo de cobrança <span className="text-red-500">*</span></label>
              <select value={extra.type} onChange={e => setExtra(p => ({ ...p, type: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 h-11 text-base md:text-sm outline-none focus:border-secondary bg-white">
                <option value="">Selecione o tipo</option>
                {chargeTypeOptions.map(t => <option key={t.id} value={t.label}>{t.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">Descrição <span className="text-red-500">*</span></label>
              <input type="text" value={extra.description} onChange={e => setExtra(p => ({ ...p, description: e.target.value }))} placeholder="Ex: Uniforme Ballet 2026" className="w-full rounded-xl border border-slate-200 px-4 h-11 text-base md:text-sm outline-none focus:border-secondary" />
            </div>

            <div>
              <label className="block text-[13px] font-bold text-primary mb-3">Destinatários <span className="text-red-500">*</span></label>
              <div className="space-y-2">
                <label
                  className={cn('flex items-center justify-between p-4 min-h-12 rounded-xl border cursor-pointer transition-all',
                    extra.recipient === 'all' ? 'border-secondary bg-secondary/5' : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <input type="radio" name="recipient" checked={extra.recipient === 'all'} onChange={() => setExtra(p => ({ ...p, recipient: 'all', studentId: '' }))} className="accent-secondary" />
                    <span className="text-sm font-semibold text-primary">Todas as alunas ativas</span>
                  </div>
                  <span className="flex items-center gap-1 text-[12px] text-slate-400 font-medium"><Users size={14} />{allStudents.length} aluna(s)</span>
                </label>
                <label
                  className={cn('flex items-center p-4 min-h-12 rounded-xl border cursor-pointer transition-all',
                    extra.recipient === 'individual' ? 'border-secondary bg-secondary/5' : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <input type="radio" name="recipient" checked={extra.recipient === 'individual'} onChange={() => setExtra(p => ({ ...p, recipient: 'individual' }))} className="accent-secondary" />
                  <span className="text-sm font-semibold text-primary ml-3">Aluna individual</span>
                </label>
              </div>
              {extra.recipient === 'individual' && (
                <select value={extra.studentId} onChange={e => setExtra(p => ({ ...p, studentId: e.target.value }))} className="w-full mt-3 rounded-xl border border-slate-200 px-4 h-11 text-base md:text-sm outline-none focus:border-secondary bg-white">
                  <option value="">Selecione a aluna...</option>
                  {allStudents.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[13px] font-bold text-primary mb-1.5">Valor total (R$) <span className="text-red-500">*</span></label>
                <input type="number" step="0.01" min="0" value={extra.amount} onChange={e => setExtra(p => ({ ...p, amount: e.target.value }))} placeholder="0,00" className="w-full rounded-xl border border-slate-200 px-4 h-11 text-base md:text-sm outline-none focus:border-secondary" />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-primary mb-1.5">Parcelas</label>
                <select value={extra.installments} onChange={e => setExtra(p => ({ ...p, installments: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 h-11 text-base md:text-sm outline-none focus:border-secondary bg-white">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => <option key={n} value={n}>{n}x</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">Vencimento <span className="text-red-500">*</span></label>
              <input type="date" value={extra.dueDate} onChange={e => setExtra(p => ({ ...p, dueDate: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 h-11 text-base md:text-sm outline-none focus:border-secondary text-slate-500" />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowExtraModal(false)} className="flex-1 min-h-11 rounded-xl border border-slate-200 text-primary font-bold hover:bg-slate-50 text-sm">Cancelar</button>
              <button
                onClick={handleExtraCharge}
                disabled={saving || !extra.type || !extra.amount || !extra.dueDate || (extra.recipient === 'individual' && !extra.studentId)}
                className="flex-1 min-h-11 bg-secondary text-white rounded-xl font-bold hover:bg-primary transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Gerar cobranças
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Generate Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setShowGenerateModal(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-t-3xl md:rounded-3xl p-5 md:p-8 w-full md:max-w-xl shadow-2xl space-y-5 max-h-[90dvh] overflow-y-auto" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 1.25rem)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-primary">Gerar Mensalidades em Lote</h3>
              <button onClick={() => setShowGenerateModal(false)} className="w-10 h-10 -mr-2 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full"><X size={20} /></button>
            </div>

            <div>
              <label className="block text-[13px] font-bold text-primary mb-3">Destinatárias</label>
              <div className="flex flex-wrap gap-2 mb-2">
                <button
                  onClick={() => setGenRecipient('all')}
                  className={cn('px-4 min-h-10 text-sm font-semibold rounded-full border transition-all', genRecipient === 'all' ? 'bg-secondary text-white border-secondary' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300')}
                >
                  Todas as ativas
                </button>
                <button
                  disabled
                  className="px-4 min-h-10 text-sm font-semibold rounded-full border bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed"
                  title="Funcionalidade em desenvolvimento"
                >
                  Turma específica
                </button>
                <button
                  onClick={() => setGenRecipient('individual')}
                  className={cn('px-4 min-h-10 text-sm font-semibold rounded-full border transition-all', genRecipient === 'individual' ? 'bg-secondary text-white border-secondary' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300')}
                >
                  Aluna individual
                </button>
              </div>
              <p className="text-[12px] font-medium text-slate-400">
                {genRecipient === 'all' && `${allStudents.length} aluna(s) selecionada(s)`}
              </p>
              {genRecipient === 'individual' && (
                <select value={genStudentId} onChange={e => setGenStudentId(e.target.value)} className="w-full mt-3 rounded-xl border border-slate-200 px-4 h-11 text-base md:text-sm outline-none focus:border-secondary bg-white">
                  <option value="">Selecione a aluna...</option>
                  {allStudents.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              )}
            </div>

            <div>
              <label className="block text-[13px] font-bold text-primary mb-2">Ano</label>
              <select value={genYear} onChange={e => { setGenYear(Number(e.target.value)); setGenMonths([]); }} className="w-32 px-4 h-11 bg-white border border-slate-200 rounded-xl text-base md:text-sm outline-none focus:border-secondary cursor-pointer">
                {[2025, 2026, 2027, 2028].map(y => <option key={y}>{y}</option>)}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-[13px] font-bold text-primary">Meses</label>
                <button type="button" onClick={toggleAllGenMonths} className="text-[12px] font-bold text-secondary hover:underline inline-flex items-center gap-1 min-h-10 px-2 -mr-2">
                  <CheckCircle2 size={13} />
                  {genMonths.length === 12 ? 'Limpar seleção' : 'Todos'}
                </button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {MONTHS.map((month, idx) => {
                  const isSelected = genMonths.includes(idx);
                  return (
                    <button
                      key={month}
                      type="button"
                      onClick={() => toggleGenMonth(idx)}
                      className={cn(
                        'flex flex-col items-center gap-1 py-3 min-h-12 rounded-xl border text-sm font-semibold transition-all cursor-pointer',
                        isSelected
                          ? 'bg-secondary text-white border-secondary'
                          : 'bg-white border-slate-200 text-primary hover:border-secondary/50',
                      )}
                    >
                      <div className={cn('w-4 h-4 rounded flex items-center justify-center border', isSelected ? 'border-white bg-white/20' : 'border-slate-300')}>
                        {isSelected && <CheckCircle2 size={12} className="text-white" strokeWidth={3} />}
                      </div>
                      {month}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <p className="text-[14px] font-bold text-primary">
                {genRecipient === 'all' ? allStudents.length : genRecipient === 'individual' && genStudentId ? 1 : 0} aluna(s) &times; {genMonths.length} mês/meses = {(genRecipient === 'all' ? allStudents.length : genRecipient === 'individual' && genStudentId ? 1 : 0) * genMonths.length} lançamento(s)
              </p>
              <p className="text-[12px] text-slate-400 mt-1">Registros já existentes serão automaticamente ignorados.</p>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowGenerateModal(false)} className="flex-1 min-h-11 rounded-xl border border-slate-200 text-primary font-bold hover:bg-slate-50 transition-colors text-sm">Cancelar</button>
              <button
                onClick={handleGenerate}
                disabled={genMonths.length === 0 || generating || (genRecipient === 'individual' && !genStudentId)}
                className="flex-1 min-h-11 bg-secondary text-white rounded-xl font-bold hover:bg-primary transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                Gerar Mensalidades
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── KPI helper ────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  valueColor: string;
  hint: string;
}

const KpiCard = ({ icon, iconBg, label, value, valueColor, hint }: KpiCardProps) => (
  <div className="bg-white rounded-2xl md:rounded-[20px] p-3 md:p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-slate-50 flex items-center gap-3 md:gap-4">
    <div className={cn('w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0', iconBg)}>
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-wider leading-tight">{label}</p>
      <p className={cn('text-base md:text-xl font-black my-0.5 truncate', valueColor)}>{value}</p>
      <p className="text-[10px] md:text-[11px] text-slate-400 leading-tight">{hint}</p>
    </div>
  </div>
);

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
    <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</dt>
    <dd className="text-sm font-medium text-primary text-right">{value}</dd>
  </div>
);
