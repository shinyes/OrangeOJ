import turtle
import base64
import subprocess
import sys
import os

# User turtle code
__USER_CODE__

try:
    turtle.done()
except:
    pass

# Capture the final canvas as an image
try:
    canvas = turtle.getcanvas()
    eps_path = "/tmp/turtle_output.eps"
    png_path = "/tmp/turtle_output.png"
    canvas.postscript(file=eps_path, colormode="color")

    result = subprocess.run(
        ["gs", "-dSAFER", "-dBATCH", "-dNOPAUSE",
         "-sDEVICE=png16m", "-r150",
         "-sOutputFile=" + png_path, eps_path],
        capture_output=True, timeout=15, text=True
    )
    if result.returncode == 0 and os.path.exists(png_path):
        with open(png_path, "rb") as f:
            png_data = base64.b64encode(f.read()).decode()
        print("TURTLE_IMAGE:" + png_data, flush=True)
    else:
        print("TURTLE_ERROR:ghostscript conversion failed: " + result.stderr, flush=True)
except Exception as e:
    print("TURTLE_ERROR:" + str(e), flush=True)
