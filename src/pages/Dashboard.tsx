import { DashboardStats } from '../types';
import { Users, Wallet, AlertCircle, CalendarCheck, Cake } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

const StatCard = ({ label, value, trend, icon: Icon, color, trendColor }: { label: string, value: string, trend?: string, icon: any, color: string, trendColor?: string }) => (
  <div className={cn("bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm", color)}>
    <div className="flex items-center justify-between mb-4">
      <div className="bg-secondary/10 dark:bg-blue-900/20 p-2 rounded-lg text-secondary">
        <Icon size={20} />
      </div>
      {trend && (
        <span className={cn("text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1", trendColor)}>
          {trend}
        </span>
      )}
    </div>
    <p className="text-slate-500 text-sm font-medium">{label}</p>
    <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{value}</h3>
  </div>
);

export const Dashboard = ({ stats }: { stats: DashboardStats | null }) => {
  if (!stats) return <div>Carregando...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Bem-vindo de volta, Admin!</h2>
        <p className="text-slate-500">Aqui está um resumo do que está acontecendo na escola hoje.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Total de Alunos" 
          value={stats.totalStudents.toString()} 
          trend="+5%" 
          icon={Users} 
          color="" 
          trendColor="text-green-500 bg-green-50" 
        />
        <StatCard 
          label="Receita Mensal" 
          value={`R$ ${stats.monthlyRevenue.toLocaleString('pt-BR')}`} 
          trend="+R$ 1.200" 
          icon={Wallet} 
          color="" 
          trendColor="text-green-500 bg-green-50" 
        />
        <StatCard 
          label="Inadimplência" 
          value={`${stats.delinquencyRate}%`} 
          trend="Crítico" 
          icon={AlertCircle} 
          color="border-l-4 border-l-red-500" 
          trendColor="text-red-500 bg-red-50" 
        />
        <StatCard 
          label="Ocupação das Turmas" 
          value={`${stats.occupancyRate}%`} 
          trend="Otimizado" 
          icon={CalendarCheck} 
          color="" 
          trendColor="text-secondary bg-secondary/10" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-lg">Evolução da Receita</h3>
            <select className="text-sm border-slate-200 dark:border-slate-700 bg-transparent rounded-lg focus:ring-secondary/50">
              <option>Últimos 6 meses</option>
              <option>Último ano</option>
            </select>
          </div>
          <div className="flex items-end justify-between h-64 gap-4 px-2">
            {stats.revenueHistory.map((item, i) => (
              <div key={i} className="flex flex-col items-center flex-1 gap-2">
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-t-lg relative group h-full">
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: `${item.value}%` }}
                    className={cn(
                      "absolute bottom-0 w-full rounded-t-lg transition-all",
                      i === stats.revenueHistory.length - 1 ? "bg-secondary" : "bg-blue-400/60"
                    )}
                  />
                </div>
                <span className={cn("text-xs font-medium", i === stats.revenueHistory.length - 1 ? "text-secondary font-bold" : "text-slate-500")}>
                  {item.month}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-lg mb-6">Aniversariantes do Mês</h3>
          <div className="space-y-4">
            {[
              { name: "Beatriz Silva", date: "12 de Junho", img: "https://picsum.photos/seed/dance1/100/100" },
              { name: "Lucas Oliveira", date: "15 de Junho", img: "https://picsum.photos/seed/dance2/100/100" },
              { name: "Mariana Costa", date: "22 de Junho", img: "https://picsum.photos/seed/dance3/100/100" },
            ].map((b, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-3">
                  <img src={b.img} alt={b.name} className="w-10 h-10 rounded-full object-cover" />
                  <div>
                    <p className="text-sm font-bold">{b.name}</p>
                    <p className="text-xs text-slate-500">{b.date}</p>
                  </div>
                </div>
                <Cake size={18} className="text-blue-200" />
              </div>
            ))}
          </div>
          <button className="w-full mt-6 text-sm text-secondary font-semibold hover:underline">Ver calendário completo</button>
        </div>
      </div>
    </div>
  );
};
