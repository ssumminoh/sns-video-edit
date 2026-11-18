#!/usr/bin/env bash
# 실제 브이로그 영상 없이도 Remotion/Hyperframes 데모가 돌아가도록 9:16 샘플 클립 3개를 만든다.
# 결과: public/samples/clip{1,2,3}.mp4 (Remotion용), hyperframes/assets/에 같은 파일 복사
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/samples hyperframes/assets

make_clip() { # 이름 색1 색2 음높이(Hz)
  ffmpeg -hide_banner -loglevel error -y \
    -f lavfi -i "gradients=s=1080x1920:c0=$2:c1=$3:speed=0.01:d=3:r=30" \
    -f lavfi -i "sine=frequency=$4:duration=3:sample_rate=48000" \
    -filter:a "volume=0.08" -c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 23 \
    -c:a aac -b:a 128k -shortest "public/samples/$1.mp4"
  cp "public/samples/$1.mp4" "hyperframes/assets/$1.mp4"
}

make_clip clip1 0xE8DCC8 0xB9A88E 220
make_clip clip2 0x9FB3C2 0x51677A 247
make_clip clip3 0xE7B48A 0x6E4B5E 196
echo "샘플 클립 3개 생성: public/samples/, hyperframes/assets/"
