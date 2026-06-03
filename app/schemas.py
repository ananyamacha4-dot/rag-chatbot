from pydantic import BaseModel
from typing import Optional


class LoginData(BaseModel):
    username: str
    password: str


class MessageData(BaseModel):
    user_id: int
    message: str


class QuestionData(BaseModel):
    question: str
    user_id: Optional[int] = None
