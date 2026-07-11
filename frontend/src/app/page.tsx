"use client";

import React, { useState, useEffect } from "react";
import DragDropUpload from "@/components/DragDropUpload";
import CsvTable from "@/components/CsvTable";
import {
  Moon,
  Sun,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  UploadCloud,
  Loader2,
  RefreshCw,
  ArrowRight,
  Database,
  Grid,
  FileX
} from "lucide-react";

type Step = "upload" | "preview" | "importing" | "results";

interface MappedRecord {
  [key: string]: string;
  created_at: string;
  name: string;
  email: string;
  country_code: string;
  mobile_without_country_code: string;
  company: string;
  city: string;
  state: string;
  country: string;
  lead_owner: string;
  crm_status: string;
  crm_note: string;
  data_source: string;
  possession_time: string;
  description: string;
}

interface SkippedRecord {
  originalRow: Record<string, string>;
  reason: string;
}

interface JobResult {
  stats: {
    total: number;
    imported: number;
    skipped: number;
  };
  importedRecords: MappedRecord[];
  skippedRecords: SkippedRecord[];
}

export default function Home() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [step, setStep] = useState<Step>("upload");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  
  // Job states
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [jobError, setJobError] = useState<string | null>(null);
  
  // Results
  const [results, setResults] = useState<JobResult | null>(null);
  const [activeTab, setActiveTab] = useState<"imported" | "skipped">("imported");

  // Mount logic for theme loading
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  const handleDataParsed = ({
    headers,
    rows,
    file,
  }: {
    headers: string[];
    rows: Record<string, string>[];
    file: File;
  }) => {
    setCsvFile(file);
    setRawHeaders(headers);
    setRawRows(rows);
    setStep("preview");
  };

  const handleConfirmImport = async () => {
    if (!csvFile) return;

    setStep("importing");
    setProgress(0);
    setJobError(null);

    const formData = new FormData();
    formData.append("file", csvFile);

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

    try {
      // 1. Post to import endpoint to start the job
      const response = await fetch(`${backendUrl}/api/import`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to initiate import job");
      }

      const jobData = await response.json();
      setJobId(jobData.jobId);

      // 2. Poll job status
      pollJobStatus(jobData.jobId);
    } catch (err: any) {
      setJobError(err.message || "An unexpected error occurred");
      setStep("preview"); // Go back to preview if initiating failed
    }
  };

  const pollJobStatus = (id: string) => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${backendUrl}/api/import/status/${id}`);
        if (!res.ok) {
          throw new Error("Failed to check job status");
        }

        const job = await res.json();
        
        setProgress(job.progress);
        setCurrentBatch(job.currentBatch);
        setTotalBatches(job.totalBatches);

        if (job.status === "completed") {
          clearInterval(interval);
          setResults(job.result);
          setStep("results");
          setActiveTab("imported");
        } else if (job.status === "failed") {
          clearInterval(interval);
          setJobError(job.error || "AI batch extraction failed");
          setStep("preview");
        }
      } catch (err: any) {
        clearInterval(interval);
        setJobError(err.message || "Connection to import status endpoint failed");
        setStep("preview");
      }
    }, 1200); // Poll every 1.2s
  };

  const handleReset = () => {
    setCsvFile(null);
    setRawHeaders([]);
    setRawRows([]);
    setJobId(null);
    setProgress(0);
    setJobError(null);
    setResults(null);
    setStep("upload");
  };

  // Standard GrowEasy CRM headers for results view
  const crmHeaders = [
    "created_at",
    "name",
    "email",
    "country_code",
    "mobile_without_country_code",
    "company",
    "city",
    "state",
    "country",
    "lead_owner",
    "crm_status",
    "crm_note",
    "data_source",
    "possession_time",
    "description"
  ];

  return (
    <div className="flex-1 w-full min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 w-full border-b border-slate-200 dark:border-slate-900 bg-white/70 dark:bg-slate-950/70 backdrop-blur-md z-30 transition-all">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500 text-white shadow-md shadow-indigo-500/20">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold text-lg text-slate-800 dark:text-slate-200">
                GrowEasy
              </span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/20">
                AI CSV Importer
              </span>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all shadow-sm"
            aria-label="Toggle theme"
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 flex flex-col items-center justify-start gap-8">
        
        {/* Step Indicator Bar */}
        <div className="w-full flex items-center justify-between max-w-3xl mx-auto mb-4 bg-white/40 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-900/80 rounded-2xl p-4 shadow-sm backdrop-blur-sm">
          {[
            { label: "Upload", key: "upload" },
            { label: "Preview", key: "preview" },
            { label: "AI Process", key: "importing" },
            { label: "Results", key: "results" }
          ].map((item, index) => {
            const isActive = step === item.key;
            const isCompleted = 
              (step === "preview" && item.key === "upload") ||
              (step === "importing" && (item.key === "upload" || item.key === "preview")) ||
              (step === "results" && item.key !== "results");
            
            return (
              <React.Fragment key={item.key}>
                <div className="flex items-center gap-2">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
                    isActive 
                      ? "bg-indigo-500 text-white ring-4 ring-indigo-500/20" 
                      : isCompleted 
                        ? "bg-emerald-500 text-white" 
                        : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                  }`}>
                    {isCompleted ? "✓" : index + 1}
                  </div>
                  <span className={`text-sm font-medium hidden sm:inline ${
                    isActive 
                      ? "text-slate-800 dark:text-slate-200 font-semibold" 
                      : isCompleted 
                        ? "text-emerald-500" 
                        : "text-slate-400 dark:text-slate-600"
                  }`}>
                    {item.label}
                  </span>
                </div>
                {index < 3 && (
                  <div className={`flex-1 h-0.5 mx-4 hidden sm:block rounded transition-all duration-500 ${
                    isCompleted ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-800"
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Global Error Banner */}
        {jobError && (
          <div className="w-full max-w-2xl p-4 border border-red-200 dark:border-red-950/60 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 rounded-2xl flex items-start gap-3 shadow-sm animate-pulse-slow">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="text-sm">
              <span className="font-semibold">Import Error:</span> {jobError}
            </div>
          </div>
        )}

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="w-full flex flex-col items-center gap-6">
            <div className="text-center max-w-lg">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3 gradient-text">
                Intelligent Lead Import
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-base">
                Upload any CSV spreadsheet. Our AI will automatically scan and map headers, formats, and notes to standard CRM layouts.
              </p>
            </div>
            <DragDropUpload onDataParsed={handleDataParsed} />
          </div>
        )}

        {/* Step 2: Preview */}
        {step === "preview" && csvFile && (
          <div className="w-full flex flex-col gap-6 animate-fade-in">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-900 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 rounded-xl">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                    CSV Raw Preview
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    File: <span className="font-semibold text-slate-700 dark:text-slate-300">{csvFile.name}</span> • {rawRows.length} rows detected
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button
                  onClick={handleReset}
                  className="flex-1 md:flex-none px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Choose Different File
                </button>
                <button
                  onClick={handleConfirmImport}
                  className="flex-1 md:flex-none px-5 py-2.5 rounded-xl gradient-bg text-white font-semibold hover:opacity-95 active:scale-[0.98] transition-all shadow-md shadow-indigo-500/20 glow-btn flex items-center justify-center gap-2"
                >
                  Confirm & Import
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="glass-card flex flex-col gap-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                <Grid className="h-4 w-4 text-indigo-500" />
                Raw Spreadsheet Data (AI processing has not run yet)
              </div>
              <CsvTable headers={rawHeaders} rows={rawRows} />
            </div>
          </div>
        )}

        {/* Step 3: Importing / Processing */}
        {step === "importing" && (
          <div className="w-full max-w-xl mx-auto py-12 flex flex-col items-center gap-8 glass-card">
            <div className="relative flex items-center justify-center h-20 w-20 rounded-full bg-indigo-50 dark:bg-indigo-950/20 text-indigo-500 shadow-inner">
              <Loader2 className="h-10 w-10 animate-spin" />
              <div className="absolute inset-0 border border-indigo-500/10 rounded-full animate-ping" />
            </div>
            
            <div className="text-center">
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">
                Processing through AI
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Batching records and parsing headers, phone numbers, and statuses into standard format...
              </p>
            </div>

            <div className="w-full flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {currentBatch > 0 
                    ? `Processing batch ${currentBatch} of ${totalBatches}...` 
                    : "Initializing job..."}
                </span>
                <span className="font-bold text-indigo-500">{progress}%</span>
              </div>
              <div className="w-full h-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full progress-bar-fill transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <RefreshCw className="h-3 w-3 animate-spin text-slate-400" />
              Do not close this page. Mapping may take a minute.
            </div>
          </div>
        )}

        {/* Step 4: Results */}
        {step === "results" && results && (
          <div className="w-full flex flex-col gap-6 animate-fade-in">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-900 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                    Import Result Summary
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Successfully extracted and validated CRM records
                  </p>
                </div>
              </div>
              
              <button
                onClick={handleReset}
                className="w-full md:w-auto px-5 py-2.5 rounded-xl gradient-bg text-white font-semibold hover:opacity-95 active:scale-[0.98] transition-all shadow-md shadow-indigo-500/20 glow-btn flex items-center justify-center gap-2"
              >
                Import Another CSV
              </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="glass-card flex flex-col gap-1.5 p-5">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Total Rows
                </span>
                <span className="text-3xl font-extrabold text-slate-800 dark:text-slate-200">
                  {results.stats.total}
                </span>
              </div>
              <div className="glass-card flex flex-col gap-1.5 p-5 border-l-4 border-l-emerald-500">
                <span className="text-xs font-semibold text-emerald-500 dark:text-emerald-400 uppercase tracking-wider">
                  Imported
                </span>
                <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  {results.stats.imported}
                </span>
              </div>
              <div className="glass-card flex flex-col gap-1.5 p-5 border-l-4 border-l-amber-500">
                <span className="text-xs font-semibold text-amber-500 dark:text-amber-400 uppercase tracking-wider">
                  Skipped
                </span>
                <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">
                  {results.stats.skipped}
                </span>
              </div>
              <div className="glass-card flex flex-col gap-1.5 p-5">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Success Rate
                </span>
                <span className="text-3xl font-extrabold text-indigo-500">
                  {results.stats.total > 0 
                    ? `${Math.round((results.stats.imported / results.stats.total) * 100)}%` 
                    : "0%"}
                </span>
              </div>
            </div>

            {/* Detailed Tabs Table */}
            <div className="glass-card flex flex-col gap-6">
              <div className="flex border-b border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setActiveTab("imported")}
                  className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-sm transition-all ${
                    activeTab === "imported"
                      ? "border-indigo-500 text-indigo-500 dark:text-indigo-400"
                      : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  }`}
                >
                  <CheckCircle className="h-4 w-4" />
                  Imported Records ({results.stats.imported})
                </button>
                <button
                  onClick={() => setActiveTab("skipped")}
                  className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-sm transition-all ${
                    activeTab === "skipped"
                      ? "border-amber-500 text-amber-500 dark:text-amber-400"
                      : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  }`}
                >
                  <FileX className="h-4 w-4" />
                  Skipped Records ({results.stats.skipped})
                </button>
              </div>

              {activeTab === "imported" ? (
                <div className="flex flex-col gap-4">
                  <div className="text-xs text-slate-400 italic">
                    * The columns shown below represent the standardized GrowEasy CRM schema mapped from your uploaded files.
                  </div>
                  {results.importedRecords.length > 0 ? (
                    <CsvTable headers={crmHeaders} rows={results.importedRecords} />
                  ) : (
                    <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                      No imported records.
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="text-xs text-amber-500 italic font-semibold">
                    * Records skipped programmatically because they contain neither email nor mobile/phone columns.
                  </div>
                  {results.skippedRecords.length > 0 ? (
                    <div className="flex flex-col gap-6">
                      <div className="table-wrapper">
                        <table className="custom-table">
                          <thead>
                            <tr>
                              <th className="w-12 text-center text-xs text-slate-400">#</th>
                              <th>Reason</th>
                              {rawHeaders.map((h) => (
                                <th key={h}>{h} (Original)</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {results.skippedRecords.map((item, idx) => (
                              <tr key={idx}>
                                <td className="text-center text-xs font-mono text-slate-400">
                                  {idx + 1}
                                </td>
                                <td>
                                  <span className="badge badge-danger">
                                    {item.reason}
                                  </span>
                                </td>
                                {rawHeaders.map((h) => (
                                  <td key={h}>
                                    {item.originalRow[h] || (
                                      <span className="text-slate-300 dark:text-slate-700 italic">empty</span>
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                      No records were skipped. Perfect mapping!
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto w-full border-t border-slate-200 dark:border-slate-900 bg-white/40 dark:bg-slate-950/40 py-6 transition-all">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-500">
          <div>© 2026 GrowEasy CRM. All rights reserved.</div>
          <div className="flex items-center gap-4">
            <span>Powered by Gemini 2.5 Flash</span>
            <span>•</span>
            <span>Batch Mode Enabled</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
