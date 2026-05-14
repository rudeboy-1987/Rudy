"""Backend test suite for Live Lead Marketplace endpoints.
Hits the public preview backend URL (EXPO_PUBLIC_BACKEND_URL/api).
"""
import os
import json
import time
import sys
import requests
from pathlib import Path

def get_backend_url():
    env_path = Path("/app/frontend/.env")
    for line in env_path.read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
            return line.split("=", 1)[1].strip().strip('"')
    raise SystemExit("Could not find EXPO_PUBLIC_BACKEND_URL")

BASE = get_backend_url().rstrip("/") + "/api"
print(f"Testing backend at: {BASE}")

PASS = []
FAIL = []

def record(name, ok, info=""):
    (PASS if ok else FAIL).append((name, info))
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name} - {info}")

def safe_json(resp):
    try:
        return resp.json()
    except Exception:
        return {"_raw": resp.text}


def smoke():
    r = requests.get(f"{BASE}/materials/prices", timeout=15)
    record("smoke:GET /materials/prices",
           r.status_code == 200 and isinstance(r.json(), list) and len(r.json()) > 0,
           f"status={r.status_code} count={len(r.json()) if r.status_code==200 else 'n/a'}")


def login():
    r = requests.post(f"{BASE}/auth/login",
                      json={"email": "test@contractor.com", "password": "test123456"},
                      timeout=15)
    ok = r.status_code == 200 and "token" in r.json()
    record("auth:POST /auth/login", ok, f"status={r.status_code}")
    if not ok:
        print("Cannot continue without login token:", r.text)
        sys.exit(1)
    return r.json()["token"]


def smoke_jobs(token):
    r = requests.get(f"{BASE}/jobs", headers={"Authorization": f"Bearer {token}"}, timeout=15)
    record("smoke:GET /jobs (auth)", r.status_code == 200, f"status={r.status_code}")


def zip_lookup():
    r = requests.get(f"{BASE}/leads-public/zip-lookup/10001", timeout=15)
    data = safe_json(r)
    ok = (
        r.status_code == 200
        and isinstance(data, dict)
        and data.get("lat") is not None
        and data.get("lng") is not None
        and data.get("state") == "NY"
    )
    record("public:zip-lookup/10001 valid", ok,
           f"status={r.status_code} city={data.get('city')} state={data.get('state')}")

    r2 = requests.get(f"{BASE}/leads-public/zip-lookup/00000", timeout=15)
    record("public:zip-lookup/00000 invalid → 404",
           r2.status_code == 404, f"status={r2.status_code}")


def verify_email_flow():
    r = requests.post(f"{BASE}/leads/verify/send",
                      json={"channel": "email", "destination": "homeowner.test@example.com"},
                      timeout=15)
    data = safe_json(r)
    ok = (
        r.status_code == 200
        and data.get("delivered") is False
        and data.get("delivery_mode") == "email_not_configured"
        and data.get("dev_code")
        and data.get("verification_id")
    )
    record("verify:send email returns dev_code", ok,
           f"status={r.status_code} delivered={data.get('delivered')} mode={data.get('delivery_mode')} dev_code_present={bool(data.get('dev_code'))}")
    return data if ok else None


def verify_sms_flow(phone="+15005550006"):
    r = requests.post(f"{BASE}/leads/verify/send",
                      json={"channel": "sms", "destination": phone},
                      timeout=20)
    data = safe_json(r)
    ok = (
        r.status_code == 200
        and data.get("verification_id")
        and (
            (data.get("delivered") is False and data.get("dev_code"))
            or data.get("delivered") is True
        )
    )
    record("verify:send sms (fake#) returns dev_code or delivered", ok,
           f"status={r.status_code} delivered={data.get('delivered')} mode={data.get('delivery_mode')} dev_code_present={bool(data.get('dev_code'))}")
    return data if ok else None


def verify_send_bad_channel():
    r = requests.post(f"{BASE}/leads/verify/send",
                      json={"channel": "foo", "destination": "x@y.z"},
                      timeout=15)
    record("verify:send bad channel → 400", r.status_code == 400, f"status={r.status_code}")


def verify_check_wrong_code(v_data):
    wrong = "000000" if v_data.get("dev_code") != "000000" else "111111"
    r = requests.post(f"{BASE}/leads/verify/check",
                      json={"verification_id": v_data["verification_id"], "code": wrong},
                      timeout=15)
    record("verify:check wrong code → 400", r.status_code == 400, f"status={r.status_code}")


def verify_check_unknown():
    r = requests.post(f"{BASE}/leads/verify/check",
                      json={"verification_id": "nonexistent-id-xyz", "code": "123456"},
                      timeout=15)
    record("verify:check unknown id → 404", r.status_code == 404, f"status={r.status_code}")


def verify_check_correct(v_data, label):
    r = requests.post(f"{BASE}/leads/verify/check",
                      json={"verification_id": v_data["verification_id"], "code": v_data["dev_code"]},
                      timeout=15)
    data = safe_json(r)
    ok = r.status_code == 200 and data.get("success") and data.get("verified")
    record(f"verify:check correct code ({label})", ok,
           f"status={r.status_code} body={data}")
    return ok


def verify_rate_limit():
    s = requests.post(f"{BASE}/leads/verify/send",
                      json={"channel": "email", "destination": "ratelimit.test@example.com"},
                      timeout=15)
    sd = safe_json(s)
    vid = sd.get("verification_id")
    if not vid:
        record("verify:rate_limit setup", False, "could not create verification")
        return
    statuses = []
    for i in range(5):
        rr = requests.post(f"{BASE}/leads/verify/check",
                           json={"verification_id": vid, "code": "999999"},
                           timeout=15)
        statuses.append(rr.status_code)
    rr = requests.post(f"{BASE}/leads/verify/check",
                       json={"verification_id": vid, "code": "999999"},
                       timeout=15)
    ok = rr.status_code == 429
    record("verify:check 6th attempt → 429", ok,
           f"first5={statuses} sixth={rr.status_code}")


def _send_verify_pair(email, phone):
    ev = requests.post(f"{BASE}/leads/verify/send",
                       json={"channel": "email", "destination": email}, timeout=15).json()
    sv = requests.post(f"{BASE}/leads/verify/send",
                       json={"channel": "sms", "destination": phone}, timeout=20).json()
    if ev.get("dev_code"):
        requests.post(f"{BASE}/leads/verify/check",
                      json={"verification_id": ev["verification_id"], "code": ev["dev_code"]}, timeout=15)
    if sv.get("dev_code"):
        requests.post(f"{BASE}/leads/verify/check",
                      json={"verification_id": sv["verification_id"], "code": sv["dev_code"]}, timeout=15)
    return ev, sv


def post_lead_full_flow():
    email = "sarah.homeowner@example.com"
    phone = "+12125550199"
    ev, sv = _send_verify_pair(email, phone)
    if not ev.get("dev_code") or not sv.get("dev_code"):
        record("lead:post setup (verify creation)", False,
               f"missing dev_code email={ev} sms={sv}")
        return None

    bad_body = {
        "poster_name": "Sarah Johnson",
        "poster_email": email,
        "poster_phone": phone,
        "poster_type": "homeowner",
        "title": "Install ceiling fan in master bedroom",
        "description": "Need a contractor to install a new ceiling fan with light.",
        "project_type": "residential",
        "urgency": "this_week",
        "estimated_budget": 350.0,
        "zip_code": "00000",
        "email_verification_id": ev["verification_id"],
        "sms_verification_id": sv["verification_id"],
    }
    r = requests.post(f"{BASE}/leads", json=bad_body, timeout=15)
    record("lead:post invalid zip → 400", r.status_code == 400, f"status={r.status_code}")

    mismatch = dict(bad_body)
    mismatch["poster_email"] = "wrong@example.com"
    mismatch["zip_code"] = "10001"
    r = requests.post(f"{BASE}/leads", json=mismatch, timeout=15)
    record("lead:post email mismatch → 400", r.status_code == 400, f"status={r.status_code}")

    body_small = dict(bad_body)
    body_small["zip_code"] = "10001"
    r = requests.post(f"{BASE}/leads", json=body_small, timeout=15)
    data = safe_json(r)
    ok = (
        r.status_code == 200
        and data.get("success")
        and data.get("lead_id")
        and data.get("lead_price") == 5.0
        and data.get("tier") == "small"
    )
    record("lead:post small budget ($350 → $5)", ok,
           f"status={r.status_code} price={data.get('lead_price')} tier={data.get('tier')}")
    lead_id_small = data.get("lead_id") if ok else None

    # Medium
    email2 = "mike.builder@example.com"
    phone2 = "+13105550133"
    ev2, sv2 = _send_verify_pair(email2, phone2)
    body_med = {
        "poster_name": "Mike Builder",
        "poster_email": email2,
        "poster_phone": phone2,
        "poster_type": "business",
        "title": "Office lighting retrofit (LED panels)",
        "description": "Replace 12 fluorescent fixtures with LED panels.",
        "project_type": "commercial",
        "urgency": "this_month",
        "estimated_budget": 1200.0,
        "zip_code": "11201",
        "email_verification_id": ev2["verification_id"],
        "sms_verification_id": sv2["verification_id"],
    }
    r = requests.post(f"{BASE}/leads", json=body_med, timeout=15)
    data = safe_json(r)
    ok_med = r.status_code == 200 and data.get("lead_price") == 7.0 and data.get("tier") == "medium"
    record("lead:post medium budget ($1200 → $7)", ok_med,
           f"status={r.status_code} price={data.get('lead_price')} tier={data.get('tier')}")
    lead_id_med = data.get("lead_id") if ok_med else None

    # Large
    email3 = "amy.contractor@example.com"
    phone3 = "+12125550234"
    ev3, sv3 = _send_verify_pair(email3, phone3)
    body_large = {
        "poster_name": "Amy Contractor",
        "poster_email": email3,
        "poster_phone": phone3,
        "poster_type": "business",
        "title": "Full house rewire (1920s colonial)",
        "description": "Complete rewire of 2200sqft home including new panel.",
        "project_type": "residential",
        "urgency": "flexible",
        "estimated_budget": 8500.0,
        "zip_code": "10128",
        "email_verification_id": ev3["verification_id"],
        "sms_verification_id": sv3["verification_id"],
    }
    r = requests.post(f"{BASE}/leads", json=body_large, timeout=15)
    data = safe_json(r)
    ok_large = r.status_code == 200 and data.get("lead_price") == 10.0 and data.get("tier") == "large"
    record("lead:post large budget ($8500 → $10)", ok_large,
           f"status={r.status_code} price={data.get('lead_price')} tier={data.get('tier')}")
    lead_id_large = data.get("lead_id") if ok_large else None

    return {"small": lead_id_small, "medium": lead_id_med, "large": lead_id_large}


def test_lead_with_unverified():
    ev = requests.post(f"{BASE}/leads/verify/send",
                       json={"channel": "email", "destination": "unverified@example.com"}, timeout=15).json()
    sv = requests.post(f"{BASE}/leads/verify/send",
                       json={"channel": "sms", "destination": "+12125550001"}, timeout=20).json()
    body = {
        "poster_name": "Test User",
        "poster_email": "unverified@example.com",
        "poster_phone": "+12125550001",
        "poster_type": "homeowner",
        "title": "Test",
        "description": "Test desc",
        "project_type": "residential",
        "urgency": "this_week",
        "estimated_budget": 300,
        "zip_code": "10001",
        "email_verification_id": ev["verification_id"],
        "sms_verification_id": sv["verification_id"],
    }
    r = requests.post(f"{BASE}/leads", json=body, timeout=15)
    record("lead:post unverified → 400", r.status_code == 400, f"status={r.status_code}")


def test_feed(token, lead_ids):
    h = {"Authorization": f"Bearer {token}"}
    r = requests.get(f"{BASE}/leads/feed", headers=h,
                     params={"zip": "10001", "radius": 50}, timeout=15)
    data = safe_json(r)
    ok = r.status_code == 200 and "leads" in data and data.get("radius_miles") == 50
    record("feed:GET /leads/feed zip=10001 radius=50", ok,
           f"status={r.status_code} count={data.get('count')}")
    if not ok:
        return
    leads = data["leads"]
    issues = []
    for ld in leads:
        if ld.get("is_unlocked") is not False:
            issues.append(f"is_unlocked != False on {ld.get('id')}")
        if ld.get("slots_remaining") is None:
            issues.append(f"slots_remaining missing on {ld.get('id')}")
        em = ld.get("poster_email") or ""
        if "@" not in em or "*" not in em:
            issues.append(f"email not masked: {em}")
        ph = ld.get("poster_phone") or ""
        if not ph.startswith("***"):
            issues.append(f"phone not masked: {ph}")
        if ld.get("distance_miles") is None:
            issues.append(f"distance missing on {ld.get('id')}")
    record("feed:masking + distance populated", len(issues) == 0,
           f"issues={issues[:3]} total_issues={len(issues)}")

    distances = [ld.get("distance_miles") for ld in leads if ld.get("distance_miles") is not None]
    sorted_ok = distances == sorted(distances)
    record("feed:sorted by distance ASC", sorted_ok, f"distances={distances[:5]}")

    r2 = requests.get(f"{BASE}/leads/feed", headers=h,
                      params={"zip": "10001", "radius": 500}, timeout=15)
    record("feed:radius=500 clamped to 200",
           r2.status_code == 200 and r2.json().get("radius_miles") == 200,
           f"radius_returned={r2.json().get('radius_miles')}")

    r3 = requests.get(f"{BASE}/leads/feed", headers=h,
                      params={"zip": "10001", "radius": 1}, timeout=15)
    d3 = r3.json()
    zips = [ld.get("zip_code") for ld in d3.get("leads", [])]
    record("feed:radius=1 from 10001 returns only 10001 leads",
           r3.status_code == 200 and all(z == "10001" for z in zips) and d3.get("count", 0) >= 1,
           f"count={d3.get('count')} zips={zips}")

    r4 = requests.get(f"{BASE}/leads/feed", headers=h,
                      params={"zip": "10001", "radius": 50, "project_type": "residential"}, timeout=15)
    d4 = r4.json()
    only_res = all(ld.get("project_type") == "residential" for ld in d4.get("leads", []))
    record("feed:project_type=residential filters correctly",
           r4.status_code == 200 and only_res and d4.get("count") <= data.get("count"),
           f"count={d4.get('count')} all_residential={only_res}")


def test_lead_detail(token, lead_ids):
    h = {"Authorization": f"Bearer {token}"}
    lid = lead_ids.get("small") if lead_ids else None
    if not lid:
        r = requests.get(f"{BASE}/leads/feed", headers=h, params={"zip": "10001", "radius": 50}, timeout=15)
        leads = r.json().get("leads", [])
        if not leads:
            record("detail:setup", False, "no lead to test")
            return
        lid = leads[0]["id"]

    r = requests.get(f"{BASE}/leads/{lid}", headers=h, timeout=15)
    data = safe_json(r)
    ok = r.status_code == 200 and data.get("is_unlocked") is False and "*" in (data.get("poster_email") or "")
    record("detail:GET /leads/{id} masked", ok,
           f"status={r.status_code} email={data.get('poster_email')}")

    r2 = requests.get(f"{BASE}/leads/nonexistent-uuid", headers=h, timeout=15)
    record("detail:GET /leads/{unknown} → 404", r2.status_code == 404, f"status={r2.status_code}")


def test_unlock_create(token, lead_ids):
    h = {"Authorization": f"Bearer {token}"}
    lid = lead_ids.get("medium") if lead_ids else None
    expected_price = 7.0
    if not lid:
        r = requests.get(f"{BASE}/leads/feed", headers=h, params={"zip": "10001", "radius": 50}, timeout=15)
        leads = r.json().get("leads", [])
        if not leads:
            record("unlock:setup", False, "no lead")
            return
        lid = leads[0]["id"]
        expected_price = leads[0].get("lead_price")

    r = requests.post(f"{BASE}/leads/{lid}/unlock/create", headers=h, timeout=20)
    data = safe_json(r)
    ok = (
        r.status_code == 200
        and data.get("success")
        and data.get("payment_id")
        and (data.get("approval_url") or "").startswith("https://www.paypal.com")
        and abs(data.get("amount", 0) - expected_price) < 0.01
        and data.get("lead_id") == lid
    )
    record("unlock:POST /leads/{id}/unlock/create", ok,
           f"status={r.status_code} amount={data.get('amount')} approval_url={data.get('approval_url','')[:50]}")

    r2 = requests.post(f"{BASE}/leads/{lid}/unlock/create", headers=h, timeout=20)
    d2 = safe_json(r2)
    ok2 = r2.status_code == 200 and d2.get("payment_id") and d2.get("payment_id") != data.get("payment_id")
    record("unlock:second create succeeds (no capture yet)", ok2,
           f"status={r2.status_code} new_payment_id={d2.get('payment_id')}")

    r3 = requests.post(f"{BASE}/leads/nonexistent-uuid/unlock/create", headers=h, timeout=15)
    record("unlock:create unknown lead → 404", r3.status_code == 404, f"status={r3.status_code}")


def test_my_unlocked(token):
    h = {"Authorization": f"Bearer {token}"}
    r = requests.get(f"{BASE}/leads/my-unlocked", headers=h, timeout=15)
    data = safe_json(r)
    ok = r.status_code == 200 and "count" in data and "leads" in data
    record("my-unlocked:GET /leads/my-unlocked", ok,
           f"status={r.status_code} count={data.get('count')}")


def inspect_db_lead(lead_id):
    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient

    async def _run():
        c = AsyncIOMotorClient("mongodb://localhost:27017")
        db = c["test_database"]
        return await db.leads.find_one({"id": lead_id})

    return asyncio.new_event_loop().run_until_complete(_run())


def test_db_state(lead_ids):
    if not lead_ids or not lead_ids.get("small"):
        record("db:lead state", False, "no lead_id to inspect")
        return
    ld = inspect_db_lead(lead_ids["small"])
    ok = (
        ld is not None
        and ld.get("status") == "open"
        and ld.get("max_unlocks") == 5
        and ld.get("unlocked_by") == []
        and ld.get("lat") is not None
        and ld.get("lng") is not None
    )
    record("db:created lead has correct shape", ok,
           f"status={ld.get('status') if ld else 'None'} max_unlocks={ld.get('max_unlocks') if ld else 'None'} lat={ld.get('lat') if ld else 'None'}")


if __name__ == "__main__":
    smoke()
    token = login()
    smoke_jobs(token)
    zip_lookup()
    verify_send_bad_channel()
    verify_check_unknown()

    em_v = verify_email_flow()
    sm_v = verify_sms_flow()
    if em_v:
        verify_check_wrong_code(em_v)
        verify_check_correct(em_v, "email")
    if sm_v and sm_v.get("dev_code"):
        verify_check_correct(sm_v, "sms")
    verify_rate_limit()

    lead_ids = post_lead_full_flow() or {}
    test_lead_with_unverified()
    test_feed(token, lead_ids)
    test_lead_detail(token, lead_ids)
    test_unlock_create(token, lead_ids)
    test_my_unlocked(token)
    test_db_state(lead_ids)

    print(f"\n{'='*60}")
    print(f"PASSED: {len(PASS)} / FAILED: {len(FAIL)}")
    if FAIL:
        print("\nFAILURES:")
        for n, i in FAIL:
            print(f"  - {n}: {i}")
    sys.exit(0 if not FAIL else 1)
