# SPRINT 3 — ISP EU (мультигео) и Residential Lite

> Делается после спринта 2 — переиспользуем тот же паттерн добавления типа
> (enum → провайдер → DTO → сервис → контроллер → баланс → фронт). Состав
> (ТЗ п.9): 7) ISP EU с мультигео (п.2), 8) Residential Lite (п.4).
> В конце — короткая памятка по заготовке IPv4/IPv6 (спринт 4, не реализуем).

---

## 3.1. ЗАДАЧА A — ISP EU с мультигео (ТЗ п.2)

Как ISP USA, но: список стран + **мультигео** (несколько стран через запятую).

### Параметры (из ТЗ)
| Поле | Значение |
|------|----------|
| Апстрим host | `eu-isp.flashproxy.io` |
| Порт HTTP | `30` |
| Порт SOCKS5 | `31` |
| Upstream user | `gedfdvfwf8` |
| Upstream pass | `o18geslcqi` |
| Страны | `GB, CA, DE, FR, AU, JP, NL, IT, ES` |
| Продажа | по ГБ |
| Ротация | BY_REQUEST / BY_TIME (1–1440 мин) |
| Особенность | **мультигео**: `country-DE,FR,NL` |

### Формат upstream-строки (в `proxy_username`)
- BY_REQUEST, одна страна: `gedfdvfwf8-country-DE`
- BY_REQUEST, мультигео:    `gedfdvfwf8-country-DE,FR,NL`
- BY_TIME:                  `gedfdvfwf8-country-{ГЕО[,ГЕО…]}-time-{МИН}-session-{SESSION_ID}`
- pass: `o18geslcqi`.

### Провайдер `isp-eu.provider.ts`
```ts
@Injectable()
export class IspEuProvider {
  private host='eu-isp.flashproxy.io'; private portHttp=30; private portSocks=31;
  private user='gedfdvfwf8'; private pass='o18geslcqi';
  static readonly COUNTRIES = ['GB','CA','DE','FR','AU','JP','NL','IT','ES'];

  createProxy(countries: string[], rotationTime?: number) {
    const geo = this.validateGeo(countries);          // ['DE','FR','NL'] → "DE,FR,NL"
    let username = `${this.user}-country-${geo}`;
    if (rotationTime) {
      if (rotationTime < 1 || rotationTime > 1440) throw new BadRequestException('validation.rotation_max_1440');
      username += `-time-${rotationTime}-session-${generateRandomString(8)}`;
    }
    return { host: this.host, port: this.portHttp, username, password: this.pass };
  }
  private validateGeo(cs: string[]): string {
    const up = cs.map(c => c.toUpperCase());
    const bad = up.filter(c => !IspEuProvider.COUNTRIES.includes(c));
    if (!up.length || bad.length) throw new BadRequestException('validation.unsupported_country');
    return up.join(',');
  }
}
```

### DTO `issue-isp-eu-proxy.dto.ts` — мультиселект
```ts
export class IssueIspEuProxyDto {
  @IsArray() @ArrayNotEmpty()
  @IsString({ each: true })
  countries: string[];                 // multi-select: ['DE','FR','NL']

  @IsInt() @Min(1) quantity: number;
  @IsOptional() @IsEnum(ProxyRotation) rotation?: ProxyRotation;
  @IsOptional() @IsInt() @Min(1) @Max(1440) rotationInterval?: number;
}
```

### Сервис / контроллер / enum / баланс — как у ISP USA
- enum `ISP_EU` (proxy.prisma + package.prisma), миграция.
- `proxy.service.ts → issueIspEuProxy(dto,userId)`: баланс `ispEuTrafficLeft`,
  `ispEuProvider.createProxy(dto.countries, dto.rotationInterval)`, клиентские креды,
  `serverHost`, `proxy.create({…, type:'ISP_EU', country: geo})`, `nodeService.createProxy(...)`.
  > `country` в БД для мультигео можно хранить как `"DE,FR,NL"`.
- контроллер `POST /issue/isp-eu`.
- баланс-поле `user.ispEuTrafficLeft`; обработать `ISP_EU` в `distribute_traffic`.
- эндпоинт со списком стран для UI (отдать `IspEuProvider.COUNTRIES`).

### Фронт — мультиселект гео
- На форме генерации ISP EU — `multi-select` стран из списка (9 шт.).
- Передавать массив `countries` в DTO.
- Валидация времени ≤1440 (как везде).

**Acceptance:** мультивыбор `DE,FR,NL` → upstream-строка `…country-DE,FR,NL…` → реально
работает через `eu-isp.flashproxy.io`; одиночный выбор тоже; BY_TIME с session; невалидная
страна / >1440 мин → ошибка.

---

## 3.2. ЗАДАЧА B — Residential Lite (ТЗ п.4)

Как ISP, но: **другие порты**, **любые страны** (без списка).

### Параметры (из ТЗ)
| Поле | Значение |
|------|----------|
| Апстрим host | `lite.flashproxy.io` |
| Порт HTTP | `6969` |
| Порт SOCKS5 | `9696` |
| Upstream user | `iqtzetcozu` |
| Upstream pass | `o1o9gpret9` |
| Страны | любые (без ограничений по списку) |
| Продажа | по ГБ |
| Ротация | BY_REQUEST / BY_TIME (1–1440 мин) |

### Формат upstream-строки (в `proxy_username`)
- BY_REQUEST: `iqtzetcozu-country-{ГЕО}`
- BY_TIME:    `iqtzetcozu-country-{ГЕО}-time-{МИН}-session-{SESSION_ID}`
- pass: `o1o9gpret9`.

### Провайдер `residential-lite.provider.ts`
```ts
@Injectable()
export class ResidentialLiteProvider {
  private host='lite.flashproxy.io'; private portHttp=6969; private portSocks=9696;
  private user='iqtzetcozu'; private pass='o1o9gpret9';

  createProxy(country: string, rotationTime?: number) {
    const geo = country.toUpperCase();                 // любая страна (валидируем формат ISO-2)
    if (!/^[A-Z]{2}$/.test(geo)) throw new BadRequestException('validation.unsupported_country');
    let username = `${this.user}-country-${geo}`;
    if (rotationTime) {
      if (rotationTime < 1 || rotationTime > 1440) throw new BadRequestException('validation.rotation_max_1440');
      username += `-time-${rotationTime}-session-${generateRandomString(8)}`;
    }
    return { host: this.host, port: this.portHttp, username, password: this.pass };
  }
}
```

> ВНИМАНИЕ к портам: у Lite апстрим-порт **6969** (HTTP) / 9696 (SOCKS5), а не 30/31.
> Этот порт идёт в `proxy_port` при `/add-port`. Пользовательский порт по-прежнему 10000
> (наш гейтвей) — не путать.

### Остальное — как у ISP USA/EU
- enum `RESIDENTIAL_LITE`, миграция.
- DTO с `country: string` (ISO-2), `quantity`, `rotation`, `rotationInterval` (≤1440).
- `proxy.service.ts → issueResidentialLiteProxy(...)`: баланс `residentialLiteTrafficLeft`,
  `proxy.create({…, type:'RESIDENTIAL_LITE', country, port: 6969 на апстриме})`,
  `nodeService.createProxy(...)` с `proxy_port: 6969`.
- контроллер `POST /issue/residential-lite`.
- баланс-поле + обработка в `distribute_traffic`.
- фронт: тип + форма (страна — свободный ISO-2/любой из всех, кол-во, ротация, время).

**Acceptance:** генерация Residential Lite на любой стране → коннект через `serverHost:10000`
выходит через `lite.flashproxy.io:6969`; трафик считается на гейтвее; BY_TIME работает.

---

## 3.3. Общее для спринта 3

- Три новых типа добавляются **одним паттерном** — вынесите общий хелпер сборки
  flashproxy-строки, чтобы не дублировать:
  ```ts
  function buildFlashUser(user: string, geo: string, rotationTime?: number) {
    let u = `${user}-country-${geo}`;
    if (rotationTime) {
      if (rotationTime < 1 || rotationTime > 1440) throw new BadRequestException('validation.rotation_max_1440');
      u += `-time-${rotationTime}-session-${generateRandomString(8)}`;
    }
    return u;
  }
  ```
- Все три — категория «обычные» (НЕ премиум), баланс и счёт через гейтвей (как спринт 1).
- ProxyEmpire (Premium Residential / Mobile) — **не трогаем**.

---

## 3.4. Памятка: IPv4 / IPv6 (спринт 4, НЕ реализуем сейчас)

ТЗ п.5 — только заложить структуру (см. `00-АРХИТЕКТУРА-И-ГЕЙТВЕЙ.md`, §0.7):
- модель `RentedIp` (family IPV4/IPV6, ip, expiresAt, autoRenew, replaceCount, status);
- крон-уведомление за 3 дня до конца аренды;
- выгрузка списка выданных IP в `.txt`;
- замена IP при бане с лимитом;
- биллинг — по IP×период, не по ГБ.
Миграцию БД можно подготовить заранее, бизнес-логику — после согласования деталей.

---

## 3.5. Чеклист спринта 3

- [ ] `ISP_EU`: enum, провайдер (мультигео + список 9 стран), DTO (массив countries),
      сервис, контроллер, баланс, фронт-мультиселект, валидация (страна, ≤1440).
- [ ] `RESIDENTIAL_LITE`: enum, провайдер (порт 6969/9696, любые страны), DTO, сервис,
      контроллер, баланс, фронт.
- [ ] Общий хелпер `buildFlashUser` (без дублей).
- [ ] (Опц.) Миграция БД под `RentedIp` для будущего IPv4/IPv6.
- [ ] Каждый тип проверен реальным коннектом через гейтвей + подсчёт трафика.
