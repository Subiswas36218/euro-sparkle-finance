import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface CategoryBudget {
  id: string;
  user_id: string;
  category: string;
  limit_amount: number;
  created_at: string;
  updated_at: string;
}

export function useCategoryBudgets() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["category_budgets", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("category_budgets" as any)
        .select("*")
        .order("category");
      if (error) throw error;
      return data as unknown as CategoryBudget[];
    },
    enabled: !!user,
  });

  const upsertBudget = useMutation({
    mutationFn: async ({ category, limit_amount }: { category: string; limit_amount: number }) => {
      const { error } = await supabase
        .from("category_budgets" as any)
        .upsert(
          { user_id: user!.id, category, limit_amount } as any,
          { onConflict: "user_id,category" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category_budgets"] });
      toast.success("Category budget saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteBudget = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("category_budgets" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category_budgets"] });
      toast.success("Category budget removed");
    },
    onError: (e) => toast.error(e.message),
  });

  return { ...query, upsertBudget, deleteBudget };
}
