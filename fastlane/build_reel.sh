#!/usr/bin/env bash
# Renders the Fastlane Ch.1 reel (reel.html) end to end.
#   ./build_reel.sh                 -> fastlane_ch1_reel.mp4 (1080x1920, 30 fps, 64 s)
#   W=540 H=960 ./build_reel.sh     for a fast preview
set -euo pipefail
cd "$(dirname "$0")"
W=${W:-1080}; H=${H:-1920}; FPS=${FPS:-30}
FFMPEG=${FFMPEG:-$(command -v ffmpeg || python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")}
export FFMPEG
mkdir -p build/parts

CHUNKS=("0 16" "16 32" "32 48" "48 64")
pids=()
for c in "${CHUNKS[@]}"; do
  set -- $c
  node render.mjs --w "$W" --h "$H" --fps "$FPS" --from "$1" --to "$2" \
    --out "build/parts/part_$1.mp4" > "build/parts/log_$1.txt" 2>&1 &
  pids+=($!)
done
python3 soundtrack.py
for p in "${pids[@]}"; do wait "$p"; done

: > build/parts/parts.txt
for c in "${CHUNKS[@]}"; do set -- $c; echo "file 'part_$1.mp4'" >> build/parts/parts.txt; done

# Instagram-friendly delivery: H.264 High 4.1, yuv420p, 30 fps CFR, BT.709 tags,
# AAC 48 kHz stereo, loudness normalised to -14 LUFS, faststart for streaming.
"$FFMPEG" -y -f concat -safe 0 -i build/parts/parts.txt -i build/soundtrack.wav \
  -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 18 -maxrate 20M -bufsize 40M -profile:v high -level 4.1 \
  -pix_fmt yuv420p -r "$FPS" -g $((FPS * 2)) \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -af "loudnorm=I=-14:TP=-1.0:LRA=9" -c:a aac -b:a 256k -ar 48000 -ac 2 \
  -shortest -movflags +faststart fastlane_ch1_reel.mp4
echo "wrote fastlane_ch1_reel.mp4"
