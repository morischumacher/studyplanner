import asyncio
from app.db import get_pool
from fastapi.testclient import TestClient
from app.main import app

def test_put_recommendation_profile():
    client = TestClient(app)
    
    # First let's sign in to get a session
    signin_res = client.post("/auth/signin", json={"username": "test", "password": "password"})
    print("Signin status:", signin_res.status_code)
    print("Signin response:", signin_res.text)
    
    # Let's try signup if signin fails
    if signin_res.status_code != 200:
        signup_res = client.post("/auth/signup", json={"username": "test", "password": "password"})
        print("Signup status:", signup_res.status_code)
        print("Signup response:", signup_res.text)
        
        # Sign in again
        signin_res = client.post("/auth/signin", json={"username": "test", "password": "password"})
        print("Signin status after signup:", signin_res.status_code)
        print("Signin response after signup:", signin_res.text)

    # Let's get current user info
    me_res = client.get("/auth/me")
    print("Me status:", me_res.status_code)
    print("Me response:", me_res.text)

    # Now let's try the PUT recommendation profile request
    payload = {
        "program_code": "066 937",
        "interests": ["machine learning"],
        "career_direction": "Data Scientist",
        "recommendation_toggles": {"interest": True}
    }
    
    # We pass the cookies from signin to keep the session
    res = client.put(
        "/profile-settings/recommendation-profile", 
        json=payload,
        cookies=signin_res.cookies
    )
    print("PUT status:", res.status_code)
    print("PUT response:", res.text)

if __name__ == "__main__":
    test_put_recommendation_profile()
