export async function fetchStockVideo(keyword) {
    console.log(`Searching video for: ${keyword}`);

    const keywordVariants = [
        keyword,
        keyword.split(' ')[0],
        'people lifestyle'
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

    console.log(`⚠️ Nothing found for "${keyword}". Using fallback.`);
    return "https://www.w3schools.com/html/mov_bbb.mp4";
}

// ✅ အကောင်းဆုံး file size ရွေးတဲ့ function (သင့် original code အတိုင်း)
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
