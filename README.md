# Telecom Tender Assistant

Веб-приложение для поиска и мониторинга тендеров в сфере телекоммуникаций на **19 закупочных площадках Казахстана**.

## Возможности v1.5

| Функция | Описание |
|---------|----------|
| 🔍 Поиск по площадкам | Генерирует прямые ссылки на 19 площадок одним запросом |
| 🤖 AI-подбор ключевых слов | Claude API предлагает термины, КТРУ-коды и советы |
| 🏛 goszakup GraphQL | Реальные лоты прямо в ассистенте (нужен API-токен) |
| 👁 Мокап-превью | Демо-интерфейс каждой площадки в боковой панели |
| 📥 Экспорт CSV | Скачать результаты поиска в Excel/Google Sheets |
| 🕐 История поисков | Все запросы сохраняются, можно повторить в 1 клик |
| ⭐ Избранное | Сохранённые запросы для ежедневного мониторинга |
| 🔔 Уведомления | Лог действий + симуляция новых тендеров |

## Площадки

### Государственные порталы
- [goszakup.gov.kz](https://goszakup.gov.kz) — основной портал госзакупок РК `GraphQL API`
- [zakup.sk.kz](https://zakup.sk.kz) — Самрук-Казына
- [mitwork.kz](https://mitwork.kz) — Министерство индустрии
- [nadloc.kz](https://nadloc.kz)
- [sk-pharmacy.kz](https://sk-pharmacy.kz) — СК Фармация

### Электронные торговые площадки (ЭТП)
eurasiantech-tender.kz · caspytender.kz · zakup-besk.kz · etbemp.kz · sic.kz · mp.kz · e-port.kz

### Корпоративные
BI Group · Astana Motors · Kazakhmys · ERG · КТК

### Банки
Halyk Bank · ForteBank

## Быстрый старт

```bash
git clone https://github.com/seilovamirali/telecom-tender-assistant.git
cd telecom-tender-assistant
# Открыть index.html в браузере (никакой сборки не требуется)
open index.html
```

Или задеплоить на **GitHub Pages**: Settings → Pages → Source: `main` / `root`.

## Настройка API

### Claude API (AI-подбор)
1. Получить ключ на [console.anthropic.com](https://console.anthropic.com)
2. Вставить в приложении: кнопка **API ключ** (topbar) или вкладка **Настройки**

### goszakup GraphQL (реальные лоты)
1. Войти в ЛК на goszakup.gov.kz
2. Настройки → Интеграция → Получить токен
3. Вставить в приложении: Настройки → goszakup токен

## Категории тендеров

`IP VPN` `ВОЛС` `Интернет ШПД` `IP-телефония` `SIP-транк` `VSAT` `ЦОД / хостинг` `Видеонаблюдение CCTV` `MPLS / WAN` `Мобильная связь`

## Структура проекта

```
telecom-tender/
├── index.html          # HTML-разметка
├── css/
│   └── app.css         # Стили
└── js/
    ├── platforms.js    # Данные площадок и URL-шаблоны
    ├── goszakup.js     # GraphQL-интеграция goszakup
    └── app.js          # Основная логика приложения
```

## Roadmap

- [x] v1.0 — Поиск по 19 площадкам, AI-подбор, мокап-превью, избранное, уведомления
- [x] v1.5 — goszakup GraphQL, история поисков, экспорт CSV, рефакторинг
- [ ] v2.0 — Фоновый мониторинг, Web Push уведомления, email-дайджест
- [ ] v2.5 — Telegram-бот, Webhook (Slack/Teams), CRM-интеграция
- [ ] v3.0 — Аналитика: тренды, история победителей, анализ конкурентов

---

*Версия 1.5 · Май 2026*
