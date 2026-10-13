"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Sparkles, Zap, Cpu, Check, ShieldCheck } from "lucide-react";

export const AVAILABLE_AI_MODELS = [
  // Low Cost / Fast
  "openai/gpt-5.4-nano-2026-03-17",
  "google/gemini-3.1-flash-lite-preview",
  "google/gemini-3.5-flash-lite",
  "openai/gpt-5.4-mini-2026-03-17",

  // Medium Cost / Balanced
  "google/gemini-3-flash-preview",
  "google/gemini-3.5-flash",
  "google/gemini-3.6-flash",
  "google/gemini-3.7-flash",
  "google/gemini-3.8-flash",
  "qwen/qwen3-next-80b-a3b-instruct",
  "openai/gpt-oss-120b",

  // Higher Cost / Powerful
  "openai/gpt-5.4-2026-03-05",
  "openai/gpt-5.5-2026-04-23",
  "qwen/qwen3-235b-a22b-instruct-2507",
  "openai/gpt-5.6-luna",
  "qwen/qwen3-coder-480b-a35b-instruct",

  // Highest Cost / Reasoning & Pro
  "openai/gpt-5.6-terra",
  "google/gemini-3.1-pro-preview",
  "anthropic/claude-sonnet-5@default",
  "openai/gpt-6-astra",
  "deepseek-ai/deepseek-r1-0528"
];

export const MODEL_TIER_CONFIG = [
  {
    tier: "Medium Cost / Balanced",
    badge: "Recommended",
    badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    icon: Sparkles,
    models: [
      { id: "google/gemini-3.7-flash", label: "Gemini 3.7 Flash", desc: "Default balanced model for deep analysis & citations" },
      { id: "google/gemini-3.8-flash", label: "Gemini 3.8 Flash", desc: "Latest high-speed reasoning flash model" },
      { id: "google/gemini-3.6-flash", label: "Gemini 3.6 Flash", desc: "Stable balanced intelligence" },
      { id: "google/gemini-3.5-flash", label: "Gemini 3.5 Flash", desc: "High throughput general purpose" },
      { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash Preview", desc: "Early release preview model" },
      { id: "qwen/qwen3-next-80b-a3b-instruct", label: "Qwen 3 Next 80B", desc: "Instruction-tuned open weights model" },
      { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B", desc: "Open architecture large model" }
    ]
  },
  {
    tier: "Low Cost / Fast",
    badge: "Ultra Low Credit",
    badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    icon: Zap,
    models: [
      { id: "openai/gpt-5.4-nano-2026-03-17", label: "GPT-5.4 Nano", desc: "Lowest token latency, minimal credit usage" },
      { id: "openai/gpt-5.4-mini-2026-03-17", label: "GPT-5.4 Mini", desc: "Compact reasoning model for rapid summarization" },
      { id: "google/gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite", desc: "Optimized lightweight inference" },
      { id: "google/gemini-3.1-flash-lite-preview", label: "Gemini 3.1 Flash-Lite", desc: "Ultra-fast preview checkpoint" }
    ]
  },
  {
    tier: "Higher Cost / Powerful",
    badge: "High Capability",
    badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    icon: Cpu,
    models: [
      { id: "openai/gpt-5.4-2026-03-05", label: "GPT-5.4 (Mar 2026)", desc: "High-capability generation and extraction" },
      { id: "openai/gpt-5.5-2026-04-23", label: "GPT-5.5 (Apr 2026)", desc: "Advanced frontier intelligence" },
      { id: "openai/gpt-5.6-luna", label: "GPT-5.6 Luna", desc: "Nuanced context understanding" },
      { id: "qwen/qwen3-235b-a22b-instruct-2507", label: "Qwen 3 235B", desc: "Massive scale open instruct architecture" },
      { id: "qwen/qwen3-coder-480b-a35b-instruct", label: "Qwen 3 Coder 480B", desc: "Deep code analysis & structured data parser" }
    ]
  },
  {
    tier: "Highest Cost / Reasoning & Pro",
    badge: "Maximum Depth",
    badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    icon: ShieldCheck,
    models: [
      { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview", desc: "Complex synthesis & comprehensive reasoning" },
      { id: "anthropic/claude-sonnet-5@default", label: "Claude Sonnet 5", desc: "Nuanced writing and structured logic" },
      { id: "openai/gpt-5.6-terra", label: "GPT-5.6 Terra", desc: "Extreme context window & frontier reasoning" },
      { id: "openai/gpt-6-astra", label: "GPT-6 Astra", desc: "Autonomous agent flagship tier" },
      { id: "deepseek-ai/deepseek-r1-0528", label: "DeepSeek R1", desc: "Open reasoning and chain-of-thought engine" }
    ]
  }
];

interface CustomModelSelectProps {
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
}

export function CustomModelSelect({ value, onChange, disabled }: CustomModelSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Format current model label
  const getSelectedLabel = () => {
    for (const group of MODEL_TIER_CONFIG) {
      const match = group.models.find(m => m.id === value);
      if (match) return match.label;
    }
    return value.split("/").pop() || value;
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 backdrop-blur-sm transition-all text-xs text-neutral-800 dark:text-neutral-200 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        title="Select model powered by Kaggle AI credits"
      >
        <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
          <Sparkles className="w-3.5 h-3.5" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">AI Credit</span>
        </span>
        <span className="text-neutral-300 dark:text-neutral-700">|</span>
        <span className="font-mono text-xs max-w-[170px] truncate">{getSelectedLabel()}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-84 sm:w-96 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl z-50 overflow-hidden backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-150">
          <div className="px-3.5 py-2.5 border-b border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/70 dark:bg-neutral-950/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">Kaggle Model Proxy Catalog</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">
                Zero Direct Cost
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              Draws against Kaggle quota AI credits. Default: Gemini 3.7 Flash.
            </p>
          </div>

          <div className="max-h-96 overflow-y-auto p-1.5 divide-y divide-neutral-100 dark:divide-neutral-800/60 scrollbar-thin">
            {MODEL_TIER_CONFIG.map((group) => {
              const Icon = group.icon;
              return (
                <div key={group.tier} className="py-2 first:pt-1 last:pb-1">
                  <div className="flex items-center justify-between px-2.5 py-1 mb-1">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-600 dark:text-neutral-400">
                      <Icon className="w-3 h-3 text-neutral-400" />
                      {group.tier}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono ${group.badgeColor}`}>
                      {group.badge}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    {group.models.map((m) => {
                      const isSelected = value === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            onChange(m.id);
                            setIsOpen(false);
                          }}
                          className={`w-full flex items-start justify-between text-left px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer text-xs ${
                            isSelected
                              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium shadow-xs"
                              : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/70"
                          }`}
                        >
                          <div className="flex-1 pr-2 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate">{m.label}</span>
                              {m.id === "google/gemini-3.7-flash" && (
                                <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                                  isSelected
                                    ? "bg-white/20 text-white dark:bg-neutral-900/20 dark:text-neutral-900"
                                    : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                }`}>
                                  Default
                                </span>
                              )}
                            </div>
                            <p className={`text-[10px] truncate mt-0.5 ${
                              isSelected
                                ? "text-neutral-300 dark:text-neutral-600"
                                : "text-neutral-400 dark:text-neutral-500"
                            }`}>
                              {m.desc}
                            </p>
                          </div>
                          {isSelected && <Check className="w-4 h-4 shrink-0 mt-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
