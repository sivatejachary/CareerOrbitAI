from pydantic import BaseModel, EmailStr

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    organization_id: str
    email: EmailStr
    full_name: str
    role: str

    class Config:
        from_attributes = True
