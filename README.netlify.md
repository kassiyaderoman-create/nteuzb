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
