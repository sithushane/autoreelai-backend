import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';

export async function renderReel(audioPath, scenes, musicPath, outputPath) {
    return new Promise((resolve, reject) => {
        let command = ffmpeg();
        let filterChain = '';
        let inputCount = 0;

        // 1. Add Stock Video Inputs & Build Filter
        scenes.forEach((scene, index) => {
            command.input(scene.videoPath);
            const duration = scene.end - scene.start;
            // RAM သက်သာအောင် 1080p အစား 720p (720x1280) နဲ့ fps=24 ကို ပြောင်းထားပါတယ်
            filterChain += `[${inputCount}:v]scale=-1:1280,crop=720:1280,setsar=1,fps=24,format=yuv420p,trim=duration=${duration},setpts=PTS-STARTPTS[v${index}];`;
            inputCount++;
        });

        // Concat all video segments
        const concatInputs = scenes.map((_, i) => `[v${i}]`).join('');
        filterChain += `${concatInputs}concat=n=${scenes.length}:v=1:a=0[baseV];`;

        // 2. Audio mixing (Voice + Ducked BGM)
        command.input(audioPath); // Input [inputCount]
        const voiceIdx = inputCount;
        inputCount++;
        
        command.input(musicPath); // Input [inputCount]
        const musicIdx = inputCount;
        
        // Ducking: Lower BGM volume when voice is speaking
        filterChain += `[${musicIdx}:a]volume=0.2[bgm];[${voiceIdx}:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[audioOut];`;

        // 3. Burn Subtitles (TikTok Style)
        const srtPath = path.join(process.cwd(), 'renders', `temp_${Date.now()}.srt`);
        generateSRT(scenes, srtPath);
        
        // Subtitle size adjusted for 720p (Fontsize ကို 24 ကနေ 18 သို့လျှော့ထားသည်)
        filterChain += `[baseV]subtitles=${srtPath}:force_style='Fontname=Arial,Fontsize=18,PrimaryColour=&H0000FFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Alignment=2,MarginV=20'[finalV]`;

        command
            .complexFilter(filterChain)
            .outputOptions([
                '-map [finalV]',
                '-map [audioOut]',
                '-c:v libx264',
                '-preset ultrafast', // RAM သုံးစွဲမှု အနည်းဆုံးဖြစ်အောင် ultrafast ကို ပြောင်းထားပါတယ်
                '-crf 28',           // Quality နည်းနည်းလျှော့ပြီး Size သေးအောင်
                '-c:a aac',
                '-b:a 128k',
                '-threads 2',        // Render စက် Crash မဖြစ်အောင် CPU Thread ကို ၂ ခုပဲ သုံးခိုင်းထားပါတယ်
                '-shortest'
            ])
            .output(outputPath)
            .on('end', () => {
                fs.unlinkSync(srtPath); // Cleanup
                resolve(outputPath);
            })
            .on('error', reject)
            .run();
    });
}

function generateSRT(scenes, outputPath) {
    let srtContent = '';
    scenes.forEach((scene, i) => {
        const start = formatTime(scene.start);
        const end = formatTime(scene.end);
        srtContent += `${i + 1}\n${start} --> ${end}\n${scene.text}\n\n`;
    });
    fs.writeFileSync(outputPath, srtContent);
}

function formatTime(seconds) {
    const date = new Date(0);
    date.setSeconds(seconds);
    const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
    return date.toISOString().substr(11, 8) + ',' + ms;
}
