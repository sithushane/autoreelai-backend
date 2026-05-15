// services/gemini.js

export async function analyzeTranscript(transcriptData, totalDuration) {
    const prompt = `
    You are an expert viral TikTok reel director. 
    Analyze this transcript and create perfectly timed scenes: ${JSON.stringify(transcriptData)}
    
    CRITICAL TIMING RULES (MUST FOLLOW STRICTLY):
    1. The total audio duration is EXACTLY ${totalDuration} seconds.
    2. You MUST distribute this ${totalDuration} seconds logically across all scenes based on the word count of each scene.
    3. The first scene's "start" must be EXACTLY 0.0.
    4. The FINAL scene's "end" MUST be EXACTLY ${totalDuration}.
    5. There must be NO GAPS between scenes (e.g., if Scene 1 ends at 4.5, Scene 2 MUST start at 4.5).

    VISUAL RULES:
    1. "search_keyword" must DIRECTLY match what is being talked about in that scene.
    2. Keywords must be specific and visual (e.g., if talking about money -> "counting cash", if talking about history -> "ancient ruin").
    3. Never use generic keywords like "people walking" or "nature background".
    4. Each scene keyword must be DIFFERENT from other scenes.
    5. Keywords must be in English, max 3 words.
    6. "text" field must be English translation of what is being spoken at that moment.
    
    Return a strictly formatted JSON object matching this schema:
    {
      "global_mood": "cinematic|energetic|sad|mysterious|tech",
      "scenes": [
        {
          "start": 0.0,
          "end": 4.5,
          "text": "English translation of what is being spoken at this moment",
          "search_keyword": "Specific visual keyword"
        }
      ]
    }
    `;

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "google/gemini-2.5-flash", 
                "messages": [{ "role": "user", "content": prompt }],
                // ✅ ဒါက အစ်ကိုနဲ့ တိုင်ပင်ထားတဲ့ "သံမဏိစည်းမျဉ်း" (Native JSON Mode) ပါ
                // AI ကို စကားပို လုံးဝ ပြောခွင့်မပေးတော့ဘဲ Code သီးသန့်ပဲ ထုတ်ပေးပါလိမ့်မယ်
                "response_format": { "type": "json_object" },
                "max_tokens": 8000
            })
        });

        const data = await response.json();
        
        if (data.error) {
            throw new Error(`OpenRouter Error: ${data.error.message}`);
        }

        // JSON parsing
        const content = data.choices[0].message.content;
        const parsed = JSON.parse(content);
        
        // Terminal မှာ အချိန်တွေ ဘယ်လောက် တိကျသွားလဲဆိုတာကို ရှင်းရှင်းလင်းလင်း ပြပေးမယ့် Log
        console.log("✅ AI Scenes Generated Successfully:");
        console.log(JSON.stringify(parsed.scenes.map(s => ({
            text: s.text,
            duration: `${s.start}s to ${s.end}s`,
            keyword: s.search_keyword
        })), null, 2));
        
        return parsed;
        
    } catch (error) {
        console.error("❌ AI Generation Error:", error);
        throw error;
    }
}

