import turtle
import base64
import subprocess
import sys
import os
import json
import glob
import time
import threading

OUTPUT_DIR = "/tmp/turtle_frames"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# User turtle code
__USER_CODE__

# Start frame capture in background
frame_idx = [0]
capturing = [True]

def capture_loop():
    while capturing[0]:
        try:
            canvas = turtle.getcanvas()
            eps_path = os.path.join(OUTPUT_DIR, "frame_%04d.eps" % frame_idx[0])
            canvas.postscript(file=eps_path, colormode="color")
            frame_idx[0] += 1
        except:
            pass
        time.sleep(0.15)

t = threading.Thread(target=capture_loop, daemon=True)
t.start()

time.sleep(0.3)

try:
    turtle.done()
except:
    pass

time.sleep(1.0)
capturing[0] = False
time.sleep(0.3)

try:
    canvas = turtle.getcanvas()
    eps_path = os.path.join(OUTPUT_DIR, "frame_%04d.eps" % frame_idx[0])
    canvas.postscript(file=eps_path, colormode="color")
    frame_idx[0] += 1
except:
    pass

eps_files = sorted(glob.glob(os.path.join(OUTPUT_DIR, "frame_*.eps")))
images = []
for eps_file in eps_files:
    png_file = eps_file.replace(".eps", ".png")
    result = subprocess.run(
        ["gs", "-dSAFER", "-dBATCH", "-dNOPAUSE",
         "-sDEVICE=png16m", "-r100",
         "-sOutputFile=" + png_file, eps_file],
        capture_output=True, timeout=15, text=True
    )
    if result.returncode == 0 and os.path.exists(png_file):
        with open(png_file, "rb") as f:
            images.append(base64.b64encode(f.read()).decode())

if len(images) > 1:
    print("TURTLE_FRAMES:" + json.dumps(images), flush=True)
elif len(images) == 1:
    print("TURTLE_IMAGE:" + images[0], flush=True)
else:
    print("TURTLE_ERROR:no frames captured", flush=True)
