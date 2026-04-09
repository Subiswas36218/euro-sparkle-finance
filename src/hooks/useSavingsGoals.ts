import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  icon: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export function useSavingsGoals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["savings_goals", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("savings_goals" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as SavingsGoal[];
    },
    enabled: !!user,
  });

  const addGoal = useMutation({
    mutationFn: async (goal: Omit<SavingsGoal, "id" | "user_id" | "created_at" | "updated_at">) => {
      const { error } = await supabase
        .from("savings_goals" as any)
        .insert({ ...goal, user_id: user!.id } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings_goals"] });
      toast.success("Goal created");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateGoal = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SavingsGoal> & { id: string }) => {
      const { error } = await supabase
        .from("savings_goals" as any)
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings_goals"] });
      toast.success("Goal updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteGoal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("savings_goals" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings_goals"] });
      toast.success("Goal deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  return { ...query, addGoal, updateGoal, deleteGoal };
}
