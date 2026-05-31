// auth: true  — площадка требует авторизации/регистрации для просмотра тендеров
// auth: 'reg' — нужна регистрация поставщика (можно смотреть без неё)

const PLATFORMS = [
  // ── Государственные порталы ──────────────────────────────────────────────
  {
    id: 'goszakup', name: 'goszakup.gov.kz', short: 'Госзакупки РК',
    group: 'gov', url: 'https://goszakup.gov.kz', tag: 'API', mock: 'etp',
    // /ru/announce — публичный список объявлений, не требует ЭЦП
    search: q => `https://goszakup.gov.kz/ru/announce?filter[nameRu]=${enc(q)}&filter[status][]=1`,
  },
  {
    id: 'zakup-sk', name: 'zakup.sk.kz', short: 'Самрук-Казына',
    group: 'gov', url: 'https://zakup.sk.kz', mock: 'etp',
    search: q => `https://zakup.sk.kz/ru/supplier/purchase/all?search=${enc(q)}`,
  },
  {
    id: 'mitwork', name: 'mitwork.kz', short: 'Мин. индустрии',
    group: 'gov', url: 'https://mitwork.kz', mock: 'etp',
    search: q => `https://mitwork.kz/ru/tender/list?search=${enc(q)}`,
  },
  {
    id: 'nadloc', name: 'nadloc.kz', short: 'Надлок',
    group: 'gov', url: 'https://nadloc.kz', mock: 'etp',
    search: q => `https://nadloc.kz/ru/purchase?search=${enc(q)}`,
  },
  {
    id: 'sk-pharmacy', name: 'sk-pharmacy.kz', short: 'СК Фармация',
    group: 'gov', url: 'https://sk-pharmacy.kz', mock: 'etp',
    search: q => `https://sk-pharmacy.kz/purchase/list?search=${enc(q)}`,
  },

  // ── Электронные торговые площадки ────────────────────────────────────────
  {
    id: 'eurasiantech', name: 'eurasiantech-tender.kz', short: 'EurasianTech',
    group: 'etp', url: 'https://eurasiantech-tender.kz', mock: 'etp',
    search: q => `https://eurasiantech-tender.kz/lots?search=${enc(q)}`,
  },
  {
    id: 'caspytender', name: 'caspytender.kz', short: 'CaspyTender',
    group: 'etp', url: 'https://caspytender.kz', mock: 'etp',
    search: q => `https://caspytender.kz/tenders?search=${enc(q)}`,
  },
  {
    id: 'zakup-besk', name: 'zakup-besk.kz', short: 'BESK',
    group: 'etp', url: 'https://zakup-besk.kz', mock: 'etp',
    search: q => `https://zakup-besk.kz/lots?search=${enc(q)}`,
  },
  {
    id: 'etbemp', name: 'etbemp.kz', short: 'ЭТП ЕМП',
    group: 'etp', url: 'https://etbemp.kz', mock: 'etp',
    search: q => `https://etbemp.kz/ru/lot/list?search=${enc(q)}`,
  },
  {
    id: 'sic', name: 'sic.kz', short: 'SIC',
    group: 'etp', url: 'https://sic.kz', mock: 'etp',
    search: q => `https://sic.kz/purchases?search=${enc(q)}`,
  },
  {
    id: 'mp', name: 'mp.kz', short: 'MP.KZ',
    group: 'etp', url: 'https://mp.kz', mock: 'etp',
    search: q => `https://mp.kz/purchase/list?search=${enc(q)}`,
  },
  {
    id: 'e-port', name: 'e-port.kz', short: 'E-Port',
    group: 'etp', url: 'https://e-port.kz', mock: 'etp',
    search: q => `https://e-port.kz/lots?search=${enc(q)}`,
  },

  // ── Корпоративные ────────────────────────────────────────────────────────
  {
    id: 'bi-group', name: 'bi.group', short: 'BI Group',
    group: 'corp', url: 'https://bi.group', mock: 'corp', auth: 'reg',
    search: q => `https://bi.group/ru/purchases?search=${enc(q)}`,
  },
  {
    id: 'astana-motors', name: 'astana-motors.kz', short: 'Astana Motors',
    group: 'corp', url: 'https://astana-motors.kz', mock: 'corp', auth: 'reg',
    search: q => `https://astana-motors.kz/procurement?search=${enc(q)}`,
  },
  {
    id: 'kazakhmys', name: 'kazakhmys.com', short: 'Kazakhmys',
    group: 'corp', url: 'https://kazakhmys.com', mock: 'corp', auth: 'reg',
    search: q => `https://kazakhmys.com/procurement/tenders?search=${enc(q)}`,
  },
  {
    id: 'erg', name: 'erg.kz', short: 'ERG',
    group: 'corp', url: 'https://erg.kz', mock: 'corp', auth: 'reg',
    search: q => `https://erg.kz/ru/procurement?search=${enc(q)}`,
  },
  {
    id: 'halyk', name: 'halykbank.kz', short: 'Halyk Bank',
    group: 'bank', url: 'https://halykbank.kz', mock: 'bank', auth: true,
    search: q => `https://halykbank.kz/ru/corporate/purchases?search=${enc(q)}`,
  },
  {
    id: 'forte', name: 'forte.kz', short: 'ForteBank',
    group: 'bank', url: 'https://forte.kz', mock: 'bank', auth: true,
    search: q => `https://forte.kz/business/tender?search=${enc(q)}`,
  },
  {
    id: 'ktk', name: 'cpc.ru', short: 'КТК',
    group: 'corp', url: 'https://cpc.ru', mock: 'corp', auth: 'reg',
    search: q => `https://cpc.ru/ru/procurement/tenders?search=${enc(q)}`,
  },
];

const GROUP_META = {
  gov:  { label: 'Гос. порталы',  color: 'var(--gov)',  bg: 'var(--gov-bg)'  },
  etp:  { label: 'ЭТП',           color: 'var(--etp)',  bg: 'var(--etp-bg)'  },
  corp: { label: 'Корпоративные', color: 'var(--corp)', bg: 'var(--corp-bg)' },
  bank: { label: 'Банки',         color: 'var(--bank)', bg: 'var(--bank-bg)' },
};

function enc(q) { return encodeURIComponent(q); }
