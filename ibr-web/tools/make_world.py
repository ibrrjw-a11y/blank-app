"""세계 지도 점 데이터(assets/js/ibr-world.js)를 만듭니다.

    pip install global-land-mask
    python3 ibr-web/tools/make_world.py

경도 -25°~335°(태평양 중심), 위도 80°~-56° 범위를 STEP 간격의 격자로 나누고
육지인 칸을 1비트로 담아 base64 문자열로 저장합니다.
"""
import base64
import os

from global_land_mask import globe

STEP = 2.25
LON0, LON1 = -25.0, 335.0
LAT0, LAT1 = 80.0, -56.0
COLS = int(round((LON1 - LON0) / STEP))
ROWS = int(round((LAT0 - LAT1) / STEP))


def land(lon, lat):
    lon = ((lon + 180) % 360) - 180
    return globe.is_land(lat, lon)


bits = []
for r in range(ROWS):
    lat = LAT0 - (r + 0.5) * STEP
    for c in range(COLS):
        lon = LON0 + (c + 0.5) * STEP
        hit = 0
        for dy in (-0.33, 0, 0.33):
            for dx in (-0.33, 0, 0.33):
                hit += land(lon + dx * STEP, lat + dy * STEP)
        bits.append(1 if hit >= 2 else 0)

raw = bytearray()
for i in range(0, len(bits), 8):
    b = 0
    for j, v in enumerate(bits[i:i + 8]):
        b |= v << (7 - j)
    raw.append(b)

out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "js", "ibr-world.js")
with open(out, "w", encoding="utf-8") as f:
    f.write("/* 세계 지도 점 데이터. tools/make_world.py 로 다시 만들 수 있습니다. */\n")
    f.write("window.IBR_WORLD={cols:%d,rows:%d,lon0:%g,lat0:%g,step:%g,bits:\"%s\"};\n"
            % (COLS, ROWS, LON0, LAT0, STEP, base64.b64encode(bytes(raw)).decode()))
print(COLS, ROWS, sum(bits), "land dots ->", out)
