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
import { Plus, Upload, Pencil, Trash2, Search, Repeat, Download, FileText } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { SUPPORTED_CURRENCIES, getCurrencySymbol } from "@/lib/currency";

const CATEGORY_ICONS: Record<string, string> = {
  Food: "🍔", Transport: "🚗", Housing: "🏠", Entertainment: "🎬",
  Health: "💊", Shopping: "🛍️", Utilities: "💡", Other: "📦",
};

export default function Transactions() {
  const { data: transactions = [], isLoading, addTransaction, updateTransaction, deleteTransaction } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const defaultCurrency = profile?.currency || "EUR";
  const fileRef = useRef<HTMLInputElement>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [categorizing, setCategorizing] = useState(false);
  const [form, setForm] = useState({
    description: "", amount: "", category: "", date: format(new Date(), "yyyy-MM-dd"), type: "expense" as "income" | "expense",
    recurringFrequency: "none" as "none" | "weekly" | "monthly" | "yearly",
    currency: defaultCurrency,
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
    setForm({ description: "", amount: "", category: "", date: format(new Date(), "yyyy-MM-dd"), type: "expense", recurringFrequency: "none", currency: defaultCurrency });
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
      currency: form.currency,
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
      currency: (tx as any).currency || defaultCurrency,
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

  const exportCSV = () => {
    const headers = ["Date", "Description", "Category", "Type", "Amount", "Recurring"];
    const rows = filtered.map((tx) => [
      tx.date,
      `"${tx.description}"`,
      tx.category || "Uncategorized",
      tx.type,
      (tx.type === "expense" ? "-" : "") + Number(tx.amount).toFixed(2),
      tx.recurring_frequency || "none",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const exportPDF = () => {
    const win = window.open("", "_blank");
    if (!win) { toast.error("Please allow popups"); return; }

    const totalIncome = filtered.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const totalExpenses = filtered.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

    win.document.write(`<!DOCTYPE html><html><head><title>Transaction Report</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #1a1a2e; }
        h1 { color: #1e40af; margin-bottom: 4px; }
        .subtitle { color: #6b7280; margin-bottom: 24px; }
        .summary { display: flex; gap: 24px; margin-bottom: 24px; }
        .summary-card { padding: 12px 20px; border-radius: 8px; }
        .income { background: #ecfdf5; color: #16a34a; }
        .expense { background: #fef2f2; color: #dc2626; }
        .balance { background: #eff6ff; color: #1e40af; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 8px 12px; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-size: 12px; text-transform: uppercase; }
        td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
        .amount-income { color: #16a34a; font-weight: 600; }
        .amount-expense { color: #dc2626; font-weight: 600; }
        @media print { body { padding: 20px; } }
      </style>
    </head><body>
      <h1>Transaction Report</h1>
      <p class="subtitle">Generated on ${format(new Date(), "MMMM d, yyyy")} · ${filtered.length} transactions</p>
      <div class="summary">
        <div class="summary-card income"><strong>Income:</strong> €${totalIncome.toFixed(2)}</div>
        <div class="summary-card expense"><strong>Expenses:</strong> €${totalExpenses.toFixed(2)}</div>
        <div class="summary-card balance"><strong>Balance:</strong> €${(totalIncome - totalExpenses).toFixed(2)}</div>
      </div>
      <table>
        <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Type</th><th>Amount</th></tr></thead>
        <tbody>
          ${filtered.map((tx) => `<tr>
            <td>${format(new Date(tx.date), "MMM d, yyyy")}</td>
            <td>${tx.description}</td>
            <td>${tx.category || "Uncategorized"}</td>
            <td>${tx.type}</td>
            <td class="amount-${tx.type}">${tx.type === "income" ? "+" : "-"}€${Number(tx.amount).toFixed(2)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-3xl font-bold">Transactions</h1>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={exportCSV}>
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" className="gap-2" onClick={exportPDF}>
              <FileText className="h-4 w-4" /> PDF
            </Button>
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
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Amount</Label>
                      <Input type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                    </div>
                    <div>
                      <Label>Currency</Label>
                      <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SUPPORTED_CURRENCIES.map((c) => (
                            <SelectItem key={c} value={c}>{getCurrencySymbol(c)} {c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                  <div>
                    <Label>Recurring</Label>
                    <Select value={form.recurringFrequency} onValueChange={(v) => setForm({ ...form, recurringFrequency: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">One-time</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
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
                        <p className="flex items-center gap-1 text-sm font-medium">
                          {tx.description}
                          {tx.recurring_frequency && tx.recurring_frequency !== "none" && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              <Repeat className="h-2.5 w-2.5" /> {tx.recurring_frequency}
                            </span>
                          )}
                        </p>
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
