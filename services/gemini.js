// services/gemini.js

export async function generateVideoScript(topicOrScript) {

    const systemPrompt = `
You are a world-class viral TikTok/Reels video director and short-form content strategist.

STRICT RULES:
- You ONLY return valid JSON.
- No markdown.
- No explanations.
- No extra text outside JSON.
- Output must always follow the exact schema.

VIDEO STYLE:
- Create emotionally engaging TikTok/Reels style storytelling.
- Keep pacing fast and cinematic.
- Use short, natural Burmese narration.
- Make every scene visually dynamic.

CONTENT RULES:
1. Divide the video into 4 to 6 scenes.
2. Each scene MUST feel like a real short-form video edit.
3. Voiceover MUST be Burmese language.
4. Voiceover MUST be short and emotionally engaging.
5. Each scene voiceover should be 1-2 sentences maximum.
6. Total voiceover length should fit within 60 seconds.
7. text_on_screen MUST be short and punchy.
8. visual_idea MUST be in English.
9. search_keyword MUST be generic stock-video-friendly keywords.
10. NEVER use specific universities, brands, organizations, or person names in search_keyword.
11. search_keyword MUST be maximum 3 words.
12. shot_type MUST be one of:
   - drone
   - closeup
   - wide
   - portrait
   - cinematic
   - tracking
13. editing_style MUST be one of:
   - fast_zoom
   - cinematic
   - energetic
   - glitch
   - smooth_pan
   - dramatic

RETURN JSON SCHEMA:
{
  "title": "Video title",
  "global_mood": "cinematic|energetic|inspiring|tech|mysterious",
  "music_style": "short music description",
  "video_style": "tiktok|news|documentary|cinematic",
  "scenes": [
    {
      "part": "HOOK",
      "voiceover": "Burmese narration",
      "text_on_screen": "Short Burmese text",
      "visual_idea": "English visual idea",
      "search_keyword": "generic keyword",
      "shot_type": "drone",
      "editing_style": "fast_zoom"
    }
  ]
}
`;

    const userPrompt = `
Create a viral 60-second TikTok/Reels video script about:

"${topicOrScript}"

The content must feel highly engaging, emotional, cinematic, and optimized for social media retention.
`;

    try {

        console.log("🎬 Generating AI Video Script...");

        const response = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://autoreel-ai.com",
                    "X-Title": "AutoReel AI"
                },

                body: JSON.stringify({
                    model: "google/gemini-2.5-flash",

                    messages: [
                        {
                            role: "system",
                            content: systemPrompt
                        },
                        {
                            role: "user",
                            content: userPrompt
                        }
                    ],

                    response_format: {
                        type: "json_object"
                    },

                    // 🌟 AI ရဲ့ Format ကို ပိုမိုတည်ငြိမ်စေရန် Temperature ကို 0.7 သို့ ပြောင်းထားပါသည်
                    temperature: 0.7,
                    max_tokens: 8000
                })
            }
        );

        // HTTP Error Check
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errText}`);
        }

        const data = await response.json();

        // OpenRouter Error Check
        if (data.error) {
            throw new Error(`OpenRouter Error: ${data.error.message}`);
        }

        // AI Response Content
        const content = data?.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error("AI returned empty response.");
        }

        let parsed;

        // Safe JSON Parsing
        try {
            parsed = JSON.parse(content);
        } catch (jsonError) {
            console.error("❌ Invalid JSON From AI:");
            console.log(content);
            throw new Error("AI returned malformed JSON.");
        }

        // Basic Validation
        if (!parsed.scenes || !Array.isArray(parsed.scenes)) {
            throw new Error("Invalid AI schema: scenes missing.");
        }

        // 🌟 Scene Validation (Duration ကို ဖြုတ်ချထားပါသည်)
        parsed.scenes = parsed.scenes.map((scene, index) => {
            return {
                part: scene.part || `PART ${index + 1}`,
                voiceover: scene.voiceover || "",
                text_on_screen: scene.text_on_screen || "",
                visual_idea: scene.visual_idea || "Cinematic footage",
                search_keyword: scene.search_keyword || "cinematic video",
                shot_type: scene.shot_type || "cinematic",
                editing_style: scene.editing_style || "cinematic"
            };
        });

        // Terminal Debug Output
        console.log("\n🎬 SCRIPT GENERATED SUCCESSFULLY\n");
        console.log("TITLE:", parsed.title);
        console.log("GLOBAL MOOD:", parsed.global_mood);
        console.log("VIDEO STYLE:", parsed.video_style);
        console.log("\n📌 SCENES:\n");

        parsed.scenes.forEach((scene, index) => {
            console.log(`
==================================
SCENE ${index + 1}
==================================
PART: ${scene.part}

VOICEOVER:
${scene.voiceover}

TEXT:
${scene.text_on_screen}

VISUAL:
${scene.visual_idea}

KEYWORD:
${scene.search_keyword}

SHOT:
${scene.shot_type}

EDIT:
${scene.editing_style}
`);
        });

        return parsed;

    } catch (error) {
        console.error("\n❌ AI SCRIPT GENERATION FAILED\n");
        console.error(error);
        throw error;
    }
}

