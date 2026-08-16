# Lehar AI — SIH 2026 Idea Submission PPT Content
> Template ke exact pointers follow kiye hain. Har slide points me hai — paragraphs nahi.
> Copy-paste karke provided PPTX template me daalo, PDF export karo, submit.

---

## SLIDE 1 — TITLE PAGE

- **Problem Statement ID:** SIH26040
- **Problem Statement Title:** Lehar AI – AI-Powered Conversational Interface for ARGO Ocean Data Discovery and Visualization
- **Theme:** Miscellaneous (Ocean Technology)
- **PS Category:** Software
- **Team ID:** [Portal pe registration ke baad daalna]
- **Team Name:** Ctrl Alt Elites

---

## SLIDE 2 — IDEA TITLE & PROPOSED SOLUTION

**Idea Title:** Lehar AI — "Ocean Se Baat Karo": AI chatbot jo 4000+ Argo floats ka data natural language me accessible banata hai

### Proposed Solution
- AI-powered **conversational interface** jo non-technical users ko ocean data query karne deta hai — plain English + Hindi me
- User poochta hai → LLM query ko **SQL me translate** karta hai → Argo database se answer → **auto-generated chart + interactive map + simple explanation**
- Example: *"Arabian Sea me pichle 6 mahine ki salinity dikhao"* → depth-profile graph + float locations map + insight text

### How it addresses the problem
- Argo data **NetCDF format** me locked hai — sirf domain experts use kar paate hain → hum use SQL + vector DB me convert karke sabke liye kholte hain
- Technical barrier (coding, formats, tools) **completely remove** — chatbot sab kuch handle karta hai
- Sirf raw data nahi, **meaningful insights** deta hai — decision-makers ke liye actionable

### Innovation & Uniqueness (ye sabse important hai — existing solutions se alag)
1. **Multilingual queries** — Hindi/regional language support, koi existing Argo tool ye nahi deta
2. **Auto-Insight Engine** — sirf chart nahi, AI anomalies detect karke batata hai (*"salinity unusually high — possible cyclone precursor"*)
3. **Non-scientist modes** — Fishery officer / student / policymaker ke liye preset dashboards (Potential Fishing Zone style actionable view)
4. **Query suggestions engine** — user ko guide karta hai ki kya pooch sakta hai (data discovery assisted)

---

## SLIDE 3 — TECHNICAL APPROACH

### Technologies
| Layer | Tech |
|---|---|
| Frontend | React + TypeScript + Tailwind, Recharts/Plotly charts, Leaflet map |
| Backend | FastAPI (Python) — query engine + LLM orchestration |
| Database | PostgreSQL (structured Argo data) + FAISS/Chroma (vector DB for RAG) |
| AI/LLM | Open-source LLM (LLaMA/Mistral via API) — NL→SQL translation + RAG pipeline, MCP-based tool calling |
| Data Pipeline | Python (xarray/netCDF4) — NetCDF → SQL/Parquet conversion |

### Methodology / Flow
```
ARGO NetCDF files (free GDAC/INCOIS data)
        │  [Ingestion Pipeline: xarray → cleaning → PostgreSQL + Parquet]
        ▼
User Query (chat, EN/Hindi)
        │  [LLM: intent detection → text-to-SQL + RAG on metadata]
        ▼
PostgreSQL + FAISS retrieval
        │  [Validation layer: safe SQL execution]
        ▼
Response Composer → Chart (profile/trajectory/time-series)
                  + Map (float locations) + Plain-language insight
```

### Working Prototype Scope (PoC)
- Indian Ocean Argo data (real, free from INCOIS/GDAC)
- 3 query types live demo: profile plots, float trajectories on map, parameter comparison
- Data export (CSV/ASCII) for researchers

---

## SLIDE 4 — FEASIBILITY AND VIABILITY

### Feasibility Analysis
- **Data 100% available & free** — Argo GDAC + INCOIS open data, no permissions needed
- **All technologies open-source / free-tier** — zero licensing cost
- **Proven pattern** — text-to-SQL + RAG is established; hum domain-specific layer add kar rahe hain
- **Team capability** — React + Python stack already set up; prototype 36-hour hackathon window me achievable
- **Scalable** — same pipeline extendable to BGC floats, gliders, buoys, satellite data

### Potential Challenges & Risks → Mitigation Strategy
| Challenge | Strategy |
|---|---|
| LLM galat SQL generate kare (hallucination) | Schema-constrained prompting + SQL validation layer + read-only queries |
| NetCDF data bahut bada hai | Indian Ocean subset for PoC; Parquet compression + indexed queries |
| Ambiguous user queries | Clarifying-question loop + query suggestion chips |
| LLM API cost/latency | Open-source models + cached frequent queries + fallback rule-based parser |

---

## SLIDE 5 — IMPACT AND BENEFITS

### Impact on Target Audience
- **Researchers/students** — hours ka data-wrangling → seconds ka query; learning curve zero
- **Fishery & coastal officers** — actionable ocean insights bina technical training ke
- **Policymakers (INCOIS/MoES)** — rapid evidence for climate & ocean decisions
- **Educators** — ocean science classrooms ke liye interactive tool

### Benefits
- **Social:** Ocean data democratization — tier-2/3 colleges aur non-experts tak pahunch; Hindi support se inclusion
- **Economic:** Fishery advisory se coastal livelihood improvement; research productivity gain; zero-cost open-source stack
- **Environmental:** Better ocean monitoring → climate change, cyclone, marine ecosystem research ko accelerate
- **National:** INCOIS Digital India / Blue Economy initiatives ke saath aligned

---

## SLIDE 6 — RESEARCH AND REFERENCES

- International Argo Program — Global Data Assembly Centre (GDAC): https://www.argodatamgt.org / https://argo.ucsd.edu
- INCOIS (MoES, Govt. of India) — Indian Argo Project & Indian Ocean data: https://incois.gov.in
- Argo float data — NetCDF format specification & free access: https://doi.org/10.17882/42182
- RAG + Text-to-SQL architecture: Lewis et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks" (NeurIPS 2020)
- IndOOS (Indian Ocean Observing System) Decadal Review — CLIVAR: https://www.clivar.org
- xarray & netCDF4 Python libraries documentation (data pipeline)
- Similar national initiative: INCOIS Potential Fishing Zone (PFZ) advisory service

---

## ⚠️ Submit karne se pehle checklist
- [ ] Team ID daalo (slide 1)
- [ ] Slide 7 (Important Pointers) **DELETE** karo
- [ ] Total 6 slides se zyada nahi
- [ ] Flow diagram (slide 3) — PPT me shapes se banao, text screenshot nahi
- [ ] **PDF export** karke upload (PPT/DOC nahi chalega)
- [ ] File name: TeamID_SIH26040.pdf style me rakho
