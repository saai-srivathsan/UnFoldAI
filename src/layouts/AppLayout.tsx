import { useState, useRef, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import { ChatInterface } from "../components/ChatInterface";
import { ArtifactCanvas } from "../components/ArtifactCanvas";
import { useAuth } from "../hooks/useAuth";
import { Menu, User as UserIcon, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";

export default function AppLayout() {
  const { currentUser, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [planVersion, setPlanVersion] = useState(0);
  
  // Resizable panels state
  const [chatWidthPercent, setChatWidthPercent] = useState(50); // Default 50%
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const handlePlanUpdate = () => {
    setPlanVersion((v) => v + 1);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      const newPercent = (newWidth / containerRect.width) * 100;
      
      // Clamp between 20% and 80%
      if (newPercent >= 20 && newPercent <= 80) {
        setChatWidthPercent(newPercent);
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  return (
    <div className="flex h-screen flex-col bg-neutral-50 overflow-hidden">
      {/* Top Navbar */}
      <header className="flex h-14 items-center justify-between border-b bg-white px-4 shadow-sm z-10 animate-slide-in">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="rounded-lg p-2 hover:bg-primary-50 text-neutral-600 hover:text-primary-600 transition-all duration-200 hover:scale-110"
            title={isSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
          >
            {isSidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
          </button>
          <h1 className="text-lg font-semibold text-neutral-800 bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
            UnFoldAI
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1.5 hover:bg-neutral-200 transition-colors duration-200">
            {currentUser?.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt="Avatar" className="h-6 w-6 rounded-full" />
            ) : (
              <UserIcon className="h-5 w-5 text-neutral-500" />
            )}
            <span className="text-sm font-medium text-neutral-700">{currentUser?.name}</span>
          </div>
          <button
            onClick={logout}
            className="rounded-lg p-2 text-neutral-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200 hover:scale-110"
            title="Logout"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className={`${isSidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 overflow-hidden border-r bg-white shadow-sm`}>
            <Sidebar
            isOpen={true} // Always render internal content, hide via container width
            onSelectPlan={setSelectedPlanId}
            selectedPlanId={selectedPlanId}
            refreshTrigger={planVersion}
            />
        </div>

        {/* Resizable Area */}
        <div ref={containerRef} className="flex flex-1 min-w-0 relative">
            {/* Center Chat */}
            <main 
                style={{ width: `${chatWidthPercent}%` }} 
                className="flex flex-col border-r bg-white min-w-[300px] shadow-sm"
            >
            <ChatInterface 
                selectedPlanId={selectedPlanId} 
                onPlanCreated={(newId: string) => setSelectedPlanId(newId)}
                onPlanUpdated={handlePlanUpdate}
            />
            </main>

            {/* Drag Handle */}
            <div 
                className="w-1 cursor-col-resize hover:bg-primary-500 active:bg-primary-600 transition-colors duration-200 bg-neutral-200 z-20 flex items-center justify-center hover:shadow-md"
                onMouseDown={handleMouseDown}
            >
                <div className="h-8 w-0.5 bg-neutral-400 rounded-full hover:bg-primary-400 transition-colors duration-200" />
            </div>

            {/* Right Canvas */}
            <aside className="flex-1 flex-col overflow-y-auto bg-neutral-50 xl:flex min-w-[300px] shadow-inner">
            <ArtifactCanvas planId={selectedPlanId} refreshTrigger={planVersion} />
            </aside>
        </div>
      </div>
    </div>
  );
}
