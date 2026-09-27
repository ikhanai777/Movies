#!/usr/bin/env bash
# Renders the Spacetime short film end to end.
#   ./build.sh            -> spacetime.mp4 (1920x1080, 24 fps)
#   W=1280 H=720 ./build.sh   for a faster preview
set -euo pipefail
cd "$(dirname "$0")"
W=${W:-1920}; H=${H:-1080}; FPS=${FPS:-24}
FFMPEG=${FFMPEG:-$(command -v ffmpeg || python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")}
export FFMPEG
mkdir -p build

# Render in parallel chunks (headless Chromium + WebGL2), then concatenate.
CHUNKS=("0 18" "18 35" "35 52" "52 70")
pids=()
for c in "${CHUNKS[@]}"; do
  set -- $c
  node render.mjs --w "$W" --h "$H" --fps "$FPS" --from "$1" --to "$2" --out "build/part_$1.mp4" > "build/log_$1.txt" 2>&1 &
  pids+=($!)
done
python3 soundtrack.py
for p in "${pids[@]}"; do wait "$p"; done

: > build/parts.txt
for c in "${CHUNKS[@]}"; do set -- $c; echo "file 'part_$1.mp4'" >> build/parts.txt; done
"$FFMPEG" -y -f concat -safe 0 -i build/parts.txt -i build/soundtrack.wav \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart spacetime.mp4
echo "wrote spacetime.mp4"
