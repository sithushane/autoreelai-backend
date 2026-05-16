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
3. Voiceover MUST be in PURE Burmese text. 
4. CRITICAL: NEVER mix English words, acronyms, digits, or symbols (e.g., NO "100%", NO "fully funded", NO "IELTS", NO "%").
5. Everything MUST be spelled out completely in Burmese words (e.g., write "တစ်ရာရာခိုင်နှုန်း" instead of "100%", "အပြည့်အဝပံ့ပိုးမှု" instead of "fully funded", "အိုင်အီးအယ်လ်တီအက်စ်" instead of "IELTS"). This is MANDATORY to prevent font rendering bugs (square boxes).
6. Each scene voiceover should be 1-2 sentences maximum.
7. Total voiceover length should fit within 60 seconds.
8. text_on_screen MUST be short, punchy, and written in PURE Burmese text only. No English characters, numbers, or symbols.
9. visual_idea MUST be in English.
10. search_keyword MUST directly match what is visually happening in that scene.
    - If voiceover talks about studying → "student reading book"
    - If talking about headache → "person holding head pain"
    - If talking about drinking water → "person drinking water"
    - If talking about hospital → "doctor patient clinic"
    - If talking about graduation → "graduation ceremony stage"
    - Think: "what would a cameraman film for this exact scene?"
11. search_keyword MUST be specific and visual - NEVER use abstract words alone like "hope", "future", "journey".
    - BAD: "hope future" ❌
    - GOOD: "hopeful student walking" ✅
    - BAD: "journey" ❌
    - GOOD: "person traveling road" ✅
12. search_keyword MUST be maximum 3 words.
13. NEVER use specific universities, brands, organizations, or person names in search_keyword.
14. shot_type MUST be one of: drone, closeup, wide, portrait, cinematic, tracking
15. editing_style MUST be one of: fast_zoom, cinematic, energetic, glitch, smooth_pan, dramatic

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
      "search_keyword": "specific visual keyword",
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

                    temperature: 0.7,
                    max_tokens: 8000
                })
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errText}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(`OpenRouter Error: ${data.error.message}`);
        }

        const content = data?.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error("AI returned empty response.");
        }

        let parsed;

        try {
            parsed = JSON.parse(content);
        } catch (jsonError) {
            console.error("❌ Invalid JSON From AI:");
            console.log(content);
            throw new Error("AI returned malformed JSON.");
        }

        if (!parsed.scenes || !Array.isArray(parsed.scenes)) {
            throw new Error("Invalid AI schema: scenes missing.");
        }

        // Scene Validation 
        parsed.scenes = parsed.scenes.map((scene, index) => {
            return {
                part: scene.part || `PART ${index + 1}`,
                voiceover: scene.voiceover || "",
                text_on_screen: scene.text_on_screen || "",
                visual_idea: scene.visual_idea || "Cinematic footage",
                search_keyword: scene.search_keyword || "person walking outdoor",
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
