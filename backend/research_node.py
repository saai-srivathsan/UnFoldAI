import os
import json
import httpx
import asyncio
from pathlib import Path
from state import AgentState
from dotenv import load_dotenv

# Robust .env loading
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

PERPLEXITY_API_KEY = os.environ.get("PERPLEXITY_API_KEY")

if not PERPLEXITY_API_KEY or PERPLEXITY_API_KEY == "mock-key":
    # Fallback manual load
    if env_path.exists():
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip().startswith("PERPLEXITY_API_KEY="):
                        parts = line.strip().split("=", 1)
                        if len(parts) == 2:
                            PERPLEXITY_API_KEY = parts[1].strip().strip('"').strip("'")
                            os.environ["PERPLEXITY_API_KEY"] = PERPLEXITY_API_KEY
        except Exception:
            pass

if not PERPLEXITY_API_KEY:
    PERPLEXITY_API_KEY = "mock-key"

PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions"  # check docs if different

RESEARCH_PROMPT = """
You are a research agent that must SEARCH THE WEB and then return structured data.

User context:
- We are building a B2B ACCOUNT PLAN for a client.
- You must pull information ONLY from the web and cite sources.
- You must return sources from which you generated the response all the time.

IMPORTANT - Conflict Detection:
- Actively look for and report ANY conflicting information found across different sources.
- Conflicts include: different numbers/figures, contradictory statements, varying dates, inconsistent facts.
- Be thorough - even minor discrepancies should be reported.
- Format: "[Topic]: Source A says X, but Source B says Y" (e.g., "Revenue: Forbes reports $5B, but Bloomberg reports $6B").

Return a JSON object with fields:
- summary: string (3–6 sentences)
- key_points: string[]  (bullet-style)
- sources: {title: string, url: string, snippet: string}[]
- conflicts: string[]   (Explicitly list ALL conflicting data points found. If none found, return empty list. Be specific about sources and values.)

DO NOT add extra text, only valid JSON.
"""

async def call_perplexity(query: str) -> dict:
    headers = {
        "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "sonar-pro", 
        "messages": [
            {"role": "system", "content": RESEARCH_PROMPT},
            {"role": "user", "content": query},
        ],
    }
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                # Mocking the call if no key is present or for demo purposes if needed
                if PERPLEXITY_API_KEY == "mock-key":
                     return {
                        "summary": f"Mock research result for query: {query}",
                        "key_points": ["Point 1", "Point 2"],
                        "sources": [],
                        "conflicts": []
                     }
                
                r = await client.post(PERPLEXITY_URL, headers=headers, json=payload)
                
                if r.status_code == 429:
                    print(f"DEBUG: Rate limit hit (429). Retrying in {2 * (attempt + 1)}s...")
                    await asyncio.sleep(2 * (attempt + 1))
                    continue
                    
                if r.is_error:
                    print(f"Perplexity API Error: {r.status_code} - {r.text}")
                r.raise_for_status()
                data = r.json()
                break # Success
        except Exception as e:
            if attempt == max_retries - 1:
                raise e
            print(f"DEBUG: Error calling Perplexity: {e}. Retrying...")
            await asyncio.sleep(2)

    # Perplexity's structure is similar to OpenAI's; adjust if needed:
    content = data["choices"][0]["message"]["content"]
    print(f"DEBUG: Perplexity Raw Content:\n{content}\n" + "-"*20)
    
    # Clean up markdown code blocks if present
    if content.strip().startswith("```json"):
        content = content.strip().replace("```json", "").replace("```", "")
    elif content.strip().startswith("```"):
        content = content.strip().replace("```", "")
        
    try:
        data = json.loads(content)
        
        # Check for nested JSON in summary (Perplexity sometimes puts the JSON inside the summary field)
        if isinstance(data, dict) and "summary" in data and isinstance(data["summary"], str):
            summary_text = data["summary"].strip()
            if summary_text.startswith("```json") or summary_text.startswith("{"):
                # Try to parse the inner JSON
                clean_summary = summary_text.replace("```json", "").replace("```", "").strip()
                try:
                    inner_data = json.loads(clean_summary)
                    if isinstance(inner_data, dict):
                        # If inner data has the expected fields, use it instead
                        if "summary" in inner_data or "key_points" in inner_data:
                            print("DEBUG: Detected nested JSON in summary, using inner data.")
                            return inner_data
                except:
                    pass
        
        return data
    except Exception:
        # If parsing fails, it might be because the content itself is a JSON string inside a JSON string (double encoded)
        # or just plain text.
        pass
        
    return {
        "summary": content,
        "key_points": [],
        "sources": [],
        "conflicts": [],
    }

async def research_agent(state: AgentState) -> AgentState:
    mode = state.get("research_mode", "single")
    query = None
    
    if mode == "multi":
        plan = state.get("research_plan", [])
        idx = state.get("current_task_index", 0)
        if idx < len(plan):
            task = plan[idx]
            # Handle both string and object formats for tasks
            if isinstance(task, dict):
                query = task.get("task")
            else:
                query = str(task)
    else:
        query = state.get("research_query")

    if not query:
        state["research_needed"] = False
        return state

    try:
        result = await call_perplexity(query)
        print(f"DEBUG: Research Agent Result (Mode: {mode}):\n{json.dumps(result, indent=2)}\n" + "-"*20)
        
        # Log conflicts specifically
        conflicts = result.get("conflicts", [])
        print(f"DEBUG: Conflicts returned from Perplexity: {len(conflicts)} - {conflicts}")
        
        state["research_result"] = result
        
        if mode == "multi":
            # Accumulate findings
            findings = state.get("aggregated_findings", [])
            summary = result.get("summary", "")
            findings.append(f"Task: {query}\nResult: {summary}")
            state["aggregated_findings"] = findings
            
            # Accumulate conflicts
            current_conflicts = state.get("discovered_conflicts", [])
            new_conflicts = result.get("conflicts", [])
            if new_conflicts:
                current_conflicts.extend(new_conflicts)
                print(f"DEBUG: Accumulated conflicts in state: {len(current_conflicts)}")
            state["discovered_conflicts"] = current_conflicts
            
            # Increment index
            state["current_task_index"] = state.get("current_task_index", 0) + 1
            
            # Increment steps executed in this turn
            state["steps_in_current_turn"] = state.get("steps_in_current_turn", 0) + 1
            
    except Exception as e:
        print(f"Research failed: {e}")
        error_msg = str(e)
        summary_text = f"Research failed due to an error: {error_msg}"
        
        if "429" in error_msg or "Rate limit" in error_msg:
             summary_text = "The chat failed likely due to exceeding API's rate limit"
             
        state["research_result"] = {
            "summary": summary_text,
            "key_points": [],
            "sources": [],
            "conflicts": []
        }
    
    # We let the conversation agent decide if more research is needed
    # based on the plan status.
    state["research_needed"] = False
    return state
