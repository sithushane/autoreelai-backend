import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';

export async function renderReel(audioPath, scenes, musicPath, outputPath) {
    return new Promise((resolve, reject) => {
        let command = ffmpeg();
        let filterChain = '';
        let inputCount = 0;

        scenes.forEach((scene, index) => {
            command.input(scene.videoPath);
            const duration = scene.end - scene.start;
            // ဗီဒီယိုတွေကို အတင်းဆက်တဲ့အခါ Hang မဖြစ်အောင် setpts နဲ့ fps ကို သေချာပြန်ညှိထားပါတယ်
            filterChain += `[${inputCount}:v]scale=-1:854,crop=480:854,setsar=1,fps=24,format=yuv420p,trim=duration=${duration},setpts=PTS-STARTPTS[v${index}];`;
            inputCount++;
        });

        const concatInputs = scenes.map((_, i) => `[v${i}]`).join('');
        filterChain += `${concatInputs}concat=n=${scenes.length}:v=1:a=0[baseV];`;

        command.input(audioPath); 
        const voiceIdx = inputCount;
        inputCount++;
        
        command.input(musicPath); 
        const musicIdx = inputCount;
        
        filterChain += `[${musicIdx}:a]volume=0.2[bgm];[${voiceIdx}:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[audioOut];`;

        const srtPath = path.join(process.cwd(), 'renders', `temp_${Date.now()}.srt`);
        generateSRT(scenes, srtPath);
        
        filterChain += `[baseV]subtitles=${srtPath}:force_style='Fontname=Arial,Fontsize=16,PrimaryColour=&H0000FFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Alignment=2,MarginV=15'[finalV]`;

        console.log("Starting FFmpeg execution...");

        command
            .complexFilter(filterChain)
            .outputOptions([
                '-map [finalV]',
                '-map [audioOut]',
                '-c:v libx264',
                '-preset ultrafast', 
                '-crf 30',           
                '-c:a aac',
                '-b:a 128k',
                '-threads 1',        
                '-shortest'
            ])
            .output(outputPath)
            .on('start', (commandLine) => {
                // FFmpeg စတင်ကြောင်းနဲ့ နောက်ကွယ်က သုံးသွားတဲ့ Command ကို Log မှာ ပြပေးပါမယ်
                console.log('FFmpeg Process Started successfully.');
            })
            .on('progress', (progress) => {
                // ဗီဒီယို ဘယ်လောက်ပြီးနေပြီလဲ ဆိုတာကို အချိန်နဲ့တပြေးညီ ပြပေးပါမယ်
                console.log(`Processing: ${progress.timemark} done...`);
            })
            .on('end', () => {
                console.log("FFmpeg Render Complete!");
                fs.unlinkSync(srtPath);
                resolve(outputPath);
            })
            .on('error', (err) => {
                console.error("FFmpeg Fatal Error:", err.message);
                reject(err);
            })
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
