"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { ArrowRight, Bot, Loader2, PlaySquare, Smartphone, Globe, Terminal, FileText, CheckCircle2, Square, ArrowLeft, MessageSquare, X, Send, Copy, Pencil } from "lucide-react";
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

  const [appMode, setAppMode] = useState<"initial" | "new" | "past">("initial");
  const [pastReports, setPastReports] = useState<{job_id: string; domain: string; created_at: number}[]>([]);

  const fetchPastReports = async () => {
    if (!accessCode) {
      alert("Please enter your Access Code to view past reports.");
      return;
    }
    try {
      const res = await fetch("/api/reports", {
        headers: { "x-access-code": accessCode }
      });
      if (res.status === 401) {
        alert("Invalid Access Code.");
        return;
      }
      const data = await res.json();
      setPastReports(data.reports || []);
      setAppMode("past");
    } catch (e) {
      console.error(e);
    }
  };

  const deleteReport = async (deleteJobId: string) => {
    if (!confirm("Are you sure you want to delete this report?")) return;
    try {
      const res = await fetch(`/api/reports/${deleteJobId}`, {
        method: "DELETE",
        headers: { "x-access-code": accessCode }
      });
      if (res.ok) {
        setPastReports(prev => prev.filter(r => r.job_id !== deleteJobId));
        if (jobId === deleteJobId) {
          resetAnalysis();
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const viewPastReport = (reportJobId: string) => {
    setJobId(reportJobId);
    setStatus("running"); // Trigger the status check loop to fetch it
    setAppMode("new"); // Use the main view mode
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
    <main className="min-h-screen bg-noise text-[#171717] selection:bg-[#cdff71] selection:text-[#171717] font-sans">
      {/* Top Gradient Banner */}
      <div className="w-full bg-steward-gradient text-[#171717] font-bold text-center py-4 sm:py-6 lg:py-8 tracking-tighter uppercase text-3xl sm:text-4xl md:text-6xl border-b border-[#171717]">
        {appMode === "past" ? "PAST REPORTS" : "APPLY FOR A FREE GROWTH AUDIT*"}
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-12 md:py-24">
        {/* Navigation / Back Button */}
        {appMode !== "initial" && !jobId && (
          <button 
            onClick={() => setAppMode("initial")}
            className="mb-12 flex items-center gap-2 text-sm font-semibold tracking-tight hover:opacity-70 transition-opacity uppercase"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        )}

        {appMode === "initial" && (
          <div className="flex flex-col md:flex-row gap-6 justify-center items-center h-[50vh]">
            <button 
              onClick={() => setAppMode("new")}
              className="brutalist-button px-10 py-5 text-xl tracking-tight hover:scale-105 transition-transform"
            >
              Generate New Report →
            </button>
            <button 
              onClick={() => setAppMode("past")}
              className="brutalist-button bg-transparent !text-[#171717] border border-[#171717] px-10 py-5 text-xl tracking-tight hover:bg-[#171717] hover:!text-white hover:scale-105 transition-all"
            >
              Past Reports
            </button>
          </div>
        )}

        {appMode === "past" && (
          <div className="w-full max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row items-center gap-4 justify-between bg-white p-6 border border-[#171717] shadow-[4px_4px_0px_0px_rgba(23,23,23,1)]">
              <div className="font-bold text-lg uppercase tracking-tight">Unlock Past Reports</div>
              <div className="flex items-center gap-4 w-full md:w-auto">
                <input 
                  type="password" 
                  placeholder="Enter Access Code"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  className="brutalist-input px-4 py-3 text-base flex-1 md:w-64"
                />
                <button 
                  onClick={fetchPastReports}
                  className="brutalist-button px-6 py-3 text-base whitespace-nowrap"
                >
                  Fetch
                </button>
              </div>
            </div>

            <div className="border-t border-l border-r border-[#171717] bg-white shadow-[4px_4px_0px_0px_rgba(23,23,23,1)]">
              {pastReports.length === 0 ? (
                <div className="p-8 text-center font-medium border-b border-[#171717]">
                  No past reports found.
                </div>
              ) : (
                pastReports.map((r, i) => (
                  <div key={r.job_id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 border-b border-[#171717] gap-4 hover:bg-neutral-50 transition-colors">
                    <div className="text-lg md:text-xl font-medium tracking-tight break-all">
                      <span className="font-bold uppercase mr-2">{r.domain || r.job_id}</span>
                      <span className="text-sm text-neutral-500 hidden sm:inline-block">({r.job_id})</span>
                      <div className="text-sm text-neutral-500 mt-1">{new Date(r.created_at * 1000).toLocaleDateString()}</div>
                    </div>
                    <div className="flex items-center gap-6 shrink-0">
                      <button 
                        onClick={() => viewPastReport(r.job_id)}
                        className="brutalist-button px-6 py-2 text-sm uppercase tracking-wider"
                      >
                        View
                      </button>
                      <button 
                        onClick={() => deleteReport(r.job_id)}
                        className="font-bold text-sm uppercase underline decoration-2 underline-offset-4 hover:text-red-600 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {appMode === "new" && !jobId && (
          <div className="flex flex-col lg:flex-row gap-16 lg:gap-24">
            {/* Left Side: Massive Typography */}
            <div className="flex-1">
              <h1 className="text-[5rem] sm:text-[6rem] lg:text-[7.5rem] leading-[0.85] font-black tracking-[-0.04em] uppercase mb-12">
                GENERATE<br/>
                A FREE<br/>
                GROWTH<br/>
                AUDIT*
              </h1>
              
              <div className="space-y-3 font-medium text-lg md:text-xl tracking-tight opacity-90 max-w-md">
                <p>1. Enter your target URL and context.</p>
                <p>2. Provide your access code.</p>
                <p>3. Our AI agent runs a deep analysis.</p>
                <p>4. Get actionable growth insights instantly.</p>
              </div>
            </div>

            {/* Right Side: Form */}
            <div className="flex-1 lg:max-w-md xl:max-w-lg lg:mt-[2rem]">
              <form onSubmit={startAnalysis} className="space-y-8">
                <div className="space-y-2">
                  <label className="block text-lg font-medium tracking-tight">Website URL</label>
                  <input
                    type="url"
                    required
                    placeholder="https://example.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full brutalist-input px-4 py-4 md:py-5 text-lg"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-lg font-medium tracking-tight">Context / Goal</label>
                  <textarea
                    placeholder="Provide context on your goals..."
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    className="w-full brutalist-input px-4 py-4 text-lg h-40 resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-lg font-medium tracking-tight">Access Code</label>
                  <input
                    type="password"
                    required
                    placeholder="Required"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    className="w-full brutalist-input px-4 py-4 md:py-5 text-lg"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={status === "running"}
                  className="brutalist-button w-full sm:w-auto px-10 py-5 text-lg flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {status === "running" ? (
                    <>Generating <Loader2 className="w-5 h-5 animate-spin" /></>
                  ) : (
                    <>Run Growth Audit <ArrowRight className="w-5 h-5" /></>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Report View */}
        {jobId && (
          <div className="w-full flex flex-col lg:flex-row gap-8 lg:gap-12 animate-in fade-in duration-500">
            {/* Left Side: Report & Logs */}
            <div className="flex-1 flex flex-col gap-6 max-w-full overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#171717] pb-4">
                <div className="flex items-center gap-4">
                  <button onClick={resetAnalysis} className="hover:opacity-60 transition-opacity">
                    <ArrowLeft className="w-6 h-6" />
                  </button>
                  <h2 className="text-2xl font-bold tracking-tight uppercase">Audit Report</h2>
                </div>
                {status === "running" && (
                  <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-[#171717]">
                    <Loader2 className="w-4 h-4 animate-spin" /> Analyzing
                  </div>
                )}
              </div>
              
              {report && (
                <div 
                  ref={reportRef}
                  onMouseUp={handleMouseUp}
                  className="prose prose-neutral max-w-none 
                    prose-headings:font-bold prose-headings:tracking-tight prose-headings:uppercase
                    prose-h1:text-4xl prose-h2:text-2xl prose-h3:text-xl
                    prose-p:text-lg prose-p:leading-relaxed prose-p:tracking-tight
                    prose-a:text-emerald-700 prose-a:underline prose-a:decoration-2
                    bg-white border border-[#171717] p-8 md:p-12 shadow-[4px_4px_0px_0px_rgba(23,23,23,1)]
                    relative selection:bg-[#cdff71] selection:text-[#171717]"
                >
                  {renderedReport}
                </div>
              )}

              <div className="bg-white border border-[#171717] overflow-hidden shadow-[4px_4px_0px_0px_rgba(23,23,23,1)] mt-8">
                <div className="bg-[#171717] text-white px-4 py-2 font-mono text-sm font-bold tracking-wider uppercase flex items-center gap-2">
                  <Terminal className="w-4 h-4" /> Activity Log
                </div>
                <div className="p-4 bg-black text-emerald-400 font-mono text-sm h-64 overflow-y-auto whitespace-pre-wrap">
                  {liveLogs || "Initializing agent..."}
                  <div ref={logsEndRef} />
                </div>
              </div>
            </div>

            {/* Right Side: Chat */}
            <div className="w-full lg:w-[450px] shrink-0 flex flex-col h-[800px] border border-[#171717] bg-white shadow-[4px_4px_0px_0px_rgba(23,23,23,1)]">
              <div className="bg-[#171717] text-white p-4 font-bold uppercase tracking-widest flex items-center gap-2">
                <Bot className="w-5 h-5" /> Ask Follow-Up
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-[#f9f9f9]">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                    <MessageSquare className="w-12 h-12" />
                    <p className="font-medium tracking-tight">Ask questions about the audit.</p>
                  </div>
                ) : (
                  chatMessages.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                      <div className={`
                        max-w-[85%] p-4 text-sm md:text-base tracking-tight
                        ${msg.role === "user" 
                          ? "bg-[#171717] text-white rounded-l-2xl rounded-tr-2xl" 
                          : "bg-white border border-[#171717] text-[#171717] rounded-r-2xl rounded-tl-2xl shadow-[2px_2px_0px_0px_rgba(23,23,23,1)]"
                        }
                      `}>
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({node, ...props}) => <p className="last:mb-0" {...props} />,
                            a: ({node, ...props}) => <a className="underline decoration-2 font-bold" target="_blank" rel="noreferrer" {...props} />
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                      <div className="flex gap-2 mt-2 opacity-50 hover:opacity-100 transition-opacity">
                        <button onClick={() => navigator.clipboard.writeText(msg.content)} className="p-1 hover:bg-black/10 rounded">
                          <Copy className="w-3 h-3" />
                        </button>
                        {msg.role === "user" && i === chatMessages.length - 2 && (
                          <button onClick={() => setChatInput(msg.content)} className="p-1 hover:bg-black/10 rounded">
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
                {isChatLoading && (
                  <div className="flex items-center gap-2 text-sm font-medium tracking-tight animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin" /> Thinking...
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="p-4 border-t border-[#171717] bg-white">
                {chatContext && (
                  <div className="mb-3 p-3 bg-neutral-100 border border-[#171717] text-sm relative">
                    <button onClick={clearChatContext} className="absolute top-2 right-2 hover:opacity-60">
                      <X className="w-4 h-4" />
                    </button>
                    <div className="font-bold text-xs uppercase tracking-widest mb-1 text-emerald-700">Context</div>
                    <p className="italic line-clamp-3 opacity-80 tracking-tight">&quot;{selectedTextSnippet}&quot;</p>
                  </div>
                )}
                <form onSubmit={sendChatMessage} className="relative">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask a question..."
                    disabled={isChatLoading || !jobId}
                    className="w-full brutalist-input pl-4 pr-12 py-4 text-base disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={isChatLoading || !chatInput.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-[#171717] text-white hover:opacity-80 disabled:opacity-50 transition-opacity"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tooltip */}
      <div 
        className={`tooltip-container absolute z-50 transform -translate-x-1/2 transition-all duration-200 ${selectionRect ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}
        style={{ top: selectionRect?.top ?? 0, left: selectionRect?.left ?? 0 }}
      >
        <button 
          onMouseDown={(e) => { e.preventDefault(); handleAskFollowUp(); }}
          className="flex items-center gap-2 brutalist-button px-4 py-2 shadow-[4px_4px_0px_0px_rgba(23,23,23,0.5)] border border-white"
        >
          <MessageSquare className="w-4 h-4" /> Ask a follow up
        </button>
      </div>
    </main>
  );
}
