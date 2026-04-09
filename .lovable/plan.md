

## AI Personal Finance Copilot 🇪🇺

### Pages & Navigation
1. **Landing Page** — Hero section with value props, feature highlights, CTA to sign up
2. **Auth Pages** — Login/Register with email+password and Google OAuth
3. **Dashboard** — Overview with spending summary cards, monthly chart, recent transactions, AI insights widget
4. **Transactions Page** — Full transaction list with add/edit/delete, CSV bank statement upload, filters by category/date/amount
5. **Insights Page** — AI-powered monthly spending analysis, budget recommendations, anomaly detection, interactive charts

### Core Features
- **Transaction Management** — Manual CRUD + CSV import with parsing
- **AI Auto-Categorization** — Transactions automatically categorized (Food, Transport, Housing, etc.) via Lovable AI Gateway edge function
- **AI Financial Advisor** — Streaming chat widget that gives personalized budget advice based on spending patterns
- **Charts & Analytics** — Recharts-based visualizations: spending by category (pie), monthly trends (bar/line), savings projections
- **Dark/Light Theme Toggle** — System-aware with manual override

### Database Schema (Supabase)
- **profiles** — user_id, display_name, currency (EUR default), monthly_budget
- **transactions** — id, user_id, amount, description, category, date, type (income/expense), created_at
- **categories** — id, name, icon, color (pre-seeded: Food, Transport, Housing, Entertainment, Health, Shopping, Utilities, Other)

### AI Edge Functions
1. **categorize-transaction** — Takes transaction description, returns best category using Lovable AI
2. **financial-insights** — Analyzes user's transaction history, returns spending summary + recommendations + anomalies
3. **finance-chat** — Streaming chat endpoint for personalized financial advice

### Auth
- Supabase Auth with email/password + Google OAuth
- RLS policies on all tables scoped to authenticated user
- Protected routes with auth guard

### Design
- Clean, modern fintech aesthetic
- Responsive (mobile-first dashboard)
- Color scheme: deep blue primary, green for income, red for expenses
- Card-based layout with subtle shadows

