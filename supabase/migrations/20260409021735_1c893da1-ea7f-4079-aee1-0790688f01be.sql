CREATE TABLE public.category_budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category TEXT NOT NULL,
  limit_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, category)
);

ALTER TABLE public.category_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own category budgets"
  ON public.category_budgets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own category budgets"
  ON public.category_budgets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own category budgets"
  ON public.category_budgets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own category budgets"
  ON public.category_budgets FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_category_budgets_updated_at
  BEFORE UPDATE ON public.category_budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();