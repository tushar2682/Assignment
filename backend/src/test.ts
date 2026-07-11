import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';
import { mapCsvRows } from './services/gemini';

dotenv.config();

const sampleCsv = `
created_at,name,email,country_code,mobile_without_country_code,company,city,state,country,lead_owner,crm_status,crm_note,data_source,possession_time,description
2026-05-13 14:20:48,John Doe,john.doe@example.com,+91,9876543210,GrowEasy,Mumbai,Maharashtra,India,test@gmail.com,GOOD_LEAD_FOLLOW_UP,Client is asking to reschedule demo,,,
2026-05-13 14:25:30,Sarah Johnson,sarah.johnson@example.com,+91,9876543211,Tech Solutions,Bangalore,Karnataka,India,test@gmail.com,DID_NOT_CONNECT,"Person was busy, will try again next week",,,
2026-05-13 14:30:15,Rajesh Patel,rajesh.patel@example.com,+91,9876543212,Startup Inc,Delhi,Delhi,India,test@gmail.com,BAD_LEAD,Not interested in our services,,,
2026-05-13 14:35:22,Priya Singh,priya.singh@example.com,+91,9876543213,Enterprise Corp,Pune,Maharashtra,India,test@gmail.com,SALE_DONE,"Deal closed, onboarding in progress",,,
2026-05-13 14:40:00,Invalid Lead Without Contact,,,,No Contact Details,Pune,Maharashtra,India,test@gmail.com,BAD_LEAD,Should be skipped because no email/phone,,,
`;

async function testMapping() {
  console.log('--- Testing CSV Parsing & Gemini Mapping ---');
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not defined in environment!');
    process.exit(1);
  }

  const rawRecords = parse(sampleCsv.trim(), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`Parsed ${rawRecords.length} records. Sending to Gemini mapping...`);

  try {
    const mapped = await mapCsvRows(rawRecords, apiKey, 5, (progress) => {
      console.log(`Progress: ${progress.percentage}% (Batch ${progress.currentBatch}/${progress.totalBatches})`);
    });

    console.log('\n--- Gemini Mapped Records ---');
    console.log(JSON.stringify(mapped, null, 2));

    // Post-filtering validation
    const imported = [];
    const skipped = [];
    for (let i = 0; i < mapped.length; i++) {
      const rec = mapped[i];
      const email = rec.email ? rec.email.trim() : '';
      const mobile = rec.mobile_without_country_code ? rec.mobile_without_country_code.trim() : '';
      if (!email && !mobile) {
        skipped.push({ original: rawRecords[i], mapped: rec });
      } else {
        imported.push(rec);
      }
    }

    console.log('\n--- Final Stats ---');
    console.log(`Total parsed: ${mapped.length}`);
    console.log(`Imported: ${imported.length}`);
    console.log(`Skipped: ${skipped.length}`);

    if (skipped.length === 1 && skipped[0].mapped.name.includes('Invalid')) {
      console.log('\n✅ Skip logic test passed: invalid row (no contact info) was correctly flagged for skipping!');
    } else {
      console.log('\n⚠️ Skip logic validation details:', skipped);
    }

  } catch (error) {
    console.error('Test execution failed:', error);
  }
}

testMapping();
