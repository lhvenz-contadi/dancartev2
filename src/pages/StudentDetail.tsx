import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, Camera, Loader2, Save, Wallet, Plus, CheckCircle2, Clock, AlertTriangle, XCircle, Inbox, Sparkles, X, ClipboardCheck, UserCheck, TrendingUp, Filter, Users, MapPin, Layers, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { useConfigOptions } from '../lib/useConfigOptions';

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

const statusConfig: Record<string, { label: string; color: string; icon: React.FC<any> }> = {
  Pago:      { label: 'Pago',      color: 'bg-green-100 text-green-600 border-green-200',   icon: CheckCircle2 },
  Pendente:  { label: 'Pendente',  color: 'bg-blue-100 text-secondary border-blue-200',      icon: Clock },
  Atrasado:  { label: 'Atrasado',  color: 'bg-red-100 text-red-500 border-red-200',          icon: AlertTriangle },
  Cancelado: { label: 'Cancelado', color: 'bg-slate-100 text-slate-400 border-slate-200',    icon: XCircle },
};

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// ─── Financial Tab ────────────────────────────────────────────────────────────
interface FinancialTabProps {
  studentId: string;
  studentName: string;
  studentPlan: string;
  studentValue: number;
  studentDueDay: number;
}

const FinancialTab = ({ studentId, studentName, studentPlan, studentValue, studentDueDay }: FinancialTabProps) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genYear, setGenYear] = useState(new Date().getFullYear());
  const [genMonths, setGenMonths] = useState<number[]>([]);
  const [generating, setGenerating] = useState(false);
  const [payToConfirm, setPayToConfirm] = useState<Payment | null>(null);
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payMethod, setPayMethod] = useState('');
  const [saving, setSaving] = useState(false);
  const [newPayment, setNewPayment] = useState({
    reference_month: '', due_date: '', paid_date: '', amount: '',
    paid_amount: '', status: 'Pendente', payment_method: '', notes: '',
  });

  // Extra charge state
  const [showExtraModal, setShowExtraModal] = useState(false);
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

  useEffect(() => { loadPayments(); }, [studentId]);

  // Find which months already exist for the selected year
  const existingMonths = payments
    .map(p => p.reference_month)
    .filter(r => r.includes(genYear.toString()))
    .map(r => MONTHS.findIndex(m => r.toLowerCase().startsWith(m.toLowerCase())))
    .filter(i => i >= 0);

  const availableCount = MONTHS.length - existingMonths.length;

  const toggleMonth = (idx: number) => {
    if (existingMonths.includes(idx)) return;
    setGenMonths(prev => prev.includes(idx) ? prev.filter(m => m !== idx) : [...prev, idx]);
  };

  const selectAllAvailable = () => {
    const available = MONTHS.map((_, i) => i).filter(i => !existingMonths.includes(i));
    setGenMonths(prev => prev.length === available.length ? [] : available);
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

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('payments').insert({
      student_id: studentId, owner_id: user?.id,
      reference_month: newPayment.reference_month, due_date: newPayment.due_date,
      paid_date: newPayment.paid_date || null, amount: parseFloat(newPayment.amount),
      paid_amount: newPayment.paid_amount ? parseFloat(newPayment.paid_amount) : null,
      status: newPayment.status, payment_method: newPayment.payment_method || null,
      notes: newPayment.notes || null,
    });
    setNewPayment({ reference_month: '', due_date: '', paid_date: '', amount: '', paid_amount: '', status: 'Pendente', payment_method: '', notes: '' });
    setShowForm(false); setSaving(false);
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
    setShowExtraModal(false);
    setExtraData({ type: '', description: '', amount: '', installments: '1', dueDate: '' });
    await loadPayments();
  };

  const totalPaid = payments.filter(p => p.status === 'Pago').reduce((s, p) => s + (p.paid_amount ?? p.amount), 0);
  const totalPending = payments.filter(p => p.status === 'Pendente').reduce((s, p) => s + p.amount, 0);
  const totalOverdue = payments.filter(p => p.status === 'Atrasado').reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
          <p className="text-[11px] font-bold text-green-600 uppercase tracking-wider">Pago</p>
          <p className="text-xl font-black text-green-600 mt-1">R$ {totalPaid.toFixed(2)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <p className="text-[11px] font-bold text-secondary uppercase tracking-wider">Pendente</p>
          <p className="text-xl font-black text-secondary mt-1">R$ {totalPending.toFixed(2)}</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
          <p className="text-[11px] font-bold text-red-500 uppercase tracking-wider">Atrasado</p>
          <p className="text-xl font-black text-red-500 mt-1">R$ {totalOverdue.toFixed(2)}</p>
        </div>
      </div>

      {/* Header + buttons */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-primary uppercase tracking-wider">Histórico de Mensalidades</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowGenerate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-secondary text-secondary text-sm font-bold hover:bg-secondary/5 transition-all"
          >
            <Sparkles size={15} />
            Gerar Mensalidades
          </button>
          <button
            type="button"
            onClick={() => setShowExtraModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-full text-sm font-bold hover:bg-orange-600 transition-all shadow-md shadow-orange-500/20"
          >
            <Plus size={16} strokeWidth={3} />
            Cobrança Extra
          </button>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-full text-sm font-bold hover:bg-primary transition-all shadow-md shadow-secondary/20"
          >
            <Plus size={16} strokeWidth={3} />
            Nova cobrança
          </button>
        </div>
      </div>

      {/* New payment form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-slate-50 border border-slate-100 rounded-2xl p-6 space-y-4">
          <p className="text-xs font-extrabold text-primary uppercase tracking-wider">Nova Cobrança</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[12px] font-bold text-primary mb-1">Referência (mês)</label>
              <input required placeholder="Março/2026" value={newPayment.reference_month} onChange={e => setNewPayment(p => ({ ...p, reference_month: e.target.value }))} type="text" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-secondary" />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-primary mb-1">Vencimento</label>
              <input required value={newPayment.due_date} onChange={e => setNewPayment(p => ({ ...p, due_date: e.target.value }))} type="date" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-secondary text-slate-500" />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-primary mb-1">Valor (R$)</label>
              <input required placeholder="150.00" value={newPayment.amount} onChange={e => setNewPayment(p => ({ ...p, amount: e.target.value }))} type="number" step="0.01" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-secondary" />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-primary mb-1">Status</label>
              <select value={newPayment.status} onChange={e => setNewPayment(p => ({ ...p, status: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-secondary bg-white text-slate-600">
                <option>Pendente</option>
                <option>Pago</option>
                <option>Atrasado</option>
                <option>Cancelado</option>
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-bold text-primary mb-1">Forma de pagamento</label>
              <select value={newPayment.payment_method} onChange={e => setNewPayment(p => ({ ...p, payment_method: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-secondary bg-white text-slate-600">
                <option value="">Selecione...</option>
                <option>PIX</option>
                <option>Dinheiro</option>
                <option>Cartão de débito</option>
                <option>Cartão de crédito</option>
                <option>Transferência</option>
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-bold text-primary mb-1">Data do pagamento</label>
              <input value={newPayment.paid_date} onChange={e => setNewPayment(p => ({ ...p, paid_date: e.target.value }))} type="date" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-secondary text-slate-500" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-full border border-slate-200 text-sm font-bold text-primary hover:bg-slate-100 transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="px-5 py-2 bg-secondary text-white rounded-full text-sm font-bold hover:bg-primary transition-all flex items-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              Salvar
            </button>
          </div>
        </form>
      )}

      {/* Payment list */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-300">
            <Loader2 size={28} className="animate-spin" />
          </div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-300">
            <Inbox size={40} className="mb-3 opacity-40" />
            <p className="text-sm font-medium text-slate-400">Nenhuma cobrança registrada</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="px-5 py-4 text-[11px] font-bold uppercase text-slate-400 tracking-wider">Referência</th>
                <th className="px-5 py-4 text-[11px] font-bold uppercase text-slate-400 tracking-wider">Vencimento</th>
                <th className="px-5 py-4 text-[11px] font-bold uppercase text-slate-400 tracking-wider">Valor</th>
                <th className="px-5 py-4 text-[11px] font-bold uppercase text-slate-400 tracking-wider">Forma</th>
                <th className="px-5 py-4 text-[11px] font-bold uppercase text-slate-400 tracking-wider">Status</th>
                <th className="px-5 py-4 text-[11px] font-bold uppercase text-slate-400 tracking-wider w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {payments.map(payment => {
                const cfg = statusConfig[payment.status] ?? statusConfig['Pendente'];
                const Icon = cfg.icon;
                return (
                  <tr key={payment.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 text-sm font-semibold text-primary">{payment.reference_month}</td>
                    <td className="px-5 py-4 text-sm text-slate-500">
                      {new Date(payment.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-5 py-4 text-sm font-bold text-primary">
                      R$ {payment.amount.toFixed(2)}
                      {payment.paid_amount && payment.paid_amount !== payment.amount && (
                        <span className="text-green-500 text-xs ml-1">(pago R$ {payment.paid_amount.toFixed(2)})</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">{payment.payment_method || <span className="text-slate-300">—</span>}</td>
                    <td className="px-5 py-4">
                      <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border tracking-wider', cfg.color)}>
                        <Icon size={11} />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {payment.status !== 'Pago' && payment.status !== 'Cancelado' && (
                        <button
                          onClick={() => { setPayToConfirm(payment); setPayDate(new Date().toISOString().split('T')[0]); setPayMethod(''); }}
                          className="text-[11px] font-bold text-secondary hover:underline whitespace-nowrap"
                        >
                          Marcar pago
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ─── Mark Paid Modal ─── */}
      {payToConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setPayToConfirm(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-3xl p-7 w-full max-w-sm shadow-2xl space-y-5">
            <h3 className="text-lg font-black text-primary">Registrar pagamento</h3>
            <p className="text-sm text-slate-400">
              <span className="font-bold text-primary">{payToConfirm.reference_month}</span> — R$ {payToConfirm.amount.toFixed(2)}
            </p>
            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">Data do pagamento</label>
              <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-secondary text-slate-500" />
            </div>
            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">Forma de pagamento</label>
              <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-secondary bg-white text-slate-600">
                <option value="">Selecione...</option>
                <option>PIX</option><option>Dinheiro</option><option>Cartão de débito</option><option>Cartão de crédito</option><option>Transferência</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setPayToConfirm(null)} className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-primary font-bold hover:bg-slate-50 text-sm">Cancelar</button>
              <button onClick={confirmMarkPaid} disabled={saving} className="flex-1 px-4 py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Generate Modal ─── */}
      {showGenerate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowGenerate(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-primary">Gerar Mensalidades</h3>
              <button onClick={() => setShowGenerate(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            {/* Student info card */}
            <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-slate-400">Aluna</span><span className="font-bold text-primary">{studentName}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-400">Plano</span><span className="font-bold text-primary">{studentPlan || '—'}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-400">Valor mensal</span><span className="font-bold text-primary">R$ {studentValue?.toFixed(2) ?? '0.00'}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-400">Dia de vencimento</span><span className="font-bold text-primary">Dia {studentDueDay || '10'}</span></div>
            </div>

            {/* Year selector */}
            <div>
              <label className="block text-[13px] font-bold text-primary mb-2">Ano</label>
              <select value={genYear} onChange={e => { setGenYear(Number(e.target.value)); setGenMonths([]); }} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-secondary cursor-pointer">
                {[2025, 2026, 2027, 2028].map(y => <option key={y}>{y}</option>)}
              </select>
            </div>

            {/* Month grid */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-[13px] font-bold text-primary">Meses para gerar</label>
                <button type="button" onClick={selectAllAvailable} className="text-[12px] font-bold text-secondary hover:underline flex items-center gap-1">
                  <CheckCircle2 size={13} />
                  Selecionar todos disponíveis ({availableCount})
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
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
                        'flex flex-col items-center gap-1 py-3 rounded-xl border text-sm font-semibold transition-all',
                        isGenerated
                          ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                          : isSelected
                            ? 'bg-secondary/10 border-secondary text-secondary'
                            : 'bg-white border-slate-200 text-primary hover:border-secondary/50 cursor-pointer'
                      )}
                    >
                      {!isGenerated && (
                        <div className={cn('w-4 h-4 rounded border-2 flex items-center justify-center transition-all',
                          isSelected ? 'bg-secondary border-secondary' : 'border-slate-300'
                        )}>
                          {isSelected && <CheckCircle2 size={10} className="text-white" />}
                        </div>
                      )}
                      <span>{month}</span>
                      {isGenerated && <span className="text-[10px] text-slate-400">Gerado</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowGenerate(false)} className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-primary font-bold hover:bg-slate-50 text-sm">Cancelar</button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={genMonths.length === 0 || generating}
                className="flex-1 px-4 py-3 bg-secondary text-white rounded-xl font-bold hover:bg-primary transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                Gerar Mensalidades
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Extra Charge Modal ─── */}
      {showExtraModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowExtraModal(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-primary">Nova Cobrança Extra</h3>
              <button onClick={() => setShowExtraModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4">
              <p className="text-sm text-slate-400">Aluna: <span className="font-bold text-primary">{studentName}</span></p>
            </div>

            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">Tipo de cobrança <span className="text-red-500">*</span></label>
              <select value={extraData.type} onChange={e => setExtraData(p => ({ ...p, type: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-secondary bg-white">
                <option value="">Selecione o tipo</option>
                {chargeTypes.map(t => <option key={t.id} value={t.label}>{t.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">Descrição</label>
              <input type="text" value={extraData.description} onChange={e => setExtraData(p => ({ ...p, description: e.target.value }))} placeholder="Ex: Uniforme Ballet 2026" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-secondary" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-bold text-primary mb-1.5">Valor total (R$) <span className="text-red-500">*</span></label>
                <input type="number" step="0.01" min="0" value={extraData.amount} onChange={e => setExtraData(p => ({ ...p, amount: e.target.value }))} placeholder="0,00" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-secondary" />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-primary mb-1.5">Parcelas</label>
                <select value={extraData.installments} onChange={e => setExtraData(p => ({ ...p, installments: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-secondary bg-white">
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={n}>{n}x</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-bold text-primary mb-1.5">Vencimento <span className="text-red-500">*</span></label>
              <input type="date" value={extraData.dueDate} onChange={e => setExtraData(p => ({ ...p, dueDate: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-secondary text-slate-500" />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowExtraModal(false)} className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-primary font-bold hover:bg-slate-50 text-sm">Cancelar</button>
              <button
                onClick={handleExtraCharge}
                disabled={saving || !extraData.type || !extraData.amount || !extraData.dueDate}
                className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Gerar cobranças
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Attendance Tab ───────────────────────────────────────────────────────────

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

const MODALITY_DOTS: Record<string, string> = {
  'Ballet Clássico': 'bg-pink-400', Ballet: 'bg-pink-400',
  Jazz: 'bg-purple-400', 'Contemporâneo': 'bg-blue-400',
  'Hip-Hop': 'bg-orange-400', 'Hip Hop': 'bg-orange-400',
  Sapateado: 'bg-amber-400', 'Dança do Ventre': 'bg-teal-400',
  Forró: 'bg-green-400', Samba: 'bg-red-400',
  'K-Pop': 'bg-violet-400', Stiletto: 'bg-rose-400', 'Baby Class': 'bg-yellow-400',
};
const modDot = (m: string | null) => m ? (MODALITY_DOTS[m] ?? 'bg-cyan-400') : 'bg-slate-300';

const AttendanceTab = ({ studentId }: { studentId: string }) => {
  const [records, setRecords] = useState<AttRec[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo,   setFilterTo]   = useState('');
  const [filterClass, setFilterClass] = useState('');

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
          id:         r.id,
          date:       r.date,
          status:     r.status as AttStatus,
          notes:      r.notes,
          class_id:   r.class_id,
          class_name: r.classes?.name ?? '—',
          modality:   r.classes?.modality ?? null,
        }))
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
    if (filterTo   && r.date > filterTo)   return false;
    if (filterClass && r.class_id !== filterClass) return false;
    return true;
  }), [records, filterFrom, filterTo, filterClass]);

  const total    = filtered.length;
  const present  = filtered.filter(r => r.status === 'present' || r.status === 'late').length;
  const absent   = filtered.filter(r => r.status === 'absent').length;
  const rate     = total > 0 ? Math.round((present / total) * 100) : 0;

  const rateColor = rate >= 80 ? 'text-green-600' : rate >= 60 ? 'text-amber-500' : 'text-red-500';
  const rateBg    = rate >= 80 ? 'bg-green-50 border-green-100' : rate >= 60 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100';

  const fmtDate = (s: string) => { const [y,m,d] = s.split('-'); return `${d}/${m}/${y}`; };

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 size={24} className="animate-spin text-secondary" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total de Aulas',    value: String(total),    cls: 'bg-slate-50 border-slate-100',              val: 'text-primary' },
          { label: 'Presenças',         value: String(present),  cls: 'bg-green-50 border-green-100',              val: 'text-green-600' },
          { label: 'Ausências',         value: String(absent),   cls: 'bg-red-50 border-red-100',                  val: 'text-red-500' },
          { label: 'Taxa de Presença',  value: `${rate}%`,       cls: `${rateBg}`,                                 val: rateColor },
        ].map(({ label, value, cls, val }) => (
          <div key={label} className={cn('rounded-2xl border p-4', cls)}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
            <p className={cn('text-2xl font-extrabold mt-1', val)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-2xl border border-slate-100 p-4 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)]">
        <Filter size={14} className="text-slate-400 shrink-0" />
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">De</label>
          <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 outline-none focus:ring-1 focus:ring-secondary/50 focus:border-secondary" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">Até</label>
          <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 outline-none focus:ring-1 focus:ring-secondary/50 focus:border-secondary" />
        </div>
        <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 outline-none focus:ring-1 focus:ring-secondary/50 focus:border-secondary bg-white">
          <option value="">Todas as turmas</option>
          {classOptions.map(r => (
            <option key={r.class_id} value={r.class_id}>{r.class_name}</option>
          ))}
        </select>
        {(filterFrom || filterTo || filterClass) && (
          <button onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterClass(''); }}
            className="text-xs font-semibold text-secondary hover:underline">
            Limpar
          </button>
        )}
      </div>

      {/* Records list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center bg-white rounded-[20px] border border-slate-100">
          <ClipboardCheck size={36} className="text-slate-200 mb-3" />
          <p className="text-sm font-semibold text-slate-500">Nenhum registro encontrado</p>
          <p className="text-xs text-slate-400 mt-1">Ajuste os filtros ou registre a chamada na tela de Frequência</p>
        </div>
      ) : (
        <div className="bg-white rounded-[20px] border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="px-5 py-3 text-[11px] font-extrabold text-primary uppercase tracking-wider">Data</th>
                <th className="px-5 py-3 text-[11px] font-extrabold text-primary uppercase tracking-wider">Turma</th>
                <th className="px-5 py-3 text-[11px] font-extrabold text-primary uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-[11px] font-extrabold text-primary uppercase tracking-wider hidden lg:table-cell">Observações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(r => {
                const cfg = ATT_CFG[r.status];
                return (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3 text-sm font-semibold text-slate-700 whitespace-nowrap">{fmtDate(r.date)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className={cn('w-2 h-2 rounded-full shrink-0', modDot(r.modality))} />
                        <span className="text-sm text-slate-700">{r.class_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full border', cfg.badge)}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-400 hidden lg:table-cell">{r.notes || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── Classes Tab ─────────────────────────────────────────────────────────────
const ClassesTab = ({ studentId }: { studentId: string }) => {
  const [enrolled, setEnrolled] = useState<any[]>([]);
  const [available, setAvailable] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');

  const loadList = async () => {
    setLoading(true);
    // matriculadas
    const { data } = await supabase
      .from('class_students')
      .select('*, classes(id, name, modality, teacher, max_capacity, class_students(student_id, status))')
      .eq('student_id', studentId)
      .eq('status', 'active');
    setEnrolled(data ?? []);
    setLoading(false);
  };

  const loadAvailable = async () => {
    // all active classes
    const { data: allClasses } = await supabase
      .from('classes')
      .select('*, class_schedules(*), class_students(student_id, status)')
      .eq('is_active', true);
      
    // filter those where student is enrolled
    const enrolledIds = enrolled.map(e => e.class_id);
    const av = (allClasses ?? []).filter(c => !enrolledIds.includes(c.id));
    setAvailable(av);
  };

  useEffect(() => { loadList(); }, [studentId]);

  const handleOpenModal = () => { loadAvailable(); setShowModal(true); };

  const handleEnroll = async (cls: any) => {
    const activeCount = cls.class_students?.filter((s:any) => s.status === 'active').length || 0;
    if (activeCount >= cls.max_capacity && !window.confirm('Turma lotada! Deseja pular o limite de capacidade e matricular mesmo assim?')) return;
    
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('class_students').upsert({ class_id: cls.id, student_id: studentId, owner_id: user?.id, status: 'active' }, { onConflict: 'class_id, student_id' });
      await loadList();
      setAvailable(prev => prev.filter(c => c.id !== cls.id));
    } catch(err:any){ alert(err.message); }
    finally { setSaving(false); }
  };

  const handleUnenroll = async (classId: string) => {
    if (!window.confirm('Remover aluna da turma?')) return;
    setSaving(true);
    try {
      await supabase.from('class_students').update({ status: 'inactive' }).eq('class_id', classId).eq('student_id', studentId);
      await loadList();
    } catch(err:any){ alert(err.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-secondary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-primary">Turmas Matriculadas</h3>
        <button onClick={handleOpenModal} className="flex items-center gap-2 px-4 py-2.5 bg-secondary text-white rounded-full font-bold hover:bg-primary transition-all text-sm shadow-md shadow-secondary/20">
          <Plus size={16} strokeWidth={3} />
          Matricular em Turma
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {enrolled.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Layers size={40} className="mb-3 opacity-30" />
            <p className="font-medium">Aluna não está matriculada em nenhuma turma.</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <tbody>
              {enrolled.map(e => (
                <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="text-sm font-bold text-primary">{e.classes?.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {e.classes?.modality && <span className="text-[10px] bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-bold">{e.classes.modality}</span>}
                      {e.classes?.teacher && <span className="text-[10px] text-slate-500 flex items-center gap-1"><Users size={10}/> {e.classes.teacher}</span>}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button onClick={() => handleUnenroll(e.class_id)} disabled={saving} className="text-xs font-bold text-red-500 hover:text-red-600 border border-transparent hover:border-red-100 bg-red-50 px-3 py-1.5 rounded-full transition-all disabled:opacity-50">
                      Desmatricular
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div onClick={ev => ev.stopPropagation()} className="bg-white rounded-[24px] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-lg font-black text-primary">Matricular em Turma</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 bg-white shadow-sm border border-slate-100 rounded-full p-2"><X size={16} /></button>
            </div>
            
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Buscar turma pela modalidade, professor ou nome..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-slate-50 rounded-xl py-2 pl-9 pr-4 text-sm outline-none focus:ring-1 focus:ring-secondary/50 focus:border-secondary border border-transparent" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {available.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()) || c.modality?.toLowerCase().includes(search.toLowerCase())).length === 0 ? (
                <div className="text-center text-sm text-slate-400 py-10">Nenhuma turma disponível.</div>
              ) : (
                <div className="space-y-1">
                  {available.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()) || c.modality?.toLowerCase().includes(search.toLowerCase())).map(cls => {
                    const activeStudents = cls.class_students?.filter((s:any) => s.status === 'active').length || 0;
                    return (
                      <div key={cls.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors">
                        <div>
                          <p className="text-sm font-semibold text-primary">{cls.name}</p>
                          <p className="text-[11px] text-slate-400">{activeStudents}/{cls.max_capacity} vagas preenchidas</p>
                        </div>
                        <button onClick={() => handleEnroll(cls)} disabled={saving} className="text-xs font-bold text-secondary bg-secondary/10 px-3 py-1.5 rounded-full hover:bg-secondary/20 transition-colors disabled:opacity-50">
                          Matricular
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const StudentDetail = ({ studentId, onBack }: StudentDetailProps) => {
  const [activeTab, setActiveTab] = useState<'dados' | 'financeiro' | 'frequencia' | 'turmas'>('dados');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

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
      if (error || !data) { setError('Erro ao carregar dados do aluno.'); }
      else {
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setPhotoFile(file); setPhotoPreview(URL.createObjectURL(file)); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');
      let photo_url = formData.photo_url || null;
      if (photoFile) {
        const ext = photoFile.name.split('.').pop();
        const filePath = `${user.id}/${studentId}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('student-photos').upload(filePath, photoFile, { upsert: true });
        if (!uploadError) {
          const { data: signedData } = await supabase.storage.from('student-photos').createSignedUrl(filePath, 60 * 60 * 24 * 365);
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
      onBack();
    } catch (err: any) { setError(err.message || 'Erro ao salvar.'); }
    finally { setSaving(false); }
  };

  const getInitials = (name: string) => name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={36} className="animate-spin text-secondary" /></div>;

  return (
    <div className="max-w-[1000px] mx-auto space-y-6 pb-12">
      {/* Page header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="text-slate-400 hover:text-secondary transition-colors">
          <ChevronLeft size={24} />
        </button>
        <div className="flex items-center gap-4 flex-1">
          <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 relative overflow-hidden shrink-0">
            {photoPreview
              ? <img src={photoPreview} alt="Foto" className="w-full h-full object-cover" />
              : <span className="text-base font-black">{getInitials(formData.full_name)}</span>
            }
          </div>
          <div>
            <h2 className="text-2xl font-bold text-primary leading-tight">{formData.full_name || 'Detalhe do Aluno'}</h2>
            <span className={cn('text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full', formData.status === 'Ativo' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400')}>
              {formData.status}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {([
          { id: 'dados',      label: 'Dados',       icon: undefined },
          { id: 'financeiro', label: 'Financeiro', icon: <Wallet size={15} /> },
          { id: 'frequencia', label: 'Frequência', icon: <ClipboardCheck size={15} /> },
          { id: 'turmas',     label: 'Turmas',     icon: <Layers size={15} /> },
        ] as const).map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'px-5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2',
              activeTab === id ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'
            )}
          >
            {icon}{label}
          </button>
        ))}
      </div>

      {error && <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600 font-medium">{error}</div>}

      {/* Tab content */}
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
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* DADOS PESSOAIS */}
          <div className="bg-white rounded-[20px] p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-slate-50">
            <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider mb-6">Dados Pessoais</h3>
            <div className="flex flex-col md:flex-row gap-8">
              <div className="flex flex-col items-center gap-3 w-32 shrink-0">
                <div className="w-24 h-24 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-300 relative group overflow-hidden cursor-pointer hover:border-secondary hover:bg-secondary/5 transition-all">
                  {photoPreview ? <img src={photoPreview} alt="Foto" className="w-full h-full object-cover" /> : formData.full_name ? <span className="text-2xl font-black text-slate-400">{getInitials(formData.full_name)}</span> : <Camera size={28} className="group-hover:text-secondary" />}
                  <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={handlePhotoChange} />
                </div>
                <span className="text-[11px] text-accent text-center font-medium">Alterar foto</span>
              </div>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                <div><label className="block text-[13px] font-bold text-primary mb-1.5">Nome completo <span className="text-red-500">*</span></label><input required name="full_name" value={formData.full_name} onChange={handleChange} type="text" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none" /></div>
                <div><label className="block text-[13px] font-bold text-primary mb-1.5">Data de nascimento</label><input name="birth_date" value={formData.birth_date} onChange={handleChange} type="date" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none text-slate-500" /></div>
                <div><label className="block text-[13px] font-bold text-primary mb-1.5">CPF</label><input name="cpf" value={formData.cpf} onChange={handleChange} type="text" placeholder="000.000.000-00" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none placeholder-slate-300" /></div>
                <div><label className="block text-[13px] font-bold text-primary mb-1.5">Telefone</label><input name="phone" value={formData.phone} onChange={handleChange} type="tel" placeholder="(51) 99999-9999" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none placeholder-slate-300" /></div>
                <div><label className="block text-[13px] font-bold text-primary mb-1.5">WhatsApp</label><input name="whatsapp" value={formData.whatsapp} onChange={handleChange} type="tel" placeholder="(51) 99999-9999" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none placeholder-slate-300" /></div>
                <div><label className="block text-[13px] font-bold text-primary mb-1.5">E-mail</label><input name="email" value={formData.email} onChange={handleChange} type="email" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none" /></div>
              </div>
            </div>

            {/* RESPONSÁVEL (para menores) */}
            <div className="mt-8 pt-8 border-t border-slate-50">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-5">Responsável (Caso seja menor de idade)</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-[13px] font-bold text-primary mb-1.5">Nome do responsável</label>
                  <input name="responsible_name" value={formData.responsible_name} onChange={handleChange} type="text" placeholder="Nome completo" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-primary mb-1.5">CPF do responsável</label>
                  <input name="responsible_cpf" value={formData.responsible_cpf} onChange={handleChange} type="text" placeholder="000.000.000-00" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none transition-all placeholder-slate-300 font-medium" />
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-primary mb-1.5">Telefone do responsável</label>
                  <input name="responsible_phone" value={formData.responsible_phone} onChange={handleChange} type="tel" placeholder="(51) 99999-9999" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none transition-all placeholder-slate-300 font-medium" />
                </div>
              </div>
            </div>
          </div>

          {/* ENDEREÇO */}
          <div className="bg-white rounded-[20px] p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-slate-50">
            <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider mb-6">Endereço</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <div><label className="block text-[13px] font-bold text-primary mb-1.5">CEP</label><input name="cep" value={formData.cep} onChange={handleChange} type="text" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none" /></div>
              <div><label className="block text-[13px] font-bold text-primary mb-1.5">Rua / Logradouro</label><input name="street" value={formData.street} onChange={handleChange} type="text" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none" /></div>
              <div><label className="block text-[13px] font-bold text-primary mb-1.5">Número</label><input name="number" value={formData.number} onChange={handleChange} type="text" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none" /></div>
              <div><label className="block text-[13px] font-bold text-primary mb-1.5">Bairro</label><input name="neighborhood" value={formData.neighborhood} onChange={handleChange} type="text" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none" /></div>
              <div><label className="block text-[13px] font-bold text-primary mb-1.5">Cidade</label><input name="city" value={formData.city} onChange={handleChange} type="text" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none" /></div>
              <div><label className="block text-[13px] font-bold text-primary mb-1.5">Estado</label><input name="state" value={formData.state} onChange={handleChange} type="text" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none" /></div>
            </div>
          </div>

          {/* MATRÍCULA */}
          <div className="bg-white rounded-[20px] p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-slate-50">
            <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider mb-6">Matrícula</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <div><label className="block text-[13px] font-bold text-primary mb-1.5">Data de matrícula</label><input name="enrollment_date" value={formData.enrollment_date} onChange={handleChange} type="date" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none text-slate-500" /></div>
              <div><label className="block text-[13px] font-bold text-primary mb-1.5">Plano</label>
                <select name="plan" value={formData.plan} onChange={handleChange} className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm text-slate-600 bg-white outline-none cursor-pointer">
                  <option value="">Selecione...</option>
                  {plans.map(p => <option key={p.id} value={p.label}>{p.label}</option>)}
                </select>
              </div>
              <div><label className="block text-[13px] font-bold text-primary mb-1.5">Valor personalizado (R$)</label><input name="custom_value" value={formData.custom_value} onChange={handleChange} type="number" step="0.01" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none" /></div>
              <div><label className="block text-[13px] font-bold text-primary mb-1.5">Dia do vencimento</label><input name="due_day" value={formData.due_day} onChange={handleChange} type="number" min="1" max="31" className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm outline-none" /></div>
              <div><label className="block text-[13px] font-bold text-primary mb-1.5">Como nos conheceu</label>
                <select name="acquisition_channel" value={formData.acquisition_channel} onChange={handleChange} className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm text-slate-600 bg-white outline-none cursor-pointer">
                  <option value="">Selecione...</option>
                  {acquisitionChannels.map(c => <option key={c.id} value={c.label}>{c.label}</option>)}
                </select>
              </div>
              <div><label className="block text-[13px] font-bold text-primary mb-1.5">Status</label>
                <select name="status" value={formData.status} onChange={handleChange} className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-2.5 text-sm text-slate-600 bg-white outline-none cursor-pointer">
                  <option>Ativo</option><option>Inativo</option>
                </select>
              </div>
            </div>
          </div>

          {/* OBSERVAÇÕES */}
          <div className="bg-white rounded-[20px] p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-slate-50">
            <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider mb-6">Observações</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <div><label className="block text-[13px] font-bold text-primary mb-1.5">Observações médicas</label><textarea name="medical_notes" value={formData.medical_notes} onChange={handleChange} rows={3} className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-3 text-sm resize-none outline-none" /></div>
              <div><label className="block text-[13px] font-bold text-primary mb-1.5">Observações gerais</label><textarea name="general_notes" value={formData.general_notes} onChange={handleChange} rows={3} className="w-full rounded-xl border border-slate-200 focus:ring-1 focus:ring-secondary/50 focus:border-secondary px-4 py-3 text-sm resize-none outline-none" /></div>
            </div>
          </div>

          <div className="flex justify-end items-center gap-4 pt-4">
            <button type="button" onClick={onBack} className="px-6 py-2 rounded-full border border-slate-200 text-primary font-bold hover:bg-slate-50 transition-colors text-sm">Cancelar</button>
            <button type="submit" disabled={saving} className="px-6 py-2.5 bg-secondary text-white rounded-full font-bold hover:bg-primary transition-all text-sm shadow-md shadow-secondary/20 flex items-center gap-2 disabled:opacity-60">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
