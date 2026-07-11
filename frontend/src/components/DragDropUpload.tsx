"use client";

import React, { useState, useRef, DragEvent, ChangeEvent } from "react";
import Papa from "papaparse";
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react";

interface DragDropUploadProps {
  onDataParsed: (data: {
    headers: string[];
    rows: Record<string, string>[];
    file: File;
  }) => void;
}

export default function DragDropUpload({ onDataParsed }: DragDropUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: DragEvent<HTMLDivElement | HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    setError(null);

    // Validate file type
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      setError("Please upload a valid CSV file (.csv)");
      return;
    }

    // Limit to 5MB on client side just to be safe
    if (file.size > 5 * 1024 * 1024) {
      setError("File is too large. Please upload a file smaller than 5MB.");
      return;
    }

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (results) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          setError(`Failed to parse CSV: ${results.errors[0].message}`);
          return;
        }

        const headers = results.meta.fields || [];
        if (headers.length === 0 || results.data.length === 0) {
          setError("The CSV file seems to be empty or has no header columns.");
          return;
        }

        onDataParsed({
          headers,
          rows: results.data as Record<string, string>[],
          file,
        });
      },
      error: (err) => {
        setError(`CSV parse error: ${err.message}`);
      },
    });
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleLoadSample = () => {
    setError(null);
    const sampleCsv = `created_time,full_name,email,phone_number,company_name,city,state,country,lead_owner_email,status,notes,source,possession,text_description
2026-06-10 09:15:30,Alice Cooper,alice.c@outlook.com,+1 415-555-2671,Cooper Industries,San Francisco,California,United States,admin@groweasy.ai,interested,"Client has an active team of 15 and is seeking to migrate records by next month.",leads_on_demand,,Need CRM migration support
2026-06-10 10:20:45,Bob Marley,bob.marley@reggae.com,+1 312-555-8291,Reggae Beats,Chicago,Illinois,United States,sales@groweasy.ai,not_answering,"Called twice, went to voicemail. Will retry tomorrow morning.",eden_park,,Busy during early hours
2026-06-10 11:30:00,Charlie Chaplin,charlie@silentfilm.org,+44 7911 123456,Silent Comedy,London,Greater London,United Kingdom,admin@groweasy.ai,converted,"Deal closed! Onboarding starts next Monday at 10 AM.",sarjapur_plots,Immediate,Needs setup walk-through
2026-06-10 12:45:12,Diana Ross,diana.ross@divas.com,+61 2 9382 9182,Motown Productions,Sydney,New South Wales,Australia,sales@groweasy.ai,unqualified,"Lead does not have budget or team size requirements. Closing.",varah_swamy,,Low budget tier
2026-06-10 13:00:00,Invalid Contact (Test Skip),,,,No contact details,New York,NY,USA,admin@groweasy.ai,bad_lead,,Should be skipped because no email/phone,`;

    Papa.parse<Record<string, string>>(sampleCsv.trim(), {
      header: true,
      skipEmptyLines: "greedy",
      complete: (results) => {
        const headers = results.meta.fields || [];
        const dummyFile = new File([sampleCsv], "demo_leads_export.csv", { type: "text/csv" });
        onDataParsed({
          headers,
          rows: results.data as Record<string, string>[],
          file: dummyFile,
        });
      },
      error: (err) => {
        setError(`Sample parse error: ${err.message}`);
      },
    });
  };

  return (
    <div className="w-full max-w-2xl mx-auto text-center">
      <div
        className={`upload-zone ${dragActive ? "drag-active" : ""}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={onButtonClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".csv,text/csv"
          onChange={handleChange}
        />
        <div className="rounded-full bg-indigo-50 dark:bg-indigo-950/40 p-4 mb-4 text-indigo-500 transition-colors">
          <Upload className="h-10 w-10 animate-bounce" />
        </div>
        <p className="text-lg font-semibold mb-2 text-slate-800 dark:text-slate-200">
          Drag and drop your lead CSV here
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          or click to browse from your device
        </p>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-xs text-slate-500 dark:text-slate-400">
          <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
          Supports Facebook, Google Ads, Real Estate CRM, and Custom CSVs
        </div>
      </div>

      <div className="mt-4 flex justify-center">
        <button
          type="button"
          id="load-sample-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleLoadSample();
          }}
          className="px-4 py-2.5 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100/80 dark:hover:bg-indigo-950/80 rounded-xl transition-all border border-indigo-100 dark:border-indigo-900/40 shadow-sm cursor-pointer"
        >
          ⚡ Load Demo Lead Data (Instant)
        </button>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-3 p-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/50 text-red-700 dark:text-red-300">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="text-sm">{error}</div>
        </div>
      )}
    </div>
  );
}
