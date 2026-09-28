#!/usr/bin/env bash
# Renders the vertical Instagram Reel cut (reel.html) end to end.
#   ./build_reel.sh                    -> spacetime_reel.mp4 (1080x1920, 30 fps, 60 s)
#   W=540 H=960 SPP=1 ./build_reel.sh  for a fast preview
set -euo pipefail
cd "$(dirname "$0")"
W=${W:-1080}; H=${H:-1920}; FPS=${FPS:-30}; SPP=${SPP:-2}
FFMPEG=${FFMPEG:-$(command -v ffmpeg || python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")}
export FFMPEG
mkdir -p build/reel

# Chunks are smaller around the black hole, the most expensive shot.
CHUNKS=("0 12" "12 25" "25 38" "38 46" "46 52" "52 60")
pids=()
for c in "${CHUNKS[@]}"; do
  set -- $c
  node render.mjs --page reel.html --w "$W" --h "$H" --fps "$FPS" --spp "$SPP" --from "$1" --to "$2" \
    --out "build/reel/part_$1.mp4" > "build/reel/log_$1.txt" 2>&1 &
  pids+=($!)
done
python3 soundtrack.py reel
for p in "${pids[@]}"; do wait "$p"; done

: > build/reel/parts.txt
for c in "${CHUNKS[@]}"; do set -- $c; echo "file 'part_$1.mp4'" >> build/reel/parts.txt; done

# Instagram-friendly delivery: H.264 High 4.1, yuv420p, 30 fps CFR, BT.709 tags,
# AAC 48 kHz stereo, loudness normalised to -14 LUFS, faststart for streaming.
"$FFMPEG" -y -f concat -safe 0 -i build/reel/parts.txt -i build/soundtrack_reel.wav \
  -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 17 -maxrate 25M -bufsize 50M -profile:v high -level 4.1 \
  -pix_fmt yuv420p -r "$FPS" -g $((FPS * 2)) \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -af "loudnorm=I=-14:TP=-1.0:LRA=9" -c:a aac -b:a 256k -ar 48000 -ac 2 \
  -shortest -movflags +faststart spacetime_reel.mp4
echo "wrote spacetime_reel.mp4"
