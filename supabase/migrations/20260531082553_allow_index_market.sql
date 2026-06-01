-- Allow benchmark indices (e.g. ^GSPC, ^IXIC, ^AXJO, ^GSPTSE) to be stored as
-- price-only rows with market='index', used by the Relative Performance chart.
ALTER TABLE public.stocks DROP CONSTRAINT valid_market;
ALTER TABLE public.stocks
  ADD CONSTRAINT valid_market CHECK (market = ANY (ARRAY['us'::text, 'au'::text, 'ca'::text, 'index'::text]));
