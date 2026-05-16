// services/pexels.js

// 🌟 Parameter နေရာမှာ globalMood ကို လက်ခံနိုင်အောင် တိုးမြှင့်လိုက်ပါတယ် (Default အနေနဲ့ cinematic ထည့်ထားပါတယ်)
export async function fetchStockVideo(keyword, globalMood = "cinematic") {
    console.log(`Searching video for: ${keyword} (Global Mood: ${globalMood})`);

    // 🌟 Fix: AI က ကော်မာတွေခံပြီး ပေးလာရင် ရှေ့ဆုံးက အဓိက Keyword ကိုပဲ သန့်သန့်လေး ဖြတ်ယူခြင်း
    // ဥပမာ - "graduation, English test" -> "graduation"
    const baseKeyword = keyword.split(',')[0].trim();

    const keywordVariants = [
        baseKeyword,                          // ၁။ "university campus" သို့မဟုတ် "graduation"
        baseKeyword.split(' ')[0].trim(),     // ၂။ Space နဲ့ ဖြတ်ပြီး စကားလုံးတစ်လုံးတည်းရှာခြင်း (ကော်မာမပါတော့ပါ)
        `${globalMood} background`            // ၃။ 🧠 အဟောင်း 'people lifestyle' အစား AI Mood အလိုက် ပြောင်းမည့် Dynamic Vibe Fallback
    ];

    for (const kw of keywordVariants) {
        console.log(`Trying keyword: "${kw}"`);

        // ✅ Pexels အရင်ရှာမယ်
        try {
            const pexelsRes = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(kw)}&per_page=10&orientation=portrait`, {
                headers: { 'Authorization': process.env.PEXELS_API_KEY }
            });

            if (pexelsRes.ok) {
                const data = await pexelsRes.json();
                if (data.videos && data.videos.length > 0) {
                    const videoFile = getBestFile(data.videos[0].video_files);
                    console.log(`✅ Pexels found "${kw}": ${videoFile.link} (${videoFile.width}x${videoFile.height})`);
                    return videoFile.link;
                }
            }
        } catch (err) {
            console.error("Pexels error:", err.message);
        }

        // ✅ Pexels မတွေ့ရင် Pixabay ရှာမယ်
        try {
            const pixabayRes = await fetch(`https://pixabay.com/api/videos/?key=${process.env.PIXABAY_API_KEY}&q=${encodeURIComponent(kw)}&video_type=film&orientation=vertical&per_page=10`);

            if (pixabayRes.ok) {
                const data = await pixabayRes.json();
                if (data.hits && data.hits.length > 0) {
                    const best = data.hits[0];
                    const videoUrl = best.videos.medium?.url || best.videos.small?.url || best.videos.tiny?.url;
                    console.log(`✅ Pixabay found "${kw}": ${videoUrl}`);
                    return videoUrl;
                }
            }
        } catch (err) {
            console.error("Pixabay error:", err.message);
        }
    }

    // 🌟 အဆင့် ၃ ဆင့်လုံးမှာ ဘယ်လိုမှ ရှာမတွေ့ရင် မဆီမဆိုင်တဲ့ ကာတွန်းယုန်ရုပ်ရှင်ကြီး မထွက်လာစေဘဲ null ပြန်ပါမယ်။
    // ဒါမှ ffmpeg.js ကနေ "အရှေ့ Scene က ဗီဒီယိုကို ဆက်သုံးပေးရမယ်" ဆိုတဲ့ ခံစစ်စနစ်ကို လှမ်းလုပ်ခိုင်းမှာ ဖြစ်ပါတယ်။
    console.log(`⚠️ Nothing found for "${keyword}". Returning null for Context Protection.`);
    return null;
}

// ✅ အကောင်းဆုံး file size ရွေးတဲ့ function (အစ်ကို့ မူရင်း Logic အတိုင်း ရာခိုင်နှုန်းပြည့် ထားရှိပါတယ်)
function getBestFile(videoFiles) {
    const sorted = videoFiles.sort((a, b) => (a.width * a.height) - (b.width * b.height));
    
    // ရွှေအလယ်အလတ် 700-1300 ကြားရှာမယ်
    let file = sorted.find(f => f.height >= 700 && f.height <= 1300);
    
    if (!file) {
        const smallerThanHD = sorted.filter(f => f.height < 1900);
        file = smallerThanHD.length > 0 
            ? smallerThanHD[smallerThanHD.length - 1] 
            : sorted[0];
    }
    return file;
}
