export async function analyzeTranscript(transcriptData) {
    const prompt = `
    You are an expert viral TikTok reel director. 
    Analyze this transcript and create perfectly timed scenes: ${JSON.stringify(transcriptData)}
    
    CRITICAL RULES:
    1. "search_keyword" must DIRECTLY match what is being talked about in that scene
    2. Keywords must be specific and visual (e.g., if talking about money → "cash money", if talking about phone → "smartphone screen")
    3. Never use generic keywords like "people walking" or "nature background"
    4. Each scene keyword must be DIFFERENT from other scenes
    5. Keywords must be in English, max 3 words
    6. "text" field must be English translation of what is being spoken at that moment
    
    Return a strictly formatted JSON object matching this schema:
    {
      "global_mood": "cinematic|energetic|sad|mysterious|tech",
      "scenes": [
        {
          "start": 0.0,
          "end": 5.0,
          "text": "English translation of what is being spoken at this moment",
          "search_keyword": "Specific visual keyword matching the spoken content"
        }
      ]
    }
    
    Example:
    - Text: "I made $10,000 last month" → search_keyword: "counting money cash"
    - Text: "Using this simple app" → search_keyword: "mobile app screen"
    - Text: "Working from home" → search_keyword: "laptop home office"
    
    Make sure scenes align with natural sentence breaks.
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
                "response_format": { "type": "json_object" },
                "max_tokens": 8000
            })
        });

        const data = await response.json();
        
        if (data.error) {
            throw new Error(`OpenRouter Error: ${data.error.message}`);
        }

        const content = data.choices[0].message.content;
        const parsed = JSON.parse(content);
        
        console.log("AI Scenes:", JSON.stringify(parsed.scenes.map(s => ({
            text: s.text,
            keyword: s.search_keyword
        })), null, 2));
        
        return parsed;
        
    } catch (error) {
        console.error("AI Generation Error:", error);
        throw error;
    }
}
