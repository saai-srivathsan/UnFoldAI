import { useEffect, useState, useMemo } from "react";
import { AccountPlan } from "../types";
import { storageService } from "../services/storageService";
import { apiClient } from "../services/apiClient";
import { useAuth } from "../hooks/useAuth";
import { cn } from "../lib/utils";
import { ChevronDown, ChevronUp, Layers, Edit2, Save, X, History, File as FileIcon, Download } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Mermaid } from "./Mermaid";

interface ArtifactCanvasProps {
  planId: string | null;
  refreshTrigger?: number;
}

export function ArtifactCanvas({ planId, refreshTrigger = 0 }: ArtifactCanvasProps) {
  const { currentUser } = useAuth();
  const [plan, setPlan] = useState<AccountPlan | null>(null);
  const [displayPlan, setDisplayPlan] = useState<AccountPlan | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editState, setEditState] = useState<AccountPlan | null>(null);
  const [historyIndex, setHistoryIndex] = useState<number>(-1); // -1 means current
  const [sessionFiles, setSessionFiles] = useState<{ id: string; filename: string }[]>([]);
  const [showVersionPanel, setShowVersionPanel] = useState(false);

  const availableVersions = useMemo(() => {
      if (!plan) return [];
      
      // Gather all candidates (history + current)
      const candidates = [...(plan.history || []), plan];
      
      // Deduplicate by version number (simple map)
      const versionMap = new Map();
      candidates.forEach(p => {
          versionMap.set(p.version, p);
      });
      
      const unique = Array.from(versionMap.values());
      
      // Sort by version ascending
      unique.sort((a: any, b: any) => a.version - b.version);
      
      // Map to display format (No renumbering)
      return unique.map((p: any) => ({
          actualVersion: p.version,
          displayVersion: p.version,
          updatedAt: p.updatedAt,
          isCurrent: p.version === plan.version
      }));
  }, [plan]);

  useEffect(() => {
    if (planId && currentUser) {
      const plans = storageService.getPlansForUser(currentUser.id);
      const foundPlan = plans.find((p) => p.id === planId);
      setPlan(foundPlan || null);
      setDisplayPlan(foundPlan || null);
      setHistoryIndex(-1);
      setIsEditing(false);
      
      // Initialize expanded state for new sections
      if (foundPlan && foundPlan.sections) {
        const newExpanded: Record<string, boolean> = {};
        foundPlan.sections.forEach((s, idx) => {
           // Default expand first 2 sections
           if (expandedSections[s.title] === undefined) {
               newExpanded[s.title] = idx < 2;
           }
        });
        setExpandedSections(prev => ({...newExpanded, ...prev}));
      }

      // Fetch session files
      apiClient.getChatHistory(planId).then((data) => {
        setSessionFiles(data.attachedFiles || []);
      });

    } else {
      setPlan(null);
      setDisplayPlan(null);
      setSessionFiles([]);
    }
  }, [planId, currentUser, refreshTrigger]);

  // Handle History Navigation
  useEffect(() => {
    if (!plan) return;
    
    if (historyIndex === -1 || historyIndex >= plan.version) {
        setDisplayPlan(plan);
    } else {
        // Try to find snapshot in history
        // History is stored as snapshots. 
        // If version is 5, history might have [v1, v2, v3, v4]
        // If historyIndex is 1, we want v1.
        // But history array might not be perfectly aligned if some versions were skipped or not saved.
        // Let's assume history is ordered.
        if (plan.history && plan.history.length > 0) {
            // Find the snapshot with the matching version, or closest
            // Actually, let's just use index for simplicity if we assume 1:1 mapping
            // But better to be robust.
            // If we just use the index from the slider (1-based version)
            // We need to map version number to history item.
            // Since history is just a list of dicts, we need to cast it.
            const snapshot = plan.history.find((h: any) => h.version === historyIndex);
            if (snapshot) {
                setDisplayPlan(snapshot as AccountPlan);
            } else {
                // Fallback
                setDisplayPlan(plan);
            }
        }
    }
  }, [historyIndex, plan]);

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  const handleStartEdit = () => {
    if (!plan) return;
    setEditState(JSON.parse(JSON.stringify(plan))); // Deep copy
    setIsEditing(true);
    setHistoryIndex(-1); // Jump to current
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditState(null);
  };

  const handleSaveEdit = async () => {
    if (!editState || !plan) return;
    try {
        // Optimistic update
        setPlan(editState);
        setDisplayPlan(editState);
        setIsEditing(false);
        
        // Persist to backend
        await apiClient.updatePlan(plan.id, editState);
        
        // Also update local storage
        storageService.savePlan(editState);
        
    } catch (e) {
        console.error("Failed to save plan", e);
        alert("Failed to save changes");
    }
  };

  const updateSectionContent = (index: number, newContent: any) => {
      if (!editState) return;
      const newSections = [...editState.sections];
      newSections[index] = { ...newSections[index], content: newContent };
      setEditState({ ...editState, sections: newSections });
  };

  const handleDownloadPDF = () => {
    const currentDisplay = isEditing ? editState : displayPlan;
    if (!currentDisplay) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    let yPos = 20;

    // Title
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(currentDisplay.title || "Account Plan", margin, yPos);
    yPos += 10;

    // Company & Version
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`${currentDisplay.company} • v${currentDisplay.version}`, margin, yPos);
    yPos += 15;
    
    doc.setTextColor(0);

    // Sections
    currentDisplay.sections.forEach((section) => {
        // Check for page break
        if (yPos > doc.internal.pageSize.getHeight() - 20) {
            doc.addPage();
            yPos = 20;
        }

        // Section Title
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(section.title, margin, yPos);
        yPos += 8;

        // Section Content
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        
        if (typeof section.content === 'object' && section.content !== null && !Array.isArray(section.content)) {
            // Key-Value Object -> Table
            const tableBody = Object.entries(section.content).map(([k, v]) => [
                k.replace(/_/g, ' '), 
                typeof v === 'string' ? v : JSON.stringify(v)
            ]);

            autoTable(doc, {
                startY: yPos,
                head: [['Metric', 'Details']],
                body: tableBody,
                theme: 'grid',
                headStyles: { fillColor: [79, 70, 229] }, // Indigo-600
                styles: { fontSize: 10, cellPadding: 3 },
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
                margin: { left: margin, right: margin },
            });
            
            yPos = (doc as any).lastAutoTable.finalY + 10;

        } else if (Array.isArray(section.content)) {
            const contentText = section.content.map((item: any) => {
                if (typeof item === 'string') return `• ${item}`;
                if (typeof item === 'object' && item !== null) {
                     if ('title' in item && 'url' in item) {
                         return `• ${item.title}\n  ${item.url}`;
                     }
                     return `• ${Object.entries(item).map(([k,v]) => `${k}: ${v}`).join(', ')}`;
                }
                return JSON.stringify(item);
            }).join('\n\n');

            const splitText = doc.splitTextToSize(contentText, contentWidth);
            
            if (yPos + (splitText.length * 5) > doc.internal.pageSize.getHeight() - 20) {
                 doc.addPage();
                 yPos = 20;
            }
            
            doc.text(splitText, margin, yPos);
            yPos += (splitText.length * 5) + 10;

        } else {
            let contentText = "";
            if (typeof section.content === 'string') {
                contentText = section.content.replace(/[#*`]/g, ''); 
            } else {
                contentText = JSON.stringify(section.content, null, 2);
            }

            const splitText = doc.splitTextToSize(contentText, contentWidth);
            
            if (yPos + (splitText.length * 5) > doc.internal.pageSize.getHeight() - 20) {
                 doc.addPage();
                 yPos = 20;
            }
            
            doc.text(splitText, margin, yPos);
            yPos += (splitText.length * 5) + 10;
        }
    });

    doc.save(`${currentDisplay.company.replace(/\s+/g, '_')}_Plan_v${currentDisplay.version}.pdf`);
  };

  if (!plan) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-secondary-500">
        <Layers className="mb-4 h-12 w-12 text-secondary-300" />
        <h3 className="text-lg font-medium text-secondary-900">No Plan Selected</h3>
        <p className="mt-2 text-sm">Select a plan from the sidebar or start a new conversation to create one.</p>
      </div>
    );
  }

  const currentDisplay = isEditing ? editState : displayPlan;
  
  const currentDisplayVersion = currentDisplay?.version;

  if (!currentDisplay) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-secondary-200 bg-white px-6 py-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-secondary-900">{currentDisplay.title || currentDisplay.company}</h2>
            <p className="text-sm text-secondary-500 mt-1">{currentDisplay.company}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-primary-100 text-primary-800 border border-primary-200">
                v{currentDisplayVersion}
              </span>
              {historyIndex !== -1 && historyIndex !== plan.version && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-warning-100 text-warning-800 border border-warning-200">
                  Historical View
                </span>
              )}
            </div>
            {!isEditing ? (
              <>
                <button 
                  onClick={() => setShowVersionPanel(true)}
                  className="p-2 text-secondary-500 hover:text-primary-600 hover:bg-primary-50 rounded-full transition-colors"
                  title="Version History"
                >
                  <History className="h-4 w-4" />
                </button>
                <button 
                  onClick={handleDownloadPDF}
                  className="p-2 text-secondary-500 hover:text-primary-600 hover:bg-primary-50 rounded-full transition-colors"
                  title="Download PDF"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button 
                  onClick={handleStartEdit}
                  className="p-2 text-secondary-500 hover:text-primary-600 hover:bg-primary-50 rounded-full transition-colors"
                  title="Edit Plan"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              </>
            ) : (
              <div className="flex gap-2">
                <button 
                  onClick={handleCancelEdit}
                  className="p-2 text-secondary-500 hover:text-error-600 hover:bg-error-50 rounded-full transition-colors"
                  title="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>
                <button 
                  onClick={handleSaveEdit}
                  className="p-2 text-success-600 hover:text-success-700 hover:bg-success-50 rounded-full transition-colors"
                  title="Save Changes"
                >
                  <Save className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Version History Side Panel */}
        {showVersionPanel && (
          <div className="fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div 
              className="flex-1 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowVersionPanel(false)}
            />
            
            {/* Side Panel */}
            <div className="w-80 bg-white shadow-xl border-l border-secondary-200 flex flex-col animate-in slide-in-from-right duration-300">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-secondary-200">
                <h3 className="text-lg font-semibold text-secondary-900">Version History</h3>
                <button 
                  onClick={() => setShowVersionPanel(false)}
                  className="p-1 text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100 rounded-full transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              {/* Version List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {availableVersions.map((v) => (
                    <button
                        key={v.actualVersion}
                        onClick={() => {
                            const val = v.actualVersion;
                            setHistoryIndex(val === plan.version ? -1 : val);
                            setShowVersionPanel(false);
                        }}
                        className={cn(
                            "w-full flex items-center justify-between p-3 rounded-lg border transition-all duration-200 hover:shadow-sm text-left",
                            (historyIndex === -1 ? plan.version : historyIndex) === v.actualVersion
                                ? "bg-primary-50 border-primary-200 shadow-sm"
                                : "bg-white border-secondary-200 hover:bg-secondary-50"
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <span className={cn(
                                "inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold",
                                v.isCurrent 
                                    ? "bg-primary-100 text-primary-800 border border-primary-200"
                                    : "bg-secondary-100 text-secondary-700 border border-secondary-200"
                            )}>
                                v{v.displayVersion}
                            </span>
                            {v.isCurrent && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-success-100 text-success-800 border border-success-200">
                                    Current
                                </span>
                            )}
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-secondary-500">
                                {new Date(v.updatedAt).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric',
                                    year: new Date(v.updatedAt).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                                })}
                            </div>
                            <div className="text-xs text-secondary-400">
                                {new Date(v.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                        </div>
                    </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {currentDisplay.sections.length === 0 ? (
            <div className="text-center text-secondary-400 italic py-10">
                No research data yet. Ask the agent to start researching.
            </div>
        ) : (
            currentDisplay.sections.map((section, idx) => (
                <Section
                    key={idx}
                    title={section.title}
                    isExpanded={!!expandedSections[section.title] || isEditing}
                    onToggle={() => toggleSection(section.title)}
                >
                    {isEditing ? (
                        <ContentEditor 
                            content={section.content} 
                            onChange={(newContent) => updateSectionContent(idx, newContent)}
                        />
                    ) : (
                        <ContentRenderer content={section.content} />
                    )}
                </Section>
            ))
        )}

        {/* Files Section - Integrated into scrollable area */}
        {sessionFiles.length > 0 && (
            <div className="mt-8 pt-6 border-t border-secondary-200">
            <h3 className="text-sm font-semibold text-secondary-900 mb-3 flex items-center gap-2">
                <FileIcon className="w-4 h-4" />
                Files
            </h3>
            <div className="grid grid-cols-1 gap-2">
                {sessionFiles.map((file) => (
                <div
                    key={file.id}
                    className="flex items-center gap-3 p-2 bg-secondary-50 border border-secondary-200 rounded-md hover:bg-secondary-100 transition-colors"
                >
                    <div className="p-1.5 bg-white rounded border border-secondary-200">
                    <FileIcon className="w-3 h-3 text-blue-600" />
                    </div>
                    <span className="text-xs font-medium text-secondary-700 truncate">
                    {file.filename || (file as any).name}
                    </span>
                </div>
                ))}
            </div>
            </div>
        )}
      </div>
    </div>
  );
}

function ContentEditor({ content, onChange }: { content: any, onChange: (c: any) => void }) {
    if (typeof content === 'string') {
        return (
            <textarea 
                className="w-full min-h-[150px] p-3 text-sm border rounded-md focus:outline-none"
                value={content}
                onChange={(e) => onChange(e.target.value)}
            />
        );
    }
    
    if (Array.isArray(content)) {
        return (
            <div className="space-y-2">
                {content.map((item, i) => (
                    <div key={i} className="flex gap-2">
                        <div className="flex-1">
                             {/* Recursive editor for list items? For simplicity, assume strings or simple objects */}
                             {typeof item === 'string' ? (
                                 <input 
                                    className="w-full p-2 text-sm border rounded focus:outline-none"
                                    value={item}
                                    onChange={(e) => {
                                        const newArr = [...content];
                                        newArr[i] = e.target.value;
                                        onChange(newArr);
                                    }}
                                 />
                             ) : (
                                 <div className="p-2 border rounded bg-secondary-50 text-xs text-secondary-500">
                                     Complex object editing not supported in this view.
                                 </div>
                             )}
                        </div>
                        <button 
                            onClick={() => {
                                const newArr = content.filter((_, idx) => idx !== i);
                                onChange(newArr);
                            }}
                            className="text-red-500 hover:bg-red-50 p-1 rounded"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                ))}
                <button 
                    onClick={() => onChange([...content, "New Item"])}
                    className="text-xs text-indigo-600 hover:underline font-medium"
                >
                    + Add Item
                </button>
            </div>
        );
    }
    
    if (typeof content === 'object' && content !== null) {
        return (
            <div className="space-y-4">
                {Object.entries(content).map(([key, value], i) => (
                    <div key={i} className="border-l-2 border-secondary-200 pl-3">
                        <label className="block text-xs font-medium text-secondary-500 uppercase mb-1">{key.replace(/_/g, " ")}</label>
                        {/* Recursive call for value */}
                        <ContentEditor 
                            content={value} 
                            onChange={(newVal) => {
                                onChange({ ...content, [key]: newVal });
                            }}
                        />
                    </div>
                ))}
            </div>
        );
    }
    
    return <div className="text-red-500">Unsupported content type</div>;
}

function Section({ title, children, isExpanded, onToggle }: { title: string; children: React.ReactNode; isExpanded: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-lg border bg-white shadow-sm">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <h3 className="font-semibold text-secondary-900">{title}</h3>
        {isExpanded ? <ChevronUp className="h-5 w-5 text-secondary-500" /> : <ChevronDown className="h-5 w-5 text-secondary-500" />}
      </button>
      {isExpanded && <div className="border-t px-4 py-4">{children}</div>}
    </div>
  );
}

function ContentRenderer({ content }: { content: any }) {
    if (!content) return <span className="text-secondary-400 italic">Empty section</span>;

    if (typeof content === "string") {
        return (
            <div className="prose prose-sm max-w-none text-secondary-800">
                <Markdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        code(props) {
                            const {children, className, node, ...rest} = props
                            const match = /language-(\w+)/.exec(className || '')
                            if (match && match[1] === 'mermaid') {
                                return <Mermaid chart={String(children).replace(/\n$/, '')} />
                            }
                            return (
                                <code {...rest} className={className}>
                                    {children}
                                </code>
                            )
                        },
                        table: ({ node, ...props }) => (
                            <div className="overflow-x-auto my-4">
                                <table className="min-w-full border-collapse border border-secondary-200" {...props} />
                            </div>
                        ),
                        thead: ({ node, ...props }) => (
                            <thead className="bg-primary-50" {...props} />
                        ),
                        tbody: ({ node, ...props }) => (
                            <tbody className="divide-y divide-secondary-200" {...props} />
                        ),
                        tr: ({ node, ...props }) => (
                            <tr className="hover:bg-secondary-50" {...props} />
                        ),
                        th: ({ node, ...props }) => (
                            <th className="px-4 py-2 text-left text-xs font-semibold text-primary-600 uppercase tracking-wider border border-secondary-200" {...props} />
                        ),
                        td: ({ node, ...props }) => (
                            <td className="px-4 py-2 text-sm text-secondary-800 border border-secondary-200" {...props} />
                        ),
                    }}
                >
                    {content}
                </Markdown>
            </div>
        );
    }

    if (Array.isArray(content)) {
        return (
            <ul className="space-y-2 text-sm text-secondary-800">
                {content.map((item, i) => (
                    <li key={i} className={typeof item === 'string' ? "list-disc list-inside" : ""}>
                        {renderItem(item)}
                    </li>
                ))}
            </ul>
        );
    }

    if (typeof content === "object") {
        return (
            <div className="space-y-3">
                {Object.entries(content).map(([key, value], i) => (
                    <div key={i}>
                        <div className="text-xs font-medium text-secondary-500 uppercase tracking-wide">{key.replace(/_/g, " ")}</div>
                        <div className="mt-1 text-sm text-secondary-800">
                            {Array.isArray(value) ? (
                                <ul className="space-y-1 mt-1">
                                    {value.map((item, idx) => (
                                        <li key={idx} className={typeof item === 'string' ? "list-disc list-inside" : ""}>
                                            {renderItem(item)}
                                        </li>
                                    ))}
                                </ul>
                            ) : typeof value === 'object' && value !== null ? (
                                // Recursive render for nested objects
                                <div className="pl-2 border-l-2 border-secondary-100 mt-1">
                                    <ContentRenderer content={value} />
                                </div>
                            ) : (
                                typeof value === 'string' ? value : JSON.stringify(value)
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return <div className="text-sm text-secondary-500">{JSON.stringify(content)}</div>;
}

function renderItem(item: any) {
    if (typeof item === 'string') return item;
    
    if (typeof item === 'object' && item !== null) {
        // Check for search result pattern (title + url)
        if ('title' in item && 'url' in item) {
            return (
                <div className="block p-2 rounded border border-secondary-100 bg-secondary-50 hover:bg-secondary-100 transition-colors">
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline block">
                        {item.title}
                    </a>
                    {item.snippet && <p className="text-secondary-600 text-xs mt-1 line-clamp-2">{item.snippet}</p>}
                </div>
            );
        }
        
        // Generic object rendering
        return (
            <div className="bg-secondary-50 p-2 rounded text-xs space-y-1">
                {Object.entries(item).map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[auto_1fr] gap-2">
                        <span className="font-semibold text-secondary-500 capitalize">{k.replace(/_/g, " ")}:</span>
                        <span>{typeof v === 'string' ? v : JSON.stringify(v)}</span>
                    </div>
                ))}
            </div>
        );
    }
    
    return JSON.stringify(item);
}

