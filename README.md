
⚙️ Setup Instructions
Clone repository & install dependencies:

Bash

git clone https://github.com/<your-username>/naver-scraper.git
cd naver-scraper
npm install
Install Playwright Chromium:

Bash

npx playwright install chromium
Buat file .env di root direktori dengan isi berikut:

Ini, TOML

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
▶️ Run/Test Instructions
Jalankan server:

Bash

npm run dev
Output normal yang akan terlihat di konsol:

C#

[INFO] Seeding session cookies via Playwright ...
[INFO] Session cookies seeded.
[INFO] Server on :3000
Test API dengan curl:

Bash

# Contoh dengan productUrl
curl "http://localhost:3000/naver?productUrl=https://smartstore.naver.com/.../products/8768399445"
Atau lakukan load test dengan autocannon:

Bash

autocannon -c 3 -d 30 "http://localhost:3000/naver?url=<encoded-url>"
🔒 Scraper Explanation
Proyek ini menggunakan strategi fallback bertingkat untuk menghindari deteksi dan pemblokiran, memastikan keandalan scraping.

Undici (default HTTP client):

Digunakan sebagai metode utama karena kecepatannya.

Fallback Playwright Request API:

Jika permintaan awal dengan Undici diblokir (misalnya, mendapat kode status 418 atau 403), scraper akan beralih ke metode ini.

In-page fetch dengan Playwright:

Metode terkuat untuk menghindari deteksi. Permintaan dijalankan langsung dari dalam browser context, sehingga terlihat seperti permintaan natural dari Naver itu sendiri (same-origin).

Diagram Alur Fallback:

Proxy Support:

Mengimplementasikan 

rotasi IP dan Fingerprints untuk menghindari deteksi. Anda dapat mengaktifkan rotasi proxy dengan mengisi variabel 

PROXY_URLS di file .env untuk mengurangi kemungkinan blokir.

Rate Limiting & Retry:

Mengimplementasikan 

request throttling dan random delays. Menggunakan 

backoff dan jitter delay acak antar permintaan untuk meniru perilaku manusia, mencegah "banjir" permintaan yang mencurigakan.

📌 Example API Usage
1. By productUrl
Ambil data produk langsung dari URL halaman produk Naver.

Bash

curl "http://localhost:3000/naver?productUrl=https://smartstore.naver.com/.../products/8768399445"
2. By url (encoded)
Ambil data dari URL API paged-composite-cards yang sudah di-encode.

PowerShell

$inner = "https://search.shopping.naver.com/ns/v1/search/paged-composite-cards?cursor=1&pageSize=50&query=airpods"
$enc = [System.Uri]::EscapeDataString($inner)
curl.exe "http://localhost:3000/naver?url=$enc"
Response (contoh singkat):
JSON

{
  "ok": true,
  "data": {
    "paging": { "next": "cursor=2" },
    "items": [ { "id": "123", "name": "AirPods Pro", "price": 249000 }, ... ]
  }
}
☁️ Hosting
Ikuti langkah-langkah berikut untuk hosting API menggunakan ngrok agar dapat diakses publik:

Instal ngrok:

Bash

npm install -g ngrok
Jalankan API:
Pastikan server API kamu sudah berjalan dengan npm run dev di terminal pertama.

Buat tunnel ngrok:
Buka terminal baru dan jalankan perintah ini, sesuaikan dengan PORT di file .env kamu:

Bash

ngrok http 3000
Dapatkan URL:
Ngrok akan memberikan URL publik seperti https://<random-id>.ngrok.io. Gunakan URL ini untuk menguji API dari mana saja.
