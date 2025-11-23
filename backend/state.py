from typing import TypedDict, List, Optional, Dict, Any
from langchain_core.messages import BaseMessage
from models import AccountPlan

class AgentState(TypedDict, total=False):
    messages: List[BaseMessage]
    user_id: str
    plan: Optional[AccountPlan]
    research_needed: bool
    research_query: Optional[str]
    target_section: Optional[str]
    research_result: Optional[Dict[str, Any]]
    last_action: Optional[str]   # e.g. "NONE" | "CALL_RESEARCH" | "INVALID"
    new_version_created: bool
    
    # Multi-step research fields
    research_mode: Optional[str] # "fast", "standard", "deep"
    research_plan: List[Dict[str, Any]] # List of tasks: {"id": 1, "task": "...", "status": "pending"}
    research_plan_approved: bool
    current_task_index: int
    aggregated_findings: List[str] # Accumulate findings from each step
    discovered_conflicts: List[str] # Accumulate conflicts found during research
    steps_in_current_turn: int # Track how many research steps executed in this request
    continue_after_pause: bool # Flag to signal frontend to continue polling
    attached_files: List[Dict[str, str]] # List of files: {"id": "file-...", "name": "..."}
