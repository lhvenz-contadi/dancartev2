export interface Student {
  id: number;
  name: string;
  age: number;
  responsible: string;
  class: string;
  status: 'Ativo' | 'Inativo';
  payment: 'Em dia' | 'Pendente' | 'Atrasado';
  email: string;
  photo?: string;
}

export interface DashboardStats {
  totalStudents: number;
  monthlyRevenue: number;
  delinquencyRate: number;
  occupancyRate: number;
  revenueHistory: { month: string; value: number }[];
}
