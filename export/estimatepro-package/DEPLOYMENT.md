# 🚀 EstimatePro / Done Right Electric — Self-Hosting Deployment Guide

**Total cost: $0–10/month for the entire production stack (free tiers).**

You built a full-stack app on Emergent. This guide takes you from "I have the GitHub repo" → "live at https://donerightelectricltd.com" in about 60–90 minutes.

---

## 📋 Architecture Overview

```
              ┌────────────────────────────┐
   Customer → │  donerightelectricltd.com  │  (Vercel — static web)
              └─────────┬──────────────────┘
                        │ API calls
                        ▼
              ┌────────────────────────────┐
              │  api.donerightelectric…    │  (Render.com — FastAPI)
              └─────────┬──────────────────┘
                        │
                        ▼
              ┌────────────────────────────┐
              │  MongoDB Atlas (free tier) │
              └────────────────────────────┘
```

---

## 🟢 STEP 1: Save the latest code to GitHub

In your Emergent chat window:
1. Click **"Save to GitHub"** (top of the chat — looks like a GitHub logo or "Save")
2. If first time, connect your GitHub account
3. Pick a repo (e.g., `estimatepro` — new or existing)
4. Click **"PUSH TO GITHUB"**
5. Verify on github.com that your repo now has `/backend`, `/frontend`, `/export`, and this DEPLOYMENT.md

---

## 🟢 STEP 2: Get free MongoDB Atlas (~10 minutes)

1. Go to https://www.mongodb.com/cloud/atlas/register → create free account
2. **Build a Database** → pick **"M0 — Free, 512 MB"**
3. Choose region closest to you (e.g., AWS / Dallas for SA, TX)
4. Cluster name: `estimatepro` → Create
5. **Database Access** → Add Database User
   - Username: `estimatepro_app`
   - Password: click "Autogenerate Secure Password" → **COPY IT**
   - Role: Atlas Admin (simplest)
6. **Network Access** → Add IP Address → **"Allow Access from Anywhere"** (0.0.0.0/0) for now (tighten later)
7. **Connect** → "Drivers" → copy the connection string
   ```
   mongodb+srv://estimatepro_app:<password>@estimatepro.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   Replace `<password>` with the password you copied.

### Restore your seed data:
On your local machine (must have `mongorestore` installed):
```bash
# Clone the GitHub repo first
git clone https://github.com/YOUR_USERNAME/estimatepro.git
cd estimatepro

# Restore from the included DB export
mongorestore --uri="mongodb+srv://estimatepro_app:PASSWORD@estimatepro.xxxxx.mongodb.net" --nsFrom='test_database.*' --nsTo='estimatepro.*' export/db/test_database
```

(Don't have mongorestore? Install MongoDB Database Tools from https://www.mongodb.com/try/download/database-tools — free.)

---

## 🟢 STEP 3: Deploy backend on Render (free tier, ~10 minutes)

1. Go to https://render.com → sign up with GitHub
2. **New** → **Web Service** → connect your `estimatepro` repo
3. Configure:
   - **Name:** `estimatepro-api`
   - **Region:** Oregon (or closest)
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - **Instance Type:** Free
4. **Environment Variables** → click "Advanced" → add ALL of these (copy from your `.env.example`):

   | Key | Value |
   |---|---|
   | `MONGO_URL` | Your Atlas connection string with `/estimatepro` at the end |
   | `JWT_SECRET` | Run `openssl rand -hex 32` and paste the output |
   | `EMERGENT_LLM_KEY` | Get from Emergent → Profile → Universal Key (paste it) |
   | `PAYPAL_MODE` | `live` |
   | `PAYPAL_CLIENT_ID` | Your PayPal client ID |
   | `PAYPAL_CLIENT_SECRET` | Your PayPal client secret |
   | `TWILIO_ACCOUNT_SID` | `AC2661b7869bd70715f19d0aad4c820f64` |
   | `TWILIO_AUTH_TOKEN` | `b333b208995267a4860a9644a3b1de5f` |
   | `TWILIO_PHONE_NUMBER` | `+18332428534` |
   | `CORS_ORIGINS` | `https://donerightelectricltd.com,https://www.donerightelectricltd.com` |

5. Click **"Create Web Service"** → wait ~3 min
6. Your API will be live at `https://estimatepro-api.onrender.com` — write this down
7. Test it: visit `https://estimatepro-api.onrender.com/api/health` → should return `{"status":"healthy"}`

### 🔗 Connect your subdomain (`api.donerightelectricltd.com`):
- In Render dashboard → your service → **Settings** → **Custom Domains** → "Add Custom Domain"
- Enter `api.donerightelectricltd.com`
- Render gives you a CNAME target (e.g., `estimatepro-api.onrender.com`)
- In Ionos DNS → add a **CNAME**: `api → estimatepro-api.onrender.com`
- Save → wait 5 min → HTTPS auto-provisioned ✅

---

## 🟢 STEP 4: Deploy frontend on Vercel (free, ~10 minutes)

1. Go to https://vercel.com → sign up with GitHub
2. **Add New** → **Project** → Import your `estimatepro` repo
3. Configure:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Other (or "Expo" if shown)
   - **Build Command:** `npx expo export -p web`
   - **Output Directory:** `dist`
   - **Install Command:** `yarn install`
4. **Environment Variables** → add:
   - `EXPO_PUBLIC_BACKEND_URL` = `https://api.donerightelectricltd.com`
5. Click **"Deploy"** → wait ~5 min
6. Your frontend is live at `https://estimatepro-XYZ.vercel.app`

### 🔗 Connect your main domain (`donerightelectricltd.com`):
- In Vercel project → **Settings** → **Domains**
- Add `donerightelectricltd.com` → Vercel shows DNS records
- In Ionos DNS:
  - **Delete** all default A records and the www CNAME
  - **Add A record:** `@ → 76.76.21.21` (or whatever Vercel shows)
  - **Add CNAME:** `www → cname.vercel-dns.com`
- Save → wait 5–15 min → HTTPS auto-provisioned ✅

---

## 🟢 STEP 5: Final checks

Visit each URL and verify:

- [ ] `https://donerightelectricltd.com` → loads your green landing page
- [ ] `https://www.donerightelectricltd.com` → redirects to non-www
- [ ] Click "Get a free quote" → opens post-lead form
- [ ] `https://api.donerightelectricltd.com/api/health` → returns `{"status":"healthy"}`
- [ ] `https://donerightelectricltd.com/(auth)/login` → contractor login works
- [ ] Log in with `test@contractor.com` / `test123456` → dashboard loads
- [ ] Smart Estimate AI works (creates an estimate)
- [ ] Live Leads tab loads (shows 9 demo leads in NYC area + your San Antonio ones)

---

## 💸 Total Monthly Cost

| Service | Cost | Notes |
|---|---|---|
| Ionos domain | $1/mo | You already pay this |
| MongoDB Atlas | $0 | Free M0 tier (512MB) |
| Render.com backend | $0 | Free tier, sleeps after 15min idle (cold start ~30s) |
| Vercel frontend | $0 | Free tier |
| Twilio SMS | ~$0.0075/SMS | Pay per use |
| Emergent LLM key | $0 if Emergent sub active | Otherwise swap to OpenAI direct |
| PayPal | 2.9% + $0.30 per tx | Standard rate |
| **Total fixed** | **~$1/month** | |

### Upgrade later if needed:
- Render **Starter** $7/mo removes the cold start (recommended once you have real traffic)
- MongoDB **M2** $9/mo upgrades to 2GB + automated backups

---

## 🆘 Things to Watch Out For

1. **Emergent LLM Key** — verify it still works from your self-hosted backend. If it gives auth errors, swap to your own OpenAI API key (search for `EMERGENT_LLM_KEY` in server.py and use the `openai` package directly).

2. **Render free tier sleeps after 15 min** — your first request after idle takes ~30s. For production, upgrade to $7/mo Starter to keep it warm.

3. **CORS** — if your frontend calls fail with CORS errors, double-check `CORS_ORIGINS` in Render env vars matches your actual domains exactly.

4. **CI=true in production** — when deploying to Vercel, you DON'T want CI=true. Make sure that env var is NOT set on Vercel (it's only for the Emergent preview environment).

5. **PayPal redirect URLs** — log into PayPal Developer → your app → update the return/cancel URLs from the Emergent preview URL to `https://donerightelectricltd.com`.

6. **Twilio phone number** — `+18332428534` is a trial number; verify it works with real SMS or upgrade your Twilio account.

---

## 📞 Need Help?

- **Render docs:** https://render.com/docs
- **Vercel docs:** https://vercel.com/docs
- **MongoDB Atlas docs:** https://www.mongodb.com/docs/atlas/
- **Ionos DNS help:** https://www.ionos.com/help/domains/configuring-cname-records-for-subdomains/
- **Emergent support:** support@emergent.sh (for code export issues)

---

## 🎯 Once Live — SEO Quick Wins

1. **Google Search Console** — https://search.google.com/search-console → add your domain → submit `sitemap.xml`
2. **Google Business Profile** — https://business.google.com → link `donerightelectricltd.com` to your Google Maps listing (HUGE for local rankings)
3. **Bing Webmaster Tools** — https://www.bing.com/webmasters
4. **Update Facebook/Nextdoor/Instagram** bios with the new domain
5. **Print business cards** with the new URL + your QR code

🟢 **You're done. Go land some leads!** ⚡

— EstimatePro deployment, generated for Done Right Electric Ltd.
