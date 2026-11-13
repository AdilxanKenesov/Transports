# Kichik yuk uchun transport topish (BILET 006)

Kichik yukini jo'natmoqchi bo'lgan foydalanuvchiga mos qatnovni topishga yordam beradigan sayt.

## Ochish
`index.html` faylini brauzerda oching. Server va internet kerak emas (HTML + CSS + JavaScript).

## Ekranlar
Sayt bir nechta ekranga bo'lingan (manzil satridagi `#/...` orqali, brauzerning "orqaga" tugmasi ishlaydi):
1. **Bosh sahifa** — sarlavha, yaqin qatnovlar tablosi, uch qadam.
2. **Qatnovlar** — hudud bo'yicha filtr va 5 ta qatnov.
3. **So'rov** — tanlangan qatnov chiptasi va shakl.
4. **Tasdiq** — yuborilgan so'rov ma'lumotlari.
5. **So'rovlarim** — brauzerda saqlangan so'rovlar.

## Talablar va bajarilishi
| Talab | Saytda |
|---|---|
| 1. 5 ta qatnov yo'nalishi va jo'nash vaqti bilan | "Qatnovlar" ekranidagi kartalar: vaqt, "Qayerdan → Qayerga", qatnov ID |
| 2. "Barchasi", "A tumani", "B tumani", "C tumani" | Yetib borish hududi bo'yicha filtr tugmalari |
| 3. Tanlanganda so'rov shakli yo'nalish va vaqt bilan | "Tanlash" → "So'rov" ekrani: chiptada yo'nalish, sana va vaqt |
| 4. Ism va yuk tavsifi majburiy | Bo'sh yoki faqat bo'shliqli qiymat rad etiladi, xato xabari chiqadi |
| 5. Tasdiq: qatnov, ism, yuk tavsifi | "So'rov yuborildi" ekrani |

## Tillar
O'zbekcha (asosiy), ruscha, inglizcha — yuqoridagi UZ / RU / EN tugmalari. Tanlangan til brauzerda saqlanadi. Matnlar `i18n.js` faylida.

## Dizayn va animatsiyalar
- To'q premium uslub: qora-ko'k fon, sekin suzadigan rangli yog'du, shisha (glass) kartalar, neon chiziqlar.
- Har tumanning o'z rangi: A — moviy, B — qahrabo, C — binafsha (filtr, kartalar, chipta va tabloda bir xil).
- Kirishda splash: 3D aylanuvchi yuk qutisi (~2,5 soniya; bosish yoki klavish bilan o'tkaziladi; bir seansda bir marta chiqadi).
- Bosh sahifada "Yaqin qatnovlar" tablosi (yurib turadigan lenta) va uch qadam.
- Qatnov → Yuk → Tasdiq qadamlar ko'rsatkichi.
- Ekranlar orasida silliq o'tish (View Transitions): tanlangan karta so'rov ekranidagi chiptaga aylanadi; filtr almashganda kartalar o'z joyiga siljiydi.
- Kartada sichqoncha ostida yorug'lik dog'i va yo'l bo'ylab yuguradigan nur; tasdiqda chizilib chiqadigan belgi.
- "Kamroq harakat" sozlamasi yoqilgan qurilmalarda barcha animatsiyalar o'chadi.
- Surat faqat bosh sahifada: "Highway light trails at night" — Jamie Street, Wikimedia Commons, CC0 (sayt pastida havola bilan ko'rsatilgan).
- Shriftlar: Unbounded (sarlavhalar) va Onest (matn), lotin va kirill (`fonts/` ichida, internetsiz ishlaydi).

Qo'shimcha: yuborilgan so'rovlar, tanlangan filtr va til brauzerda (`localStorage`) saqlanadi; telefon ekraniga moslashgan.

## Tekshirish
1. "Qatnovlar" → "B tumani" → faqat Y02 va Y03.
2. Y02 → "Sinovchi 01", "2 quti kitob" → tasdiqda "Viloyat markazi → B tumani" va "2 quti kitob".
3. Yuk tavsifi bo'sh yoki faqat bo'shliq → so'rov tasdiqlanmaydi.

## Chegara
Xarita, GPS, narx hisoblash, yuk sig'imi va haydovchiga haqiqiy xabar yuborish yo'q — bu sinov loyihasi.
