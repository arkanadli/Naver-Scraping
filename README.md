# 🛒 Naver Scraper

Scraper sederhana untuk **Naver Shopping API** menggunakan Node.js + TypeScript. Dilengkapi strategi evasion agar bisa tetap jalan walau ada anti-bot.

---

## ⚙️ Setup Instructions

### 1. Clone repository & install dependencies

```bash
git clone https://github.com/<your-username>/naver-scraper.git
cd naver-scraper
npm install
```

### 2. Install Playwright Chromium

```bash
npx playwright install chromium
```

### 3. Buat file `.env`

Buat file `.env` di root direktori dengan isi berikut:

```env
PORT=3000

# Rate limiting
MAX_CONCURRENCY=2
MIN_DELAY_MS=150
MAX_DELAY_MS=350
RETRY=1

# Proxy (opsional)
PROXY_ENABLED=false
PW_USE_PROXY=false
# PROXY_URLS=http://user:pass@host:port
```

---

## ▶️ Run/Test Instructions

### 1. Jalankan server

```bash
npm run dev
```

Output normal yang akan terlihat di konsol:

```
[INFO] Seeding session cookies via Playwright ...
[INFO] Session cookies seeded.
[INFO] Server on :3000
```

### 2. Test API dengan `curl`

```bash
# Contoh dengan productUrl
curl "http://localhost:3000/naver?productUrl=https://smartstore.naver.com/.../products/8768399445"
```

### 3. Load test dengan `autocannon`

```bash
autocannon -c 3 -d 30 "http://localhost:3000/naver?url=<encoded-url>"
```

---

## 🔒 Scraper Explanation

Proyek ini menggunakan strategi **fallback** bertingkat untuk menghindari deteksi dan pemblokiran, memastikan keandalan scraping.

### Strategi Fallback

1. **🚀 Undici (default HTTP client)**
   - Digunakan sebagai metode utama karena kecepatannya

2. **🔄 Fallback Playwright Request API**
   - Jika permintaan awal dengan Undici diblokir (status 418 atau 403), scraper beralih ke metode ini

3. **🎭 In-page fetch dengan Playwright**
   - Metode terkuat untuk menghindari deteksi
   - Permintaan dijalankan dari dalam browser context
   - Terlihat seperti permintaan natural dari Naver (same-origin)

### Diagram Alur Fallback

```
Undici Request
      ↓
   Berhasil? ────────────→ Return Data
      ↓ Tidak
Playwright Request API
      ↓
   Berhasil? ────────────→ Return Data
      ↓ Tidak
In-page Fetch (Playwright)
      ↓
   Return Data
```

### 🌐 Proxy Support

- Mengimplementasikan **rotasi IP** dan **Fingerprints** untuk menghindari deteksi
- Aktifkan dengan mengisi `PROXY_URLS` di file `.env`
- Mengurangi kemungkinan pemblokiran IP

### ⏱️ Rate Limiting & Retry

- **Request throttling** dengan **random delays**
- **Backoff** dan **jitter delay** acak antar permintaan
- Meniru perilaku manusia untuk mencegah deteksi bot

---

## 📌 Example API Usage

### 1. By `productUrl`

Ambil data produk langsung dari URL halaman produk Naver:

```bash
curl "http://localhost:3000/naver?productUrl=https://smartstore.naver.com/.../products/8768399445"
```

### 2. By `url` (encoded)

Ambil data dari URL API `paged-composite-cards` yang sudah di-encode:

```powershell
$inner = "https://search.shopping.naver.com/ns/v1/search/paged-composite-cards?cursor=1&pageSize=50&query=airpods"
$enc = [System.Uri]::EscapeDataString($inner)
curl.exe "http://localhost:3000/naver?url=$enc"
```

### Response Example

```json
{
  "ok": true,
  "data": {
    "paging": { "next": "cursor=2" },
    "items": [
      {
        "id": "123",
        "name": "AirPods Pro",
        "price": 249000
      }
    ]
  }
}
```

---

## ☁️ Hosting

Ikuti langkah-langkah berikut untuk hosting API menggunakan **ngrok** agar dapat diakses publik:

### 1. Install ngrok

```bash
npm install -g ngrok
```

### 2. Jalankan API

Pastikan server API sudah berjalan dengan `npm run dev` di terminal pertama.

### 3. Buat tunnel ngrok

Buka terminal baru dan jalankan (sesuaikan dengan `PORT` di `.env`):

```bash
ngrok http 3000
```

### 4. Dapatkan URL

Ngrok akan memberikan URL publik seperti `https://<random-id>.ngrok.io`. Gunakan URL ini untuk menguji API dari mana saja.

---

## 🎯 Features

- ✅ Multiple fallback strategies untuk reliability
- ✅ Anti-bot evasion dengan browser automation  
- ✅ Rate limiting dan request throttling
- ✅ Proxy rotation support
- ✅ TypeScript untuk type safety
- ✅ Easy deployment dengan ngrok
- ✅ Comprehensive error handling

---

## 📝 License

MIT License - silakan gunakan untuk keperluan pembelajaran dan development.
