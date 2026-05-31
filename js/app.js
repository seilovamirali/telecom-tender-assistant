// ─── State ───────────────────────────────────────────────────────────────────

const state = {
  activePlatforms: new Set(
    JSON.parse(localStorage.getItem('activePlatforms') || 'null') || PLATFORMS.map(p => p.id)
  ),
  savedQueries:    JSON.parse(localStorage.getItem('savedQueries')    || '[]'),
  searchHistory:   JSON.parse(localStorage.getItem('searchHistory')   || '[]'),
  notifications:   JSON.parse(localStorage.getItem('notifications')   || '[]'),
  claudeKey:       localStorage.getItem('claudeApiKey')   || '',
  goszakupToken:   localStorage.getItem('goszakupToken')  || '',
  simInterval:     null,
  currentQuery:    '',
};

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function renderSidebar() {
  const colorMap = { gov:'#16A872', etp:'#3B82F6', corp:'#F05A30', bank:'#F59E0B' };
  const el = document.getElementById('sidebar-platforms');
  el.innerHTML = ['gov', 'etp', 'corp', 'bank'].map(g => {
    const list = PLATFORMS.filter(p => p.group === g);
    if (!list.length) return '';
    const meta = GROUP_META[g];
    const color = colorMap[g];
    const items = list.map(p => `
      <div class="platform-item">
        <input type="checkbox" ${state.activePlatforms.has(p.id) ? 'checked' : ''}
          onchange="togglePlatform('${p.id}', this.checked)">
        <span class="platform-name">${p.short}</span>
        ${p.tag ? `<span class="platform-tag tag-api">${p.tag}</span>` : ''}
      </div>`).join('');
    return `
      <div class="sidebar-group">
        <div class="sidebar-group-label">
          <span class="sidebar-group-label-dot" style="background:${color}"></span>
          ${meta.label}
        </div>
        ${items}
      </div>
      <div class="sidebar-divider"></div>`;
  }).join('');
  updateActiveCount();
}

function togglePlatform(id, checked) {
  checked ? state.activePlatforms.add(id) : state.activePlatforms.delete(id);
  localStorage.setItem('activePlatforms', JSON.stringify([...state.activePlatforms]));
  updateActiveCount();
}

function toggleAllPlatforms(on) {
  PLATFORMS.forEach(p => on ? state.activePlatforms.add(p.id) : state.activePlatforms.delete(p.id));
  localStorage.setItem('activePlatforms', JSON.stringify([...state.activePlatforms]));
  renderSidebar();
}

function updateActiveCount() {
  document.getElementById('active-count').textContent = `${state.activePlatforms.size} площадок`;
}

// ─── Filters ─────────────────────────────────────────────────────────────────

function getFilters() {
  return {
    date:   document.getElementById('f-date').value,
    sum:    document.getElementById('f-sum').value,
    region: document.getElementById('f-region').value,
    ktru:   document.getElementById('f-ktru').value.trim(),
  };
}

function updateFilterStyle() {
  ['f-date', 'f-sum', 'f-region'].forEach(id => {
    document.getElementById(id).classList.toggle('active', !!document.getElementById(id).value);
  });
  document.getElementById('f-ktru').classList.toggle('active', !!document.getElementById('f-ktru').value.trim());
}

function clearFilters() {
  ['f-date', 'f-sum', 'f-region'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('f-ktru').value = '';
  updateFilterStyle();
}

function applyFiltersToUrl(url, platformId, filters) {
  if (platformId !== 'goszakup') return url;
  try {
    const u = new URL(url);
    if (filters.date) {
      const d = new Date(); d.setDate(d.getDate() - +filters.date);
      u.searchParams.set('filter[end_date_start]', d.toISOString().split('T')[0]);
    }
    if (filters.region) u.searchParams.set('filter[region_name]', filters.region);
    if (filters.ktru)   u.searchParams.set('filter[ktru]', filters.ktru);
    return u.toString();
  } catch { return url; }
}

// ─── Search ──────────────────────────────────────────────────────────────────

async function runSearch(overrideQuery) {
  const q = (overrideQuery || document.getElementById('main-input').value.trim());
  if (!q) { showToast('Введите поисковый запрос'); return; }
  if (state.activePlatforms.size === 0) { showToast('Выберите хотя бы одну площадку'); return; }

  state.currentQuery = q;
  hideEmptyHint();

  addBubble('user', escHtml(q));

  const filters = getFilters();
  const active  = PLATFORMS.filter(p => state.activePlatforms.has(p.id));
  const results = active.map(p => ({ platform: p, url: applyFiltersToUrl(p.search(q), p.id, filters) }));

  renderSearchResults(results, q, filters);
  addToHistory(q, filters);
  addNotification(`Поиск: «${q}»`, `${results.length} площадок`);

  if (!overrideQuery) {
    document.getElementById('main-input').value = '';
    autoResize(document.getElementById('main-input'));
  }

  // goszakup GraphQL inline if token available
  if (state.goszakupToken && state.activePlatforms.has('goszakup')) {
    fetchGoszakupInline(q);
  }
}

async function fetchGoszakupInline(query) {
  const container = document.getElementById('gz-inline-' + slugify(query));
  if (!container) return;

  container.innerHTML = `<div style="font-size:12px;color:var(--gray-400);padding:8px 0;display:flex;align-items:center;gap:6px;"><span class="spinner" style="border-color:var(--gov);border-top-color:transparent"></span> Загружаю лоты с goszakup…</div>`;

  try {
    const lots = await goszakupSearch(query, state.goszakupToken, 8);
    container.innerHTML = renderGoszakupLots(lots, query);
  } catch (e) {
    container.innerHTML = `<div style="font-size:12px;color:var(--danger);padding:6px 0;">⚠ goszakup API: ${escHtml(e.message)}</div>`;
  }
}

function renderSearchResults(results, query, filters) {
  const slug = slugify(query);
  const hasFilters = Object.values(filters).some(Boolean);
  const hasGZToken = !!state.goszakupToken && state.activePlatforms.has('goszakup');

  const colorMap = { gov:'#16A872', etp:'#3B82F6', corp:'#F05A30', bank:'#F59E0B' };
  const cards = results.map(({ platform: p, url }) => {
    const meta  = GROUP_META[p.group];
    const color = colorMap[p.group];
    const authBadge = p.auth === true
      ? `<span class="rc-auth-badge rc-auth-required" title="Требуется авторизация/ЭЦП">🔐 Авторизация</span>`
      : p.auth === 'reg'
      ? `<span class="rc-auth-badge rc-auth-reg" title="Нужна регистрация поставщика">📋 Регистрация</span>`
      : '';
    return `
      <div class="result-card" style="--card-accent:${color}">
        <div class="rc-group-label" style="color:${color}">
          <span class="rc-group-dot" style="background:${color}"></span>
          ${meta.label}${p.tag ? ` <span class="platform-tag tag-api" style="margin-left:2px">${p.tag}</span>` : ''}
        </div>
        <div class="rc-name">${p.name}</div>
        ${authBadge}
        <div class="rc-actions">
          <a class="rc-btn rc-btn-open" href="${url}" target="_blank">↗ Открыть</a>
          <button class="rc-btn rc-btn-preview" onclick="openDrawer('${p.id}','${escAttr(query)}')">Превью</button>
        </div>
      </div>`;
  }).join('');

  const filterNote = hasFilters
    ? `<div style="font-size:11px;color:var(--gray-400);margin-bottom:8px;">⚙ Фильтры применены. Для площадок без API — результаты могут не учитывать фильтры.</div>`
    : '';

  const html = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <span style="font-size:13px;">Найдено <b>${results.length}</b> площадок по запросу «${escHtml(query)}»</span>
      <span style="display:flex;gap:6px;align-items:center;">
        <button class="export-btn" onclick="exportCSV('${escAttr(query)}')">
          ↓ CSV
        </button>
        <button onclick="saveQuery('${escAttr(query)}')"
          style="background:none;border:none;cursor:pointer;color:var(--accent);font-size:12px;font-weight:500;">☆ Сохранить</button>
      </span>
    </div>
    ${filterNote}
    <div class="results-grid">${cards}</div>
    ${hasGZToken ? `<div id="gz-inline-${slug}" style="margin-top:12px;"></div>` : ''}
  `;

  addBubble('bot', html, false);
}

// ─── Export CSV ──────────────────────────────────────────────────────────────

function exportCSV(query) {
  const filters = getFilters();
  const active  = PLATFORMS.filter(p => state.activePlatforms.has(p.id));
  const rows = [['Площадка', 'Группа', 'URL', 'Запрос', 'Дата экспорта']];
  active.forEach(p => {
    rows.push([
      p.name,
      GROUP_META[p.group].label,
      applyFiltersToUrl(p.search(query), p.id, filters),
      query,
      new Date().toLocaleString('ru'),
    ]);
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tender-search-${Date.now()}.csv`;
  a.click();
  showToast('CSV скачан');
}

// ─── AI Suggest ──────────────────────────────────────────────────────────────

async function runAISuggest() {
  const q = document.getElementById('main-input').value.trim();
  if (!q) { showToast('Опишите нужную услугу или тип тендера'); return; }

  const key = state.claudeKey;
  if (!key) { showApiModal(); return; }

  const btn = document.getElementById('ai-btn');
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Подбор…`;

  hideEmptyHint();
  addBubble('user', `AI подбор: ${escHtml(q)}`);

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        system: 'Ты ассистент по гос.закупкам Казахстана в сфере телекоммуникаций. Верни ТОЛЬКО JSON без пояснений: {"keywords":["слово1","слово2","слово3","слово4","слово5"],"ktru":"код или пустая строка","hint":"1-2 предложения с советом"}',
        messages: [{ role: 'user', content: q }],
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${resp.status}`);
    }

    const data = await resp.json();
    const text = data.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Некорректный JSON от AI');

    const result = JSON.parse(match[0]);
    renderAIResult(result);

  } catch (e) {
    addBubble('bot', `<span style="color:var(--danger)">⚠ Ошибка AI: ${escHtml(e.message)}</span>`, false);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> AI подбор`;
  }
}

function renderAIResult(result) {
  const chips = (result.keywords || []).map(kw =>
    `<span class="ai-chip" onclick="runSearch('${escAttr(kw)}')">${escHtml(kw)}</span>`
  ).join('');

  const html = `
    <div style="font-size:13px;font-weight:600;margin-bottom:6px;">Рекомендуемые ключевые слова:</div>
    <div class="ai-chips">${chips}</div>
    ${result.ktru ? `<div class="ai-ktru">📋 КТРУ: <b>${escHtml(result.ktru)}</b></div>` : ''}
    ${result.hint ? `<div class="ai-hint">💡 ${escHtml(result.hint)}</div>` : ''}
  `;
  addBubble('bot', html, false);
}

// ─── Drawer / Mock Previews ───────────────────────────────────────────────────

function openDrawer(platformId, query) {
  const p = PLATFORMS.find(x => x.id === platformId);
  if (!p) return;
  document.getElementById('drawer-title').textContent = p.name;
  document.getElementById('drawer-open-link').href = p.search(query);
  document.getElementById('drawer-body').innerHTML = buildMock(p.mock, p, query);
  document.getElementById('drawer-overlay').classList.add('open');
  setTimeout(() => document.getElementById('drawer').classList.add('open'), 10);
}

function closeDrawer() {
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawer-overlay').classList.remove('open');
}

function buildMock(type, platform, query) {
  const q = escHtml(query);
  const meta = GROUP_META[platform.group];
  const color = meta.color.replace('var(--', '').replace(')', '');
  const colorVal = { gov:'#1D9E75', etp:'#378ADD', corp:'#D85A30', bank:'#EF9F27' }[platform.group];

  if (type === 'etp') {
    return `
      <div class="mock-label">Демо-интерфейс · Данные условные</div>
      <div class="mock-search-bar">
        <input class="mock-search-input" value="${q}" readonly>
        <button class="mock-search-btn" style="background:${colorVal}">Поиск</button>
      </div>
      <div class="mock-filters">
        <span class="mock-filter-chip">Дата ▾</span>
        <span class="mock-filter-chip">Сумма ▾</span>
        <span class="mock-filter-chip">Регион ▾</span>
        <span class="mock-filter-chip" style="background:var(--accent-light);color:var(--accent);border-color:var(--accent);">Статус: активные ✕</span>
      </div>
      <div style="font-size:11px;color:var(--gray-400);margin-bottom:8px;">Показано 3 из ~12 результатов</div>
      ${mockLotCard(q, '12 350 000', 'Астана', 'open', '15.06.2026', colorVal)}
      ${mockLotCard(q + ' (волокно)', '5 800 000', 'Алматы', 'open', '20.06.2026', colorVal)}
      ${mockLotCard('Услуги ' + q, '47 000 000', 'Шымкент', 'closed', '30.05.2026', colorVal)}
      <div class="mock-pagination">
        <span class="mock-page cur" style="background:${colorVal}">1</span>
        <span class="mock-page">2</span><span class="mock-page">3</span><span class="mock-page">…</span>
      </div>`;
  }

  if (type === 'corp') {
    return `
      <div class="mock-label">Демо-интерфейс · Данные условные</div>
      <div class="mock-search-bar">
        <input class="mock-search-input" value="${q}" readonly>
        <button class="mock-search-btn" style="background:${colorVal}">Найти</button>
      </div>
      <table class="mock-table">
        <tr><th>№</th><th>Наименование</th><th>Сумма, ₸</th><th>Дедлайн</th><th>Статус</th><th></th></tr>
        <tr>
          <td>2026-041</td><td style="max-width:110px">${q} для объектов</td>
          <td>28 500 000</td><td>15.06.26</td>
          <td><span class="mock-status status-open">Открыт</span></td>
          <td><button class="mock-submit-btn" style="background:${colorVal}">Подать</button></td>
        </tr>
        <tr>
          <td>2026-038</td><td style="max-width:110px">ТО ${q}</td>
          <td>9 200 000</td><td>25.06.26</td>
          <td><span class="mock-status status-open">Открыт</span></td>
          <td><button class="mock-submit-btn" style="background:${colorVal}">Подать</button></td>
        </tr>
        <tr>
          <td>2026-031</td><td style="max-width:110px">Модернизация ${q}</td>
          <td>65 000 000</td><td>01.05.26</td>
          <td><span class="mock-status status-closed">Завершён</span></td>
          <td>—</td>
        </tr>
      </table>
      <div style="font-size:11px;color:var(--gray-400);margin-top:8px;">* Для подачи требуется регистрация поставщика</div>`;
  }

  if (type === 'bank') {
    return `
      <div class="mock-label">Демо-интерфейс · Данные условные</div>
      <div class="mock-search-bar">
        <input class="mock-search-input" value="${q}" readonly>
        <button class="mock-search-btn" style="background:${colorVal}">Найти</button>
      </div>
      <div class="mock-bank-card">
        <div class="mock-bank-title">Закупка: ${q} для головного офиса</div>
        <div class="mock-bank-meta">
          <div>
            <div class="mock-participants">👥 3 участника · 18 700 000 ₸</div>
            <div class="mock-deadline-text">⏱ Дедлайн: 18 июня 2026</div>
          </div>
          <button class="mock-register-btn" style="background:${colorVal}">Участвовать</button>
        </div>
      </div>
      <div class="mock-bank-card">
        <div class="mock-bank-title">ТО: ${q}</div>
        <div class="mock-bank-meta">
          <div>
            <div class="mock-participants">👥 1 участник · до 5 000 000 ₸</div>
            <div class="mock-deadline-text">⏱ Дедлайн: 30 июня 2026</div>
          </div>
          <button class="mock-register-btn" style="background:${colorVal}">Участвовать</button>
        </div>
      </div>
      <div style="font-size:11px;color:var(--gray-400);padding:8px;background:var(--bank-bg);border-radius:6px;margin-top:6px;">
        ⚠️ Требуется предварительная аккредитация в системе закупок банка.
      </div>`;
  }
  return '';
}

function mockLotCard(title, sum, region, status, deadline, colorVal) {
  const cls = status === 'open' ? 'status-open' : 'status-closed';
  const label = status === 'open' ? 'Открыт' : 'Завершён';
  return `
    <div class="mock-lot">
      <div class="mock-lot-title">${title}</div>
      <div class="mock-lot-row">
        <div class="mock-lot-meta"><span>📍 ${region}</span><span>📅 до ${deadline}</span></div>
        <span class="mock-status ${cls}">${label}</span>
      </div>
      <div class="mock-lot-sum" style="color:${colorVal};margin-top:4px;">${parseInt(sum.replace(/\s/g,'')).toLocaleString('ru')} ₸</div>
    </div>`;
}

// ─── Search History ───────────────────────────────────────────────────────────

function addToHistory(query, filters) {
  state.searchHistory = state.searchHistory.filter(h => h.query !== query);
  state.searchHistory.unshift({
    id: Date.now(),
    query,
    filters,
    platforms: state.activePlatforms.size,
    at: new Date().toLocaleString('ru', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit' }),
  });
  if (state.searchHistory.length > 100) state.searchHistory.pop();
  localStorage.setItem('searchHistory', JSON.stringify(state.searchHistory));
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById('hist-list');
  const badge = document.getElementById('hist-badge');
  badge.textContent = state.searchHistory.length;
  badge.classList.toggle('show', state.searchHistory.length > 0);

  if (!state.searchHistory.length) {
    list.innerHTML = `<div class="empty-state"><p>История поисков пуста. Выполните первый поиск.</p></div>`;
    return;
  }

  list.innerHTML = state.searchHistory.map(h => {
    const isSaved = state.savedQueries.some(q => q.query === h.query);
    return `
      <div class="hist-item">
        <div style="flex:1;min-width:0;">
          <div class="hist-query" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(h.query)}</div>
          <div class="hist-meta">${h.at} · ${h.platforms} площадок</div>
        </div>
        <div class="hist-actions">
          <button class="hist-btn hist-run" onclick="repeatSearch('${escAttr(h.query)}')">▶</button>
          ${!isSaved ? `<button class="hist-btn hist-save" onclick="saveQuery('${escAttr(h.query)}')">☆</button>` : ''}
          <button class="hist-btn hist-del" onclick="deleteHistory(${h.id})">✕</button>
        </div>
      </div>`;
  }).join('');
}

function repeatSearch(query) {
  switchTab('search');
  runSearch(query);
}

function deleteHistory(id) {
  state.searchHistory = state.searchHistory.filter(h => h.id !== id);
  localStorage.setItem('searchHistory', JSON.stringify(state.searchHistory));
  renderHistory();
}

function clearHistory() {
  state.searchHistory = [];
  localStorage.setItem('searchHistory', JSON.stringify(state.searchHistory));
  renderHistory();
}

// ─── Favorites ────────────────────────────────────────────────────────────────

function saveQuery(query) {
  if (state.savedQueries.some(q => q.query === query)) { showToast('Уже в избранном'); return; }
  const filters = getFilters();
  state.savedQueries.unshift({ id: Date.now(), query, filters, createdAt: new Date().toLocaleDateString('ru') });
  localStorage.setItem('savedQueries', JSON.stringify(state.savedQueries));
  renderFavorites();
  renderHistory();
  addNotification('Запрос сохранён', `«${query}»`);
  showToast('Сохранено в избранное ☆');
}

function renderFavorites() {
  const list  = document.getElementById('fav-list');
  const badge = document.getElementById('fav-badge');
  badge.textContent = state.savedQueries.length;
  badge.classList.toggle('show', state.savedQueries.length > 0);

  if (!state.savedQueries.length) {
    list.innerHTML = `<div class="empty-state"><p>Нет сохранённых запросов. Нажмите ☆ в результатах поиска.</p></div>`;
    return;
  }

  list.innerHTML = state.savedQueries.map(q => `
    <div class="fav-item">
      <div style="flex:1;min-width:0;">
        <div class="fav-query" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(q.query)}</div>
        <div class="fav-meta">Сохранено: ${q.createdAt}</div>
      </div>
      <div class="fav-actions">
        <button class="fav-btn fav-run" onclick="repeatSearch('${escAttr(q.query)}')">▶ Поиск</button>
        <button class="fav-btn fav-del" onclick="deleteFav(${q.id})">✕</button>
      </div>
    </div>`).join('');
}

function deleteFav(id) {
  state.savedQueries = state.savedQueries.filter(q => q.id !== id);
  localStorage.setItem('savedQueries', JSON.stringify(state.savedQueries));
  renderFavorites();
}

function clearFavorites() {
  if (!confirm('Очистить все избранные запросы?')) return;
  state.savedQueries = [];
  localStorage.setItem('savedQueries', JSON.stringify(state.savedQueries));
  renderFavorites();
}

// ─── Notifications ────────────────────────────────────────────────────────────

function addNotification(title, description) {
  state.notifications.unshift({
    id: Date.now(), title, description, read: false,
    at: new Date().toLocaleTimeString('ru', { hour:'2-digit', minute:'2-digit' }),
  });
  if (state.notifications.length > 60) state.notifications.pop();
  localStorage.setItem('notifications', JSON.stringify(state.notifications));
  renderNotifications();
}

function renderNotifications() {
  const list   = document.getElementById('notif-list');
  const unread = state.notifications.filter(n => !n.read).length;
  const badge  = document.getElementById('notif-badge');
  badge.textContent = unread;
  badge.classList.toggle('show', unread > 0);
  document.getElementById('notif-dot').style.display = unread > 0 ? 'block' : 'none';

  if (!state.notifications.length) {
    list.innerHTML = `<div class="empty-state"><p>Уведомлений нет</p></div>`;
    return;
  }

  list.innerHTML = state.notifications.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}" onclick="markRead(${n.id})">
      <div class="notif-indicator ${n.read ? 'read' : ''}"></div>
      <div>
        <div class="notif-title">${escHtml(n.title)}</div>
        <div class="notif-desc">${escHtml(n.description)}</div>
        <div class="notif-time">${n.at}</div>
      </div>
    </div>`).join('');
}

function markRead(id) {
  state.notifications = state.notifications.map(n => n.id === id ? { ...n, read: true } : n);
  localStorage.setItem('notifications', JSON.stringify(state.notifications));
  renderNotifications();
}

function markAllRead() {
  state.notifications = state.notifications.map(n => ({ ...n, read: true }));
  localStorage.setItem('notifications', JSON.stringify(state.notifications));
  renderNotifications();
}

// Simulation
const SIM_SAMPLES = [
  ['Новый тендер: IP VPN', 'ЦОН Алматы — 500 Мбит · 12.5 млн ₸ · goszakup'],
  ['Новый тендер: ВОЛС', 'КазМунайГаз — прокладка 50 км · 85 млн ₸'],
  ['Дедлайн через 24 ч', 'Интернет для школ ВКО · zakup.sk.kz'],
  ['Новый тендер: VSAT', 'МинСельхоз — спутниковый интернет СНП · 34 млн ₸'],
  ['Новый тендер: SIP', 'Министерство — IP-телефония 500 номеров · 8 млн ₸'],
];

function startSimulation() {
  if (state.simInterval) return;
  state.simInterval = setInterval(() => {
    if (document.getElementById('s-simulate')?.checked) {
      const [t, d] = SIM_SAMPLES[Math.floor(Math.random() * SIM_SAMPLES.length)];
      addNotification(t, d);
    }
  }, 45000);
}

function toggleSimulation() {
  const on = document.getElementById('s-simulate')?.checked;
  if (on) startSimulation();
  else { clearInterval(state.simInterval); state.simInterval = null; }
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`panel-${name}`)?.classList.add('active');
}

// ─── API Keys / Settings ──────────────────────────────────────────────────────

function showApiModal() {
  document.getElementById('modal-api-key').value = state.claudeKey;
  document.getElementById('modal-overlay').classList.add('open');
}

function closeApiModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

function saveApiKeyFromModal() {
  const key = document.getElementById('modal-api-key').value.trim();
  if (!key) return;
  state.claudeKey = key;
  localStorage.setItem('claudeApiKey', key);
  document.getElementById('modal-key-status').className = 'key-status ok';
  document.getElementById('modal-key-status').textContent = '✓ Ключ сохранён';
  setTimeout(closeApiModal, 700);
}

function saveClaudeKeySettings() {
  const key = document.getElementById('s-claude-key').value.trim();
  if (!key) return;
  state.claudeKey = key;
  localStorage.setItem('claudeApiKey', key);
  showKeyStatus('s-claude-status', true);
}

function saveGoszakupToken() {
  const token = document.getElementById('s-gz-token').value.trim();
  state.goszakupToken = token;
  localStorage.setItem('goszakupToken', token);
  showKeyStatus('s-gz-status', !!token);
  showToast(token ? 'Токен goszakup сохранён' : 'Токен удалён');
}

function showKeyStatus(id, ok) {
  const el = document.getElementById(id);
  el.className = `key-status ${ok ? 'ok' : 'err'}`;
  el.textContent = ok ? '✓ Сохранено' : '— Не задан';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addBubble(type, html, escape = true) {
  const msgs = document.getElementById('messages');
  const row  = document.createElement('div');
  row.className = 'msg-row';
  const label = type === 'user' ? 'Вы' : 'Ассистент';
  const cls   = type === 'user' ? 'user' : (type === 'error' ? 'error' : '');
  row.innerHTML = `
    <div class="msg-label">${label}</div>
    <div class="msg-bubble ${cls}">${escape ? escHtml(html) : html}</div>`;
  msgs.appendChild(row);
  msgs.scrollTop = msgs.scrollHeight;
}

function hideEmptyHint() {
  const h = document.getElementById('empty-hint');
  if (h) h.style.display = 'none';
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function handleInputKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runSearch(); }
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escAttr(s) {
  return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
}

function slugify(s) {
  return s.replace(/[^a-zа-я0-9]/gi, '').slice(0, 20) || 'q';
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 2400);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  renderSidebar();
  renderFavorites();
  renderHistory();
  renderNotifications();
  startSimulation();

  // Restore API key displays
  if (state.claudeKey) {
    document.getElementById('s-claude-key').value = state.claudeKey;
    showKeyStatus('s-claude-status', true);
  }
  if (state.goszakupToken) {
    document.getElementById('s-gz-token').value = state.goszakupToken;
    showKeyStatus('s-gz-status', true);
  }

  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeApiModal();
  });
  document.getElementById('drawer-overlay').addEventListener('click', closeDrawer);

  setTimeout(() => addNotification('Добро пожаловать!', 'Telecom Tender Assistant v1.5 готов.'), 600);
}

document.addEventListener('DOMContentLoaded', init);
