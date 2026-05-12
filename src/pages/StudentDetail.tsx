import React, { useState, useEffect, useMemo, type ReactNode } from 'react';
import {
  ChevronLeft, ChevronDown, Camera, Loader2, Save, Plus, CheckCircle2,
  Clock, AlertTriangle, XCircle, Inbox, Sparkles, X, ClipboardCheck,
  Wallet, Layers, Search, Filter, MoreVertical, Pencil, Power, Trash2,
  Mail, Phone, MapPin, User, FileText, Users as UsersIcon, MessageSquare,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { useConfigOptions } from '../lib/useConfigOptions';
import { MONTHS, fmtBRL, fmtDateBR, fmtTime } from '../lib/format';
import { getModalityDot, getInitials, hashColor } from '../lib/colors';
import { FAB } from '../components/ui/FAB';
import { BottomSheet } from '../components/ui/BottomSheet';
import { ListCard, type ListCardStatus } from '../components/ui/ListCard';

interface StudentDetailProps {
  studentId: string;
  onBack: () => void;
}

interface Payment {
  id: string;
  reference_month: string;
  due_date: string;
  paid_date: string | null;
  amount: number;
  paid_amount: number | null;
  status: string;
  payment_method: string | null;
  notes: string | null;
}

const statusConfig: Record<
  string,
  { label: string; badge: string; icon: React.FC<any>; listStatus: ListCardStatus }
> = {
  Pago:      { label: 'Pago',      badge: 'bg-green-100 text-green-600 border-green-200',  icon: CheckCircle2,   listStatus: 'success' },
  Pendente:  { label: 'Pendente',  badge: 'bg-blue-100 text-secondary border-blue-200',    icon: Clock,          listStatus: 'neutral' },
  Atrasado:  { label: 'Atrasado',  badge: 'bg-red-100 text-red-500 border-red-200',        icon: AlertTriangle,  listStatus: 'danger' },
  Cancelado: { label: 'Cancelado', badge: 'bg-slate-100 text-slate-400 border-slate-200',  icon: XCircle,        listStatus: 'neutral' },
};

const inputClass =
  'w-full h-11 rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-3.5 text-base outline-none transition-all placeholder-slate-300';
const labelClass = 'block text-[13px] font-bold text-primary mb-1.5';

// ── Accordion Section (mobile collapsible, always-open on md+) ──────────────
type SectionProps = {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
};

const Section = ({ title, isOpen, onToggle, children }: SectionProps) => (
  <div className="bg-white rounded-2xl md:rounded-[20px] shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-slate-50 overflow-hidden">
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between gap-3 px-5 py-4 md:px-8 md:pt-7 md:pb-2 md:cursor-default"
      aria-expanded={isOpen}
    >
      <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider text-left">{title}</h3>
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
        <div className="px-5 pb-5 md:px-8 md:pb-8">{children}</div>
      </div>
    </div>
  </div>
);

// ── Financial Tab ───────────────────────────────────────────────────────────
interface FinancialTabProps {
  studentId: string;
  studentName: string;
  studentPlan: string;
  studentValue: number;
  studentDueDay: number;
}

const FinancialTab = ({
  studentId, studentName, studentPlan, studentValue, studentDueDay,
}: FinancialTabProps) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const [showActions, setShowActions] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const [showPaymentSheet, setShowPaymentSheet] = useState<Payment | null>(null);

  const [genYear, setGenYear] = useState(new Date().getFullYear());
  const [genMonths, setGenMonths] = useState<number[]>([]);
  const [generating, setGenerating] = useState(false);

  const [payToConfirm, setPayToConfirm] = useState<Payment | null>(null);
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payMethod, setPayMethod] = useState('');
  const [saving, setSaving] = useState(false);

  const [extraData, setExtraData] = useState({
    type: '', description: '', amount: '', installments: '1', dueDate: '',
  });

  const { options: chargeTypes } = useConfigOptions('extra_charge');

  const loadPayments = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('payments').select('*').eq('student_id', studentId)
      .order('due_date', { ascending: false });
    setPayments(data ?? []);
    setLoading(false);
  };

  useEffect(() => { loadPayments(); /* eslint-disable-next-line */ }, [studentId]);

  const existingMonths = payments
    .map(p => p.reference_month)
    .filter(r => r.includes(genYear.toString()))
    .map(r => MONTHS.findIndex(m => r.toLowerCase().startsWith(m.toLowerCase())))
    .filter(i => i >= 0);

  const availableCount = MONTHS.length - existingMonths.length;

  const toggleMonth = (idx: number) => {
    if (existingMonths.includes(idx)) return;
    setGenMonths(prev => (prev.includes(idx) ? prev.filter(m => m !== idx) : [...prev, idx]));
  };

  const selectAllAvailable = () => {
    const available = MONTHS.map((_, i) => i).filter(i => !existingMonths.includes(i));
    setGenMonths(prev => (prev.length === available.length ? [] : available));
  };

  const handleGenerate = async () => {
    if (genMonths.length === 0) return;
    setGenerating(true);
    const { data: { user } } = await supabase.auth.getUser();
    const inserts = genMonths.map(monthIdx => {
      const dd = Math.min(studentDueDay || 10, 28);
      const dueDate = `${genYear}-${String(monthIdx + 1).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
      return {
        student_id: studentId,
        owner_id: user?.id,
        reference_month: `${MONTHS[monthIdx]}/${genYear}`,
        due_date: dueDate,
        amount: studentValue || 0,
        status: new Date(dueDate) < new Date(new Date().toISOString().split('T')[0]) ? 'Atrasado' : 'Pendente',
      };
    });
    await supabase.from('payments').insert(inserts);
    setGenerating(false);
    setShowGenerate(false);
    setGenMonths([]);
    await loadPayments();
  };

  const confirmMarkPaid = async () => {
    if (!payToConfirm) return;
    setSaving(true);
    await supabase.from('payments').update({
      status: 'Pago',
      paid_date: payDate,
      paid_amount: payToConfirm.amount,
      payment_method: payMethod || null,
    }).eq('id', payToConfirm.id);
    setPayToConfirm(null);
    setPayMethod('');
    setShowPaymentSheet(null);
    setSaving(false);
    await loadPayments();
  };

  const handleExtraCharge = async () => {
    if (!extraData.type || !extraData.amount || !extraData.dueDate) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const totalAmount = parseFloat(extraData.amount);
    const numInstallments = parseInt(extraData.installments) || 1;
    const installmentAmount = Math.round((totalAmount / numInstallments) * 100) / 100;
    const today = new Date().toISOString().split('T')[0];
    const inserts: any[] = [];
    for (let i = 0; i < numInstallments; i++) {
      const dd = new Date(extraData.dueDate + 'T00:00:00');
      dd.setMonth(dd.getMonth() + i);
      const dueStr = dd.toISOString().split('T')[0];
      const ref = numInstallments > 1
        ? `${extraData.description || extraData.type} ${i + 1}/${numInstallments}`
        : (extraData.description || extraData.type);
      inserts.push({
        student_id: studentId, owner_id: user?.id,
        reference_month: ref, due_date: dueStr,
        amount: installmentAmount,
        status: dueStr < today ? 'Atrasado' : 'Pendente',
        type: extraData.type, description: extraData.description || null,
      });
    }
    if (inserts.length > 0) await supabase.from('payments').insert(inserts);
    setSaving(false);
    setShowExtra(false);
    setExtraData({ type: '', description: '', amount: '', installments: '1', dueDate: '' });
    await loadPayments();
  };

  const totalPaid = payments.filter(p => p.status === 'Pago').reduce((s, p) => s + (p.paid_amount ?? p.amount), 0);
  const totalPending = payments.filter(p => p.status === 'Pendente').reduce((s, p) => s + p.amount, 0);
  const totalOverdue = payments.filter(p => p.status === 'Atrasado').reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-green-50 border border-green-100 rounded-2xl p-3 md:p-4">
          <p className="text-[10px] md:text-[11px] font-bold text-green-600 uppercase tracking-wider">Pago</p>
          <p className="text-base md:text-xl font-black text-green-600 mt-1 break-words">{fmtBRL(totalPaid)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 md:p-4">
          <p className="text-[10px] md:text-[11px] font-bold text-secondary uppercase tracking-wider">Pendente</p>
          <p className="text-base md:text-xl font-black text-secondary mt-1 break-words">{fmtBRL(totalPending)}</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-3 md:p-4">
          <p className="text-[10px] md:text-[11px] font-bold text-red-500 uppercase tracking-wider">Atrasado</p>
          <p className="text-base md:text-xl font-black text-red-500 mt-1 break-words">{fmtBRL(totalOverdue)}</p>
        </div>
      </div>

      {/* Desktop actions row */}
      <div className="hidden md:flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-primary uppercase tracking-wider">Histórico de mensalidades</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowGenerate(true)}
            className="inline-flex items-center gap-2 min-h-11 px-4 rounded-full border border-secondary text-secondary text-sm font-bold hover:bg-secondary/5"
          >
            <Sparkles size={15} /> Gerar mensalidades
          </button>
          <button
            type="button"
            onClick={() => setShowExtra(true)}
            className="inline-flex items-center gap-2 min-h-11 px-4 bg-orange-500 text-white rounded-full text-sm font-bold hover:bg-orange-600 shadow-md shadow-orange-500/20"
          >
            <Plus size={16} strokeWidth={3} /> Cobrança extra
          </button>
        </div>
      </div>

      {/* Payment list */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-300">
          <Loader2 size={28} className="animate-spin" />
        </div>
      ) : payments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-300 bg-white rounded-2xl border border-slate-100">
          <Inbox size={40} className="mb-3 opacity-40" />
          <p className="text-sm font-medium text-slate-400">Nenhuma cobrança registrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {payments.map(payment => {
            const cfg = statusConfig[payment.status] ?? statusConfig['Pendente'];
            const Icon = cfg.icon;
            return (
              <ListCard
                key={payment.id}
                status={cfg.listStatus}
                onClick={() => setShowPaymentSheet(payment)}
                title={payment.reference_month}
                subtitle={
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span>Vence {fmtDateBR(payment.due_date)}</span>
                    {payment.payment_method && (
                      <span className="text-slate-400">• {payment.payment_method}</span>
                    )}
                  </div>
                }
                meta={
                  <>
                    <p className="text-sm font-bold text-primary">{fmtBRL(payment.amount)}</p>
                    <span className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border tracking-wider',
                      cfg.badge,
                    )}>
                      <Icon size={10} /> {cfg.label}
                    </span>
                  </>
                }
              />
            );
          })}
        </div>
      )}

      {/* FAB (mobile) → opens action sheet */}
      <FAB
        icon={<Plus size={24} strokeWidth={3} />}
        onClick={() => setShowActions(true)}
        label="Adicionar cobrança"
      />

      {/* Actions sheet (mobile) */}
      <BottomSheet open={showActions} onClose={() => setShowActions(false)} title="Adicionar cobrança">
        <div className="space-y-1 pb-2">
          <button
            type="button"
            onClick={() => { setShowActions(false); setShowGenerate(true); }}
            className="w-full min-h-12 flex items-center gap-3 px-3 rounded-xl hover:bg-slate-50 text-left text-sm font-semibold text-primary"
          >
            <Sparkles size={18} className="text-secondary" /> Gerar mensalidades
          </button>
          <button
            type="button"
            onClick={() => { setShowActions(false); setShowExtra(true); }}
            className="w-full min-h-12 flex items-center gap-3 px-3 rounded-xl hover:bg-slate-50 text-left text-sm font-semibold text-primary"
          >
            <Plus size={18} className="text-orange-500" /> Cobrança extra
          </button>
        </div>
      </BottomSheet>

      {/* Payment detail sheet */}
      <BottomSheet
        open={!!showPaymentSheet}
        onClose={() => setShowPaymentSheet(null)}
        title={showPaymentSheet?.reference_month ?? 'Pagamento'}
      >
        {showPaymentSheet && (() => {
          const cfg = statusConfig[showPaymentSheet.status] ?? statusConfig['Pendente'];
          const Icon = cfg.icon;
          return (
            <div className="space-y-4 pb-2">
              <div className="flex items-center gap-2">
                <span className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase border',
                  cfg.badge,
                )}>
                  <Icon size={12} /> {cfg.label}
                </span>
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-slate-500">Vencimento</dt><dd className="font-semibold text-primary">{fmtDateBR(showPaymentSheet.due_date)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Valor</dt><dd className="font-semibold text-primary">{fmtBRL(showPaymentSheet.amount)}</dd></div>
                {showPaymentSheet.paid_date && (
                  <div className="flex justify-between"><dt className="text-slate-500">Pago em</dt><dd className="font-semibold text-primary">{fmtDateBR(showPaymentSheet.paid_date)}</dd></div>
                )}
                {showPaymentSheet.paid_amount != null && (
                  <div className="flex justify-between"><dt className="text-slate-500">Valor pago</dt><dd className="font-semibold text-primary">{fmtBRL(showPaymentSheet.paid_amount)}</dd></div>
                )}
                {showPaymentSheet.payment_method && (
                  <div className="flex justify-between"><dt className="text-slate-500">Forma</dt><dd className="font-semibold text-primary">{showPaymentSheet.payment_method}</dd></div>
                )}
                {showPaymentSheet.notes && (
                  <div className="flex justify-between"><dt className="text-slate-500">Observações</dt><dd className="font-semibold text-primary text-right max-w-[60%]">{showPaymentSheet.notes}</dd></div>
                )}
              </dl>
              {showPaymentSheet.status !== 'Pago' && showPaymentSheet.status !== 'Cancelado' && (
                <button
                  type="button"
                  onClick={() => {
                    setPayToConfirm(showPaymentSheet);
                    setPayDate(new Date().toISOString().split('T')[0]);
                    setPayMethod('');
                    setShowPaymentSheet(null);
                  }}
                  className="w-full min-h-11 bg-green-500 text-white rounded-full font-bold hover:bg-green-600 inline-flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={16} /> Marcar como pago
                </button>
              )}
            </div>
          );
        })()}
      </BottomSheet>

      {/* Mark Paid sheet */}
      <BottomSheet open={!!payToConfirm} onClose={() => setPayToConfirm(null)} title="Registrar pagamento">
        {payToConfirm && (
          <div className="space-y-4 pb-2">
            <p className="text-sm text-slate-500">
              <span className="font-bold text-primary">{payToConfirm.reference_month}</span> — {fmtBRL(payToConfirm.amount)}
            </p>
            <div>
              <label className={labelClass}>Data do pagamento</label>
              <input
                type="date"
                value={payDate}
                onChange={e => setPayDate(e.target.value)}
                className={cn(inputClass, 'text-slate-600')}
              />
            </div>
            <div>
              <label className={labelClass}>Forma de pagamento</label>
              <select
                value={payMethod}
                onChange={e => setPayMethod(e.target.value)}
                className={cn(inputClass, 'bg-white text-slate-600 cursor-pointer')}
              >
                <option value="">Selecione...</option>
                <option>PIX</option><option>Dinheiro</option><option>Cartão de débito</option>
                <option>Cartão de crédito</option><option>Transferência</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPayToConfirm(null)}
                className="flex-1 min-h-11 rounded-full border border-slate-200 text-primary font-bold hover:bg-slate-50 text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmMarkPaid}
                disabled={saving}
                className="flex-1 min-h-11 bg-green-500 text-white rounded-full font-bold hover:bg-green-600 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Confirmar
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* Generate sheet */}
      <BottomSheet open={showGenerate} onClose={() => setShowGenerate(false)} title="Gerar mensalidades" maxHeight="90dvh">
        <div className="space-y-5 pb-2">
          <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Aluna</span><span className="font-bold text-primary">{studentName}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Plano</span><span className="font-bold text-primary">{studentPlan || '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Valor mensal</span><span className="font-bold text-primary">{fmtBRL(studentValue)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Vencimento</span><span className="font-bold text-primary">Dia {studentDueDay || 10}</span></div>
          </div>

          <div>
            <label className={labelClass}>Ano</label>
            <select
              value={genYear}
              onChange={e => { setGenYear(Number(e.target.value)); setGenMonths([]); }}
              className={cn(inputClass, 'bg-white text-slate-600 cursor-pointer')}
            >
              {[2025, 2026, 2027, 2028].map(y => <option key={y}>{y}</option>)}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[13px] font-bold text-primary">Meses para gerar</label>
              <button
                type="button"
                onClick={selectAllAvailable}
                className="text-xs font-bold text-secondary"
              >
                Todos disponíveis ({availableCount})
              </button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {MONTHS.map((month, idx) => {
                const isGenerated = existingMonths.includes(idx);
                const isSelected = genMonths.includes(idx);
                return (
                  <button
                    key={month}
                    type="button"
                    disabled={isGenerated}
                    onClick={() => toggleMonth(idx)}
                    className={cn(
                      'min-h-12 px-2 rounded-xl border text-xs font-semibold transition-all',
                      isGenerated
                        ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                        : isSelected
                          ? 'bg-secondary/10 border-secondary text-secondary'
                          : 'bg-white border-slate-200 text-primary',
                    )}
                  >
                    {month}
                    {isGenerated && <span className="block text-[9px] text-slate-400">Gerado</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowGenerate(false)}
              className="flex-1 min-h-11 rounded-full border border-slate-200 text-primary font-bold text-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={genMonths.length === 0 || generating}
              className="flex-1 min-h-11 bg-secondary text-white rounded-full font-bold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Gerar
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Extra Charge sheet */}
      <BottomSheet open={showExtra} onClose={() => setShowExtra(false)} title="Nova cobrança extra" maxHeight="90dvh">
        <div className="space-y-4 pb-2">
          <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4">
            <p className="text-sm text-slate-400">Aluna: <span className="font-bold text-primary">{studentName}</span></p>
          </div>
          <div>
            <label className={labelClass}>Tipo de cobrança <span className="text-red-500">*</span></label>
            <select
              value={extraData.type}
              onChange={e => setExtraData(p => ({ ...p, type: e.target.value }))}
              className={cn(inputClass, 'bg-white text-slate-600 cursor-pointer')}
            >
              <option value="">Selecione o tipo</option>
              {chargeTypes.map(t => <option key={t.id} value={t.label}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Descrição</label>
            <input
              type="text"
              value={extraData.description}
              onChange={e => setExtraData(p => ({ ...p, description: e.target.value }))}
              placeholder="Ex: Uniforme Ballet 2026"
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Valor total (R$) <span className="text-red-500">*</span></label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={extraData.amount}
                onChange={e => setExtraData(p => ({ ...p, amount: e.target.value }))}
                placeholder="0,00"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Parcelas</label>
              <select
                value={extraData.installments}
                onChange={e => setExtraData(p => ({ ...p, installments: e.target.value }))}
                className={cn(inputClass, 'bg-white text-slate-600 cursor-pointer')}
              >
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={n}>{n}x</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Vencimento <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={extraData.dueDate}
              onChange={e => setExtraData(p => ({ ...p, dueDate: e.target.value }))}
              className={cn(inputClass, 'text-slate-600')}
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowExtra(false)}
              className="flex-1 min-h-11 rounded-full border border-slate-200 text-primary font-bold text-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleExtraCharge}
              disabled={saving || !extraData.type || !extraData.amount || !extraData.dueDate}
              className="flex-1 min-h-11 bg-orange-500 text-white rounded-full font-bold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Gerar cobranças
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};

// ── Attendance Tab ──────────────────────────────────────────────────────────
type AttStatus = 'present' | 'absent' | 'late' | 'justified';

const ATT_CFG: Record<AttStatus, { label: string; badge: string }> = {
  present:   { label: 'Presente',    badge: 'bg-green-100 text-green-700 border-green-200' },
  absent:    { label: 'Ausente',     badge: 'bg-red-100 text-red-700 border-red-200' },
  late:      { label: 'Atraso',      badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  justified: { label: 'Justificada', badge: 'bg-blue-100 text-blue-700 border-blue-200' },
};

interface AttRec {
  id: string;
  date: string;
  status: AttStatus;
  notes: string | null;
  class_id: string;
  class_name: string;
  modality: string | null;
}

const AttendanceTab = ({ studentId }: { studentId: string }) => {
  const [records, setRecords] = useState<AttRec[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('attendance')
        .select('id, date, status, notes, class_id, classes(name, modality)')
        .eq('student_id', studentId)
        .order('date', { ascending: false });
      setRecords(
        (data as any[] ?? []).map(r => ({
          id: r.id,
          date: r.date,
          status: r.status as AttStatus,
          notes: r.notes,
          class_id: r.class_id,
          class_name: r.classes?.name ?? '—',
          modality: r.classes?.modality ?? null,
        })),
      );
      setLoading(false);
    };
    load();
  }, [studentId]);

  const classOptions = useMemo(() => {
    const seen = new Set<string>();
    return records.filter(r => { if (seen.has(r.class_id)) return false; seen.add(r.class_id); return true; });
  }, [records]);

  const filtered = useMemo(() => records.filter(r => {
    if (filterFrom && r.date < filterFrom) return false;
    if (filterTo && r.date > filterTo) return false;
    if (filterClass && r.class_id !== filterClass) return false;
    return true;
  }), [records, filterFrom, filterTo, filterClass]);

  const total = filtered.length;
  const present = filtered.filter(r => r.status === 'present' || r.status === 'late').length;
  const absent = filtered.filter(r => r.status === 'absent').length;
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;

  const rateColor = rate >= 80 ? 'text-green-600' : rate >= 60 ? 'text-amber-500' : 'text-red-500';
  const rateBg = rate >= 80 ? 'bg-green-50 border-green-100' : rate >= 60 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100';

  const hasFilters = !!(filterFrom || filterTo || filterClass);
  const clearFilters = () => { setFilterFrom(''); setFilterTo(''); setFilterClass(''); };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: 'Total de aulas', value: String(total), cls: 'bg-slate-50 border-slate-100', val: 'text-primary' },
          { label: 'Presenças', value: String(present), cls: 'bg-green-50 border-green-100', val: 'text-green-600' },
          { label: 'Ausências', value: String(absent), cls: 'bg-red-50 border-red-100', val: 'text-red-500' },
          { label: 'Taxa de presença', value: `${rate}%`, cls: rateBg, val: rateColor },
        ].map(({ label, value, cls, val }) => (
          <div key={label} className={cn('rounded-2xl border p-3 md:p-4', cls)}>
            <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
            <p className={cn('text-xl md:text-2xl font-extrabold mt-1', val)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filter trigger (mobile + desktop) */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setShowFilters(true)}
          className="min-h-11 inline-flex items-center gap-2 px-4 rounded-full border border-slate-200 text-sm font-bold text-primary bg-white"
        >
          <Filter size={14} /> Filtros
          {hasFilters && <span className="w-2 h-2 rounded-full bg-secondary" />}
        </button>
        {hasFilters && (
          <button type="button" onClick={clearFilters} className="text-xs font-bold text-secondary min-h-10 px-3">
            Limpar
          </button>
        )}
      </div>

      {/* Records list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center bg-white rounded-2xl border border-slate-100">
          <ClipboardCheck size={36} className="text-slate-200 mb-3" />
          <p className="text-sm font-semibold text-slate-500">Nenhum registro encontrado</p>
          <p className="text-xs text-slate-400 mt-1">Ajuste os filtros ou registre a chamada na tela de Frequência</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => {
            const cfg = ATT_CFG[r.status];
            return (
              <ListCard
                key={r.id}
                avatar={
                  <div className={cn('w-3 h-3 rounded-full', getModalityDot(r.modality))} />
                }
                title={r.class_name}
                subtitle={
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span>{fmtDateBR(r.date)}</span>
                    {r.notes && <span className="text-slate-400 truncate">• {r.notes}</span>}
                  </div>
                }
                meta={
                  <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full border', cfg.badge)}>
                    {cfg.label}
                  </span>
                }
              />
            );
          })}
        </div>
      )}

      {/* Filters sheet */}
      <BottomSheet open={showFilters} onClose={() => setShowFilters(false)} title="Filtros">
        <div className="space-y-4 pb-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>De</label>
              <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className={cn(inputClass, 'text-slate-600')} />
            </div>
            <div>
              <label className={labelClass}>Até</label>
              <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className={cn(inputClass, 'text-slate-600')} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Turma</label>
            <select
              value={filterClass}
              onChange={e => setFilterClass(e.target.value)}
              className={cn(inputClass, 'bg-white text-slate-600 cursor-pointer')}
            >
              <option value="">Todas as turmas</option>
              {classOptions.map(r => (
                <option key={r.class_id} value={r.class_id}>{r.class_name}</option>
              ))}
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
    </div>
  );
};

// ── Classes Tab ─────────────────────────────────────────────────────────────
const ClassesTab = ({ studentId }: { studentId: string }) => {
  const [enrolled, setEnrolled] = useState<any[]>([]);
  const [available, setAvailable] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');

  const loadList = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('class_students')
      .select('*, classes(id, name, modality, teacher, max_capacity, class_students(student_id, status))')
      .eq('student_id', studentId)
      .eq('status', 'active');
    setEnrolled(data ?? []);
    setLoading(false);
  };

  const loadAvailable = async () => {
    const { data: allClasses } = await supabase
      .from('classes')
      .select('*, class_schedules(*), class_students(student_id, status)')
      .eq('is_active', true);

    const enrolledIds = enrolled.map(e => e.class_id);
    const av = (allClasses ?? []).filter(c => !enrolledIds.includes(c.id));
    setAvailable(av);
  };

  useEffect(() => { loadList(); /* eslint-disable-next-line */ }, [studentId]);

  const handleOpenModal = () => { loadAvailable(); setShowModal(true); };

  const handleEnroll = async (cls: any) => {
    const activeCount = cls.class_students?.filter((s: any) => s.status === 'active').length || 0;
    if (activeCount >= cls.max_capacity && !window.confirm('Turma lotada! Deseja pular o limite e matricular mesmo assim?')) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase
        .from('class_students')
        .upsert({ class_id: cls.id, student_id: studentId, owner_id: user?.id, status: 'active' }, { onConflict: 'class_id, student_id' });
      await loadList();
      setAvailable(prev => prev.filter(c => c.id !== cls.id));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUnenroll = async (classId: string) => {
    if (!window.confirm('Remover aluna da turma?')) return;
    setSaving(true);
    try {
      await supabase.from('class_students').update({ status: 'inactive' }).eq('class_id', classId).eq('student_id', studentId);
      await loadList();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredAvail = available.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase())
    || c.modality?.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-secondary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base md:text-lg font-bold text-primary">Turmas matriculadas</h3>
        <button
          type="button"
          onClick={handleOpenModal}
          className="hidden md:inline-flex items-center gap-2 min-h-11 px-4 bg-secondary text-white rounded-full font-bold hover:bg-primary text-sm shadow-md shadow-secondary/20"
        >
          <Plus size={16} strokeWidth={3} /> Matricular em turma
        </button>
      </div>

      {enrolled.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-100">
          <Layers size={40} className="mb-3 opacity-30" />
          <p className="font-medium">Aluna não está matriculada em nenhuma turma.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {enrolled.map(e => (
            <ListCard
              key={e.id}
              avatar={<div className={cn('w-3 h-3 rounded-full', getModalityDot(e.classes?.modality ?? null))} />}
              title={e.classes?.name ?? '—'}
              subtitle={
                <div className="flex items-center gap-2 flex-wrap">
                  {e.classes?.modality && (
                    <span className="text-[10px] bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-bold">
                      {e.classes.modality}
                    </span>
                  )}
                  {e.classes?.teacher && (
                    <span className="text-xs text-slate-500 inline-flex items-center gap-1">
                      <UsersIcon size={10} /> {e.classes.teacher}
                    </span>
                  )}
                </div>
              }
              meta={
                <button
                  type="button"
                  onClick={() => handleUnenroll(e.class_id)}
                  disabled={saving}
                  className="min-h-10 px-3 text-xs font-bold text-red-500 bg-red-50 rounded-full hover:bg-red-100 disabled:opacity-50"
                >
                  Remover
                </button>
              }
            />
          ))}
        </div>
      )}

      <FAB
        icon={<Plus size={24} strokeWidth={3} />}
        onClick={handleOpenModal}
        label="Matricular em turma"
      />

      <BottomSheet open={showModal} onClose={() => { setShowModal(false); setSearch(''); }} title="Matricular em turma" maxHeight="90dvh">
        <div className="sticky top-0 -mx-5 -mt-4 px-5 pt-1 pb-3 bg-white border-b border-slate-100">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar pela modalidade, professor ou nome..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-11 bg-slate-50 rounded-xl pl-10 pr-4 text-base outline-none focus:ring-1 focus:ring-secondary/50 border border-transparent"
            />
          </div>
        </div>
        {filteredAvail.length === 0 ? (
          <div className="text-center text-sm text-slate-400 py-10">Nenhuma turma disponível.</div>
        ) : (
          <div className="space-y-1.5 pt-3">
            {filteredAvail.map(cls => {
              const activeStudents = cls.class_students?.filter((s: any) => s.status === 'active').length || 0;
              return (
                <ListCard
                  key={cls.id}
                  avatar={<div className={cn('w-3 h-3 rounded-full', getModalityDot(cls.modality))} />}
                  title={cls.name}
                  subtitle={<span className="text-xs">{activeStudents}/{cls.max_capacity} vagas</span>}
                  meta={
                    <button
                      type="button"
                      onClick={() => handleEnroll(cls)}
                      disabled={saving}
                      className="min-h-10 px-3 text-xs font-bold text-secondary bg-secondary/10 rounded-full hover:bg-secondary/20 disabled:opacity-50"
                    >
                      Matricular
                    </button>
                  }
                />
              );
            })}
          </div>
        )}
      </BottomSheet>
    </div>
  );
};

// ── Read-only "Visão Geral" Tab ─────────────────────────────────────────────
type Field = { label: string; value: string | null; icon?: React.FC<any> };

const InfoCard = ({ title, fields }: { title: string; fields: Field[] }) => {
  const visible = fields.filter(f => f.value && f.value.trim() !== '');
  if (visible.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl md:rounded-[20px] p-5 md:p-7 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-slate-50">
      <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider mb-4">{title}</h3>
      <dl className="space-y-3">
        {visible.map(f => {
          const Icon = f.icon;
          return (
            <div key={f.label} className="flex items-start gap-3">
              {Icon && <Icon size={16} className="text-slate-400 shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <dt className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">{f.label}</dt>
                <dd className="text-sm font-semibold text-primary break-words mt-0.5">{f.value}</dd>
              </div>
            </div>
          );
        })}
      </dl>
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────────────────────
type TabKey = 'dados' | 'financeiro' | 'frequencia' | 'turmas';
type SectionKey = 'personal' | 'address' | 'plan' | 'responsible' | 'notes' | 'photo';

export const StudentDetail = ({ studentId, onBack }: StudentDetailProps) => {
  const [activeTab, setActiveTab] = useState<TabKey>('dados');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [showActions, setShowActions] = useState(false);
  const [openSections, setOpenSections] = useState<Set<SectionKey>>(new Set(['personal']));

  const { options: plans } = useConfigOptions('plan');
  const { options: acquisitionChannels } = useConfigOptions('acquisition_channel');

  const [formData, setFormData] = useState({
    full_name: '', birth_date: '', cpf: '', phone: '', whatsapp: '', email: '',
    photo_url: '', cep: '', street: '', number: '', neighborhood: '', city: '',
    state: '', enrollment_date: '', plan: '', custom_value: '', due_day: '',
    acquisition_channel: '', status: 'Ativo',
    responsible_name: '', responsible_cpf: '', responsible_phone: '',
    medical_notes: '', general_notes: '',
  });

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from('students').select('*').eq('id', studentId).single();
      if (error || !data) {
        setError('Erro ao carregar dados do aluno.');
      } else {
        setFormData({
          full_name: data.full_name ?? '', birth_date: data.birth_date ?? '',
          cpf: data.cpf ?? '', phone: data.phone ?? '', whatsapp: data.whatsapp ?? '',
          email: data.email ?? '', photo_url: data.photo_url ?? '', cep: data.cep ?? '',
          street: data.street ?? '', number: data.number ?? '', neighborhood: data.neighborhood ?? '',
          city: data.city ?? '', state: data.state ?? '', enrollment_date: data.enrollment_date ?? '',
          plan: data.plan ?? '', custom_value: data.custom_value?.toString() ?? '',
          due_day: data.due_day?.toString() ?? '', acquisition_channel: data.acquisition_channel ?? '',
          status: data.status ?? 'Ativo',
          responsible_name: data.responsible_name ?? '',
          responsible_cpf: data.responsible_cpf ?? '',
          responsible_phone: data.responsible_phone ?? '',
          medical_notes: data.medical_notes ?? '',
          general_notes: data.general_notes ?? '',
        });
        if (data.photo_url) setPhotoPreview(data.photo_url);
      }
      setLoading(false);
    };
    load();
  }, [studentId]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setPhotoFile(file); setPhotoPreview(URL.createObjectURL(file)); }
  };

  const toggleSection = (key: SectionKey) =>
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const sectionOpen = (key: SectionKey) => openSections.has(key);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');
      let photo_url = formData.photo_url || null;
      if (photoFile) {
        const ext = photoFile.name.split('.').pop();
        const filePath = `${user.id}/${studentId}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('student-photos').upload(filePath, photoFile, { upsert: true });
        if (!uploadError) {
          const { data: signedData } = await supabase.storage
            .from('student-photos').createSignedUrl(filePath, 60 * 60 * 24 * 365);
          photo_url = signedData?.signedUrl ?? photo_url;
        }
      }
      const { error: updateError } = await supabase.from('students').update({
        full_name: formData.full_name, birth_date: formData.birth_date || null,
        cpf: formData.cpf || null, phone: formData.phone || null, whatsapp: formData.whatsapp || null,
        email: formData.email || null, photo_url, cep: formData.cep || null,
        street: formData.street || null, number: formData.number || null,
        neighborhood: formData.neighborhood || null, city: formData.city || null,
        state: formData.state || null, enrollment_date: formData.enrollment_date || null,
        plan: formData.plan || null,
        custom_value: formData.custom_value ? parseFloat(formData.custom_value) : null,
        due_day: formData.due_day ? parseInt(formData.due_day) : null,
        acquisition_channel: formData.acquisition_channel || null, status: formData.status,
        responsible_name: formData.responsible_name || null,
        responsible_cpf: formData.responsible_cpf || null,
        responsible_phone: formData.responsible_phone || null,
        medical_notes: formData.medical_notes || null, general_notes: formData.general_notes || null,
      }).eq('id', studentId);
      if (updateError) throw updateError;
      setFormData(p => ({ ...p, photo_url: photo_url ?? '' }));
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    setShowActions(false);
    const next = formData.status === 'Ativo' ? 'Inativo' : 'Ativo';
    setSaving(true);
    try {
      await supabase.from('students').update({ status: next }).eq('id', studentId);
      setFormData(p => ({ ...p, status: next }));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setShowActions(false);
    if (!window.confirm('Tem certeza? Esta ação não pode ser desfeita.')) return;
    setSaving(true);
    try {
      await supabase.from('students').delete().eq('id', studentId);
      onBack();
    } catch (err: any) {
      alert(err.message);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={36} className="animate-spin text-secondary" />
      </div>
    );
  }

  const fullAddress = [
    [formData.street, formData.number].filter(Boolean).join(', '),
    formData.neighborhood,
    [formData.city, formData.state].filter(Boolean).join(' / '),
    formData.cep,
  ].filter(Boolean).join(' • ');

  return (
    <div className="max-w-[1000px] mx-auto pb-28 md:pb-12">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 md:mb-6">
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar"
          className="w-10 h-10 -ml-2 flex items-center justify-center text-slate-400 hover:text-secondary rounded-full"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
          {photoPreview ? (
            <img src={photoPreview} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className={cn(
              'w-full h-full flex items-center justify-center text-white font-black text-lg md:text-xl',
              hashColor(studentId),
            )}>
              {getInitials(formData.full_name)}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg md:text-2xl font-bold text-primary leading-tight truncate">
            {formData.full_name || 'Detalhe da aluna'}
          </h2>
          <span className={cn(
            'inline-block text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full mt-1',
            formData.status === 'Ativo' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400',
          )}>
            {formData.status}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowActions(true)}
          aria-label="Mais ações"
          className="w-10 h-10 -mr-2 flex items-center justify-center text-slate-400 hover:text-primary rounded-full"
        >
          <MoreVertical size={20} />
        </button>
      </div>

      {/* Tabs */}
      <div
        className="flex overflow-x-auto border-b border-slate-200 mb-5 md:mb-6 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {([
          { id: 'dados', label: 'Visão geral', icon: null as ReactNode },
          { id: 'financeiro', label: 'Financeiro', icon: <Wallet size={15} /> },
          { id: 'frequencia', label: 'Frequência', icon: <ClipboardCheck size={15} /> },
          { id: 'turmas', label: 'Turmas', icon: <Layers size={15} /> },
        ] as const).map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => { setActiveTab(id); if (id !== 'dados') setIsEditing(false); }}
            style={{ scrollSnapAlign: 'center' }}
            className={cn(
              'min-h-12 px-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-2',
              activeTab === id ? 'border-primary text-primary' : 'border-transparent text-slate-500',
            )}
          >
            {icon}{label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600 font-medium">
          {error}
        </div>
      )}

      {/* Content */}
      {activeTab === 'financeiro' ? (
        <FinancialTab
          studentId={studentId}
          studentName={formData.full_name}
          studentPlan={formData.plan}
          studentValue={formData.custom_value ? parseFloat(formData.custom_value) : 0}
          studentDueDay={formData.due_day ? parseInt(formData.due_day) : 10}
        />
      ) : activeTab === 'frequencia' ? (
        <AttendanceTab studentId={studentId} />
      ) : activeTab === 'turmas' ? (
        <ClassesTab studentId={studentId} />
      ) : isEditing ? (
        // ── Edit Form ──
        <form onSubmit={handleSave} className="space-y-4 md:space-y-6">
          <Section title="Dados pessoais" isOpen={sectionOpen('personal')} onToggle={() => toggleSection('personal')}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <div className="sm:col-span-2">
                <label className={labelClass}>Nome completo <span className="text-red-500">*</span></label>
                <input required name="full_name" value={formData.full_name} onChange={handleChange} type="text" className={inputClass} />
              </div>
              <div><label className={labelClass}>Data de nascimento</label><input name="birth_date" value={formData.birth_date} onChange={handleChange} type="date" className={cn(inputClass, 'text-slate-600')} /></div>
              <div><label className={labelClass}>CPF</label><input name="cpf" value={formData.cpf} onChange={handleChange} type="text" inputMode="numeric" placeholder="000.000.000-00" className={inputClass} /></div>
              <div><label className={labelClass}>Telefone</label><input name="phone" value={formData.phone} onChange={handleChange} type="tel" placeholder="(51) 99999-9999" className={inputClass} /></div>
              <div><label className={labelClass}>WhatsApp</label><input name="whatsapp" value={formData.whatsapp} onChange={handleChange} type="tel" placeholder="(51) 99999-9999" className={inputClass} /></div>
              <div><label className={labelClass}>E-mail</label><input name="email" value={formData.email} onChange={handleChange} type="email" className={inputClass} /></div>
            </div>
          </Section>

          <Section title="Endereço" isOpen={sectionOpen('address')} onToggle={() => toggleSection('address')}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <div><label className={labelClass}>CEP</label><input name="cep" value={formData.cep} onChange={handleChange} type="text" inputMode="numeric" className={inputClass} /></div>
              <div><label className={labelClass}>Rua / Logradouro</label><input name="street" value={formData.street} onChange={handleChange} type="text" className={inputClass} /></div>
              <div><label className={labelClass}>Número</label><input name="number" value={formData.number} onChange={handleChange} type="text" inputMode="numeric" className={inputClass} /></div>
              <div><label className={labelClass}>Bairro</label><input name="neighborhood" value={formData.neighborhood} onChange={handleChange} type="text" className={inputClass} /></div>
              <div><label className={labelClass}>Cidade</label><input name="city" value={formData.city} onChange={handleChange} type="text" className={inputClass} /></div>
              <div><label className={labelClass}>Estado</label><input name="state" value={formData.state} onChange={handleChange} type="text" className={inputClass} /></div>
            </div>
          </Section>

          <Section title="Plano e mensalidade" isOpen={sectionOpen('plan')} onToggle={() => toggleSection('plan')}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <div><label className={labelClass}>Data de matrícula</label><input name="enrollment_date" value={formData.enrollment_date} onChange={handleChange} type="date" className={cn(inputClass, 'text-slate-600')} /></div>
              <div>
                <label className={labelClass}>Plano</label>
                <select name="plan" value={formData.plan} onChange={handleChange} className={cn(inputClass, 'bg-white text-slate-600 cursor-pointer')}>
                  <option value="">Selecione...</option>
                  {plans.map(p => <option key={p.id} value={p.label}>{p.label}</option>)}
                </select>
              </div>
              <div><label className={labelClass}>Valor personalizado (R$)</label><input name="custom_value" value={formData.custom_value} onChange={handleChange} type="number" inputMode="decimal" step="0.01" className={inputClass} /></div>
              <div><label className={labelClass}>Dia do vencimento</label><input name="due_day" value={formData.due_day} onChange={handleChange} type="number" inputMode="numeric" min="1" max="31" className={inputClass} /></div>
              <div>
                <label className={labelClass}>Como nos conheceu</label>
                <select name="acquisition_channel" value={formData.acquisition_channel} onChange={handleChange} className={cn(inputClass, 'bg-white text-slate-600 cursor-pointer')}>
                  <option value="">Selecione...</option>
                  {acquisitionChannels.map(c => <option key={c.id} value={c.label}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select name="status" value={formData.status} onChange={handleChange} className={cn(inputClass, 'bg-white text-slate-600 cursor-pointer')}>
                  <option>Ativo</option><option>Inativo</option>
                </select>
              </div>
            </div>
          </Section>

          <Section title="Responsável (menor de idade)" isOpen={sectionOpen('responsible')} onToggle={() => toggleSection('responsible')}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
              <div><label className={labelClass}>Nome do responsável</label><input name="responsible_name" value={formData.responsible_name} onChange={handleChange} type="text" placeholder="Nome completo" className={inputClass} /></div>
              <div><label className={labelClass}>CPF do responsável</label><input name="responsible_cpf" value={formData.responsible_cpf} onChange={handleChange} type="text" inputMode="numeric" placeholder="000.000.000-00" className={inputClass} /></div>
              <div><label className={labelClass}>Telefone do responsável</label><input name="responsible_phone" value={formData.responsible_phone} onChange={handleChange} type="tel" placeholder="(51) 99999-9999" className={inputClass} /></div>
            </div>
          </Section>

          <Section title="Observações" isOpen={sectionOpen('notes')} onToggle={() => toggleSection('notes')}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <label className={labelClass}>Observações médicas / restrições</label>
                <textarea name="medical_notes" value={formData.medical_notes} onChange={handleChange} rows={3}
                  className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-3.5 py-2.5 text-base resize-none outline-none" />
              </div>
              <div>
                <label className={labelClass}>Observações gerais</label>
                <textarea name="general_notes" value={formData.general_notes} onChange={handleChange} rows={3}
                  className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-3.5 py-2.5 text-base resize-none outline-none" />
              </div>
            </div>
          </Section>

          <Section title="Foto" isOpen={sectionOpen('photo')} onToggle={() => toggleSection('photo')}>
            <div className="flex flex-col items-center gap-3">
              <label className="cursor-pointer flex flex-col items-center gap-3 active:scale-[0.98]">
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-slate-50 border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-300 overflow-hidden">
                  {photoPreview ? (
                    <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Camera size={32} aria-hidden />
                  )}
                </div>
                <span className="text-sm text-accent font-medium">
                  {photoPreview ? 'Trocar foto' : 'Adicionar foto'}
                </span>
                <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={handlePhotoChange} />
              </label>
            </div>
          </Section>

          {/* Sticky save bar */}
          <div
            className="
              fixed inset-x-0 bottom-0 z-30
              bg-white/95 backdrop-blur border-t border-slate-100
              px-4 pt-3
              pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]
              flex items-center justify-end gap-3
              md:static md:bg-transparent md:backdrop-blur-none md:border-0 md:p-0 md:pt-4
            "
          >
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="min-h-11 flex-1 md:flex-none px-6 rounded-full border border-slate-200 text-primary font-bold hover:bg-slate-50 text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-11 flex-1 md:flex-none px-6 bg-secondary text-white rounded-full font-bold hover:bg-primary text-sm shadow-md shadow-secondary/20 inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      ) : (
        // ── Visão Geral (read-only) ──
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="min-h-11 inline-flex items-center gap-2 px-4 rounded-full bg-secondary text-white text-sm font-bold shadow-md shadow-secondary/20"
            >
              <Pencil size={14} /> Editar dados
            </button>
          </div>

          <InfoCard
            title="Contato"
            fields={[
              { label: 'E-mail', value: formData.email, icon: Mail },
              { label: 'Telefone', value: formData.phone, icon: Phone },
              { label: 'WhatsApp', value: formData.whatsapp, icon: MessageSquare },
              { label: 'CPF', value: formData.cpf, icon: User },
              { label: 'Data de nascimento', value: formData.birth_date ? fmtDateBR(formData.birth_date) : null },
            ]}
          />

          <InfoCard
            title="Endereço"
            fields={[{ label: 'Endereço', value: fullAddress || null, icon: MapPin }]}
          />

          <InfoCard
            title="Plano e mensalidade"
            fields={[
              { label: 'Plano', value: formData.plan },
              { label: 'Valor', value: formData.custom_value ? fmtBRL(parseFloat(formData.custom_value)) : null },
              { label: 'Vencimento', value: formData.due_day ? `Dia ${formData.due_day}` : null },
              { label: 'Data de matrícula', value: formData.enrollment_date ? fmtDateBR(formData.enrollment_date) : null },
              { label: 'Como nos conheceu', value: formData.acquisition_channel },
            ]}
          />

          <InfoCard
            title="Responsável"
            fields={[
              { label: 'Nome', value: formData.responsible_name, icon: User },
              { label: 'CPF', value: formData.responsible_cpf },
              { label: 'Telefone', value: formData.responsible_phone, icon: Phone },
            ]}
          />

          <InfoCard
            title="Observações médicas"
            fields={[{ label: 'Restrições / observações', value: formData.medical_notes, icon: FileText }]}
          />

          <InfoCard
            title="Observações gerais"
            fields={[{ label: 'Notas', value: formData.general_notes, icon: FileText }]}
          />
        </div>
      )}

      {/* Header actions sheet */}
      <BottomSheet open={showActions} onClose={() => setShowActions(false)} title="Ações da aluna">
        <div className="space-y-1 pb-2">
          <button
            type="button"
            onClick={() => { setShowActions(false); setActiveTab('dados'); setIsEditing(true); }}
            className="w-full min-h-12 flex items-center gap-3 px-3 rounded-xl hover:bg-slate-50 text-left text-sm font-semibold text-primary"
          >
            <Pencil size={18} className="text-slate-500" /> Editar dados
          </button>
          <button
            type="button"
            onClick={handleToggleStatus}
            className="w-full min-h-12 flex items-center gap-3 px-3 rounded-xl hover:bg-slate-50 text-left text-sm font-semibold text-primary"
          >
            <Power size={18} className="text-slate-500" />
            {formData.status === 'Ativo' ? 'Marcar como inativo' : 'Marcar como ativo'}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="w-full min-h-12 flex items-center gap-3 px-3 rounded-xl hover:bg-red-50 text-left text-sm font-semibold text-red-600"
          >
            <Trash2 size={18} /> Excluir
          </button>
        </div>
      </BottomSheet>
    </div>
  );
};
