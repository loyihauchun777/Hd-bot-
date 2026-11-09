# YPX xodimi 3D — o‘zbekcha mobil o‘yin

Siz yo‘l patrul xizmati (YPX) inspektorisiz. O‘zbek shahri ko‘chasidagi postda turib, qoidabuzarlarni
jezl bilan to‘xtatasiz, hujjatlarni tekshirasiz va qaror chiqarasiz.

## Boshqaruv (telefon gorizontal holatda)
- Chap tomon — joystik (yurish). O‘ng tomonni surish — kamerani burish.
- **Hushtak** — sariq strelka belgilagan mashinani to‘xtatish.
- **Gaplashish** — to‘xtatilgan mashina yonida paydo bo‘ladi.
- Kompyuterda: WASD — yurish, sichqoncha — kamera, H — hushtak, E — gaplashish.

## Tekshiruv
- 📄 Hujjatlar: guvohnoma (muddati, rasm), texpasport (raqam), sug‘urta (muddati). Diqqat: mashina qarindoshiga tegishli bo‘lishi qoidabuzarlik emas.
- 🍺 Alkotester: mast haydovchini aniqlash (chegara 0.30 ‰).
- 🔧 Ko‘zdan kechirish: singan fara, yeyilgan shina.
- 💵 Pora taklif qilinsa — rad eting (halollik bonusi). Olsangiz, ichki xavfsizlik xizmati ushlashi mumkin.
- ⚖️ Qaror: jarima / ogohlantirish / boshqarishdan chetlatish / qo‘yib yuborish.

## Rivojlanish
Unvonlar: Serjant → Leytenant → Kapitan (tajriba va obro‘ga qarab). Maoshga do‘kondan forma va patrul mashinasi olinadi.
Jarimalar va pullar — shartli o‘yin qiymatlari, haqiqiy qonun summalari emas.

## Tuzilishi
- `web3d/` — o‘yin (Three.js, internetsiz ishlaydi). `web3d/audio/<ovoz>/<id>.mp3` — o‘zbekcha ovozli dialoglar.
- `android/` — o‘yinni WebView ichida ochadigan Android ilova.

Kompyuterda sinash: `cd web3d && python3 -m http.server` → http://localhost:8000

## APK olish
GitHub → **Actions** → **YPX xodimi APK** → oxirgi muvaffaqiyatli ishga tushirish → **Artifacts** → `ypx-xodimi-apk`.
APK test kaliti bilan imzolangan; Play Market uchun o‘z keystore'ingiz bilan imzolang.
