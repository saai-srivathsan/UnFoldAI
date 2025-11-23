import { useEffect, useState, useRef } from "react";
import { Plus, FileText, MoreVertical, Trash2, Copy, AlertTriangle, X } from "lucide-react";
import { cn } from "../lib/utils";
import { storageService } from "../services/storageService";
import { useAuth } from "../hooks/useAuth";
import { AccountPlan } from "../types";

interface SidebarProps {
  isOpen: boolean;
  selectedPlanId: string | null;
  onSelectPlan: (id: string | null) => void;
  refreshTrigger?: number;
}

export function Sidebar({ isOpen, selectedPlanId, onSelectPlan }: SidebarProps) {
  const { currentUser } = useAuth();
  const [plans, setPlans] = useState<AccountPlan[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [planToDelete, setPlanToDelete] = useState<{ id: string; name: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentUser) {
      const allPlans = storageService.getPlansForUser(currentUser.id);
      // Sort plans by updatedAt in descending order (most recent first)
      const sortedPlans = allPlans.sort((a, b) => {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
      setPlans(sortedPlans);
    }
  }, [currentUser, selectedPlanId]); // Refresh when selection changes (e.g. after duplicate)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDeleteClick = (e: React.MouseEvent, planId: string, planName: string) => {
    e.stopPropagation();
    setActiveMenuId(null);
    setPlanToDelete({ id: planId, name: planName });
  };

  const confirmDelete = () => {
    if (planToDelete) {
      storageService.deletePlan(planToDelete.id);
      setPlans((prev) => prev.filter((p) => p.id !== planToDelete.id));
      if (selectedPlanId === planToDelete.id) {
        onSelectPlan(null);
      }
      setPlanToDelete(null);
    }
  };

  const handleDuplicate = (e: React.MouseEvent, planId: string) => {
    e.stopPropagation();
    setActiveMenuId(null);
    
    const newPlan = storageService.duplicatePlan(planId);
    if (newPlan && currentUser) {
      setPlans(storageService.getPlansForUser(currentUser.id));
      // Optionally select the new plan
      // onSelectPlan(newPlan.id); 
    }
  };

  const toggleMenu = (e: React.MouseEvent, planId: string) => {
    e.stopPropagation();
    setActiveMenuId(activeMenuId === planId ? null : planId);
  };

  if (!isOpen) return null;

  return (
    <>
      <aside className="flex h-full w-64 flex-col border-r border-secondary-200 bg-white transition-all duration-300 ease-in-out relative shadow-sm">
        <div className="p-4">
          <button
            onClick={() => onSelectPlan(null)}
            className="flex w-full items-center justify-center gap-2 btn-primary hover:scale-105 transition-all duration-200"
          >
            <Plus className="h-4 w-4" />
            New Plan
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2">
          <div className="mb-6">
            <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-secondary-500">
              My Account Plans
            </h3>
            <div className="space-y-1 pb-20"> 
              {plans.length === 0 ? (
                <p className="px-2 text-sm text-neutral-400 italic">No plans yet</p>
              ) : (
                plans.map((plan) => (
                  <div key={plan.id} className="relative group animate-fade-in">
                    <button
                      onClick={() => onSelectPlan(plan.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-all duration-200 hover:shadow-sm",
                        selectedPlanId === plan.id
                          ? "bg-primary-50 text-primary-700 shadow-sm"
                          : "text-secondary-700 hover:bg-secondary-50"
                      )}
                    >
                      <FileText className="h-4 w-4 shrink-0 text-neutral-500" />
                      <div className="flex-1 truncate">
                        <div className="font-medium truncate">{plan.title || plan.company}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-secondary-400">
                            {new Date(plan.updatedAt).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              year: new Date(plan.updatedAt).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                            })}
                          </span>
                        </div>
                      </div>
                      {/* {selectedPlanId === plan.id && <ChevronRight className="h-4 w-4 opacity-50" />} */}
                    </button>

                    {/* Three dots menu button */}
                    <button
                      onClick={(e) => toggleMenu(e, plan.id)}
                      className={cn(
                        "absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110",
                        activeMenuId === plan.id && "opacity-100 bg-secondary-100 text-secondary-600"
                      )}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>

                    {/* Dropdown Menu */}
                    {activeMenuId === plan.id && (
                      <div 
                        ref={menuRef}
                        className="absolute right-0 top-full mt-1 w-36 card z-50 py-1 animate-slide-in"
                      >
                        <button
                          onClick={(e) => handleDuplicate(e, plan.id)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-secondary-700 hover:bg-secondary-50 transition-colors duration-150"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Duplicate
                        </button>
                        <button
                          onClick={(e) => handleDeleteClick(e, plan.id, plan.title || plan.company)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors duration-150"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Delete Confirmation Modal */}
      {planToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md card p-6 shadow-xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3 text-red-600">
                <div className="rounded-full bg-red-100 p-2">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900">Delete Account Plan</h3>
              </div>
              <button 
                onClick={() => setPlanToDelete(null)}
                className="text-secondary-400 hover:text-secondary-500 transition-colors duration-150 hover:scale-110"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-6">
              <p className="text-sm text-secondary-600">
                Are you sure you want to delete the account plan for <span className="font-semibold text-secondary-900">{planToDelete.name}</span>?
              </p>
              <p className="mt-2 text-sm text-secondary-500">
                This action cannot be undone. All research data and chat history associated with this plan will be permanently removed.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setPlanToDelete(null)}
                className="rounded-md border border-secondary-300 bg-white px-4 py-2 text-sm font-medium text-secondary-700 hover:bg-secondary-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200 hover:scale-105"
              >
                Delete Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
