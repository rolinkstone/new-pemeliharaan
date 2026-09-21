# Aturan Keamanan Frontend (CSP & Anti-XSS)

Dokumen ini adalah aturan wajib saat menambah/mengubah kode di `frontend/`.
Tujuannya satu: **token sesi tidak boleh bisa dibaca atau dikirim keluar oleh skrip penyerang.**

## 1. Di mana token disimpan (jangan diubah tanpa alasan kuat)
- Sesi NextAuth disimpan di cookie `next-auth.session-token` — **HttpOnly** (produksi juga `Secure` +
  prefix `__Secure-`), isinya JWE terenkripsi yang memuat access/refresh/id token Keycloak.
- **JANGAN** menyimpan token di `localStorage` / `sessionStorage` / cookie non-HttpOnly.
- Access token & id token memang diteruskan ke browser lewat `GET /api/auth/session` karena dipakai
  untuk header `Authorization: Bearer` dan logout SSO. Refresh token **tidak** diteruskan.
- **JANGAN** menaruh objek `session` sebagai props `getServerSideProps`
  (`return { props: { session } }`) — nilai props ter-serialize ke `<script id="__NEXT_DATA__">`
  di HTML, sehingga token ikut bocor ke sumber halaman. Guard `getSession(context)` untuk redirect
  tetap dipakai, cukup kembalikan `return { props: {} }`.

## 2. Anti-XSS di kode React (wajib)
- **JANGAN** pakai `dangerouslySetInnerHTML`. Saat ini tidak ada satu pun di repo — pertahankan itu.
- Semua data dirender lewat JSX (`{value}`) → React otomatis meng-escape. Jangan "membuat HTML
  sendiri" kalau bisa pakai JSX.
- **Membuat HTML sendiri (string) = titik RAWAN.** Kalau terpaksa (mis. jendela cetak via
  `window.open` + `document.write`), WAJIB bungkus setiap nilai dinamis dengan escape manual:
  ```js
  const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // ${escapeHtml(r.nama_barang)}
  ```
  Contoh penerapan: `utils/cetakLaporanRusak.js`, `utils/cetakSPBSBBK.js`.
  `utils/printUtils.js` **tidak dipakai** (dead code, masih tanpa escaping) — jangan dipakai
  sebelum di-escape.
- **JANGAN** mengirim nilai dari input/DB ke `eval`, `new Function`, `setTimeout(string)`,
  `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write` mentah-mentah.
- URL dinamis (`href`/`src`) hanya dari nilai internal/terverifikasi. Kalau nanti ada input bebas
  berupa URL, saring dulu: hanya izinkan `http:`, `https:`, atau path relatif (`/uploads/...`) —
  tolak `javascript:`, `data:text/html`, `vbscript:`.
- Nilai yang masuk `<a href>` / `<img src>` saat ini berasal dari hasil upload (URL dibuat server),
  bukan teks bebas pengguna. Jangan diubah menjadi input teks bebas.

## 3. CSP yang aktif
Dipasang di `next.config.mjs` (`headers()`), berlaku untuk semua path (`/:path*`):

| Directive | Nilai | Kenapa |
|---|---|---|
| `default-src` | `'self'` | dasar paling ketat |
| `script-src` | `'self'` `'unsafe-inline'` `cdnjs.cloudflare.com` (+`'unsafe-eval'` hanya dev) | skrip hanya dari aplikasi sendiri; cdnjs untuk QR di jendela cetak |
| `style-src` | `'self'` `'unsafe-inline'` `fonts.googleapis.com` | MUI/emotion + styled-jsx menyuntik `<style>` |
| `font-src` | `'self'` `data:` `fonts.gstatic.com` | font Inter dari Google Fonts |
| `img-src` | `'self'` `data:` `blob:` + origin API/Talawang | foto kerusakan, QR, TTD |
| `connect-src` | `'self'` + origin API/Talawang + Keycloak (+`ws:` dev) | **jalur exfiltrasi token via fetch diblokir** |
| `frame-ancestors` / `X-Frame-Options` | `'none'` / `DENY` | anti clickjacking |
| `object-src`, `frame-src` | `'none'` | tidak ada embed |
| `base-uri` | `'self'` | cegah pembajakan `<base>` |
| `form-action` | `'self'` + origin Keycloak | data tidak bisa dioper lewat form |

Header tambahan: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy` (kamera/mik/lokasi dimatikan), `Cross-Origin-Opener-Policy: same-origin-allow-popups`,
dan `Strict-Transport-Security` (hanya produksi).

Catatan penting: `script-src 'unsafe-inline'` **masih ada** karena jendela cetak memakai atribut inline
(mis. `onerror` pada gambar TTD). Selama itu ada, injeksi HTML masih bisa *dieksekusi*; yang sudah
tertutup adalah jalur **pengiriman data ke luar** (`connect-src`/`img-src`/`form-action`).
Kalau cetak direfaktor tanpa handler inline + tanpa CDN, `'unsafe-inline'` bisa dibuang
(opsi lanjutan: CSP berbasis nonce + `'strict-dynamic'`).

Kalau menambah layanan/domain baru (mis. origin API lain, CDN, font), **tambahkan hostnya ke
daftar putih** di `next.config.mjs` — dan pastikan hanya host yang benar-benar diperlukan.

## 4. File upload
- Backend hanya menerima gambar `jpeg/jpg/png/gif/webp`. **SVG ditolak** (bisa memuat `<script>`
  → stored XSS bila dibuka langsung).
- `/uploads/:filename` menolak path traversal dan mengirim `nosniff` + CSP ketat supaya file
  yang disamarkan (HTML/SVG) tidak dieksekusi sebagai dokumen di origin API.
- Filter tipe file harus berupa **daftar putih**, jangan `mimetype.startsWith('image/')`.

## 5. Endpoint debug
Jangan menyimpan endpoint `*-test.js`, `check-env`, `clear-cookies`, atau apa pun yang
mengembalikan `req.headers.cookie`, isi env, atau data diagnostik. Tiga endpoint seperti itu pernah
ada di `pages/api/` dan sudah dihapus (satu di antaranya mengembalikan cookie sesi ke JavaScript
sehingga proteksi HttpOnly jadi sia-sia). Sisir ulang `frontend/pages/api/**` bila audit keamanan.

## 6. Cara menguji tanpa kredensial asli
Bikin cookie sesi sendiri untuk memeriksa HTML/header (secret dibaca lokal oleh skrip, jangan
pernah ditulis di chat/log):
```js
const jwtLib = require('frontend/node_modules/next-auth/jwt');
const jwe = await jwtLib.encode({ token: { sub, name, roles, accessToken: 'MARKER-UJI' }, secret, maxAge: 3600 });
await fetch('http://localhost:3003/picruangan', { headers: { Cookie: `next-auth.session-token=${jwe}` } });
```
Lalu pastikan `MARKER-UJI` **tidak** muncul di HTML. Cek juga header CSP ikut terkirim:
`Invoke-WebRequest http://localhost:3003/login` → lihat header `Content-Security-Policy`.
