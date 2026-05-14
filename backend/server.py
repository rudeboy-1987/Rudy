from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
import bcrypt
import jwt
from datetime import datetime, timedelta
import base64
import json
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

# PayPal SDK
import paypalrestsdk

# Optional: SendGrid for emails (if API key is provided)
try:
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail
    SENDGRID_AVAILABLE = True
except ImportError:
    SENDGRID_AVAILABLE = False

# Twilio for SMS verification
try:
    from twilio.rest import Client as TwilioClient
    TWILIO_AVAILABLE = True
except ImportError:
    TWILIO_AVAILABLE = False

# pgeocode for zip-code geolocation
try:
    import pgeocode
    _nomi = pgeocode.Nominatim('us')
    GEO_AVAILABLE = True
except Exception:
    GEO_AVAILABLE = False
    _nomi = None

# SMTP fallback for email
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import random
import math

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'default-secret-key')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Create the main app
app = FastAPI(title="Electrical Estimator API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ===================== MODELS =====================

class UserCreate(BaseModel):
    email: str
    password: str
    company_name: str
    phone: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class UserProfile(BaseModel):
    id: str
    email: str
    company_name: str
    phone: Optional[str] = None
    bio: Optional[str] = None
    logo: Optional[str] = None  # Base64 encoded
    subscription_tier: str = "free_trial"  # free_trial, basic, premium
    subscription_start: Optional[datetime] = None
    trial_end: Optional[datetime] = None
    created_at: datetime

class UserProfileUpdate(BaseModel):
    company_name: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    logo: Optional[str] = None

class MaterialItem(BaseModel):
    name: str
    unit: str
    quantity: float
    unit_price: float
    total: float

class LaborItem(BaseModel):
    description: str
    hours: float
    rate: float
    total: float

class EquipmentItem(BaseModel):
    name: str
    days: float
    daily_rate: float
    total: float

class EstimateCreate(BaseModel):
    project_name: str
    project_type: str  # residential, commercial
    client_name: str
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    address: Optional[str] = None
    description: Optional[str] = None
    materials: List[MaterialItem] = []
    labor: List[LaborItem] = []
    equipment: List[EquipmentItem] = []
    overhead_percentage: float = 10.0
    profit_percentage: float = 15.0
    notes: Optional[str] = None

class Estimate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    project_name: str
    project_type: str
    client_name: str
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    address: Optional[str] = None
    description: Optional[str] = None
    materials: List[MaterialItem] = []
    labor: List[LaborItem] = []
    equipment: List[EquipmentItem] = []
    materials_total: float = 0.0
    labor_total: float = 0.0
    equipment_total: float = 0.0
    subtotal: float = 0.0
    overhead_percentage: float = 10.0
    overhead_amount: float = 0.0
    profit_percentage: float = 15.0
    profit_amount: float = 0.0
    grand_total: float = 0.0
    notes: Optional[str] = None
    ai_analysis: Optional[str] = None
    blueprint_data: Optional[str] = None
    status: str = "draft"  # draft, sent, accepted, rejected
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class JobPosting(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    poster_type: str  # homeowner, business
    poster_name: str
    poster_email: str
    poster_phone: Optional[str] = None
    title: str
    description: str
    project_type: str  # residential, commercial
    location: str
    budget_range: Optional[str] = None
    timeline: Optional[str] = None
    status: str = "open"  # open, in_progress, completed, closed
    images: List[str] = []  # Base64 encoded images
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class JobPostingCreate(BaseModel):
    poster_type: str
    poster_name: str
    poster_email: str
    poster_phone: Optional[str] = None
    title: str
    description: str
    project_type: str
    location: str
    budget_range: Optional[str] = None
    timeline: Optional[str] = None
    images: List[str] = []

class MaterialPrice(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category: str  # wire, conduit, boxes, fixtures, etc.
    name: str
    unit: str
    price: float
    description: Optional[str] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class AIAnalysisRequest(BaseModel):
    blueprint_base64: Optional[str] = None
    project_description: str
    project_type: str

class SendEstimateRequest(BaseModel):
    estimate_id: str
    recipient_email: str
    message: Optional[str] = None

# ===================== NEW MODELS FOR PAYMENTS & AI ANALYZER =====================

class ProjectAnalyzerRequest(BaseModel):
    """Request for AI to analyze project description and generate estimate breakdown"""
    project_description: str
    project_type: str  # residential, commercial
    client_name: Optional[str] = None
    address: Optional[str] = None

class ProjectAnalyzerResponse(BaseModel):
    """AI-generated estimate breakdown from project description"""
    project_name: str
    materials: List[Dict[str, Any]]
    labor: List[Dict[str, Any]]
    equipment: List[Dict[str, Any]]
    summary: str
    estimated_total: float

class SubscriptionCheckoutRequest(BaseModel):
    """Request to create Stripe checkout for subscription"""
    tier: str  # basic, premium
    origin_url: str

class PaymentStatusRequest(BaseModel):
    """Request to check payment status"""
    session_id: str

# ===================== HELPER FUNCTIONS =====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        user = await db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def calculate_estimate_totals(estimate: dict) -> dict:
    materials_total = sum(item.get('total', 0) for item in estimate.get('materials', []))
    labor_total = sum(item.get('total', 0) for item in estimate.get('labor', []))
    equipment_total = sum(item.get('total', 0) for item in estimate.get('equipment', []))
    
    subtotal = materials_total + labor_total + equipment_total
    overhead_amount = subtotal * (estimate.get('overhead_percentage', 10) / 100)
    profit_amount = (subtotal + overhead_amount) * (estimate.get('profit_percentage', 15) / 100)
    grand_total = subtotal + overhead_amount + profit_amount
    
    return {
        "materials_total": round(materials_total, 2),
        "labor_total": round(labor_total, 2),
        "equipment_total": round(equipment_total, 2),
        "subtotal": round(subtotal, 2),
        "overhead_amount": round(overhead_amount, 2),
        "profit_amount": round(profit_amount, 2),
        "grand_total": round(grand_total, 2)
    }

# ===================== AUTH ENDPOINTS =====================

@api_router.post("/auth/register")
async def register(user: UserCreate):
    existing = await db.users.find_one({"email": user.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    now = datetime.utcnow()
    trial_end = now + timedelta(days=30)
    
    user_doc = {
        "id": user_id,
        "email": user.email.lower(),
        "password": hash_password(user.password),
        "company_name": user.company_name,
        "phone": user.phone,
        "bio": None,
        "logo": None,
        "subscription_tier": "free_trial",
        "subscription_start": now,
        "trial_end": trial_end,
        "created_at": now
    }
    
    await db.users.insert_one(user_doc)
    token = create_token(user_id)
    
    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": user.email.lower(),
            "company_name": user.company_name,
            "subscription_tier": "free_trial",
            "trial_end": trial_end.isoformat()
        }
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email.lower()})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"])
    
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "company_name": user["company_name"],
            "subscription_tier": user.get("subscription_tier", "free_trial"),
            "trial_end": user.get("trial_end", "").isoformat() if user.get("trial_end") else None
        }
    }

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "company_name": current_user["company_name"],
        "phone": current_user.get("phone"),
        "bio": current_user.get("bio"),
        "logo": current_user.get("logo"),
        "subscription_tier": current_user.get("subscription_tier", "free_trial"),
        "trial_end": current_user.get("trial_end", "").isoformat() if current_user.get("trial_end") else None,
        "created_at": current_user.get("created_at", "").isoformat() if current_user.get("created_at") else None
    }

@api_router.put("/auth/profile")
async def update_profile(update: UserProfileUpdate, current_user: dict = Depends(get_current_user)):
    update_dict = {k: v for k, v in update.dict().items() if v is not None}
    if update_dict:
        await db.users.update_one({"id": current_user["id"]}, {"$set": update_dict})
    
    updated_user = await db.users.find_one({"id": current_user["id"]})
    return {
        "id": updated_user["id"],
        "email": updated_user["email"],
        "company_name": updated_user["company_name"],
        "phone": updated_user.get("phone"),
        "bio": updated_user.get("bio"),
        "logo": updated_user.get("logo"),
        "subscription_tier": updated_user.get("subscription_tier", "free_trial")
    }

# ===================== SUBSCRIPTION ENDPOINTS (MOCKED) =====================

@api_router.post("/subscription/upgrade")
async def upgrade_subscription(tier: str, current_user: dict = Depends(get_current_user)):
    """MOCKED: Upgrade subscription tier"""
    if tier not in ["basic", "premium"]:
        raise HTTPException(status_code=400, detail="Invalid tier. Choose 'basic' or 'premium'")
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"subscription_tier": tier, "subscription_start": datetime.utcnow()}}
    )
    
    price = "$4.99/month" if tier == "basic" else "$19.99/month"
    return {
        "message": f"[MOCKED] Subscription upgraded to {tier} ({price})",
        "tier": tier,
        "note": "Payment integration would be handled by Stripe in production"
    }

@api_router.get("/subscription/status")
async def get_subscription_status(current_user: dict = Depends(get_current_user)):
    tier = current_user.get("subscription_tier", "free_trial")
    trial_end = current_user.get("trial_end")
    
    is_trial_active = False
    days_remaining = 0
    
    if tier == "free_trial" and trial_end:
        now = datetime.utcnow()
        if trial_end > now:
            is_trial_active = True
            days_remaining = (trial_end - now).days
    
    return {
        "tier": tier,
        "is_trial_active": is_trial_active,
        "days_remaining": days_remaining,
        "features": {
            "free_trial": ["Create estimates", "AI assistance", "Blueprint analysis", "Company profile"],
            "basic": ["All free trial features", "Unlimited estimates", "Email estimates"],
            "premium": ["All basic features", "Job board access", "Priority support", "Advanced analytics"]
        }.get(tier, [])
    }

# ===================== ESTIMATE ENDPOINTS =====================

@api_router.post("/estimates")
async def create_estimate(estimate_data: EstimateCreate, current_user: dict = Depends(get_current_user)):
    estimate_dict = estimate_data.dict()
    estimate_dict["id"] = str(uuid.uuid4())
    estimate_dict["user_id"] = current_user["id"]
    estimate_dict["created_at"] = datetime.utcnow()
    estimate_dict["updated_at"] = datetime.utcnow()
    estimate_dict["status"] = "draft"
    
    # Calculate totals
    totals = calculate_estimate_totals(estimate_dict)
    estimate_dict.update(totals)
    
    await db.estimates.insert_one(estimate_dict)
    estimate_dict.pop("_id", None)
    return estimate_dict

@api_router.get("/estimates")
async def get_estimates(current_user: dict = Depends(get_current_user)):
    estimates = await db.estimates.find({"user_id": current_user["id"]}).sort("created_at", -1).to_list(100)
    for est in estimates:
        est.pop("_id", None)
    return estimates

@api_router.get("/estimates/{estimate_id}")
async def get_estimate(estimate_id: str, current_user: dict = Depends(get_current_user)):
    estimate = await db.estimates.find_one({"id": estimate_id, "user_id": current_user["id"]})
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")
    estimate.pop("_id", None)
    return estimate

@api_router.put("/estimates/{estimate_id}")
async def update_estimate(estimate_id: str, estimate_data: EstimateCreate, current_user: dict = Depends(get_current_user)):
    existing = await db.estimates.find_one({"id": estimate_id, "user_id": current_user["id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Estimate not found")
    
    update_dict = estimate_data.dict()
    update_dict["updated_at"] = datetime.utcnow()
    
    # Calculate totals
    totals = calculate_estimate_totals(update_dict)
    update_dict.update(totals)
    
    await db.estimates.update_one({"id": estimate_id}, {"$set": update_dict})
    
    updated = await db.estimates.find_one({"id": estimate_id})
    updated.pop("_id", None)
    return updated

@api_router.delete("/estimates/{estimate_id}")
async def delete_estimate(estimate_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.estimates.delete_one({"id": estimate_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Estimate not found")
    return {"message": "Estimate deleted"}

@api_router.post("/estimates/{estimate_id}/send")
async def send_estimate(estimate_id: str, request: SendEstimateRequest, current_user: dict = Depends(get_current_user)):
    """MOCKED: Send estimate via email"""
    estimate = await db.estimates.find_one({"id": estimate_id, "user_id": current_user["id"]})
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")
    
    # Update status to sent
    await db.estimates.update_one({"id": estimate_id}, {"$set": {"status": "sent", "updated_at": datetime.utcnow()}})
    
    return {
        "message": f"[MOCKED] Estimate sent to {request.recipient_email}",
        "estimate_id": estimate_id,
        "note": "Email integration would be handled by SendGrid/Mailgun in production"
    }

# ===================== AI ANALYSIS ENDPOINTS =====================

@api_router.post("/ai/analyze-blueprint")
async def analyze_blueprint(request: AIAnalysisRequest, current_user: dict = Depends(get_current_user)):
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="AI service not configured")
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"blueprint-{current_user['id']}-{uuid.uuid4()}",
            system_message="""You are an expert electrical estimator AI assistant. 
            Analyze blueprints and project descriptions to provide detailed estimates for electrical work.
            When analyzing blueprints, identify:
            - Number and types of outlets needed
            - Lighting fixtures and their specifications
            - Panel requirements and circuit breakers
            - Wire gauge and lengths needed
            - Conduit requirements
            - Special equipment (HVAC connections, EV chargers, etc.)
            
            Provide estimates in a structured format with materials, labor hours, and equipment needs.
            Be thorough but practical in your analysis."""
        ).with_model("openai", "gpt-4o")
        
        message_text = f"""Please analyze this {request.project_type} electrical project and provide a detailed estimate breakdown:

Project Description: {request.project_description}

Please provide:
1. Recommended materials with quantities and typical costs
2. Estimated labor hours by task
3. Required equipment
4. Safety considerations
5. Code compliance notes
6. Total estimated cost range

Format your response clearly with sections for easy parsing."""

        if request.blueprint_base64:
            # Include image in analysis
            image_content = ImageContent(image_base64=request.blueprint_base64)
            user_message = UserMessage(text=message_text, images=[image_content])
        else:
            user_message = UserMessage(text=message_text)
        
        response = await chat.send_message(user_message)
        
        return {
            "analysis": response,
            "project_type": request.project_type
        }
    except Exception as e:
        logger.error(f"AI analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")

@api_router.post("/ai/generate-estimate")
async def generate_ai_estimate(estimate_id: str, current_user: dict = Depends(get_current_user)):
    try:
        estimate = await db.estimates.find_one({"id": estimate_id, "user_id": current_user["id"]})
        if not estimate:
            raise HTTPException(status_code=404, detail="Estimate not found")
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="AI service not configured")
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"estimate-{estimate_id}",
            system_message="""You are an expert electrical estimator AI assistant.
            Generate professional, detailed estimate descriptions that contractors can send to clients.
            Be professional, thorough, and clear in your explanations."""
        ).with_model("openai", "gpt-4o")
        
        materials_list = "\n".join([f"- {m.get('name')}: {m.get('quantity')} {m.get('unit')} @ ${m.get('unit_price')} = ${m.get('total')}" 
                                    for m in estimate.get('materials', [])])
        labor_list = "\n".join([f"- {l.get('description')}: {l.get('hours')} hrs @ ${l.get('rate')}/hr = ${l.get('total')}" 
                                for l in estimate.get('labor', [])])
        
        prompt = f"""Generate a professional estimate document for this electrical project:

Project: {estimate.get('project_name')}
Type: {estimate.get('project_type')}
Client: {estimate.get('client_name')}
Address: {estimate.get('address', 'Not specified')}
Description: {estimate.get('description', 'Not provided')}

Materials:
{materials_list if materials_list else 'None listed'}

Labor:
{labor_list if labor_list else 'None listed'}

Totals:
- Materials: ${estimate.get('materials_total', 0):.2f}
- Labor: ${estimate.get('labor_total', 0):.2f}
- Equipment: ${estimate.get('equipment_total', 0):.2f}
- Overhead ({estimate.get('overhead_percentage', 10)}%): ${estimate.get('overhead_amount', 0):.2f}
- Profit ({estimate.get('profit_percentage', 15)}%): ${estimate.get('profit_amount', 0):.2f}
- Grand Total: ${estimate.get('grand_total', 0):.2f}

Please generate a professional estimate document including:
1. Project overview and scope of work
2. Detailed materials breakdown
3. Labor breakdown
4. Timeline estimate
5. Terms and conditions
6. Warranty information

Make it professional and ready to send to a client."""

        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Save AI analysis to estimate
        await db.estimates.update_one(
            {"id": estimate_id},
            {"$set": {"ai_analysis": response, "updated_at": datetime.utcnow()}}
        )
        
        return {
            "estimate_id": estimate_id,
            "ai_document": response
        }
    except Exception as e:
        logger.error(f"AI estimate generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")

# ===================== AI PROJECT ANALYZER - Natural Language to Estimate =====================

@api_router.post("/ai/analyze-project")
async def analyze_project_description(request: ProjectAnalyzerRequest, current_user: dict = Depends(get_current_user)):
    """
    Analyze a natural language project description and generate a detailed estimate breakdown.
    User describes what they need in plain English, AI breaks it down into materials, labor, and equipment.
    """
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="AI service not configured")
        
        # Fetch current material prices from database for accurate pricing
        material_prices = await db.material_prices.find({}).to_list(100)
        price_reference = "\n".join([f"- {m['name']}: ${m['price']}/{m['unit']}" for m in material_prices])
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"project-analyzer-{current_user['id']}-{uuid.uuid4()}",
            system_message=f"""You are an expert electrical estimator AI. Your job is to analyze project descriptions 
            and break them down into detailed estimates with materials, labor, and equipment.

            CURRENT MATERIAL PRICES (use these for accuracy):
            {price_reference}
            
            For labor, use standard rates:
            - Journeyman electrician: $75/hour
            - Apprentice: $45/hour
            - Master electrician: $95/hour
            
            When analyzing a project:
            1. Identify all required materials with quantities
            2. Estimate labor hours by task
            3. List any equipment rentals needed
            4. Be thorough but realistic
            
            RESPOND ONLY WITH VALID JSON in this exact format:
            {{
                "project_name": "Brief descriptive name",
                "materials": [
                    {{"name": "Material name", "unit": "unit type", "quantity": number, "unit_price": number, "total": number}}
                ],
                "labor": [
                    {{"description": "Task description", "hours": number, "rate": number, "total": number}}
                ],
                "equipment": [
                    {{"name": "Equipment name", "days": number, "daily_rate": number, "total": number}}
                ],
                "summary": "Brief summary of the work",
                "estimated_total": number
            }}"""
        ).with_model("openai", "gpt-4o")
        
        prompt = f"""Analyze this {request.project_type} electrical project and create a detailed estimate breakdown:

PROJECT DESCRIPTION:
{request.project_description}

Create a comprehensive estimate with all materials, labor, and equipment needed. 
Be specific about quantities and use realistic pricing.
Respond ONLY with the JSON format specified."""

        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Try to parse the JSON response
        try:
            # Clean up the response in case it has markdown code blocks
            clean_response = response.strip()
            if clean_response.startswith("```json"):
                clean_response = clean_response[7:]
            if clean_response.startswith("```"):
                clean_response = clean_response[3:]
            if clean_response.endswith("```"):
                clean_response = clean_response[:-3]
            clean_response = clean_response.strip()
            
            estimate_data = json.loads(clean_response)
            
            # Calculate totals if not provided
            materials_total = sum(
                m.get('total', 0) if isinstance(m.get('total'), (int, float)) else m.get('quantity', 0) * m.get('unit_price', 0)
                for m in estimate_data.get('materials', [])
            )
            labor_total = sum(
                l.get('total', 0) if isinstance(l.get('total'), (int, float)) else l.get('hours', 0) * l.get('rate', 0)
                for l in estimate_data.get('labor', [])
            )
            equipment_total = sum(
                e.get('total', 0) if isinstance(e.get('total'), (int, float)) else e.get('days', 0) * e.get('daily_rate', 0)
                for e in estimate_data.get('equipment', [])
            )
            
            # Add overhead and profit
            subtotal = materials_total + labor_total + equipment_total
            overhead = subtotal * 0.10
            profit = (subtotal + overhead) * 0.15
            grand_total = subtotal + overhead + profit
            
            return {
                "success": True,
                "project_name": estimate_data.get('project_name', 'Electrical Project'),
                "materials": estimate_data.get('materials', []),
                "labor": estimate_data.get('labor', []),
                "equipment": estimate_data.get('equipment', []),
                "summary": estimate_data.get('summary', ''),
                "totals": {
                    "materials": round(materials_total, 2),
                    "labor": round(labor_total, 2),
                    "equipment": round(equipment_total, 2),
                    "subtotal": round(subtotal, 2),
                    "overhead": round(overhead, 2),
                    "profit": round(profit, 2),
                    "grand_total": round(grand_total, 2)
                },
                "client_name": request.client_name,
                "address": request.address,
                "project_type": request.project_type
            }
        except json.JSONDecodeError:
            # Return the raw AI analysis if JSON parsing fails
            return {
                "success": False,
                "raw_analysis": response,
                "message": "AI provided analysis but couldn't generate structured data. Please review the analysis."
            }
            
    except Exception as e:
        logger.error(f"AI project analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")

# ===================== PAYPAL PAYMENT ENDPOINTS =====================

# Configure PayPal
def configure_paypal():
    paypal_client_id = os.environ.get('PAYPAL_CLIENT_ID')
    paypal_secret = os.environ.get('PAYPAL_CLIENT_SECRET')
    paypal_mode = os.environ.get('PAYPAL_MODE', 'sandbox')
    
    if paypal_client_id and paypal_secret:
        paypalrestsdk.configure({
            "mode": paypal_mode,  # "sandbox" or "live"
            "client_id": paypal_client_id,
            "client_secret": paypal_secret
        })
        return True
    return False

@api_router.post("/payments/checkout")
async def create_paypal_payment(request: SubscriptionCheckoutRequest, http_request: Request, current_user: dict = Depends(get_current_user)):
    """Create a PayPal payment for subscription"""
    try:
        if not configure_paypal():
            return {
                "success": False,
                "mocked": True,
                "message": "PayPal not configured. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to .env",
                "tier": request.tier,
                "price": SUBSCRIPTION_PACKAGES.get(request.tier, {}).get('price', 0)
            }
        
        if request.tier not in SUBSCRIPTION_PACKAGES:
            raise HTTPException(status_code=400, detail="Invalid subscription tier")
        
        package = SUBSCRIPTION_PACKAGES[request.tier]
        
        # Create PayPal payment
        payment = paypalrestsdk.Payment({
            "intent": "sale",
            "payer": {
                "payment_method": "paypal"
            },
            "redirect_urls": {
                "return_url": f"{request.origin_url}/payment-success",
                "cancel_url": f"{request.origin_url}/(tabs)/profile"
            },
            "transactions": [{
                "item_list": {
                    "items": [{
                        "name": package['name'],
                        "sku": request.tier,
                        "price": str(package['price']),
                        "currency": "USD",
                        "quantity": 1
                    }]
                },
                "amount": {
                    "total": str(package['price']),
                    "currency": "USD"
                },
                "description": f"EstimatePro {package['name']} Subscription"
            }]
        })
        
        if payment.create():
            # Store payment info in database
            transaction = {
                "id": str(uuid.uuid4()),
                "paypal_payment_id": payment.id,
                "user_id": current_user["id"],
                "user_email": current_user["email"],
                "tier": request.tier,
                "amount": package['price'],
                "currency": "USD",
                "status": "created",
                "payment_status": "pending",
                "created_at": datetime.utcnow()
            }
            await db.payment_transactions.insert_one(transaction)
            
            # Find approval URL
            approval_url = None
            for link in payment.links:
                if link.rel == "approval_url":
                    approval_url = link.href
                    break
            
            return {
                "success": True,
                "payment_id": payment.id,
                "approval_url": approval_url
            }
        else:
            logger.error(f"PayPal payment creation failed: {payment.error}")
            raise HTTPException(status_code=500, detail=f"PayPal error: {payment.error}")
            
    except Exception as e:
        logger.error(f"PayPal checkout error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Payment processing failed: {str(e)}")

@api_router.post("/payments/execute")
async def execute_paypal_payment(payment_id: str, payer_id: str, current_user: dict = Depends(get_current_user)):
    """Execute a PayPal payment after user approval"""
    try:
        if not configure_paypal():
            return {"success": False, "mocked": True, "message": "PayPal not configured"}
        
        payment = paypalrestsdk.Payment.find(payment_id)
        
        if payment.execute({"payer_id": payer_id}):
            # Find transaction and update
            transaction = await db.payment_transactions.find_one({"paypal_payment_id": payment_id})
            
            if transaction:
                tier = transaction.get("tier", "basic")
                
                # Update user subscription
                await db.users.update_one(
                    {"id": current_user["id"]},
                    {"$set": {"subscription_tier": tier, "subscription_start": datetime.utcnow()}}
                )
                
                # Update transaction
                await db.payment_transactions.update_one(
                    {"paypal_payment_id": payment_id},
                    {"$set": {"status": "completed", "payment_status": "paid", "updated_at": datetime.utcnow()}}
                )
            
            return {
                "success": True,
                "message": "Payment completed successfully!",
                "tier": transaction.get("tier") if transaction else "basic"
            }
        else:
            logger.error(f"PayPal payment execution failed: {payment.error}")
            return {"success": False, "error": payment.error}
            
    except Exception as e:
        logger.error(f"PayPal execute error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Payment execution failed: {str(e)}")

@api_router.get("/payments/status/{payment_id}")
async def get_paypal_payment_status(payment_id: str, current_user: dict = Depends(get_current_user)):
    """Check the status of a PayPal payment"""
    try:
        # Check database first
        transaction = await db.payment_transactions.find_one({"paypal_payment_id": payment_id})
        if transaction:
            return {
                "success": True,
                "status": transaction.get("status"),
                "payment_status": transaction.get("payment_status"),
                "tier": transaction.get("tier"),
                "amount": transaction.get("amount")
            }
        
        if not configure_paypal():
            return {"success": False, "mocked": True, "message": "PayPal not configured"}
        
        payment = paypalrestsdk.Payment.find(payment_id)
        
        return {
            "success": True,
            "status": payment.state,
            "payment_id": payment.id
        }
        
    except Exception as e:
        logger.error(f"PayPal status check error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to check payment status: {str(e)}")

@api_router.get("/payments/config")
async def get_paypal_config():
    """Get PayPal client ID for frontend"""
    client_id = os.environ.get('PAYPAL_CLIENT_ID')
    if client_id:
        return {"client_id": client_id, "configured": True}
    return {"client_id": None, "configured": False}

# ===================== SENDGRID EMAIL ENDPOINTS =====================

@api_router.post("/estimates/{estimate_id}/email")
async def email_estimate(estimate_id: str, request: SendEstimateRequest, current_user: dict = Depends(get_current_user)):
    """Send estimate via email using SendGrid"""
    try:
        estimate = await db.estimates.find_one({"id": estimate_id, "user_id": current_user["id"]})
        if not estimate:
            raise HTTPException(status_code=404, detail="Estimate not found")
        
        sendgrid_api_key = os.environ.get('SENDGRID_API_KEY')
        sender_email = os.environ.get('SENDER_EMAIL', 'noreply@estimatepro.com')
        
        if not sendgrid_api_key or not SENDGRID_AVAILABLE:
            # Update status but return mocked response
            await db.estimates.update_one(
                {"id": estimate_id},
                {"$set": {"status": "sent", "updated_at": datetime.utcnow()}}
            )
            return {
                "success": False,
                "mocked": True,
                "message": f"[MOCKED] Email would be sent to {request.recipient_email}. Add SENDGRID_API_KEY to .env to enable real emails.",
                "estimate_id": estimate_id
            }
        
        # Build HTML email content
        materials_html = "".join([
            f"<tr><td>{m.get('name')}</td><td>{m.get('quantity')} {m.get('unit')}</td><td>${m.get('unit_price')}</td><td>${m.get('total')}</td></tr>"
            for m in estimate.get('materials', [])
        ])
        
        labor_html = "".join([
            f"<tr><td>{l.get('description')}</td><td>{l.get('hours')} hrs</td><td>${l.get('rate')}/hr</td><td>${l.get('total')}</td></tr>"
            for l in estimate.get('labor', [])
        ])
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
            <div style="background: #f59e0b; color: white; padding: 20px; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0;">Electrical Estimate</h1>
                <p style="margin: 5px 0 0 0;">{estimate.get('project_name')}</p>
            </div>
            
            <div style="background: #f5f5f5; padding: 20px; border: 1px solid #ddd;">
                <h2>Project Details</h2>
                <p><strong>Client:</strong> {estimate.get('client_name')}</p>
                <p><strong>Address:</strong> {estimate.get('address', 'Not specified')}</p>
                <p><strong>Type:</strong> {estimate.get('project_type', '').title()}</p>
                <p><strong>Description:</strong> {estimate.get('description', 'No description provided')}</p>
                
                {f"<h2>Materials</h2><table style='width:100%; border-collapse: collapse;'><tr style='background:#ddd;'><th>Item</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>{materials_html}</table>" if materials_html else ""}
                
                {f"<h2>Labor</h2><table style='width:100%; border-collapse: collapse;'><tr style='background:#ddd;'><th>Description</th><th>Hours</th><th>Rate</th><th>Total</th></tr>{labor_html}</table>" if labor_html else ""}
                
                <div style="background: #1f2937; color: white; padding: 20px; margin-top: 20px; border-radius: 10px;">
                    <h2 style="margin-top: 0;">Cost Summary</h2>
                    <p>Materials: ${estimate.get('materials_total', 0):.2f}</p>
                    <p>Labor: ${estimate.get('labor_total', 0):.2f}</p>
                    <p>Equipment: ${estimate.get('equipment_total', 0):.2f}</p>
                    <p>Overhead ({estimate.get('overhead_percentage', 10)}%): ${estimate.get('overhead_amount', 0):.2f}</p>
                    <p>Profit ({estimate.get('profit_percentage', 15)}%): ${estimate.get('profit_amount', 0):.2f}</p>
                    <hr style="border-color: #f59e0b;">
                    <h2 style="color: #f59e0b;">Grand Total: ${estimate.get('grand_total', 0):,.2f}</h2>
                </div>
                
                {f"<div style='margin-top: 20px; padding: 15px; background: white; border-radius: 10px;'><p><strong>Message from contractor:</strong></p><p>{request.message}</p></div>" if request.message else ""}
                
                <p style="margin-top: 20px; color: #666; font-size: 12px;">
                    This estimate was sent by {current_user.get('company_name')} via EstimatePro.
                </p>
            </div>
        </body>
        </html>
        """
        
        message = Mail(
            from_email=sender_email,
            to_emails=request.recipient_email,
            subject=f"Electrical Estimate: {estimate.get('project_name')} - ${estimate.get('grand_total', 0):,.2f}",
            html_content=html_content
        )
        
        sg = SendGridAPIClient(sendgrid_api_key)
        response = sg.send(message)
        
        if response.status_code == 202:
            await db.estimates.update_one(
                {"id": estimate_id},
                {"$set": {"status": "sent", "updated_at": datetime.utcnow()}}
            )
            return {
                "success": True,
                "message": f"Estimate sent successfully to {request.recipient_email}",
                "estimate_id": estimate_id
            }
        else:
            raise Exception(f"SendGrid returned status {response.status_code}")
            
    except Exception as e:
        logger.error(f"Email sending error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

# ===================== MATERIAL PRICES ENDPOINTS =====================

# Subscription pricing (defined server-side for security)
SUBSCRIPTION_PACKAGES = {
    "basic": {"price": 4.99, "name": "Basic Plan", "features": ["Unlimited estimates", "Email estimates", "AI assistance"]},
    "premium": {"price": 19.99, "name": "Premium Plan", "features": ["All Basic features", "Job board access", "Priority support"]}
}

@api_router.get("/materials/prices")
async def get_material_prices(category: Optional[str] = None):
    query = {"category": category} if category else {}
    prices = await db.material_prices.find(query).to_list(500)
    for p in prices:
        p.pop("_id", None)
    return prices

@api_router.post("/materials/prices/seed")
async def seed_material_prices():
    """Seed initial material prices for common electrical materials"""
    materials = [
        # Wire & Cable
        {"category": "wire", "name": "14/2 NM-B Wire (250ft)", "unit": "roll", "price": 85.00, "description": "General purpose 15-amp circuits"},
        {"category": "wire", "name": "12/2 NM-B Wire (250ft)", "unit": "roll", "price": 125.00, "description": "General purpose 20-amp circuits"},
        {"category": "wire", "name": "10/2 NM-B Wire (100ft)", "unit": "roll", "price": 95.00, "description": "30-amp circuits"},
        {"category": "wire", "name": "6/3 NM-B Wire (50ft)", "unit": "roll", "price": 145.00, "description": "50-amp circuits"},
        {"category": "wire", "name": "THHN Wire 12AWG (500ft)", "unit": "spool", "price": 175.00, "description": "Conduit wire"},
        
        # Conduit
        {"category": "conduit", "name": "1/2\" EMT Conduit (10ft)", "unit": "piece", "price": 8.50, "description": "Electrical metallic tubing"},
        {"category": "conduit", "name": "3/4\" EMT Conduit (10ft)", "unit": "piece", "price": 12.00, "description": "Electrical metallic tubing"},
        {"category": "conduit", "name": "1\" EMT Conduit (10ft)", "unit": "piece", "price": 18.50, "description": "Electrical metallic tubing"},
        {"category": "conduit", "name": "1/2\" PVC Conduit (10ft)", "unit": "piece", "price": 4.50, "description": "PVC conduit"},
        
        # Boxes & Covers
        {"category": "boxes", "name": "Single Gang Plastic Box", "unit": "each", "price": 1.25, "description": "Standard switch/outlet box"},
        {"category": "boxes", "name": "Double Gang Plastic Box", "unit": "each", "price": 2.50, "description": "Double device box"},
        {"category": "boxes", "name": "4\" Square Metal Box", "unit": "each", "price": 3.75, "description": "Junction box"},
        {"category": "boxes", "name": "Weatherproof Box", "unit": "each", "price": 12.00, "description": "Outdoor rated"},
        
        # Outlets & Switches
        {"category": "devices", "name": "Standard Outlet (15A)", "unit": "each", "price": 2.50, "description": "Duplex receptacle"},
        {"category": "devices", "name": "GFCI Outlet", "unit": "each", "price": 18.00, "description": "Ground fault protected"},
        {"category": "devices", "name": "20A Outlet", "unit": "each", "price": 4.50, "description": "Heavy duty receptacle"},
        {"category": "devices", "name": "Single Pole Switch", "unit": "each", "price": 2.75, "description": "Standard light switch"},
        {"category": "devices", "name": "3-Way Switch", "unit": "each", "price": 5.50, "description": "Multi-location control"},
        {"category": "devices", "name": "Dimmer Switch", "unit": "each", "price": 25.00, "description": "LED compatible"},
        
        # Panels & Breakers
        {"category": "panels", "name": "200A Main Panel", "unit": "each", "price": 350.00, "description": "40 space panel"},
        {"category": "panels", "name": "100A Sub Panel", "unit": "each", "price": 175.00, "description": "20 space panel"},
        {"category": "panels", "name": "15A Circuit Breaker", "unit": "each", "price": 8.00, "description": "Single pole"},
        {"category": "panels", "name": "20A Circuit Breaker", "unit": "each", "price": 9.00, "description": "Single pole"},
        {"category": "panels", "name": "30A Circuit Breaker", "unit": "each", "price": 15.00, "description": "Double pole"},
        {"category": "panels", "name": "50A Circuit Breaker", "unit": "each", "price": 28.00, "description": "Double pole"},
        {"category": "panels", "name": "AFCI Breaker", "unit": "each", "price": 45.00, "description": "Arc fault protection"},
        
        # Lighting
        {"category": "lighting", "name": "LED Recessed Light 6\"", "unit": "each", "price": 35.00, "description": "IC rated, dimmable"},
        {"category": "lighting", "name": "LED Panel Light 2x4", "unit": "each", "price": 85.00, "description": "Commercial grade"},
        {"category": "lighting", "name": "Outdoor LED Fixture", "unit": "each", "price": 65.00, "description": "Wall mount"},
        {"category": "lighting", "name": "Ceiling Fan w/ Light", "unit": "each", "price": 175.00, "description": "Standard residential"},
        
        # Specialty
        {"category": "specialty", "name": "EV Charger (Level 2)", "unit": "each", "price": 650.00, "description": "240V, 40A"},
        {"category": "specialty", "name": "Whole House Surge Protector", "unit": "each", "price": 125.00, "description": "Panel mount"},
        {"category": "specialty", "name": "Generator Transfer Switch", "unit": "each", "price": 450.00, "description": "Manual 200A"},
        {"category": "specialty", "name": "Smart Thermostat", "unit": "each", "price": 185.00, "description": "WiFi enabled"},
    ]
    
    # Clear existing and insert new
    await db.material_prices.delete_many({})
    
    for mat in materials:
        mat["id"] = str(uuid.uuid4())
        mat["updated_at"] = datetime.utcnow()
    
    await db.material_prices.insert_many(materials)
    
    return {"message": f"Seeded {len(materials)} material prices", "count": len(materials)}

# ===================== LIVE LEAD MARKETPLACE ENDPOINTS =====================

class LeadCreate(BaseModel):
    poster_name: str
    poster_email: str
    poster_phone: str
    poster_type: str = "homeowner"  # homeowner, business
    title: str
    description: str
    project_type: str  # residential, commercial
    urgency: str = "this_week"  # emergency, this_week, this_month, flexible
    estimated_budget: float
    zip_code: str
    address: Optional[str] = None
    images: List[str] = []  # base64
    email_verification_id: Optional[str] = None
    sms_verification_id: Optional[str] = None

class VerificationSendRequest(BaseModel):
    channel: str  # "email" or "sms"
    destination: str  # email address or phone number

class VerificationCheckRequest(BaseModel):
    verification_id: str
    code: str


# --- Helper utilities for leads ---

def calculate_lead_price(estimated_budget: float) -> Dict[str, Any]:
    """Tiered lead pricing based on the homeowner's stated project budget."""
    if estimated_budget < 500:
        return {"tier": "small", "price": 5.00}
    elif estimated_budget < 2000:
        return {"tier": "medium", "price": 7.00}
    else:
        return {"tier": "large", "price": 10.00}


def lookup_zip(zip_code: str) -> Dict[str, Any]:
    """Convert US zip to lat/lng/city/state using pgeocode."""
    if not GEO_AVAILABLE or not _nomi:
        return {"lat": None, "lng": None, "city": None, "state": None}
    try:
        z = str(zip_code).strip()[:5]
        res = _nomi.query_postal_code(z)
        if res is None or (hasattr(res, 'latitude') and (res.latitude != res.latitude)):  # NaN check
            return {"lat": None, "lng": None, "city": None, "state": None}
        lat = float(res.latitude) if res.latitude == res.latitude else None
        lng = float(res.longitude) if res.longitude == res.longitude else None
        city = res.place_name if isinstance(res.place_name, str) else None
        state = res.state_code if isinstance(res.state_code, str) else None
        return {"lat": lat, "lng": lng, "city": city, "state": state}
    except Exception as e:
        logger.warning(f"Zip lookup failed for {zip_code}: {e}")
        return {"lat": None, "lng": None, "city": None, "state": None}


def haversine_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two points in miles."""
    R = 3958.7613  # Earth radius in miles
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def mask_email(email: str) -> str:
    if not email or '@' not in email:
        return "******"
    name, domain = email.split('@', 1)
    if len(name) <= 2:
        masked_name = name[0] + '*'
    else:
        masked_name = name[0] + '*' * (len(name) - 2) + name[-1]
    return f"{masked_name}@{domain}"


def mask_phone(phone: str) -> str:
    if not phone:
        return "***-***-****"
    digits = ''.join(c for c in phone if c.isdigit())
    if len(digits) < 4:
        return "***-***-****"
    return "***-***-" + digits[-4:]


def serialize_lead(lead: dict, contractor_id: Optional[str] = None) -> dict:
    """Return lead with masked contact info unless this contractor has unlocked it."""
    lead.pop("_id", None)
    unlocked = bool(contractor_id and contractor_id in lead.get("unlocked_by", []))
    if not unlocked:
        lead["poster_email"] = mask_email(lead.get("poster_email", ""))
        lead["poster_phone"] = mask_phone(lead.get("poster_phone", ""))
        lead["address"] = None  # only revealed after unlock
        # hide last name for privacy
        name = (lead.get("poster_name") or "").split()
        if len(name) > 1:
            lead["poster_name"] = f"{name[0]} {name[-1][0]}."
    lead["is_unlocked"] = unlocked
    lead["slots_remaining"] = max(0, lead.get("max_unlocks", 5) - len(lead.get("unlocked_by", [])))
    lead["unlock_count"] = len(lead.get("unlocked_by", []))
    return lead


def send_email_via_smtp(to_email: str, subject: str, body: str) -> bool:
    """Fallback email sender via SMTP if SendGrid is not configured."""
    smtp_user = os.environ.get('SMTP_USER')
    smtp_pass = os.environ.get('SMTP_PASS')
    smtp_host = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
    smtp_port = int(os.environ.get('SMTP_PORT', '587'))
    if not smtp_user or not smtp_pass:
        return False
    try:
        msg = MIMEMultipart()
        msg['From'] = smtp_user
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        return True
    except Exception as e:
        logger.error(f"SMTP send failed: {e}")
        return False


def send_email_via_sendgrid(to_email: str, subject: str, html_body: str) -> bool:
    sendgrid_api_key = os.environ.get('SENDGRID_API_KEY')
    sender_email = os.environ.get('SENDER_EMAIL', 'noreply@estimatepro.com')
    if not sendgrid_api_key or not SENDGRID_AVAILABLE:
        return False
    try:
        message = Mail(from_email=sender_email, to_emails=to_email, subject=subject, html_content=html_body)
        sg = SendGridAPIClient(sendgrid_api_key)
        resp = sg.send(message)
        return resp.status_code in (200, 201, 202)
    except Exception as e:
        logger.error(f"SendGrid send failed: {e}")
        return False


# --- Verification endpoints (email + SMS) ---

@api_router.post("/leads/verify/send")
async def lead_verify_send(req: VerificationSendRequest):
    """Send a 6-digit verification code via email or SMS."""
    if req.channel not in ("email", "sms"):
        raise HTTPException(status_code=400, detail="channel must be 'email' or 'sms'")

    code = f"{random.randint(0, 999999):06d}"
    verification_id = str(uuid.uuid4())
    now = datetime.utcnow()
    expires = now + timedelta(minutes=10)

    doc = {
        "id": verification_id,
        "channel": req.channel,
        "destination": req.destination.strip(),
        "code": code,
        "verified": False,
        "attempts": 0,
        "created_at": now,
        "expires_at": expires,
    }
    await db.verification_codes.insert_one(doc)

    delivered = False
    delivery_mode = "test"

    if req.channel == "sms":
        sid = os.environ.get('TWILIO_ACCOUNT_SID')
        token = os.environ.get('TWILIO_AUTH_TOKEN')
        from_num = os.environ.get('TWILIO_PHONE_NUMBER')
        if TWILIO_AVAILABLE and sid and token and from_num:
            try:
                tc = TwilioClient(sid, token)
                # Normalize phone to E.164 if it looks like a US number
                to_num = req.destination.strip()
                digits = ''.join(c for c in to_num if c.isdigit() or c == '+')
                if not digits.startswith('+'):
                    if len(digits) == 10:
                        digits = '+1' + digits
                    elif len(digits) == 11 and digits.startswith('1'):
                        digits = '+' + digits
                tc.messages.create(
                    body=f"Your EstimatePro verification code is: {code} (valid 10 min)",
                    from_=from_num,
                    to=digits,
                )
                delivered = True
                delivery_mode = "twilio"
            except Exception as e:
                logger.error(f"Twilio SMS failed: {e}")
                delivery_mode = "twilio_failed"
        else:
            delivery_mode = "twilio_not_configured"
    else:
        # email
        subject = "Your EstimatePro verification code"
        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;">
          <h2 style="color:#00ff66;">EstimatePro Verification</h2>
          <p>Your verification code is:</p>
          <div style="font-size:32px;font-weight:bold;letter-spacing:6px;background:#0a0a0a;color:#00ff66;padding:16px;text-align:center;border-radius:8px;">{code}</div>
          <p style="color:#666;font-size:13px;">This code is valid for 10 minutes.</p>
        </div>
        """
        body_text = f"Your EstimatePro verification code is: {code} (valid 10 min)"
        if send_email_via_sendgrid(req.destination, subject, html):
            delivered = True
            delivery_mode = "sendgrid"
        elif send_email_via_smtp(req.destination, subject, body_text):
            delivered = True
            delivery_mode = "smtp"
        else:
            delivery_mode = "email_not_configured"

    response = {
        "success": True,
        "verification_id": verification_id,
        "channel": req.channel,
        "delivered": delivered,
        "delivery_mode": delivery_mode,
        "expires_at": expires.isoformat(),
    }
    # In dev/test mode where delivery is not configured, return the code so the flow can still be tested.
    if not delivered:
        response["dev_code"] = code
        response["message"] = (
            "Verification code generated. Delivery not configured for this channel; "
            "use the dev_code for testing (and configure Twilio/SendGrid for production)."
        )
    return response


@api_router.post("/leads/verify/check")
async def lead_verify_check(req: VerificationCheckRequest):
    """Verify a 6-digit code. Returns a token verification_id that can be used in lead creation."""
    record = await db.verification_codes.find_one({"id": req.verification_id})
    if not record:
        raise HTTPException(status_code=404, detail="Verification not found")
    if record.get("verified"):
        return {"success": True, "verified": True, "verification_id": req.verification_id, "channel": record["channel"]}
    if record.get("expires_at") and record["expires_at"] < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Verification code expired")
    if record.get("attempts", 0) >= 5:
        raise HTTPException(status_code=429, detail="Too many attempts")
    if str(req.code).strip() != record["code"]:
        await db.verification_codes.update_one({"id": req.verification_id}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="Invalid code")
    await db.verification_codes.update_one(
        {"id": req.verification_id},
        {"$set": {"verified": True, "verified_at": datetime.utcnow()}},
    )
    return {"success": True, "verified": True, "verification_id": req.verification_id, "channel": record["channel"]}


# --- Lead posting (PUBLIC: no auth required) ---

@api_router.post("/leads")
async def post_lead(lead: LeadCreate):
    """Public endpoint for any visitor or registered customer to post a lead.
    Requires both email and SMS verification IDs that have been confirmed.
    """
    # Validate verifications
    if not lead.email_verification_id or not lead.sms_verification_id:
        raise HTTPException(status_code=400, detail="Email and SMS verification are required")

    email_v = await db.verification_codes.find_one({"id": lead.email_verification_id})
    sms_v = await db.verification_codes.find_one({"id": lead.sms_verification_id})
    if not email_v or not email_v.get("verified") or email_v.get("channel") != "email":
        raise HTTPException(status_code=400, detail="Email not verified")
    if not sms_v or not sms_v.get("verified") or sms_v.get("channel") != "sms":
        raise HTTPException(status_code=400, detail="Phone not verified")
    # Ensure verifications match the contact info
    if (email_v.get("destination") or "").lower().strip() != lead.poster_email.lower().strip():
        raise HTTPException(status_code=400, detail="Email verification doesn't match provided email")

    # Geo lookup
    geo = lookup_zip(lead.zip_code)
    if not geo["lat"]:
        raise HTTPException(status_code=400, detail="Invalid US zip code")

    pricing = calculate_lead_price(lead.estimated_budget)

    lead_doc = {
        "id": str(uuid.uuid4()),
        "poster_name": lead.poster_name.strip(),
        "poster_email": lead.poster_email.lower().strip(),
        "poster_phone": lead.poster_phone.strip(),
        "poster_type": lead.poster_type,
        "email_verified": True,
        "phone_verified": True,
        "title": lead.title.strip(),
        "description": lead.description.strip(),
        "project_type": lead.project_type,
        "urgency": lead.urgency,
        "estimated_budget": float(lead.estimated_budget),
        "lead_price": pricing["price"],
        "tier": pricing["tier"],
        "zip_code": lead.zip_code.strip()[:5],
        "city": geo["city"],
        "state": geo["state"],
        "lat": geo["lat"],
        "lng": geo["lng"],
        "address": (lead.address or "").strip() or None,
        "images": lead.images or [],
        "unlocked_by": [],
        "max_unlocks": 5,
        "status": "open",  # open, locked (5 unlocks reached), closed
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    await db.leads.insert_one(lead_doc)
    lead_doc.pop("_id", None)
    return {
        "success": True,
        "lead_id": lead_doc["id"],
        "lead_price": pricing["price"],
        "tier": pricing["tier"],
        "message": "Lead posted successfully. Local contractors will be notified.",
    }


# --- Contractor feed with location radius ---

@api_router.get("/leads/feed")
async def leads_feed(
    zip: Optional[str] = None,
    radius: int = 50,
    project_type: Optional[str] = None,
    urgency: Optional[str] = None,
    min_budget: Optional[float] = None,
    max_budget: Optional[float] = None,
    current_user: dict = Depends(get_current_user),
):
    """Live feed of available leads filtered by contractor's location and preferences.
    Contact info is masked until the contractor unlocks (pays for) the lead.
    """
    radius = max(1, min(int(radius or 50), 200))  # clamp 1-200 miles

    # If contractor didn't pass a zip, try their profile (not stored today; skip).
    origin = None
    if zip:
        origin = lookup_zip(zip)

    query = {
        "status": "open",
        # Available = has at least 1 slot left
        "$expr": {"$lt": [{"$size": {"$ifNull": ["$unlocked_by", []]}}, "$max_unlocks"]},
    }
    if project_type and project_type != "all":
        query["project_type"] = project_type
    if urgency and urgency != "all":
        query["urgency"] = urgency
    if min_budget is not None:
        query["estimated_budget"] = {"$gte": float(min_budget)}
    if max_budget is not None:
        query.setdefault("estimated_budget", {})["$lte"] = float(max_budget)

    cursor = db.leads.find(query).sort("created_at", -1).limit(500)
    leads_list = await cursor.to_list(500)

    results = []
    for ld in leads_list:
        distance = None
        if origin and origin.get("lat") is not None and ld.get("lat") is not None:
            distance = haversine_miles(origin["lat"], origin["lng"], ld["lat"], ld["lng"])
            if distance > radius:
                continue
        ld_serial = serialize_lead(ld, contractor_id=current_user["id"])
        ld_serial["distance_miles"] = round(distance, 1) if distance is not None else None
        results.append(ld_serial)

    # Sort by distance if available, then by newest
    results.sort(key=lambda x: (x["distance_miles"] is None, x["distance_miles"] or 0))
    return {"count": len(results), "radius_miles": radius, "leads": results}


@api_router.get("/leads/my-unlocked")
async def my_unlocked_leads(current_user: dict = Depends(get_current_user)):
    """Returns leads the current contractor has paid to unlock (with full contact info)."""
    cursor = db.leads.find({"unlocked_by": current_user["id"]}).sort("updated_at", -1).limit(200)
    leads_list = await cursor.to_list(200)
    out = []
    for ld in leads_list:
        ld.pop("_id", None)
        ld["is_unlocked"] = True
        ld["slots_remaining"] = max(0, ld.get("max_unlocks", 5) - len(ld.get("unlocked_by", [])))
        ld["unlock_count"] = len(ld.get("unlocked_by", []))
        out.append(ld)
    return {"count": len(out), "leads": out}


@api_router.get("/leads/{lead_id}")
async def get_lead(lead_id: str, current_user: dict = Depends(get_current_user)):
    ld = await db.leads.find_one({"id": lead_id})
    if not ld:
        raise HTTPException(status_code=404, detail="Lead not found")
    return serialize_lead(ld, contractor_id=current_user["id"])


# --- Lead unlock (PayPal) ---

@api_router.post("/leads/{lead_id}/unlock/create")
async def create_lead_unlock_order(lead_id: str, http_request: Request, current_user: dict = Depends(get_current_user)):
    """Create a PayPal order to unlock contact details for one lead."""
    ld = await db.leads.find_one({"id": lead_id})
    if not ld:
        raise HTTPException(status_code=404, detail="Lead not found")

    if current_user["id"] in ld.get("unlocked_by", []):
        raise HTTPException(status_code=400, detail="You have already unlocked this lead")

    if len(ld.get("unlocked_by", [])) >= ld.get("max_unlocks", 5):
        raise HTTPException(status_code=409, detail="Lead is locked. 5 pros have already claimed it.")

    if not configure_paypal():
        raise HTTPException(status_code=500, detail="PayPal not configured")

    price = float(ld.get("lead_price", 5.0))

    origin = str(http_request.headers.get("origin") or http_request.headers.get("referer") or os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://example.com")).rstrip("/")

    payment = paypalrestsdk.Payment({
        "intent": "sale",
        "payer": {"payment_method": "paypal"},
        "redirect_urls": {
            "return_url": f"{origin}/lead-unlock-success?lead_id={lead_id}",
            "cancel_url": f"{origin}/(tabs)/jobs",
        },
        "transactions": [{
            "item_list": {
                "items": [{
                    "name": f"Lead unlock: {ld.get('title','Electrical lead')[:120]}",
                    "sku": f"lead-{lead_id}",
                    "price": f"{price:.2f}",
                    "currency": "USD",
                    "quantity": 1,
                }]
            },
            "amount": {"total": f"{price:.2f}", "currency": "USD"},
            "description": f"Unlock contact info for electrical lead in {ld.get('city') or ld.get('zip_code')}",
        }],
    })

    if payment.create():
        unlock_doc = {
            "id": str(uuid.uuid4()),
            "lead_id": lead_id,
            "contractor_id": current_user["id"],
            "contractor_email": current_user["email"],
            "paypal_payment_id": payment.id,
            "amount": price,
            "currency": "USD",
            "status": "created",
            "created_at": datetime.utcnow(),
        }
        await db.lead_unlocks.insert_one(unlock_doc)

        approval_url = next((l.href for l in payment.links if l.rel == "approval_url"), None)
        return {
            "success": True,
            "payment_id": payment.id,
            "approval_url": approval_url,
            "amount": price,
            "lead_id": lead_id,
        }
    else:
        logger.error(f"PayPal lead unlock create failed: {payment.error}")
        raise HTTPException(status_code=500, detail=f"PayPal error: {payment.error}")


@api_router.post("/leads/{lead_id}/unlock/capture")
async def capture_lead_unlock(
    lead_id: str,
    payment_id: str,
    payer_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Capture the PayPal payment and add contractor to lead's unlocked_by (max 5)."""
    ld = await db.leads.find_one({"id": lead_id})
    if not ld:
        raise HTTPException(status_code=404, detail="Lead not found")

    if not configure_paypal():
        raise HTTPException(status_code=500, detail="PayPal not configured")

    # Atomic check: if 5 already claimed, refund-not-possible note; refuse with 409.
    if len(ld.get("unlocked_by", [])) >= ld.get("max_unlocks", 5):
        raise HTTPException(status_code=409, detail="Lead became locked before payment completed.")
    if current_user["id"] in ld.get("unlocked_by", []):
        return {"success": True, "already_unlocked": True, "lead": serialize_lead(ld, contractor_id=current_user["id"])}

    payment = paypalrestsdk.Payment.find(payment_id)
    if not payment.execute({"payer_id": payer_id}):
        logger.error(f"PayPal lead unlock execute failed: {payment.error}")
        raise HTTPException(status_code=400, detail=f"Payment failed: {payment.error}")

    # Atomic update: only add if slots still available
    update_result = await db.leads.update_one(
        {
            "id": lead_id,
            "$expr": {"$lt": [{"$size": {"$ifNull": ["$unlocked_by", []]}}, "$max_unlocks"]},
        },
        {
            "$addToSet": {"unlocked_by": current_user["id"]},
            "$set": {"updated_at": datetime.utcnow()},
        },
    )
    if update_result.modified_count == 0:
        raise HTTPException(status_code=409, detail="Lead became locked before payment captured. Please contact support for a refund.")

    # If we just hit the cap, mark status as locked
    ld_after = await db.leads.find_one({"id": lead_id})
    if len(ld_after.get("unlocked_by", [])) >= ld_after.get("max_unlocks", 5):
        await db.leads.update_one({"id": lead_id}, {"$set": {"status": "locked"}})
        ld_after["status"] = "locked"

    await db.lead_unlocks.update_one(
        {"paypal_payment_id": payment_id},
        {"$set": {"status": "completed", "completed_at": datetime.utcnow()}},
    )

    return {
        "success": True,
        "lead": serialize_lead(ld_after, contractor_id=current_user["id"]),
    }


@api_router.get("/leads-public/zip-lookup/{zip_code}")
async def public_zip_lookup(zip_code: str):
    """Public endpoint to validate a US zip and return city/state for the post-lead form."""
    info = lookup_zip(zip_code)
    if not info.get("lat"):
        raise HTTPException(status_code=404, detail="Zip not found")
    return info


# ===================== JOB BOARD ENDPOINTS =====================

@api_router.post("/jobs")
async def create_job(job_data: JobPostingCreate, current_user: dict = Depends(get_current_user)):
    # Check if user has premium subscription
    tier = current_user.get("subscription_tier", "free_trial")
    if tier not in ["premium", "free_trial"]:  # Allow free trial for testing
        raise HTTPException(status_code=403, detail="Premium subscription required to post jobs")
    
    job_dict = job_data.dict()
    job_dict["id"] = str(uuid.uuid4())
    job_dict["user_id"] = current_user["id"]
    job_dict["created_at"] = datetime.utcnow()
    job_dict["updated_at"] = datetime.utcnow()
    job_dict["status"] = "open"
    
    await db.jobs.insert_one(job_dict)
    job_dict.pop("_id", None)
    return job_dict

@api_router.get("/jobs")
async def get_jobs(status: Optional[str] = None, project_type: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    # Check if user has premium subscription to view jobs
    tier = current_user.get("subscription_tier", "free_trial")
    if tier not in ["premium", "free_trial"]:  # Allow free trial for testing
        raise HTTPException(status_code=403, detail="Premium subscription required to view job board")
    
    query = {}
    if status:
        query["status"] = status
    if project_type:
        query["project_type"] = project_type
    
    jobs = await db.jobs.find(query).sort("created_at", -1).to_list(100)
    for job in jobs:
        job.pop("_id", None)
    return jobs

@api_router.get("/jobs/{job_id}")
async def get_job(job_id: str, current_user: dict = Depends(get_current_user)):
    tier = current_user.get("subscription_tier", "free_trial")
    if tier not in ["premium", "free_trial"]:
        raise HTTPException(status_code=403, detail="Premium subscription required")
    
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job.pop("_id", None)
    return job

@api_router.put("/jobs/{job_id}")
async def update_job(job_id: str, job_data: JobPostingCreate, current_user: dict = Depends(get_current_user)):
    existing = await db.jobs.find_one({"id": job_id, "user_id": current_user["id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Job not found or unauthorized")
    
    update_dict = job_data.dict()
    update_dict["updated_at"] = datetime.utcnow()
    
    await db.jobs.update_one({"id": job_id}, {"$set": update_dict})
    
    updated = await db.jobs.find_one({"id": job_id})
    updated.pop("_id", None)
    return updated

@api_router.delete("/jobs/{job_id}")
async def delete_job(job_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.jobs.delete_one({"id": job_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Job not found or unauthorized")
    return {"message": "Job deleted"}

# ===================== HEALTH CHECK =====================

@api_router.get("/")
async def root():
    return {"message": "Electrical Estimator API", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
