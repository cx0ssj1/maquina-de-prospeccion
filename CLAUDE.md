# CLAUDE.md — Máquina de Prospección B2B

> Contexto exhaustivo del proyecto. Léelo antes de tocar workflow, formulario, base de datos o agentes.

---

## 1. Visión del Producto

Sistema automatizado de prospección B2B que:

1. Recibe del cliente (un usuario humano que vende algo) una **solicitud** describiendo a quién quiere prospectar (cargo, país, empresa) y qué ofrece (solución, problema que resuelve, diferenciador).
2. Busca **leads** (personas reales) en **Apollo.io** usando esos filtros, con expansión automática de sinónimos de cargos para evitar fallos por nomenclatura.
3. **Enriquece** cada lead con datos de **LinkedIn** vía HarvestAPI (Apify): experiencia, educación, skills, posts recientes, publicaciones.
4. Pasa cada lead por una **cadena de 6 agentes IA (Anthropic Claude)** que generan: análisis de personalidad DISC, dolores comerciales, motor de compra, estrategia de outreach, copy (LinkedIn, emails, cold calls, pitches), score de calidad y extracción ejecutiva para el vendedor.
5. Persiste todo en **Supabase** y se visualiza vía dashboard web (`leads.html`).


---

## 2. Estado Actual

| Componente | Estado |
|---|---|
| Formulario web (`index.html`) | ✅ Producción |
| Workflow n8n único (54 nodos) | ✅ Producción |
| Base de datos Supabase (5 tablas) | ✅ Producción |
| Dashboard de leads (`leads.html`) | ✅ Producción |
| RLS policies (incluye DELETE anon) | ✅ Aplicadas |
| Cadena de 6 agentes IA con dual-model | ✅ Producción |
| Phone reveal (Apollo) | ✅ Aplicadas |

---

## 3. Infraestructura

### n8n
- URL: `https://n8n.srv1490885.hstgr.cloud/`
- Workflow ID activo: `weFLf4PncCNyL0xA`
- Archivo fuente local: `workflow-server-full.json` (54 nodos, todo en uno)

### Supabase
- Project ID: `azqtuvgtmmswvqgyrvct`
- URL: `https://azqtuvgtmmswvqgyrvct.supabase.co`
- Anon Key: en formulario y dashboard (RLS controla acceso). Service Role: solo lado n8n.
- RLS: anon puede insert/update/select/delete en las 5 tablas. service_role full access.
- Cascade DELETE: `leads → leads_linkedin, leads_agentes` (al borrar el lead se borran hijos).

### APIs externas
- **Apollo.io** — plan Basic (Master Key). Búsqueda + enrichment.
- **Apify HarvestAPI** — actor `harvestapi~linkedin-profile-scraper` para scraping LinkedIn.
- **Anthropic Claude** — modelos `claude-sonnet-4-6` (agentes 1-5) y `claude-opus-4-6` (agente 6 QA).

### Credenciales
- Apollo API Key, Apify Token, Anthropic API Key → configuradas DENTRO de n8n como credentials. NO inline en el JSON exportado (ya scrubbed para evitar secret scanning de GitHub).

---

## 4. Hallazgos Críticos de APIs

### Apollo
- **Endpoint search funcional**: `POST /api/v1/mixed_people/api_search` con params en **URL query string** (NO en body).
- **Endpoint enrich funcional**: `POST /api/v1/people/match` body `{"id": "...", "reveal_personal_emails": false}`.
- **Endpoints DEPRECATED**: `mixed_people/search` (422), `people/bulk_match` (422).
- **`organization_industry_tag_ids`** NO funciona en plan Basic — requiere MongoDB ObjectIDs internos de Apollo.
- **Filtros funcionales**: `person_titles[]`, `person_seniorities[]`, `person_departments[]`, `person_locations[]`, `per_page`, `q_organization_name`, `organization_num_employees_ranges[]`, `organization_locations[]`, `q_keywords`.
- **Phone reveal**: requiere `webhook_url` (async). Sin webhook, devuelve `Bad request — please check your parameters`. Descartado por complejidad async.
- **Match con ID inexistente**: devuelve `person` con todos los campos null + un `id` distinto (stub). Por eso `Procesar Datos Apollo` ahora hace fallback al item de Search.

### Apify HarvestAPI
- **Actor correcto**: `harvestapi~linkedin-profile-scraper`.
- **Input correcto**: `publicIdentifiers` (array de strings). NO `profileUrls`, NO `profilePublicIdentifiers`.
- **Apollo devuelve LinkedIn URLs con `http://`** — DEBE convertirse a `https://www.linkedin.com/in/...`.
- **HarvestAPI keys principales**: `firstName`, `lastName`, `headline`, `about`/`summary`, `location`/`geoLocationName`, `experience[]`, `education[]`, `skills[]`, `courses[]`, `publications[]`, `posts[]`, `recommendations[]`, `connectionsCount`, `followerCount`, `openToWork`, `hiring`.
- **`recent_news` se mapea desde `posts[]`** (no existe `recentNews`). Se concatenan los primeros 5 posts con ` | ` como separador.

---

## 5. Modelo de Base de Datos (MER)

### Relaciones
```
organizaciones 1──∞ solicitudes_leads 1──∞ leads 1──1 leads_linkedin
                                              └── 1──1 leads_agentes
organizaciones 1──∞ leads (empresa donde trabaja el lead)
```

### Tabla `organizaciones` (7 columnas)
Cliente solicitante (ej. Lemusse) **Y** empresa donde trabaja el lead. Una sola tabla, el contexto distingue por FK.

```sql
id uuid PK DEFAULT gen_random_uuid()
nombre text NOT NULL UNIQUE
website text
industria text
pais text
created_at timestamptz DEFAULT now()
updated_at timestamptz DEFAULT now()
```

### Tabla `solicitudes_leads` (29 columnas)
Una búsqueda independiente. Estado: `pending → processing → completed | error`.

Campos clave: `nombre_completo`, `email_corporativo`, `organizacion`, `cantidad_leads`, `solucion`, `problema_resuelve`, `casos_exito`, `diferenciador`, `job_titles[]`, `include_similar`, `titulos_adicionales[]`, `seniority[]`, `departments[]`, `person_country`, `company_name`, `company_country`, `company_city`, `employee_min/max`, `industry`, `keywords[]`, `status`, `error_message`, `leads_found`, `processed_at`, `organizacion_id` (FK).

### Tabla `leads` (30 columnas)
Persona real encontrada por Apollo. Apollo ID único.

Campos clave: `solicitud_id` (FK CASCADE), `organizacion_id` (FK), `apollo_id` UNIQUE, `nombre`, `apellido`, `nombre_completo` (GENERATED), `cargo`, `headline`, `seniority`, `departamentos`, `linkedin_url`, `email`, `email_status`, `telefono`, `direccion`, `ciudad`, `estado_region`, `pais`, `foto_url`, `empresa`, `industria_empresa`, `tamano_empresa`, `website_empresa`, `linkedin_empresa`, `org_keywords[]`, `org_short_description`, `org_technology_names[]`.

### Tabla `leads_linkedin` (20 columnas)
Datos crudos de LinkedIn vía HarvestAPI.

Campos clave: `lead_id` UNIQUE FK CASCADE, `linkedin_public_id`, `linkedin_location`, `headline`, `summary`, `experiencia`, `educacion`, `skills`, `ubicacion`, `conexiones`, `seguidores`, `open_to_work`, `courses`, `hiring`, `current_position`, `projects`, `publications`, `recent_news` (← desde `posts[]`), `scraped_at`.

### Tabla `leads_agentes` (39 columnas)
Output de la cadena de 6 agentes IA + control.

Campos por agente:
- **Agente 1 (Personalidad)**: `personality_traits`, `behavior_summary`, `communication_guide`, `energy_drivers`, `disc_type`, `research_output`.
- **Agente 2 (Dolor)**: `declaraciones_problemas`, `match_reason`, `variables_dolor`, `problema_causa`, `consecuencia`, `prueba_social`, `selected_pain_id`.
- **Agente 3 (Hipótesis)**: `motor_hipotesis`, `solucion`.
- **Agente 4 (Estrategia)**: `talking_points`.
- **Agente 5 (Copy)**: `linkedin_mensaje`, `linkedin_msg` (legacy), `pitch_comercial_1/2`, `cold_email_1/2`, `cold_call_1/2`, `secuencia_email_2/3/4`, `email_subject`.
- **Agente 6 (QA Auditor)**: `score` (0-100 float), `score_justificacion`, `extraccion`, `email_generado`.

Control: `lead_id` UNIQUE FK CASCADE, `perfil_para_agente`, `status`, `error_message`, `processed_at`, `created_at`.

---

## 6. Workflow n8n — Topología (54 nodos)

Todo en un único workflow. Dos triggers:
- **Webhook principal** (`Formulario GHL1`, path `/prospeccion-apollo`).

### Flujo síncrono completo

```
Formulario GHL1 (webhook)
└─→ Preparar1 (upsert organizacion + PATCH solicitud:processing + build Apollo URL)
    └─→ HTTP Request1 (POST Apollo /mixed_people/api_search con URL dinámica)
        └─→ Split Out (split people[])
            └─→ Apollo Match1 (POST /people/match por lead, sin reveal)
                └─→ Merge1 (append, single input pasa-through)
                    └─→ Procesar Datos Apollo (merge match + search por apollo_id, fix LinkedIn URL, INSERT/UPSERT leads)
                        └─→ Loop por Lead1 (splitInBatches=5)
                            ├─[output 1: batch]→ LinkedIn URLs1 (extrae publicIdentifier de URL https)
                            │   └─→ Run HarvestAPI1 (POST Apify run-sync-get-dataset-items)
                            │       └─→ Code in JavaScript (parsea LinkedIn, INSERT leads_linkedin con UPSERT por lead_id)
                            │           └─[loopback]→ Loop por Lead1
                            └─[output 0: done]→ Combinar Apollo + LinkedIn1 (merge combineByPosition)
                                └─→ Preparar Data para Agentes1 (genera perfilParaAgente, INSERT leads_agentes:pending)
                                    └─→ Loop Agentes (splitInBatches=1) ← LOOP NUEVO PARA SECUENCIAR AGENTES
                                        └─[output 1: batch]→ Extraer Campos1 (set: lead_db_id, perfilParaAgente, contexto solicitud)
                                            └─→ Bridge Agent 1 (genera prompt agente 1)
                                            │   ├─→ AGENTE 1a — Context Synthesis (chainLlm Claude Sonnet)
                                            │   │     ↑ ai_languageModel: Anthropic Agente 1a
                                            │   └─→ AGENTE 1b — Context Synthesis (chainLlm Claude Sonnet)
                                            │         ↑ ai_languageModel: Anthropic Agente 1b
                                            ├─→ Merge Agent 1 (append) → Selector Agent 1 (extractJson dual, elige el más completo)
                                            ├─→ Bridge Agent 2 → AGENTE 2a/2b → Merge → Selector Agent 2
                                            ├─→ Bridge Agent 3 → AGENTE 3a/3b → Merge → Selector Agent 3
                                            ├─→ Bridge Agent 4 → AGENTE 4a/4b → Merge → Selector Agent 4
                                            ├─→ Bridge Agent 5 → AGENTE 5a/5b → Merge → Selector Agent 5
                                            ├─→ Extraer (implícito ctx) → AGENTE 6 — QA Auditor1 (chainLlm Claude Opus)
                                            │     ↑ ai_languageModel: Anthropic Agente 6
                                            ├─→ Parse Agente 6 + Build PATCH1 (extractJson, construye supabase_patch_body)
                                            └─→ UPDATE leads_agentes1 (PATCH /leads_agentes?lead_id=eq.X)
                                                └─[loopback]→ Loop Agentes
```

### Decisiones de diseño

- **Dual-model (a/b)** por agente 1-5: dos llamadas paralelas al mismo prompt, Selector elige la respuesta más completa por longitud del JSON parseado. Mitiga fallos esporádicos del LLM.
- **Loop Agentes batchSize=1**: introducido porque los Bridge Agents usan `$input.first()`. Sin él, con 2+ leads sólo se procesa el primero.
- **`extractJson` robusto**: parser custom que strip markdown fences, walk balanced braces respetando strings, fallback a regex per-key. Reemplazó el regex greedy `/{[\s\S]*}/` que fallaba con quotes anidadas.
- **Procesar Datos Apollo merge match+search**: Apollo Match a veces devuelve stub vacío (id no resoluble); merge con item de Split Out llena los gaps. Insert con `?on_conflict=apollo_id` + `Prefer: resolution=merge-duplicates`.

---

## 7. Sección Prompts — Cadena de 6 Agentes

> **Regla compartida**: TODOS los agentes tienen una cláusula `IDIOMA OBLIGATORIO` que fuerza respuesta 100% en español neutro profesional, prohíbe anglicismos innecesarios y exige traducir cualquier texto en inglés del perfil al español.

### 7.1 Agente 1 — Context Synthesis (Personalidad / DISC)

**Modelo**: `claude-sonnet-4-6` × 2 (a/b paralelos)

**Input**: `perfilParaAgente` (texto estructurado con datos Apollo + LinkedIn).

**Output esperado** (JSON):
```json
{
  "personality_traits": "...",
  "behavior_summary": "...",
  "communication_guide": "...",
  "energy_drivers": "...",
  "disc_type": "D|I|S|C [+ secundario]",
  "research_output": "..."
}
```

**Esqueleto del prompt**:
- Misión: investigador B2B de élite, construir imagen mental completa del prospecto.
- 5 secciones: (1) Personalidad y comportamiento, (2) Tipo DISC con evidencia, (3) Guía de comunicación, (4) Drivers de energía, (5) Hallazgos de investigación (timing, contexto empresa).
- Cierre: "Sin markdown. Sin código de bloque. Sin texto adicional. Solo el JSON."
- **+ Cláusula IDIOMA OBLIGATORIO** (español, sin anglicismos).

### 7.2 Agente 2 — Proof Selector (Dolor)

**Modelo**: `claude-sonnet-4-6` × 2

**Output**:
```json
{
  "declaraciones_problemas": "...",
  "match_reason": "...",
  "variables_dolor": "...",
  "problema_causa": "...",
  "consecuencia": "...",
  "prueba_social": "...",
  "selected_pain_id": "..."
}
```

**Misión**: identificar dolor genuino del prospecto a partir del perfil + el contexto de la solicitud (solución, problema_resuelve, diferenciador). Salida tipo: declaraciones de problema "como el cliente lo hablaría", causa raíz, consecuencia operacional, qué prueba social funcionaría.

### 7.3 Agente 3 — Hypothesis Engine (Motor de compra)

**Modelo**: `claude-sonnet-4-6` × 2

**Output**:
```json
{
  "motor_hipotesis": "...",
  "solucion": "..."
}
```

**Misión**: hipotetizar el motor real de compra (no el dolor superficial) — qué hace que el prospecto compre AHORA y no en 6 meses. Mapear la solución del cliente solicitante al motor identificado.

### 7.4 Agente 4 — Strategy + CTA

**Modelo**: `claude-sonnet-4-6` × 2

**Output**:
```json
{
  "talking_points": "..."
}
```

**Misión**: estrategia de acercamiento + 3-5 talking points específicos. CTA con la fricción mínima necesaria. Tono según DISC del agente 1.

### 7.5 Agente 5 — Copy Generator

**Modelo**: `claude-sonnet-4-6` × 2

**Output**:
```json
{
  "linkedin_mensaje": "...",
  "pitch_comercial_1": "...",
  "pitch_comercial_2": "...",
  "cold_email_1": "...",
  "cold_email_2": "...",
  "cold_call_1": "...",
  "cold_call_2": "...",
  "secuencia_email_2": "...",
  "secuencia_email_3": "...",
  "secuencia_email_4": "...",
  "email_subject": "..."
}
```

**Misión**: generar todo el material de outreach personalizado. 2 variantes por canal (A/B testing). Coherencia DISC-tono. Subject lines bajo 50 caracteres. CTAs con un solo siguiente paso claro.

### 7.6 Agente 6 — QA Auditor (claude-opus-4-6)

**Modelo**: `claude-opus-4-6` (única instancia, no dual)

**Input**: `perfilParaAgente` + outputs JSON de agentes 1-5.

**Output**:
```json
{
  "score": 0-100,
  "score_justificacion": "...",
  "extraccion": "...",
  "email_generado": "..."
}
```

**Criterios de evaluación (100 pts)**:
- A. Personalización real con datos específicos [0-30]
- B. Relevancia y precisión del dolor [0-25]
- C. Calidad del copy: claridad, brevedad [0-20]
- D. CTA específico y accionable [0-15]
- E. Coherencia DISC-Tono [0-10]

**Misión adicional**:
- Selección del mejor email entre `cold_email_1` y `cold_email_2`. Criterios: hook en primeras 2 líneas, referencia más específica, CTA con menor fricción. Devuelve sólo el cuerpo (sin línea "Asunto:").
- **Extracción ejecutiva**: lo que el vendedor necesita saber en 30 segundos antes de la cold call — quién es, por qué interesarse, primeros 10 segundos, qué NO mencionar, señal de timing aprovechable.

### 7.7 Cláusula IDIOMA OBLIGATORIO (compartida)

```
IDIOMA OBLIGATORIO — REGLA INVIOLABLE:
Toda tu respuesta debe estar redactada 100% en ESPAÑOL NEUTRO
PROFESIONAL. PROHIBIDO usar palabras en inglés salvo: (a) nombres
propios de personas, (b) marcas registradas, (c) títulos de cargos
cuando aparecen literalmente en el perfil de LinkedIn. Si el perfil
contiene texto en inglés, traduce o parafrasea al español natural.
NO uses anglicismos innecesarios (di "ventas" no "sales",
"departamento" no "department", "objetivo" no "target",
"alcance" no "outreach", "guion" no "script"). Si una palabra técnica
no tiene traducción común al español, úsala pero el resto del texto
debe estar en español.
```

### 7.8 Notas operativas

- Output dual-agente se compara por longitud de JSON parseado en `Selector Agent N`. Si uno falla parse y el otro no, gana el válido.
- `extractJson()` (en Selectors 1-5 fragilizados → ya migrados parcialmente; Selector 1 + Parse Agente 6 sí migrados): 1) strip ```` ```json ... ``` ```` 2) walk balanced braces respetando strings 3) fallback regex per-key.
- Si un agente devuelve JSON malformado irrecuperable, los campos quedan `''` (string vacío) en DB, no `null`. Los `null` indican que el agente nunca corrió.
- `score: null` indica fallo de parse en agente 6. Score válido siempre debe ser float 0-100.

---

## 8. Frontend

### `index.html` (formulario solicitante)
- 8 secciones: identidad, negocio (solución/problema/diferenciador), titles + seniority + departments, person country, company name, company location, employee range, industry + keywords.
- **Default `include_similar = true`** (era false, causaba miss de Logistics Manager cuando se buscaba Operations Manager).
- **Expansión automática de sinónimos en submit**: tabla `TITLE_SYNONYMS` en JS (Operations Manager → Logistics, Supply Chain, Warehouse, Distribution, Plant, etc.). Si include_similar está ON, los sinónimos se agregan a `job_titles` y `titulos_adicionales` antes del POST.
- **Validación cliente**: email regex, cantidad 1-500, rango empleados coherente.
- **`postSolicitud()`**: timeout 25s, 2 reintentos en 5xx/408/429/red caída, sin retry en 4xx. Traducción de errores Postgres (23502, 22P02).
- POST a `/rest/v1/solicitudes_leads` (Supabase). Webhook n8n se dispara via DB trigger / polling configurado en n8n (asumido fuera del repo).

### `leads.html` (dashboard)
- Lista de leads con avatar, score, status, búsqueda fuzzy (Levenshtein normalizado, tolera typos en nombre/empresa/cargo/headline LinkedIn).
- Modal con 5 tabs: General, LinkedIn, Análisis IA, Outreach, Perfil Agente.
- **Delete con confirmación**: `DELETE /rest/v1/leads?id=eq.X`. Cascade limpia hijos. Verifica existencia pre y post-delete.
- `sb()` con timeout 20s + reintentos exponenciales. Manejo de 401/403 con mensaje específico.
- Toast notificaciones (ok/err/warn).
- **Importante PostgREST**: para FK 1-1 con UNIQUE en columna FK, PostgREST devuelve **objeto** no array. `pick = (v) => Array.isArray(v) ? v[0] : v` normaliza.

---

## 9. Convenciones

- **Supabase REST API**: todos los inserts/updates desde n8n Code nodes vía `this.helpers.httpRequest`. NO usar `fetch` ni `$helpers` (no existen).
- Headers: `apikey`, `Authorization: Bearer`, `Content-Type: application/json`, `Prefer: return=representation` (insert) / `return=minimal` (update).
- Upsert organizaciones: `Prefer: return=representation,resolution=merge-duplicates`.
- Upsert leads por apollo_id: URL `?on_conflict=apollo_id` + `Prefer: resolution=merge-duplicates`.
- LinkedIn URLs: siempre normalizar `http://` → `https://www.linkedin.com/in/...`.
- Apollo: query string en URL, NO body. Header `x-api-key`.
- HarvestAPI: input `publicIdentifiers` (array de strings), timeout 120s.
- Postgres UUID rechaza string vacío (`22P02`). Si un lead_id puede estar vacío, mandar `null`.

---

## 10. Archivos del Proyecto

```
/CLAUDE.md                     — Este archivo (contexto exhaustivo)
/database-schema.sql           — DDL completo de las 5 tablas
/index.html                    — Formulario web (8 secciones, sinónimos, error handling)
/leads.html                    — Dashboard (fuzzy search, delete, modal multi-tab)
/workflow-server-full.json     — Workflow n8n único (54 nodos)
/workflow-v3-supabase-final.json — Versión histórica (deprecated)
/workflow-agentes-ia-v2.json   — Versión histórica (deprecated)
/fix-*.mjs                     — Scripts ad-hoc para parchear el JSON del workflow
```

---

## 11. Pendientes Conocidos

- Backfill de leads viejos con `personality_traits`, `behavior_summary` etc. vacíos (los nuevos se llenan tras los fixes de extractJson).
- Validación end-to-end con 5+ leads y revisar score distribution del agente 6.
