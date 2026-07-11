import axios from 'axios';

export interface CrmRecord {
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
  crm_status: 'GOOD_LEAD_FOLLOW_UP' | 'DID_NOT_CONNECT' | 'BAD_LEAD' | 'SALE_DONE' | '';
  crm_note: string;
  data_source: 'leads_on_demand' | 'meridian_tower' | 'eden_park' | 'varah_swamy' | 'sarjapur_plots' | '';
  possession_time: string;
  description: string;
}

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/**
 * Maps a single batch of raw CSV rows to the GrowEasy CRM format using the Gemini API.
 */
async function processBatch(
  batch: Record<string, string>[],
  apiKey: string,
  retryCount = 3,
  delayMs = 2000
): Promise<CrmRecord[]> {
  const prompt = `
You are an expert CRM data parser. Map the following raw CSV records into the standard GrowEasy CRM format.
Each input object represents a row from a CSV file. The columns and headers could be named anything.

Input records:
${JSON.stringify(batch, null, 2)}

Instructions:
1. "created_at": Extract the creation date. Try to format it as "YYYY-MM-DD HH:mm:ss". If you cannot parse it, output the raw date string.
2. "name": Extract the full name of the lead.
3. "email": Extract the primary email. If there are multiple emails in the record, put the first email in "email", and append the other emails to "crm_note".
4. "country_code" & "mobile_without_country_code":
   - Parse any phone/mobile columns.
   - Extract the country dial code (e.g. +91, +1) and put it in "country_code".
   - Extract the rest of the mobile number without country code and put it in "mobile_without_country_code".
   - If there are multiple phone/mobile numbers in the record, use the first one, and append the others to "crm_note".
5. "crm_status": Map any status field to one of these: "GOOD_LEAD_FOLLOW_UP", "DID_NOT_CONNECT", "BAD_LEAD", "SALE_DONE".
   - "GOOD_LEAD_FOLLOW_UP": For interested, callback, follow-up, open, hot, warm, qualified leads.
   - "DID_NOT_CONNECT": For busy, switched off, no response, left message, ringing.
   - "BAD_LEAD": For not interested, wrong number, invalid, junk, spam, bad timing, cold.
   - "SALE_DONE": For closed won, deal closed, converted, onboarded, sale completed.
   - If no status is present, default to "GOOD_LEAD_FOLLOW_UP" or leave blank if unsure.
6. "data_source": Map to one of: "leads_on_demand", "meridian_tower", "eden_park", "varah_swamy", "sarjapur_plots". If none fit, output an empty string.
7. "crm_note": Put any useful notes, comments, remarks, extra emails, or extra phone numbers here.
8. "company", "city", "state", "country", "lead_owner", "possession_time", "description": Map as appropriate.

Output MUST be a JSON object containing a "records" array of the mapped CRM records.
`;

  const schema = {
    type: 'OBJECT',
    properties: {
      records: {
        type: 'ARRAY',
        description: 'List of mapped CRM records',
        items: {
          type: 'OBJECT',
          properties: {
            created_at: { type: 'STRING', description: 'Lead creation date formatted as YYYY-MM-DD HH:mm:ss' },
            name: { type: 'STRING', description: 'Name of the lead' },
            email: { type: 'STRING', description: 'Primary email' },
            country_code: { type: 'STRING', description: 'Country code (e.g., +91)' },
            mobile_without_country_code: { type: 'STRING', description: 'Mobile number without country code' },
            company: { type: 'STRING', description: 'Company name' },
            city: { type: 'STRING', description: 'City' },
            state: { type: 'STRING', description: 'State' },
            country: { type: 'STRING', description: 'Country' },
            lead_owner: { type: 'STRING', description: 'Lead owner email' },
            crm_status: {
              type: 'STRING',
              enum: ['GOOD_LEAD_FOLLOW_UP', 'DID_NOT_CONNECT', 'BAD_LEAD', 'SALE_DONE'],
              description: 'CRM status mapping. Must be one of the specified enum values.'
            },
            crm_note: { type: 'STRING', description: 'Notes, extra emails/phones, or other unmapped details' },
            data_source: {
              type: 'STRING',
              description: 'Data source tag. Must be one of: leads_on_demand, meridian_tower, eden_park, varah_swamy, sarjapur_plots. If none match, output an empty string.'
            },
            possession_time: { type: 'STRING', description: 'Possession time' },
            description: { type: 'STRING', description: 'Description or comments' }
          },
          required: []
        }
      }
    },
    required: ['records']
  };

  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      const response = await axios.post(
        `${GEMINI_API_URL}?key=${apiKey}`,
        {
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: schema,
            temperature: 0.1
          }
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 45000 // 45 seconds timeout
        }
      );

      const responseText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!responseText) {
        throw new Error('Empty response from Gemini API');
      }

      const parsedData = JSON.parse(responseText);
      if (!parsedData || !Array.isArray(parsedData.records)) {
        throw new Error('Invalid JSON response format from Gemini');
      }

      return parsedData.records;
    } catch (error: any) {
      const status = error.response?.status;
      const message = error.response?.data?.error?.message || error.message;
      console.error(`Gemini API Error (Attempt ${attempt}/${retryCount}) [Status ${status}]: ${message}`);

      if (attempt === retryCount) {
        throw new Error(`Gemini API mapping failed after ${retryCount} attempts: ${message}`);
      }

      // Exponential backoff delay
      const currentDelay = delayMs * Math.pow(2, attempt - 1);
      console.log(`Retrying in ${currentDelay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, currentDelay));
    }
  }

  return [];
}

/**
 * Processes all CSV rows in batches, mapping them using Gemini, with progress updates.
 */
export async function mapCsvRows(
  rows: Record<string, string>[],
  apiKey: string,
  batchSize = 25,
  onProgress?: (progress: { currentBatch: number; totalBatches: number; percentage: number }) => void
): Promise<CrmRecord[]> {
  const allMappedRecords: CrmRecord[] = [];
  const totalBatches = Math.ceil(rows.length / batchSize);

  for (let i = 0; i < rows.length; i += batchSize) {
    const currentBatch = Math.floor(i / batchSize) + 1;
    const batch = rows.slice(i, i + batchSize);
    const percentage = Math.round((currentBatch / totalBatches) * 100);

    if (onProgress) {
      onProgress({ currentBatch, totalBatches, percentage });
    }

    console.log(`Processing batch ${currentBatch}/${totalBatches} (${batch.length} records)...`);
    const mappedBatch = await processBatch(batch, apiKey);
    allMappedRecords.push(...mappedBatch);

    // Rate-limiting delay of 1 second between batches to avoid hitting API rate limits
    if (currentBatch < totalBatches) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return allMappedRecords;
}
