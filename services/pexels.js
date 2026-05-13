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
            
            // ၁။ အသေးဆုံးကနေ အကြီးဆုံးကို စီမယ်
            const sortedFiles = randomVideo.video_files.sort((a, b) => (a.width * a.height) - (b.width * b.height));
            
            // ၂။ ရွှေအလယ်အလတ် (480p ကနေ 720p ကြား) ကို အရင်ရှာမယ်
            let videoFile = sortedFiles.find(f => f.height >= 700 && f.height <= 1300);
            
            // ၃။ အကယ်၍ အဲဒီကြားထဲမှာ မရှိခဲ့ရင်...
            if (!videoFile) {
                // 1080p (Height 1920) ထက် ငယ်တဲ့အထဲက အကြီးဆုံး/အကြည်ဆုံးကို ယူမယ်
                const smallerThanHD = sortedFiles.filter(f => f.height < 1900);
                if (smallerThanHD.length > 0) {
                    videoFile = smallerThanHD[smallerThanHD.length - 1]; 
                } else {
                    // အကုန်လုံးက 1080p တွေ 4K တွေချည်းပဲဆိုရင်တော့ ဆာဗာမကျအောင် အသေးဆုံးကိုပဲ ယူမယ်
                    videoFile = sortedFiles[0];
                }
            }
            
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

