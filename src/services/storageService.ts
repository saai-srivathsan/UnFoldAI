import { AccountPlan, ResearchSession } from "../types";

const STORAGE_KEYS = {
  PLANS: "app_plans",
  SESSIONS: "app_sessions",
};

export const storageService = {
  getPlansForUser: (userId: string): AccountPlan[] => {
    const data = localStorage.getItem(STORAGE_KEYS.PLANS);
    const plans: AccountPlan[] = data ? JSON.parse(data) : [];
    return plans.filter((p) => p.userId === userId);
  },

  savePlan: (plan: AccountPlan) => {
    const data = localStorage.getItem(STORAGE_KEYS.PLANS);
    const plans: AccountPlan[] = data ? JSON.parse(data) : [];
    const existingIndex = plans.findIndex((p) => p.id === plan.id);
    
    if (existingIndex >= 0) {
      plans[existingIndex] = plan;
    } else {
      plans.push(plan);
    }
    
    localStorage.setItem(STORAGE_KEYS.PLANS, JSON.stringify(plans));
  },

  deletePlan: (planId: string) => {
    const data = localStorage.getItem(STORAGE_KEYS.PLANS);
    if (!data) return;
    const plans: AccountPlan[] = JSON.parse(data);
    const filteredPlans = plans.filter((p) => p.id !== planId);
    localStorage.setItem(STORAGE_KEYS.PLANS, JSON.stringify(filteredPlans));
  },

  duplicatePlan: (planId: string): AccountPlan | null => {
    const data = localStorage.getItem(STORAGE_KEYS.PLANS);
    if (!data) return null;
    const plans: AccountPlan[] = JSON.parse(data);
    const originalPlan = plans.find((p) => p.id === planId);
    
    if (!originalPlan) return null;

    const newPlan: AccountPlan = {
      ...originalPlan,
      id: "plan-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5),
      title: originalPlan.title ? `Copy of ${originalPlan.title}` : `Copy of ${originalPlan.company}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    plans.push(newPlan);
    localStorage.setItem(STORAGE_KEYS.PLANS, JSON.stringify(plans));
    return newPlan;
  },

  getResearchSessionsForUser: (userId: string): ResearchSession[] => {
    const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    const sessions: ResearchSession[] = data ? JSON.parse(data) : [];
    return sessions.filter((s) => s.userId === userId);
  },

  saveResearchSession: (session: ResearchSession) => {
    const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    const sessions: ResearchSession[] = data ? JSON.parse(data) : [];
    const existingIndex = sessions.findIndex((s) => s.id === session.id);

    if (existingIndex >= 0) {
      sessions[existingIndex] = session;
    } else {
      sessions.push(session);
    }

    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  },
};
