# YPX xodimi — o‘zbekcha mobil o‘yin

Siz yo‘l patrul xizmati (YPX) inspektorisiz. Yo‘lni kuzatib, qoidabuzar mashinaga bosing,
so‘ng qanday qoida buzilganini tanlang.

## Darajalar
1. Tezlikni oshirish (belgidagi chegara va mashina ustidagi radar raqami)
2. + Rul ortida telefonda gaplashish 📱
3. + Xavfsizlik kamarini taqmaslik 🔓
4. + Svetoforning qizil chirog‘iga o‘tish 🚦
5. + Tezlik chegarasi o‘zgarib turadi; keyin harakat tezlashadi

Qoidani buzmagan haydovchini to‘xtatish yoki qoidabuzarni o‘tkazib yuborish — bitta yurak (jami 3 ta).

## Tuzilishi
- `web/index.html` — o‘yinning o‘zi (HTML5 canvas, internetsiz ishlaydi). Brauzerda ochib sinash mumkin.
- `android/` — o‘yinni WebView ichida ochadigan Android ilova.

## APK olish
GitHub → **Actions** → **YPX xodimi APK** → oxirgi muvaffaqiyatli ishga tushirish →
**Artifacts** bo‘limidan `ypx-xodimi-apk` ni yuklab oling (ichida `ypx-xodimi.apk`).
Telefonda "Noma’lum manbalardan o‘rnatish"ga ruxsat bering va o‘rnating.

Lokal yig‘ish (Android SDK kerak): `cd android && gradle assembleRelease`.

APK debug kalit bilan imzolangan — Play Marketga joylash uchun o‘z keystore'ingiz bilan imzolang.
