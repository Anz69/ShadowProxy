# Интернационализация (i18n)

## Структура переводов

Переводы находятся в папке `src/translates/`:


```
translates/
├── ru.json      # Русский (по умолчанию)
├── en.json      # Английский
└── zh-CN.json   # Китайский (упрощенный)
```

## Структура JSON файлов

Все файлы переводов должны иметь одинаковую структуру ключей:
- `common` - общие элементы
- `header` - шапка сайта
- `footer` - подвал сайта
- `main` - главная страница
- `dashboard` - личный кабинет
- `auth` - страницы авторизации
- `payment` - страница пополнения
- `api` - страница API
- `referral` - реферальная система

## Использование HTML в переводах

В переводах можно использовать HTML теги, но **без классов**:

```json
{
  "main": {
    "hero": {
      "title": "<span>ShadowProxy</span> — надежные прокси"
    }
  }
}
```

## Определение языка

Язык определяется **только по URL**:
- Если нет префикса в URL → русский (по умолчанию)
- `/en/*` → английский
- `/zh/*` → китайский (zh-CN)
- Если указан несуществующий язык → 404

**Поддерживаемые языки:** `ru`, `en`, `zh-CN`

## Использование в Server Components

```tsx
import { getT } from "@/shared/server/getT"
import { getLocalizedLink } from "@/shared/server/getLocalizedLink"

export default async function Page() {
  const T = await getT()
  const link = await getLocalizedLink("/api")
  
  return (
    <>
      <h1>{T("main.hero.title")}</h1>
      <Link href={link}>API</Link>
    </>
  )
}
```

## Использование в Client Components

```tsx
"use client"
import { usePathname } from "next/navigation"
import { getLocaleFromPath, addLocaleToPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"

export default function Component() {
  const pathname = usePathname()
  const locale = getLocaleFromPath(pathname)
  const getLocalizedLink = (path: string) => addLocaleToPath(path, locale)
  
  return <h1>{t("main.hero.title", locale)}</h1>
}
```

## Добавление новых переводов

1. Добавьте ключ во **все** файлы переводов (`ru.json`, `en.json`, `zh-CN.json`)
2. Используйте одинаковую структуру ключей
3. Если ключ отсутствует, будет использован русский (fallback)

## Добавление нового языка

При добавлении нового языка необходимо обновить следующие места:

### 1. Файлы переводов
- Создайте новый файл `src/translates/{locale}.json` (например, `de.json` для немецкого)
- Скопируйте структуру из `ru.json` и переведите все ключи

### 2. `src/shared/utils/i18n.ts`
- Добавьте импорт нового файла перевода
- Добавьте в объект `translations`: `de: deJson`
- Добавьте в массив `supportedLocales`: `"de"`

### 3. `src/middleware.ts`
- Обновите проверку валидности локали (строки 22-25), добавив новый язык:
```typescript
const isSupported = firstSegment === "ru" || 
                    firstSegment === "en" || 
                    firstSegment === "zh" || 
                    firstSegment === "zh-CN" ||
                    firstSegment === "de"  // новый язык
```

### 4. `src/app/layout.tsx`
- Добавьте hreflang тег для нового языка (строки 56-58):
```typescript
const deUrl = `${baseUrl}${addLocaleToPath(pathWithoutLocale, "de")}`
// ...
<link rel="alternate" hrefLang="de" href={deUrl} />
```

### 5. `src/shared/components/widgets/Header/Header.tsx`
- **Десктопная версия** (строки 122-161): добавьте кнопку переключения языка
- **Мобильная версия** (строки 340-381): добавьте кнопку в бургер-меню
- Используйте формат: `addLocaleToPath(pathWithoutLocale, "de")`
- Добавьте текст кнопки (например, "DE" для немецкого)
- Добавьте проверку активного языка: `currentLocale === "de"`

### 6. `src/shared/utils/getLocaleFromPath.ts`
- Если новый язык имеет особую обработку (как `zh-CN`), добавьте проверку в функции `getLocaleFromPath` и `removeLocaleFromPath`

### 7. Проверка
- Перейдите на `/de/` (или соответствующий префикс) для проверки
- Убедитесь, что переключатель языков в Header работает
- Проверьте, что несуществующие языки возвращают 404

## Проверка переводов

Убедитесь, что:
- ✅ Все ключи присутствуют во всех файлах
- ✅ Структура ключей идентична
- ✅ HTML теги не содержат классов
