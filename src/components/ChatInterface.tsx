import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Play, CheckCircle2, Circle, Paperclip, X, File as FileIcon, Mic, Square, Volume2, Pause } from "lucide-react";
import Markdown from "react-markdown";
import { cn } from "../lib/utils";
import { apiClient } from "../services/apiClient";
import { storageService } from "../services/storageService";
import { useAuth } from "../hooks/useAuth";
import { ChatMessage, AccountPlan, ResearchProgress, ResearchTask } from "../types";

interface ChatInterfaceProps {
  selectedPlanId: string | null;
  onPlanCreated?: (planId: string) => void;
  onPlanUpdated?: () => void;
}

interface AttachedFile {
  id: string;
  filename: string;
}

function ResearchStepList({ progress, startTime, tasks }: { progress: ResearchProgress | null, startTime: number, tasks?: ResearchTask[] }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const displayTasks = progress?.tasks || tasks || [];
  const currentStepIndex = progress ? progress.current_step - 1 : -1;

  if (displayTasks.length === 0) {
    return (
      <div className="flex items-center gap-3 animate-pulse-slow">
        <span className="text-neutral-600 font-medium">Thinking...</span>
        <span className="text-xs text-neutral-400 font-mono">({formatTime(elapsed)})</span>
        <div className="flex space-x-1 h-4 items-center pt-1">
            <div className="h-2 w-2 bg-primary-500 rounded-full animate-bounce-subtle [animation-delay:-0.3s]"></div>
            <div className="h-2 w-2 bg-primary-500 rounded-full animate-bounce-subtle [animation-delay:-0.15s]"></div>
            <div className="h-2 w-2 bg-primary-500 rounded-full animate-bounce-subtle"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-3 animate-fade-in">
      <div className="flex justify-between items-center text-xs text-neutral-600 border-b border-neutral-100 pb-2">
        <span className="font-medium">Researching...</span>
        <span className="font-mono">{formatTime(elapsed)}</span>
      </div>
      
      <div className="space-y-2">
        {displayTasks.map((task, idx) => {
            const taskName = typeof task === 'string' ? task : task.task;
            let status: 'pending' | 'current' | 'completed' = 'pending';
            
            if (progress) {
                if (idx < currentStepIndex) status = 'completed';
                else if (idx === currentStepIndex) status = 'current';
            } else {
                // If no progress yet, first task is loading, others pending
                if (idx === 0) status = 'current';
            }
            
            return (
                <div key={idx} className="flex items-start gap-2.5 animate-slide-in" style={{ animationDelay: `${idx * 100}ms` }}>
                    <div className="mt-0.5 flex-shrink-0">
                        {status === 'completed' && (
                            <CheckCircle2 className="w-4 h-4 text-secondary-600 animate-in zoom-in duration-300" />
                        )}
                        {status === 'current' && (
                            <Loader2 className="w-4 h-4 text-primary-600 animate-spin" />
                        )}
                        {status === 'pending' && (
                            <Circle className="w-4 h-4 text-neutral-300" />
                        )}
                    </div>
                    <span className={cn(
                        "leading-tight transition-colors duration-300",
                        status === 'completed' ? "text-neutral-500" : 
                        status === 'current' ? "text-primary-700 font-medium" : "text-neutral-400"
                    )}>
                        {taskName}
                    </span>
                </div>
            );
        })}
      </div>
    </div>
  );
}

function CompletedResearch({ progress }: { progress: ResearchProgress }) {
    const tasks = progress.tasks || [];
    const duration = progress.duration;

    const formatDuration = (seconds: number) => {
        if (seconds < 60) return `${Math.floor(seconds)}s`;
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}m ${secs}s`;
    };
    
    return (
      <div className="w-full max-w-md bg-neutral-50 border border-neutral-200 rounded-xl p-3 mt-2 animate-fade-in shadow-sm">
        <div className="flex items-center justify-between text-secondary-700 mb-3">
           <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-full bg-secondary-100 flex items-center justify-center">
                    <CheckCircle2 className="w-3 h-3" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider">Research Completed</span>
           </div>
           {duration !== undefined && (
               <span className="text-xs text-neutral-400 font-mono bg-neutral-100 px-2 py-0.5 rounded-full">
                   {formatDuration(duration)}
               </span>
           )}
        </div>
        
        <div className="space-y-1.5 pl-1">
             {tasks.map((task, idx) => {
                const taskName = typeof task === 'string' ? task : task.task;
                return (
                    <div key={idx} className="flex items-center gap-2 text-xs text-neutral-600 animate-slide-in" style={{ animationDelay: `${idx * 50}ms` }}>
                        <CheckCircle2 className="w-3 h-3 text-secondary-500 flex-shrink-0" />
                        <span className="line-clamp-1">{taskName}</span>
                    </div>
                )
             })}
        </div>
      </div>
    );
}

function ResearchPlanPreview({ plan, onStart }: { plan: ResearchTask[], onStart: () => void }) {
  return (
    <div className="w-full max-w-md card overflow-hidden mt-2 animate-slide-in shadow-lg">
      <div className="bg-neutral-50 px-4 py-2 border-b border-neutral-200 flex justify-between items-center">
        <span className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">Deep Search Plan</span>
        <span className="text-xs text-neutral-500">{plan.length} steps</span>
      </div>
      <div className="p-3 space-y-2">
        {plan.map((task, idx) => (
          <div key={idx} className="flex items-start gap-2 text-sm text-neutral-700 animate-fade-in" style={{ animationDelay: `${idx * 100}ms` }}>
            <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-primary-100 text-primary-600 text-xs font-medium">
              {idx + 1}
            </span>
            <span className="leading-tight pt-0.5">{typeof task === 'string' ? task : task.task}</span>
          </div>
        ))}
      </div>
      <div className="bg-neutral-50 px-4 py-3 border-t border-neutral-200 flex gap-2">
        <button 
          onClick={onStart}
          className="flex-1 flex items-center justify-center gap-2 btn-primary hover:scale-105 transition-all duration-200"
        >
          <Play className="w-4 h-4" />
          Start Deep Search
        </button>
      </div>
      <div className="px-4 pb-2 text-center">
         <span className="text-[10px] text-neutral-400">Want changes? Just ask in chat (e.g. "Remove step 2")</span>
      </div>
    </div>
  );
}

export function ChatInterface({ selectedPlanId, onPlanCreated, onPlanUpdated }: ChatInterfaceProps) {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isResearching, setIsResearching] = useState(false);
  const [researchProgress, setResearchProgress] = useState<ResearchProgress | null>(null);
  const [researchStartTime, setResearchStartTime] = useState<number>(0);
  const [proposedPlan, setProposedPlan] = useState<ResearchTask[] | null>(null);
  const [activeResearchPlan, setActiveResearchPlan] = useState<ResearchTask[] | null>(null);
  const [currentPlan, setCurrentPlan] = useState<AccountPlan | null>(null);
  const [tempConversationId, setTempConversationId] = useState<string>("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [availableFiles, setAvailableFiles] = useState<AttachedFile[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState<number>(-1);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const latestProgressRef = useRef<ResearchProgress | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Cleanup speech synthesis on unmount
    return () => {
        window.speechSynthesis.cancel();
    };
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("Speech recognition not supported in this browser");
        return;
      }
      
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      recognition.onstart = () => {
          setIsRecording(true);
      };
      
      recognition.onend = () => {
          setIsRecording(false);
      };
      
      recognition.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsRecording(false);
      };
      
      let finalTranscript = "";
      
      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        // We want to append to the existing input value, but only the new part.
        // This is tricky with React state updates in a callback.
        // A simpler approach for this demo: 
        // When recording starts, we capture the current input value?
        // Or we just append the *final* transcript to the input when it arrives.
        
        if (finalTranscript) {
             setInputValue(prev => {
                 // To avoid appending the same final transcript multiple times if onresult fires often
                 // We reset finalTranscript after appending?
                 // Actually, let's just use the transcript directly.
                 // But we need to know what was there before.
                 // Let's just append to the end.
                 return prev + (prev && !prev.endsWith(' ') ? ' ' : '') + finalTranscript;
             });
             finalTranscript = "";
        }
      };
      
      recognitionRef.current = recognition;
      recognition.start();
    }
  };

  const handleSpeak = (text: string, messageId: string) => {
      if (speakingMessageId === messageId) {
          if (isPaused) {
              window.speechSynthesis.resume();
              setIsPaused(false);
          } else {
              window.speechSynthesis.pause();
              setIsPaused(true);
          }
      } else {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.onend = () => {
              setSpeakingMessageId(null);
              setIsPaused(false);
          };
          utterance.onpause = () => setIsPaused(true);
          utterance.onresume = () => setIsPaused(false);
          
          window.speechSynthesis.speak(utterance);
          setSpeakingMessageId(messageId);
          setIsPaused(false);
      }
  };

  const handleStopSpeak = () => {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      setIsPaused(false);
  };

  useEffect(() => {
    // Reset all state when switching between plans
    setMessages([]);
    setIsResearching(false);
    setResearchProgress(null);
    setProposedPlan(null);
    setActiveResearchPlan(null);
    latestProgressRef.current = null;
    
    if (selectedPlanId && currentUser) {
      const plans = storageService.getPlansForUser(currentUser.id);
      const plan = plans.find((p) => p.id === selectedPlanId);
      setCurrentPlan(plan || null);
      setTempConversationId(""); // Clear temp ID when a plan is selected
      
      // Load chat history from backend
      apiClient.getChatHistory(selectedPlanId).then((data) => {
        if (data.messages.length > 0) {
          setMessages(data.messages);
        } else {
          // Fallback if no history found on backend (e.g. server restart)
          setMessages([
            {
              id: "welcome",
              role: "assistant",
              content: plan ? `Welcome back! Ready to dive deeper into **${plan.company}**? I'm here to help refine your account plan or research any new developments.` : "Welcome! I'm your intelligent research assistant. Let's create a comprehensive account plan together - just tell me which company you'd like to explore.",
              timestamp: new Date().toISOString(),
            },
          ]);
        }
        setAvailableFiles(data.attachedFiles || []);
      }).catch((error) => {
        console.error("Error loading chat history:", error);
        // Set welcome message even on error
        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content: plan ? `Welcome back! Ready to dive deeper into **${plan.company}**? I'm here to help refine your account plan or research any new developments.` : "Welcome! I'm your intelligent research assistant. Let's create a comprehensive account plan together - just tell me which company you'd like to explore.",
            timestamp: new Date().toISOString(),
          },
        ]);
        setAvailableFiles([]);
      });
    } else {
      setCurrentPlan(null);
      setAvailableFiles([]);
      // Generate a new temp conversation ID for this "New Plan" session
      // This ensures the backend creates a fresh session instead of reusing the user's default one
      setTempConversationId(`new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
      setMessages([
        {
          id: "welcome-new",
          role: "assistant",
          content: "Hi there! I'm excited to help you build a winning account plan. Which company has caught your interest? Let's uncover what makes them tick and create a strategy that gives you an edge.",
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  }, [selectedPlanId, currentUser]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isResearching, researchProgress, proposedPlan]);

  const handleSendMessage = async (overrideMessage?: string, isHidden: boolean = false) => {
    const messageContent = overrideMessage || inputValue;
    if (!messageContent.trim() || !currentUser) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: messageContent,
      timestamp: new Date().toISOString(),
    };

    const currentAttachedFiles = [...attachedFiles];
    
    if (!isHidden) {
        // Optimistic update
        setMessages((prev) => [...prev, userMessage]);
        setInputValue("");
        setAttachedFiles([]); // Clear attached files
        setResearchProgress(null);
        latestProgressRef.current = null;
        
        if (proposedPlan) {
            setActiveResearchPlan(proposedPlan);
        }
        setProposedPlan(null); // Clear previous proposal if any
        setResearchStartTime(Date.now());
    }
    
    setIsResearching(true);

    // Ensure we have a conversation ID if we are in "New Plan" mode
    // This prevents the race condition where tempConversationId might be empty on first render
    let activeConversationId = tempConversationId;
    if (!selectedPlanId && !activeConversationId) {
        activeConversationId = `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setTempConversationId(activeConversationId);
    }

    try {
      const response = await apiClient.sendChatMessage({
        userId: currentUser.id,
        planId: selectedPlanId,
        message: userMessage.content,
        conversationId: selectedPlanId ? undefined : activeConversationId,
        fileIds: currentAttachedFiles.map(f => f.id),
      });

      // Update messages with the full history returned from backend
      // This ensures we are in sync with the server state
      if (response.assistantMessages && response.assistantMessages.length > 0) {
        setMessages((prev) => {
            // Preserve researchProgress from local state if backend doesn't have it
            const progressMap = new Map(prev.map(m => [m.id, m.researchProgress]));
            
            return response.assistantMessages!.map(msg => ({
                ...msg,
                researchProgress: progressMap.get(msg.id) || msg.researchProgress
            }));
        });
      }

      // Update Plan if changed
      if (response.updatedPlan) {
        setCurrentPlan(response.updatedPlan);
        storageService.savePlan(response.updatedPlan);
        
        // Notify parent to refresh other components
        if (onPlanUpdated) {
            onPlanUpdated();
        }
        
        // If this was a new plan (we didn't have a selectedPlanId), we might want to select it
        if (!selectedPlanId && response.updatedPlan.id) {
           if (onPlanCreated) {
             onPlanCreated(response.updatedPlan.id);
           } else {
             // Fallback if prop not provided
             window.location.reload();
           }
        }
      }

      setIsResearching(response.researchStatus === "researching");
      if (response.progress) {
          setResearchProgress(response.progress);
          latestProgressRef.current = response.progress;
      }
      
      // If research just finished (was researching, now idle/done), append completion marker
      // We detect this if we were researching, and the response status is NOT researching
      const finalProgress = response.progress || latestProgressRef.current;
      
      if (isResearching && response.researchStatus !== "researching" && finalProgress) {
          const duration = (Date.now() - researchStartTime) / 1000;

          // Append the completion state to the LAST assistant message
          setMessages(prev => {
              const newMsgs = [...prev];
              const lastMsg = newMsgs[newMsgs.length - 1];
              if (lastMsg.role === "assistant") {
                  newMsgs[newMsgs.length - 1] = {
                      ...lastMsg,
                      researchProgress: {
                          ...finalProgress,
                          duration: duration
                      }
                  };
              }
              return newMsgs;
          });
      }
      
      if (response.researchPlan) {
          setProposedPlan(response.researchPlan);
      }
      
      // Auto-continue if researching
      if (response.researchStatus === "researching") {
          setTimeout(() => handleSendMessage("[CONTINUE_RESEARCH]", true), 100);
      } else {
          // If not researching, trigger update to refresh sidebar files
          if (onPlanUpdated) onPlanUpdated();
      }

    } catch (error) {
      console.error("Error sending message:", error);
      setIsResearching(false);
      setResearchProgress(null);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "Sorry, I encountered an error processing your request. Please ensure the backend is running.",
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // If suggestion menu is open, select first item? 
      // For now, just send message if not selecting
      if (mentionQuery === null) {
          handleSendMessage();
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputValue(val);
    
    // Simple detection: last word starts with @
    const lastAt = val.lastIndexOf('@');
    if (lastAt !== -1) {
        // Check if cursor is after @
        const cursor = e.target.selectionStart;
        if (cursor > lastAt) {
            const query = val.substring(lastAt + 1, cursor);
            // Check if query contains space - usually mentions don't have spaces or we stop tracking
            if (!query.includes(' ')) {
                setMentionQuery(query);
                setMentionIndex(lastAt);
                return;
            }
        }
    }
    setMentionQuery(null);
    setMentionIndex(-1);
  };

  const handleMentionSelect = (file: AttachedFile) => {
      if (mentionIndex === -1) return;
      
      const fname = file.filename || (file as any).name || "file";
      const before = inputValue.substring(0, mentionIndex);
      const after = inputValue.substring(mentionIndex + (mentionQuery?.length || 0) + 1);
      
      setInputValue(`${before}@${fname} ${after}`);
      setMentionQuery(null);
      setMentionIndex(-1);
      
      // Add to attached files if not present
      if (!attachedFiles.find(f => f.id === file.id)) {
          setAttachedFiles(prev => [...prev, file]);
      }
      
      textareaRef.current?.focus();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadFiles(Array.from(e.target.files));
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await uploadFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const uploadFiles = async (files: File[]) => {
    setIsUploading(true);
    try {
      for (const file of files) {
        const result = await apiClient.uploadFile(file);
        setAttachedFiles((prev) => [...prev, { id: result.id, filename: result.filename }]);
      }
    } catch (error) {
      console.error("Upload failed:", error);
      // You might want to show a toast here
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeFile = (fileId: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header Context */}
      {currentPlan && (
        <div className="border-b bg-neutral-50 px-4 text-xs text-neutral-500">
          {/* Working on: <span className="font-semibold text-neutral-700">{currentPlan.company}</span> (v{currentPlan.version}) */}
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg) => {
          // Filter out auto-generated control messages
          if (msg.role === "user" && msg.content.trim() === "[CONTINUE_RESEARCH]") {
            return null;
          }

          // Filter out intermediate "Step X complete" messages from the LLM
          // These are redundant because we show the progress bar
          const isStepCompletion = /Step \d+ (complete|finished|done)/i.test(msg.content) || /Researching step \d+/i.test(msg.content);

          // Check if assistant message is empty and has no attachments
          const isLastMessage = messages.indexOf(msg) === messages.length - 1;
          const hasAttachments = msg.researchProgress || (proposedPlan && isLastMessage);
          const content = msg.content || "";
          const isEmptyAssistant = msg.role === "assistant" && !content.trim();

          if ((isEmptyAssistant || isStepCompletion) && !hasAttachments) {
            return null;
          }

          // Special handling for welcome messages
          const isWelcomeMessage = msg.id === "welcome" || msg.id === "welcome-new";

          if (isWelcomeMessage) {
            return (
              <div key={msg.id} className="flex justify-center py-8 animate-fade-in">
                <div className="text-center max-w-md">
                  <div className="mb-6">
                    <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-primary-100 text-primary-600 animate-bounce-subtle mb-4">
                      <div className="text-2xl font-bold text-primary-600">F</div>
                    </div>
                    <div className="space-y-2">
                      <h1 className="text-2xl font-bold text-neutral-800 animate-slide-in" style={{ animationDelay: '0.2s' }}>
                        Welcome to Fold
                      </h1>
                      <div className="text-sm text-neutral-600 animate-slide-in" style={{ animationDelay: '0.4s' }}>
                        <span className="inline-block animate-pulse">Your AI-Powered Account Planning Assistant</span>
                      </div>
                      <div className="text-xs text-neutral-500 animate-slide-in mt-4" style={{ animationDelay: '0.6s' }}>
                        <span className="typing-animation">
                          {msg.id === "welcome-new" 
                            ? "Ready to research • Analyze • Strategize"
                            : "Let's continue building your strategy"
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-center space-x-2 animate-slide-in" style={{ animationDelay: '0.8s' }}>
                    <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce-subtle"></div>
                    <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce-subtle" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce-subtle" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            );
          }

          return (
          <div
            key={msg.id}
            className={cn(
              "flex w-full",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            
            <div className="flex flex-col gap-2 max-w-[80%]">
                {/* Only render text bubble if there is content */}
                {msg.content.trim() && (
                    <div className="group relative">
                        <div
                        className={cn(
                            "rounded-xl px-4 py-3 text-sm shadow-sm transition-all duration-200 hover:shadow-md",
                            msg.role === "user"
                            ? "bg-primary-600 text-white"
                            : "bg-white border border-neutral-200 text-neutral-800"
                        )}
                        >
                        {msg.isResearching ? (
                            <div className="flex items-center gap-3">
                            <span className="font-medium text-primary-700">Searching for answers...</span>
                            <div className="flex space-x-1 h-4 items-center pt-1">
                                <div className="h-2 w-2 bg-primary-500 rounded-full animate-bounce-subtle [animation-delay:-0.3s]"></div>
                                <div className="h-2 w-2 bg-primary-500 rounded-full animate-bounce-subtle [animation-delay:-0.15s]"></div>
                                <div className="h-2 w-2 bg-primary-500 rounded-full animate-bounce-subtle"></div>
                            </div>
                            </div>
                        ) : null}
                        
                        <div className={cn("prose prose-sm max-w-none", msg.role === "user" ? "prose-invert" : "")}>
                            <Markdown>{msg.content}</Markdown>
                        </div>
                        </div>

                        {/* TTS Controls */}
                        {msg.role === "assistant" && !msg.isResearching && (
                            <div className={cn(
                                "absolute -bottom-6 left-0 flex items-center gap-1 transition-all duration-200",
                                speakingMessageId === msg.id ? "opacity-100 scale-100" : "opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100"
                            )}>
                                {speakingMessageId === msg.id ? (
                                    <>
                                        <button 
                                            onClick={() => handleSpeak(msg.content, msg.id)}
                                            className="p-1 text-neutral-500 hover:text-primary-600 rounded hover:bg-neutral-100 transition-colors duration-150 hover:scale-110"
                                            title={isPaused ? "Resume" : "Pause"}
                                        >
                                            {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                                        </button>
                                        <button 
                                            onClick={handleStopSpeak}
                                            className="p-1 text-neutral-500 hover:text-red-600 rounded hover:bg-neutral-100 transition-colors duration-150 hover:scale-110"
                                            title="Stop"
                                        >
                                            <Square className="w-3 h-3 fill-current" />
                                        </button>
                                    </>
                                ) : (
                                    <button 
                                        onClick={() => handleSpeak(msg.content, msg.id)}
                                        className="p-1 text-neutral-400 hover:text-primary-600 rounded hover:bg-neutral-100 transition-colors duration-150 hover:scale-110"
                                        title="Read aloud"
                                    >
                                        <Volume2 className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
                
                {/* Render Proposed Plan if this is the last message and we have one */}
                {msg.role === "assistant" && proposedPlan && isLastMessage && (
                    <ResearchPlanPreview 
                        plan={proposedPlan} 
                        onStart={() => handleSendMessage("Start deep search")} 
                    />
                )}
                
                {/* Render Completed Research if attached to message */}
                {msg.researchProgress && msg.researchProgress.duration !== undefined && (
                  <CompletedResearch progress={msg.researchProgress} />
                )}
            </div>
          </div>
        );
        })}
        
        {isResearching && (
           <div className="flex w-full justify-start animate-fade-in">
              <div className="bg-white border border-neutral-200 rounded-xl px-4 py-3 text-sm shadow-sm flex items-center gap-3 w-full max-w-md">
                  <ResearchStepList 
                    progress={researchProgress} 
                    startTime={researchStartTime} 
                    tasks={activeResearchPlan || undefined}
                  />
              </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div 
        className="border-t bg-white p-4 relative"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {/* Attached Files Preview */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachedFiles.map((file) => (
              <div key={file.id} className="flex items-center gap-2 bg-neutral-100 rounded-lg px-2 py-1 text-xs text-neutral-700 border border-neutral-200 animate-fade-in hover:bg-neutral-200 transition-colors duration-200">
                <FileIcon className="w-3 h-3 text-primary-500" />
                <span className="max-w-[150px] truncate">{file.filename}</span>
                <button 
                  onClick={() => removeFile(file.id)}
                  className="text-neutral-400 hover:text-red-500 transition-colors duration-150 hover:scale-110"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Mention Suggestions */}
        {mentionQuery !== null && (
            <div className="absolute bottom-full mb-2 left-0 w-64 card z-20 animate-slide-in shadow-lg">
                {(() => {
                    // Combine available files and currently attached files, deduplicated
                    const allFiles = [...availableFiles];
                    attachedFiles.forEach(f => {
                        if (!allFiles.find(af => af.id === f.id)) {
                            allFiles.push(f);
                        }
                    });
                    
                    const filtered = allFiles.filter(f => {
                        const fname = f.filename || (f as any).name || "";
                        return fname.toLowerCase().includes((mentionQuery || "").toLowerCase());
                    });
                    
                    if (filtered.length === 0) return null;
                    
                    return filtered.map(f => (
                        <button 
                            key={f.id}
                            className="w-full text-left px-3 py-2 hover:bg-neutral-50 text-sm flex items-center gap-2 transition-colors duration-150"
                            onClick={() => handleMentionSelect(f)}
                        >
                            <FileIcon className="w-3 h-3 text-primary-500" />
                            <span className="truncate">{f.filename || (f as any).name}</span>
                        </button>
                    ));
                })()}
            </div>
        )}

        <div className="relative flex items-end gap-2 rounded-xl border bg-white p-2 shadow-sm focus-within:ring-2 focus-within:ring-primary-500 focus-within:shadow-lg transition-all duration-200">
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden" 
            multiple 
          />
          
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Research a company or update your plan..."
            className="flex-1 resize-none border-0 bg-transparent p-2 text-sm focus:ring-0 focus:outline-none max-h-32 text-neutral-800 placeholder-neutral-400"
            rows={1}
            style={{ minHeight: "44px" }}
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isResearching}
            className="mb-1 rounded-lg p-2 text-neutral-400 hover:bg-primary-50 hover:text-primary-600 transition-all duration-200 disabled:opacity-50 hover:scale-110"
            title="Attach files"
          >
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </button>

          <button
            onClick={toggleRecording}
            disabled={isUploading || isResearching}
            className={cn(
                "mb-1 rounded-lg p-2 transition-all duration-200 disabled:opacity-50 hover:scale-110",
                isRecording 
                    ? "text-red-600 bg-red-50 hover:bg-red-100 animate-pulse" 
                    : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
            )}
            title={isRecording ? "Stop recording" : "Start recording"}
          >
            {isRecording ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-4 w-4" />}
          </button>

          <button
            onClick={() => handleSendMessage()}
            disabled={(!inputValue.trim() && attachedFiles.length === 0) || isResearching || isUploading}
            className="mb-1 rounded-lg bg-primary-600 p-2 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2 text-center text-xs text-neutral-400">
          AI can make mistakes. Review generated plans carefully.
        </div>
      </div>
    </div>
  );
}
