# 🔐 EstimatePro — Credentials & API Keys Inventory

**KEEP THIS FILE PRIVATE.** Don't commit it to a public repo.

This is a complete list of every credential currently configured in your Emergent build, so you can recreate the same environment when you self-host.

---

## 1. 📞 Twilio (SMS verification)
- **Account SID:** `<YOUR_TWILIO_ACCOUNT_SID>`
- **Auth Token:** `<YOUR_TWILIO_AUTH_TOKEN>`
- **Phone Number:** `+18332428534`
- **Console:** https://console.twilio.com
- **What it powers:** SMS verification codes for the post-lead form (homeowner phone verification).
- **Action needed:** Verify your Twilio account is funded (every SMS ~$0.0075). Trial accounts can only text verified phones.

---

## 2. 💳 PayPal (LIVE mode)
- **Mode:** `live`
- **Client ID:** (you provided — check Render env vars or Ionos for the original)
- **Client Secret:** (same — should NOT be re-shared in chat)
- **Dashboard:** https://developer.paypal.com/dashboard
- **What it powers:** Subscription checkout, $4.99/mo plan, lead unlock payments ($5/$7/$10).
- **Action needed:**
  1. Log into PayPal Developer dashboard → your app
  2. Update **return URLs** from `estimate-pro-33.preview.emergentagent.com` → `https://donerightelectricltd.com`
  3. Re-test a small payment after deployment

---

## 3. 🤖 Emergent LLM Key (GPT-4o)
- **Where to get it:** Emergent dashboard → Profile (top-right) → "Universal Key"
- **What it powers:**
  - Smart Estimate AI (auto-fills materials & labor from text descriptions)
  - Blueprint AI Vision (extracts outlets, lighting, panels from uploaded blueprints)
- **Action needed:**
  - Copy your Universal Key from Emergent profile
  - Add to Render env as `EMERGENT_LLM_KEY=sk-emergent-...`
  - **If your Emergent subscription lapses**, this key may stop working. In that case:
    - Sign up for OpenAI API at https://platform.openai.com → get an `sk-...` key
    - Replace `emergentintegrations` calls in `server.py` with the official `openai` Python package
    - Estimated OpenAI cost: ~$0.01–0.05 per estimate. Very cheap.

---

## 4. 🍃 MongoDB (Database)
- **Current:** `mongodb://localhost:27017/test_database` (only available inside Emergent)
- **Production:** Get free MongoDB Atlas account → see DEPLOYMENT.md Step 2

---

## 5. 🔑 JWT Secret (Auth tokens)
- **Action needed:** Generate a new one for production
- **How:** Run `openssl rand -hex 32` in your terminal → use the output
- **Why:** Don't reuse Emergent's preview JWT secret in production (security best practice)

---

## 6. 📘 Facebook (Page auto-posting) — NOT YET CONNECTED
- **Page ID provided:** `1703868599702184`
- **Page Access Token:** NOT YET PROVIDED — user skipped this step
- **What you need to do when ready:**
  1. Go to https://developers.facebook.com/tools/explorer/
  2. Generate a token with `pages_manage_posts`, `pages_read_engagement` permissions
  3. Switch to "Page Access Token" for your "Done Right Electric" page
  4. Copy the token
  5. Open your deployed app → Dashboard → Grow → "Facebook Page auto-post"
  6. Paste the token + Page ID

---

## 7. 📧 SendGrid (Email) — NOT CONFIGURED
- **Status:** No API key provided
- **Current behavior:** Email verification returns a `dev_code` in the response body (testing-only)
- **To enable production emails:**
  1. Sign up at https://sendgrid.com → free tier = 100 emails/day
  2. Settings → API Keys → Create API Key → "Mail Send" scope only
  3. Copy the key starting with `SG.`
  4. Add to Render env as `SENDGRID_API_KEY=SG.xxxxx`
  5. Add `SENDER_EMAIL=noreply@donerightelectricltd.com` (or your verified sender email)
  6. **Verify sender:** SendGrid → Sender Authentication → Single Sender → verify your email
  7. **For best deliverability:** Verify your full domain (adds 3 DNS records in Ionos)

---

## 8. 🚀 Expo (Mobile native build, when ready) — Token set
- **EXPO_TOKEN:** `<YOUR_EXPO_TOKEN>`
- **Dashboard:** https://expo.dev
- **What it powers:** EAS Build (for compiling .ipa / .aab for App Store / Play Store later)
- **Action needed (only if you want a native app later):** Install EAS CLI on your machine → run `eas login` → `eas build --platform all`

---

## 9. 👤 Test Contractor Account (works in the seed DB)
- **Email:** `test@contractor.com`
- **Password:** `test123456`
- **Referral code:** `ZQA5QA`
- **Company:** Done Right Electric Ltd.
- **Phone:** (210) 393-4239
- **Note:** When you self-host with a fresh MongoDB, this user will be restored from the export bundle in `/export/db/test_database/users.bson`

---

## 10. 🌐 Domain
- **Owned at:** Ionos
- **Domain:** `donerightelectricltd.com` ✅ cleared and ready
- **Subdomain plan:**
  - `donerightelectricltd.com` → Vercel (frontend)
  - `www.donerightelectricltd.com` → CNAME to non-www
  - `api.donerightelectricltd.com` → Render (backend)

---

## 🧹 Optional Future Credentials

| Service | Used For | Cost |
|---|---|---|
| Google Search Console | SEO indexing | Free |
| Google Business Profile | Local search ranking | Free |
| Google Maps API | Embedded service area map | $0 if low traffic |
| Stripe (alternative to PayPal) | Card payments | 2.9% + $0.30 |
| Mapbox | Better maps than Google | Free up to 50K loads/mo |
| Mixpanel / PostHog | Track user behavior | Free tier |
| Sentry | Error tracking | Free up to 5K errors/mo |
