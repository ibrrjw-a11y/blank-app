# '누가 쏠래?' 실시간 추첨 4종 페이지(/who-pays/<mode>/)를 만든다. 공통 틀은 who-pays/shell.js, 게임은 who-pays/live.js.
# 실행: python scripts/build_live_modes.py
import html, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
WP = ROOT / 'who-pays'
E = html.escape
DOMAIN = json.loads((ROOT / 'site.config.json').read_text(encoding='utf-8'))['domain']

M = [
    dict(mode='balloon', fn='startBalloon', icon='🎈', word='PUMP', label='명단 짜기', wordmark='풍선 터뜨리기',
         title='풍선 터뜨리기 추첨 | 누가 쏠래? - 먼저 터진 사람이 벌칙',
         desc='모두의 이름 풍선이 동시에 부풀어요. 바람 세기가 계속 바뀌어서 누가 먼저 터질지 끝까지 몰라요. 먼저 터지면 당첨, 또는 끝까지 남으면 당첨. 2~12명 무료.',
         kw='풍선 터뜨리기, 풍선 게임, 벌칙 정하기, 랜덤 추첨, 커피 내기, 복불복 게임',
         h1='풍선 터뜨리기', lead='모두의 풍선이 한꺼번에 부풀어요. 풍선마다 바람 세기가 1초 남짓마다 바뀌어서, 가장 큰 풍선이 계속 바뀌어요.',
         rules=[('제1조 풍선', '사람 수만큼 풍선이 동시에 부풀어요.'), ('제2조 바람', '풍선마다 바람 세기가 0.7~1.6초마다 무작위로 바뀌어요.'),
                ('제3조 터짐', '어느 크기를 넘으면 커질수록 터질 확률이 가파르게 올라가요. 미리 정해 둔 순서는 없어요.'),
                ('제4조 판정', '먼저 터지면 당첨 / 끝까지 남으면 당첨 중에서 골라요.')],
         faq=[('미리 정해진 거 아니에요?', '아니에요. 터지는 순간은 진행 중에 매 순간 우연으로 갈려요. 그래서 크던 풍선이 끝까지 버티기도 해요.')],
         still='모두의 이름 풍선이 동시에 부풀고, 먼저 터지는 사람이 당첨이에요.'),
    dict(mode='duck', fn='startDuck', icon='🦆', word='SPLASH', label='명단 짜기', wordmark='오리 레이스',
         title='오리 레이스 추첨 | 누가 쏠래? - 고무오리 꼴찌가 벌칙',
         desc='이름 붙은 고무오리들이 물살을 타고 떠내려가요. 바위에 걸리고 소용돌이에 빠지며 순위가 계속 바뀌어요. 꼴찌 당첨 또는 1등 당첨. 2~12명 무료.',
         kw='오리 레이스, 고무오리 레이스, 레이스 추첨, 벌칙 정하기, 랜덤 추첨, 내기 게임',
         h1='오리 레이스', lead='물살은 자리와 시간에 따라 바뀌고, 바위와 소용돌이가 곳곳에 있어요. 앞서던 오리가 소용돌이에서 빙글 돌다 꼴찌가 되기도 해요.',
         rules=[('제1조 출발', '모두 같은 줄에서 동시에 출발해요.'), ('제2조 물살', '강의 흐름이 자리·시간마다 바뀌어요. 모든 오리에게 같은 규칙이에요.'),
                ('제3조 장애물', '바위에 부딪히면 느려지고, 소용돌이에 들어가면 잠깐 빙글 돌아요.'), ('제4조 판정', '꼴찌가 당첨 / 1등이 당첨 중에서 골라요.')],
         faq=[('화면에 다 안 보이는데요?', '화면은 아직 안 들어온 오리들의 가운데를 따라가요. 아래 순위표에서 남은 거리를 볼 수 있어요.')],
         still='이름 붙은 고무오리들이 물살을 타고 떠내려가고, 꼴찌가 당첨이에요.'),
    dict(mode='dodge', fn='startDodge', icon='💩', word='DODGE', label='명단 짜기', wordmark='똥 피하기',
         title='똥 피하기 추첨 | 누가 쏠래? - 먼저 맞은 사람이 벌칙',
         desc='하늘에서 똥이 쏟아져요. 이름 붙은 캐릭터들이 알아서 피하다가 맞으면 탈락. 떨어지는 양은 점점 늘어요. 먼저 맞으면 당첨 또는 끝까지 살면 당첨.',
         kw='똥 피하기, 똥피하기 게임, 벌칙 정하기, 랜덤 추첨, 서바이벌 게임, 내기',
         h1='똥 피하기', lead='모두 같은 실력으로 알아서 피해요. 반응이 늦거나 반대로 피하는 실수는 누구에게나 같은 확률로 일어나요.',
         rules=[('제1조 시작', '모두 땅 위에 흩어져 서요.'), ('제2조 똥', '1초에 떨어지는 개수가 시간이 갈수록 늘어요.'),
                ('제3조 피하기', '캐릭터마다 위험을 보고 피할 쪽을 고르는데, 생각하는 시간과 실수 확률은 모두 같아요.'), ('제4조 판정', '먼저 맞으면 당첨 / 끝까지 살면 당첨 중에서 골라요.')],
         faq=[('제가 조종하는 건가요?', '아니에요. 모두 자동이라 공평해요. 다 같이 화면을 보며 응원하면 돼요.')],
         still='떨어지는 똥을 모두가 알아서 피하고, 먼저 맞은 사람이 당첨이에요.'),
    dict(mode='bomb', fn='startBomb', icon='💣', word='BOOM', label='명단 짜기', wordmark='폭탄 돌리기',
         title='폭탄 돌리기 게임 온라인 | 누가 쏠래? - 터질 때 든 사람이 벌칙',
         desc='둥글게 앉은 사람들 사이로 폭탄이 휙휙 넘어가요. 시간이 갈수록 빨라지고, 언제 터질지 아무도 몰라요. 터질 때 폭탄을 든 사람이 당첨. 2~12명 무료.',
         kw='폭탄 돌리기, 폭탄 게임, 벌칙 정하기, 랜덤 추첨, 복불복, 커피 내기',
         h1='폭탄 돌리기', lead='폭탄은 옆 사람에게, 가끔은 건너뛰어 넘어가요. 처음 4초는 안 터지고, 그 뒤로는 시간이 갈수록 터질 확률이 조금씩 올라가요.',
         rules=[('제1조 자리', '모두 둥글게 앉아요. 첫 폭탄은 무작위로 한 사람에게.'), ('제2조 넘기기', '옆 사람에게 넘어가고, 가끔 몇 칸 건너뛰어요. 점점 빨라져요.'),
                ('제3조 폭발', '터지는 시각은 미리 정하지 않아요. 넘기는 중에는 안 터지고, 받은 사람 손에 있을 때만 터져요.'), ('제4조 판정', '터질 때 폭탄을 든 사람이 당첨.')],
         faq=[('오래 들고 있던 사람이 불리한가요?', '들고 있는 시간이 길수록 그 사람 손에서 터질 기회도 많아져요. 그래서 순위표에 각자 들고 있던 시간을 보여 줘요.')],
         still='둥글게 앉아 폭탄을 돌리고, 터질 때 든 사람이 당첨이에요.'),
]

for m in M:
    url = f"{DOMAIN}/who-pays/{m['mode']}/"
    d = WP / m['mode']
    d.mkdir(exist_ok=True)
    ld = json.dumps({'@context': 'https://schema.org', '@type': 'WebApplication', 'name': f"누가 쏠래? {m['h1']}", 'url': url, 'description': m['desc'],
                     'applicationCategory': 'EntertainmentApplication', 'operatingSystem': 'Any', 'inLanguage': 'ko', 'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'KRW'}}, ensure_ascii=False)
    rules = ''.join(f'<li><b>{E(a)}</b><span>{E(b)}</span></li>' for a, b in m['rules'])
    faq = ''.join(f'<details><summary>{E(q)}</summary><p>{E(a)}</p></details>' for q, a in m['faq'])
    page = f'''<!doctype html>
<html lang="ko" data-theme="dark" data-mode="{m['mode']}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>{E(m['title'])}</title>
    <meta name="description" content="{E(m['desc'])}" />
    <meta name="keywords" content="{E(m['kw'])}" />
    <link rel="canonical" href="{url}" />
    <meta name="theme-color" content="#0b0f0e" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="ko_KR" />
    <meta property="og:url" content="{url}" />
    <meta property="og:title" content="{E(m['h1'])} - 누가 쏠래?" />
    <meta property="og:description" content="{E(m['desc'])}" />
    <meta property="og:image" content="{DOMAIN}/og.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Black+Han+Sans&display=swap" />
    <link rel="stylesheet" href="../../shared/components.css" />
    <link rel="stylesheet" href="../style.css" />
    <script type="application/ld+json">{ld}</script>
  </head>
  <body>
    <main class="app">
      <section class="intro" id="intro" data-view="intro">
        <div class="bc-top">
          <span class="live-bug"><i></i>LIVE</span>
          <span class="wordmark">{E(m['wordmark'])}</span>
          <span class="lv-icon" aria-hidden="true">{m['icon']}</span>
        </div>
        <div class="intro__stage lv-stage" aria-label="견본 이름으로 돌아가는 실제 화면"></div>
        <div class="intro__caption">
          <h1 class="kinetic lv-h1">{E(m['h1'])}</h1>
          <p class="intro__desc lt">{E(m['still'])}</p>
        </div>
        <div class="intro__cta">
          <p class="intro__invite t-label-02" id="invite" hidden></p>
          <button class="gantry" id="start" type="button">
            <span class="gantry__lights" aria-hidden="true"><i></i><i></i><i></i></span>
            <span class="gantry__plate"><b class="gantry__word" aria-hidden="true">{m['word']}</b><span class="gantry__label">{m['label']}</span></span>
          </button>
          <div class="intro__links">
            <p class="alt-modes"></p>
            <button class="btn btn--ghost btn--sm" id="introLedger" hidden>벌칙 장부</button>
          </div>
        </div>
      </section>

      <div id="views"></div>

      <article class="seo rulebook" id="seo">
        <p class="bc-kicker">OFFICIAL RULEBOOK · {E(m['h1'])}</p>
        <h2>온라인 {E(m['h1'])} 규정</h2>
        <p class="rulebook__lead">{E(m['lead'])}</p>
        <ol class="articles">{rules}</ol>
        <p class="rulebook__note">결과는 진행 중에 우연으로 갈려요. 순위표·당첨 기록은 이 기기에만 남아요.</p>
        {faq}
      </article>

      <nav id="more" aria-label="다음 코너: 다른 놀이"></nav>
      <footer class="site-footer">누가 쏠래? · 결과는 무작위예요. 내기는 가볍게!</footer>
    </main>
    <script type="module">
      import {{ startShell }} from "../shell.js";
      import {{ {m['fn']}, demoIntro }} from "../live.js";
      startShell({{ mode: "{m['mode']}", start: {m['fn']}, intro: (root) => demoIntro(root, {m['fn']}, {{ still: {json.dumps(m['still'], ensure_ascii=False)} }}) }});
    </script>
  </body>
</html>
'''
    (d / 'index.html').write_text(page, encoding='utf-8')
    print('만듦', d.relative_to(ROOT))
