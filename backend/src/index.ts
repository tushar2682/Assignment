import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';
import { mapCsvRows, CrmRecord } from './services/gemini';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// In-memory store for import jobs
interface ImportJob {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  currentBatch: number;
  totalBatches: number;
  result?: {
    stats: {
      total: number;
      imported: number;
      skipped: number;
    };
    importedRecords: CrmRecord[];
    skippedRecords: { originalRow: Record<string, string>; reason: string }[];
  };
  error?: string;
}

const jobs = new Map<string, ImportJob>();

// Multer setup (using memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

/**
 * Route: Upload CSV & Start Import Job
 */
app.post('/api/import', upload.single('file'), (req, res): void => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const csvContent = req.file.buffer.toString('utf-8');
    
    // Parse CSV
    let rawRecords: Record<string, string>[];
    try {
      rawRecords = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      });
    } catch (parseErr: any) {
      res.status(400).json({ error: `Failed to parse CSV file: ${parseErr.message}` });
      return;
    }

    if (rawRecords.length === 0) {
      res.status(400).json({ error: 'The uploaded CSV file is empty' });
      return;
    }

    // Check GEMINI_API_KEY
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
      return;
    }

    // Initialize Job
    const jobId = uuidv4();
    const batchSize = 25;
    const totalBatches = Math.ceil(rawRecords.length / batchSize);

    const newJob: ImportJob = {
      id: jobId,
      status: 'processing',
      progress: 0,
      currentBatch: 0,
      totalBatches,
    };

    jobs.set(jobId, newJob);

    // Respond immediately with Job ID
    res.json({
      success: true,
      jobId,
      totalRecords: rawRecords.length,
    });

    // Start background processing
    (async () => {
      try {
        const mappedRecords = await mapCsvRows(
          rawRecords,
          apiKey,
          batchSize,
          (progress) => {
            const job = jobs.get(jobId);
            if (job) {
              job.progress = progress.percentage;
              job.currentBatch = progress.currentBatch;
              jobs.set(jobId, job);
            }
          }
        );

        // Process results: check rules (skip record if neither email nor mobile is present)
        const importedRecords: CrmRecord[] = [];
        const skippedRecords: { originalRow: Record<string, string>; reason: string }[] = [];

        for (let i = 0; i < mappedRecords.length; i++) {
          const mapped = mappedRecords[i];
          const rawRow = rawRecords[i] || {};
          const email = mapped.email ? mapped.email.trim() : '';
          const mobile = mapped.mobile_without_country_code ? mapped.mobile_without_country_code.trim() : '';

          if (!email && !mobile) {
            skippedRecords.push({
              originalRow: rawRow,
              reason: 'Missing both email and mobile number',
            });
          } else {
            importedRecords.push(mapped);
          }
        }

        const job = jobs.get(jobId);
        if (job) {
          job.status = 'completed';
          job.progress = 100;
          job.result = {
            stats: {
              total: rawRecords.length,
              imported: importedRecords.length,
              skipped: skippedRecords.length,
            },
            importedRecords,
            skippedRecords,
          };
          jobs.set(jobId, job);
        }
      } catch (err: any) {
        console.error(`Import job ${jobId} failed:`, err);
        const job = jobs.get(jobId);
        if (job) {
          job.status = 'failed';
          job.error = err.message || 'An error occurred during AI mapping';
          jobs.set(jobId, job);
        }
      }
    })();

  } catch (error: any) {
    console.error('Import error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Route: Check Job Status
 */
app.get('/api/import/status/:jobId', (req, res): void => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  res.json(job);
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
