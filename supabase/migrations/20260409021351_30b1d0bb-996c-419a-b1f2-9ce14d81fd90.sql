ALTER TABLE public.transactions
  ADD COLUMN currency TEXT NOT NULL DEFAULT 'EUR';