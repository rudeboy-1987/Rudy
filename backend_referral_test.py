"""
Tests for the NEW referral / lead-acquisition endpoints.
Does NOT re-test previously verified marketplace endpoints.
"""
import os
import sys
import time
import uuid
import requests

BASE = os.environ.get(
    "BACKEND_URL",
    "https://estimate-pro-33.preview.emergentagent.com",
).rstrip("/") + "/api"

EMAIL = "test@contractor.com"
PASSWORD = "test123456"

results = []
def log(name, ok, detail=""):
    results.append((name, ok, detail))
    print(f"{'OK ' if ok else 'FAIL'} | {name} | {detail}")


def expect(cond, msg):
    if not cond:
        raise AssertionError(msg)


def login():
    r = requests.post(f"{BASE}/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=30)
    expect(r.status_code == 200, f"login {r.status_code} {r.text}")
    return r.json()["token"]


def auth_headers(tok):
    return {"Authorization": f"Bearer {tok}"}


def verify_email(email):
    r = requests.post(f"{BASE}/leads/verify/send", json={"channel": "email", "destination": email}, timeout=30)
    expect(r.status_code == 200, f"send email verify {r.status_code} {r.text}")
    data = r.json()
    expect("dev_code" in data, "dev_code expected for email (no SendGrid configured)")
    vid = data["verification_id"]
    code = data["dev_code"]
    r2 = requests.post(f"{BASE}/leads/verify/check", json={"verification_id": vid, "code": code}, timeout=30)
    expect(r2.status_code == 200 and r2.json().get("verified"), f"email check {r2.status_code} {r2.text}")
    return vid


def verify_sms(phone):
    r = requests.post(f"{BASE}/leads/verify/send", json={"channel": "sms", "destination": phone}, timeout=30)
    expect(r.status_code == 200, f"send sms verify {r.status_code} {r.text}")
    data = r.json()
    if "dev_code" not in data:
        # fallback: pull code from DB only when truly delivered (won't happen for fake number)
        raise AssertionError(f"dev_code expected for SMS fake number, got {data}")
    vid = data["verification_id"]
    code = data["dev_code"]
    r2 = requests.post(f"{BASE}/leads/verify/check", json={"verification_id": vid, "code": code}, timeout=30)
    expect(r2.status_code == 200 and r2.json().get("verified"), f"sms check {r2.status_code} {r2.text}")
    return vid


def post_lead(referral_code, budget=600, lead_email=None, lead_phone=None, expect_status=200):
    lead_email = lead_email or f"homeowner_{uuid.uuid4().hex[:8]}@example.com"
    lead_phone = lead_phone or "5555550199"
    e_vid = verify_email(lead_email)
    s_vid = verify_sms(lead_phone)
    payload = {
        "poster_name": "Jane Q. Homeowner",
        "poster_email": lead_email,
        "poster_phone": lead_phone,
        "poster_type": "homeowner",
        "title": "Need new outlet installed",
        "description": "Kitchen counter outlet needs to be upgraded to GFCI and one new run from panel.",
        "project_type": "residential",
        "urgency": "this_week",
        "estimated_budget": budget,
        "zip_code": "10001",
        "address": "100 Main St",
        "images": [],
        "email_verification_id": e_vid,
        "sms_verification_id": s_vid,
    }
    if referral_code is not None:
        payload["referral_code"] = referral_code
    r = requests.post(f"{BASE}/leads", json=payload, timeout=30)
    expect(r.status_code == expect_status, f"post_lead expected {expect_status}, got {r.status_code} {r.text}")
    return r.json()


def main():
    # 1. Login + /auth/me twice — same code
    tok = login()
    h = auth_headers(tok)

    r1 = requests.get(f"{BASE}/auth/me", headers=h, timeout=30)
    expect(r1.status_code == 200, f"/auth/me first {r1.status_code} {r1.text}")
    me1 = r1.json()
    expect("referral_code" in me1 and me1["referral_code"], "referral_code missing on /auth/me")
    code = me1["referral_code"]
    expect(len(code) == 6 and code.isupper() and code.isalnum(), f"bad code format: {code}")
    log("/auth/me returns referral_code (6 uppercase alphanumeric)", True, f"code={code}")

    r2 = requests.get(f"{BASE}/auth/me", headers=h, timeout=30)
    me2 = r2.json()
    expect(me2.get("referral_code") == code, f"code changed between calls: {me1} vs {me2}")
    log("/auth/me twice returns SAME code (persisted)", True, f"code={code}")

    # 2. Public referral lookup
    r = requests.get(f"{BASE}/leads-public/referral/{code}", timeout=30)
    expect(r.status_code == 200, f"public ref lookup valid {r.status_code} {r.text}")
    body = r.json()
    expect(body.get("referral_code") == code, f"ref code mismatch: {body}")
    expect("company_name" in body, "company_name missing")
    expect("logo" in body, "logo field missing")
    log("GET /leads-public/referral/{code} — 200 valid code", True, f"company={body.get('company_name')}")

    r = requests.get(f"{BASE}/leads-public/referral/ZZZZZZ", timeout=30)
    expect(r.status_code == 404, f"expected 404 for ZZZZZZ, got {r.status_code}")
    log("GET /leads-public/referral/ZZZZZZ — 404", True, "")

    r = requests.get(f"{BASE}/leads-public/referral/{code.lower()}", timeout=30)
    expect(r.status_code == 200, f"case-insensitive lookup failed {r.status_code} {r.text}")
    expect(r.json().get("referral_code") == code, "case-insensitive returns different code")
    log("Public referral lookup is case-insensitive", True, f"lower={code.lower()}")

    # 3. Initial source-stats
    r = requests.get(f"{BASE}/leads/source-stats", headers=h, timeout=30)
    expect(r.status_code == 200, f"source-stats {r.status_code} {r.text}")
    stats0 = r.json()
    expect(set(["referral_code", "total_leads", "leads_last_30d", "estimated_value"]).issubset(stats0.keys()),
           f"missing fields: {stats0}")
    expect(stats0["referral_code"] == code, f"ref code mismatch in stats: {stats0}")
    log("GET /leads/source-stats returns expected shape", True, f"stats={stats0}")

    initial_total = stats0["total_leads"]
    initial_value = stats0["estimated_value"]

    # 401 / 403 without auth
    r_noauth = requests.get(f"{BASE}/leads/source-stats", timeout=30)
    expect(r_noauth.status_code in (401, 403), f"unauth source-stats {r_noauth.status_code} {r_noauth.text}")
    log("source-stats requires auth (401/403 without token)", True, f"status={r_noauth.status_code}")

    # 4. POST /api/leads with valid referral_code, budget=600 → $7 tier
    posted = post_lead(referral_code=code, budget=600)
    expect(posted.get("success") and posted.get("tier") == "medium" and posted.get("lead_price") == 7.0,
           f"lead with ref code unexpected: {posted}")
    log("POST /leads with valid referral_code creates $7 medium lead", True, f"{posted}")

    # Verify the lead has source_ref fields by fetching feed/by-id
    new_lead_id = posted["lead_id"]
    r = requests.get(f"{BASE}/leads/{new_lead_id}", headers=h, timeout=30)
    expect(r.status_code == 200, f"GET /leads/{{id}} {r.status_code} {r.text}")
    lead_doc = r.json()
    expect(lead_doc.get("source_ref_code") == code, f"source_ref_code missing/mismatch: {lead_doc.get('source_ref_code')}")
    expect(lead_doc.get("source_ref_user_id") == me1["id"], f"source_ref_user_id mismatch: {lead_doc.get('source_ref_user_id')} vs {me1['id']}")
    log("Lead stored with source_ref_user_id + source_ref_code", True, f"ref_code={lead_doc.get('source_ref_code')}")

    # Smoke: route ordering preserved — /leads/{id} still works (already tested above)
    log("Route ordering: GET /leads/{lead_id} still returns lead (not stats)", True, f"id={new_lead_id}")

    # 5. source-stats should reflect new lead
    r = requests.get(f"{BASE}/leads/source-stats", headers=h, timeout=30)
    stats1 = r.json()
    expect(stats1["total_leads"] == initial_total + 1, f"total_leads not incremented: {stats0} → {stats1}")
    expect(round(stats1["estimated_value"], 2) == round(initial_value + 7.0, 2),
           f"estimated_value not +7: {initial_value} → {stats1['estimated_value']}")
    log("source-stats reflects +1 lead and +$7 after attributed post", True, f"{stats1}")

    # 6. POST /api/leads with invalid referral_code "BADCODE"
    posted2 = post_lead(referral_code="BADCODE", budget=600)
    expect(posted2.get("success"), f"invalid ref code should still create lead: {posted2}")
    r = requests.get(f"{BASE}/leads/{posted2['lead_id']}", headers=h, timeout=30)
    lead_doc2 = r.json()
    expect(lead_doc2.get("source_ref_user_id") is None, f"source_ref_user_id should be None for invalid code: {lead_doc2.get('source_ref_user_id')}")
    log("POST /leads with invalid referral_code: created, source_ref_user_id=None", True,
        f"source_ref_code={lead_doc2.get('source_ref_code')}")

    # stats unchanged
    r = requests.get(f"{BASE}/leads/source-stats", headers=h, timeout=30)
    stats2 = r.json()
    expect(stats2["total_leads"] == stats1["total_leads"] and stats2["estimated_value"] == stats1["estimated_value"],
           f"stats changed unexpectedly: {stats1} → {stats2}")
    log("source-stats unchanged after invalid-ref lead", True, f"{stats2}")

    # 7. POST /api/leads WITHOUT referral_code
    posted3 = post_lead(referral_code=None, budget=600)
    expect(posted3.get("success"), f"no ref lead should be created: {posted3}")
    r = requests.get(f"{BASE}/leads/{posted3['lead_id']}", headers=h, timeout=30)
    lead_doc3 = r.json()
    expect(lead_doc3.get("source_ref_user_id") is None, f"source_ref_user_id should be None without code: {lead_doc3.get('source_ref_user_id')}")
    log("POST /leads without referral_code: created, source_ref_user_id=None", True, "")

    r = requests.get(f"{BASE}/leads/source-stats", headers=h, timeout=30)
    stats3 = r.json()
    expect(stats3["total_leads"] == stats1["total_leads"], f"stats changed for no-ref lead: {stats3}")
    log("source-stats unchanged after no-ref lead", True, f"{stats3}")

    # 8. Route-ordering smoke: fetch a lead from feed, ensure GET /leads/{uuid} returns lead, not source-stats payload
    r = requests.get(f"{BASE}/leads/feed?zip=10001&radius=50", headers=h, timeout=30)
    expect(r.status_code == 200, f"feed {r.status_code}")
    feed = r.json()
    leads_list = feed.get("leads") if isinstance(feed, dict) else feed
    expect(leads_list and len(leads_list) > 0, "feed empty")
    some_id = leads_list[0]["id"]
    r = requests.get(f"{BASE}/leads/{some_id}", headers=h, timeout=30)
    expect(r.status_code == 200, f"GET /leads/{{uuid}} from feed: {r.status_code} {r.text}")
    body = r.json()
    expect("total_leads" not in body and "id" in body, f"got source-stats instead of lead: {body}")
    log("Route ordering smoke: GET /leads/<uuid_from_feed> returns lead, not stats", True, f"id={some_id}")

    # Summary
    fails = [(n, d) for n, ok, d in results if not ok]
    print("\n===== SUMMARY =====")
    print(f"Total: {len(results)}  Passed: {len(results) - len(fails)}  Failed: {len(fails)}")
    for n, d in fails:
        print(f"  FAIL: {n} — {d}")
    return 0 if not fails else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except AssertionError as e:
        print(f"ASSERT FAIL: {e}")
        sys.exit(2)
    except Exception as e:
        import traceback
        traceback.print_exc()
        sys.exit(3)
