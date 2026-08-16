---
name: frontend-design
description: Create distinctive, professional, high-end frontend interfaces and UI/UX design systems. Avoid generic AI slop, default rounded cards, and uninspired color gradients. Use intentional typography, spatial hierarchy, stateful micro-animations, and production-grade aesthetics tailored to the project problem domain.
---

# Frontend Design Master Directive (Anthropic Design Philosophy)

When building web applications and UI interfaces for hackathons or production products, adhere strictly to these design guidelines to deliver distinctive, memorable, and world-class user experiences.

---

## 🎨 1. Eliminate "AI Slop" & Generic Templates
* **NO Generic Defaults:** Never use plain centered cards, standard purple-on-white gradients, or uninspired generic layout rows.
* **Commit to an Aesthetic Tone:** Before writing code, commit to a clear design theme appropriate for the domain:
  * *GovTech / Enterprise:* High-density slate dark mode, sharp status indicators, subtle grid lines, monospace metrics.
  * *Cybersecurity / FinTech:* Deep midnight backgrounds, neon cyan/emerald status highlights, glassmorphic telemetry panels.
  * *Consumer / SaaS:* Fluid micro-animations, rich typography contrast, stateful hover physics.

---

## 📐 2. Spatial Composition & Layout Hierarchy
* **Density & Rhythm:** Group related controls into high-density action bars and stats cards.
* **1px Borders & Glassmorphism:** Use `border-slate-800` with subtle backdrop blur (`backdrop-blur-xl`) and inner shadows instead of heavy drop shadows.
* **Stateful Micro-Interactions:** Buttons must have active scale states (`active:scale-95`), smooth hover color transitions (`transition-all duration-200`), and visible focus rings.

---

## 🔤 3. Typography & Data Visuals
* **Font Contrast:** Pair bold display headers (`font-black tracking-tight`) with readable body sans typography and monospace telemetry codes (`font-mono`).
* **Real Mock Telemetry:** Never use dummy text like "Lorem ipsum" or blank charts. Use realistic metrics (e.g. "SLA 99.98%", "API Latency 14ms", "OWASP Grade A+").

---

## 🛡️ 4. Accessibility & Indian Regional Inclusivity (SIH Special)
* **High Contrast:** Ensure text meets WCAG AA contrast ratio against dark panels.
* **Multilingual Readiness:** Support instant UI text switching (English, Hindi, Marathi, Tamil, Telugu).
* **Responsive Layouts:** Flawless layout adaptivity across mobile phones, tablets, and desktop displays.
