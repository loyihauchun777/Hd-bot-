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

## Ko‘chadagi mashinalarni qo‘shish
1. Rasm generatorida mashinaning 2x2 chizmasini oling: chap-yuqorida yon ko‘rinish (chapga qaragan),
   o‘ng-yuqorida tepadan (old tomoni chapda), chap-pastda old, o‘ng-pastda orqa; fon to‘liq magenta (#FF00FF), mashina oq.
2. `python3 tools/buildciv.py rasm.png nexia3 "Chevrolet Nexia 3" 4.30 1.70` (uzunlik va kenglik metrda).
3. `python3 tools/civindex.py` — `web3d/js/civdata.js` yangilanadi, mashina yo‘lda paydo bo‘ladi.

## Tayyor 3D modellar (.glb)
Juda og‘ir modellarni (`tools/slim.mjs`) bilan yengillashtiring: salon, tormoz, mayda detallar olib tashlanadi,
sirt soddalashtiriladi. Keyin `web3d/models/` ga qo‘yib, `web3d/js/glbcar.js` dagi `GLB_MODELS` ro‘yxatiga qo‘shing.
Litsenziya talab qilsa, muallifni «Qanday o‘ynash» oynasidagi mualliflar qatoriga yozing.

Mualliflar (3D modellar, CC BY 4.0, o‘yin uchun soddalashtirilgan):
- «Nexia 2» — uzb_rx7, https://sketchfab.com/3d-models/nexia-2-7356a1413a384f7f8290ddfbdee11a7f
- «Chevrolet Malibu 2022» — slavanik24250794, https://sketchfab.com/3d-models/chevrolet-malibu-2022-a155e069dbf84db0b3454ba313d0e79f
- «Chevrolet Damas» — own.guest, https://sketchfab.com/3d-models/chevrolet-damas-70f8556e4b3840e7b975f0e000b54757
- «Chevrolet Nexia3 Midnight» — doniyorgroup, https://sketchfab.com/3d-models/chevrolet-nexia3-midnight-94522839a89a468f9cf422724ab7270c

Egasining litsenziyasi asosida (Sketchfab Standard): «Daewoo Matiz» — nyranarod; «Chevrolet Spark» — Q.SARDOR.
«Chevrolet Tracker» — egasi taqdim etgan model.

Slim: `node tools/slim.mjs in.glb out.glb '{"ratio":0.2,"error":0.01,"dropMat":"leather"}'` (keepUV/tex — teksturali modellar uchun).
