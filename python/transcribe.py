import sys
import json
from faster_whisper import WhisperModel

def transcribe(audio_path):
    # Load model locally (base or small is fast and accurate enough for mobile)
    model = WhisperModel("small", device="cpu", compute_type="int8")
    segments, info = model.transcribe(audio_path, beam_size=5)
    
    output = []
    for segment in segments:
        output.append({
            "start": segment.start,
            "end": segment.end,
            "text": segment.text.strip()
        })
    
    print(json.dumps(output))

if __name__ == "__main__":
    transcribe(sys.argv[1])
  
