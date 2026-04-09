import { useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useTransactions } from "@/hooks/useTransactions";
import { useProfile } from "@/hooks/useProfile";
import { TrendingUp, TrendingDown, Wallet, Target, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths } from "date-fns";
import { convertCurrency, formatMoney, getCurrencySymbol } from "@/lib/currency";

const COLORS = ["#EF4444", "#F59E0B", "#3B82F6", "#8B5CF6", "#10B981", "#EC4899", "#6366F1", "#6B7280"];

export default function Dashboard() {
  const { data: transactions = [], isLoading } = useTransactions();
  const { data: profile } = useProfile();

  const baseCurrency = profile?.currency || "EUR";
  const sym = getCurrencySymbol(baseCurrency);

  // Helper to convert a transaction amount to base currency
  const toBase = (amount: number, txCurrency?: string) =>
    convertCurrency(amount, txCurrency || "EUR", baseCurrency);

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const thisMonth = transactions.filter((t) =>
      isWithinInterval(new Date(t.date), { start: monthStart, end: monthEnd })
    );

    const totalIncome = thisMonth
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + toBase(Number(t.amount), (t as any).currency), 0);
    const totalExpenses = thisMonth
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + toBase(Number(t.amount), (t as any).currency), 0);
    const balance = totalIncome - totalExpenses;
    const budget = profile?.monthly_budget ?? 2000;
    const budgetUsed = budget > 0 ? (totalExpenses / budget) * 100 : 0;

    return { totalIncome, totalExpenses, balance, budget, budgetUsed };
  }, [transactions, profile, baseCurrency]);

  // Monthly comparison
  const comparison = useMemo(() => {
    const now = new Date();
    const thisStart = startOfMonth(now);
    const thisEnd = endOfMonth(now);
    const lastStart = startOfMonth(subMonths(now, 1));
    const lastEnd = endOfMonth(subMonths(now, 1));

    const thisExpenses = transactions
      .filter((t) => t.type === "expense" && isWithinInterval(new Date(t.date), { start: thisStart, end: thisEnd }))
      .reduce((s, t) => s + toBase(Number(t.amount), (t as any).currency), 0);
    const lastExpenses = transactions
      .filter((t) => t.type === "expense" && isWithinInterval(new Date(t.date), { start: lastStart, end: lastEnd }))
      .reduce((s, t) => s + toBase(Number(t.amount), (t as any).currency), 0);
    const thisIncome = transactions
      .filter((t) => t.type === "income" && isWithinInterval(new Date(t.date), { start: thisStart, end: thisEnd }))
      .reduce((s, t) => s + toBase(Number(t.amount), (t as any).currency), 0);
    const lastIncome = transactions
      .filter((t) => t.type === "income" && isWithinInterval(new Date(t.date), { start: lastStart, end: lastEnd }))
      .reduce((s, t) => s + toBase(Number(t.amount), (t as any).currency), 0);

    const expenseChange = lastExpenses > 0 ? ((thisExpenses - lastExpenses) / lastExpenses) * 100 : 0;
    const incomeChange = lastIncome > 0 ? ((thisIncome - lastIncome) / lastIncome) * 100 : 0;

    return {
      thisExpenses, lastExpenses, thisIncome, lastIncome,
      expenseChange, incomeChange,
      lastMonthName: format(subMonths(now, 1), "MMMM"),
      thisMonthName: format(now, "MMMM"),
    };
  }, [transactions, baseCurrency]);

  const categoryData = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const thisMonth = transactions.filter(
      (t) => t.type === "expense" && isWithinInterval(new Date(t.date), { start: monthStart, end: monthEnd })
    );

    const grouped: Record<string, number> = {};
    thisMonth.forEach((t) => {
      const cat = t.category || "Other";
      grouped[cat] = (grouped[cat] || 0) + Number(t.amount);
    });

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  const monthlyData = useMemo(() => {
    const months: { name: string; income: number; expenses: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      const monthTx = transactions.filter((t) =>
        isWithinInterval(new Date(t.date), { start, end })
      );
      months.push({
        name: format(date, "MMM"),
        income: monthTx.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0),
        expenses: monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0),
      });
    }
    return months;
  }, [transactions]);

  const recentTransactions = transactions.slice(0, 5);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="font-display text-3xl font-bold">Dashboard</h1>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-lg bg-success/10 p-3">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Income</p>
                <p className="text-2xl font-bold text-success">{sym}{stats.totalIncome.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-lg bg-destructive/10 p-3">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expenses</p>
                <p className="text-2xl font-bold text-destructive">{sym}{stats.totalExpenses.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-lg bg-primary/10 p-3">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Balance</p>
                <p className="text-2xl font-bold">{sym}{stats.balance.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-lg bg-accent p-3">
                <Target className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Budget Used</p>
                <p className="text-2xl font-bold">{stats.budgetUsed.toFixed(0)}%</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Budget Progress */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg">Monthly Budget</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {sym}{stats.totalExpenses.toFixed(2)} of {sym}{stats.budget.toFixed(2)}
              </span>
              <span
                className={`font-semibold ${
                  stats.budgetUsed >= 100
                    ? "text-destructive"
                    : stats.budgetUsed >= 80
                    ? "text-warning"
                    : "text-success"
                }`}
              >
                {stats.budgetUsed.toFixed(0)}%
              </span>
            </div>
            <Progress
              value={Math.min(stats.budgetUsed, 100)}
              className={`h-3 ${
                stats.budgetUsed >= 100
                  ? "[&>div]:bg-destructive"
                  : stats.budgetUsed >= 80
                  ? "[&>div]:bg-warning"
                  : "[&>div]:bg-success"
              }`}
            />
            {stats.budgetUsed >= 100 && (
              <p className="text-xs text-destructive font-medium">⚠️ You've exceeded your monthly budget!</p>
            )}
            {stats.budgetUsed >= 80 && stats.budgetUsed < 100 && (
              <p className="text-xs text-warning font-medium">⚡ You're approaching your budget limit.</p>
            )}
          </CardContent>
        </Card>

        {/* Monthly Comparison */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg">Month-over-Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Expenses comparison */}
              <div className="rounded-lg border p-4 space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Expenses</p>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xl font-bold text-destructive">{sym}{comparison.thisExpenses.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{comparison.thisMonthName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">{sym}{comparison.lastExpenses.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{comparison.lastMonthName}</p>
                  </div>
                </div>
                {comparison.lastExpenses > 0 && (
                  <div className={`flex items-center gap-1 text-sm font-semibold ${comparison.expenseChange > 0 ? "text-destructive" : comparison.expenseChange < 0 ? "text-success" : "text-muted-foreground"}`}>
                    {comparison.expenseChange > 0 ? <ArrowUpRight className="h-4 w-4" /> : comparison.expenseChange < 0 ? <ArrowDownRight className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                    {Math.abs(comparison.expenseChange).toFixed(1)}% {comparison.expenseChange > 0 ? "more" : comparison.expenseChange < 0 ? "less" : "same"}
                  </div>
                )}
              </div>
              {/* Income comparison */}
              <div className="rounded-lg border p-4 space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Income</p>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xl font-bold text-success">{sym}{comparison.thisIncome.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{comparison.thisMonthName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">{sym}{comparison.lastIncome.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{comparison.lastMonthName}</p>
                  </div>
                </div>
                {comparison.lastIncome > 0 && (
                  <div className={`flex items-center gap-1 text-sm font-semibold ${comparison.incomeChange > 0 ? "text-success" : comparison.incomeChange < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                    {comparison.incomeChange > 0 ? <ArrowUpRight className="h-4 w-4" /> : comparison.incomeChange < 0 ? <ArrowDownRight className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                    {Math.abs(comparison.incomeChange).toFixed(1)}% {comparison.incomeChange > 0 ? "more" : comparison.incomeChange < 0 ? "less" : "same"}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Monthly Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                  />
                  <Bar dataKey="income" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Spending by Category</CardTitle>
            </CardHeader>
            <CardContent>
              {categoryData.length === 0 ? (
                <p className="py-12 text-center text-muted-foreground">No expenses this month</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {categoryData.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => `${sym}${value.toFixed(2)}`}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                {categoryData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-1.5 text-xs">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    {item.name}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                No transactions yet. Add your first transaction!
              </p>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <div className="text-lg">{tx.category === "Food" ? "🍔" : tx.category === "Transport" ? "🚗" : tx.category === "Housing" ? "🏠" : tx.category === "Entertainment" ? "🎬" : tx.category === "Health" ? "💊" : tx.category === "Shopping" ? "🛍️" : tx.category === "Utilities" ? "💡" : "📦"}</div>
                      <div>
                        <p className="text-sm font-medium">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {tx.category || "Uncategorized"} · {format(new Date(tx.date), "MMM d")}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-sm font-semibold ${tx.type === "income" ? "text-success" : "text-destructive"}`}
                    >
                      {tx.type === "income" ? "+" : "-"}{sym}{Number(tx.amount).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
