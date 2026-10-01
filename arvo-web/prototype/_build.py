"""시안 페이지 조립 스크립트.

_src/ 의 페이지 본문에 공통 head·header·footer를 붙여 prototype/*.html 을 만듭니다.
    python3 arvo-web/prototype/_build.py
"""
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "_src")

GRAIN = (
    '<svg class="grain" viewBox="0 0 100 130" preserveAspectRatio="none" aria-hidden="true">'
    '<path d="M-10 10 C 22 2, 44 34, 112 22"/><path d="M-10 32 C 26 22, 46 58, 112 46"/>'
    '<path d="M-10 56 C 30 46, 50 82, 112 70"/><path d="M-10 80 C 24 72, 56 106, 112 94"/>'
    '<path d="M-10 104 C 30 96, 50 130, 112 118"/><path d="M18 -6 C 28 40, 70 62, 92 140"/></svg>'
)
ARROW = (
    '<svg width="14" height="10" viewBox="0 0 14 10" aria-hidden="true">'
    '<path d="M0 5h12M8 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>'
)


def read(name):
    with open(os.path.join(SRC, name), encoding="utf-8") as f:
        return f.read()


def build(page):
    body = read(page)
    title = re.search(r"<!-- title: (.+?) -->", body).group(1)
    nav = re.search(r"<!-- nav: (\w+) -->", body)
    battr = re.search(r"<!-- body: (.+?) -->", body)
    body = re.sub(r"<!-- (title|nav|body): .+? -->\n", "", body)

    head = read("_head.html").replace("{{TITLE}}", title)
    head = head.replace("{{BODYATTR}}", " " + battr.group(1) if battr else "")
    header = read("_header.html")
    header = header.replace("{{NAV_SHOP}}", ' aria-current="page"' if nav and nav.group(1) == "shop" else "")
    header = header.replace("{{NAV_BRAND}}", ' aria-current="page"' if nav and nav.group(1) == "brand" else "")
    html = head + header + body + read("_footer.html")
    html = html.replace("{{GRAIN}}", GRAIN).replace("{{ARROW}}", ARROW)
    with open(os.path.join(HERE, page), "w", encoding="utf-8") as f:
        f.write(html)
    print("built", page)


for p in ("index.html", "shop.html", "product.html", "brand.html"):
    build(p)
