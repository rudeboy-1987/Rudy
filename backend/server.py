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
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest

# Optional: SendGrid for emails (if API key is provided)
try:
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail
    SENDGRID_AVAILABLE = True
except ImportError:
    SENDGRID_AVAILABLE = False

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

# ===================== STRIPE PAYMENT ENDPOINTS =====================

@api_router.post("/payments/checkout")
async def create_checkout_session(request: SubscriptionCheckoutRequest, http_request: Request, current_user: dict = Depends(get_current_user)):
    """Create a Stripe checkout session for subscription payment"""
    try:
        stripe_api_key = os.environ.get('STRIPE_API_KEY')
        if not stripe_api_key or stripe_api_key == 'sk_test_emergent':
            # Return mocked response if no real Stripe key
            return {
                "success": False,
                "mocked": True,
                "message": "Stripe API key not configured. Add your STRIPE_API_KEY to .env to enable real payments.",
                "tier": request.tier,
                "price": SUBSCRIPTION_PACKAGES.get(request.tier, {}).get('price', 0)
            }
        
        if request.tier not in SUBSCRIPTION_PACKAGES:
            raise HTTPException(status_code=400, detail="Invalid subscription tier")
        
        package = SUBSCRIPTION_PACKAGES[request.tier]
        
        # Build URLs from frontend origin
        success_url = f"{request.origin_url}/payment-success?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{request.origin_url}/(tabs)/profile"
        
        # Create webhook URL
        host_url = str(http_request.base_url).rstrip('/')
        webhook_url = f"{host_url}/api/webhook/stripe"
        
        stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url=webhook_url)
        
        checkout_request = CheckoutSessionRequest(
            amount=package['price'],
            currency="usd",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "user_id": current_user["id"],
                "tier": request.tier,
                "user_email": current_user["email"]
            }
        )
        
        session = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Create payment transaction record
        transaction = {
            "id": str(uuid.uuid4()),
            "session_id": session.session_id,
            "user_id": current_user["id"],
            "user_email": current_user["email"],
            "tier": request.tier,
            "amount": package['price'],
            "currency": "usd",
            "status": "initiated",
            "payment_status": "pending",
            "created_at": datetime.utcnow()
        }
        await db.payment_transactions.insert_one(transaction)
        
        return {
            "success": True,
            "checkout_url": session.url,
            "session_id": session.session_id
        }
        
    except Exception as e:
        logger.error(f"Stripe checkout error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Payment processing failed: {str(e)}")

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, current_user: dict = Depends(get_current_user)):
    """Check the status of a payment session"""
    try:
        stripe_api_key = os.environ.get('STRIPE_API_KEY')
        if not stripe_api_key or stripe_api_key == 'sk_test_emergent':
            return {"success": False, "mocked": True, "message": "Stripe not configured"}
        
        # Check if already processed
        transaction = await db.payment_transactions.find_one({"session_id": session_id})
        if transaction and transaction.get("payment_status") == "paid":
            return {
                "success": True,
                "status": "complete",
                "payment_status": "paid",
                "tier": transaction.get("tier"),
                "message": "Payment already processed"
            }
        
        stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url="")
        checkout_status = await stripe_checkout.get_checkout_status(session_id)
        
        # Update transaction record
        if checkout_status.payment_status == "paid":
            # Update user subscription
            tier = checkout_status.metadata.get("tier", "basic")
            user_id = checkout_status.metadata.get("user_id")
            
            if user_id:
                await db.users.update_one(
                    {"id": user_id},
                    {"$set": {"subscription_tier": tier, "subscription_start": datetime.utcnow()}}
                )
            
            # Update transaction
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {"status": "complete", "payment_status": "paid", "updated_at": datetime.utcnow()}}
            )
        elif checkout_status.status == "expired":
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {"status": "expired", "payment_status": "failed", "updated_at": datetime.utcnow()}}
            )
        
        return {
            "success": True,
            "status": checkout_status.status,
            "payment_status": checkout_status.payment_status,
            "amount": checkout_status.amount_total / 100,  # Convert from cents
            "currency": checkout_status.currency,
            "tier": checkout_status.metadata.get("tier")
        }
        
    except Exception as e:
        logger.error(f"Payment status check error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to check payment status: {str(e)}")

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events"""
    try:
        stripe_api_key = os.environ.get('STRIPE_API_KEY')
        if not stripe_api_key or stripe_api_key == 'sk_test_emergent':
            return {"received": True, "mocked": True}
        
        body = await request.body()
        signature = request.headers.get("Stripe-Signature")
        
        stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url="")
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        if webhook_response.payment_status == "paid":
            # Update user subscription
            user_id = webhook_response.metadata.get("user_id")
            tier = webhook_response.metadata.get("tier", "basic")
            
            if user_id:
                await db.users.update_one(
                    {"id": user_id},
                    {"$set": {"subscription_tier": tier, "subscription_start": datetime.utcnow()}}
                )
                
                await db.payment_transactions.update_one(
                    {"session_id": webhook_response.session_id},
                    {"$set": {"status": "complete", "payment_status": "paid", "updated_at": datetime.utcnow()}}
                )
        
        return {"received": True}
        
    except Exception as e:
        logger.error(f"Stripe webhook error: {str(e)}")
        return {"received": True, "error": str(e)}

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
