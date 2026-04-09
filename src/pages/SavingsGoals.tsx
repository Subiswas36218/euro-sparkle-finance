import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useSavingsGoals } from "@/hooks/useSavingsGoals";
import { useProfile } from "@/hooks/useProfile";
import { getCurrencySymbol } from "@/lib/currency";
import { Plus, Trash2, PiggyBank, Target, TrendingUp, CalendarDays } from "lucide-react";
import { format, differenceInDays } from "date-fns";

const GOAL_ICONS = ["🎯", "🏠", "🚗", "✈️", "💻", "📚", "💍", "🏋️", "🎓", "🏖️", "💰", "🎮"];
const GOAL_COLORS = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#EC4899", "#6366F1", "#14B8A6"];

export default function SavingsGoals() {
  const { data: goals = [], isLoading, addGoal, updateGoal, deleteGoal } = useSavingsGoals();
  const { data: profile } = useProfile();
  const sym = getCurrencySymbol(profile?.currency || "EUR");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [addMoneyGoalId, setAddMoneyGoalId] = useState<string | null>(null);
  const [addMoneyAmount, setAddMoneyAmount] = useState("");
  const [form, setForm] = useState({
    name: "",
    target_amount: "",
    current_amount: "0",
    deadline: "",
    icon: "🎯",
    color: "#3B82F6",
  });

  const resetForm = () => {
    setForm({ name: "", target_amount: "", current_amount: "0", deadline: "", icon: "🎯", color: "#3B82F6" });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    addGoal.mutate(
      {
        name: form.name.trim(),
        target_amount: parseFloat(form.target_amount),
        current_amount: parseFloat(form.current_amount) || 0,
        deadline: form.deadline || null,
        icon: form.icon,
        color: form.color,
      },
      { onSuccess: () => { setDialogOpen(false); resetForm(); } }
    );
  };

  const handleAddMoney = (goalId: string, currentAmount: number) => {
    const amount = parseFloat(addMoneyAmount);
    if (isNaN(amount) || amount <= 0) return;
    updateGoal.mutate(
      { id: goalId, current_amount: currentAmount + amount },
      { onSuccess: () => { setAddMoneyGoalId(null); setAddMoneyAmount(""); } }
    );
  };

  // Summary stats
  const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount), 0);
  const totalSaved = goals.reduce((s, g) => s + Number(g.current_amount), 0);
  const completedCount = goals.filter((g) => Number(g.current_amount) >= Number(g.target_amount)).length;

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
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-3xl font-bold">Savings Goals</h1>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> New Goal</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Create Savings Goal</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <Label>Goal Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    placeholder="e.g. Emergency Fund, Vacation"
                    maxLength={100}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Target Amount ({sym})</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="1"
                      value={form.target_amount}
                      onChange={(e) => setForm({ ...form, target_amount: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label>Already Saved ({sym})</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.current_amount}
                      onChange={(e) => setForm({ ...form, current_amount: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Deadline (optional)</Label>
                  <Input
                    type="date"
                    value={form.deadline}
                    onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Icon</Label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {GOAL_ICONS.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setForm({ ...form, icon })}
                        className={`rounded-lg border-2 p-2 text-xl transition-colors ${
                          form.icon === icon ? "border-primary bg-primary/10" : "border-transparent hover:border-border"
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Color</Label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {GOAL_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setForm({ ...form, color })}
                        className={`h-8 w-8 rounded-full border-2 transition-all ${
                          form.color === color ? "border-foreground scale-110" : "border-transparent"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={addGoal.isPending}>
                  Create Goal
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Stats */}
        {goals.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-4 p-6">
                <div className="rounded-lg bg-primary/10 p-3">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Target</p>
                  <p className="text-2xl font-bold">{sym}{totalTarget.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-6">
                <div className="rounded-lg bg-success/10 p-3">
                  <PiggyBank className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Saved</p>
                  <p className="text-2xl font-bold text-success">{sym}{totalSaved.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-6">
                <div className="rounded-lg bg-accent p-3">
                  <TrendingUp className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{completedCount} / {goals.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Goals Grid */}
        {goals.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <PiggyBank className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="font-display text-lg font-semibold">No savings goals yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first goal to start tracking your savings progress.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {goals.map((goal) => {
              const pct = Number(goal.target_amount) > 0
                ? (Number(goal.current_amount) / Number(goal.target_amount)) * 100
                : 0;
              const isComplete = pct >= 100;
              const daysLeft = goal.deadline
                ? differenceInDays(new Date(goal.deadline), new Date())
                : null;

              return (
                <Card key={goal.id} className={`overflow-hidden ${isComplete ? "ring-2 ring-success" : ""}`}>
                  <div className="h-1.5" style={{ backgroundColor: goal.color }} />
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{goal.icon}</span>
                        <div>
                          <CardTitle className="font-display text-base">{goal.name}</CardTitle>
                          {goal.deadline && (
                            <CardDescription className="flex items-center gap-1 text-xs">
                              <CalendarDays className="h-3 w-3" />
                              {daysLeft !== null && daysLeft > 0
                                ? `${daysLeft} days left`
                                : daysLeft === 0
                                ? "Due today"
                                : isComplete
                                ? `Completed!`
                                : `${Math.abs(daysLeft!)} days overdue`
                              }
                            </CardDescription>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => deleteGoal.mutate(goal.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-end justify-between">
                      <span className="text-2xl font-bold" style={{ color: goal.color }}>
                        {sym}{Number(goal.current_amount).toFixed(2)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        of {sym}{Number(goal.target_amount).toFixed(2)}
                      </span>
                    </div>
                    <Progress
                      value={Math.min(pct, 100)}
                      className="h-2.5"
                      style={{ ["--goal-color" as any]: goal.color }}
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{pct.toFixed(0)}% complete</span>
                      <span>{sym}{(Number(goal.target_amount) - Number(goal.current_amount)).toFixed(2)} remaining</span>
                    </div>

                    {/* Add money */}
                    {addMoneyGoalId === goal.id ? (
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder={`Amount (${sym})`}
                          value={addMoneyAmount}
                          onChange={(e) => setAddMoneyAmount(e.target.value)}
                          className="h-9"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          onClick={() => handleAddMoney(goal.id, Number(goal.current_amount))}
                          disabled={updateGoal.isPending}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setAddMoneyGoalId(null); setAddMoneyAmount(""); }}
                        >
                          ✕
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1"
                        onClick={() => setAddMoneyGoalId(goal.id)}
                        style={{ borderColor: goal.color, color: goal.color }}
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Money
                      </Button>
                    )}

                    {isComplete && (
                      <p className="text-center text-xs font-semibold text-success">
                        🎉 Goal achieved!
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
