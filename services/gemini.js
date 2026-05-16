// services/gemini.js

export async function generateVideoScript(topicOrScript) {
    const prompt = `
    You are an expert viral TikTok/Shorts director. 
    Create a highly engaging, structured 60-second video script about: "${topicOrScript}"
    
    CONTENT RULES (MUST FOLLOW STRICTLY):
    1. Divide the video into 4 to 5 logical parts (e.g., Hook, Intro, Body, Benefits, Call to Action).
    2. "voiceover": Write highly engaging, natural Burmese language narration.
    3. "text_on_screen": Write 1 or 2 punchy short Burmese phrases to display on screen (e.g., "အခမဲ့ Master တက်မလား? 🎓"). Keep it very short.
    4. "visual_idea": A brief description in English of what the scene should look like.
    5. "search_keyword": English keyword (max 3 words) for fetching background video from stock sites (e.g., "Beijing city aerial", "students studying"). Must be highly relevant and specific.

    Return ONLY a strictly formatted JSON object matching this schema:
    {
      "global_mood": "cinematic|energetic|inspiring|tech|mysterious",
      "scenes": [
        {
          "part": "PART 1: Hook",
          "voiceover": "တရုတ်နိုင်ငံရဲ့ နံပါတ် (၁) ထိပ်တန်းတက္ကသိုလ်ကြီးမှာ တစ်ပြားမှမကုန်ဘဲ မာစတာဘွဲ့ တက်ရောက်ခွင့်ရမယ့် အခွင့်အရေး လာပါပြီ။",
          "text_on_screen": "တရုတ်မှာ အခမဲ့ Master တက်မလား? 🇨🇳🎓",
          "visual_idea": "Beautiful campus or Beijing city view",
          "search_keyword": "Beijing city aerial"
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
                // Native JSON Mode (စကားပိုမပြောဘဲ Code သီးသန့် ထုတ်ပေးမည့်စနစ်)
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
        
        // Terminal မှာ ဇာတ်ညွှန်း ဘယ်လောက်လန်းလဲဆိုတာ ပြပေးမယ့် Log
        console.log("🎬 AI Director Script Generated Successfully:");
        console.log(JSON.stringify(parsed.scenes.map(s => ({
            part: s.part,
            voiceover: s.voiceover,
            text_on_screen: s.text_on_screen,
            keyword: s.search_keyword
        })), null, 2));
        
        return parsed;
        
    } catch (error) {
        console.error("❌ AI Script Generation Error:", error);
        throw error;
    }
}

