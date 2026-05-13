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
                "max_tokens": 8000 // <--- ဒီမှာ ၈၀၀၀ လို့ ပြင်ပေးလိုက်ပါပြီ
            })
        });

        const data = await response.json();
        
        if (data.error) {
            throw new Error(`OpenRouter Error: ${data.error.message}`);
        }

        const content = data.choices[0].message.content;
        return JSON.parse(content);
        
    } catch (error) {
        console.error("AI Generation Error:", error);
        throw error;
    }
}
