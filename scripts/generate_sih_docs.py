import sys
import os

def generate_sih_documentation():
    target_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    ps_file = os.path.join(target_dir, 'PROBLEM_STATEMENT.txt')
    docs_dir = os.path.join(target_dir, 'docs')
    os.makedirs(docs_dir, exist_ok=True)

    if not os.path.exists(ps_file):
        print("Error: PROBLEM_STATEMENT.txt file not found!")
        return

    with open(ps_file, 'r', encoding='utf-8') as f:
        ps_content = f.read().strip()

    print(f"[SIH Doc Engine] Reading Problem Statement...")

    # Template 1: PRD
    prd_md = f"""# 1. Product Requirements Document (PRD)
**Team Name:** Ctrl Alt Elites  
**Hackathon:** Smart India Hackathon (SIH) Internal Round  
**Problem Statement Reference:**
```
{ps_content[:400]}...
```

---

## 🎯 1. App Overview & One-Liner
A flagship, AI-driven, secure platform designed to address the core challenges outlined in the SIH Problem Statement with high performance, scalability, and regional accessibility.

## 👥 2. Target Users & Personas
* **Primary Users:** Citizens, Administrators, and Domain Specialists.
* **Secondary Users:** System Auditors, Govt Officials, and Field Operations.

## 💡 3. Problem Statement & Root Cause
The current workflow lacks real-time automation, zero-hallucination contextual intelligence, and automated OWASP security compliance.

## ✨ 4. Main MVP Features (10-Hour Scope)
1. **Executive Dashboard:** High-density metrics, real-time data visualizers.
2. **Context7 AI RAG Engine:** Live, accurate contextual data retrieval without AI hallucinations.
3. **Strix Security Auditor Module:** Automated OWASP vulnerability verification and audit certificate generation.
4. **Multi-Language Accessibility:** Instant switching across English, Hindi, Marathi, Tamil, Telugu.

## 🏆 5. Success Metrics
* < 20ms Edge API latency.
* 100% Zero-hallucination accuracy on contextual search.
* 0 Critical OWASP security vulnerabilities.
"""

    # Template 2: TRD
    trd_md = f"""# 2. Technical Requirements Document (TRD)
**Team Name:** Ctrl Alt Elites  

---

## 💻 1. Tech Stack
* **Frontend:** React 18, Vite, TypeScript, Tailwind CSS v4, Lucide Icons, Framer Motion, Recharts.
* **AI/RAG:** Upstash Context7 RAG Engine.
* **Security:** Strix Autonomous AI Security Audit Framework.
* **Database & Auth:** Supabase PostgreSQL + JWT Auth + Upstash Redis Cache.
* **Deployment:** Vercel Edge Network.

## 🛡️ 2. Security & Performance Directives
* TLS 1.3 Encryption for all transit data.
* Restricted CORS policy for production domains.
* Input escaping via DOMPurify to prevent XSS.
"""

    # Template 3: App Flow
    appflow_md = f"""# 3. App Flow & User Journey Document
**Team Name:** Ctrl Alt Elites  

---

## 🗺️ Screen Navigation Graph
1. **Landing / Executive Dashboard:** Overview KPI cards, System health SLA, Throughput charts.
2. **Context7 AI Engine Screen:** Library query bar, instant RAG code snippet cards, copy-to-clipboard.
3. **Strix Security Audit Hub:** Severity matrix, vulnerability log table, re-run audit trigger.
4. **Architecture & Pitch Screen:** System component graph & 5-minute presentation blueprint.
"""

    # Template 4: UI/UX Brief
    uiux_md = f"""# 4. UI/UX Design Brief
**Team Name:** Ctrl Alt Elites  

---

## 🎨 Design System & Aesthetics
* **Theme:** Deep Slate Dark Mode (`bg-slate-950`) with vibrant Cyan (`#06b6d4`) and Emerald (`#10b981`) accents.
* **Style:** Glassmorphism (`backdrop-blur-xl`), glowing borders, clean typography, micro-animations.
* **Non-Generic Directive:** Avoid plain/flat components. Use curated contrast tokens.
"""

    # Template 5: Backend Schema
    schema_md = f"""# 5. Backend Schema Document
**Team Name:** Ctrl Alt Elites  

---

## 🗄️ Database Tables
1. `users` (id, email, role, created_at)
2. `audit_logs` (id, rule_id, category, severity, status, logged_at)
3. `rag_queries` (id, user_id, query, library, response_snippet, timestamp)
"""

    # Template 6: Implementation Plan
    plan_md = f"""# 6. Implementation Plan (10-Hour Sequence)
**Team Name:** Ctrl Alt Elites  

---

## ⏱️ Step-by-Step Execution Sequence
* **Phase 1 (Hour 0-1):** Read Problem Statement ➔ Auto-generate 6 Docs ➔ Lock Architecture.
* **Phase 2 (Hour 1-6):** Parallel Sprint (Frontend UI + Backend DB + Context7 AI RAG).
* **Phase 3 (Hour 6-7.5):** Integration & End-to-End API Linking.
* **Phase 4 (Hour 7.5-8.5):** Run Strix Security Audit Scan ➔ Deploy to Vercel.
* **Phase 5 (Hour 8.5-10):** Pitch Deck Practice & Live Demo Backup Video.
"""

    files = {
        "1_PRD_DOCUMENT.md": prd_md,
        "2_TRD_DOCUMENT.md": trd_md,
        "3_APP_FLOW_DOCUMENT.md": appflow_md,
        "4_UIUX_DESIGN_BRIEF.md": uiux_md,
        "5_BACKEND_SCHEMA.md": schema_md,
        "6_IMPLEMENTATION_PLAN.md": plan_md,
    }

    for fname, content in files.items():
        with open(os.path.join(docs_dir, fname), 'w', encoding='utf-8') as out:
            out.write(content)
        print(f"[SIH Doc Engine] Generated: docs/{fname}")

    print("\n[SIH Doc Engine] All 6 Vibe Coding Foundation Documents generated successfully!")

if __name__ == '__main__':
    generate_sih_documentation()
