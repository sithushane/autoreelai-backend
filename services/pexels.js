export async function fetchStockVideo(keyword) {
    console.log(`Searching Pexels video for: ${keyword}`);
    
    try {
        const response = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(keyword)}&per_page=10&orientation=portrait`, {
            method: 'GET',
            headers: {
                'Authorization': process.env.PEXELS_API_KEY 
            }
        });

        if (!response.ok) {
            throw new Error(`Pexels API Error: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.videos && data.videos.length > 0) {
            const randomVideo = data.videos[Math.floor(Math.random() * data.videos.length)];
            
            // ၁။ ရှိသမျှ ဗီဒီယို Size တွေကို အသေးဆုံးကနေ အကြီးဆုံးကို စီလိုက်ပါမယ် (RAM မစားအောင်လို့ပါ)
            const sortedFiles = randomVideo.video_files.sort((a, b) => (a.width * a.height) - (b.width * b.height));
            
            // ၂။ SD (Standard Definition) ကို အရင်ရှာမယ်။ မရှိခဲ့ရင်တောင် စီထားတဲ့အထဲက အသေးဆုံး (sortedFiles[0]) ကိုပဲ ယူပါမယ်
            const videoFile = sortedFiles.find(f => f.quality === 'sd') || sortedFiles[0];
            
            console.log(`Found video link: ${videoFile.link} (Size: ${videoFile.width}x${videoFile.height})`);
            return videoFile.link;
        } else {
            console.log(`No video found for "${keyword}". Using fallback video.`);
            return "https://www.w3schools.com/html/mov_bbb.mp4";
        }
        
    } catch (error) {
        console.error("Error fetching from Pexels:", error);
        return "https://www.w3schools.com/html/mov_bbb.mp4";
    }
}

