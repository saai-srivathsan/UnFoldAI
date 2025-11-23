from typing import List, Optional, Union, Any, Dict
from pydantic import BaseModel

class PlanSection(BaseModel):
    title: str
    content: Union[str, List[Any], Dict[str, Any]]

class AccountPlan(BaseModel):
    id: str
    userId: str
    company: str
    goal: str
    title: Optional[str] = None
    createdAt: str
    updatedAt: str
    version: int
    sections: List[PlanSection] = []
    conflicts: List[Dict[str, Any]] = [] # Stores conflicts: {description, status, source}
    history: List[Dict[str, Any]] = [] # Stores snapshots of previous versions

class ChatRequest(BaseModel):
    userId: str
    planId: Optional[str] = None
    message: str
    conversationId: Optional[str] = None   # for multi-session later
    fileIds: Optional[List[str]] = None

class ChatResponse(BaseModel):
    reply: str
    plan: Optional[AccountPlan] = None
    messages: list
    researchStatus: str
    newVersionCreated: bool
    progress: Optional[Dict[str, Any]] = None # For multi-step progress updates
    researchPlan: Optional[List[Dict[str, Any]]] = None # For proposing a plan to the user
    attachedFiles: Optional[List[Dict[str, str]]] = None

class TTSRequest(BaseModel):
    text: str
