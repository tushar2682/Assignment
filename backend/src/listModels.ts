import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not defined');
    return;
  }
  
  try {
    const res = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    console.log('Available Models (v1beta):');
    res.data.models.forEach((m: any) => {
      console.log(`- ${m.name} (Supports: ${m.supportedGenerationMethods.join(', ')})`);
    });
  } catch (err: any) {
    console.error('Error fetching v1beta models:', err.message);
  }

  try {
    const res = await axios.get(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
    console.log('\nAvailable Models (v1):');
    res.data.models.forEach((m: any) => {
      console.log(`- ${m.name} (Supports: ${m.supportedGenerationMethods.join(', ')})`);
    });
  } catch (err: any) {
    console.error('Error fetching v1 models:', err.message);
  }
}

run();
