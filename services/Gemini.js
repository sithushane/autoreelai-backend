import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzeTranscript(transcriptData) {
    const prompt = `
    You are an expert viral TikTok reel director. 
    Analyze this transcript: ${JSON.stringify(transcriptData)}
    
    Return a strictly formatted JSON object matching this schema:
    {
      "global_mood": "cinematic|energetic|sad|mysterious|tech",
      "scenes": [
        {
          "start": 0.0,
          "end": 5.0,
          "text": "Exact text spoken",
          "search_keyword": "Short 2-word keyword for Pexels (e.g., 'robot laptop')"
        }
      ]
    }
    Make sure scenes align with natural sentence breaks. Optimize keywords for visually striking B-roll.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
        }
    });

    return JSON.parse(response.text);
}

