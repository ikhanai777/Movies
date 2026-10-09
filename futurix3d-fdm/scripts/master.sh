#!/usr/bin/env bash
# Final master: loudness-normalise the mixed audio to -14 LUFS (static gain +
# limiter, video stream copied untouched), trim to exactly 60.000 s.
set -euo pipefail
IN=$1; OUT=$2
I=$(ffmpeg -hide_banner -i "$IN" -af loudnorm=print_format=json -f null - 2>&1 | sed -n 's/.*"input_i" : "\(.*\)".*/\1/p')
G=$(python3 -c "print(round(-14.0 - float('$I'), 3))")
ffmpeg -v error -y -i "$IN" -map 0:v -map 0:a -c:v copy \
  -af "volume=${G}dB,alimiter=limit=0.8414:attack=2:release=60:level=disabled" \
  -c:a aac -b:a 320k -ar 48000 -t 60 -movflags +faststart "$OUT"
echo "mix was $I LUFS, applied ${G} dB"
