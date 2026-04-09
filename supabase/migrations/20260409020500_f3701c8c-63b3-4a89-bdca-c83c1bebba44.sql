
-- Create recurring frequency enum
CREATE TYPE public.recurring_frequency AS ENUM ('none', 'weekly', 'monthly', 'yearly');

-- Add recurring fields to transactions
ALTER TABLE public.transactions
  ADD COLUMN recurring_frequency public.recurring_frequency NOT NULL DEFAULT 'none',
  ADD COLUMN next_recurrence_date DATE;

-- Enable extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create function to process recurring transactions
CREATE OR REPLACE FUNCTION public.process_recurring_transactions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  new_date DATE;
BEGIN
  FOR rec IN
    SELECT * FROM public.transactions
    WHERE recurring_frequency != 'none'
      AND next_recurrence_date IS NOT NULL
      AND next_recurrence_date <= CURRENT_DATE
  LOOP
    -- Insert new transaction copy
    INSERT INTO public.transactions (user_id, amount, description, category, date, type, recurring_frequency, next_recurrence_date)
    VALUES (
      rec.user_id,
      rec.amount,
      rec.description,
      rec.category,
      rec.next_recurrence_date,
      rec.type,
      'none', -- the copy is not recurring itself
      NULL
    );

    -- Calculate next recurrence date
    CASE rec.recurring_frequency
      WHEN 'weekly' THEN new_date := rec.next_recurrence_date + INTERVAL '7 days';
      WHEN 'monthly' THEN new_date := rec.next_recurrence_date + INTERVAL '1 month';
      WHEN 'yearly' THEN new_date := rec.next_recurrence_date + INTERVAL '1 year';
      ELSE new_date := NULL;
    END CASE;

    -- Update the source recurring transaction's next date
    UPDATE public.transactions
    SET next_recurrence_date = new_date
    WHERE id = rec.id;
  END LOOP;
END;
$$;
