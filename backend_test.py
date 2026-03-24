#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Electrical Estimator
Tests all core backend APIs with realistic data
"""

import requests
import json
import uuid
import base64
from datetime import datetime
import os

# Get backend URL from environment
BACKEND_URL = "https://estimate-pro-33.preview.emergentagent.com/api"

class ElectricalEstimatorAPITest:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.token = None
        self.user_id = None
        self.test_estimate_id = None
        self.test_job_id = None
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "status": status,
            "details": details
        })
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
    
    def test_health_check(self):
        """Test health check endpoint"""
        try:
            response = requests.get(f"{self.base_url}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                self.log_test("Health Check", True, f"Status: {data.get('status')}")
                return True
            else:
                self.log_test("Health Check", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Health Check", False, f"Error: {str(e)}")
            return False
    
    def test_user_registration(self):
        """Test user registration"""
        try:
            # Generate unique email for testing
            test_email = f"contractor_{uuid.uuid4().hex[:8]}@electricpro.com"
            
            registration_data = {
                "email": test_email,
                "password": "SecurePass123!",
                "company_name": "Elite Electrical Solutions",
                "phone": "+1-555-0123"
            }
            
            response = requests.post(
                f"{self.base_url}/auth/register",
                json=registration_data,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("token")
                self.user_id = data.get("user", {}).get("id")
                
                if self.token and self.user_id:
                    self.log_test("User Registration", True, f"User ID: {self.user_id}")
                    return True
                else:
                    self.log_test("User Registration", False, "Missing token or user ID")
                    return False
            else:
                self.log_test("User Registration", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("User Registration", False, f"Error: {str(e)}")
            return False
    
    def test_user_login(self):
        """Test user login with existing credentials"""
        try:
            # Try with test credentials first
            login_data = {
                "email": "test@contractor.com",
                "password": "test123456"
            }
            
            response = requests.post(
                f"{self.base_url}/auth/login",
                json=login_data,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("token")
                self.user_id = data.get("user", {}).get("id")
                
                if self.token and self.user_id:
                    self.log_test("User Login", True, f"Logged in as: {login_data['email']}")
                    return True
                else:
                    self.log_test("User Login", False, "Missing token or user ID")
                    return False
            else:
                self.log_test("User Login", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("User Login", False, f"Error: {str(e)}")
            return False
    
    def test_get_profile(self):
        """Test get user profile"""
        if not self.token:
            self.log_test("Get Profile", False, "No authentication token")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            response = requests.get(f"{self.base_url}/auth/me", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("Get Profile", True, f"Company: {data.get('company_name')}")
                return True
            else:
                self.log_test("Get Profile", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Get Profile", False, f"Error: {str(e)}")
            return False
    
    def test_update_profile(self):
        """Test update user profile"""
        if not self.token:
            self.log_test("Update Profile", False, "No authentication token")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            update_data = {
                "company_name": "Elite Electrical Solutions LLC",
                "phone": "+1-555-0199",
                "bio": "Professional electrical contractors with 15+ years experience in residential and commercial projects."
            }
            
            response = requests.put(
                f"{self.base_url}/auth/profile",
                json=update_data,
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("Update Profile", True, f"Updated company: {data.get('company_name')}")
                return True
            else:
                self.log_test("Update Profile", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Update Profile", False, f"Error: {str(e)}")
            return False
    
    def test_create_estimate(self):
        """Test create estimate"""
        if not self.token:
            self.log_test("Create Estimate", False, "No authentication token")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            estimate_data = {
                "project_name": "Kitchen Renovation - Electrical Upgrade",
                "project_type": "residential",
                "client_name": "Johnson Family",
                "client_email": "mjohnson@email.com",
                "client_phone": "+1-555-0156",
                "address": "1234 Maple Street, Springfield, IL 62701",
                "description": "Complete kitchen electrical renovation including new outlets, under-cabinet lighting, and 240V outlet for electric range",
                "materials": [
                    {
                        "name": "12/2 NM-B Wire (250ft)",
                        "unit": "roll",
                        "quantity": 2.0,
                        "unit_price": 125.00,
                        "total": 250.00
                    },
                    {
                        "name": "GFCI Outlet",
                        "unit": "each",
                        "quantity": 4.0,
                        "unit_price": 18.00,
                        "total": 72.00
                    },
                    {
                        "name": "LED Under-Cabinet Light",
                        "unit": "each",
                        "quantity": 6.0,
                        "unit_price": 45.00,
                        "total": 270.00
                    }
                ],
                "labor": [
                    {
                        "description": "Install new outlets and GFCI protection",
                        "hours": 8.0,
                        "rate": 85.00,
                        "total": 680.00
                    },
                    {
                        "description": "Install under-cabinet lighting",
                        "hours": 4.0,
                        "rate": 85.00,
                        "total": 340.00
                    }
                ],
                "equipment": [
                    {
                        "name": "Wire pulling equipment",
                        "days": 1.0,
                        "daily_rate": 50.00,
                        "total": 50.00
                    }
                ],
                "overhead_percentage": 12.0,
                "profit_percentage": 18.0,
                "notes": "All work will be performed to current NEC standards. Permit and inspection included."
            }
            
            response = requests.post(
                f"{self.base_url}/estimates",
                json=estimate_data,
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                self.test_estimate_id = data.get("id")
                grand_total = data.get("grand_total", 0)
                self.log_test("Create Estimate", True, f"Estimate ID: {self.test_estimate_id}, Total: ${grand_total}")
                return True
            else:
                self.log_test("Create Estimate", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Create Estimate", False, f"Error: {str(e)}")
            return False
    
    def test_get_estimates(self):
        """Test get all estimates"""
        if not self.token:
            self.log_test("Get Estimates", False, "No authentication token")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            response = requests.get(f"{self.base_url}/estimates", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                count = len(data) if isinstance(data, list) else 0
                self.log_test("Get Estimates", True, f"Found {count} estimates")
                return True
            else:
                self.log_test("Get Estimates", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Get Estimates", False, f"Error: {str(e)}")
            return False
    
    def test_get_single_estimate(self):
        """Test get single estimate"""
        if not self.token or not self.test_estimate_id:
            self.log_test("Get Single Estimate", False, "No authentication token or estimate ID")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            response = requests.get(
                f"{self.base_url}/estimates/{self.test_estimate_id}",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                project_name = data.get("project_name", "Unknown")
                self.log_test("Get Single Estimate", True, f"Project: {project_name}")
                return True
            else:
                self.log_test("Get Single Estimate", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Get Single Estimate", False, f"Error: {str(e)}")
            return False
    
    def test_ai_blueprint_analysis(self):
        """Test AI blueprint analysis"""
        if not self.token:
            self.log_test("AI Blueprint Analysis", False, "No authentication token")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            analysis_data = {
                "project_description": "2-story residential home addition with 3 bedrooms, 2 bathrooms, kitchen, and living room. Need complete electrical system including panel upgrade to 200A service.",
                "project_type": "residential"
            }
            
            response = requests.post(
                f"{self.base_url}/ai/analyze-blueprint",
                json=analysis_data,
                headers=headers,
                timeout=30  # AI calls may take longer
            )
            
            if response.status_code == 200:
                data = response.json()
                analysis = data.get("analysis", "")
                self.log_test("AI Blueprint Analysis", True, f"Analysis length: {len(analysis)} chars")
                return True
            else:
                self.log_test("AI Blueprint Analysis", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("AI Blueprint Analysis", False, f"Error: {str(e)}")
            return False
    
    def test_ai_generate_estimate(self):
        """Test AI estimate generation"""
        if not self.token or not self.test_estimate_id:
            self.log_test("AI Generate Estimate", False, "No authentication token or estimate ID")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            response = requests.post(
                f"{self.base_url}/ai/generate-estimate?estimate_id={self.test_estimate_id}",
                headers=headers,
                timeout=30  # AI calls may take longer
            )
            
            if response.status_code == 200:
                data = response.json()
                document = data.get("ai_document", "")
                self.log_test("AI Generate Estimate", True, f"Document length: {len(document)} chars")
                return True
            else:
                self.log_test("AI Generate Estimate", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("AI Generate Estimate", False, f"Error: {str(e)}")
            return False
    
    def test_material_prices(self):
        """Test get material prices"""
        try:
            response = requests.get(f"{self.base_url}/materials/prices", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                count = len(data) if isinstance(data, list) else 0
                self.log_test("Material Prices", True, f"Found {count} materials")
                return True
            else:
                self.log_test("Material Prices", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Material Prices", False, f"Error: {str(e)}")
            return False
    
    def test_seed_materials(self):
        """Test seed material prices"""
        try:
            response = requests.post(f"{self.base_url}/materials/prices/seed", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                count = data.get("count", 0)
                self.log_test("Seed Materials", True, f"Seeded {count} materials")
                return True
            else:
                self.log_test("Seed Materials", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Seed Materials", False, f"Error: {str(e)}")
            return False
    
    def test_subscription_status(self):
        """Test subscription status"""
        if not self.token:
            self.log_test("Subscription Status", False, "No authentication token")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            response = requests.get(f"{self.base_url}/subscription/status", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                tier = data.get("tier", "unknown")
                self.log_test("Subscription Status", True, f"Tier: {tier}")
                return True
            else:
                self.log_test("Subscription Status", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Subscription Status", False, f"Error: {str(e)}")
            return False
    
    def test_create_job(self):
        """Test create job posting"""
        if not self.token:
            self.log_test("Create Job", False, "No authentication token")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            job_data = {
                "poster_type": "homeowner",
                "poster_name": "Sarah Mitchell",
                "poster_email": "sarah.mitchell@email.com",
                "poster_phone": "+1-555-0187",
                "title": "Whole House Electrical Panel Upgrade",
                "description": "Need to upgrade from 100A to 200A electrical panel. House is 2,400 sq ft built in 1985. Also need to add GFCI outlets in bathrooms and kitchen. Looking for licensed electrician with good references.",
                "project_type": "residential",
                "location": "Springfield, IL",
                "budget_range": "$3,000 - $5,000",
                "timeline": "Within 2 weeks"
            }
            
            response = requests.post(
                f"{self.base_url}/jobs",
                json=job_data,
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                self.test_job_id = data.get("id")
                title = data.get("title", "Unknown")
                self.log_test("Create Job", True, f"Job ID: {self.test_job_id}, Title: {title}")
                return True
            else:
                self.log_test("Create Job", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Create Job", False, f"Error: {str(e)}")
            return False
    
    def test_get_jobs(self):
        """Test get job listings"""
        if not self.token:
            self.log_test("Get Jobs", False, "No authentication token")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            response = requests.get(f"{self.base_url}/jobs", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                count = len(data) if isinstance(data, list) else 0
                self.log_test("Get Jobs", True, f"Found {count} jobs")
                return True
            else:
                self.log_test("Get Jobs", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Get Jobs", False, f"Error: {str(e)}")
            return False
    
    def test_send_estimate_mocked(self):
        """Test send estimate (mocked)"""
        if not self.token or not self.test_estimate_id:
            self.log_test("Send Estimate (MOCKED)", False, "No authentication token or estimate ID")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            send_data = {
                "estimate_id": self.test_estimate_id,
                "recipient_email": "mjohnson@email.com",
                "message": "Please review the attached electrical estimate for your kitchen renovation project."
            }
            
            response = requests.post(
                f"{self.base_url}/estimates/{self.test_estimate_id}/send",
                json=send_data,
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                message = data.get("message", "")
                self.log_test("Send Estimate (MOCKED)", True, f"Response: {message}")
                return True
            else:
                self.log_test("Send Estimate (MOCKED)", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Send Estimate (MOCKED)", False, f"Error: {str(e)}")
            return False
    
    def test_delete_estimate(self):
        """Test delete estimate (cleanup)"""
        if not self.token or not self.test_estimate_id:
            self.log_test("Delete Estimate", False, "No authentication token or estimate ID")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            response = requests.delete(
                f"{self.base_url}/estimates/{self.test_estimate_id}",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                self.log_test("Delete Estimate", True, "Estimate deleted successfully")
                return True
            else:
                self.log_test("Delete Estimate", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Delete Estimate", False, f"Error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all API tests in sequence"""
        print(f"🔧 Starting Electrical Estimator API Tests")
        print(f"🌐 Backend URL: {self.base_url}")
        print("=" * 60)
        
        # Core API tests
        self.test_health_check()
        
        # Authentication flow
        auth_success = self.test_user_login()  # Try existing user first
        if not auth_success:
            auth_success = self.test_user_registration()  # Fallback to registration
        
        if auth_success:
            self.test_get_profile()
            self.test_update_profile()
            
            # Estimate workflow
            self.test_create_estimate()
            self.test_get_estimates()
            self.test_get_single_estimate()
            
            # AI features
            self.test_ai_blueprint_analysis()
            self.test_ai_generate_estimate()
            
            # Material prices
            self.test_seed_materials()
            self.test_material_prices()
            
            # Subscription
            self.test_subscription_status()
            
            # Job board
            self.test_create_job()
            self.test_get_jobs()
            
            # Mocked features
            self.test_send_estimate_mocked()
            
            # Cleanup
            self.test_delete_estimate()
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if "✅" in result["status"])
        failed = sum(1 for result in self.test_results if "❌" in result["status"])
        
        print(f"Total Tests: {len(self.test_results)}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        
        if failed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if "❌" in result["status"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        return failed == 0

if __name__ == "__main__":
    tester = ElectricalEstimatorAPITest()
    success = tester.run_all_tests()
    exit(0 if success else 1)