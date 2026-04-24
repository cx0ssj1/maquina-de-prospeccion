-- =============================================
-- MÁQUINA DE PROSPECCIÓN B2B
-- DDL Completo — 5 tablas
-- Supabase Project: azqtuvgtmmswvqgyrvct
-- =============================================

-- 1. ORGANIZACIONES
CREATE TABLE IF NOT EXISTS public.organizaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  website text,
  industria text,
  pais text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizaciones_nombre_unique UNIQUE (nombre)
);
CREATE INDEX IF NOT EXISTS idx_organizaciones_nombre ON public.organizaciones(nombre);
ALTER TABLE public.organizaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_read" ON public.organizaciones FOR SELECT USING (true);
CREATE POLICY "org_insert" ON public.organizaciones FOR INSERT WITH CHECK (true);
CREATE POLICY "org_update" ON public.organizaciones FOR UPDATE USING (true);

-- 2. SOLICITUDES_LEADS
CREATE TABLE IF NOT EXISTS public.solicitudes_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  organizacion_id uuid REFERENCES public.organizaciones(id),
  nombre_completo text NOT NULL,
  email_corporativo text NOT NULL,
  organizacion text NOT NULL,
  cantidad_leads int DEFAULT 25,
  max_results int DEFAULT 25,
  solucion text,
  problema_resuelve text,
  casos_exito text,
  diferenciador text,
  job_titles text[] DEFAULT '{}',
  include_similar bool DEFAULT false,
  titulos_adicionales text[] DEFAULT '{}',
  seniority text[] DEFAULT '{}',
  departments text[] DEFAULT '{}',
  person_country text,
  company_name text,
  company_country text,
  company_city text,
  employee_min int,
  employee_max int,
  industry text,
  keywords text[] DEFAULT '{}',
  status text DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','error')),
  error_message text,
  leads_found int DEFAULT 0,
  processed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_solicitudes_org ON public.solicitudes_leads(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_status ON public.solicitudes_leads(status, created_at);
ALTER TABLE public.solicitudes_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sol_read" ON public.solicitudes_leads FOR SELECT USING (true);
CREATE POLICY "sol_insert" ON public.solicitudes_leads FOR INSERT WITH CHECK (true);
CREATE POLICY "sol_update" ON public.solicitudes_leads FOR UPDATE USING (true);

-- 3. LEADS
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id uuid NOT NULL REFERENCES public.solicitudes_leads(id) ON DELETE CASCADE,
  organizacion_id uuid REFERENCES public.organizaciones(id),
  apollo_id text UNIQUE,
  nombre text,
  apellido text,
  nombre_completo text GENERATED ALWAYS AS (COALESCE(nombre,'') || ' ' || COALESCE(apellido,'')) STORED,
  cargo text,
  headline text,
  seniority text,
  departamentos text,
  linkedin_url text,
  email text,
  email_status text,
  telefono text,
  direccion text,
  ciudad text,
  estado_region text,
  pais text,
  foto_url text,
  empresa text,
  industria_empresa text,
  tamano_empresa int,
  website_empresa text,
  linkedin_empresa text,
  org_keywords text[],
  org_short_description text,
  org_technology_names text[],
  fecha_busqueda date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leads_solicitud ON public.leads(solicitud_id);
CREATE INDEX IF NOT EXISTS idx_leads_apollo ON public.leads(apollo_id);
CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_empresa ON public.leads(empresa);
CREATE INDEX IF NOT EXISTS idx_leads_org ON public.leads(organizacion_id);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads_read" ON public.leads FOR SELECT USING (true);
CREATE POLICY "leads_insert" ON public.leads FOR INSERT WITH CHECK (true);
CREATE POLICY "leads_update" ON public.leads FOR UPDATE USING (true);

-- 4. LEADS_LINKEDIN
CREATE TABLE IF NOT EXISTS public.leads_linkedin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,
  linkedin_public_id text,
  linkedin_location text,
  headline text,
  summary text,
  experiencia text,
  educacion text,
  skills text,
  ubicacion text,
  conexiones int,
  seguidores int,
  open_to_work bool DEFAULT false,
  courses text,
  hiring bool DEFAULT false,
  current_position text,
  projects text,
  publications text,
  recent_news text,
  scraped_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_li_lead ON public.leads_linkedin(lead_id);
ALTER TABLE public.leads_linkedin ENABLE ROW LEVEL SECURITY;
CREATE POLICY "li_read" ON public.leads_linkedin FOR SELECT USING (true);
CREATE POLICY "li_insert" ON public.leads_linkedin FOR INSERT WITH CHECK (true);
CREATE POLICY "li_update" ON public.leads_linkedin FOR UPDATE USING (true);

-- 5. LEADS_AGENTES
CREATE TABLE IF NOT EXISTS public.leads_agentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,
  perfil_para_agente text,
  -- Score
  score float,
  score_justificacion text,
  -- Research
  research_output text,
  -- Personalidad
  personality_traits text,
  behavior_summary text,
  communication_guide text,
  energy_drivers text,
  disc_type text,
  -- Dolor
  declaraciones_problemas text,
  match_reason text,
  variables_dolor text,
  problema_causa text,
  consecuencia text,
  solucion text,
  prueba_social text,
  selected_pain_id text,
  motor_hipotesis text,
  -- Outreach
  linkedin_mensaje text,
  linkedin_msg text,
  pitch_comercial_1 text,
  pitch_comercial_2 text,
  cold_email_1 text,
  cold_email_2 text,
  cold_call_1 text,
  cold_call_2 text,
  secuencia_email_2 text,
  secuencia_email_3 text,
  secuencia_email_4 text,
  -- Otros
  email_generado text,
  email_subject text,
  talking_points text,
  extraccion text,
  -- Control
  status text DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','error')),
  error_message text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ag_lead ON public.leads_agentes(lead_id);
CREATE INDEX IF NOT EXISTS idx_ag_status ON public.leads_agentes(status);
ALTER TABLE public.leads_agentes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ag_read" ON public.leads_agentes FOR SELECT USING (true);
CREATE POLICY "ag_insert" ON public.leads_agentes FOR INSERT WITH CHECK (true);
CREATE POLICY "ag_update" ON public.leads_agentes FOR UPDATE USING (true);
