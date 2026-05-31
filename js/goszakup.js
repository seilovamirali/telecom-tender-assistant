// goszakup.gov.kz GraphQL API integration
// Endpoint: https://ows.goszakup.gov.kz/v3/graphql
// Auth: Bearer token from personal cabinet on goszakup.gov.kz
// Note: CORS is permitted for browser requests with valid token

const GZ_ENDPOINT = 'https://ows.goszakup.gov.kz/v3/graphql';

const GZ_QUERY = `
query Search($name: String!, $limit: Int) {
  Announcement(filter: { nameRu: $name }, limit: $limit) {
    id
    numberAnno
    nameRu
    totalSum
    endDate
    publishDate
    status { nameRu }
    customer { nameRu bin }
  }
}`;

async function goszakupSearch(query, token, limit = 10) {
  const resp = await fetch(GZ_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      query: GZ_QUERY,
      variables: { name: query, limit },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`goszakup API error ${resp.status}: ${text.slice(0, 120)}`);
  }

  const json = await resp.json();
  if (json.errors) throw new Error(json.errors[0]?.message || 'GraphQL error');
  return json.data?.Announcement || [];
}

function renderGoszakupLots(lots, query) {
  if (!lots.length) {
    return `<div class="gz-results">
      <div class="gz-header">🏛 goszakup.gov.kz — реальные данные</div>
      <div style="font-size:13px;color:var(--gray-400);padding:8px 0;">По запросу «${escHtml(query)}» лотов не найдено.</div>
    </div>`;
  }

  const cards = lots.map(lot => {
    const sum = lot.totalSum ? Math.round(lot.totalSum).toLocaleString('ru') + ' ₸' : '—';
    const status = lot.status?.nameRu || '—';
    const isActive = status.toLowerCase().includes('публик') || status.toLowerCase().includes('прием');
    const statusClass = isActive ? 'gz-status-active' : 'gz-status-inactive';
    const deadline = lot.endDate ? new Date(lot.endDate).toLocaleDateString('ru') : '—';
    const link = `https://goszakup.gov.kz/ru/announcement/${lot.id}`;
    return `
      <div class="gz-lot">
        <div class="gz-lot-num">№ ${escHtml(lot.numberAnno || lot.id)}</div>
        <div class="gz-lot-name">${escHtml(lot.nameRu || '—')}</div>
        <div class="gz-lot-meta">
          <span class="gz-sum">${sum}</span>
          <span class="gz-status ${statusClass}">${escHtml(status)}</span>
          ${lot.endDate ? `<span class="gz-deadline">до ${deadline}</span>` : ''}
          <span class="gz-customer">${escHtml(lot.customer?.nameRu || '')}</span>
          <a class="gz-lot-link" href="${link}" target="_blank">Открыть →</a>
        </div>
      </div>`;
  }).join('');

  return `<div class="gz-results">
    <div class="gz-header">
      <span style="background:var(--gov-bg);color:var(--gov);padding:2px 7px;border-radius:10px;font-size:10px;">API</span>
      goszakup.gov.kz — найдено ${lots.length} лотов
    </div>
    ${cards}
  </div>`;
}
