#!/usr/bin/env python3
"""Собирает news/news.json: ленту новостей ИИ, переведённую на русский.

Источники:
  - лента ip.net.coffee/news (китайский) — берём заголовок и вводку статьи,
    сама статья остаётся у авторов, даём ссылку;
  - инциденты status.claude.com и status.openai.com;
  - релизы на GitHub: Claude Code, Codex, Gemini CLI, спецификация MCP.

Перевод — Google Translate (бесплатный эндпоинт gtx). Переводы кэшируются
в самом news.json, поэтому повторный запуск переводит только новое.
Запуск: python3 scripts/build_news.py  (GitHub Actions — раз в час).
"""
import hashlib
import os
import html
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

OUT = Path(os.environ.get('NEWS_OUT') or Path(__file__).resolve().parent.parent / 'news' / 'news.json')
UA = {'User-Agent': 'Mozilla/5.0 (news-builder; ivannad11.github.io/ip-check-ru)'}
NC_ARTICLES = 40      # сколько последних статей net.coffee брать
PER_STATUS = 20
PER_REPO = 8


def get(url, accept=None, timeout=20):
    headers = dict(UA)
    if accept:
        headers['Accept'] = accept
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=timeout) as r:
        return r.read().decode('utf-8', 'replace')


# ===== Перевод с кэшем =====
cache = {}


def tr(text, src='auto'):
    text = (text or '').strip()
    if not text:
        return ''
    key = hashlib.sha1(text.encode()).hexdigest()[:16]
    if key in cache:
        return cache[key]
    q = urllib.parse.urlencode({'client': 'gtx', 'sl': src, 'tl': 'ru', 'dt': 't', 'q': text[:4500]})
    for attempt in range(3):
        try:
            data = json.loads(get('https://translate.googleapis.com/translate_a/single?' + q))
            out = ''.join(part[0] for part in data[0] if part and part[0]).replace('\u200b', '')
            cache[key] = out
            time.sleep(0.3)
            return out
        except Exception:
            time.sleep(2 * (attempt + 1))
    return text  # перевод не удался — оставляем оригинал, в следующий раз попробуем снова


def clean(s):
    s = re.sub(r'<[^>]+>', ' ', s or '')
    return re.sub(r'\s+', ' ', html.unescape(s)).strip()


# ===== Рубрики (как у оригинала) =====
def tagger(text, base):
    t = text.lower()
    tags = list(base)
    rules = [
        ('Claude Code', r'claude code'), ('Codex', r'codex'), ('ChatGPT', r'chatgpt'),
        ('API', r'\bapi\b|console|platform'), ('Gemini', r'gemini'), ('MCP', r'\bmcp\b|connector'),
        ('Claude', r'claude|anthropic'), ('OpenAI', r'openai|gpt-'),
    ]
    for tag, rx in rules:
        if re.search(rx, t) and tag not in tags:
            tags.append(tag)
    return tags


# ===== Источники =====
def net_coffee():
    page = get('https://ip.net.coffee/news/', timeout=60)
    m = re.search(r'<script type="application/ld\+json">(\{"@context":"https://schema.org","@type":"CollectionPage".*?)</script>', page, re.S)
    lst = json.loads(m.group(1))['mainEntity']['itemListElement'][:NC_ARTICLES]
    items = []
    for el in lst:
        url = el['url']
        try:
            art = get(url, timeout=40)
        except Exception:
            continue
        date = re.search(r'/news/(\d{4})(\d{2})(\d{2})', url)
        date = f'{date[1]}-{date[2]}-{date[3]}T00:00:00Z' if date else ''
        # Вводка — первый абзац после заголовка (короткий подзаголовок статьи)
        body = art.split('</h1>', 1)[-1]
        paras = [clean(p) for p in re.findall(r'<p[^>]*>(.*?)</p>', body, re.S)]
        lead = next((p for p in paras if len(p) > 20 and 'Net.Coffee' not in p), '')
        cat = 'Claude' if '/claude/' in url else 'OpenAI'
        title_zh = clean(el['name'])
        title_ru = tr(title_zh, 'zh-CN')
        items.append({
            'title': title_ru, 'orig': title_zh, 'desc': tr(lead[:600], 'zh-CN'), 'date': date,
            'tags': tagger(title_ru + ' ' + title_zh, [cat]), 'url': url,
            'kind': ['k-art', 'статья net.coffee'], 'src': 'ip.net.coffee/news',
        })
    return items


IMPACT_RU = {'none': 'событие', 'minor': 'мелкий сбой', 'major': 'крупный сбой', 'critical': 'авария', 'maintenance': 'техработы'}
ST_RU = {'investigating': 'разбираются', 'identified': 'причина найдена', 'monitoring': 'наблюдают', 'resolved': 'решено', 'postmortem': 'разбор'}


def status(host, base):
    d = json.loads(get(f'https://{host}/api/v2/incidents.json', 'application/json'))
    items = []
    for i in d.get('incidents', [])[:PER_STATUS]:
        upd = (i.get('incident_updates') or [{}])[0]
        comps = ' '.join(c.get('name', '') for c in i.get('components') or [])
        imp = IMPACT_RU.get(i.get('impact'), 'сбой')
        st = i.get('status')
        items.append({
            'title': tr(i['name'], 'en'), 'orig': i['name'], 'desc': tr(clean(upd.get('body', ''))[:400], 'en'),
            'date': i.get('created_at', ''), 'tags': tagger(i['name'] + ' ' + comps, base),
            'url': i.get('shortlink') or f'https://{host}',
            'kind': ['k-ok', f'{imp} · решено'] if st == 'resolved' else ['k-inc', f'{imp} · {ST_RU.get(st, st)}'],
            'src': host,
        })
    return items


def md_points(md, n=3):
    pts = []
    for line in (md or '').splitlines():
        line = line.strip()
        if re.match(r'^[-*] ', line):
            line = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', line[2:])
            line = re.sub(r' by @\S+ in https?://\S+|\s*\(#[\d, #]+\)|`|\*\*', '', line)
            pts.append(line)
        if len(pts) >= n:
            break
    return ' · '.join(pts)


def releases(repo, tags, title, limit=PER_REPO):
    d = json.loads(get(f'https://api.github.com/repos/{repo}/releases?per_page=30', 'application/vnd.github+json'))
    items = []
    for r in [r for r in d if not r.get('draft') and not r.get('prerelease')][:limit]:
        desc = md_points(r.get('body')) or clean(r.get('body', ''))[:200]
        items.append({
            'title': title(r), 'orig': '', 'desc': tr(desc, 'en'), 'date': r.get('published_at', ''),
            'tags': tags, 'url': r['html_url'], 'kind': ['k-rel', 'новая версия'], 'src': 'GitHub ' + repo,
        })
    return items


SOURCES = [
    ('Статьи net.coffee', net_coffee),
    ('Статус Claude', lambda: status('status.claude.com', ['Claude'])),
    ('Статус OpenAI', lambda: status('status.openai.com', ['OpenAI'])),
    ('Claude Code', lambda: releases('anthropics/claude-code', ['Claude Code', 'Claude'], lambda r: f"Claude Code {r['tag_name']}")),
    ('Codex', lambda: releases('openai/codex', ['Codex', 'OpenAI'], lambda r: f"Codex CLI {r.get('name') or r['tag_name']}")),
    ('Gemini CLI', lambda: releases('google-gemini/gemini-cli', ['Gemini'], lambda r: f"Gemini CLI {r['tag_name']}")),
    ('MCP', lambda: releases('modelcontextprotocol/modelcontextprotocol', ['MCP'], lambda r: f"Спецификация MCP {r['tag_name']}", 5)),
]


def main():
    old = {}
    if OUT.exists():
        try:
            old = json.loads(OUT.read_text())
            cache.update(old.get('tr_cache', {}))
        except Exception:
            pass
    items, ok, failed = [], [], []
    old_by_src = {}
    for it in old.get('items', []):
        old_by_src.setdefault(it.get('group'), []).append(it)
    for name, fn in SOURCES:
        try:
            got = fn()
            for it in got:
                it['group'] = name
            items += got
            ok.append(name)
        except Exception as e:
            print(f'{name}: {e}')
            failed.append(name)
            items += old_by_src.get(name, [])  # источник упал — держим прошлые записи
    items.sort(key=lambda i: i.get('date') or '', reverse=True)
    OUT.write_text(json.dumps({
        'updated': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'sources_ok': ok, 'sources_failed': failed, 'items': items,
        'tr_cache': {k: v for k, v in list(cache.items())[-3000:]},
    }, ensure_ascii=False, indent=0))
    print(f'{len(items)} записей; ok: {", ".join(ok)}; не ответили: {", ".join(failed) or "—"}')


if __name__ == '__main__':
    main()
