import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { finished } from 'stream/promises';

// 🌟 Parameter အဟောင်း (audioPath) ကို ဖြုတ်လိုက်ပါပြီ။ scenes ထဲမှာ audio တွေ ပါလာမှာမို့လို့ပါ။
export async function renderReel(scenes, musicPath, outputPath) {
    console.log("Step 4.1: Downloading video assets...");
    
    try {
        const localMusicPath = path.join(process.cwd(), 'renders', `bgm_${Date.now()}.mp3`);
        await downloadFileSafe(musicPath, localMusicPath);

        for (let i = 0; i < scenes.length; i++) {
            console.log(`Downloading video ${i + 1} of ${scenes.length}...`);
            const localVidPath = path.join(process.cwd(), 'renders', `vid_${Date.now()}_${i}.mp4`);
            await downloadFileSafe(scenes[i].videoPath, localVidPath);
            scenes[i].localVideoPath = localVidPath;
        }
        
        console.log("Step 4.2: Starting FFmpeg Cinematic Render (1080P + Text)...");

        return new Promise((resolve, reject) => {
            let command = ffmpeg();
            let filterChain = '';
            const vCount = scenes.length;

            // 🌟 1. Input များကို စနစ်တကျ တန်းစီသွင်းခြင်း
            // Video Inputs (0 to N-1)
            scenes.forEach(scene => command.input(scene.localVideoPath));
            
            // Audio Inputs (N to 2N-1) - TTS က ထုတ်ပေးလိုက်တဲ့ အသံဖိုင်လေးတွေ
            scenes.forEach(scene => command.input(scene.audioPath));
            
            // BGM Input (2N)
            command.input(localMusicPath);
            const musicIdx = vCount * 2;

            // 🌟 2. Video Filters (Trimming, Scaling & Text on Screen)
            scenes.forEach((scene, index) => {
                const duration = scene.duration; // TTS မှ ရလာသော အသံအရှည် အတိအကျ
                
                // စာသားထဲက သင်္ကေတတွေကို FFmpeg error မတက်အောင် ရှင်းလင်းခြင်း
                const text = scene.text_on_screen ? scene.text_on_screen.replace(/[:']/g, '') : '';
                
                let textFilter = '';
                if (text) {
                    // 🇲🇲 ဖုန်းထဲက မြန်မာဖောင့် (NotoSansMyanmar) ကို တိုက်ရိုက်လှမ်းသုံးခြင်း
                    // TikTok စတိုင် အမည်းရောင်နောက်ခံနှင့် အဖြူရောင်စာလုံး (Center Align)
                    textFilter = `,drawtext=fontfile=/system/fonts/NotoSansMyanmar-Regular.ttf:text='${text}':fontsize=70:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=20:x=(w-text_w)/2:y=(h-text_h)/2`;
                }

                filterChain += `[${index}:v]trim=duration=${duration},setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,format=yuv420p${textFilter}[v${index}];`;
            });

            // 🌟 3. Concat Videos AND Audios (ရုပ်ရော၊ အသံပါ တစ်ပြိုင်နက်တည်း အပိုင်းလိုက် ဆက်ခြင်း)
            // [v0][1:a] [v1][2:a] ပုံစံမျိုး တွဲဆက်ပေးတာပါ
            const concatInputs = scenes.map((_, i) => `[v${i}][${vCount + i}:a]`).join('');
            filterChain += `${concatInputs}concat=n=${vCount}:v=1:a=1[baseV][baseA];`;

            // 🌟 4. Audio Mixing (နောက်ခံသီချင်းနှင့် စကားပြောသံ ရောနှောခြင်း)
            filterChain += `[${musicIdx}:a]volume=0.15[bgm];[baseA][bgm]amix=inputs=2:duration=first:dropout_transition=2[audioOut]`;

            command
                .complexFilter(filterChain)
                .outputOptions([
                    '-map [baseV]',
                    '-map [audioOut]',
                    '-c:v libx264',
                    '-preset fast',      
                    '-crf 23',           
                    '-c:a aac',
                    '-b:a 192k',         
                    '-movflags +faststart',
                    '-pix_fmt yuv420p',
                ])
                .output(outputPath)
                .on('start', () => console.log("FFmpeg Started... Adding Magic! ✨"))
                .on('stderr', (line) => {
                    if (line.includes('Error') || line.includes('Failed') || line.includes('Invalid')) {
                        console.log("FFmpeg Warning:", line);
                    }
                })
                .on('progress', (progress) => console.log(`Rendering: ${progress.timemark}`))
                .on('end', () => {
                    console.log("✅ FFmpeg Render Complete!");
                    console.log("📁 Output Video:", path.basename(outputPath));
                    
                    // အလုပ်ပြီးရင် ယာယီဖိုင်တွေ အကုန်ဖျက်မယ် (Video, TTS Audio, BGM)
                    const filesToClean = [
                        localMusicPath, 
                        ...scenes.map(s => s.localVideoPath),
                        ...scenes.map(s => s.audioPath)
                    ];
                    safeCleanup(filesToClean);
                    
                    resolve(path.basename(outputPath));
                })
                .on('error', (err) => {
                    console.error("FFmpeg Error:", err.message);
                    const filesToClean = [
                        localMusicPath, 
                        ...scenes.map(s => s.localVideoPath),
                        ...scenes.map(s => s.audioPath)
                    ];
                    safeCleanup(filesToClean);
                    reject(err);
                })
                .run();
        });
    } catch (error) {
        console.error("Error in renderReel:", error);
        throw error;
    }
}

async function downloadFileSafe(url, destPath) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch ${url}`);
        const fileStream = fs.createWriteStream(destPath);
        await finished(Readable.fromWeb(res.body).pipe(fileStream));
    } finally {
        clearTimeout(timeout);
    }
}

function safeCleanup(filePaths) {
    filePaths.forEach(filePath => {
        if (filePath && fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (err) {
                console.error(`Failed to delete: ${filePath}`, err.message);
            }
        }
    });
}

