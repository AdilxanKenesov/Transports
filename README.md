# Kichik yuk uchun transport topish (BILET 006)

Kichik yukini jo'natmoqchi bo'lgan foydalanuvchiga mos qatnovni topishga yordam beradigan sayt.

## Ochish
`index.html` faylini brauzerda oching. Server va internet kerak emas (HTML + CSS + JavaScript).

## Talablar va bajarilishi
| Talab | Saytda |
|---|---|
| 1. 5 ta qatnov yo'nalishi va jo'nash vaqti bilan | Qatnov kartalari: ID, "Qayerdan → Qayerga", jo'nash vaqti |
| 2. "Barchasi", "A tumani", "B tumani", "C tumani" | Yetib borish hududi bo'yicha filtr tugmalari |
| 3. Tanlanganda so'rov shakli yo'nalish va vaqt bilan | "Tanlash" → shakl tepasida tanlangan qatnov |
| 4. Ism va yuk tavsifi majburiy | Bo'sh yoki faqat bo'shliqli qiymat rad etiladi, o'zbekcha xato chiqadi |
| 5. Tasdiq: qatnov, ism, yuk tavsifi | "So'rov yuborildi" paneli |

## Dizayn
- Qatnovlar sxemasi (metro chizmasi uslubida): tanlangan tumanga boradigan yo'llar rangli bo'lib ajraladi. Bu xarita emas, faqat qatnovlar bog'lanishi.
- Har tumanning o'z rangi: A — ko'k, B — qahrabo, C — binafsha; filtr, sxema va qatnov qatorlarida bir xil.
- Qatnovlar sana bo'yicha guruhlangan, vaqt katta raqamda, yo'nalish nuqta-chiziq ko'rinishida.
- Kompyuterda o'ng tomonda yopishqoq "Jo'natma" paneli, telefonda bitta ustun.
- Shrift: Golos Text (`fonts/` ichida, internetsiz ishlaydi).

Qo'shimcha: yuborilgan so'rovlar va tanlangan filtr brauzerda (`localStorage`) saqlanadi; telefon ekraniga moslashgan.

## Tekshirish
1. "B tumani" → faqat Y02 va Y03.
2. Y02 → "Sinovchi 01", "2 quti kitob" → tasdiqda "Viloyat markazi → B tumani" va "2 quti kitob".
3. Yuk tavsifi bo'sh yoki faqat bo'shliq → so'rov tasdiqlanmaydi.

## Chegara
Xarita, GPS, narx hisoblash, yuk sig'imi va haydovchiga haqiqiy xabar yuborish yo'q — bu sinov loyihasi.
