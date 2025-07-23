-- Enable Row Level Security on publicly exposed tables
ALTER TABLE public.critical_minerals_end_use ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salient_commodity_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.net_import_reliance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_growth_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.critical_materials_salient ENABLE ROW LEVEL SECURITY;

-- Alter views to use SECURITY INVOKER instead of SECURITY DEFINER
-- This ensures queries run with the permissions of the user, not the creator.
ALTER VIEW public.threads_view SET (security_invoker = true);
ALTER VIEW public.data_quality_overview SET (security_invoker = true);
ALTER VIEW public.document_summaries SET (security_invoker = true);
ALTER VIEW public.material_anomalies SET (security_invoker = true);
ALTER VIEW public.material_opportunities SET (security_invoker = true);
ALTER VIEW public.dashboard_kpis SET (security_invoker = true);
