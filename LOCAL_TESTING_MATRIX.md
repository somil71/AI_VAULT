# Local Feature Testing Matrix

| Feature | Endpoint | UI Flow | Expected Result | Status |
|---|---|---|---|---|
| Backend health | `GET /api/health` | App boot -> backend readiness check | Returns `success: true` with service and mongodb state | Not Run |
| AI health | `GET /health` (AI service) | Admin/System health views | Returns healthy status, model info, and `model_version` | Not Run |
| Demo auth login | `POST /api/auth/login` | Open app without JWT -> `ensureAuth()` | Returns JWT + user; app stores `lifevault_jwt` | Not Run |
| Demo auth register fallback | `POST /api/auth/register` | First demo run when user absent | Creates user and returns JWT + user | Not Run |
| Current user | `GET /api/auth/me` | Protected routes load profile | Returns authenticated user object | Not Run |
| Wallet nonce issuance | `GET /api/auth/wallet/nonce?walletAddress=...` | Connect wallet -> wallet sign-in start | Returns nonce + sign message; nonce expires ~5 min | Not Run |
| Wallet signature verify | `POST /api/auth/wallet/verify` | Wallet sign-in confirm | Valid signature issues JWT and marks nonce used | Not Run |
| Wallet sign-in fallback | N/A (frontend auth flow) | Wallet sign-in fails/unavailable | Falls back to demo JWT flow without route breakage | Not Run |
| Scam analysis | `POST /api/phishing/analyze` | User -> Scam Detector | Returns risk analysis payload unchanged | Not Run |
| Scam context intelligence | `POST /api/intelligence/scam-context` | User/Admin intelligence panels | Returns AI scam context response | Not Run |
| Threat enrichment | `POST /api/intelligence/enrich` | Intelligence enrichment actions | Returns provider status objects | Not Run |
| Transaction analysis (JSON) | `POST /api/transactions/analyze` | User -> Transaction Monitor | Returns anomaly analysis payload | Not Run |
| Transaction CSV upload | `POST /api/transactions/upload-csv` | User -> Upload statement CSV | Parses CSV and returns anomaly analysis | Not Run |
| Vault upload | `POST /api/vault/upload-document` | User -> Document Vault upload | Stores hash on-chain and logs activity | Not Run |
| Proof generation | `POST /api/verifier/generate-proof` | User -> Proofs | Generates verification proof + tx refs | Not Run |
| Emergency trigger | `POST /api/emergency/trigger` | User -> Emergency Release | Executes emergency flow and returns tx info | Not Run |
| Activity logging | `POST /api/activity/log` | Any tracked UI action | Stores activity event with metadata | Not Run |
| Activity recent list | `GET /api/activity/recent` | Dashboard/activity feed | Returns latest filtered events | Not Run |
| Activity summary | `GET /api/activity/summary` | Admin analytics widgets | Returns totals, alerts, and by-type stats | Not Run |
| User dashboard stats | `GET /api/stats/dashboard` | User dashboard load | Returns KPIs, charts, feed, forecast | Not Run |
| Admin stats | `GET /api/stats/admin` | Admin dashboard load | Returns risk heatmap and model indicators | Not Run |
| Structured request logging | Global middleware on `/api/*` | Trigger any backend API request | JSON line log includes requestId/method/route/status/latency/user/timestamp | Not Run |
| AI metrics logging | AI endpoints writing `ai-service/logs/metrics.jsonl` | Run phishing/txn/drift analyses | Appends one JSON line per inference with score/latency/mode | Not Run |
