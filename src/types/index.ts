export * from "./user";

export interface PlanSection {
  title: string;
  content: string | string[] | Record<string, any>;
}

export interface AccountPlan {
  id: string;
  userId: string;
  company: string;
  goal: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  version: number; // v1, v2, ...
  sections: PlanSection[];
  history?: any[]; // Snapshots of previous versions
}

export interface ResearchSession {
  id: string;
  userId: string;
  planId: string | null;
  querySummary: string;
  createdAt: string;
  status: "in_progress" | "completed" | "failed";
  notes?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  isResearching?: boolean;
  researchProgress?: ResearchProgress; // To persist progress state in history
}

export interface ResearchProgress {
  current_step: number;
  total_steps: number;
  label: string;
  visual: string;
  tasks?: ResearchTask[];
  duration?: number; // Duration in seconds
}

export interface ResearchTask {
  task: string;
  id?: number;
}
