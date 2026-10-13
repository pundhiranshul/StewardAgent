"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { ArrowRight, Bot, Loader2, PlaySquare, Smartphone, Globe, Terminal, FileText, CheckCircle2, Square, ArrowLeft, MessageSquare, X, Send, Copy, Pencil } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { CustomModelSelect } from "@/components/CustomModelSelect";
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
  const [aiModel, setAiModel] = useState("gemini-3.7-flash");
  
  useEffect(() => {
    const saved = localStorage.getItem("steward_ai_model");
    if (saved) {
      const cleanModel = saved.includes("/") ? saved.split("/").pop()! : saved;
      setAiModel(cleanModel);
      localStorage.setItem("steward_ai_model", cleanModel);
    }
  }, []);

  const handleModelChange = (model: string) => {
    setAiModel(model);
    localStorage.setItem("steward_ai_model", model);
  };
  
  const [appMode, setAppMode] = useState<"initial" | "new" | "past">("initial");
  const [pastReports, setPastReports] = useState<{job_id: string; domain: string; created_at: number}[]>([]);
  const [accessCodeError, setAccessCodeError] = useState(false);
  const [isStartingAnalysis, setIsStartingAnalysis] = useState(false);

  const triggerAccessCodeError = () => {
    setAccessCodeError(false);
    setTimeout(() => setAccessCodeError(true), 10);
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
          table: ({ node, ...props }) => (
            <div className="w-full overflow-x-auto my-6 border border-neutral-200 rounded-lg print:overflow-visible print:border-none">
              <table className="w-full text-left border-collapse min-w-max print:min-w-0" {...props} />
            </div>
          ),
          th: ({ node, ...props }) => <th className="bg-neutral-50 px-4 py-3 font-semibold text-neutral-900 border-b border-neutral-200 print:bg-transparent" {...props} />,
          td: ({ node, ...props }) => <td className="px-4 py-3 border-b border-neutral-100 align-top" {...props} />
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

    setIsStartingAnalysis(true);
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
          additional_info: context,
          model: aiModel
        })
      });

      setIsStartingAnalysis(false);

      if (res.status === 401) {
        triggerAccessCodeError();
        return;
      }

      const data = await res.json();
      setStatus("running");
      setJobId(data.job_id);
    } catch (error) {
      console.error(error);
      setIsStartingAnalysis(false);
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

  const fetchPastReports = async (silent = false) => {
    if (!accessCode) {
      if (!silent) triggerAccessCodeError();
      return;
    }
    try {
      const res = await fetch("/api/reports", {
        headers: { "x-access-code": accessCode }
      });
      if (res.status === 401) {
        if (!silent) triggerAccessCodeError();
        return;
      }
      const data = await res.json();
      setPastReports(data);
    } catch (e) {
      console.error(e);
      if (!silent) alert("Failed to fetch past reports");
    }
  };

  useEffect(() => {
    if (appMode === "past" && accessCode) {
      fetchPastReports(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appMode, status]);

  const deleteReport = async (jobIdToDelete: string) => {
    if (!confirm("Are you sure you want to delete this report?")) return;
    try {
      const res = await fetch(`/api/reports/${jobIdToDelete}`, {
        method: "DELETE",
        headers: { "x-access-code": accessCode }
      });
      if (res.ok) {
        setPastReports(prev => prev.filter(r => r.job_id !== jobIdToDelete));
        if (jobId === jobIdToDelete) {
          resetAnalysis();
          setAppMode("initial");
        }
      } else {
        alert("Failed to delete report");
      }
    } catch (e) {
      console.error(e);
      alert("Error deleting report");
    }
  };

  const viewPastReport = async (reportJobId: string) => {
    setJobId(reportJobId);
    setStatus("running");
    setLiveLogs("");
    setReport("");
    setChatMessages([]);
    setChatContext("");

    try {
      const res = await fetch(`/api/status/${reportJobId}`, {
        headers: { "x-access-code": accessCode }
      });
      if (res.status === 401) {
        setStatus("error");
        return;
      }
      const data = await res.json();
      if (data.live_logs) setLiveLogs(data.live_logs);
      if (data.final_report) setReport(data.final_report);
      setStatus(data.status);
    } catch (e) {
      console.error(e);
      setStatus("error");
    }
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

  const editMessage = (index: number) => {
    const msgToEdit = chatMessages[index];
    if (msgToEdit.role !== "user") return;
    
    // Remove this message and everything after it
    const newMessages = chatMessages.slice(0, index);
    setChatMessages(newMessages);
    
    let originalText = msgToEdit.content;
    if (originalText.startsWith("> ")) {
      const parts = originalText.split("\n\n");
      if (parts.length > 1) {
        const snippet = parts[0].substring(2);
        setChatContext(snippet);
        setSelectedTextSnippet(snippet.length > 100 ? snippet.substring(0, 100) + '...' : snippet);
        originalText = parts.slice(1).join("\n\n");
      }
    }
    
    setChatInput(originalText);
    setTimeout(() => {
      document.getElementById('chat-input')?.focus();
    }, 10);
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
          context: chatContext,
          model: aiModel
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
      className="min-h-screen h-screen max-h-screen overflow-hidden flex flex-col justify-between text-neutral-900 dark:text-neutral-100 selection:bg-emerald-500/30 dark:selection:bg-emerald-500/50 relative print:h-auto print:max-h-none print:overflow-visible print:bg-white transition-colors duration-300"
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
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-3 py-1.5 rounded-lg shadow-xl cursor-pointer"
        >
          <MessageSquare className="w-3.5 h-3.5" /> Ask a follow up
        </button>
      </div>

      {/* Top Navbar: Stable across all states, no layout shift or jitter */}
      <header className="w-full max-w-[95%] 2xl:max-w-7xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between shrink-0 print:hidden relative z-20">
        <div className="flex items-center gap-3">
          {appMode !== "initial" && status === "idle" ? (
            <button
              onClick={() => setAppMode("initial")}
              className="flex items-center gap-2 text-sm font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer group"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
              <span className="font-black tracking-tight text-neutral-900 dark:text-white text-base">STEWARD<span className="text-xs text-neutral-500 ml-0.5">®</span></span>
              <span className="text-neutral-300 dark:text-neutral-700">/</span>
              <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                {appMode === "new" ? "New Report" : "Past Reports"}
              </span>
            </button>
          ) : status !== "idle" ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => { resetAnalysis(); setAppMode("initial"); }}
                className="flex items-center gap-1.5 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer mr-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> STEWARD
              </button>
              <span className="text-neutral-300 dark:text-neutral-700">|</span>
              <div className="flex items-center gap-2 text-xs font-semibold">
                {status === "running" ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500 animate-spin" />
                    <span className="text-neutral-800 dark:text-neutral-200">Investigating...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500" />
                    <span className="text-neutral-800 dark:text-neutral-200">Analysis Complete</span>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="w-8 h-8" />
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {status !== "idle" && (
            <>
              {status === "running" && (
                <button onClick={stopAnalysis} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-900/50 rounded-lg transition-colors cursor-pointer">
                  <Square className="w-3 h-3 fill-current" /> Stop
                </button>
              )}
              {status === "completed" && (
                <button
                  onClick={() => {
                    const oldTitle = document.title;
                    document.title = `Steward Agent Report on ${url || 'Company'}`;
                    window.print();
                    document.title = oldTitle;
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-900/50 rounded-lg transition-colors shadow-xs cursor-pointer"
                >
                  <FileText className="w-3 h-3" /> PDF
                </button>
              )}
              {jobId && (
                <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md px-2 py-1 rounded-md border border-neutral-200 dark:border-neutral-700">
                  {jobId}
                </span>
              )}
            </>
          )}
          <CustomModelSelect value={aiModel} onChange={handleModelChange} />
          <ThemeToggle />
        </div>
      </header>

      {/* Main Viewport Content: Locked inside screen height without window scrolling */}
      {status === "idle" && appMode === "initial" && (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center -mt-8 gap-5 px-4 print:hidden animate-in fade-in duration-500">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="Steward Icon" className="w-12 h-12 object-contain mix-blend-multiply dark:mix-blend-normal dark:invert dark:opacity-90" />
            <h1 className="text-5xl md:text-6xl font-black tracking-tight text-neutral-900 dark:text-white flex items-start">
              STEWARD<span className="text-2xl md:text-3xl text-neutral-600 dark:text-neutral-400 mt-1 ml-1">®</span>
            </h1>
          </div>
          <p className="text-xs md:text-sm font-mono text-neutral-600 dark:text-neutral-400 font-medium tracking-widest text-center">
            We Craft Digital Experiences
          </p>

          <div className="flex flex-col items-center justify-center gap-3.5 mt-4 w-full max-w-sm">
            <button 
              onClick={() => setAppMode("new")}
              className="bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 font-bold py-3.5 px-8 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-xl text-base w-full cursor-pointer"
            >
              <FileText className="w-5 h-5" /> Generate New Report
            </button>
            <button 
              onClick={() => setAppMode("past")}
              className="bg-white/60 dark:bg-neutral-900/60 backdrop-blur-2xl border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white hover:bg-white dark:hover:bg-neutral-800 font-bold py-3.5 px-8 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg text-base w-full cursor-pointer"
            >
              <Globe className="w-5 h-5" /> View Past Reports
            </button>
          </div>
        </div>
      )}

      {status === "idle" && appMode === "new" && (
        <div className="flex-1 min-h-0 flex items-center justify-center px-4 md:px-6 py-2 overflow-y-auto print:hidden">
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-center max-w-5xl w-full">
            <div className="space-y-4 animate-in fade-in duration-500">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Autonomous Growth Forensics
              </div>
              <h2 className="text-3xl lg:text-4xl xl:text-5xl font-black tracking-tight leading-[1.1] text-neutral-900 dark:text-white">
                Uncover hidden <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-cyan-500">revenue leaks.</span>
              </h2>
              <p className="text-sm md:text-base text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-md font-medium">
                Steward autonomously scours the web, app reviews, and statistical data to generate deeply cited, academic-grade growth reports for your product.
              </p>
              <div className="flex flex-wrap gap-2 pt-1 text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                <span className="px-2.5 py-1 rounded-md bg-white/40 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/60 shadow-2xs">✓ 15-Part Rigorous Report</span>
                <span className="px-2.5 py-1 rounded-md bg-white/40 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/60 shadow-2xs">✓ Multi-Source Cites</span>
                <span className="px-2.5 py-1 rounded-md bg-white/40 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/60 shadow-2xs">✓ Zero Direct Cost</span>
              </div>
            </div>

            <form onSubmit={startAnalysis} className="bg-white/70 dark:bg-neutral-900/70 backdrop-blur-2xl border border-white/80 dark:border-neutral-800 rounded-2xl p-5 md:p-6 shadow-2xl animate-in fade-in duration-500 flex flex-col gap-3.5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-cyan-400 opacity-90" />

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-500" /> Target Website, Product, or Brand Name *
                </label>
                <input required type="text" placeholder="e.g., https://example.com or Nike" value={url} onChange={(e) => setUrl(e.target.value)} className="w-full bg-white/80 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-xs" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                    <PlaySquare className="w-4 h-4 text-emerald-600 dark:text-emerald-500" /> Play Store URL
                  </label>
                  <input type="url" placeholder="Optional" value={playStore} onChange={(e) => setPlayStore(e.target.value)} className="w-full bg-white/80 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-xs" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-500" /> App Store URL
                  </label>
                  <input type="url" placeholder="Optional" value={appStore} onChange={(e) => setAppStore(e.target.value)} className="w-full bg-white/80 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-xs" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-500" /> Additional Context (Optional)
                </label>
                <textarea rows={2} placeholder="Specific focus areas, ICP, target competitors..." value={context} onChange={(e) => setContext(e.target.value)} className="w-full bg-white/80 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all resize-none shadow-xs" />
              </div>

              <div className="space-y-1.5 pt-1 border-t border-neutral-200/80 dark:border-neutral-800">
                <label className="text-sm font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 dark:text-emerald-500"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  Access Code *
                </label>
                <input required type="password" placeholder="Required to generate report" value={accessCode} onChange={(e) => { setAccessCode(e.target.value); setAccessCodeError(false); }} className={`w-full bg-white/80 dark:bg-neutral-800/80 border rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all shadow-xs ${accessCodeError ? 'border-rose-500 text-rose-500 animate-shake focus:border-rose-500 focus:ring-rose-500/50' : 'border-neutral-200 dark:border-neutral-700 focus:border-emerald-500'}`} />
                {accessCodeError && (
                  <p className="text-rose-500 text-xs mt-0.5 px-1 animate-in fade-in">Invalid access code. Please try again.</p>
                )}
              </div>

              <button type="submit" disabled={isStartingAnalysis} className="w-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 font-bold py-2.5 px-5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer text-sm mt-1">
                {isStartingAnalysis ? <Loader2 className="w-4 h-4 animate-spin" /> : "Start Analysis"} {!isStartingAnalysis && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          </div>
        </div>
      )}

      {status === "idle" && appMode === "past" && (
        <div className="flex-1 min-h-0 flex flex-col justify-center max-w-4xl w-full mx-auto px-4 py-2 gap-3 print:hidden animate-in fade-in duration-500">
          <div className="flex items-center gap-3 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-2xl border border-white/80 dark:border-neutral-800 rounded-2xl p-4 shadow-xl w-full">
            <input 
              type="password" 
              placeholder="Enter Access Code to view past reports"
              value={accessCode}
              onChange={(e) => { setAccessCode(e.target.value); setAccessCodeError(false); }}
              className={`flex-1 bg-white/80 dark:bg-neutral-800/80 border rounded-xl px-4 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all shadow-xs ${accessCodeError ? 'border-rose-500 text-rose-500 animate-shake focus:border-rose-500 focus:ring-rose-500/50' : 'border-neutral-200 dark:border-neutral-700 focus:border-emerald-500'}`}
            />
            <button 
              onClick={() => fetchPastReports(false)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md whitespace-nowrap text-sm cursor-pointer"
            >
              Fetch Reports
            </button>
          </div>
          {accessCodeError && (
            <p className="text-rose-500 text-xs px-2 animate-in fade-in">Invalid access code. Please try again.</p>
          )}

          <div className="bg-white/70 dark:bg-neutral-900/70 backdrop-blur-2xl border border-white/80 dark:border-neutral-800 rounded-2xl shadow-xl overflow-hidden w-full max-h-[calc(100vh-190px)] flex flex-col">
            {pastReports.length === 0 ? (
              <div className="p-10 text-center text-neutral-500 font-medium text-sm">
                {accessCode ? "No past reports found for this access code." : "Enter your access code above and click Fetch Reports."}
              </div>
            ) : (
              <div className="divide-y divide-neutral-200 dark:divide-neutral-800 overflow-y-auto flex-1">
                {pastReports.map((r) => (
                  <div key={r.job_id} className="flex items-center justify-between p-4 gap-4 hover:bg-white/40 dark:hover:bg-neutral-800/40 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-bold text-neutral-900 dark:text-white capitalize truncate">
                        {r.domain || r.job_id}
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 flex items-center gap-2">
                        <span className="font-mono text-[11px] bg-neutral-200/80 dark:bg-neutral-800/80 px-2 py-0.5 rounded-md">{r.job_id}</span>
                        • {new Date(r.created_at * 1000).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button 
                        onClick={() => viewPastReport(r.job_id)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-4 rounded-lg transition-all shadow-xs text-xs cursor-pointer"
                      >
                        View
                      </button>
                      <button 
                        onClick={() => deleteReport(r.job_id)}
                        className="text-neutral-500 hover:text-rose-600 dark:hover:text-rose-400 font-bold py-1.5 px-3 rounded-lg transition-all text-xs cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="flex-1 flex items-center justify-center px-4 print:hidden">
          <div className="flex flex-col items-center justify-center text-center gap-5 p-8 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-2xl border border-rose-200 dark:border-rose-900/50 rounded-2xl max-w-lg mx-auto shadow-xl">
            <div className="w-14 h-14 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-500 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white">Connection Error</h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 max-w-sm mx-auto">
                We couldn&apos;t connect to the Steward analysis engine. Please verify the backend connection or try again shortly.
              </p>
            </div>
            <button onClick={resetAnalysis} className="px-5 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold text-xs rounded-xl hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors shadow-md flex items-center gap-2 cursor-pointer">
              <ArrowLeft className="w-3.5 h-3.5" /> Return Home
            </button>
          </div>
        </div>
      )}

      {(status === "running" || status === "completed") && (
        <div className="flex-1 min-h-0 grid lg:grid-cols-3 gap-4 w-full max-w-[98%] 2xl:max-w-7xl mx-auto px-4 overflow-hidden pb-2 print:m-0 print:p-0 print:h-auto print:max-h-none print:overflow-visible">
          {/* Left 2 Cols: Report + Logs */}
          <div className="lg:col-span-2 flex flex-col gap-3 h-full overflow-hidden print:overflow-visible">
            <details className="group bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm transition-all shrink-0 print:hidden">
              <summary className="px-4 py-2.5 cursor-pointer flex items-center justify-between list-none hover:bg-white dark:hover:bg-neutral-900 transition-colors">
                <div className="flex items-center gap-2.5">
                  <Terminal className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500" />
                  <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    {status === "running" ? "Agent Activity Log (Live)" : "View Agent Activity Log"}
                  </span>
                  {status === "running" && (
                    <div className="flex gap-1 ml-1.5">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse [animation-delay:0.2s]" />
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse [animation-delay:0.4s]" />
                    </div>
                  )}
                </div>
                <div className="text-neutral-500 group-open:rotate-180 transition-transform duration-200">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </div>
              </summary>
              <div className="border-t border-neutral-200 dark:border-neutral-800 p-3 max-h-[180px] overflow-y-auto font-mono text-[11px] text-emerald-400 bg-neutral-900 whitespace-pre-wrap leading-relaxed shadow-inner">
                {liveLogs || "Initializing autonomous loop..."}
                <div ref={logsEndRef} />
              </div>
            </details>

            <div
              ref={reportRef}
              onMouseUp={handleMouseUp}
              className="flex-1 bg-white dark:bg-neutral-900 text-black dark:text-neutral-100 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col shadow-xl overflow-hidden print:shadow-none print:border-none print:m-0 print:rounded-none print:overflow-visible"
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

              <div className="bg-neutral-100/90 dark:bg-neutral-950/90 border-b border-neutral-200 dark:border-neutral-800 px-5 py-3 flex items-center justify-between shrink-0 print:hidden">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 tracking-wide uppercase">Growth Intelligence Report</span>
                </div>
                {url && (
                  <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400 truncate max-w-xs">{url}</span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-8 prose prose-sm md:prose-base prose-neutral dark:prose-invert max-w-none print:p-0 print:max-w-full print:overflow-visible">
                {report ? (
                  <div className="animate-in fade-in duration-500">
                    {renderedReport}
                  </div>
                ) : (
                  <div className="py-20 flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-500 gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                    <p className="text-center font-medium text-sm">The agent is scouring the web and synthesising growth evidence...</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right 1 Col: Chat */}
          <div className="lg:col-span-1 print:hidden flex flex-col bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl overflow-hidden h-full">
            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 flex items-center gap-2 shrink-0">
              <Bot className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
              <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wide">Ask Steward</span>
            </div>

            <div className="flex-1 p-3.5 overflow-y-auto bg-neutral-50/60 dark:bg-neutral-950/40 flex flex-col gap-3">
              {chatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center h-full text-neutral-400 dark:text-neutral-500 p-6 space-y-2">
                  <MessageSquare className="w-6 h-6 opacity-40" />
                  <p className="text-xs font-medium">Select any text in the report to ask a targeted question, or type below.</p>
                </div>
              ) : (
                chatMessages.map((msg, i) => (
                  <div key={i} className={`group flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-xs md:text-sm prose prose-sm ${msg.role === 'user' ? 'bg-emerald-600 text-white rounded-br-none prose-invert' : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-bl-none shadow-xs dark:prose-invert'}`}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}
                        components={{
                          table: ({ node, ...props }) => (
                            <div className="w-full overflow-x-auto my-3 border border-neutral-200 dark:border-neutral-700 rounded-lg">
                              <table className="w-full text-left border-collapse" {...props} />
                            </div>
                          ),
                          th: ({ node, ...props }) => <th className="bg-neutral-50 dark:bg-neutral-900 px-2.5 py-1.5 font-semibold border-b border-neutral-200 dark:border-neutral-700 text-xs" {...props} />,
                          td: ({ node, ...props }) => <td className="px-2.5 py-1.5 border-b border-neutral-100 dark:border-neutral-800 align-top text-xs" {...props} />
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                    <div className={`flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity px-1 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <button 
                        onClick={() => navigator.clipboard.writeText(msg.content)} 
                        className="p-1 text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-md transition-colors cursor-pointer"
                        title="Copy message"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      {msg.role === "user" && i >= chatMessages.length - 2 && (
                        <button 
                          onClick={() => editMessage(i)} 
                          className="p-1 text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-md transition-colors cursor-pointer"
                          title="Edit and resubmit"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl rounded-bl-none px-3 py-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-neutral-400 dark:bg-neutral-500 rounded-full animate-pulse" />
                    <span className="w-1.5 h-1.5 bg-neutral-400 dark:bg-neutral-500 rounded-full animate-pulse delay-75" />
                    <span className="w-1.5 h-1.5 bg-neutral-400 dark:bg-neutral-500 rounded-full animate-pulse delay-150" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-3 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 flex flex-col gap-2 shrink-0">
              {chatContext && (
                <div className="flex items-start gap-2 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900/50 p-1.5 rounded-lg relative">
                  <div className="flex-1 text-[11px] text-emerald-800 dark:text-emerald-400 truncate">
                    <span className="font-bold">Quoting:</span> &quot;{selectedTextSnippet}&quot;
                  </div>
                  <button onClick={clearChatContext} className="text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300 p-0.5 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <form onSubmit={sendChatMessage} className="flex items-center gap-2 relative">
                <input
                  id="chat-input"
                  type="text"
                  placeholder={chatContext ? "Ask about quote..." : "Ask a question..."}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-1 bg-neutral-100 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 border-none rounded-full px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  disabled={isChatLoading}
                />
                <button
                  type="submit"
                  disabled={isChatLoading || (!chatInput.trim() && !chatContext)}
                  className="p-2 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Persistent pinned footer */}
      <footer className="w-full py-2 text-center text-xs text-neutral-500 dark:text-neutral-500 font-medium shrink-0 print:hidden">
        Designed & Built by <a href="https://github.com/pundhiranshul" target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-500 hover:underline hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">Anshul Pundhir</a>
      </footer>
    </main>
  );
}
