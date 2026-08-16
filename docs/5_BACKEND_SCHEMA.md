# 5. Backend Schema Document
**Team Name:** Ctrl Alt Elites  

---

## 🗄️ Database Tables
1. `users` (id, email, role, created_at)
2. `audit_logs` (id, rule_id, category, severity, status, logged_at)
3. `rag_queries` (id, user_id, query, library, response_snippet, timestamp)
