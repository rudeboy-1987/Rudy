# Test Credentials

## Test Contractor Account (existing)
- Email: test@contractor.com
- Password: test123456
- Referral code: ZQA5QA

## Twilio (configured in backend/.env)
- Account SID: AC2661b7869bd70715f19d0aad4c820f64
- Phone Number: +18332428534

## SendGrid (NOT configured)
- Email verification falls back to returning `dev_code` in the response body.

## PayPal (LIVE mode)
- Verified live mode is enabled.
- Do NOT actually complete real payments in tests.

## Facebook Page Auto-Post (NOT YET CONNECTED)
- User needs to provide their own Page ID + Page Access Token via the /connect-facebook UI.
- Backend endpoints implemented and live:
  - GET  /api/social/facebook/status
  - POST /api/social/facebook/connect
  - POST /api/social/facebook/disconnect
  - POST /api/social/facebook/post
- Token is validated against Graph API v19.0 on connect.

## Emergent LLM (GPT-4o vision)
- Used by /api/ai/analyze-blueprint-v2 (electrical-only strict JSON output, accepts images + PDF)
- Used by /api/ai/blueprint-to-estimate (converts result into editable estimate)

## MongoDB
- mongodb://localhost:27017/test_database
- Collections: users, leads, lead_unlocks, verification_codes, blueprint_analyses, social_connections, estimates, jobs, materials
- 5 demo leads pre-seeded in NYC area zips
