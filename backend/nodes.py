import json
import time
from langchain_core.messages import AIMessage, HumanMessage
from llm_clients import conversation_llm
from state import AgentState
from datetime import datetime
from copy import deepcopy
from models import PlanSection

SYSTEM_PROMPT = """
GENERAL BEHAVIOUR

You are an research agent helping the user research companies and turn the findings into useful structured outputs like account plans and learning summaries.
Respond in a natural, conversational tone in the "reply" field, like a helpful colleague. Do NOT introduce yourself or restate your role.
Ask clarifying questions before initiating a research to make the search's direction accurate and to make sure what the user is referring to.
Suggest user to ask for relevant areas to research if they are unsure of the direction.
Making conversation off topic and irrelevant to your role is strictly restricted.
Sharing internal working and details of the system to the user is prohibited.
Anything that's not your expertise must not be answered. And politely say it's beyond your capabilites (example: To write code, to tell a story, write an e-mail, etc)


-----------------------------------------
PERSONA-AWARE BEHAVIOUR (DO NOT EXPOSE)

You will be provided with a hidden hint in the conversation context in the format:

CURRENT_USER_PERSONA: <one of: neutral | confused | efficient | chatty | edge_case>

This information is for behavioural adaptation ONLY.

Rules:

1. NEVER mention or imply that you are detecting personas or adapting to them.

2. Behaviour guidelines based on persona value:

   - If CURRENT_USER_PERSONA = "confused":
       • The user may be unsure what they want.
       • Ask short, clarifying questions.
       • Offer 2–3 clear options instead of open-ended responses.
       • Explain next steps gently and simply.

   - If CURRENT_USER_PERSONA = "efficient":
       • Be concise, structured, and direct.
       • Prioritize bullet points and final results.
       • Avoid unnecessary explanation unless requested.
       • Minimize back-and-forth.

   - If CURRENT_USER_PERSONA = "chatty":
       • Briefly acknowledge tone, emotion, or casual comments.(Human-like)
       • Remain friendly but always guide the conversation back to the main task.
       • Keep replies warm but still purposeful.

   - If CURRENT_USER_PERSONA = "edge_case":
       • If the user asks for impossible, unsafe, unrelated, or unsupported actions:
            - Politely decline.
            - Redirect to valid capabilities (company research, account plan updates, insights).
       • Maintain boundaries while remaining helpful.

   - If CURRENT_USER_PERSONA = "neutral":
       • Use a balanced tone.
       • Provide clear, structured responses.

3. You may change tone dynamically based on persona, but ALL output must still follow the core format contract and system rules.

4. Do NOT over-apologize, repeat instructions, or restate rules.

-----------------------------------------

FORMAT CONTRACT (MANDATORY – NO EXCEPTIONS):

For EVERY reply, you MUST return a SINGLE JSON object with EXACTLY these top-level keys:

{
  "reply": string,
    "control": {
    "action": "NONE" | "CALL_RESEARCH" | "PLAN_RESEARCH" | "EXECUTE_PLAN",
    "research_query": string,
    "research_plan": [ {"task": string} ] | null,
    "target_section": string | null,
    "set_plan_title": string | null,
    "resolve_conflict": {"description": string, "resolution": string} | null
  },
  "update": null | {
    "section": string,
    "content": any,
    "mode": "replace" | "append" | "merge" | "delete" | "move"
  }
}


Rules:

1. "reply":
   - Natural language text for the user to read.
   - No JSON, no schema paths, no control metadata.
   - Example: "I'll look up Nike's latest brand value and then add it to the plan."

2. "control":
   - ALWAYS present.
   - "action":
     - "CALL_RESEARCH" → Single-step fast research (legacy). Use this for simple lookups.
     - "PLAN_RESEARCH" → Propose a multi-step research plan. Use this for deep/complex topics.
     - "EXECUTE_PLAN" → Start or continue executing the agreed-upon research plan.
     - "NONE" → no research needed.
   - "research_query":
     - Non-empty string when action == "CALL_RESEARCH".
     - "" (empty string) when action == "NONE" or "PLAN_RESEARCH".
   - "research_plan":
     - A list of objects [{"task": "..."}] when action == "PLAN_RESEARCH".
     - null otherwise.
   - "target_section":
     - A string naming the section you intend to update (e.g., "Brand Overview", "Financials") OR null if not applicable.
   - "set_plan_title":
     - If the plan currently has no title or a generic one, provide a short, descriptive title (3-5 words) for the conversation/plan here. e.g. "Nike Digital Strategy 2025". (MANDATORY)
     - IMPORTANT: Always set a title when you first make any change to the plan (e.g., adding a section or updating content) if the plan doesn't already have a meaningful title. Otherwise null.

3. "update":
   - Use null if you are NOT modifying the plan this turn.
   - Use an object OR an array of objects when you ARE modifying the plan.
   - If an array, each object must have:
     - "section": a dot-path in the existing schema.
     - "content": the structured content.
       DO NOT wrap this in a "content" or "section" object. Just provide the raw data.
       DO NOT include the "sources" list in your content updates. Sources are handled automatically.
     - "mode": "replace" | "append" | "merge" | "delete" | "move".

Examples of valid updates:

- Move section:

{
  "section": "Financials",
  "content": 0,
  "mode": "move"
}
(Moves "Financials" to the top/first position)

- Multiple updates (Replace client snapshot AND append to history):

[
  {
    "section": "account_overview.client_snapshot",
    "content": "Nike is a global sportswear leader...",
    "mode": "replace"
  },
  {
    "section": "account_overview.history_and_milestones",
    "content": "In 2024, Nike expanded...",
    "mode": "append"
  }
]

- Single update (Replace client snapshot):

{
  "section": "account_overview.client_snapshot",
  "content": "Nike is a global sportswear leader...",
  "mode": "replace"
}
LASH COMMANDS:
Users can use special slash commands to format their research output:
- `/map` - Structure the research output as a Mermaid mindmap diagram
- `/tabulate` - Present the research findings in tabular format with clear columns and rows

When you see these commands in the user's message:
1. Perform the research as normal
2. Structure the output according to the command format BEFORE adding to the plan
3. For `/map`: Use a Mermaid code block with a `mindmap` diagram. Ensure the syntax is valid.
   Example format:
   ```mermaid
   mindmap
     root((Main Topic))
       Category 1
         Item A
         Item B
       Category 2
         Item C
   ```
   Do NOT use parentheses `()` inside node text unless escaped or wrapped in quotes.
   IMPORTANT: You MUST create an "update" with the mermaid content in the section specified by the user.
   
4. For `/tabulate`: Create markdown tables with appropriate headers and data rows.
   Example format:
   | Header 1 | Header 2 | Header 3 |
   |----------|----------|----------|
   | Data 1   | Data 2   | Data 3   |
   IMPORTANT: You MUST create an "update" with the table content in the section specified by the user.

When using slash commands, your response MUST include:
- "reply": A brief message like "Here's the mindmap/table of [topic]"
- "update": An object with "section", "content" (the mermaid/table markdown), and "mode" (usually "replace" or "append")
- "control.action": Should be "NONE" if no further research is needed

4. You MUST NEVER output anything other than this single JSON object. No free text above or below it. No markdown. No extra commentary. No extra characters.

5. Research Logic:
   - If the user asks for a simple fact (e.g. "Who is the CEO?"), use "CALL_RESEARCH".
   - If the user asks for a broad topic (e.g. "Research PhonePe") AND has NOT explicitly asked for "deep", "detailed", or "plan":
     - Ask if they want a "Deep Search" (multi-step) or "Quick Summary".
     - Set "action": "NONE".
   - If the user explicitly asks for "deep research", "account plan", or confirms they want "Deep Search":
     - Use "PLAN_RESEARCH" and provide a list of 3-5 sub-tasks in "research_plan".
     - Do NOT just list the steps in the "reply" text. You MUST put the steps in the "control.research_plan" array.
     - DO NOT use "EXECUTE_PLAN" immediately after "PLAN_RESEARCH". You MUST wait for user confirmation.
     - In your "reply", explicitly ask the user to review the plan.
   - If the user approves a plan (e.g. "Start", "Yes", "Go ahead"), use "EXECUTE_PLAN".
   - If the user wants changes (e.g. "Remove step 2", "Add a step about X"), use "PLAN_RESEARCH" again with the *updated* list of tasks.
   - When "EXECUTE_PLAN" is active, you will receive the result of the *current* step in the context.
     - For intermediate steps (when there are more steps remaining):
       * Set "reply" to "" (empty string). DO NOT output "Step X complete" or any summary text.
       * You MUST integrate the findings into the plan IMMEDIATELY using "update". Do not wait for all steps.
       * Target the specific section relevant to the task (e.g. "Financials", "Competitors").
       * Set "action": "EXECUTE_PLAN" again to trigger the next step.
       * The UI handles the progress display, so no text is needed.
     - When ALL steps are completed:
       * Synthesize ALL findings into the plan using "update" and set "action": "NONE".
       * Provide a comprehensive completion summary in "reply" that describes what was researched and the key insights found.
       * DO NOT list the individual steps in the final reply. Focus on the overall findings and their implications.
       * The completion summary should be informative and useful to the user, highlighting the most important discoveries.

6. After a research call has been completed (research_result is available to you), your NEXT reply MUST:
   - Integrate the research into the plan using a non-null "update" object.
   - Set "control.action" to "NONE" unless more research is needed.
   - Do NOT ask for the same research again.

7. Conflict Resolution (CRITICAL - DO NOT SKIP):
   - IMMEDIATELY check "conflicts.new_this_turn" in the context.
   - If "conflicts.new_this_turn" is NOT EMPTY, you MUST do the following BEFORE anything else:
     * For EACH conflict in the list:
       - Start your "reply" with: "⚠️ I found a conflict: [exact conflict description]"
       - THEN suggest resolution options:
         1. "Could you specify a timeframe or preferred source for this information?"
         2. "Should I start a deep search specifically to resolve this conflict?"
         3. "Or if you have the correct information, please let me know."
     * Do NOT proceed with other responses until you've announced ALL new conflicts.
   - If user provides resolution information (e.g., "Use 5B from 2024"):
     * Update the plan with that value using "update".
     * Mark the conflict as resolved: set control.resolve_conflict = {"description": "...", "resolution": "User specified: ..."}
   - If user requests a conflict resolution search:
     * Use "PLAN_RESEARCH" with tasks focused on resolving the specific conflict.
   - Do NOT re-announce conflicts that are in "conflicts.unresolved" but NOT in "conflicts.new_this_turn".
   - IMPORTANT: Even if you have other updates or findings, conflicts take priority in your reply.

8. If you ever respond in a way that does NOT follow this JSON format, you MUST immediately correct yourself in your next reply by re-emitting the same semantic content in valid JSON format.

Keep the account-planning logic, clarifying questions, and strategy reasoning in the "reply" field. Use "control" to drive tools and "update" to modify the structured plan.

"""

def parse_json_output(text: str):
    # Attempt to parse the entire text as JSON first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    
    # Attempt to find a JSON block
    try:
        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end != -1:
            json_raw = text[start:end+1]
            return json.loads(json_raw)
    except Exception:
        pass
        
    return None

def apply_plan_update(plan, update_data):
    if not plan or not update_data:
        return False

    # Snapshot current state before modification
    snapshot = plan.model_dump()
    if "history" in snapshot:
        del snapshot["history"]
    plan.history.append(snapshot)

    updates = update_data if isinstance(update_data, list) else [update_data]
    any_changed = False

    for update_item in updates:
        section_path = update_item.get("section")
        content = update_item.get("content")
        mode = update_item.get("mode", "replace")

        # Heuristic: Unwrap content if LLM wrapped it in a section-like object
        # e.g. content = {"title": "...", "content": ...} which causes nested rendering issues
        if isinstance(content, dict):
            if "content" in content and ("title" in content or len(content) == 1):
                 print("DEBUG: Unwrapping nested content object from LLM.")
                 content = content["content"]

        if not section_path:
            continue

        # Handle dot-notation for sections (e.g. "account_overview.client_snapshot")
        # Map "account_overview" -> "Account Overview"
        parts = section_path.split('.')
        raw_title = parts[0].strip()
        # Convert snake_case to Title Case for display/standardization
        normalized_title = raw_title.replace('_', ' ').title()
        
        # Ensure sections is a list
        if not isinstance(plan.sections, list):
            plan.sections = []

        # Find existing section
        existing_idx = -1
        for i, s in enumerate(plan.sections):
            current_title = s.title.strip().lower()
            # Normalize existing title too (handle "Company_Overview" vs "Company Overview")
            current_normalized = current_title.replace('_', ' ')
            
            # Try matching normalized (e.g. "account_overview" -> "Account Overview")
            if current_normalized == normalized_title.lower():
                existing_idx = i
                break
            # Try matching raw (e.g. "My_Section" -> "My_Section")
            if current_title == raw_title.lower():
                existing_idx = i
                break
        
        # Determine effective content if we are targeting a sub-field
        # Handle cases where LLM might include '.content' in the path (e.g. "Section.content.Field")
        target_key = None
        if len(parts) > 1:
            potential_key = parts[1].strip()
            if potential_key.lower() == "content" and len(parts) > 2:
                target_key = parts[2].strip()
            else:
                target_key = potential_key
                
            if target_key:
                target_key = target_key.replace('_', ' ').title()

        if existing_idx >= 0:
            # Update existing
            existing = plan.sections[existing_idx]
            
            # Resolve target_key to actual key in existing content if possible
            if target_key and isinstance(existing.content, dict):
                # Try exact match first
                if target_key not in existing.content:
                    # Try loose match (case-insensitive AND underscore/space agnostic)
                    target_normalized = target_key.replace('_', ' ').strip().lower()
                    
                    found_key = next((k for k in existing.content if k.replace('_', ' ').strip().lower() == target_normalized), None)
                    if found_key:
                        target_key = found_key

            if mode == "delete":
                if target_key:
                    if isinstance(existing.content, dict) and target_key in existing.content:
                        del existing.content[target_key]
                else:
                    plan.sections.pop(existing_idx)
                any_changed = True
                continue

            if mode == "move":
                if not target_key:
                    try:
                        new_index = int(content)
                        # Basic bounds check (optional, insert handles it but good for sanity)
                        new_index = max(0, new_index)
                        
                        if existing_idx != new_index:
                            section_to_move = plan.sections.pop(existing_idx)
                            # If new_index was greater than existing_idx, we effectively shifted indices down
                            # But insert handles the target position correctly relative to the *current* list state
                            # However, if user meant "index 5" in the *original* list, and we popped 0...
                            # Python insert(i, x) inserts *before* index i.
                            # If we want to move to position N, we just insert at N.
                            # If N >= len, it appends.
                            if new_index >= len(plan.sections):
                                plan.sections.append(section_to_move)
                            else:
                                plan.sections.insert(new_index, section_to_move)
                            any_changed = True
                    except (ValueError, TypeError):
                        print(f"DEBUG: Invalid content for move mode: {content}")
                continue

            if target_key:
                # We are updating a specific key in a dictionary content
                if not isinstance(existing.content, dict):
                    # If it wasn't a dict, make it one (preserving old content if string?)
                    # For simplicity, if it's not a dict, we might overwrite or try to migrate.
                    # Let's assume we convert to dict.
                    existing.content = {"General": existing.content} if existing.content else {}
                
                if mode == "replace":
                    existing.content[target_key] = content
                elif mode == "append":
                    current_val = existing.content.get(target_key)
                    
                    if current_val is None:
                         existing.content[target_key] = content
                    elif isinstance(current_val, list):
                        if isinstance(content, list):
                            existing.content[target_key] = current_val + content
                        else:
                            existing.content[target_key].append(content)
                    elif isinstance(current_val, str):
                        if isinstance(content, list):
                            # Convert current string to list and append new list
                            existing.content[target_key] = [current_val] + content
                        else:
                            # Append string to string
                            existing.content[target_key] = current_val + "\n" + content
                    else:
                        # Fallback for other types - make list
                        existing.content[target_key] = [current_val, content]

                elif mode == "merge":
                     if isinstance(content, dict):
                         existing.content[target_key].update(content)
                     else:
                         existing.content[target_key] = content
            else:
                # Updating the whole section content
                if mode == "replace":
                    existing.content = content
                elif mode == "append":
                    if isinstance(existing.content, str) and isinstance(content, str):
                        existing.content += "\n\n" + content
                    elif isinstance(existing.content, list) and isinstance(content, list):
                        existing.content.extend(content)
                    elif isinstance(existing.content, list) and isinstance(content, str):
                        existing.content.append(content)
                    elif isinstance(existing.content, dict) and isinstance(content, dict):
                        existing.content.update(content)
                    else:
                        existing.content = content
                elif mode == "merge" and isinstance(existing.content, dict) and isinstance(content, dict):
                    existing.content.update(content)
                else:
                     existing.content = content

        else:
            if mode == "delete":
                continue

            # Create new section
            # If target_key is present, we create a dict with that key
            final_content = content
            if target_key:
                final_content = {target_key: content}
                
            try:
                new_section = PlanSection(title=normalized_title, content=final_content)
                plan.sections.append(new_section)
            except Exception as e:
                print(f"DEBUG: Error creating new section: {e}")
                continue
                
        any_changed = True

    # Ensure "Research Sources" is always at the bottom
    if any_changed:
        research_section_idx = -1
        conflicts_section_idx = -1
        for i, s in enumerate(plan.sections):
            title_lower = s.title.lower()
            if title_lower == "research sources":
                research_section_idx = i
            elif title_lower == "conflicts":
                conflicts_section_idx = i
        
        # Move Research Sources to end
        if research_section_idx != -1 and research_section_idx < len(plan.sections) - 1:
            # Move to end
            section = plan.sections.pop(research_section_idx)
            plan.sections.append(section)
            
        # Move Conflicts to second-to-last (before Research Sources)
        if conflicts_section_idx != -1:
            section = plan.sections.pop(conflicts_section_idx)
            # Insert before last item (which should be Research Sources)
            insert_pos = len(plan.sections) - 1 if research_section_idx != -1 else len(plan.sections)
            plan.sections.insert(insert_pos, section)
            
    return any_changed

def optimize_history_messages(messages):
    """
    Creates a copy of the message history with heavy content replaced by placeholders.
    This saves tokens when sending context to the LLM, but preserves the original
    messages in the state for the frontend.
    
    NOTE: Currently disabled to prevent LLM from hallucinating the placeholder string.
    """
    # Return messages as-is to prevent the LLM from learning the placeholder pattern
    # and outputting "(Content applied to plan state)" as actual content.
    return messages

    # optimized = []
    # for msg in messages:
    #     if isinstance(msg, AIMessage):
    #         try:
    #             content_str = msg.content
    #             # Quick check to avoid parsing everything
    #             if not content_str or "update" not in content_str:
    #                 optimized.append(msg)
    #                 continue
                
    #             data = json.loads(content_str)
                
    #             if isinstance(data, dict) and data.get("update"):
    #                 data_copy = deepcopy(data)
    #                 updates = data_copy["update"]
                    
    #                 modified = False
    #                 if isinstance(updates, list):
    #                     for u in updates:
    #                         if "content" in u and u["content"] != "(Content applied to plan state)":
    #                             u["content"] = "(Content applied to plan state)"
    #                             modified = True
    #                 elif isinstance(updates, dict):
    #                     if "content" in updates and updates["content"] != "(Content applied to plan state)":
    #                         updates["content"] = "(Content applied to plan state)"
    #                         modified = True
                            
    #                 if modified:
    #                     optimized.append(AIMessage(content=json.dumps(data_copy, ensure_ascii=False)))
    #                 else:
    #                     optimized.append(msg)
    #             else:
    #                 optimized.append(msg)
    #         except Exception:
    #             optimized.append(msg)
    #     else:
    #         optimized.append(msg)
    # return optimized

def conversation_agent(state: AgentState) -> AgentState:
    messages = state.get("messages", [])
    if not messages:
        # first bot turn; no user msg yet – you can also handle this at /chat
        ai = AIMessage(
            content="Hello! I'm your Account Plan Agent. What company and goal would you like to work on?"
        )
        state["messages"] = [ai]
        state["research_needed"] = False
        state["last_action"] = "NONE"
        state["new_version_created"] = False
        return state

    # Build context summary (plan + latest research)
    plan = state.get("plan")
    plan_summary = plan.model_dump() if plan is not None else None
    research_result = state.get("research_result")
    
    # Multi-step context
    research_plan = state.get("research_plan")
    current_task_index = state.get("current_task_index", 0)
    aggregated_findings = state.get("aggregated_findings", [])
    research_mode = state.get("research_mode", "single")
    attached_files = state.get("attached_files", [])

    # --- Conflict Handling Logic ---
    current_turn_conflicts = []
    if research_mode == "multi":
        current_turn_conflicts = state.get("discovered_conflicts", [])
        print(f"DEBUG: Multi-mode discovered_conflicts: {current_turn_conflicts}")
    # Conflicts are only aggregated during deep research (multi-step), not single-step research
    elif research_result and research_mode == "single":
        print(f"DEBUG: Single-mode research - conflicts ignored during aggregation")
        current_turn_conflicts = []  # Don't process conflicts for single-step research
    
    print(f"DEBUG: Current turn conflicts count: {len(current_turn_conflicts)}")
    
    # Ensure plan.conflicts is initialized
    if plan and not hasattr(plan, "conflicts"):
        plan.conflicts = []
    if plan and plan.conflicts is None:
        plan.conflicts = []
        
    # Mark previously announced but unaddressed conflicts as user_ignored if user sent a new message
    # without addressing them (i.e., moved on to a different topic)
    # Do this BEFORE adding new conflicts
    if plan and len(messages) > 1:  # Has previous conversation
        last_user_msg = next((m for m in reversed(messages) if m.type == "human"), None)
        if last_user_msg and not any(
            keyword in last_user_msg.content.lower() 
            for keyword in ["conflict", "resolve", "search", "timeframe", "source", "correct", "use", "yes", "no", "start", "go"]
        ):
            # User didn't address conflicts, mark previously announced ones as ignored
            for conflict in plan.conflicts:
                if (conflict["status"] == "unresolved" and 
                    not conflict.get("resolution_search_initiated") and
                    not conflict.get("user_ignored") and
                    conflict.get("announced")):  # Only mark if previously announced
                    conflict["user_ignored"] = True
                    print(f"DEBUG: Marking conflict as user_ignored: {conflict['description'][:50]}...")
    
    new_conflicts_to_add = []
    if plan:
        existing_conflict_descriptions = {c["description"] for c in plan.conflicts}
        
        for conflict_desc in current_turn_conflicts:
            # Basic deduplication
            if conflict_desc not in existing_conflict_descriptions:
                new_conflicts_to_add.append({
                    "description": conflict_desc,
                    "status": "unresolved",
                    "detected_at": str(datetime.now()),
                    "resolution_search_initiated": False,
                    "user_ignored": False,
                    "resolution": None,
                    "announced": True,  # Mark as announced immediately
                    "announcement_attempted": False  # Track if we've tried to announce
                })
                existing_conflict_descriptions.add(conflict_desc)
        
        if new_conflicts_to_add:
            plan.conflicts.extend(new_conflicts_to_add)
            print(f"DEBUG: Added {len(new_conflicts_to_add)} new conflicts to plan")

    # Only show conflicts to LLM that are truly new and haven't been processed yet
    unresolved_conflicts = [c for c in plan.conflicts if c["status"] == "unresolved"] if plan else []
    
    # Show only NEW conflicts that haven't had announcement attempted yet
    new_conflict_descriptions = [
        c["description"] for c in new_conflicts_to_add 
        if not c.get("announcement_attempted")
    ]
    
    print(f"DEBUG: New conflicts to announce: {len(new_conflict_descriptions)}")

    context_data = {
        "plan": plan_summary,
        "research_result": research_result, # Result of LAST step
        "research_mode": research_mode,
        "conflicts": {
            "unresolved": unresolved_conflicts,
            "new_this_turn": new_conflict_descriptions
        },
        "attached_files": attached_files,
        "research_plan_status": {
            "total_tasks": len(research_plan) if research_plan else 0,
            "current_task_index": current_task_index,
            "completed_tasks": current_task_index # Assuming index increments on completion
        } if research_plan else None
    }

    context_json = json.dumps(context_data, ensure_ascii=False)
    
    # Debug: Log what conflicts are being sent to LLM
    if new_conflict_descriptions:
        print(f"DEBUG: Sending {len(new_conflict_descriptions)} conflicts to LLM in context:")
        for i, conf in enumerate(new_conflict_descriptions, 1):
            print(f"  {i}. {conf[:100]}...")  # First 100 chars

    # Optimize history for LLM context window (save tokens)
    # We do NOT modify the state["messages"] directly, so frontend keeps full data.
    optimized_history = optimize_history_messages(messages)

    llm_messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "system",
            "content": f"Current plan & research (JSON): {context_json}",
        },
    ] + optimized_history

    content = ""
    max_retries = 3
    for attempt in range(max_retries):
        try:
            resp = conversation_llm.invoke(llm_messages)
            content = resp.content if isinstance(resp, AIMessage) else resp["content"]
            
            break
        except Exception as e:
            error_str = str(e)
            if "RateLimitError" in error_str or "429" in error_str or "rate limit" in error_str.lower():
                if attempt < max_retries - 1:
                    print(f"DEBUG: LLM Rate limit hit. Retrying in {2 * (attempt + 1)}s...")
                    time.sleep(2 * (attempt + 1))
                    continue
                else:
                    # Return the specific error message as a JSON reply so the frontend renders it
                    error_json = {
                        "reply": "The chat failed likely due to exceeding API's rate limit",
                        "control": {"action": "NONE", "research_query": "", "target_section": None},
                        "update": None
                    }
                    content = json.dumps(error_json)
            else:
                # Re-raise other errors or handle them gracefully
                if attempt == max_retries - 1:
                     print(f"DEBUG: LLM Error: {e}")
                     # Fallback error message
                     error_json = {
                        "reply": f"I encountered an error: {error_str}",
                        "control": {"action": "NONE", "research_query": "", "target_section": None},
                        "update": None
                    }
                     content = json.dumps(error_json)
                else:
                     time.sleep(1)

    # DEBUG: Print raw content to see if LLM is generating blocks
    print(f"DEBUG: LLM Response Content:\n{content}\n" + "-"*20)

    parsed = parse_json_output(content)
    
    # Retry logic if JSON parsing fails
    if not parsed:
        print("DEBUG: JSON parse failed. Retrying with correction prompt.")
        retry_messages = llm_messages + [
            AIMessage(content=content),
            {"role": "system", "content": "ERROR: Your previous response was NOT valid JSON. You must return ONLY a JSON object with 'reply' and 'control' keys. Do not output plain text. Please retry."}
        ]
        try:
            resp = conversation_llm.invoke(retry_messages)
            content = resp.content if isinstance(resp, AIMessage) else resp["content"]
            print(f"DEBUG: Retry Response Content:\n{content}\n" + "-"*20)
            parsed = parse_json_output(content)
        except Exception as e:
            print(f"DEBUG: Retry failed: {e}")

    # --- Inject Sources if available ---
    research_result = state.get("research_result")
    if research_result:
        sources = research_result.get("sources", [])
        if sources and plan:
            # Create a dedicated "Research Sources" section or append to it
            sources_content = []
            for s in sources:
                sources_content.append({
                    "title": s.get("title", "Source"),
                    "url": s.get("url", "#"),
                    "snippet": s.get("snippet", "")
                })
            
            # We manually trigger a plan update for sources
            source_update = {
                "section": "Research Sources",
                "content": sources_content,
                "mode": "append" # Append so we accumulate sources over time
            }
            
            try:
                apply_plan_update(plan, source_update)
                version_bumped = True # Mark that we changed the plan
            except Exception as e:
                print(f"DEBUG: Failed to append sources to plan: {e}")
        
        # Remove sources from the research_result object in state so the LLM doesn't see them
        # and try to add them again to other sections.
        if "sources" in research_result:
            del research_result["sources"]
            
        # We do NOT clear state["research_result"] entirely here, because the LLM needs
        # the "summary" and "key_points" to generate its own update.
        # But we MUST ensure it doesn't see the sources list.
    # -----------------------------------
    
    # --- Update Conflicts Section in Plan ---
    if plan and plan.conflicts:
        conflicts_content = []
        for conflict in plan.conflicts:
            status_emoji = "✅" if conflict["status"] == "resolved" else "⚠️"
            conflict_item = {
                "description": conflict["description"],
                "status": f"{status_emoji} {conflict['status'].title()}",
                "detected": conflict.get("detected_at", "Unknown"),
            }
            if conflict.get("resolution"):
                conflict_item["resolution"] = conflict["resolution"]
            if conflict.get("resolved_at"):
                conflict_item["resolved"] = conflict.get("resolved_at")
            conflicts_content.append(conflict_item)
        
        # Update or create Conflicts section
        conflict_update = {
            "section": "Conflicts",
            "content": conflicts_content,
            "mode": "replace"
        }
        
        try:
            apply_plan_update(plan, conflict_update)
            version_bumped = True
        except Exception as e:
            print(f"DEBUG: Failed to update Conflicts section: {e}")
    # -----------------------------------
    
    reply_text = ""
    action = "NONE"
    research_query = ""
    target_section = ""
    set_plan_title = None
    update_data = None
    new_research_plan = None

    # Check if parsed is a dict and has the expected protocol keys
    if parsed and isinstance(parsed, dict) and ("control" in parsed or "reply" in parsed or "update" in parsed):
        reply_text = parsed.get("reply", "")
        control = parsed.get("control", {})
        action = control.get("action", "NONE")
        research_query = control.get("research_query", "")
        target_section = control.get("target_section", "")
        set_plan_title = control.get("set_plan_title")
        new_research_plan = control.get("research_plan")
        update_data = parsed.get("update")
        resolve_conflict = control.get("resolve_conflict")
        
        # Handle conflict resolution
        if resolve_conflict and plan:
            conflict_desc = resolve_conflict.get("description")
            resolution = resolve_conflict.get("resolution")
            
            if conflict_desc and resolution:
                # Find the conflict in the plan and mark it as resolved
                for conflict in plan.conflicts:
                    if conflict["description"] == conflict_desc:
                        conflict["status"] = "resolved"
                        conflict["resolution"] = resolution
                        conflict["resolved_at"] = str(datetime.now())
                        version_bumped = True
                        break
    elif parsed:
        # Fallback: The LLM returned a raw JSON object (content) preceded by a section title
        # Example: "Financials\n{...}"
        start_char = '{' if isinstance(parsed, dict) else '['
        json_start = content.find(start_char)
        
        if json_start > 0:
            potential_title = content[:json_start].strip()
            # Heuristic: Title should be short and not contain too many newlines
            if potential_title and len(potential_title) < 100:
                 update_data = {
                     "section": potential_title,
                     "content": parsed,
                     "mode": "merge"
                 }
                 reply_text = f"I've updated the {potential_title} section."
                 action = "NONE"
            else:
                 reply_text = content
        else:
            reply_text = content
    else:
        # Fallback if JSON parsing fails
        reply_text = content
        print("DEBUG: Failed to parse JSON response.")

    # Append assistant message to state
    # We store the RAW content (JSON) so the LLM sees its own correct format in history
    messages.append(AIMessage(content=content))
    state["messages"] = messages
    state["last_action"] = action
    
    # --- POST-PROCESSING: Check if conflicts need to be announced ---
    # If there are new conflicts but the LLM didn't mention them, make a second call
    if new_conflict_descriptions and "conflict" not in reply_text.lower():
        print(f"DEBUG: LLM didn't announce conflicts. Making second call for conflict announcement.")
        
        # Create a focused prompt for conflict announcement only
        conflict_announcement_prompt = f"""
You must announce the following conflicts that were discovered during research.

For each conflict below, you MUST:
1. Start with "⚠️ I found a conflict:"
2. State the conflict description clearly
3. Suggest resolution options:
   - "Could you specify a timeframe or preferred source?"
   - "Should I start a deep search to resolve this?"
   - "Or if you have the correct information, please let me know."

Conflicts to announce:
{chr(10).join(f"{i+1}. {conf}" for i, conf in enumerate(new_conflict_descriptions))}

Return your response in the same JSON format as always:
{{
  "reply": "your conflict announcements here",
  "control": {{"action": "NONE", "research_query": "", "research_plan": null, "target_section": null, "set_plan_title": null, "resolve_conflict": null}},
  "update": null
}}
"""
        
        conflict_messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "system", "content": conflict_announcement_prompt}
        ]
        
        try:
            conflict_resp = conversation_llm.invoke(conflict_messages)
            conflict_content = conflict_resp.content if isinstance(conflict_resp, AIMessage) else conflict_resp["content"]
            conflict_parsed = parse_json_output(conflict_content)
            
            if conflict_parsed and isinstance(conflict_parsed, dict):
                conflict_reply = conflict_parsed.get("reply", "")
                if conflict_reply:
                    # Append conflict announcement as a separate message
                    conflict_ai_msg = AIMessage(content=conflict_content)
                    messages.append(conflict_ai_msg)
                    state["messages"] = messages
                    
                    # Update reply_text to include conflicts
                    reply_text = conflict_reply
                    print(f"DEBUG: Successfully added conflict announcement via second call")
                    
                    # Mark conflicts as announced
                    for conflict in plan.conflicts:
                        if conflict["description"] in new_conflict_descriptions:
                            conflict["announced"] = True
                            conflict["announcement_made"] = True  # Flag to prevent re-announcement
        except Exception as e:
            print(f"DEBUG: Error in conflict announcement call: {e}")
    
    # Mark conflicts as having been processed (announcement attempted)
    if new_conflict_descriptions and plan:
        for conflict in plan.conflicts:
            if conflict["description"] in new_conflict_descriptions:
                conflict["announcement_attempted"] = True
    # -----------------------------------

    # Handle Plan Update
    version_bumped = False
    
    if update_data and plan:
        try:
            changed = apply_plan_update(plan, update_data)
            if changed:
                version_bumped = True
        except Exception as e:
            print(f"DEBUG: Error applying plan update: {e}")
            
    # Handle Title Update
    if set_plan_title and plan:
        plan.title = set_plan_title
        version_bumped = True
    
    state["new_version_created"] = version_bumped

    # Handle Research Actions
    if action == "PLAN_RESEARCH":
        if new_research_plan:
            # Check if this is a conflict resolution search
            is_conflict_resolution = False
            if new_research_plan and len(new_research_plan) > 0:
                first_task = new_research_plan[0].get("task", "") if isinstance(new_research_plan[0], dict) else str(new_research_plan[0])
                if "conflict" in first_task.lower() or "resolve" in first_task.lower():
                    is_conflict_resolution = True
                    
            # If it's a conflict resolution search, mark relevant conflicts
            if is_conflict_resolution and plan:
                for conflict in plan.conflicts:
                    if conflict["status"] == "unresolved" and not conflict.get("resolution_search_initiated"):
                        # Match conflicts mentioned in research plan
                        for task in new_research_plan:
                            task_desc = task.get("task", "") if isinstance(task, dict) else str(task)
                            # Simple heuristic: if conflict description keywords appear in task
                            conflict_keywords = conflict["description"].split()[:3]  # First 3 words
                            if any(keyword.lower() in task_desc.lower() for keyword in conflict_keywords):
                                conflict["resolution_search_initiated"] = True
                                break
                                
            state["research_plan"] = new_research_plan
            state["current_task_index"] = 0
            state["aggregated_findings"] = []
            state["research_mode"] = "multi"
            state["research_plan_approved"] = False # Wait for user approval
        state["research_needed"] = False 
        
    elif action == "EXECUTE_PLAN":
        # Check if we should pause to let frontend update
        steps = state.get("steps_in_current_turn", 0)
        if steps >= 1:
             state["research_needed"] = False
             state["continue_after_pause"] = True
             state["research_plan_approved"] = True
        else:
             state["research_needed"] = True
             state["continue_after_pause"] = False
             state["research_mode"] = "multi"
             state["research_plan_approved"] = True
        # We don't set query here; research_node will pick it from plan
        
    elif action == "CALL_RESEARCH":
        state["research_needed"] = True
        state["research_mode"] = "single"
        state["research_query"] = research_query
        state["target_section"] = target_section
        
    else:
        state["research_needed"] = False
        
        # Clear research plan when action is NONE and research is complete
        # This prevents the plan from persisting across different chats
        research_plan = state.get("research_plan")
        current_idx = state.get("current_task_index", 0)
        if research_plan and current_idx >= len(research_plan):
            # Research is complete, clear the plan
            state["research_plan"] = None
            state["current_task_index"] = 0
            state["research_plan_approved"] = False
            state["research_mode"] = "single"
            state["aggregated_findings"] = []

    return state

