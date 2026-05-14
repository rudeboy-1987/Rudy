# Test Credentials

## Test Contractor Account (existing)
- Email: test@contractor.com
- Password: test123456

## Twilio (configured in backend/.env)
- Account SID: AC2661b7869bd70715f19d0aad4c820f64
- Phone Number: +18332428534
- SMS delivery is fully wired and should work for real US numbers.

## SendGrid (NOT configured)
- No SendGrid API key is set yet.
- Email verification falls back to returning `dev_code` in the response body.
- Use `response.dev_code` as the verification code in tests.

## PayPal (LIVE mode)
- Client ID and secret are set in backend/.env (PAYPAL_MODE=live).
- For testing PayPal flows, only verify that approval_url is returned by
  `/api/leads/{id}/unlock/create` — DO NOT actually complete real payments.

## MongoDB
- mongodb://localhost:27017/test_database
- 5 demo leads pre-seeded (look for `_demo: True`) in zips 10001, 10002, 10128, 11201, 07030.
