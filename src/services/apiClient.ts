import { AccountPlan, ChatMessage, ResearchProgress, ResearchTask } from "../types";

export const apiClient = {
  sendChatMessage: async (payload: {
    userId: string;
    planId: string | null;
    message: string;
    conversationId?: string | null;
    fileIds?: string[];
  }): Promise<{
    assistantMessages: ChatMessage[];
    updatedPlan?: AccountPlan;
    newVersionCreated?: boolean;
    researchStatus?: "idle" | "researching" | "done";
    progress?: ResearchProgress;
    researchPlan?: ResearchTask[];
    attachedFiles?: { id: string; filename: string }[];
  }> => {
    try {
      const res = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Chat failed");
      }

      const data = await res.json();

      // Transform backend messages to frontend ChatMessage format
      // We prefer the full history from the backend if available.
      
      const history: ChatMessage[] = (data.messages || []).map((m: any, idx: number) => {
        let role: "user" | "assistant" = "user";
        if (m.role === "ai" || m.role === "assistant") role = "assistant";
        else if (m.role === "human" || m.role === "user") role = "user";
        
        return {
          id: `msg-${idx}`, // Stable ID based on index to prevent re-renders
          role: role,
          content: typeof m.content === 'string' ? m.content : (m.content ? JSON.stringify(m.content) : ""),
          timestamp: new Date().toISOString(),
          researchProgress: m.researchProgress, // Map the research progress
        };
      });

      return {
        assistantMessages: history, 
        updatedPlan: data.plan,
        newVersionCreated: data.newVersionCreated,
        researchStatus: data.researchStatus === "researching" ? "researching" : "done",
        progress: data.progress,
        researchPlan: data.researchPlan,
        attachedFiles: data.attachedFiles,
      };
    } catch (error) {
      console.error("API Error:", error);
      throw error;
    }
  },

  getChatHistory: async (sessionId: string): Promise<{ messages: ChatMessage[]; attachedFiles: { id: string; filename: string }[] }> => {
    try {
      const res = await fetch(`http://localhost:8000/api/history/${sessionId}`);
      if (!res.ok) return { messages: [], attachedFiles: [] };
      const data = await res.json();
      const messages = (data.messages || []).map((m: any, idx: number) => {
        let role: "user" | "assistant" = "user";
        if (m.role === "ai" || m.role === "assistant") role = "assistant";
        else if (m.role === "human" || m.role === "user") role = "user";

        return {
          id: `msg-${idx}`, // Consistent ID prefix with sendChatMessage
          role: role,
          content: typeof m.content === 'string' ? m.content : (m.content ? JSON.stringify(m.content) : ""),
          timestamp: new Date().toISOString(),
          researchProgress: m.researchProgress, // Map the research progress
        };
      });
      return { messages, attachedFiles: data.attachedFiles || [] };
    } catch (error) {
      console.error("Error fetching history:", error);
      return { messages: [], attachedFiles: [] };
    }
  },

  updatePlan: async (planId: string, plan: AccountPlan): Promise<AccountPlan> => {
    try {
      const res = await fetch(`http://localhost:8000/api/plans/${planId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plan),
      });
      
      if (!res.ok) {
        throw new Error("Failed to update plan");
      }
      
      const data = await res.json();
      return data.plan;
    } catch (error) {
      console.error("Error updating plan:", error);
      throw error;
    }
  },

  uploadFile: async (file: File): Promise<{ id: string; filename: string }> => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://localhost:8000/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("File upload failed");
      }

      return await res.json();
    } catch (error) {
      console.error("Upload Error:", error);
      throw error;
    }
  },
};
