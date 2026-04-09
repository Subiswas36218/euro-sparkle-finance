import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProfile } from "@/hooks/useProfile";
import { useCategories } from "@/hooks/useCategories";
import { useCategoryBudgets } from "@/hooks/useCategoryBudgets";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Save, Loader2, Plus, Trash2 } from "lucide-react";
import { getCurrencySymbol } from "@/lib/currency";

const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK"];

export default function Settings() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const { data: categories = [] } = useCategories();
  const { data: categoryBudgets = [], upsertBudget, deleteBudget } = useCategoryBudgets();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [monthlyBudget, setMonthlyBudget] = useState("");
  const [saving, setSaving] = useState(false);

  // Category budget form
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categoryLimit, setCategoryLimit] = useState("");

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setCurrency(profile.currency);
      setMonthlyBudget(String(profile.monthly_budget ?? ""));
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || null,
        currency,
        monthly_budget: monthlyBudget ? parseFloat(monthlyBudget) : null,
      })
      .eq("user_id", user.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Settings saved!");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    }
    setSaving(false);
  };

  const handleAddCategoryBudget = () => {
    if (!selectedCategory || !categoryLimit) {
      toast.error("Select a category and enter a limit");
      return;
    }
    upsertBudget.mutate(
      { category: selectedCategory, limit_amount: parseFloat(categoryLimit) },
      {
        onSuccess: () => {
          setSelectedCategory("");
          setCategoryLimit("");
        },
      }
    );
  };

  const sym = getCurrencySymbol(currency);

  // Categories that don't have a budget yet
  const availableCategories = categories.filter(
    (c) => !categoryBudgets.some((b) => b.category === c.name)
  );

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
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="font-display text-3xl font-bold">Settings</h1>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">Profile</CardTitle>
            <CardDescription>Update your personal information and preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user?.email || ""} disabled className="bg-muted" />
                <p className="mt-1 text-xs text-muted-foreground">Email cannot be changed</p>
              </div>

              <div>
                <Label htmlFor="display-name">Display Name</Label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  maxLength={100}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="budget">Monthly Budget</Label>
                  <Input
                    id="budget"
                    type="number"
                    step="0.01"
                    min="0"
                    value={monthlyBudget}
                    onChange={(e) => setMonthlyBudget(e.target.value)}
                    placeholder="2000.00"
                  />
                </div>
              </div>

              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Changes
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Category Spending Limits */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Category Spending Limits</CardTitle>
            <CardDescription>Set alerts when spending in a category exceeds your limit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing limits */}
            {categoryBudgets.length > 0 && (
              <div className="space-y-2">
                {categoryBudgets.map((b) => {
                  const cat = categories.find((c) => c.name === b.category);
                  return (
                    <div key={b.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{cat?.icon || "📦"}</span>
                        <span className="text-sm font-medium">{b.category}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold">{sym}{Number(b.limit_amount).toFixed(2)}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteBudget.mutate(b.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add new limit */}
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label>Category</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((c) => (
                      <SelectItem key={c.id} value={c.name}>{c.icon} {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-32">
                <Label>Limit ({sym})</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={categoryLimit}
                  onChange={(e) => setCategoryLimit(e.target.value)}
                  placeholder="200"
                />
              </div>
              <Button
                onClick={handleAddCategoryBudget}
                disabled={upsertBudget.isPending}
                className="gap-1"
              >
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>

            {categoryBudgets.length === 0 && (
              <p className="text-sm text-muted-foreground">No category limits set yet. Add one above to get spending alerts on your dashboard.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
