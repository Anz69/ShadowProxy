# SPRINT 2 — Скорость генерации по тайму, пинг гейтвея, ISP USA

> Предполагается, что спринт 1 сделан (Mango на гейтвее, баланс через TrafficLog).
> Состав (ТЗ п.9): 4) оптимизация генерации по тайму (п.7.1), 5) оптимизация пинга
> гейтвея (п.7.2), 6) добавление **ISP USA** (п.3) — самый простой новый тип.

---

## 2.1. ЗАДАЧА A — Медленная генерация прокси по тайму (ТЗ п.7.1)

### Профилирование (сначала измерить, потом чинить)
Замерить тайминги шагов генерации одного BY_TIME-прокси:
1. генерация `SESSION_ID` (мелочь, не она);
2. вызов провайдера `createProxy()` (сборка upstream-строки — мелочь);
3. **запись в БД** (Prisma `proxy.create` + апдейты баланса/пакета);
4. **`NodeService.createProxy()` → `POST /add-port` на гейтвей** (сеть);
5. возможная синхронная проверка (`/test-proxy`).

Узкое место обычно — синхронные сетевые шаги (4–5) и/или транзакции БД.

### Оптимизации
- **Пул пред-сгенерённых сессий.** Заранее держать пул `SESSION_ID` (и при желании —
  «прогретых» записей на гейтвее), выдавать мгновенно. SESSION_ID = `generateRandomString(8)`,
  генерить пачкой в фоне.
- **Батч на гейтвей.** Если генерим N прокси — слать `POST /add-ports` одним запросом,
  а не N раз `/add-port`.
- **Не блокировать ответ юзеру на `/test-proxy`.** Проверку делать асинхронно/в фоне,
  прокси отдавать сразу (статус «проверяется» → «активен»).
- **Транзакции БД короче.** `createMany` вместо N×`create`; не держать долгие транзакции
  с сетевыми вызовами внутри (выносить `/add-port` за пределы транзакции БД).
- **Кэш `serverHost`** (`proxyServerService.getServerForProxy()`) — не ходить за сервером
  на каждую генерацию.

**Цель ТЗ:** генерация одного прокси ≤ 1–2с. Замерить ДО/ПОСЛЕ.

---

## 2.2. ЗАДАЧА B — Высокий пинг через гейтвей (ТЗ п.7.2)

### Профилирование
Сравнить задержку: клиент→апстрим напрямую vs клиент→гейтвей→апстrim, на разных гео.
Найти лишние хопы/ожидания в `upstream.go` (рукопожатие CONNECT, чтение заголовков).

### Что тюнить (`proxy-server-code/src/proxy-agent/`)
- **Persistent / pooled connections к апстриму.** Сейчас `ConnectUpstream` на каждый
  коннект делает новый TCP + CONNECT. Рассмотреть keep-alive/пул соединений к одному
  апстриму (особенно для HTTP).
- **`TCP_NODELAY`** на клиентском и апстрим-сокете (отключить Nagle) — снижает задержку
  мелких пакетов.
- **Буферы `io.Copy`** — использовать `io.CopyBuffer` с разумным буфером, чтобы меньше
  системных вызовов.
- **DNS-кэш апстрима** — резолвить `eu-isp.flashproxy.io` и т.п. заранее/по крону, не на
  каждый коннект (у Mango/PE уже есть `refreshResolvedHost`).
- **Размещение гейтвея** ближе к апстриму/региону; тест на нескольких гео.
- **Тюнинг ОС/сети** на сервере гейтвея (sysctl: `somaxconn`, `tcp_fin_timeout`,
  диапазон портов, file descriptors).

**Цель ТЗ:** задержка через гейтвей не больше +20–50ms к прямому соединению. Замерить на гео.

---

## 2.3. ЗАДАЧА C — Добавить тип **ISP USA** (ТЗ п.3)

Самый простой новый тип: один апстрим, одна страна (US), без мультигео.

### Параметры (из ТЗ)
| Поле | Значение |
|------|----------|
| Апстрим host | `beta.flashproxy.io` |
| Порт HTTP | `30` |
| Порт SOCKS5 | `31` |
| Upstream user | `w8z673e2dx` |
| Upstream pass | `m3tv7xgdcw` |
| Страна | `US` (фиксированная, без выбора) |
| Продажа | по ГБ |
| Ротация | BY_REQUEST / BY_TIME (1–1440 мин) |

### Формат upstream-строки (кладём в `proxy_username` для гейтвея)
- BY_REQUEST: `w8z673e2dx-country-US`
- BY_TIME:    `w8z673e2dx-country-US-time-{МИН}-session-{SESSION_ID}`
- `proxy_password` всегда `m3tv7xgdcw`.

> Напоминание: пользователь получает `serverHost:10000` + `package-…-user-…`. Строка
> выше уходит на гейтвей в `proxy_username`, гейтвей шлёт её в `beta.flashproxy.io`.

### Туч-поинты (по коду)

1. **Prisma enum** — `backend/prisma/schema/proxy.prisma` и `package.prisma`:
   добавить `ISP_USA`. Миграция: `npx prisma migrate dev --name add_isp_usa`.
2. **Провайдер** `backend/src/proxy/providers/services/isp-usa.provider.ts`:
   ```ts
   @Injectable()
   export class IspUsaProvider {
     private host = 'beta.flashproxy.io';
     private portHttp = 30; private portSocks = 31;
     private user = 'w8z673e2dx'; private pass = 'm3tv7xgdcw';
     createProxy(rotationTime?: number) {
       let username = `${this.user}-country-US`;
       if (rotationTime) {
         if (rotationTime < 1 || rotationTime > 1440) throw new BadRequestException('validation.rotation_max_1440');
         username += `-time-${rotationTime}-session-${generateRandomString(8)}`;
       }
       return { host: this.host, port: this.portHttp, username, password: this.pass };
     }
   }
   ```
   Зарегистрировать в `proxy-providers.module.ts`, заинжектить в `ProxyService`.
3. **DTO** `backend/src/proxy/dtos/issue-isp-usa-proxy.dto.ts`:
   ```ts
   export class IssueIspUsaProxyDto {
     @IsInt() @Min(1) quantity: number;
     @IsOptional() @IsEnum(ProxyRotation) rotation?: ProxyRotation;
     @IsOptional() @IsInt() @Min(1) @Max(1440) rotationInterval?: number; // лимит 1440 из ТЗ
   }
   ```
4. **Сервис** `proxy.service.ts` → `issueIspUsaProxy(dto,userId)`:
   - проверить баланс (новое поле `user.ispUsaTrafficLeft`);
   - на каждую штуку: `providerProxy = ispUsaProvider.createProxy(dto.rotationInterval)`;
   - построить клиентские креды (`buildProxyLogin` + `generatePasswordV2`), `serverHost`;
   - `proxy.create({ host/port/username/password=апстрим, userPort:10000, userLogin,
     userPassword, serverHost, type:'ISP_USA', rotation, rotationInterval, country:'US' })`;
   - `nodeService.createProxy([...], region)` → `/add-ports` (батчем).
5. **Контроллер** `proxy.controller.ts`:
   ```ts
   @Post('/issue/isp-usa') @Authorization() @HttpCode(200)
   issueIspUsa(@Body() dto: IssueIspUsaProxyDto, @User('id') uid: string){ return this.proxyService.issueIspUsaProxy(dto, uid); }
   ```
6. **Баланс** — `prisma/schema/user.prisma`: `ispUsaTrafficLeft String @default("0")`;
   `user.service.ts` `@OnEvent('user.distribute_traffic')` — обработать `ISP_USA`
   (прибавить ГБ к балансу + `createPackageIfNotExists('ISP_USA', traffic, userId)`).
7. **Покупка** — пакет `ISP_USA` создаётся как все «обычные» (без вызова API апстрима,
   баланс в нашей БД — уже обеспечено логикой спринта 1).
8. **Фронт** `frontend/` — добавить тип в список, форму генерации (кол-во, ротация,
   время с валидацией ≤1440). Гео скрыто/фиксировано (US).

### Валидация
- `rotationInterval` 1–1440; >1440 → ошибка `validation.rotation_max_1440` (RU/EN в i18n).

**Acceptance:** покупка ГБ-пакета ISP USA → генерация прокси → коннект через
`serverHost:10000` реально выходит через `beta.flashproxy.io` (US); трафик считается
на гейтвее; BY_TIME с session работает; >1440 мин даёт ошибку.

---

## 2.4. Чеклист спринта 2

- [x] Генерация по тайму: живая HTTPS-проверка вынесена в фон (прокси отдаётся сразу,
      при провале → `SUSPENDED` + блок логина). `createProxy`→сокет уже батчем. См. ниже.
- [x] Пинг гейтвея: `TCP_NODELAY` (клиент+апстрим), DNS-кэш апстрима (TTL 60с, RR), фолбэк
      на hostname при недоступном IP. См. ниже.
- [x] `ISP_USA` добавлен: enum, провайдер, сервис (через `generatePackageProxy`), баланс-поле, фронт.
- [x] Валидация времени ≤1440 (`validation.rotation_max_1440`).
- [ ] Метрики ДО/ПОСЛЕ — снять на живом окружении (локально нет gateway/Go-тулчейна).

---

## 2.5. Что реализовано (Sprint 2)

### A. Скорость генерации (п.7.1)
- `backend/src/package/package.service.ts` → `generatePackageProxy`: порядок изменён —
  запись прокси в БД и ответ пользователю идут ДО `verifyIssuedProxyWorks`. Проверка
  уходит в фон (`void (async () => …)`): при неудаче `proxy.status = SUSPENDED` и
  `blockLoginOnServer`. Это убирает из ответа самый долгий шаг (реальный HTTPS через прокси).
- `NodeService.createProxy` уже отправляет массив прокси одним событием `create_proxy`
  (батч), отдельной доработки батча не потребовалось.

### B. Пинг гейтвея (п.7.2) — `proxy-server-code/src/proxy-agent/`
- `upstream.go`: `TCP_NODELAY` на апстрим-сокете (`tuneConn`); DNS-кэш `resolveUpstreamHost`
  (TTL 60с, round-robin по A/AAAA) вместо резолва на каждый коннект; при ошибке dial по
  кэш-IP — фолбэк на dial по hostname (сохраняет dual-stack/перебор адресов).
- `http_connect_handler.go`, `socks5_handler.go`: `TCP_NODELAY` на клиентском сокете.
- `io.Copy` оставлен как есть — он уже выбирает оптимальный `ReadFrom`/`WriteTo` (splice).

> Деплой Go-гейтвея — отдельно на прокси-серверы (пересборка бинаря), не через основной
> docker compose. Замеры latency ДО/ПОСЛЕ на разных гео снять на живых серверах.

→ Дальше: **SPRINT-3.md** (ISP EU + мультигео, Residential Lite).
