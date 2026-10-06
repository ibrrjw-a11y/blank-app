"""시안의 공통 스타일·모션·이미지를 카페24 스킨 폴더로 옮깁니다.

시안(prototype)에서 디자인을 고친 뒤 이 스크립트를 돌리면 스킨에도 같은 모양이 반영됩니다.
    python3 arvo-web/prototype/_build.py
    python3 arvo-web/sync_skin.py

- prototype/assets/css/arvo.css      -> cafe24-skin/arvo/css/arvo-page.css (시안 전용 구간 제외)
- prototype/assets/js/arvo-motion.js -> cafe24-skin/arvo/js/arvo-motion.js
- prototype/assets/img/*.webp        -> cafe24-skin/arvo/img/
"""
import os
import re
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
PROTO = os.path.join(HERE, "prototype", "assets")
SKIN = os.path.join(HERE, "cafe24-skin", "arvo")

# 시안 전용(미니 장바구니, 시안 표시) 구간은 스킨에 넣지 않습니다.
PROTO_ONLY = re.compile(r"/\* ---------- 17\. .*?(?=/\* ---------- 19\. )", re.S)

css = open(os.path.join(PROTO, "css", "arvo.css"), encoding="utf-8").read()
css = PROTO_ONLY.sub("", css)
css = css.replace("이 파일은 시안과 카페24 스킨이 함께 씁니다.",
                  "이 파일은 sync_skin.py 가 시안의 arvo.css 에서 만듭니다. 고칠 때는 시안 쪽을 고친 뒤 다시 돌리세요.")
with open(os.path.join(SKIN, "css", "arvo-page.css"), "w", encoding="utf-8") as f:
    f.write(css)
print("css  arvo-page.css")

shutil.copyfile(os.path.join(PROTO, "js", "arvo-motion.js"), os.path.join(SKIN, "js", "arvo-motion.js"))
print("js   arvo-motion.js")

os.makedirs(os.path.join(SKIN, "img"), exist_ok=True)
for name in sorted(os.listdir(os.path.join(PROTO, "img"))):
    if name.endswith(".webp"):
        shutil.copyfile(os.path.join(PROTO, "img", name), os.path.join(SKIN, "img", name))
        print("img ", name)
