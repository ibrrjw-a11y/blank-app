"""
상세 이미지 폴더의 큰 움직이는 GIF 를 움직이는 webp 로 바꾸고 ibr-data.js 의 경로도 고칩니다.
관리자 화면과 같은 규칙: 가로 860px, 60ms 보다 짧은 프레임은 이웃과 합침, 품질 70.
  python3 ibr-web/tools/shrink_gifs.py            # 1MB 넘는 GIF 모두
  python3 ibr-web/tools/shrink_gifs.py 0          # 크기와 상관없이 모두
바꾼 GIF 는 git rm 으로 지웁니다.
"""
import glob, os, subprocess, sys
from PIL import Image, ImageSequence

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(HERE, "assets", "js", "ibr-data.js")
MIN = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0


def convert(src, out):
    im = Image.open(src)
    frames, durs = [], []
    for fr in ImageSequence.Iterator(im):
        d = fr.info.get("duration", 100) or 100
        if d <= 10:
            d = 100
        if frames and durs[-1] < 60:
            durs[-1] += d
            continue
        frames.append(fr.convert("RGB"))
        durs.append(d)
    if frames[0].width > 860:
        h = round(frames[0].height * 860 / frames[0].width)
        frames = [f.resize((860, h), Image.LANCZOS) for f in frames]
    if len(frames) == 1:
        frames[0].save(out, "WEBP", quality=80, method=6)
    else:
        frames[0].save(out, "WEBP", save_all=True, append_images=frames[1:], duration=durs, loop=0, quality=70, method=4)


def main():
    data = open(DATA, encoding="utf-8").read()
    before = after = 0
    for src in sorted(glob.glob(os.path.join(HERE, "assets", "img", "detail", "*", "*.gif"))):
        if os.path.getsize(src) < MIN * 1e6:
            continue
        rel = os.path.relpath(src, HERE).replace(os.sep, "/")
        out = src[:-4] + ".webp"
        convert(src, out)
        a, b = os.path.getsize(src), os.path.getsize(out)
        before += a; after += b
        data = data.replace('"%s"' % rel, '"%s"' % rel[:-4] + '.webp"')
        subprocess.run(["git", "rm", "-q", src], check=True, cwd=HERE)
        print("%s  %.1fMB -> %.1fMB" % (rel, a / 1e6, b / 1e6))
    open(DATA, "w", encoding="utf-8").write(data)
    print("total %.1fMB -> %.1fMB" % (before / 1e6, after / 1e6))


if __name__ == "__main__":
    main()
