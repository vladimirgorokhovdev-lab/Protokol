# Мобильное приложение (Capacitor)

Оболочка поверх текущего веб-приложения «ПротоколЪ».

## Команды

```bash
npm run cap:sync      # build + sync в ios/android
npm run cap:ios       # открыть Xcode
npm run cap:android   # открыть Android Studio
```

## Env

В `.env` / `.env.production`:

```
VITE_PUBLIC_APP_URL=https://xn--j1achabchr0f.xn--p1ai
```

На нативе все email-редиректы, инвайты и возврат ЮKassa идут на этот https-сайт (не на `capacitor://localhost`).

## Первый запуск на Mac

1. Установить **Xcode** (App Store) и согласиться с лицензией: `sudo xcodebuild -license`
2. Установить CocoaPods: `brew install cocoapods`
3. В папке `ios/App`: `pod install`
4. `npm run cap:ios` → Run на симуляторе / устройстве

## Android

1. Установить [Android Studio](https://developer.android.com/studio) + JDK 17
2. `npm run cap:android` → Sync Gradle → Run

## Deep link

Схема: `protokol://…`  
Пример после оплаты на сайте: `protokol://pricing?payment=success`

## Bundle ID

`ru.protokol.app`

## Деплой CORS

После правок в `supabase/functions/_shared/cors.ts` и `yookassa-create-payment` задеплой функции:

```bash
npm run deploy:functions:all
```

(или минимум те функции, что трогали CORS / оплату)
