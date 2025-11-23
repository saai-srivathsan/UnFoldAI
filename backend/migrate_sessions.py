import json
import os
from typing import List, Dict, Any

SESSION_FILE = "sessions.json"

def migrate():
    if not os.path.exists(SESSION_FILE):
        print("No sessions file found.")
        return

    with open(SESSION_FILE, "r") as f:
        sessions = json.load(f)

    print(f"Loaded {len(sessions)} sessions.")
    
    updated_count = 0
    
    for session_id, state in sessions.items():
        if "plan" not in state or not state["plan"]:
            continue
            
        plan = state["plan"]
        history = plan.get("history", [])
        
        # 1. Filter empty sections from history
        non_empty_history = [h for h in history if h.get("sections") and len(h["sections"]) > 0]
        
        # 2. Deduplicate by version (keep last)
        version_map = {}
        for h in non_empty_history:
            version_map[h["version"]] = h
            
        unique_history = sorted(version_map.values(), key=lambda x: x["version"])
        
        # 3. Renumber history
        new_history = []
        for i, h in enumerate(unique_history):
            h["version"] = i + 1
            new_history.append(h)
            
        last_version = 0
        if new_history:
            last_version = new_history[-1]["version"]
            
        # 4. Update plan
        plan["history"] = new_history
        plan["version"] = last_version + 1
        
        # Also update the session state
        state["plan"] = plan
        updated_count += 1
        
    with open(SESSION_FILE, "w") as f:
        json.dump(sessions, f, indent=2)
        
    print(f"Migrated {updated_count} sessions.")

if __name__ == "__main__":
    migrate()
