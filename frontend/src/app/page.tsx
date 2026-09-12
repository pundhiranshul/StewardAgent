"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { ArrowRight, Bot, Loader2, PlaySquare, Smartphone, Globe, Terminal, FileText, CheckCircle2, Square, ArrowLeft, MessageSquare, X, Send, Copy, History, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [playStore, setPlayStore] = useState("");
  const [appStore, setAppStore] = useState("");
  const [context, setContext] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isSummarizingPdf, setIsSummarizingPdf] = useState(false);
  const [pdfSummary, setPdfSummary] = useState("");
  
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfFile(file);
    setIsSummarizingPdf(true);
    
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/summarize-pdf", {
        method: "POST",
        headers: { "x-access-code": accessCode },
        body: fd
      });
      if (res.status === 401) {
        alert("Invalid Access Code");
        setIsSummarizingPdf(false);
        return;
      }
      if (!res.ok) {
        let errorMsg = "Failed to summarize PDF";
        try {
          const errData = await res.json();
          errorMsg = errData.detail || errorMsg;
        } catch(e) {}
        alert(`Server Error: ${errorMsg}. Did you restart the backend?`);
        return;
      }
      const data = await res.json();
      if (data.summary) {
        setPdfSummary(data.summary);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to summarize PDF");
    } finally {
      setIsSummarizingPdf(false);
    }
  };
  
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const handleCopy = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };
  
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [showAccessCodeModal, setShowAccessCodeModal] = useState(false);
  const [tempAccessCode, setTempAccessCode] = useState("");
  const [accessCodeError, setAccessCodeError] = useState(false);
  
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [mainAccessCodeError, setMainAccessCodeError] = useState(false);

  const verifyCodeAndProceed = async () => {
    if (!accessCode) {
      alert("Please enter Access Code");
      return;
    }
    setIsVerifyingCode(true);
    setMainAccessCodeError(false);
    try {
      const res = await fetch("/api/history", {
        headers: { "x-access-code": accessCode }
      });
      if (res.ok) {
        setCurrentStep(6);
      } else {
        setMainAccessCodeError(true);
        setTimeout(() => setMainAccessCodeError(false), 500);
      }
    } catch (e) {
      alert("Failed to verify code");
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const fetchHistory = async (overrideCode?: string) => {
    const codeToUse = overrideCode || accessCode;
    if (!codeToUse) {
      setShowAccessCodeModal(true);
      return;
    }
    setIsLoadingHistory(true);
    try {
      const res = await fetch("/api/history", {
        headers: { "x-access-code": codeToUse }
      });
      if (res.status === 401) {
        if (overrideCode) {
           setAccessCodeError(true);
           setTimeout(() => setAccessCodeError(false), 500);
        } else {
           alert("Invalid Access Code");
        }
        setShowHistory(false);
        return;
      }
      const data = await res.json();
      setAccessCode(codeToUse); // Save valid code
      setShowAccessCodeModal(false);
      setHistoryList(data.history || []);
      setShowHistory(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const deleteHistory = async (jobIdToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent opening the chat
    if (!confirm("Are you sure you want to delete this analysis permanently?")) return;
    
    try {
      const res = await fetch(`/api/history/${jobIdToDelete}`, {
        method: "DELETE",
        headers: { "x-access-code": accessCode }
      });
      if (res.ok) {
        setHistoryList(prev => prev.filter(item => item.job_id !== jobIdToDelete));
        if (jobId === jobIdToDelete) {
           // if they deleted the currently open job, maybe reset UI
           setStatus("idle");
        }
      } else {
        alert("Failed to delete the analysis.");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting analysis.");
    }
  };

  const [contextSummary, setContextSummary] = useState<string>("");
  const [showSummary, setShowSummary] = useState(false);

  const loadPastAnalysis = async (pastJobId: string) => {
    setJobId(pastJobId);
    setShowHistory(false);
    setChatMessages([]);
    setChatContext("");
    setReport("");
    setLiveLogs("Loading past analysis...");
    setContextSummary("");
    setShowSummary(false);
    
    try {
      const res = await fetch(`/api/status/${pastJobId}`, {
        headers: { "x-access-code": accessCode }
      });
      const data = await res.json();
      
      setStatus(data.status);
      if (data.final_report) setReport(data.final_report);
      if (data.live_logs) setLiveLogs(data.live_logs);
      if (data.context_summary) setContextSummary(data.context_summary);
      
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };
  
  const [status, setStatus] = useState<"idle" | "running" | "completed" | "error">("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [liveLogs, setLiveLogs] = useState<string>("");
  const [report, setReport] = useState<string>("");
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatContext, setChatContext] = useState(""); // The selected section
  const [selectedTextSnippet, setSelectedTextSnippet] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Selection tooltip state
  const [selectionRect, setSelectionRect] = useState<{ top: number, left: number } | null>(null);
  const [selectedText, setSelectedText] = useState("");

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current && logsEndRef.current.parentElement) {
      const container = logsEndRef.current.parentElement;
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, [liveLogs]);

  // Memoize the huge report rendering to avoid lag on chat input
  const renderedReport = useMemo(() => {
    if (!report) return null;
    const footnoteRegex = /`?<span class="footnote" data-source-id="([^"]+)">(.*?)<\/span>`?/g;
    
    // Split by major headings (H1 or H2)
    const sections = report.split(/(?=\n#{1,2}\s)/);
    let finalMarkdown = "";
    
    sections.forEach(section => {
      let sectionFootnotes: { id: string; content: string; num: number }[] = [];
      let lastSourceId: string | null = null;
      let localCounter = 1;
      
      const processedSection = section.replace(footnoteRegex, (match, id, content) => {
        let displayContent = content;
        if (id === lastSourceId) {
          displayContent = "<i>Ibid.</i>";
        } else {
          lastSourceId = id;
        }
        
        const currentNum = localCounter;
        sectionFootnotes.push({ id, content: displayContent, num: currentNum });
        localCounter++;
        
        return `<sup>[${currentNum}]</sup>`;
      });
      
      finalMarkdown += processedSection;
      
      if (sectionFootnotes.length > 0) {
        finalMarkdown += '\n\n<hr class="w-1/2 border-neutral-300 my-6" />\n\n';
        finalMarkdown += '<div class="text-xs text-neutral-500 space-y-1.5 mb-10">\n';
        sectionFootnotes.forEach(fn => {
          finalMarkdown += `<p><span class="font-bold mr-1">[${fn.num}]</span> ${fn.content}</p>\n`;
        });
        finalMarkdown += '</div>\n\n';
      }
    });
    
    return (
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]} 
        rehypePlugins={[rehypeRaw]}
        components={{
          table: ({node, ...props}) => (
            <div className="w-full overflow-x-auto my-6 border border-neutral-200 rounded-lg print:overflow-visible print:border-none">
              <table className="w-full text-left border-collapse min-w-max print:min-w-0" {...props} />
            </div>
          ),
          th: ({node, ...props}) => <th className="bg-neutral-50 px-4 py-3 font-semibold text-neutral-900 border-b border-neutral-200 print:bg-transparent" {...props} />,
          td: ({node, ...props}) => <td className="px-4 py-3 border-b border-neutral-100 align-top" {...props} />
        }}
      >
        {finalMarkdown}
      </ReactMarkdown>
    );
  }, [report]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatEndRef.current && chatEndRef.current.parentElement) {
      const container = chatEndRef.current.parentElement;
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, [chatMessages]);

  const startAnalysis = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url) return;
    
    setStatus("running");
    setLiveLogs("");
    setReport("");
    setChatMessages([]);
    setChatContext("");
    setContextSummary("");
    setShowSummary(false);
    
    try {
      const formData = new FormData();
      formData.append("url", url);
      formData.append("play_store_url", playStore);
      formData.append("app_store_url", appStore);
      
      let finalContext = context;
      if (pdfSummary) {
          finalContext += "\n\n" + pdfSummary;
      }
      formData.append("additional_info", finalContext);

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { 
          "x-access-code": accessCode
        },
        body: formData
      });
      
      if (res.status === 401) {
        alert("Invalid Access Code. Please enter a valid code.");
        setStatus("idle");
        return;
      }
      
      const data = await res.json();
      setJobId(data.job_id);
    } catch (error) {
      console.error(error);
      setStatus("error");
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const checkStatus = async () => {
      if (!jobId || status !== "running") return;
      try {
        const res = await fetch(`/api/status/${jobId}`, {
          headers: { "x-access-code": accessCode }
        });
        
        const data = await res.json();

        if (res.status === 401) {
          setStatus("error");
          if (data.final_report) {
             setReport(data.final_report);
          }
          if (data.live_logs) {
             setLiveLogs(data.live_logs);
          }
          if (data.context_summary) {
             setContextSummary(data.context_summary);
          }
          return;
        }

        if (data.live_logs) setLiveLogs(data.live_logs);
        if (data.final_report) setReport(data.final_report);
        if (data.context_summary) setContextSummary(data.context_summary);
        
        if (data.status === "completed" || data.status === "stopped") {
          setStatus("completed");
        }
      } catch (error) {
        console.error(error);
      }
    };
    if (status === "running" && jobId) {
      interval = setInterval(checkStatus, 3000);
    }
    return () => clearInterval(interval);
  }, [jobId, status]);

  const stopAnalysis = async () => {
    if (!jobId) return;
    try {
      await fetch(`/api/stop/${jobId}`, { 
        method: "POST",
        headers: { "x-access-code": accessCode }
      });
      setStatus("completed");
    } catch (error) {
      console.error(error);
    }
  };

  const resetAnalysis = () => {
    setStatus("idle");
    setJobId(null);
  };

  // Text selection handler
  const handleMouseUp = () => {
    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      
      if (selection && text) {
        const range = selection.getRangeAt(0);
        let rect = range.getBoundingClientRect();
        
        // Handle weird rects for multi-cell table selections
        let top = rect.top + window.scrollY - 40;
        let left = rect.left + window.scrollX + rect.width / 2;
        
        if (rect.width === 0 && rect.height === 0) {
          // It's a cross-cell table selection or weird range. Fallback to the first element's rect
          const startElem = range.startContainer.parentElement;
          if (startElem) {
            rect = startElem.getBoundingClientRect();
            top = rect.top + window.scrollY - 40;
            left = rect.left + window.scrollX + rect.width / 2;
          } else {
            top = window.scrollY + window.innerHeight / 2;
            left = window.scrollX + window.innerWidth / 2;
          }
        }

        // Clamp the tooltip strictly inside the report window
        if (reportRef.current) {
          const reportRect = reportRef.current.getBoundingClientRect();
          // Tooltip is ~160px wide and centered, so we need ~80px padding from the edges
          const minLeft = reportRect.left + window.scrollX + 80;
          const maxLeft = reportRect.right + window.scrollX - 80;
          
          if (left < minLeft) left = minLeft;
          if (left > maxLeft) left = maxLeft;
        }

        setSelectionRect({ top, left });
        setSelectedText(text);
      } else {
        setSelectionRect(null);
        setSelectedText("");
      }
    }, 10);
  };

  // Click outside to close tooltip
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.tooltip-container')) return;

      if (!window.getSelection()?.toString().trim()) {
        setSelectionRect(null);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, []);

  // Extract the closest section from the full report
  const extractSectionForContext = (selectedStr: string) => {
    if (!report) return selectedStr;
    const lines = report.split('\n');
    let targetSection = "";
    
    // Normalize string to ignore markdown, tables, pipes, whitespace
    const normalize = (s: string) => s.replace(/[\W_]+/g, '').toLowerCase();
    const normSelected = normalize(selectedStr);
    
    let idx = report.indexOf(selectedStr);
    
    if (idx === -1 && normSelected.length > 5) {
      const normReport = normalize(report);
      const normIdx = normReport.indexOf(normSelected);
      
      if (normIdx !== -1) {
        let normCount = 0;
        for (let i = 0; i < report.length; i++) {
          if (/[a-zA-Z0-9]/.test(report[i])) {
            if (normCount === normIdx) {
              idx = i;
              break;
            }
            normCount++;
          }
        }
      } else {
        const snippet = normSelected.substring(0, 15);
        if (snippet.length >= 5) {
          const fallbackIdx = normReport.indexOf(snippet);
          if (fallbackIdx !== -1) {
            let normCount = 0;
            for (let i = 0; i < report.length; i++) {
              if (/[a-zA-Z0-9]/.test(report[i])) {
                if (normCount === fallbackIdx) {
                  idx = i;
                  break;
                }
                normCount++;
              }
            }
          }
        }
      }
    }
    
    if (idx === -1) return selectedStr; // fallback
    
    // Find nearest preceding heading
    const textBefore = report.substring(0, idx);
    const headingsBefore = textBefore.match(/^#+ .*$/gm);
    let currentHeading = "";
    if (headingsBefore && headingsBefore.length > 0) {
      currentHeading = headingsBefore[headingsBefore.length - 1];
    }
    
    // Find next heading to bound the section
    const textAfter = report.substring(idx);
    const headingsAfter = textAfter.match(/^#+ .*$/gm);
    let nextHeading = "";
    if (headingsAfter && headingsAfter.length > 0) {
      nextHeading = headingsAfter[0];
    }
    
    // Extract substring between current heading and next heading
    const startIdx = currentHeading ? report.indexOf(currentHeading) : 0;
    const endIdx = nextHeading ? report.indexOf(nextHeading, idx) : report.length;
    
    if (startIdx !== -1 && endIdx !== -1) {
      targetSection = report.substring(startIdx, endIdx);
    } else {
      targetSection = report.substring(Math.max(0, idx - 1000), Math.min(report.length, idx + 1000));
    }
    
    return targetSection;
  };

  const handleAskFollowUp = () => {
    if (selectedText) {
      const extractedSection = extractSectionForContext(selectedText);
      setChatContext(extractedSection);
      setSelectedTextSnippet(selectedText.length > 100 ? selectedText.substring(0, 100) + '...' : selectedText);
      setSelectionRect(null);
      window.getSelection()?.removeAllRanges();
      setSelectedText("");
      
      // Auto-focus chat input
      setTimeout(() => {
        document.getElementById('chat-input')?.focus();
      }, 100);
    }
  };

  const clearChatContext = () => {
    setChatContext("");
    setSelectedTextSnippet("");
  };

  const sendChatMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim() && !chatContext) return;
    
    let userMsgContent = chatInput.trim();
    if (!userMsgContent) {
      userMsgContent = `Can you explain this?`;
    }

    let displayMsgContent = userMsgContent;
    if (chatContext) {
      displayMsgContent = `> ${selectedTextSnippet}\n\n${userMsgContent}`;
    }

    const newMessages = [...chatMessages, { role: "user" as const, content: displayMsgContent }];
    setChatMessages(newMessages);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-access-code": accessCode
        },
        body: JSON.stringify({
          messages: newMessages,
          context: chatContext
        })
      });

      if (res.status === 401) {
        setChatMessages(prev => [...prev, { role: "assistant", content: "Invalid Access Code. Please enter a valid code to chat." }]);
        setIsChatLoading(false);
        return;
      }

      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      
      setIsChatLoading(false);
      setChatMessages(prev => [...prev, { role: "assistant", content: "" }]);
      
      let done = false;
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunk = decoder.decode(value);
        setChatMessages(prev => {
          const lastIdx = prev.length - 1;
          const updated = [...prev];
          updated[lastIdx] = {
            ...updated[lastIdx],
            content: updated[lastIdx].content + chunk
          };
          return updated;
        });
      }
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, { role: "assistant", content: "Sorry, an error occurred while processing your request." }]);
    } finally {
      setIsChatLoading(false);
      clearChatContext(); // Clear context after asking
    }
  };

  return (
    <main 
      className="min-h-screen text-neutral-900 dark:text-neutral-100 selection:bg-emerald-500/30 dark:selection:bg-emerald-500/50 relative print:bg-white print:overflow-visible transition-colors duration-300"
      style={{
        background: `
          radial-gradient(circle at 0% 20%, var(--glow-cyan) 0%, transparent 55%),
          radial-gradient(circle at 100% 20%, var(--glow-emerald) 0%, transparent 55%),
          var(--background)
        `
      }}
    >
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          50% { transform: translateX(5px); }
          75% { transform: translateX(-5px); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
      `}</style>

      {showAccessCodeModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`bg-white dark:bg-neutral-900 border ${accessCodeError ? 'border-rose-500' : 'border-neutral-200 dark:border-neutral-800'} rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 ${accessCodeError ? 'animate-shake' : ''}`}>
            <div className="flex items-center justify-between p-5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50">
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">Enter Access Code</h2>
              <button onClick={() => { setShowAccessCodeModal(false); setTempAccessCode(""); setAccessCodeError(false); }} className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <input 
                type="password"
                placeholder="Access Code"
                value={tempAccessCode}
                onChange={(e) => {
                  setTempAccessCode(e.target.value);
                  setAccessCodeError(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') fetchHistory(tempAccessCode);
                }}
                className={`w-full px-4 py-3 rounded-xl border ${accessCodeError ? 'border-rose-500 ring-rose-500/20' : 'border-neutral-300 dark:border-neutral-700'} bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all`}
                autoFocus
              />
              {accessCodeError && <span className="text-rose-500 text-sm font-medium">Invalid Access Code</span>}
              <button 
                onClick={() => fetchHistory(tempAccessCode)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md active:scale-95"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50">
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2"><History className="w-5 h-5 text-emerald-600" /> Past Analyses</h2>
              <button onClick={() => setShowHistory(false)} className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 overflow-y-auto max-h-[60vh]">
              {isLoadingHistory ? (
                <div className="p-8 flex justify-center text-emerald-500"><Loader2 className="w-6 h-6 animate-spin" /></div>
              ) : historyList.length === 0 ? (
                <div className="p-8 text-center text-neutral-500 dark:text-neutral-400">No past analyses found.</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {historyList.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 group">
                      <button 
                        onClick={() => loadPastAnalysis(item.job_id)}
                        className="flex-1 flex items-center justify-between p-4 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800/50 text-left transition-colors border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700"
                      >
                        <div>
                          <div className="font-bold text-neutral-900 dark:text-white text-lg">{item.domain}</div>
                          <div className="text-xs text-neutral-500 font-mono mt-1">ID: {item.job_id} • {new Date(item.timestamp * 1000).toLocaleDateString()} {new Date(item.timestamp * 1000).toLocaleTimeString()}</div>
                        </div>
                        <div>
                          {item.status === 'completed' ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-bold">Completed</span>
                          ) : item.status === 'error' ? (
                            <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 text-xs font-bold">Error</span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-bold">Running</span>
                          )}
                        </div>
                      </button>
                      <button onClick={(e) => deleteHistory(item.job_id, e)} className="p-3 text-neutral-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors opacity-0 group-hover:opacity-100">
                         <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tooltip for Follow-up */}
      <div 
        className={`tooltip-container absolute z-50 transform -translate-x-1/2 transition-all duration-200 ${selectionRect ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}
        style={{ 
          top: selectionRect?.top ?? 0, 
          left: selectionRect?.left ?? 0 
        }}
      >
        <button 
          onMouseDown={(e) => {
            e.preventDefault();
            handleAskFollowUp();
          }}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm px-3 py-1.5 rounded-lg shadow-xl"
        >
          <MessageSquare className="w-4 h-4" /> Ask a follow up
        </button>
      </div>

      <div className="max-w-[95%] 2xl:max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-16 flex flex-col gap-8 md:gap-12 relative z-10 print:py-0 print:px-0 print:max-w-none">
        
        <header className="flex flex-col items-center justify-center w-full animate-in fade-in slide-in-from-top-4 duration-700 print:hidden relative">
          <div className="absolute top-0 right-0">
             <ThemeToggle />
          </div>
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="Steward Icon" className="w-10 h-10 object-contain mix-blend-multiply dark:mix-blend-normal dark:invert dark:opacity-90" />
            <h1 className="text-5xl md:text-6xl font-black tracking-tight text-neutral-900 dark:text-white flex items-start">
              STEWARD<span className="text-2xl md:text-3xl text-neutral-600 dark:text-neutral-400 mt-1 ml-1">®</span>
            </h1>
          </div>
          <p className="text-xs md:text-sm font-mono text-neutral-600 mt-2 font-medium tracking-widest text-center">
            We Craft Digital Experiences
          </p>
        </header>

        {status === "idle" && (
          <div className="flex flex-col items-center mt-4 print:hidden max-w-3xl mx-auto w-full">
            {currentStep === 0 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 text-center flex flex-col items-center">
                <h2 className="text-4xl md:text-5xl font-bold tracking-tighter leading-[1.1] text-neutral-900 dark:text-white">
                  Uncover hidden <br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-cyan-600">revenue leaks.</span>
                </h2>
                <p className="text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-lg font-medium">
                  Steward autonomously scours the web, app reviews, and statistical data to generate deeply cited, academic-grade growth reports for your product.
                </p>
                <div className="flex flex-col gap-3 w-full max-w-md mt-4">
                  <button onClick={() => setCurrentStep(1)} className="w-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-xl text-lg">
                    Start Analysis <ArrowRight className="w-5 h-5" />
                  </button>
                  <button onClick={() => fetchHistory()} className="w-full bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white hover:bg-neutral-50 dark:hover:bg-neutral-700 font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm border border-neutral-200 dark:border-neutral-700">
                    <History className="w-4 h-4" /> View Past Analyses
                  </button>
                </div>
              </div>
            )}

            {currentStep > 0 && (
              <div className="w-full bg-white/60 dark:bg-neutral-900/60 backdrop-blur-2xl border border-white/80 dark:border-neutral-800 rounded-3xl p-8 shadow-xl animate-in fade-in slide-in-from-right-8 duration-500 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-cyan-400 opacity-80" />
                <div className="flex items-center justify-between mb-8 border-b border-neutral-200 dark:border-neutral-800 pb-4">
                  <h3 className="font-bold text-xl flex items-center gap-2">
                    <Bot className="w-5 h-5 text-emerald-500" /> 
                    Step {currentStep} of 7
                  </h3>
                  <button onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))} className="text-sm font-bold text-neutral-500 hover:text-neutral-900 dark:hover:text-white flex items-center gap-1">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                </div>

                {currentStep === 1 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                        <Globe className="w-5 h-5 text-emerald-500" /> Target Website URL *
                      </label>
                      <p className="text-sm text-neutral-500">Steward uses this to understand your core product offering and scan your landing page for value proposition clarity.</p>
                      <input required type="url" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} className="w-full bg-white/80 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 mt-2" />
                    </div>
                    <button onClick={() => url ? setCurrentStep(2) : alert('Please enter a URL')} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl mt-6">Next</button>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                        <PlaySquare className="w-5 h-5 text-emerald-500" /> Play Store URL
                      </label>
                      <p className="text-sm text-neutral-500">Optional. Steward will scrape and analyze Android user reviews to find common friction points.</p>
                      <input type="url" placeholder="https://play.google.com/..." value={playStore} onChange={(e) => setPlayStore(e.target.value)} className="w-full bg-white/80 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 mt-2" />
                    </div>
                    <div className="flex gap-3 mt-6">
                      <button onClick={() => setCurrentStep(3)} className="w-1/3 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold py-3 px-6 rounded-xl hover:bg-neutral-300 dark:hover:bg-neutral-700">Skip</button>
                      <button onClick={() => setCurrentStep(3)} className="w-2/3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl">Next</button>
                    </div>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                        <Smartphone className="w-5 h-5 text-emerald-500" /> App Store URL
                      </label>
                      <p className="text-sm text-neutral-500">Optional. Steward will analyze iOS user reviews for growth leakage.</p>
                      <input type="url" placeholder="https://apps.apple.com/..." value={appStore} onChange={(e) => setAppStore(e.target.value)} className="w-full bg-white/80 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 mt-2" />
                    </div>
                    <div className="flex gap-3 mt-6">
                      <button onClick={() => setCurrentStep(4)} className="w-1/3 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold py-3 px-6 rounded-xl hover:bg-neutral-300 dark:hover:bg-neutral-700">Skip</button>
                      <button onClick={() => setCurrentStep(4)} className="w-2/3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl">Next</button>
                    </div>
                  </div>
                )}

                {currentStep === 4 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                        <FileText className="w-5 h-5 text-emerald-500" /> Additional Context
                      </label>
                      <p className="text-sm text-neutral-500">Optional. Provide specific hypotheses, competitors, or areas you want Steward to focus on.</p>
                      <textarea rows={4} placeholder="We want to focus on retention in the EU market..." value={context} onChange={(e) => setContext(e.target.value)} className="w-full bg-white/80 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 mt-2 resize-none" />
                    </div>
                    <div className="flex gap-3 mt-6">
                      <button onClick={() => setCurrentStep(5)} className="w-1/3 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold py-3 px-6 rounded-xl hover:bg-neutral-300 dark:hover:bg-neutral-700">Skip</button>
                      <button onClick={() => setCurrentStep(5)} className="w-2/3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl">Next</button>
                    </div>
                  </div>
                )}

                {currentStep === 5 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        Access Code *
                      </label>
                      <p className="text-sm text-neutral-500">Required. Enter your agent execution code to authorize resource usage.</p>
                      <input 
                        required 
                        type="password" 
                        placeholder="••••••••" 
                        value={accessCode} 
                        onChange={(e) => {
                          setAccessCode(e.target.value);
                          setMainAccessCodeError(false);
                        }} 
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') verifyCodeAndProceed();
                        }}
                        className={`w-full bg-white/80 dark:bg-neutral-800/80 border ${mainAccessCodeError ? 'border-rose-500 ring-rose-500/20' : 'border-neutral-200 dark:border-neutral-700'} rounded-xl px-4 py-3 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 mt-2 transition-all ${mainAccessCodeError ? 'animate-shake' : ''}`} 
                      />
                      {mainAccessCodeError && <span className="text-rose-500 text-sm font-medium">Invalid Access Code</span>}
                    </div>
                    <button 
                      onClick={verifyCodeAndProceed} 
                      disabled={isVerifyingCode}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl mt-6 disabled:opacity-50 transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
                    >
                      {isVerifyingCode ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Authorize & Next'}
                    </button>
                  </div>
                )}

                {currentStep === 6 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                        <FileText className="w-5 h-5 text-emerald-500" /> Upload PDF Data
                      </label>
                      <p className="text-sm text-neutral-500">Optional. Upload internal company data, pitch decks, or analytics exports. Steward will summarize it instantly to use as context.</p>
                      
                      {isSummarizingPdf ? (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-8 flex flex-col items-center justify-center gap-4 mt-2">
                          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                          <p className="text-emerald-600 dark:text-emerald-400 font-bold animate-pulse">Extracting & Summarizing PDF...</p>
                        </div>
                      ) : pdfSummary ? (
                        <div className="mt-4">
                          <div className="flex items-center justify-between mb-2">
                             <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Generated Summary (Editable)</span>
                             <button onClick={() => { setPdfFile(null); setPdfSummary(""); }} className="text-xs text-neutral-500 hover:text-rose-500">Remove</button>
                          </div>
                          <textarea 
                             value={pdfSummary} 
                             onChange={(e) => setPdfSummary(e.target.value)}
                             className="w-full h-40 bg-neutral-900 text-emerald-400 font-mono text-xs p-4 rounded-xl border border-neutral-800 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      ) : (
                        <input type="file" accept="application/pdf" onChange={handlePdfUpload} className="w-full bg-white/80 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-8 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 mt-2 text-center border-dashed" />
                      )}
                    </div>
                    
                    <div className="flex gap-3 mt-6">
                      <button onClick={() => setCurrentStep(7)} className="w-1/3 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold py-3 px-6 rounded-xl hover:bg-neutral-300 dark:hover:bg-neutral-700">Skip</button>
                      <button onClick={() => setCurrentStep(7)} disabled={isSummarizingPdf} className="w-2/3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl disabled:opacity-50">Next</button>
                    </div>
                  </div>
                )}

                {currentStep === 7 && (
                  <div className="space-y-6 text-center py-4">
                    <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Bot className="w-8 h-8" />
                    </div>
                    <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">Ready to Deploy Steward</h3>
                    
                    <div className="text-left bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 space-y-4 max-w-xl mx-auto shadow-inner text-sm">
                      <div className="grid grid-cols-[1fr_2fr] gap-4">
                        <span className="font-semibold text-neutral-500 text-right">Target Website:</span>
                        <span className="text-neutral-900 dark:text-neutral-200 break-words">{url}</span>
                        
                        {playStore && (
                          <>
                            <span className="font-semibold text-neutral-500 text-right">Play Store:</span>
                            <span className="text-neutral-900 dark:text-neutral-200 break-words">{playStore}</span>
                          </>
                        )}
                        
                        {appStore && (
                          <>
                            <span className="font-semibold text-neutral-500 text-right">App Store:</span>
                            <span className="text-neutral-900 dark:text-neutral-200 break-words">{appStore}</span>
                          </>
                        )}
                      </div>
                      
                      {context && (
                        <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
                          <span className="font-semibold text-neutral-500 block mb-1">Additional Context:</span>
                          <span className="text-neutral-900 dark:text-neutral-200">{context}</span>
                        </div>
                      )}
                      
                      {pdfSummary && (
                        <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
                          <span className="font-semibold text-neutral-500 block mb-1">PDF Summary ({pdfFile?.name}):</span>
                          <span className="text-neutral-900 dark:text-neutral-200 text-xs line-clamp-3 italic opacity-80">{pdfSummary}</span>
                        </div>
                      )}
                    </div>
                    
                    <button onClick={startAnalysis} className="w-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-xl text-lg mt-8">
                      Start Autonomous Analysis <PlaySquare className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center justify-center text-center gap-6 py-20 bg-white/60 dark:bg-neutral-900/60 backdrop-blur-2xl border border-rose-200 dark:border-rose-900/50 rounded-3xl max-w-3xl mx-auto shadow-xl">
            <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-500 rounded-full flex items-center justify-center mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">Connection Error</h3>
              <p className="text-neutral-600 dark:text-neutral-400 max-w-md mx-auto">
                We couldn't connect to the Steward analysis engine. This might be due to a temporary network issue or the server is currently asleep.
              </p>
            </div>
            <button onClick={resetAnalysis} className="mt-4 px-6 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold rounded-xl hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors shadow-md flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Go Back
            </button>
          </div>
        )}

        {(status === "running" || status === "completed") && (
          <div className="flex flex-col gap-6 w-full print:m-0 print:p-0">
            {/* Header controls */}
            <div className="flex items-center justify-between mb-4 print:hidden max-w-5xl mx-auto w-full">
              <div className="flex items-center gap-3">
                {status === "running" ? <Loader2 className="w-6 h-6 text-emerald-600 dark:text-emerald-500 animate-spin" /> : <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-500" />}
                <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  {status === "running" ? "Agent is investigating..." : "Analysis Complete"}
                </h2>
              </div>
              <div className="flex items-center gap-3">
                {status === "running" && (
                  <button onClick={stopAnalysis} className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-900/50 rounded-lg transition-colors">
                    <Square className="w-3.5 h-3.5 fill-current" /> Stop Generation
                  </button>
                )}
                {status === "completed" && (
                  <>
                    <button 
                      onClick={() => {
                        const oldTitle = document.title;
                        document.title = `Steward Agent Report on ${url || 'Company'}`;
                        window.print();
                        document.title = oldTitle;
                      }} 
                      className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-900/50 rounded-lg transition-colors shadow-sm"
                    >
                      <FileText className="w-3.5 h-3.5" /> Download PDF
                    </button>
                    <button onClick={resetAnalysis} className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 rounded-lg transition-colors shadow-sm">
                      <ArrowLeft className="w-3.5 h-3.5" /> New Analysis
                    </button>
                  </>
                )}
                <div className="text-sm font-mono text-neutral-600 dark:text-neutral-400 bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-sm">
                  Job ID: {jobId}
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6 w-full">
              {/* Report Section (Left, spans 2 cols) */}
              <div className="lg:col-span-2 flex flex-col gap-6">
                
                <details className="group bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-lg transition-all duration-300 print:hidden">
                  <summary className="px-5 py-4 cursor-pointer flex items-center justify-between list-none hover:bg-white dark:hover:bg-neutral-900 transition-colors">
                    <div className="flex items-center gap-3">
                      <Terminal className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
                      <span className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                        {status === "running" ? "Agent Activity Log (Analyzing...)" : "View Agent Activity Log"}
                      </span>
                      {status === "running" && (
                        <div className="flex gap-1 ml-2">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse [animation-delay:0.2s]" />
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse [animation-delay:0.4s]" />
                        </div>
                      )}
                    </div>
                    <div className="text-neutral-500 group-open:rotate-180 transition-transform duration-300">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </summary>
                  <div className="border-t border-neutral-200 dark:border-neutral-800 p-4 max-h-[300px] overflow-y-auto font-mono text-xs text-emerald-400 bg-neutral-900 whitespace-pre-wrap leading-relaxed shadow-inner">
                    {liveLogs || "Initializing autonomous loop..."}
                    <div ref={logsEndRef} />
                  </div>
                </details>

                {/* Context Summary Collapsible */}
                {contextSummary && (
                  <details className="group bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-lg transition-all duration-300 print:hidden">
                    <summary className="px-5 py-4 cursor-pointer flex items-center justify-between list-none hover:bg-white dark:hover:bg-neutral-900 transition-colors">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
                        <span className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                          View PDF / Context Summary
                        </span>
                      </div>
                      <div className="text-neutral-500 group-open:rotate-180 transition-transform duration-300">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                      </div>
                    </summary>
                    <div className="border-t border-neutral-200 dark:border-neutral-800 p-4 max-h-[300px] overflow-y-auto font-mono text-xs text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 whitespace-pre-wrap leading-relaxed shadow-inner">
                      {contextSummary}
                    </div>
                  </details>
                )}

                <div 
                  ref={reportRef}
                  onMouseUp={handleMouseUp}
                  className="bg-white dark:bg-neutral-900 text-black dark:text-neutral-100 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col shadow-2xl transition-all print:shadow-none print:border-none print:m-0 print:rounded-none"
                >
                  <div className="hidden print:flex bg-gradient-to-r from-emerald-900 to-emerald-800 p-8 rounded-t-2xl mb-8 items-end justify-between border-b-4 border-emerald-500">
                    <div className="flex items-center gap-5">
                      <img src="/logo.png" alt="Steward Icon" className="w-12 h-12 object-contain" />
                      <div>
                        <h1 className="text-4xl font-black tracking-tight text-white leading-none">STEWARD<span className="text-xl text-emerald-400 ml-1">®</span></h1>
                        <p className="text-sm font-mono text-emerald-200/90 tracking-widest font-bold uppercase mt-1">Growth Intelligence Report</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-emerald-300/80 uppercase tracking-widest mb-1">Target Analysis</p>
                      <p className="text-xl font-black text-white">{url || "Custom Target"}</p>
                      <p className="text-xs font-mono text-emerald-200/80 font-semibold mt-1">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                  </div>

                  <div className="bg-neutral-100 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 px-6 py-4 flex items-center gap-2 rounded-t-2xl print:hidden">
                    <FileText className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                    <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 tracking-wide">Growth Intelligence Report</span>
                  </div>
                  <div className="p-6 md:p-10 prose prose-sm md:prose-base prose-neutral dark:prose-invert max-w-none print:p-0 print:max-w-full">
                    {report ? (
                      <div className="animate-in fade-in duration-500">
                        {renderedReport}
                      </div>
                    ) : (
                      <div className="py-20 flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-500 gap-4">
                        <Loader2 className="w-10 h-10 animate-spin text-neutral-300 dark:text-neutral-600" />
                        <p className="text-center font-medium">The agent is gathering context and will begin writing shortly...</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Chat Section (Right, spans 1 col) */}
              <div className="lg:col-span-1 print:hidden flex flex-col bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl overflow-hidden h-[calc(100vh-8rem)] sticky top-8">
                <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border-b border-neutral-200 dark:border-neutral-800 px-5 py-4 flex items-center gap-2">
                  <Bot className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
                  <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">Ask Steward</span>
                </div>
                
                <div className="flex-1 p-4 overflow-y-auto bg-neutral-50 dark:bg-neutral-950/50 flex flex-col gap-4">
                  {chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center h-full text-neutral-400 dark:text-neutral-500 p-6 space-y-3">
                      <MessageSquare className="w-8 h-8 opacity-50" />
                      <p className="text-sm font-medium">Select any text in the report to ask a targeted question, or type below to ask a general question.</p>
                    </div>
                  ) : (
                    chatMessages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group`}>
                        <div className={`max-w-[90%] rounded-2xl px-5 py-3 text-sm prose prose-sm ${msg.role === 'user' ? 'bg-emerald-600 text-white rounded-br-none prose-invert' : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-bl-none shadow-sm dark:prose-invert relative'}`}>
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]} 
                            rehypePlugins={[rehypeRaw]}
                            components={{
                              table: ({node, ...props}) => (
                                <div className="w-full overflow-x-auto my-4 border border-neutral-200 dark:border-neutral-700 rounded-lg">
                                  <table className="w-full text-left border-collapse" {...props} />
                                </div>
                              ),
                              th: ({node, ...props}) => <th className="bg-neutral-50 dark:bg-neutral-900 px-3 py-2 font-semibold border-b border-neutral-200 dark:border-neutral-700" {...props} />,
                              td: ({node, ...props}) => <td className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-800 align-top" {...props} />
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                          {msg.role === 'assistant' && (
                            <button
                              onClick={() => handleCopy(msg.content, i)}
                              className="absolute -right-8 bottom-0 p-1.5 text-neutral-400 hover:text-emerald-500 opacity-0 group-hover:opacity-100 transition-all bg-white dark:bg-neutral-800 rounded-md shadow-sm border border-neutral-200 dark:border-neutral-700 z-10"
                              title="Copy response"
                            >
                              {copiedIndex === i ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  {isChatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-neutral-400 dark:bg-neutral-500 rounded-full animate-pulse" />
                        <span className="w-1.5 h-1.5 bg-neutral-400 dark:bg-neutral-500 rounded-full animate-pulse delay-75" />
                        <span className="w-1.5 h-1.5 bg-neutral-400 dark:bg-neutral-500 rounded-full animate-pulse delay-150" />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-4 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 flex flex-col gap-2">
                  {chatContext && (
                    <div className="flex items-start gap-2 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900/50 p-2 rounded-lg relative">
                      <div className="flex-1 text-xs text-emerald-800 dark:text-emerald-400 truncate">
                        <span className="font-bold">Quoting:</span> "{selectedTextSnippet}"
                      </div>
                      <button onClick={clearChatContext} className="text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300 p-0.5">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <form onSubmit={sendChatMessage} className="flex items-center gap-2 relative">
                    <input 
                      id="chat-input"
                      type="text" 
                      placeholder={chatContext ? "Ask about this quote..." : "Ask a question..."}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      className="flex-1 bg-neutral-100 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 border-none rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      disabled={isChatLoading}
                    />
                    <button 
                      type="submit"
                      disabled={isChatLoading || (!chatInput.trim() && !chatContext)}
                      className="p-2.5 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>

      <footer className="w-full py-8 text-center text-xs md:text-sm text-neutral-500 dark:text-neutral-500 font-medium print:hidden">
        Designed & Built by <a href="https://github.com/pundhiranshul" target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-500 hover:underline hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">Anshul Pundhir</a>
      </footer>
    </main>
  );
}
