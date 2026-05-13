export async function fetchStockVideo(keyword) {
    console.log(`Searching Pexels video for: ${keyword}`);
    
    try {
        // Pexels API ကနေ Portrait (ဒေါင်လိုက်) ဗီဒီယိုတွေကို ရှာပါမယ်
        const response = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(keyword)}&per_page=10&orientation=portrait`, {
            method: 'GET',
            headers: {
                // Render Environment Variables ထဲကနေ Key ကို ယူပါမယ်
                'Authorization': process.env.PEXELS_API_KEY 
            }
        });

        if (!response.ok) {
            throw new Error(`Pexels API Error: ${response.statusText}`);
        }

        const data = await response.json();

        // ဗီဒီယို ရှာတွေ့ခဲ့ရင်
        if (data.videos && data.videos.length > 0) {
            // ရှာတွေ့တဲ့အထဲကနေ ကျပန်း (Random) တစ်ပုဒ်ကို ရွေးပါမယ် (Reel တွေ မထပ်အောင်လို့ပါ)
            const randomVideo = data.videos[Math.floor(Math.random() * data.videos.length)];
            
            // HD Quality ဖြစ်တဲ့လင့်ခ်ကို ရွေးယူမယ်၊ မရှိရင် ပထမဆုံးလင့်ခ်ကိုပဲ ယူမယ်
            const videoFile = randomVideo.video_files.find(f => f.quality === 'hd') || randomVideo.video_files[0];
            
            console.log(`Found video link: ${videoFile.link}`);
            return videoFile.link;
        } else {
            console.log(`No video found for "${keyword}". Using fallback video.`);
            // ရှာမတွေ့ရင် Error မတက်အောင် Sample Video ကိုပဲ ပြန်သုံးပါမယ်
            return "https://www.w3schools.com/html/mov_bbb.mp4";
        }
        
    } catch (error) {
        console.error("Error fetching from Pexels:", error);
        // API Error တက်ရင်လည်း Sample Video ကိုပဲ သုံးပါမယ်
        return "https://www.w3schools.com/html/mov_bbb.mp4";
    }
}


