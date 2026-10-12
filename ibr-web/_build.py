"""IBR 홈페이지 조립 스크립트.

_src/ 의 페이지 본문에 공통 head·header·footer 를 붙여 ibr-web/*.html 을 만듭니다.
    python3 ibr-web/_build.py
    python3 ibr-web/_build.py --artifact <폴더>   # 미리보기(Artifact)용 사본도 함께 만듭니다
"""
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "_src")
PAGES = ("index.html", "products.html", "product.html", "ir.html")

ARROW = ('<svg viewBox="0 0 16 12" aria-hidden="true"><path d="M0 6h14M9 1l5 5-5 5" '
         'fill="none" stroke="currentColor" stroke-width="1.5"/></svg>')

# 로고: 높이 100 기준의 선(stroke) 경로. I · B(위쪽만 기둥) · R(아래쪽만 기둥) · R 다리
LOGO_PATHS = (
    ("l-i", "M6.5 0V100"),
    ("l-b", "M37.5 93.5H89.5A19 19 0 0 0 108.5 74.5V69A19 19 0 0 0 89.5 50H44V6.5H83.5A19 19 0 0 1 102.5 25.5V31A19 19 0 0 1 83.5 50"),
    ("l-r", "M133 6.5H174.5A19 19 0 0 1 193.5 25.5V39.5A19 19 0 0 1 174.5 58.5H139.5V100"),
    ("l-leg", "M176 58.5L204.2 104"),
)
STOPS = (("0", "#0B8DCF"), (".3", "#10A39E"), (".62", "#1EA464"), ("1", "#9CCB5B"))


def logo(uid, label=True):
    stops = "".join('<stop offset="%s" stop-color="%s"/>' % s for s in STOPS)
    paths = "".join('<path class="%s" pathLength="1" d="%s"/>' % p for p in LOGO_PATHS)
    aria = 'role="img" aria-label="IBR"' if label else 'aria-hidden="true" focusable="false"'
    return (
        '<svg class="ibr-logo" viewBox="0 0 212 100" %s>'
        '<defs><linearGradient id="lg-%s" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="212" y2="0">%s</linearGradient>'
        '<clipPath id="lc-%s"><rect x="-2" y="0" width="216" height="100"/></clipPath></defs>'
        '<g clip-path="url(#lc-%s)" stroke="url(#lg-%s)">%s</g></svg>'
    ) % (aria, uid, stops, uid, uid, uid, paths)


def read(name):
    with open(os.path.join(SRC, name), encoding="utf-8") as f:
        return f.read()


def fill(html):
    html = html.replace("{{ARROW}}", ARROW)
    html = re.sub(r"\{\{LOGO:(\w+)(:deco)?\}\}", lambda m: logo(m.group(1), label=not m.group(2)), html)
    return html


# 관리자 화면이 고치는 데이터 파일. 호스팅(GitHub Pages)이 파일을 10분쯤 기억해 두기 때문에
# 주소 뒤에 1분마다 바뀌는 번호를 붙여, 저장한 내용이 1~2분 안에 홈페이지에 보이게 합니다.
DATA_JS = {"ibr-data.js", "ibr-media.js", "ibr-links.js", "ibr-ir-data.js"}


def script_tag(name):
    if name in DATA_JS:
        return ("<script>document.write('<script src=\"assets/js/%s?v=' + Math.floor(Date.now() / 6e4) + '\"><\\/script>')</script>\n" % name)
    return '<script src="assets/js/%s"></script>\n' % name


def build(page, artifact_dir=None):
    body = read(page)
    meta = dict(re.findall(r"<!-- (\w+): (.+?) -->\n", body))
    body = re.sub(r"<!-- \w+: .+? -->\n", "", body)
    head = read("_head.html").replace("{{TITLE}}", meta["title"]).replace("{{DESC}}", meta.get("desc", ""))
    header = read("_header.html")
    for key in ("home", "products", "ir"):
        header = header.replace("{{NAV_%s}}" % key.upper(), ' aria-current="page"' if meta.get("nav") == key else "")
    header = header.replace("{{HEADER_CLASS}}", meta.get("header", ""))
    home = "" if page == "index.html" else "index.html"
    header = header.replace("{{HOME}}", home)
    footer = read("_footer.html").replace("{{HOME}}", home)
    scripts = "".join(script_tag(s) for s in meta["scripts"].split())
    gate = read("_gate.html") if meta.get("gate") == "yes" else ""

    content = fill(gate + header + body + footer + scripts)
    full = ('<!doctype html>\n<html lang="ko">\n<head>\n' + fill(head) + "</head>\n<body>\n" + content + "</body>\n</html>\n")
    with open(os.path.join(HERE, page), "w", encoding="utf-8") as f:
        f.write(full)
    print("built", page)

    if artifact_dir:
        out = os.path.join(artifact_dir, page)
        if page == "index.html":
            # Artifact 의 첫 화면은 doctype/head/body 를 플랫폼이 감쌉니다.
            head_inner = re.sub(r'<meta charset[^>]*>\n|<meta name="viewport"[^>]*>\n', "", fill(head))
            html = head_inner + content
        else:
            html = full
        with open(out, "w", encoding="utf-8") as f:
            f.write(html)


def main():
    art = None
    if "--artifact" in sys.argv:
        art = sys.argv[sys.argv.index("--artifact") + 1]
        os.makedirs(art, exist_ok=True)
        if os.path.exists(os.path.join(art, "assets")):
            shutil.rmtree(os.path.join(art, "assets"))
        shutil.copytree(os.path.join(HERE, "assets"), os.path.join(art, "assets"))
    for p in PAGES:
        build(p, art)


if __name__ == "__main__":
    main()
