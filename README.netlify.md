# nteuzb saytini Netlify’ga joylash

## Git orqali

1. Arxivni oching. Ichidagi fayllarni GitHub yoki boshqa Netlify qo‘llaydigan Git repozitoriyga yuklang. Repozitoriy ildizida `netlify.toml` bo‘lsin.
2. Netlify’da **Add new project → Import an existing project** orqali repozitoriyani tanlang. Build va Functions sozlamalari `netlify.toml` dan olinadi.
3. Admin paneli uchun Netlify’dagi **Environment variables** qismida `NTE_ADMIN_PASSWORD` nomli maxfiy qiymat qo‘shing. Uni **Functions** doirasida va foydalanmoqchi bo‘lgan deploy muhitida sozlang. Parol menejeri orqali kamida 24 belgili tasodifiy parol yarating. Parolni Git repozitoriyga joylamang.
4. Deploy’ni ishga tushiring. Agar o‘zgaruvchini deploy’dan keyin qo‘shgan bo‘lsangiz, yangidan deploy qiling.

## Netlify CLI orqali

Loyiha ildizida `npm ci` ni bajaring. Netlify CLI orqali hisobga kiring va loyihani tanlang yoki yangisini yarating. So‘ng `netlify deploy --build` orqali sinov nusxasini, `netlify deploy --build --prod` orqali asosiy saytni joylang. Faqat HTML papkasini Netlify Drop orqali yuklashda qidiruv, yangiliklar, promokodlar va admin panelining server funksiyasi ishlamaydi.

## Joylagandan keyin tekshirish

- Bosh sahifa qidiruvida **Adler** ni qidiring va **Yangiliklar** arxivini oching.
- Saytning HTTPS manzilida `/admin` ga o‘ting. Saytning kirish formasiga Netlify’da saqlagan parolni kiriting. Ish tugagach **Chiqish** tugmasini bosing.
- Bitta sinov promokodi qo‘shing, **Promokodlar** sahifasida ko‘ring va paneldan o‘chiring. O‘zgarishlar **Netlify Blobs** dagi `nteuzb-content` do‘konida saqlanadi.
- Maxfiy oynada `/admin` ni ochib, parolsiz panel ko‘rinmasligini tekshiring.

Yangiliklar, qo‘llanmalar, rasmlar va mavjud video havolalari arxiv ichida. Oldingi hostingning saqlash xizmati Netlify bilan ulanmagan. Ko‘chirishga tayyorlash paytida eski saytda admin orqali qo‘shilgan promokodlar, videolar, jamoa havolalari yoki missiya videolari ko‘rinmadi. Yangiliklar arxividagi 17 ta xabar loyiha tarkibida bor.

## Umumiy sahifa qismlarini tahrirlash

Yuqori menyu, pastki qism va o‘rganish menyusi `templates/` papkasida. Sahifalarga bu qismlar build vaqtida qo‘shiladi. O‘zgarishni tekshirish uchun `npm run build` ni bajaring.

## Yangiliklarni avtomatik yangilash

Production deploy’da Netlify’dagi `sync-news` funksiyasi har 30 daqiqada rasmiy NTE lentasi va ochiq `@nteuzb` Telegram kanalini tekshiradi. Yangiliklar Netlify Blobs’da saqlanadi. Manba ishlamay qolsa, uning oxirgi muvaffaqiyatli nusxasi saqlanadi. Rasmiy xabarlarda asl sarlavha ham ko‘rinadi. Telegram rasmi topilmasa, saytning muqovasi ishlatiladi.

Telegram’dagi oddiy matnli post yangiliklar sahifasiga tushadi. Jamoa ayni post ichida quyidagi tartibdan foydalansa, kontent tegishli bo‘limga ham tushadi:

**Promokod** uchun sarlavha, alohida qatorda `#promokod`, `Kod: NAMUNAKOD` va `Muddati: YYYY-MM-DD`. Sana Toshkent vaqti bo‘yicha oxirgi amal qilish kuni. Bu format faqat haqiqiy muddat ma’lum bo‘lganda ishlatiladi.

**Video** uchun sarlavha, alohida qatorda `#qollanma` va YouTube videosining havolasi.

Deploy’dan so‘ng Netlify’dagi **Functions → sync-news** sahifasida funksiyani sinov tariqasida ishga tushiring va yangiliklar lentasini tekshiring.

## Personaj va Arc katalogi

Production deploy’da `sync-catalog` har ikki soatda The Hidden Gaming Lair ro‘yxatlarini tekshiradi. Yangi yozuvlar ID bo‘yicha katalog, qisqa profil va bosh sahifa qidiruviga qo‘shiladi. Katalog qisman yuklansa, oxirgi muvaffaqiyatli ma’lumot saqlanadi. O‘zbekcha kartalar `worker/catalog-curated.json` ichida, to‘liq tarjima qilingan personaj profillari esa `dist/` ichidagi alohida sahifalarda turadi. Yangilash vazifasi ularni qayta yozmaydi.

## Profillar va banner taqvimi

- `sync-catalog-facts` har soatda navbatdagi sakkiz yozuvning manbada mavjud darajasi, elementi, raqamlari va materiallar hisoblagichi havolasini tekshiradi. Manba bermagan maydon ekranda chiqmaydi. Birinchi to‘liq aylanish o‘n soatgacha davom etadi.
- `/admin` dagi **Personaj yoki Arc profili** orqali rol, o‘zbekcha hikoya va yig‘ma tavsiyasini yozing. Ular manbadan olib kelinadigan texnik ma’lumotlardan alohida saqlanadi.
- **Banner yoki tadbir** bo‘limida rasmiy manba havolasi va Toshkent vaqtidagi sanalarni kiriting. Bosh sahifa holatni avtomatik hisoblaydi. Dastlabki 1.5 taqvimi `worker/banners.json` ichida, aynan shu nom bilan panelda yaratilgan yozuv uning o‘rnida ko‘rinadi.
