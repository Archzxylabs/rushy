# Perbaikan wiring mainnet — 15 Oktober 2026

Seluruh perbaikan aplikasi dari audit sudah diterapkan dan diuji. Aktivasi
pembayaran mainnet tetap membutuhkan key operasional yang cocok dan saldo gas
relay. Tidak ada transaksi mainnet atau perubahan kontrak yang dilakukan
untuk perbaikan ini. Kontrak dan domain EIP-712 tetap memakai deployment lama.

| Temuan | Perbaikan | Bukti |
| --- | --- | --- |
| F01 — stored XSS | Nama Cup di header di-escape; CSP melarang event handler inline dan eval. Script inline bawaan memakai hash. | Payload tersimpan tampil sebagai teks di browser lain; tidak mengeksekusi JavaScript. Mobile iframe dan multiplayer tetap berjalan. |
| F02 — kesiapan operasional | Admission dipisahkan dari recovery. Cek ulang network, role signer/relay, pause dan saldo native setiap 5 detik; cek runtime Cup secara berkala. Deposit baru diblokir saat tidak siap. | Tes pause, gas 0, signer salah, chain salah dan key kosong. Container produksi membaca mainnet dengan `enabled=false`, `recoveryEnabled=true` tanpa key. |
| F03 — paid mode tidak tersambung | Pilihan free/paid, `?online=paid`, link duel/invite dan resume setelah reload dihubungkan kembali. Tombol deposit mengikuti readiness backend. | Dua browser dengan wallet berbeda: create, join, reload, dua deposit, match dan payout pemenang terverifikasi pada chain lokal. |
| F04 — label menyesatkan | Mode Arc menjadi `mainnet`, migrasi Cup lama menyimpan tx hash; label USDC/gas dibedakan dari mock. Fee 5% hanya duel, Cup tetap 70/30 penuh. | Tes migrasi dan pemeriksaan UI. Mainnet USDC ERC-20 6 decimals; native gas memakai 18 decimals. |
| F05 — receipt silang resource | Filter semua event escrow menurut ID Cup/duel sebelum memeriksa jenis, penerima, jumlah, token dan transfer. Receipt gagal ditolak. | Batch salah ID ditolak; batch sah dengan beberapa penerima tetap diterima. |
| F06 — antrean macet di 20 baris | Retry belum waktunya difilter sebelum LIMIT; posisi pemeriksaan disimpan di SQLite. Reconcile duel mencakup Cancelling dan mengisolasi kegagalan satu resource. | Job dan duel ke-21/25 tetap diperiksa, termasuk setelah DB dibuka ulang. |
| F07 — bypass rate limit / gas grief | Batas IP selalu berlaku; bucket sesi hanya memakai sesi sah. Kuota wallet dan ledger admission persisten. Budget gas/broadcast create dipisahkan dari settlement. | Rotasi bearer dan header forwarding ditolak oleh batas IP; sesi baru/restart tidak mereset kuota. Budget harian mencatat retry job lama saat retry tersebut terjadi. |

Tambahan: saat koneksi putus sesudah broadcast, job tetap `submitted` dengan
signed bytes, nonce dan hash yang sama. Server melanjutkan pemeriksaan receipt
sebelum mengklaim payout berhasil. Konfirmasi klaim langsung juga memerlukan
network yang telah lolos verifikasi. Retry tidak membuat transaksi pengganti
atau menghapus biaya yang sudah dicatat.

## Validasi

- `npm --prefix server run build:client`: berhasil; build hash browser/server cocok.
- `npm --prefix server test`: **57 lulus, 0 gagal**, termasuk 12 regresi mainnet.
- `forge test --root contracts`: **49 lulus, 0 gagal**, termasuk fuzz tests.
- `npm --prefix server audit --omit=dev`: **0 kerentanan dependency produksi**.
- Image Docker produksi berhasil dibangun dan dijalankan dengan artifact
  deployment asli; recovery mainnet dapat diverifikasi tanpa private key.
- Chromium: XSS diblokir, mobile paid entry terbuka, dua wallet menyelesaikan
  alur entry dan payout lokal; tidak ada browser error.
- `node tools/verify-mainnet.mjs`: deployment, constructor, runtime, role,
  fee dan domain cocok di block `26032396`.

[Bukti backend](../validation/mainnet-audit/backend-fixed-output.json),
[bukti receipt](../validation/mainnet-audit/receipt-fixed-output.json),
[bukti browser](../validation/mainnet-audit/browser-fixed-output.json),
[bukti container](../validation/mainnet-audit/container-fixed-output.json), dan
[verifikasi mainnet](../deployments/verification.json).

## Yang masih membutuhkan konfigurasi operator

Pada pemeriksaan terakhir sebelum deployment perbaikan, dua variable runtime
`RESULT_SIGNER_PRIVATE_KEY` dan `RELAY_PRIVATE_KEY` belum terisi di Railway,
dan saldo native relay masih 0 USDC. Isi key melalui Railway Variables,
bukan Git atau chat. Gunakan akun yang cocok dengan role kontrak; key deployer
bukan penggantinya. Panduan dan batas admission ada di
[deploy-railway.md](deploy-railway.md).

Readiness software tidak membuktikan keberhasilan transaksi uang asli.
Acceptance dua entry USDC mainnet, hasil pertandingan, transfer pemenang
1.90 USDC dan treasury 0.10 USDC belum dilakukan. Perbaikan ini bukan audit
independen atau jaminan bebas seluruh kerentanan.

## Menjalankan ulang pemeriksaan browser

Build kontrak dan browser terlebih dahulu, lalu jalankan
`node validation/mainnet-audit/local-fixture.mjs`. Fixture hanya memakai
localhost chain 31337 dengan seed publik Anvil dan database sementara.
Pada terminal lain, jalankan `python validation/mainnet-audit/browser-probe.py`
dengan Playwright dan Chromium tersedia. Matikan fixture sesudah selesai;
proses membersihkan Anvil dan database sementaranya.
