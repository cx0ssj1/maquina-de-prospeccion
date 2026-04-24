# CLAUDE.md — Máquina de Prospección B2B

## Descripción del Proyecto
Sistema automatizado de prospección B2B que busca leads en Apollo.io, los enriquece con datos de LinkedIn (HarvestAPI/Apify), y luego los pasa por agentes de IA para generar outreach personalizado (emails, mensajes LinkedIn, cold calls, pitches).

## Arquitectura General
```
Formulario HTML → Supabase (solicitudes_leads) → n8n Webhook → Apollo Search → Apollo Match
→ Supabase (leads) → LinkedIn Scraping → Supabase (leads_linkedin) → Combinar datos
→ Supabase (leads_agentes) → Workflow 2: Agentes IA → Supabase (update leads_agentes)
```

### Workflows
- **Workflow 1** (ID: `weFLf4PncCNyL0xA`): Búsqueda y enriquecimiento de leads (Apollo + LinkedIn) — ESTE ARCHIVO
- **Workflow 2** (ID: `XhmcWgNU92N5tYsX`): Agentes IA que analizan leads y generan outreach — POR CONSTRUIR

---

## Infraestructura

### n8n
- **URL**: `https://n8n.srv1490885.hstgr.cloud/`
- **Workflow 1 ID**: `weFLf4PncCNyL0xA` (Apollo - Máquina de Prospección v3)
- **Workflow 2 ID**: `XhmcWgNU92N5tYsX` (Sprint 1 Agentes - sin credenciales)

### Supabase
- **Project ID**: `azqtuvgtmmswvqgyrvct`
- **URL**: `https://azqtuvgtmmswvqgyrvct.supabase.co`
- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6cXR1dmd0bW1zd3ZxZ3lydmN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NTQ4NjEsImV4cCI6MjA5MTUzMDg2MX0.YRPD8A5SUcJt0EG7tZU-Q9EUzx8RT5RwbRe_jCVO-OQ`
- **RLS**: insert anónimo permitido, service role full access, public read

### APIs Externas
- **Apollo API Key**: `APOLLO_KEY_PLACEHOLDER` (Basic plan, Master Key)
- **Apify (HarvestAPI) Token**: `APIFY_TOKEN_PLACEHOLDER`
- **Google Sheets** (DEPRECATED - migrado a Supabase):
  - Spreadsheet ID: `1mMxMmn7NIdAgXaiZGB3N3bnPaaGwfWIbnPTO5m8YtbQ`
  - Credential ID: `SxrPxWANnuMpDpIa`

---

## API Findings Críticos (descubiertos por trial & error)

### Apollo API
- **Working search**: `POST api/v1/mixed_people/api_search` — params en URL query string, NO en body
- **Working enrich**: `POST api/v1/people/match` con `{"id": "...", "reveal_personal_emails": false}`
- **DEPRECATED**: `mixed_people/search` (422), `people/bulk_match` (422)
- **Industry filter** (`organization_industry_tag_ids`) NO funciona en plan Basic — requiere MongoDB ObjectIDs
- **Working filters**: `person_titles[]`, `person_seniorities[]`, `person_departments[]`, `person_locations[]`, `per_page`, `q_organization_name`, `organization_num_employees_ranges[]`

### Apify HarvestAPI
- **Actor correcto**: `harvestapi~linkedin-profile-scraper`
- **Input correcto**: `publicIdentifiers` (NOT `profileUrls` ni `profilePublicIdentifiers`)
- **Apollo devuelve `http://`** en LinkedIn URLs — DEBE convertirse a `https://www.linkedin.com/in/...`

---

## Modelo de Base de Datos (MER)

### Relaciones
```
organizaciones 1──∞ solicitudes_leads 1──∞ leads 1──1 leads_linkedin
                                              └── 1──1 leads_agentes
organizaciones 1──∞ leads (empresa del lead)
```

### Lógica de Negocio
- Una **organización** (ej: Lemusse) es el cliente que solicita leads. Existe UNA vez en la tabla.
- Cada **solicitud** es una búsqueda independiente (ej: "buscar Gerentes de Operaciones en Chile"). Una organización puede tener N solicitudes.
- Cada solicitud genera N **leads** (personas encontradas por Apollo).
- Cada lead tiene **una** entrada en `leads_linkedin` (datos scrapeados) y **una** en `leads_agentes` (outputs de IA).
- El campo `organizacion_id` en `leads` es la FK a la empresa DONDE TRABAJA el lead (no la empresa solicitante).

### Tabla: organizaciones (7 columnas)
```sql
id              uuid PK DEFAULT gen_random_uuid()
nombre          text NOT NULL UNIQUE
website         text
industria       text
pais            text
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```

### Tabla: solicitudes_leads (29 columnas)
```sql
id                  uuid PK DEFAULT gen_random_uuid()
organizacion_id     uuid FK → organizaciones(id)
nombre_completo     text NOT NULL
email_corporativo   text NOT NULL
organizacion        text NOT NULL
cantidad_leads      int DEFAULT 25
max_results         int DEFAULT 25
solucion            text
problema_resuelve   text
casos_exito         text
diferenciador       text
job_titles          text[] DEFAULT '{}'
include_similar     bool DEFAULT false
titulos_adicionales text[] DEFAULT '{}'
seniority           text[] DEFAULT '{}'
departments         text[] DEFAULT '{}'
person_country      text
company_name        text
company_country     text
company_city        text
employee_min        int
employee_max        int
industry            text
keywords            text[] DEFAULT '{}'
status              text DEFAULT 'pending' CHECK (pending|processing|completed|error)
error_message       text
leads_found         int DEFAULT 0
processed_at        timestamptz
created_at          timestamptz DEFAULT now()
```

### Tabla: leads (30 columnas)
```sql
id                    uuid PK DEFAULT gen_random_uuid()
solicitud_id          uuid FK → solicitudes_leads(id) ON DELETE CASCADE
organizacion_id       uuid FK → organizaciones(id)
apollo_id             text UNIQUE
nombre                text
apellido              text
nombre_completo       text GENERATED ALWAYS AS (nombre || ' ' || apellido) STORED
cargo                 text              -- título/cargo
headline              text
seniority             text
departamentos         text
linkedin_url          text
email                 text
email_status          text
telefono              text
direccion             text              -- dirección completa
ciudad                text
estado_region         text
pais                  text
foto_url              text
empresa               text              -- nombre organización del lead
industria_empresa     text
tamano_empresa        int
website_empresa       text
linkedin_empresa      text
org_keywords          text[]            -- keywords del sitio web empresa
org_short_description text              -- descripción corta compañía
org_technology_names  text[]            -- tecnologías que usa la empresa
fecha_busqueda        date DEFAULT CURRENT_DATE
created_at            timestamptz DEFAULT now()
```

### Tabla: leads_linkedin (20 columnas)
```sql
id                  uuid PK DEFAULT gen_random_uuid()
lead_id             uuid UNIQUE FK → leads(id) ON DELETE CASCADE
linkedin_public_id  text              -- ej: juan-perez-123
linkedin_location   text
headline            text
summary             text
experiencia         text              -- top 5 experiencias concatenadas
educacion           text              -- top 3 educaciones concatenadas
skills              text
ubicacion           text
conexiones          int
seguidores          int
open_to_work        bool DEFAULT false
courses             text
hiring              bool DEFAULT false
current_position    text              -- cargo actual según LinkedIn
projects            text
publications        text
recent_news         text
scraped_at          timestamptz DEFAULT now()
```

### Tabla: leads_agentes (39 columnas)
```sql
id                      uuid PK DEFAULT gen_random_uuid()
lead_id                 uuid UNIQUE FK → leads(id) ON DELETE CASCADE
perfil_para_agente      text        -- texto estructurado con todos los datos para el agente

-- Score
score                   float
score_justificacion     text

-- Research
research_output         text

-- Análisis de personalidad
personality_traits      text
behavior_summary        text
communication_guide     text
energy_drivers          text
disc_type               text        -- D/I/S/C

-- Dolor y match
declaraciones_problemas text        -- problemas como el cliente los hablaría
match_reason            text
variables_dolor         text
problema_causa          text
consecuencia            text
solucion                text
prueba_social           text
selected_pain_id        text
motor_hipotesis         text

-- Outreach generado
linkedin_mensaje        text
linkedin_msg            text        -- (legacy, mantener por compatibilidad)
pitch_comercial_1       text
pitch_comercial_2       text
cold_email_1            text
cold_email_2            text
cold_call_1             text
cold_call_2             text
secuencia_email_2       text
secuencia_email_3       text
secuencia_email_4       text

-- Otros
email_generado          text
email_subject           text
talking_points          text
extraccion              text

-- Control
status                  text DEFAULT 'pending' CHECK (pending|processing|completed|error)
error_message           text
processed_at            timestamptz
created_at              timestamptz DEFAULT now()
```

---

## Workflow 1: Flujo de Nodos (14 nodos)

```
Formulario GHL1 (webhook POST)
  → Preparar1 (code: upsert org + insert solicitud + build Apollo URL)
    → HTTP Request1 (POST Apollo api_search con URL dinámica)
      → Split Out (split people[])
        → Apollo Match1 (POST people/match por cada lead)
          → Merge1 (combine)
            → Procesar Datos Apollo (code: aplanar person{}, fix URLs, INSERT leads en Supabase)
              → Loop por Lead1 (batch 5) ──→ Combinar Apollo + LinkedIn1 (merge por Apollo ID)
              └→ LinkedIn url's1 (code: fix http→https, extraer publicIdentifier)
                  → Run HarvestAPI1 (POST Apify harvestapi~linkedin-profile-scraper)
                    → Code in JavaScript (parsear LinkedIn data, INSERT leads_linkedin en Supabase)
                      → Loop por Lead1 (loop back)
                      → Combinar Apollo + LinkedIn1 (input 2)
                          → Preparar Data para Agentes1 (generar perfilParaAgente, INSERT leads_agentes, UPDATE solicitud→completed)
                            → Enriquecer Lead (Paralelo)1 (Execute Workflow → XhmcWgNU92N5tYsX)
```

### Nodos eliminados (migrados a Supabase)
- ~~Copy file1~~ (Google Drive)
- ~~Edit Fields1~~ (Set)
- ~~Send a message1~~ (Gmail)
- ~~Info Apollo1~~ (Google Sheets append) → ahora INSERT en `leads` dentro de `Procesar Datos Apollo`
- ~~Info LinkedIn1~~ (Google Sheets update) → ahora INSERT en `leads_linkedin` dentro de `Code in JavaScript`

---

## Formulario HTML

El formulario web (`formulario-prospeccion.html`) hace:
1. POST a `/rest/v1/organizaciones` con `Prefer: resolution=merge-duplicates` (upsert)
2. POST a `/rest/v1/solicitudes_leads` con `organizacion_id` del paso anterior
3. El webhook de n8n detecta el nuevo registro y lo procesa

### Campos del formulario
- **Sección 1**: nombre_completo, email_corporativo, organizacion, cantidad_leads
- **Sección 2**: solucion, problema_resuelve, casos_exito, diferenciador
- **Sección 3**: job_titles (checkbox grid + custom tags), include_similar, titulos_adicionales, seniority (pill select), departments (pill select)
- **Sección 4**: person_country
- **Sección 5**: company_name
- **Sección 6**: company_country, company_city
- **Sección 7**: employee_min, employee_max
- **Sección 8**: industry, keywords (tags)

---

## Workflow 2: Agentes IA (POR CONSTRUIR)

El workflow 2 recibe cada lead con `perfilParaAgente` y debe:

### Agente 1: Investigador
- Analizar el perfil completo (Apollo + LinkedIn)
- Generar: personality_traits, behavior_summary, communication_guide, energy_drivers, disc_type
- Buscar recent_news sobre la persona/empresa

### Agente 2: Analista de Dolor
- Basado en: perfil del lead + contexto del solicitante (solución, problema, diferenciador)
- Generar: declaraciones_problemas, match_reason, variables_dolor, problema_causa, consecuencia, solucion, prueba_social
- Seleccionar: selected_pain_id, motor_hipotesis

### Agente 3: Copywriter
- Basado en: perfil + análisis de dolor + personalidad
- Generar: linkedin_mensaje, pitch_comercial_1, pitch_comercial_2
- Generar: cold_email_1, cold_email_2, cold_call_1, cold_call_2
- Generar: secuencia_email_2, secuencia_email_3, secuencia_email_4

### Agente 4: Scorer
- Score final (0-100) con justificación
- extraccion (resumen ejecutivo del lead)

---

## Archivos del Proyecto

```
/workflow-v3-supabase-final.json    — Workflow 1 completo (importar en n8n)
/index.html         — Formulario web (deploy estático)
/CLAUDE.md                           — Este archivo (contexto completo)
/database-schema.sql                 — DDL completo de las 5 tablas
```

---

## Convenciones

- **Supabase REST API**: Todos los inserts/updates se hacen via HTTP desde n8n Code nodes, usando el anon key
- **Headers Supabase**: `apikey`, `Authorization: Bearer`, `Content-Type: application/json`, `Prefer: return=representation`
- **Upsert organizaciones**: `Prefer: return=representation,resolution=merge-duplicates`
- **LinkedIn URLs**: Siempre convertir `http://` → `https://www.linkedin.com/in/...`
- **Apollo**: Params en URL query string, NO en body. Header `x-api-key`
- **HarvestAPI**: Input es `publicIdentifiers` (array de strings), timeout 120s

## Estado Actual
- ✅ Workflow 1 completo con Supabase (sin Google Sheets)
- ✅ Formulario HTML conectado a Supabase
- ✅ Base de datos con 5 tablas y 125+ columnas
- ✅ MER diseñado con relaciones correctas
- ⏳ Workflow 2 (Agentes IA) por construir
- ⏳ Dashboard de monitoreo por construir
