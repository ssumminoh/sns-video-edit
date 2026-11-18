#!/usr/bin/env bash
# 손으로 찍은 영상을 고정 앵글처럼 바꾼다 (FFmpeg vidstab, 2단계).
#
# 사용법: npm run stabilize -- <입력.mp4> <출력.mp4> [tripod|horizon|smooth] [확대%]
#   tripod  : 첫 프레임 배경에 완전히 고정 (사람/차만 움직이는 고정 앵글)
#   horizon : 크게 흔들리는 것만 잡고 천천히 흐르게 둠 (버스·지하철 창밖)
#   smooth  : 일반 손떨림 보정
#   확대%   : 가장자리 검은 테두리를 가리기 위한 확대 비율. 기본 tripod 12, horizon 6, smooth 4
set -euo pipefail

in="${1:?입력 영상 경로가 필요합니다}"
out="${2:?출력 영상 경로가 필요합니다}"
mode="${3:-tripod}"

case "$mode" in
  tripod)  zoom="${4:-12}"; transform="tripod=1:optzoom=0:zoom=${zoom}:crop=black" ;;
  horizon) zoom="${4:-6}";  transform="smoothing=60:optzoom=0:zoom=${zoom}:crop=black" ;;
  smooth)  zoom="${4:-4}";  transform="smoothing=15:optzoom=0:zoom=${zoom}:crop=black" ;;
  *) echo "모드는 tripod, horizon, smooth 중 하나여야 합니다: $mode" >&2; exit 1 ;;
esac

detect_opts="shakiness=8:accuracy=15"
[ "$mode" = tripod ] && detect_opts="${detect_opts}:tripod=1"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

ffmpeg -hide_banner -loglevel error -y -i "$in" \
  -vf "vidstabdetect=${detect_opts}:result=${work}/transforms.trf" -f null -
ffmpeg -hide_banner -loglevel error -y -i "$in" \
  -vf "vidstabtransform=input=${work}/transforms.trf:${transform},unsharp=5:5:0.6:3:3:0.3" \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a copy "$out"

echo "완료: $out (모드 ${mode}, 확대 ${zoom}%)"
