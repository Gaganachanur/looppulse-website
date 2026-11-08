# LoopPulse.in — Market Validation Landing Page

> **Tagline:** Never let a lead go cold.  
> **Supporting Message:** 24/7 automated follow-ups for your incoming leads.  
> **Stage:** Early-Stage Startup Market Validation (India SMB Focus)

---

## 🎯 Strategic Purpose & CRO Blueprint

This landing page is engineered from the ground up as a **high-converting, transparent market research vehicle**. It is specifically designed to validate demand among small and medium-sized business owners in India arriving from **Instagram Ads, WhatsApp shares, direct links, and search**.

### Key Conversion Strategy Principles Implemented:
1. **Immediate Headline Clarity:** Above-the-fold value proposition immediately informs mobile visitors what LoopPulse does without marketing fluff.
2. **Transparent Authenticity:** In accordance with early-stage validation ethics, there are **no invented testimonials, no fabricated customer logos, no fake statistics, and no inflated revenue claims**. This builds genuine founder-to-founder trust.
3. **Illustrative Conceptual UI:** The hero section visualizes the proposed experience (Incoming lead capture, WhatsApp response preview, automated reminder trigger, and a Kanban pipeline) clearly labeled as an R&D concept.
4. **Interactive Industry Filter:** Visitors can tap their industry (Fitness, Clinics, Real Estate, Education, Professional Services, etc.) which automatically highlights their challenges, updates the research form, and scrolls down to the questionnaire.
5. **Frictionless Mobile-First Form:** 11 structured questions with touch-friendly radio pills, clear placeholders, 10-digit Indian phone number formatting (`+91`), and an unchecked consent checkbox.
6. **Double-Guarded Form Submission:** Supports live webhook/API submission (Formspree, Supabase, Google Apps Script, Zapier/Make) with an automatic `localStorage` fallback to guarantee no founder responses are ever lost.
7. **Omnichannel Analytics Dispatcher:** Pre-wired event tracking for CTA clicks, industry selection, form validation errors, and completed submissions compatible with Google Tag Manager, Google Analytics 4, and Meta Pixel (`fbq`).

---

## 📁 Project Structure

```
looppulse-landing-page/
├── index.html        # Complete semantic HTML5 landing page with all 8 sections
├── styles.css        # Design tokens, micro-interactions, responsive tap targets, animations
├── app.js            # Form engine, offline resilience, analytics dispatcher, interactive tabs
└── README.md         # Deployment, configuration, and integration documentation
```

---

## 🚀 How to Run Locally

You can run this project with any local server or simply open `index.html` in your browser.

### Option 1: Python HTTP Server
```bash
cd "C:\Users\GAGAN\.gemini\antigravity\scratch\looppulse-landing-page"
python -m http.server 8080
```
Then visit: `http://localhost:8080`

### Option 2: Node.js (npx serve)
```bash
npx serve .
```

### Option 3: Direct File Open
Double click `index.html` or open it with Google Chrome / Microsoft Edge.

---

## ⚙️ Backend & Supabase Edge Function Integration

The market research inquiry form is integrated with **Supabase Edge Functions** and PostgreSQL (`research_inquiries` table):

```javascript
const CONFIG = {
  SUPABASE_EDGE_FUNCTION_URL: 'https://yscspgtyqetuyxikbvbo.supabase.co/functions/v1/research_inquiries',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_K6saD7zHFcRkVDCXLH0nMg_cSxq-F5o',
  ...
};
```

### Request Headers Dispatched:
- `Content-Type: application/json`
- `apikey: <SUPABASE_PUBLISHABLE_KEY>`
- `Authorization: Bearer <SUPABASE_PUBLISHABLE_KEY>`

### Data Payload (camelCase Properties):
`referenceId`, `fullName`, `businessName`, `businessType`, `city`, `phone`, `email`, `monthlyEnquiries`, `managementMethod`, `biggestChallenge`, `considerTesting`, `preferredContact`, `consent`, `submittedAt`.

- Submissions are inserted into Supabase PostgreSQL table `research_inquiries`.
- In-flight double-submit lock prevents duplicate requests.
- Success view appears only upon verified HTTP 200 confirmation from Supabase.
- An accessible, clear error alert appears if a network or validation error occurs, keeping the user's form inputs intact for retry.

---

## 📊 Analytics & Instagram Ad Tracking

The script automatically emits custom events to:
- `window.dataLayer` (Google Tag Manager)
- `gtag('event', ...)` (Google Analytics 4)
- `fbq('trackCustom', ...)` (Meta / Instagram Pixel)

### Tracked Events:
- `cta_clicked`: Captures which CTA was clicked (`hero_primary_cta`, `hero_secondary_cta`, `nav_cta`, `how_it_works_cta`, `final_cta`).
- `industry_selected`: Captures which industry card was clicked in Section 4.
- `form_interaction_started`: Triggers on the user's first input focus.
- `form_validation_failed`: Detects where users might be dropping off in the form.
- `research_form_submitted`: Fires upon successful form intake with payload metadata (industry, monthly lead volume, city, testing willingness).

---

## 🎨 Brand Design Tokens

- **Primary Blue:** `#2563EB`
- **Accent Purple:** `#7C3AED`
- **Dark Navy:** `#0F172A`
- **Light Slate Background:** `#F8FAFC` / `#F1F5F9`
- **Font Family:** `Inter`, sans-serif
- **Logo Concept:** Infinity loop intersecting with an active ECG/pulse waveform.
