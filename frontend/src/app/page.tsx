"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { ArrowRight, Bot, Loader2, PlaySquare, Smartphone, Globe, Terminal, FileText, CheckCircle2, Square, ArrowLeft, MessageSquare, X, Send } from "lucide-react";
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
    const footnoteRegex = /<span class="footnote" data-source-id="([^"]+)">(.*?)<\/span>/g;
    
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

  const startAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    
    setStatus("running");
    setLiveLogs("");
    setReport("");
    setChatMessages([]);
    setChatContext("");
    
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-access-code": accessCode
        },
        body: JSON.stringify({
          url,
          play_store_url: playStore,
          app_store_url: appStore,
          additional_info: context
        })
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
        
        if (res.status === 401) {
          setStatus("error");
          return;
        }

        const data = await res.json();
        
        if (data.live_logs) setLiveLogs(data.live_logs);
        if (data.final_report) setReport(data.final_report);
        
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
          <div className="grid md:grid-cols-2 gap-12 items-center mt-4 print:hidden max-w-5xl mx-auto">
            {/* Same as before... omitted for brevity if needed, but I'll provide full */}
            <div className="space-y-6 animate-in fade-in slide-in-from-left-8 duration-700 delay-150 fill-mode-both">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter leading-[1.1] text-neutral-900 dark:text-white">
                Uncover hidden <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-cyan-600">revenue leaks.</span>
              </h2>
              <p className="text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-md font-medium">
                Steward autonomously scours the web, app reviews, and statistical data to generate deeply cited, academic-grade growth reports for your product.
              </p>
            </div>

            <form onSubmit={startAnalysis} className="bg-white/60 dark:bg-neutral-900/60 backdrop-blur-2xl border border-white/80 dark:border-neutral-800 rounded-3xl p-8 shadow-xl animate-in fade-in slide-in-from-right-8 duration-700 delay-300 fill-mode-both flex flex-col gap-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-cyan-400 opacity-80" />
              
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-500" /> Target Website, Product, or Brand Name *
                </label>
                <input required type="text" placeholder="e.g., https://example.com or Nike" value={url} onChange={(e) => setUrl(e.target.value)} className="w-full bg-white/80 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                    <PlaySquare className="w-4 h-4 text-emerald-600 dark:text-emerald-500" /> Play Store URL
                  </label>
                  <input type="url" value={playStore} onChange={(e) => setPlayStore(e.target.value)} className="w-full bg-white/80 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-500" /> App Store URL
                  </label>
                  <input type="url" value={appStore} onChange={(e) => setAppStore(e.target.value)} className="w-full bg-white/80 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-500" /> Additional Context (Optional)
                </label>
                <textarea rows={3} placeholder="Specific areas to investigate, target audience, etc." value={context} onChange={(e) => setContext(e.target.value)} className="w-full bg-white/80 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all resize-none shadow-sm" />
              </div>

              <div className="space-y-1.5 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                <label className="text-sm font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 dark:text-emerald-500"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  Access Code *
                </label>
                <input required type="password" placeholder="Required to generate report" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} className="w-full bg-white/80 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm" />
              </div>

              <button type="submit" className="mt-2 w-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md">
                Start Analysis <ArrowRight className="w-5 h-5" />
              </button>
            </form>
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
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[90%] rounded-2xl px-5 py-3 text-sm prose prose-sm ${msg.role === 'user' ? 'bg-emerald-600 text-white rounded-br-none prose-invert' : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-bl-none shadow-sm dark:prose-invert'}`}>
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

      <footer className="w-full py-8 text-center text-xs md:text-sm text-neutral-500 dark:text-neutral-500 font-medium print:hidden animate-in fade-in duration-1000 delay-500 fill-mode-both">
        Designed & Built by <a href="https://github.com/pundhiranshul" target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-500 hover:underline hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">Anshul Pundhir</a>
      </footer>
    </main>
  );
}
