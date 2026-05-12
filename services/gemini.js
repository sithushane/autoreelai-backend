import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function analyzeTranscript(transcriptData) {
    // 2026 ရဲ့ နောက်ဆုံးထွက် 2.5 flash version ကို တိုက်ရိုက်သုံးထားပါတယ်
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash", 
        generationConfig: { responseMimeType: "application/json" }
    });

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

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return JSON.parse(response.text());
    } catch (error) {
        console.error("Gemini AI Error:", error);
        throw error;
    }
}


