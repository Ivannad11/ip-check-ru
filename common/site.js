// Общие хелперы для всех вкладок. Подключается первым на каждой странице:
// <script src="../common/site.js"></script> (на главной — common/site.js)

// Бэкенд оценки IP оригинала — CORS открыт: /api/geoip, /api/geoip-batch, /api/iprisk,
// /api/ip/lookup, /api/ip/related, /api/ip/pingcheck, /api/ip/portscan, /api/ping/*
const NC = 'https://ip.net.coffee';
// Корень сайта относительно текущей страницы (страницы лежат на глубине 0 или 1)
const ROOT = document.currentScript.src.replace(/common\/site\.js.*$/, '');

// [путь, название, главная ли вкладка (видна в шапке на компьютере)]
const PAGES = [
  ['', 'Мой IP', 1], ['claude/', 'Claude', 1], ['gpt/', 'ChatGPT', 1], ['ip/', 'Оценка IP', 1],
  ['link/', 'Доступность', 1], ['dns/', 'Утечка DNS'], ['webrtc/', 'WebRTC'],
  ['cloudflare/', 'Cloudflare'], ['ping/', 'Пинг'], ['status/', 'Статусы'],
  ['whois/', 'Whois'], ['news/', 'Новости'], ['card/', 'IP-карточка'],
];

// Иконки вкладок — свои inline-SVG (24×24, обводка), у каждой вкладки уникальная
const ICONS = {
  '': '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
  'claude/': '<path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"/><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/>',
  'gpt/': '<path d="M12 3.5 19.4 7.75v8.5L12 20.5l-7.4-4.25v-8.5z"/><path d="M12 8.5 15 10.25v3.5L12 15.5 9 13.75v-3.5z"/>',
  'ip/': '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.1 7.5 9.5 4.3-1.4 7.5-4.9 7.5-9.5V6z"/><path d="m8.8 12.2 2.2 2.2 4.4-4.6"/>',
  'link/': '<path d="M4 18a11 11 0 0 1 16 0"/><path d="M7 14.6a6.5 6.5 0 0 1 10 0"/><circle cx="12" cy="19" r="1.3" fill="currentColor" stroke="none"/><path d="M10.5 9.5 12 4l1.5 5.5"/>',
  'dns/': '<rect x="3.5" y="4" width="17" height="6" rx="1.5"/><rect x="3.5" y="14" width="17" height="6" rx="1.5"/><path d="M7 7h.01M7 17h.01M11 7h6M11 17h6"/>',
  'webrtc/': '<path d="M15.5 9.5V7a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 7v10A1.5 1.5 0 0 0 5 18.5h9a1.5 1.5 0 0 0 1.5-1.5v-2.5l5 3.5v-11z"/>',
  'cloudflare/': '<path d="M7 18.5h10.5a3.5 3.5 0 0 0 .4-7 5.5 5.5 0 0 0-10.6-1.4A4.2 4.2 0 0 0 7 18.5z"/>',
  'ping/': '<path d="M3 12h4l2-5 3.5 10 2.5-6.5 1.5 1.5H21"/>',
  'status/': '<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M7 15l3-3.5 2.5 2 4.5-5"/>',
  'whois/': '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5.5 5.5M8.5 10.5h4M10.5 8.5v4"/>',
  'news/': '<path d="M5 4.5h11.5v15H6.5A1.5 1.5 0 0 1 5 18z"/><path d="M16.5 8.5H19v9.5a1.5 1.5 0 0 1-3 0M8 8h5.5M8 11.5h5.5M8 15h3.5"/>',
  'card/': '<rect x="3" y="5.5" width="18" height="13" rx="2"/><circle cx="8.5" cy="11" r="2"/><path d="M5.8 16c.6-1.4 1.6-2 2.7-2s2.1.6 2.7 2M14 10h4M14 13.5h3"/>',
};
function icon(p) { return `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[p] || ''}</svg>`; }

// ===== Тема (auto / light / dark) =====
(function () {
  let t = null; try { t = localStorage.getItem('theme'); } catch {}
  document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : 'dark');
})();
function cycleTheme() {
  let t = null; try { t = localStorage.getItem('theme'); } catch {}
  const next = t === 'light' ? 'dark' : 'light';
  try { localStorage.setItem('theme', next); } catch {}
  document.documentElement.setAttribute('data-theme', next);
  paintThemeBtn();
}
function paintThemeBtn() {
  let t = null; try { t = localStorage.getItem('theme'); } catch {}
  const label = t === 'light' ? '☀' : '☾';
  const title = t === 'light' ? 'Тема: светлая' : 'Тема: тёмная';
  document.querySelectorAll('.theme-btn').forEach(b => { b.textContent = label; b.title = title; b.setAttribute('aria-label', title); });
}

// Связка с основным сайтом
const NAEZA = 'https://naezasoft.ru';
const NAEZA_LINKS = [['/index.html#services', 'Услуги'], ['/cases.html', 'Кейсы'], ['/baza.html', 'Инструменты'], ['/knowledge/', 'Статьи'], ['/index.html#contact', 'Связаться']];

// ===== Шапка: <nav class="nav" id="nav"></nav> =====
// Компьютер: логотип · главные вкладки · «Ещё» · тема.
// Телефон: логотип · текущая вкладка · ☰ → сетка всех вкладок.
function renderNav() {
  const el = document.getElementById('nav'); if (!el) return;
  const here = location.pathname.replace(/index\.html$/, '');
  const pages = PAGES.map(([p, name, main]) => {
    const href = ROOT + p;
    return { p, href, name, main, active: new URL(href, location.href).pathname === here };
  });
  const cur = pages.find(x => x.active);
  const link = x => `<a href="${x.href}"${x.active ? ' class="active" aria-current="page"' : ''}>${icon(x.p)}<span>${x.name}</span></a>`;
  const more = pages.filter(x => !x.main);
  const moreActive = more.some(x => x.active);
  el.innerHTML = `
    <a class="brand" href="${NAEZA}/" title="naezasoft.ru">Naeza<span class="brand-dot"></span></a>
    <a class="brand-sub" href="${ROOT}">Проверка IP</a>
    <div class="nav-main">${pages.filter(x => x.main).map(link).join('')}
      <div class="nav-more"><button class="nav-more-btn${moreActive ? ' active' : ''}" aria-expanded="false" aria-haspopup="true">${moreActive ? cur.name : 'Ещё'} <span class="caret">▾</span></button>
        <div class="nav-more-menu">${more.map(link).join('')}</div></div>
    </div>
    <span class="nav-cur">${cur ? icon(cur.p) + cur.name : ''}</span>
    <button class="theme-btn" onclick="cycleTheme()"></button>
    <button class="nav-burger" aria-expanded="false" aria-label="Все вкладки"><span></span><span></span><span></span></button>
    <div class="nav-sheet">${pages.map(link).join('')}
      <div class="nav-site">${NAEZA_LINKS.map(([h, t]) => `<a href="${NAEZA}${h}">${t}</a>`).join('')}</div></div>`;
  const moreBtn = el.querySelector('.nav-more-btn'), moreBox = el.querySelector('.nav-more');
  const burger = el.querySelector('.nav-burger');
  const close = () => { moreBox.classList.remove('open'); el.classList.remove('sheet-open'); moreBtn.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-expanded', 'false'); };
  moreBtn.addEventListener('click', e => { e.stopPropagation(); const o = moreBox.classList.toggle('open'); moreBtn.setAttribute('aria-expanded', o); });
  burger.addEventListener('click', e => { e.stopPropagation(); const o = el.classList.toggle('sheet-open'); burger.setAttribute('aria-expanded', o); });
  document.addEventListener('click', e => { if (!e.target.closest('.nav-more-menu, .nav-sheet')) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  paintThemeBtn();
}
document.addEventListener('DOMContentLoaded', renderNav);

// ===== IP-хелперы =====
function isIPv6(ip) { return !!ip && ip.includes(':'); }
function truncateIP(ip) { return (!isIPv6(ip) || ip.length <= 20) ? ip : ip.substring(0, 18) + '...'; }
function displayIP(ip) {
  if (!ip) return 'не получен';
  return isIPv6(ip) ? `<span class="ip-mask-target" title="${ip}">${truncateIP(ip)}</span>` : `<span class="ip-mask-target">${ip}</span>`;
}
// Ссылка на нашу вкладку «Оценка IP»
function linkIP(ip) {
  if (!ip) return 'не получен';
  return `<a class="ip-link" href="${ROOT}ip/?q=${encodeURIComponent(ip)}" target="_blank" rel="noopener">${displayIP(ip)}</a>`;
}
function flagImg(cc) {
  if (!cc) return '';
  cc = cc.toLowerCase();
  return `<img class="flag" src="https://flagcdn.com/w40/${cc}.png" alt="${cc.toUpperCase()}" onerror="this.style.display='none'">`;
}
function row(label, value, extra) {
  return `<div class="risk-row"><span class="risk-label">${label}</span><span class="risk-value"${extra ? ' style="' + extra + '"' : ''}>${value}</span></div>`;
}
function boolTag(val, t, f) {
  if (val === true) return `<span class="tag tag-danger">${t || 'да'}</span>`;
  if (val === false) return `<span class="tag tag-safe">${f || 'нет'}</span>`;
  return `<span class="tag tag-neutral">неизвестно</span>`;
}
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// /cdn-cgi/trace любого сайта на Cloudflare → объект {ip, loc, colo, ...}
async function trace(url, timeout) {
  const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(timeout || 5000) });
  const t = await r.text();
  return Object.fromEntries(t.trim().split('\n').map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
}
async function geoip(ip, timeout) {
  const r = await fetch(`${NC}/api/geoip/${ip}`, { signal: AbortSignal.timeout(timeout || 5000) });
  if (!r.ok) throw new Error('geoip ' + r.status);
  return r.json();  // {country, region, city, isp, country_code}
}
function geoLine(g) { return g ? [g.country, g.region, g.city, g.isp].filter(Boolean).join(' · ') : ''; }

// ===== Российский выход =====
// Аналог «китайского выхода» оригинала (ip138 / ip.cn). Публичных РФ-сервисов,
// отдающих IP чужой странице (CORS), нет — поэтому спрашиваем российский STUN:
// при раздельной маршрутизации запрос к РФ-адресу идёт напрямую и STUN видит
// домашний IP. Порядок: Яндекс Телемост → Sipnet.
const RU_STUN = ['stun:stun.rtc.yandex.net:3478', 'stun:stun.sipnet.ru:3478'];
async function stunIP(url, timeout) {
  const ips = new Set();
  try {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: url }] });
    pc.createDataChannel('');
    await pc.setLocalDescription(await pc.createOffer());
    await new Promise(res => {
      const t = setTimeout(() => { pc.close(); res(); }, timeout || 4000);
      pc.onicecandidate = e => {
        if (!e.candidate) { clearTimeout(t); pc.close(); res(); return; }
        if (!/ typ srflx/.test(e.candidate.candidate)) return;
        const m = e.candidate.candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
        if (m) ips.add(m[0]);
      };
    });
  } catch {}
  return [...ips][0] || null;
}
async function fetchRUIP() {
  for (const u of RU_STUN) {
    const ip = await stunIP(u);
    if (ip) return { ip, source: u.includes('yandex') ? 'Яндекс' : 'Sipnet' };
  }
  return null;
}

// ===== Скрыть IP: <input type="checkbox" id="ipMaskToggle"> =====
function maskIpText(t) {
  t = String(t || '').trim();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(t)) { const p = t.split('.'); return p[0] + '.' + p[1] + '.*.*'; }
  if (t.includes(':')) { const p = t.split(':'); return p[0] + ':' + p[1] + ':*'; }
  return t;
}
window.__ipMaskOn = false;
function applyAllIpMasks() {
  document.querySelectorAll('.ip-mask-target').forEach(el => {
    if (!el.dataset.realText) el.dataset.realText = el.textContent.trim();
    const want = window.__ipMaskOn ? maskIpText(el.dataset.realText) : el.dataset.realText;
    if (el.textContent !== want) el.textContent = want;
  });
}
document.addEventListener('DOMContentLoaded', () => {
  const tg = document.getElementById('ipMaskToggle');
  if (!tg) return;
  tg.addEventListener('change', e => { window.__ipMaskOn = e.target.checked; applyAllIpMasks(); });
  new MutationObserver(() => requestAnimationFrame(applyAllIpMasks)).observe(document.body, { childList: true, subtree: true });
});
