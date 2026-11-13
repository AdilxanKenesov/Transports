# Kichik yuk uchun transport topish (BILET 006)

Kichik yukini jo'natmoqchi bo'lgan foydalanuvchiga mos qatnovni topishga yordam beradigan sayt.

## Ishga tushirish
**Backend bilan (to'liq rejim):** `node server.js` → http://localhost:3000 (Node.js 18+, qo'shimcha kutubxona kerak emas).
Admin sayti: http://localhost:3000/admin.html

**Serversiz (demo rejim):** `index.html` faylini brauzerda oching yoki GitHub Pages'dagi manzilni oching. Bu holatda hisoblar va so'rovlar faqat shu brauzerda saqlanadi.

## Tarkib
| Fayl | Vazifasi |
|---|---|
| `index.html`, `style.css`, `script.js` | Mijozlar sayti |
| `admin.html`, `admin.js` | Admin paneli — alohida sayt |
| `api.js` | Backend bilan aloqa; server bo'lmasa demo rejim |
| `i18n.js` | O'zbekcha, ruscha, inglizcha matnlar |
| `server.js` | Backend: hisoblar, sessiyalar, so'rovlar (`data/db.json`) |

## Ekranlar
1. **Kirish oynasi** — birinchi kirishda to'liq ekranli 3 slayd: sayt nima uchun kerakligi (menyudagi "Sayt haqida" qayta ochadi).
2. **Bosh sahifa** — sarlavha, yaqin qatnovlar tablosi, tumanlar bo'yicha taklif kartalari.
3. **Qatnovlar** — hudud bo'yicha filtr va 5 ta qatnov.
4. **Kirish / ro'yxatdan o'tish** — faqat so'rov yuborishga o'tilganda so'raladi; kirgach tanlangan qatnovga qaytadi. "Demo mijoz" tugmasi bir bosishda kiritadi.
5. **So'rov** — tanlangan qatnov chiptasi va shakl.
6. **Tasdiq** — yuborilgan so'rov ma'lumotlari.
7. **So'rovlarim** — har bir mijoz faqat o'z so'rovlarini va ularning holatini ko'radi.

## Backend va xavfsizlik
- Ro'yxatdan o'tish, kirish, chiqish; parollar scrypt bilan hash qilinadi; sessiya HttpOnly cookie'da.
- Har bir mijoz faqat o'z so'rovlarini oladi va o'chira oladi; admin bo'limlari faqat admin uchun.
- Admin paneli: barcha so'rovlar, holatni o'zgartirish (Yangi / Qabul qilindi / Rad etildi), o'chirish, foydalanuvchilar ro'yxati.
- Sinov hisoblari: `demo` / `demo123` (mijoz), `admin` / `admin123` (admin). Bu faqat namoyish uchun: haqiqiy ishga tushirishda `ADMIN_PASSWORD=...` va `DEMO=0` bilan ishga tushiring.

## Talablar va bajarilishi
| Talab | Saytda |
|---|---|
| 1. 5 ta qatnov yo'nalishi va jo'nash vaqti bilan | "Qatnovlar" ekranidagi kartalar: vaqt, "Qayerdan → Qayerga", qatnov ID |
| 2. "Barchasi", "A tumani", "B tumani", "C tumani" | Yetib borish hududi bo'yicha filtr tugmalari |
| 3. Tanlanganda so'rov shakli yo'nalish va vaqt bilan | "Tanlash" → (kirish) → "So'rov" ekrani: chiptada yo'nalish, sana va vaqt |
| 4. Ism va yuk tavsifi majburiy | Bo'sh yoki faqat bo'shliqli qiymat rad etiladi (saytda ham, serverda ham) |
| 5. Tasdiq: qatnov, ism, yuk tavsifi | "So'rov yuborildi" ekrani |

## Tillar
O'zbekcha (asosiy), ruscha, inglizcha — menyudagi UZ / RU / EN tugmalari. Tanlangan til saqlanadi. Joy nomlari barcha tillarda biletdagidek.

## Dizayn
- To'q fon, iliq to'q-sariq urg'u rangi, shisha kartalar; tumanlar rangi: A — ko'k, B — qahrabo, C — binafsha.
- Ekranlar orasida silliq o'tish, karta → chipta o'tishi, tablo lentasi, ikonlar.
- "Kamroq harakat" sozlamasi yoqilgan qurilmalarda animatsiyalar o'chadi.
- Suratlar (Wikimedia Commons): tungi yo'l — Jamie Street (CC0); GM Labo — Jamshid Nurkulov (CC BY-SA 4.0); Ko'hitang tog' yo'li — Panpanchik (CC BY-SA 4.0).
- Shriftlar: Unbounded va Onest (`fonts/` ichida, internetsiz ishlaydi).

## Tekshirish
1. "Qatnovlar" → "B tumani" → faqat Y02 va Y03.
2. Y02 → "Tanlash" → "Demo mijoz bo'lib kirish" → "Sinovchi 01", "2 quti kitob" → tasdiqda "Viloyat markazi → B tumani" va "2 quti kitob".
3. Yuk tavsifi bo'sh yoki faqat bo'shliq → so'rov tasdiqlanmaydi.

## Chegara
Xarita, GPS, narx hisoblash, yuk sig'imi va haydovchiga haqiqiy xabar yuborish yo'q — bu sinov loyihasi.
