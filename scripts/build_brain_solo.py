# 뇌 나이 측정소 테스트를 하나씩 따로 하는 페이지 6개(/brain-age/<slug>/index.html)를 만든다.
# 흐름은 brain-age/solo.js, 게임은 brain-age/games.js 를 그대로 쓴다. 페이지마다 계기 색·첫 화면 문구·절차서가 다르다.
# 실행: python scripts/build_brain_solo.py
import html, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
BA = ROOT / 'brain-age'
E = html.escape
DOMAIN = json.loads((ROOT / 'site.config.json').read_text(encoding='utf-8'))['domain']

T = [
    dict(key='rt', slug='reaction', model='CH1 · RT', accent='#7dff9b', icon='⚡',
         title='반응속도 테스트 | 초록불에 탭, 밀리초까지 재는 반응속도 측정',
         h1='반응속도 테스트', kicker='초록불이 켜지는 순간 탭',
         desc='화면이 초록색으로 바뀌는 순간 탭해서 반응속도를 ms(밀리초)로 재요. 5번 재서 가장 느린 1번은 빼고 평균. 너무 빨리 누르면 +30ms. 설치 없이 20초.',
         kw='반응속도 테스트, 반응속도 측정, 반응 속도, 순발력 테스트, 클릭 속도',
         rows=[('측정값', '5번 중 가장 느린 1번을 뺀 평균(ms)'), ('실수 처리', '초록 전에 누르면 다시, +30ms'), ('시간', '약 20초')],
         faq=[('휴대폰마다 결과가 다른가요?', '화면과 터치가 반응하는 데 걸리는 시간이 기기마다 달라 수십 ms 차이가 날 수 있어요. 같은 기기로 잰 내 기록끼리 비교하는 게 정확해요.'),
              ('100ms보다 빠르면 왜 실수인가요?', '사람이 보고 누르기엔 너무 빨라서, 미리 짐작하고 누른 것으로 봐요.')]),
    dict(key='mem', slug='memory', model='CH2 · MEM', accent='#ffb547', icon='▦',
         title='순간기억력 테스트 | 불 들어온 칸 순서 따라 누르기',
         h1='순간기억력 테스트', kicker='불이 켜진 순서 그대로',
         desc='칸에 불이 들어오는 순서를 기억했다가 그대로 눌러요. 맞힐 때마다 한 칸씩 길어지고 기회는 2번. 몇 칸까지 기억하는지 재는 기억력 테스트.',
         kw='기억력 테스트, 순간기억력, 단기기억 테스트, 순서 기억 게임, 기억력 게임',
         rows=[('측정값', '따라 누른 최대 길이(칸)'), ('기회', '2번'), ('시간', '약 30초')],
         faq=[('몇 칸이면 잘한 건가요?', '공간 순서를 기억하는 폭은 흔히 6~7칸 정도라고 알려져 있어요. 재미로 보는 기준이에요.'),
              ('틀리면 바로 끝나나요?', '두 번까지 틀릴 수 있어요.')]),
    dict(key='color', slug='color', model='CH3 · HUE', accent='#ff6bd5', icon='◐',
         title='색감 테스트 | 색이 다른 칸 하나 찾기, 30초 색 구분 테스트',
         h1='색감 테스트', kicker='색이 살짝 다른 칸 하나',
         desc='수많은 칸 중에서 색이 살짝 다른 칸 하나를 찾아 탭해요. 단계가 오를수록 칸은 많아지고 차이는 작아져요. 30초 동안 몇 단계까지 가는지 재는 색 구분 테스트.',
         kw='색감 테스트, 색 구분 테스트, 다른 색 찾기, 색깔 테스트, 절대색감',
         rows=[('측정값', '30초 동안 통과한 단계'), ('틀리면', '2초 줄어듦'), ('시간', '30초')],
         faq=[('화면 밝기에 따라 달라지나요?', '네. 밝기·색 설정·블루라이트 필터에 따라 달라질 수 있어요. 같은 조건에서 비교하세요.'),
              ('색약 검사인가요?', '아니에요. 재미로 보는 색 구분 게임이고 의학적 검사가 아니에요.')]),
    dict(key='hear', slug='hearing', model='CH4 · HZ', accent='#5ee2ff', icon='◖',
         title='고주파 청력 테스트 | 몇 Hz까지 들리나, 모기 소리 청력 나이',
         h1='고주파 청력 테스트', kicker='8kHz에서 19kHz까지',
         desc='점점 높아지는 소리가 들리는지 답해서 몇 Hz까지 들리는지 재요. 소리 없는 문제가 섞여 있어 찍기를 걸러요. 볼륨은 중간 이하로, 이어폰 권장.',
         kw='고주파 테스트, 청력 테스트, 모기 소리 테스트, 청력 나이, 몇 hz까지 들리나',
         rows=[('측정값', '들린 가장 높은 소리(Hz)'), ('범위', '8kHz ~ 19kHz'), ('시간', '약 30초')],
         faq=[('스피커로 해도 되나요?', '휴대폰 스피커는 높은 소리를 잘 못 내기도 해요. 이어폰이 더 정확해요. 볼륨은 꼭 중간 이하로 시작하세요.'),
              ('청력 검사를 대신할 수 있나요?', '아니에요. 재미로 보는 측정이에요. 귀가 불편하면 병원 검사를 받으세요.')]),
    dict(key='math', slug='mental-math', model='CH5 · ALU', accent='#ff8a3d', icon='±',
         title='암산 테스트 | 30초 순간계산, 몇 문제 맞히나',
         h1='암산 테스트', kicker='30초 동안 몇 문제',
         desc='나오는 덧셈·뺄셈·곱셈을 숫자 패드로 빠르게 풀어요. 맞힐수록 문제가 어려워져요. 30초 동안 몇 문제 맞히는지 재는 암산 게임.',
         kw='암산 테스트, 암산 게임, 계산 속도 테스트, 두뇌 게임, 수학 게임',
         rows=[('측정값', '30초 동안 맞힌 문제 수'), ('패스', '가능'), ('시간', '30초')],
         faq=[('문제가 왜 점점 어려워지나요?', '맞힌 개수에 따라 두 자리 덧셈·뺄셈과 곱셈이 섞여요.'),
              ('키보드로도 되나요?', '컴퓨터에서는 숫자 키와 지우기 키로 입력할 수 있어요.')]),
    dict(key='dyn', slug='dynamic-vision', model='CH6 · DV', accent='#ff5050', icon='➶',
         title='동체시력 테스트 | 휙 지나가는 숫자 맞히기',
         h1='동체시력 테스트', kicker='휙 지나간 숫자는?',
         desc='두 자리 숫자판이 화면을 휙 지나가요. 무슨 숫자였는지 보기 4개 중에 골라요. 맞힐 때마다 빨라지고 방향과 높이는 매번 바뀌어요. 두 번 틀리면 끝.',
         kw='동체시력 테스트, 동체시력, 동체시력 게임, 순간 포착, 눈 반응 테스트',
         rows=[('측정값', '통과한 단계'), ('속도', '첫 판 1.3초 → 맞힐 때마다 16%씩 빨라짐'), ('기회', '2번')],
         faq=[('나이로도 보여 주나요?', '동체시력은 나이로 바꾸는 기준을 정하지 않아서 단계와 가장 빨랐던 판만 보여 줘요.'),
              ('뇌 나이 종합에도 들어가나요?', '아니요. 종합 측정은 반응속도·기억·색감·청력·암산 5개로 해요.')]),
]

HEAD = '''<!doctype html>
<html lang="ko" data-theme="dark">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>{title}</title>
    <meta name="description" content="{desc}" />
    <meta name="keywords" content="{kw}" />
    <link rel="canonical" href="{url}" />
    <meta name="theme-color" content="#0d0f0e" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="ko_KR" />
    <meta property="og:title" content="{h1}" />
    <meta property="og:description" content="{desc}" />
    <meta property="og:image" content="{domain}/brain-age/og.png" />
    <meta property="og:url" content="{url}" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=IBM+Plex+Sans+KR:wght@600;700&display=swap" />
    <link rel="stylesheet" href="../../shared/components.css" />
    <link rel="stylesheet" href="../style.css" />
    <link rel="stylesheet" href="../solo.css" />
    <style>:root {{ --solo: {accent}; --art-phosphor: {accent}; }}</style>
    <script type="application/ld+json">{ld}</script>
  </head>
'''

BODY = '''  <body class="solo solo--{key}">
    <main class="app">
      <section class="solo-intro" data-view="intro">
        <header class="solo-head"><span class="mono solo-head__model">{model}</span><span class="tag mono">재미용 측정</span></header>
        <h1 class="solo-title"><span class="solo-title__icon" aria-hidden="true">{icon}</span>{h1}</h1>
        <p class="solo-kicker">{kicker}</p>
        <div class="solo-scope plate"><div class="plate__top"><span class="plate__code mono">{model}</span><span class="plate__bar"></span></div><div class="plate__scope"><canvas id="scope"></canvas></div></div>
        <p class="solo-best" id="best"></p>
        <button class="arm" id="start" type="button" aria-label="측정 개시">
          <span class="arm__well" aria-hidden="true"><span class="arm__btn"></span><span class="arm__guard"><i>OPEN</i></span></span>
          <span class="arm__plate"><b>측정 개시</b><small class="mono">START · {model}</small></span>
          <span class="arm__lamp" aria-hidden="true"><i></i><small class="mono">READY</small></span>
        </button>
        <p class="solo-also t-body-03"><a href="../">5개 한 번에 하고 뇌 나이 보기 →</a></p>
      </section>
      <section class="game" data-view="game" hidden>
        <header class="game-head"><button class="btn btn--ghost btn--icon" type="button" id="quit" aria-label="그만하기">✕</button><span class="t-label-01">{h1}</span><span class="btn--icon" aria-hidden="true"></span></header>
        <div class="game-area" id="area"></div>
      </section>
      <section class="result" data-view="result" hidden>
        <header class="topbar"><button class="btn btn--ghost btn--icon" type="button" id="back" aria-label="처음으로">←</button><span class="t-label-01">측정 결과</span><span class="btn--icon" aria-hidden="true"></span></header>
        <div id="resultBody"></div>
      </section>
      <article class="seo labdoc">
        <header class="labdoc__head"><p class="labdoc__no mono"><span>문서 {model}</span><span>재미용 · 비진단</span></p><h2>{h1} 측정 방법</h2></header>
        <section class="labdoc__sec"><p>{desc}</p>
          <table class="solo-tbl">{rows}</table></section>
        <section class="labdoc__sec"><h3><span class="mono">Q&amp;A</span> 측정 문답</h3>{faq}</section>
      </article>
      <nav id="more" aria-label="다른 측정 채널"></nav>
    </main>
    <script type="module">import {{ bootSolo }} from "../solo.js"; bootSolo("{key}");</script>
  </body>
</html>
'''

for t in T:
    url = f"{DOMAIN}/brain-age/{t['slug']}/"
    ld = json.dumps({'@context': 'https://schema.org', '@type': 'WebApplication', 'name': t['h1'], 'url': url, 'description': t['desc'],
                     'applicationCategory': 'GameApplication', 'operatingSystem': 'Any', 'inLanguage': 'ko',
                     'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'KRW'}}, ensure_ascii=False)
    rows = ''.join(f'<tr><th class="mono">{E(a)}</th><td>{E(b)}</td></tr>' for a, b in t['rows'])
    faq = ''.join(f'<details><summary>{E(q)}</summary><p>{E(a)}</p></details>' for q, a in t['faq'])
    page = HEAD.format(title=E(t['title']), desc=E(t['desc']), kw=E(t['kw']), url=url, h1=E(t['h1']), domain=DOMAIN, accent=t['accent'], ld=ld) + \
        BODY.format(key=t['key'], model=E(t['model']), icon=t['icon'], h1=E(t['h1']), kicker=E(t['kicker']), desc=E(t['desc']), rows=rows, faq=faq)
    d = BA / t['slug']
    d.mkdir(exist_ok=True)
    (d / 'index.html').write_text(page, encoding='utf-8')
    print('만듦', d.relative_to(ROOT))
