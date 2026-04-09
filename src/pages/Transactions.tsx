import { useState, useRef, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { Plus, Upload, Pencil, Trash2, Search, Repeat } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const CATEGORY_ICONS: Record<string, string> = {
  Food: "🍔", Transport: "🚗", Housing: "🏠", Entertainment: "🎬",
  Health: "💊", Shopping: "🛍️", Utilities: "💡", Other: "📦",
};

export default function Transactions() {
  const { data: transactions = [], isLoading, addTransaction, updateTransaction, deleteTransaction } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [categorizing, setCategorizing] = useState(false);
  const [form, setForm] = useState({
    description: "", amount: "", category: "", date: format(new Date(), "yyyy-MM-dd"), type: "expense" as "income" | "expense",
    recurringFrequency: "none" as "none" | "weekly" | "monthly" | "yearly",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterType, setFilterType] = useState("all");

  const autoCategorize = useCallback(async (description: string) => {
    if (!description.trim() || editId) return;
    setCategorizing(true);
    try {
      const { data, error } = await supabase.functions.invoke("categorize-transaction", {
        body: { description: description.trim() },
      });
      if (!error && data?.category) {
        setForm((prev) => ({ ...prev, category: data.category }));
      }
    } catch {
      // silently fail — user can pick manually
    }
    setCategorizing(false);
  }, [editId]);

  const resetForm = () => {
    setForm({ description: "", amount: "", category: "", date: format(new Date(), "yyyy-MM-dd"), type: "expense", recurringFrequency: "none" });
    setEditId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextDate = form.recurringFrequency !== "none" ? form.date : null;
    const payload = {
      description: form.description.trim(),
      amount: parseFloat(form.amount),
      category: form.category || null,
      date: form.date,
      type: form.type as "income" | "expense",
      recurring_frequency: form.recurringFrequency as "none" | "weekly" | "monthly" | "yearly",
      next_recurrence_date: nextDate,
    };

    if (editId) {
      updateTransaction.mutate({ id: editId, ...payload }, { onSuccess: () => { setDialogOpen(false); resetForm(); } });
    } else {
      addTransaction.mutate(payload, { onSuccess: () => { setDialogOpen(false); resetForm(); } });
    }
  };

  const handleEdit = (tx: typeof transactions[0]) => {
    setEditId(tx.id);
    setForm({
      description: tx.description,
      amount: String(tx.amount),
      category: tx.category || "",
      date: tx.date,
      type: tx.type,
      recurringFrequency: tx.recurring_frequency || "none",
    });
    setDialogOpen(true);
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.trim().split("\n");
    if (lines.length < 2) { toast.error("CSV file is empty"); return; }

    const headers = lines[0].toLowerCase().split(",").map((h) => h.trim());
    const dateIdx = headers.findIndex((h) => h.includes("date"));
    const descIdx = headers.findIndex((h) => h.includes("description") || h.includes("memo") || h.includes("narrative"));
    const amountIdx = headers.findIndex((h) => h.includes("amount"));

    if (dateIdx === -1 || amountIdx === -1) {
      toast.error("CSV must have 'date' and 'amount' columns");
      return;
    }

    let imported = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const amount = parseFloat(cols[amountIdx]);
      if (isNaN(amount)) continue;

      const dateStr = cols[dateIdx];
      const description = descIdx >= 0 ? cols[descIdx] : `Import line ${i}`;
      const type = amount >= 0 ? "income" : "expense";

      const { error } = await supabase.from("transactions").insert({
        user_id: user!.id,
        amount: Math.abs(amount),
        description,
        date: dateStr,
        type,
      });
      if (!error) imported++;
    }

    toast.success(`Imported ${imported} transactions`);
    if (fileRef.current) fileRef.current.value = "";
    // Refetch
    window.location.reload();
  };

  const filtered = transactions.filter((tx) => {
    if (searchQuery && !tx.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterCategory !== "all" && tx.category !== filterCategory) return false;
    if (filterType !== "all" && tx.type !== filterType) return false;
    return true;
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-3xl font-bold">Transactions</h1>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Import CSV
            </Button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="h-4 w-4" /> Add Transaction</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-display">{editId ? "Edit" : "Add"} Transaction</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>Description</Label>
                    <Input
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      onBlur={(e) => autoCategorize(e.target.value)}
                      required
                      placeholder="e.g. Grocery shopping at Lidl"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Amount (€)</Label>
                      <Input type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                    </div>
                    <div>
                      <Label>Type</Label>
                      <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as "income" | "expense" })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="expense">Expense</SelectItem>
                          <SelectItem value="income">Income</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Date</Label>
                      <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                    </div>
                    <div>
                      <Label>Category {categorizing && <span className="text-xs text-muted-foreground">(AI suggesting…)</span>}</Label>
                      <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                        <SelectTrigger><SelectValue placeholder={categorizing ? "Categorizing…" : "Select"} /></SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.name}>{c.icon} {c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={addTransaction.isPending || updateTransaction.isPending}>
                    {editId ? "Update" : "Add"} Transaction
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 p-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.name}>{c.icon} {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Transaction List */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground">No transactions found</p>
            ) : (
              <div className="divide-y">
                {filtered.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{CATEGORY_ICONS[tx.category || "Other"] || "📦"}</span>
                      <div>
                        <p className="text-sm font-medium">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {tx.category || "Uncategorized"} · {format(new Date(tx.date), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-semibold ${tx.type === "income" ? "text-success" : "text-destructive"}`}>
                        {tx.type === "income" ? "+" : "-"}€{Number(tx.amount).toFixed(2)}
                      </span>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(tx)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteTransaction.mutate(tx.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
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
