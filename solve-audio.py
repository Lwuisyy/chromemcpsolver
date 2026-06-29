import sys
import os
import urllib.request
import speech_recognition as sr
from pydub import AudioSegment

def solve(url):
    try:
        audio_path = os.path.join(os.environ.get("TEMP", "."), "captcha.mp3")
        wav_path = os.path.join(os.environ.get("TEMP", "."), "captcha.wav")
        
        print(f"DEBUG: Downloading from {url}")
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"})
        with urllib.request.urlopen(req) as response, open(audio_path, "wb") as out_file:
            out_file.write(response.read())

        print(f"DEBUG: Downloaded to {audio_path}")
        sound = AudioSegment.from_file(audio_path)
        sound.export(wav_path, format="wav")
        print(f"DEBUG: Exported to {wav_path}")

        r = sr.Recognizer()
        with sr.AudioFile(wav_path) as source:
            audio = r.record(source)
            text = r.recognize_google(audio)
            print("TRANSCRIPT:" + text)
            
    except Exception as e:
        print("ERROR:" + str(e))

if __name__ == "__main__":
    solve(sys.argv[1])
