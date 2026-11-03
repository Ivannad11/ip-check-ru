// Общие хелперы для всех вкладок. Подключается первым на каждой странице:
// <script src="../common/site.js"></script> (на главной — common/site.js)

// Бэкенд оценки IP оригинала — CORS открыт: /api/geoip, /api/geoip-batch, /api/iprisk,
// /api/ip/lookup, /api/ip/related, /api/ip/pingcheck, /api/ip/portscan, /api/ping/*
const NC = 'https://ip.net.coffee';
// Корень сайта относительно текущей страницы (страницы лежат на глубине 0 или 1)
const ROOT = document.currentScript.src.replace(/common\/site\.js.*$/, '');

const PAGES = [
  ['', 'Мой IP'], ['claude/', 'Claude'], ['ip/', 'Оценка IP'], ['gpt/', 'ChatGPT'],
  ['link/', 'Доступность'], ['dns/', 'Утечка DNS'], ['webrtc/', 'WebRTC'],
  ['cloudflare/', 'Cloudflare'], ['ping/', 'Пинг'], ['status/', 'Статусы'],
  ['whois/', 'Whois'], ['news/', 'Новости'], ['card/', 'IP-карточка'],
];

// ===== Тема (auto / light / dark) =====
(function () {
  let t = null; try { t = localStorage.getItem('theme'); } catch {}
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
})();
function cycleTheme() {
  let t = null; try { t = localStorage.getItem('theme'); } catch {}
  const next = t === 'light' ? 'dark' : t === 'dark' ? 'auto' : 'light';
  try { next === 'auto' ? localStorage.removeItem('theme') : localStorage.setItem('theme', next); } catch {}
  if (next === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', next);
  paintThemeBtn();
}
function paintThemeBtn() {
  const b = document.getElementById('themeBtn'); if (!b) return;
  let t = null; try { t = localStorage.getItem('theme'); } catch {}
  b.textContent = t === 'light' ? '☀ светлая' : t === 'dark' ? '☾ тёмная' : '◐ авто';
}

// ===== Меню: <nav class="nav" id="nav"></nav> =====
function renderNav() {
  const el = document.getElementById('nav'); if (!el) return;
  const here = location.pathname.replace(/index\.html$/, '');
  el.innerHTML = PAGES.map(([p, name]) => {
    const href = ROOT + p;
    const active = new URL(href, location.href).pathname === here;
    return `<a href="${href}"${active ? ' class="active"' : ''}>${name}</a>`;
  }).join('') + '<span class="spacer"></span><button class="theme-btn" id="themeBtn" onclick="cycleTheme()"></button>';
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
