# Audit wiring Arc mainnet — 15 Oktober 2026

> Catatan historis sebelum perbaikan. Status dan bukti recheck ada di
> [perbaikan mainnet](fixes-mainnet-2026-10-15.md). Temuan di bawah
> menggambarkan commit audit, bukan status kode setelah perbaikan.

**Keputusan: belum siap mengaktifkan transaksi USDC untuk publik.** Web dan
multiplayer sudah berjalan. Kontrak mainnet terverifikasi melalui RPC, tetapi
ada masalah aplikasi dan konfigurasi yang harus diselesaikan sebelum paid mode
diaktifkan. Audit ini tidak mengubah deployment, role kontrak, atau private key.

Audit terhadap commit `2d14701587259e4e72a909bc067e02714b3f59e4`, sama dengan
`origin/main`, dan deployment Railway
`bf286ea3-2553-4a73-ad32-48f54e6e936b` di
<https://rushy.up.railway.app>. Pembacaan konfigurasi kontrak dilakukan pada
block `26029292`; saldo dibaca pada block `26029410`. Bukti lengkap tanpa
secret ada di [evidence.json](../validation/mainnet-audit/evidence.json).

| Wiring live | Nilai |
| --- | --- |
| Network | Arc mainnet, chain `5042` |
| RPC | `https://rpc.mainnet.arc.io` |
| USDC ERC-20 | `0x3600000000000000000000000000000000000000`, 6 decimals |
| PaidDuelEscrow | [`0xA6505430759EabF189b275251F72FDD357B0Abdc`](https://explorer.arc.io/address/0xA6505430759EabF189b275251F72FDD357B0Abdc) |
| HouseCupEscrow | [`0x38C8093907f6085e7c2Ad22335F3f4DA15466Efe`](https://explorer.arc.io/address/0x38C8093907f6085e7c2Ad22335F3f4DA15466Efe) |

## Temuan yang memblokir peluncuran pembayaran

### F01 — P1: nama Cup dapat menjalankan JavaScript pada browser pemain lain

Lokasi: [online/client.mjs:63](../online/client.mjs#L63),
[online/client.mjs:102](../online/client.mjs#L102), dan
[online/client.mjs:132](../online/client.mjs#L132).

`header(label)` memasukkan `label` langsung ke template HTML. `cupView()`
memanggilnya dengan `c.name` dari database, lalu `render()` menggunakan
`innerHTML`. Validasi nama di `Store.createCup()` hanya membatasi panjang.
Escaping pada judul utama tidak melindungi salinan nama di header.

**Terbukti di Chromium lokal:** nama Cup sepanjang 39 karakter berisi gambar
dengan event handler hanya menyalakan sebuah marker JavaScript. Marker menyala
ketika link Cup dibuka menggunakan browser context berbeda, tanpa wallet dan
tanpa interaksi pemain. Tidak ada payload yang dikirim ke situs produksi.

Script tersebut memperoleh kemampuan same-origin, termasuk membaca token
sesi dari `/api/session` dan menjalankan aksi sesi melalui API. Cookie HttpOnly
tidak mencegah script same-origin membaca respons endpoint itu. Ini tidak
membuktikan private key wallet dapat diambil atau transaksi wallet dapat
ditandatangani tanpa persetujuan pengguna.

**Perbaikan:** escape label di `header()` atau bangun node dengan `textContent`.
Tambahkan pengujian browser untuk nama Cup, nickname, dan pesan error. Atur CSP
yang sesuai setelah inventaris script inline; CSP menjadi pertahanan tambahan.
Perbaikan ini juga relevan untuk mode gratis yang sudah live.

### F02 — Blocker konfigurasi: key operasional belum terpasang; relay tidak punya gas

Railway mempunyai alamat kontrak, chain, RPC, origin baru, treasury, dan fee
yang sesuai. Namun kedua variabel ini **tidak ada**:

- `RESULT_SIGNER_PRIVATE_KEY`
- `RELAY_PRIVATE_KEY`

Wallet relay `0x0950E77E0c108E8442351f9cEBD9695499b5C357` mempunyai saldo
native USDC **0** saat audit. `/api/config` mengembalikan
`settlement.enabled=false` dan `paidDuel.enabled=false`. Keadaan ini sesuai
dengan pengamanan backend saat konfigurasi belum lengkap.

Key yang dipasang harus cocok dengan role onchain, bukan key deployer:

| Role | Alamat yang terverifikasi |
| --- | --- |
| Owner | `0xd52e8a92937826e9874A0B972de01Ae5FA6D6c79` |
| Result signer | `0xE3D7014A9DC4B3D1d89ACF6ECFfB713155217990` |
| Relay | `0x0950E77E0c108E8442351f9cEBD9695499b5C357` |
| Duel treasury | `0xEA2d8827B331C80649353f6f28525d10bfa44796` |

Relay bersifat immutable pada kedua kontrak. Apabila key relay lama tidak dapat
diakses, owner tidak bisa menggantinya pada deployment ini. Signer dapat
dirotasi oleh owner untuk pertandingan baru; pertandingan terkunci tetap
menggunakan signer yang lama. Owner juga membutuhkan gas untuk pause/rotasi.

**Pemeriksaan tambahan:** `Chain.initialize()` dan `PaidDuels.initialize()` belum
memeriksa saldo relay atau `paused()`. Probe RPC terisolasi membuktikan
`enabled=true` dapat muncul dengan relay bersaldo nol dan kontrak paused.
Status startup tidak cukup untuk menyatakan pembayaran siap. Tambahkan
pemeriksaan kesiapan berkala, cegah pendanaan baru ketika settlement tidak
tersedia, dan sisakan kapasitas/gas untuk menyelesaikan kewajiban yang ada.

### F03 — P1: paid duel tidak dapat dimasuki dari frontend normal

Lokasi: [online/client.mjs:48](../online/client.mjs#L48),
[online/client.mjs:55](../online/client.mjs#L55), dan
[online/client.mjs:79](../online/client.mjs#L79).

`open()` mengatur `pvpMode='casual'` dan tidak memilih paid mode untuk
`?online=paid`. Pemilih mode hanya menampilkan free 1v1. Link `?duel=...`
secara eksplisit ditolak dengan pesan bahwa paid duel lama tidak tersedia di
Rushy. Jalur ini juga tidak memuat `duelInvite`, padahal formulir join
memerlukannya. Method pembayaran ada, tetapi navigasi pemain tidak tersambung.

**Terbukti di browser lokal:** `?online=paid` menampilkan tombol room gratis,
tidak ada tombol masuk paid mode, dan link duel langsung ditolak. Branch
penolakan bersifat unconditional; menambahkan key backend tidak menyelesaikannya.

**Perbaikan:** sambungkan entry/menu paid, pemuatan duel dan invite, serta
resume setelah refresh. Tetap ikuti flag ketersediaan backend. Uji dua browser
dari pembuatan invite hingga join, pendanaan, pertandingan, dan payout.

### F04 — P1: layar pendanaan Cup menyebut uang mainnet sebagai test token dan gas MON

Lokasi: [server/chain.mjs:21](../server/chain.mjs#L21),
[server/paid-duels.mjs:40](../server/paid-duels.mjs#L40), dan
[online/client.mjs:99](../online/client.mjs#L99) sampai method `fundingView()`.

Chain non-mock masih menggunakan identifier mode `testnet`. UI Cup menyebut
`100 TEST TOKENS`, `no monetary value`, gas `MON`, dan claim test tokens.
Label report duel juga menambahkan `no monetary value` pada label mainnet.
Sebaliknya, transaksi yang dibangun mengarah ke escrow Arc chain `5042` dan
memindahkan **100 USDC asli** untuk Cup. Ini masalah informasi sebelum pengguna
menandatangani transaksi; RPC tidak diarahkan ke Monad.

**Perbaikan:** gunakan konfigurasi chain/mode yang konsisten untuk nominal,
label, explorer, dan gas. Migrasikan identifier mode tersimpan dengan hati-hati;
jangan sekadar mengganti `testnet` di satu file karena Store/API membatasi mode.
Perbaiki juga README yang menyebut kedua kontrak mempunyai fee 500 bps.
Hanya Duel yang mempunyai fee 5%; Cup membagikan 70/30 tanpa fee tambahan.

## Integritas payout, pemulihan, dan operasional

### F05 — P2: receipt payout belum dikaitkan ketat ke Cup/duel yang bersangkutan

Lokasi: [server/chain.mjs:125](../server/chain.mjs#L125) dan
[server/paid-duels.mjs:113](../server/paid-duels.mjs#L113).

`confirm()` mula-mula memastikan ada *suatu* event dengan ID yang diharapkan.
Pencarian `Paid` berikutnya menggunakan seluruh event receipt, tanpa memeriksa
`Paid.args.cupId` atau `Paid.args.duelId`. Transfer token memang diperiksa,
tetapi transfer tersebut tidak membawa ID pertandingan.

**Terbukti dengan receipt batch sintetis yang didekode menggunakan ABI
deployment:** payout Cup B ke calon penerima yang sama, kemudian payout Cup A
ke runner-up lain, membuat job hadiah pemenang Cup A ditandai `paid` meski
pemenang Cup A belum menerima hadiah Cup A. Probe duel memakai event funding A
bersama payout B dengan penerima/nominal yang cocok. Ini membuktikan
kelemahan verifier; bukan transaksi exploit mainnet. Syaratnya adalah receipt
batch yang valid dengan gabungan event tersebut. Dana kredit A tetap berada
di kontrak, tetapi ledger dan status payout dapat salah.

**Perbaikan:** filter event escrow menurut ID resource sebelum pencocokan tiap
jenis job. Cocokkan stage/hasil/award ke resource yang sama dan pastikan receipt
berhasil. Tambahkan kasus batch berisi beberapa Cup/duel dan test penolakan
receipt milik pertandingan lain.

### F06 — P2: batas 20 item dapat membuat settlement dan rekonsiliasi berikutnya terhenti

Lokasi: [server/store.mjs:135](../server/store.mjs#L135),
[server/chain.mjs:93](../server/chain.mjs#L93), dan
[server/paid-duels.mjs:92](../server/paid-duels.mjs#L92).

`Store.outbox()` selalu mengambil 20 job paling lama. Job submitted yang tidak
mendapat receipt dan tidak dijadwalkan ulang tetap menempati halaman itu.
`PaidDuels.poll()` juga hanya mengambil 20 duel tertua pada state yang dipantau,
tanpa cursor/fairness. Duel lama dalam Funding/Active dapat menghalangi
rekonsiliasi duel berikutnya sampai state lama berubah.

**Terbukti di memori lokal:** dua putaran poll mengunjungi 20 duel yang sama
dan tidak pernah mengunjungi duel ke-21. Dua putaran outbox berisi 20 submitted
tanpa receipt tidak mempersiapkan job pending ke-21. Ini masalah backlog/outage;
tes alur normal dengan sedikit pemain tidak menjangkaunya.

**Perbaikan:** jadwalkan berdasarkan waktu percobaan berikutnya, gunakan
pagination/fairness, dan pisahkan pemantauan receipt lama dari job siap jalan.
Tambahkan rekonsiliasi nonce/receipt untuk transaksi yang hilang, dengan batas
fee yang jelas, serta uji lebih dari 20 pertandingan dan simulasi RPC outage.

### F07 — P2: batas request dapat dilewati; pembuatan duel menghabiskan gas sebelum deposit

Lokasi: [server/app.mjs:29](../server/app.mjs#L29),
[server/store.mjs:50](../server/store.mjs#L50), dan
[server/paid-duels.mjs:43](../server/paid-duels.mjs#L43).

Kunci rate limit memakai isi header Authorization sebelum validasi sesi.
Pada endpoint session, header acak yang berubah menghasilkan bucket baru.
**Terbukti lokal:** header tetap mencapai HTTP 429 pada request ke-301,
sementara tiga header bearer tidak valid yang berbeda langsung mendapat 200.

Ketika paid mode kelak aktif, dua sesi dengan wallet terverifikasi dapat
meminta job `createDuel` yang membebani relay sebelum ada entry USDC. Batas
aktif per sesi mudah disiasati dengan sesi baru. Budget relay yang sudah ada
tetap membatasi estimasi reservasi hingga 2 USDC/resource dan 10 USDC/hari;
temuan ini **bukan** klaim pengeluaran tanpa batas. Pelaku dapat menghabiskan
budget bersama sehingga settlement pemain sah tertunda.

**Perbaikan:** batasi berdasarkan IP tepercaya di belakang proxy dan identitas
sesi yang sudah divalidasi, beri kuota durable per wallet/operasi, serta
pisahkan budget admission dari budget settlement/refund. Uji permintaan dari
banyak sesi dan retry berulang tanpa deposit.

## Pemeriksaan yang lulus

- Bytecode runtime kedua deployment cocok dengan artifact asli setelah masking
  immutable; creation input, deployer, receipt sukses, role, domain EIP-712,
  chain `5042`, token dan nilai konstanta cocok. Kontrak tidak paused saat audit.
- Duel: entry 1 USDC per pemain, pool 2, pemenang 1,90 dan treasury 0,10 USDC.
  Fee 500 bps bersifat immutable. Cup: pool 100, hadiah 70/30, tanpa fee tambahan.
- Saldo kedua escrow nol saat pembacaan audit. Tidak ada dana escrow yang
  ditransaksikan oleh proses audit ini.
- Tanda tangan hasil terikat ke chain, kontrak, ID, peserta, ruleset, epoch,
  sequence dan deadline. Kontrak menolak replay dan penerima yang tidak berhak.
  Owner tidak mempunyai fungsi penarikan pool secara administratif.
- Withdrawal menggunakan kredit dan reentrancy guard; transfer gagal
  mempertahankan kredit. Refund/withdrawal tetap tersedia saat pause.
- SIWE memeriksa domain, chain, nonce sekali pakai dan expiry. Autentikasi
  wallet dan token sesi tidak disimpan di localStorage oleh alur normal.
- Origin situs baru diterima; origin asing dan domain Railway lama ditolak.
  Path `.env`, `server/.env`, dan private env kontrak merespons 404.
  Tidak ada private env/key path terlacak; tiga path env sensitif yang diperiksa
  juga tidak ditemukan dalam empat commit history repository ini.
- Docker memuat artifact deployment asli, mengecualikan env/DB/broadcast, dan
  menggunakan SQLite persisten `/data/rushy.sqlite` pada satu service Railway.
- File frontend live yang diperiksa cocok dengan sumber audit. Build client
  menghasilkan hash yang sama dengan server produksi.
- Solidity: **49 lulus**, termasuk empat fuzz test dengan 256 runs/test.
  Server/browser-logic suite: **45 lulus**. Dua integration test pembayaran
  diulang setelah build client produksi: **2 lulus**.
- Integration lokal mencakup Cup 70/30, duel 1,90/0,10, partial-entry refund,
  pembatalan langsung lewat wallet, restart menjadi Void, kegagalan room,
  gagal transfer/retry, recovery deposit, serta nonce relay yang stale.
- `npm audit --omit=dev`: **0 vulnerability yang dilaporkan** untuk dependency
  produksi terkunci pada saat audit.

Pengujian pembayaran memakai **Anvil chain 31337 dan mock ERC-20**, bukan Arc
mainnet. Tidak ada transaksi uang mainnet yang dibroadcast. Lulusnya tes ini
tidak menutup temuan di atas atau membuktikan alur real-USDC penuh sudah lolos.
Publikasi source di explorer belum dikonfirmasi; verifikasi bytecode via RPC
tidak sama dengan source verification pada explorer.

Model USDC dicek dengan skill `evm-token-decimals`: ERC-20 6 decimals, gas native
18 decimals, menggunakan integer/BigInt. Filter Transfer ERC-20 dari alamat
USDC sesuai [referensi event resmi Arc](https://docs.arc.io/arc/references/usdc-system-events):
pemanggilan ERC-20 menghasilkan log 6-decimal selain log native sistem.
Lihat juga [alamat kontrak resmi](https://docs.arc.io/arc/references/contract-addresses)
dan [EIP-712 OpenZeppelin](https://docs.openzeppelin.com/contracts/5.x/api/utils/cryptography).

## Urutan penyelesaian

1. Tutup F01, lalu benahi F03/F04 dan verifier receipt F05.
2. Benahi fairness/recovery F06, admission/rate limit F07, serta pemeriksaan
   kesiapan gas/pause. Tambahkan pengujian regresi sebelum deployment perbaikan.
3. Pastikan akses key **existing** signer dan relay; pasang lewat secret Railway.
   Danai gas relay sesuai budget operasional dan siapkan akses owner untuk darurat.
4. Jalankan acceptance dua browser yang benar-benar memakai Arc: deposit kedua
   entry, settlement, transfer pemenang dan treasury; lalu cancellation/refund
   dan claim fallback. Catat hash dan perubahan saldo yang sesuai, termasuk gas.
   Cup memerlukan pool 100 USDC dan validasi 70/30 tersendiri. Penggunaan dana
   untuk acceptance tersebut belum dilakukan dalam audit ini.
5. Buka paid mode untuk publik setelah temuan diselesaikan dan bukti acceptance
   diverifikasi. `enabled=true` dan deployment sukses saja belum cukup.

## Reproduksi tanpa dana mainnet

Jalankan dependensi server dan build kontrak terlebih dahulu. Script probe
backend/receipt memakai database memori dan respons sintetis, tanpa signing
atau broadcast jaringan:

```bash
npm ci --prefix server --include=dev --ignore-scripts --no-audit --no-fund
forge test --root contracts
npm --prefix server run build:client
npm --prefix server test
node validation/mainnet-audit/backend-probes.mjs
node validation/mainnet-audit/receipt-probe.mjs
```

Probe browser membutuhkan Python Playwright dan Chromium lokal. Jalankan
server di terminal terpisah dengan database audit tersendiri:

```bash
HOST=127.0.0.1 PORT=5197 PUBLIC_ORIGIN=http://127.0.0.1:5197 \
DATABASE_PATH=/tmp/rushy-mainnet-audit.sqlite ENABLE_ARC_PRIZES=0 \
node --experimental-strip-types server/index.ts
```

Kemudian jalankan `validation/mainnet-audit/browser-probe.py` menggunakan
Python yang memiliki Playwright. Script menolak hostname non-localhost.
`CHROMIUM_PATH` dapat menunjuk executable Chromium; default mencari `chromium`
di PATH. Probe membuat Cup lokal berisi marker harmless dan membuka linknya
pada sesi browser berbeda. Jangan gunakan database pemain untuk reproduksi.
