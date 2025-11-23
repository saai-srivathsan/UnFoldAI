# UnFoldAI

## 1. Overview

UnFoldAI is an intelligent research and account-planning assistant designed to help users analyze companies and generate structured strategic insights through natural conversation. The system integrates external web research with user-provided documents, resolves information inconsistencies, and produces an editable account plan in a structured format. The agent adapts its interaction style to different user behaviors, allowing for efficient or guided workflows depending on user intent.

## 2. Key Features

UnFoldAI is designed to behave as an adaptive research assistant capable of conducting multi-step investigations, synthesizing information, and producing structured account plans while maintaining a natural conversational experience. The following core capabilities align with the evaluation criteria.

---

### 2.1 Feature Summary

| Feature Area | Description |
|--------------|-------------|
| Natural Conversational Interaction | Responds in a human-like manner, maintaining context across turns and adapting tone to user behavior. |
| Multi-Step Research Execution | Automatically plans and executes research flows, including breaking down large requests into subtasks when necessary. |
| Structured Account Plan Generation | Produces and updates account plans in a formal JSON schema with section-level editing controls. |
| Real-Time Progress Updates | Communicates research status during longer processes to maintain transparency and engagement. |
| Conflict Handling and Reasoning | Identifies inconsistencies across data sources and surfaces them to the user before integrating findings. |
| Persona-Adaptive Behavior | Infers user intent and behavioral style (efficient, confused, chatty, or edge-case) and adjusts tone and workflow accordingly. |
| External and Internal Data Fusion | Uses live web search (Perplexity) alongside uploaded documents for context-driven synthesis. |
| Controlled Editing Workflow | Supports append, replace, merge, delete, and move operations using JSON-based update commands. |

---

### 2.2 Behavioral Intelligence and Adaptation

UnFoldAI adapts to the user’s communication style implicitly through contextual cues rather than explicit selection. The system adjusts its level of detail, number of clarifying questions, and conversational tone based on inferred user type. This improves usability across a range of interaction patterns.

---

### 2.3 Research Workflow Overview

The research process is executed in structured phases, with explicit tool-based reasoning and visible progress updates.

```mermaid
flowchart TD
    A[User Request] --> B[Intent & Persona Interpretation]
    B --> C[Research Strategy Planning]
    C --> D{Research Mode}
    D -->|Single Query| E[Quick Web Search]
    D -->|Multi-step| F[Multi-Stage Research and Analysis]
    E --> G[Document Integration (Optional)]
    F --> G[Document Integration (Optional)]
    G --> H[Conflict Detection & Resolution]
    H --> I[Structured Account Plan Update]
    I --> J[User Review & Iteration]
