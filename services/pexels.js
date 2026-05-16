// services/pexels.js

export async function fetchStockVideo(keyword) {
    console.log(`🎬 Initial Input Keyword: "${keyword}"`);

    // 🌟 Defensive Rule: စာသားထဲမှာ ကော်မာတွေ ပါလာရင် အရှေ့ဆုံးက အဓိက စကားလုံးကိုပဲ အရင်ဖြတ်ယူပြီး သန့်စင်မယ်
    const baseKeyword = keyword.split(',')[0].trim();

    // 🌟 Keyword Variants များကို ကော်မာအပိုများ ကင်းစင်စွာဖြင့် တည်ဆောက်ခြင်း
    const keywordVariants = [
        baseKeyword,                          // 1st Option: "university campus" သို့မဟုတ် "graduation"
        baseKeyword.split(' ')[0].trim(),     // 2nd Option: Single word သန့်သန့်လေး "university" သို့မဟုတ် "graduation"
        'college lifestyle'                   // 3rd Option: အစ်ကို့အကြောင်းအရာနှင့် ပိုမိုနီးစပ်မည့် Safe Keyword
    ];

    for (const kw of keywordVariants) {
        console.log(`🔍 Trying keyword variant: "${kw}"`);

        // 🟢 အဆင့် (၁) - Pexels API တွင် အရင်ရှာဖွေခြင်း
        try {
            const pexelsRes = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(kw)}&per_page=10&orientation=portrait`, {
                headers: { 'Authorization': process.env.PEXELS_API_KEY }
            });

            if (pexelsRes.ok) {
                const data = await pexelsRes.json();
                // Safe Validation: videos array ရှိမရှိ သေချာစစ်ဆေးခြင်း
                if (data?.videos && data.videos.length > 0 && data.videos[0].video_files) {
                    const videoFile = getBestFile(data.videos[0].video_files);
                    if (videoFile?.link) {
                        console.log(`✅ Pexels found useful video for "${kw}": ${videoFile.link}`);
                        return videoFile.link;
                    }
                }
            }
        } catch (err) {
            console.error("❌ Pexels fetch error:", err.message);
        }

        // 🔵 အဆင့် (၂) - Pexels တွင် မတွေ့ပါက Pixabay API တွင် ထပ်မံရှာဖွေခြင်း
        try {
            const pixabayRes = await fetch(`https://pixabay.com/api/videos/?key=${process.env.PIXABAY_API_KEY}&q=${encodeURIComponent(kw)}&video_type=film&orientation=vertical&per_page=10`);

            if (pixabayRes.ok) {
                const data = await pixabayRes.json();
                // Safe Validation: hits array ရှိမရှိ သေချာစစ်ဆေးခြင်း
                if (data?.hits && data.hits.length > 0) {
                    const best = data.hits[0];
                    const videoUrl = best.videos?.medium?.url || best.videos?.small?.url || best.videos?.tiny?.url;
                    
                    if (videoUrl) {
                        console.log(`✅ Pixabay found useful video for "${kw}": ${videoUrl}`);
                        return videoUrl;
                    }
                }
            }
        } catch (err) {
            console.error("❌ Pixabay fetch error:", err.message);
        }
    }

    // 🌟 ၃ ဆင့်လုံး ရှာမတွေ့တော့ပါက မဆီမဆိုင်သော ကာတွန်းဗီဒီယိုကြီး မပြတော့ဘဲ null ပြန်ပါမည်။
    // ဒါမှ ffmpeg.js ထဲက စနစ်က "အရှေ့ Scene က ဗီဒီယိုကို ဆက်သုံးပေးရမယ်" ဆိုတာကို သိရှိသွားမှာ ဖြစ်ပါတယ်။
    console.log(`⚠️ Absolutely nothing found for "${keyword}". Triggering Scene Context Protection.`);
    return null;
}

// 📐 အကောင်းဆုံး ဗီဒီယို File Size ရွေးချယ်သည့် အစ်ကို့၏ မူရင်း Logic (Safe Guard ထပ်ပေါင်းထားသည်)
function getBestFile(videoFiles) {
    if (!videoFiles || !Array.isArray(videoFiles) || videoFiles.length === 0) return null;

    const sorted = [...videoFiles].sort((a, b) => (a.width * a.height) - (b.width * b.height));
    
    // ရွှေအလယ်အလတ် Height 700-1300 ကြား ရှာဖွေခြင်း
    let file = sorted.find(f => f && f.height >= 700 && f.height <= 1300);
    
    if (!file) {
        const smallerThanHD = sorted.filter(f => f && f.height < 1900);
        file = smallerThanHD.length > 0 
            ? smallerThanHD[smallerThanHD.length - 1] 
            : sorted[0];
    }
    return file;
}

