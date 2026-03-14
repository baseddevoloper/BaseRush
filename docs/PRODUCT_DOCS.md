# BaseRush Urun ve Teslimat Master Plani

Son guncelleme: 2026-03-14  
Sahiplik: Product + Engineering  
Durum: Aktif (MVP canli, production-grade onchain social trading hedefine gidiyor)

## 0) Bu dokuman neden var
Bu dokuman 4 soruya net cevap verir:
1. Repoda bugun neler gercekten tamamlandi?
2. Production seviyesine cikmak icin neler eksik?
3. Bu isler hangi fazlarda yapilacak?
4. Simdiden itibaren uygulama sirasiyla nasil ilerleyecek?

Bu dosya, urun kapsaminin ve teknik teslimat planinin tek kaynak dokumanidir.

## 1) Urun tanimi

### 1.1 Vizyon
BaseRush, Base uzerinde mobil-oncelikli bir social trading mini app:
- Kullanici kontrat girerek token kesfeder
- USDC ile hizli al/sat yapar
- Token notu yazar ve feed'e dusurur
- Trader takip eder, hareketleri gorur
- Premium ile copy trade kullanir

### 1.2 Gelir modeli
- Premium abonelik: ayda 20 USDC
- Islem komisyonu: uygulama ici trade fee
- Gelecek faz: referral fee paylasimi + partner kampanyalari

### 1.3 Paketler
- Free:
  - Home/Friends/Feed/Referrals/Profile
  - Kontratla token bulma
  - Temel buy/sell + wallet summary
  - Bildirim ve follow aksiyonlari
- Premium (20 USDC/ay):
  - Copy trade erisimi
  - Gelismis copy limitleri
  - Oncelikli sinyal/bildirim davranisi

## 2) Guncel implementasyon durumu (2026-03-12)

### 2.1 Backend (tamamlanan)
Sunucuda aktif endpointler:
- `POST /api/auth/login`
- `POST /api/auth/farcaster/login`
- `POST /api/auth/base/login`
- `GET /api/auth/status`
- `GET /api/auth/diagnostics`
- `POST /api/balance/deposit-usdc`
- `GET /api/wallet/summary`
- `POST /api/premium/activate`
- `GET /api/premium/status`
- `GET /api/token/resolve`
- `GET /api/token/search`
- `GET /api/token/insights`
- `GET /api/trade/quote`
- `POST /api/trade/execute`
- `POST /api/trade/execute-onchain`
- `POST /api/copytrade/execute-onchain`
- `GET /api/copytrade/status`
- `GET /api/copytrade/settings`
- `POST /api/copytrade/settings`
- `POST /api/follow`
- `GET /api/notifications/inbox`
- `POST /api/farcaster/webhook`
- `GET /api/miniapp/manifest-status`
- `GET /api/onchain/config`
- `GET /api/onchain/tx`
- `GET /api/onchain/operation`
- `POST /api/onchain/smoke`

Ek backend kabiliyetleri:
- Endpoint sinifina gore rate limit
- Body size limiti
- Manifest'i env veya static dosyadan servis etme
- Neynar webhook verify yolu
- Quick auth token verify + domain fallback
- Builder code suffix destegi
- Trade ve premium tarafinda idempotency korumasi

### 2.2 Frontend (tamamlanan)
React UI tarafinda aktif ozellikler:
- Tablar: Home, Friends, Feed, Referrals, Profile
- Wallet Session karti ve auto-connect akisi
- Farcaster auth durum gostergesi + Verify/Refresh action
- Wallet Session kartinda `Auth expires` gorunumu
- Popular token listesi + token spotlight
- Sparkline + uygulama ici holder listesi
- Contract paste -> Use akisi
- Buy akisi + token note
- Sell akisi (%10/%25/%50/%100 + custom)
- Feed kartlari (buy/sell/note akis tarzi)
- Premium karti + copy settings paneli
- Notification enable aksiyonu
- Last onchain tx kartinda dinamik lifecycle status + operation id + timeline

### 2.3 Mini app ve manifest durumu
- `.well-known/farcaster.json` repoda mevcut
- `frame` ve `miniapp` bolumleri doldurulmus
- Account association alanlari var
- Canonical domain `baserush.app`
- Notification mode: native webhook veya Neynar event webhook

### 2.4 Auth/session tarafinda son tamamlananlar
Tamamlandi:
- Protected actionlar auth verify ardina alindi
- `GET /api/auth/status` ile pasif auth restore eklendi
- `quickAuthExp` backendden alinip UI'a baglandi
- Auth expiry Wallet Session kartinda gosteriliyor

Son milestone commitleri:
- `8456f30` wallet connect ve farcaster auth ayrildi
- `515a4cd` protected action gate eklendi
- `311f0ed` popup zorlamadan auth restore iyilesti
- `d7cf7f8` auth status endpoint eklendi
- `0bd873a` auth expiry UI'da gosterildi

### 2.5 Base standard web app migration (2026-03-14)
Tamamlandi:
- Frontend runtime, `@farcaster/miniapp-sdk` bagimliligindan cikartildi.
- `ready()` bazli mini app bootstrap kaldirildi.
- Wallet baglantisi standard wagmi connectorlari ile duzenlendi:
  - `injected()`
  - `baseAccount({ appName, appLogoUrl })`
- SSR cookie storage ile wallet session restore davranisi korundu.
- Uygulama hala Base/Farcaster icinde acilabilir; ancak client tarafta mini-app-only SDK akisi kullanilmiyor.
- Root static build dosyalari (`index.html` + `assets/`) temiz build ile yeniden sabitlendi.

## 3) Aciklar ve risk kayitlari

### 3.1 Urun aciklari
- Feed ranking halen MVP seviyesinde
- Gercek sosyal ingest kisitli, app-local event agirlikli
- Kalici veri tabani henuz yok, in-memory state hala mevcut
- Referral ve analytics hattinda derinlik eksik

### 3.2 Onchain aciklari
- Quote route secimi daha guclu adapter katmani istiyor
- Token risk motoru su an temel seviyede
- Onchain tx -> internal ledger reconcile worker eksik
- Production signer stratejisi HSM/KMS'e tasinmali

### 3.3 Session/auth aciklari
- Auto session davranisi istemciye gore farkli olabiliyor
- Bazi runtime'larda popup bloklanabiliyor
- Basarisiz auth pathleri icin daha net fallback UI gerekli

### 3.4 Operasyon aciklari
- SLO dashboard tam degil
- Alarm ve incident runbook parcali
- Staging load/failure testleri tamamlanmadi

## 4) Hedef mimari (production)

### 4.1 Runtime mimarisi
- Client:
  - React mobil mini app UI
  - Standard web app runtime (wagmi + viem)
  - Connectorlar: injected + Base Account
- API:
  - auth, wallet, token, trade, premium, copy, social modulleri
- Worker:
  - execution, feed index, notification, reconciliation queue consumerlari
- Storage:
  - PostgreSQL (transactional)
  - Redis (cache/rate-limit/queue)

### 4.2 Veri modeli (cekirdek varliklar)
- `users`
- `identities` (farcaster/base map)
- `wallets`
- `tokens`
- `orders`
- `trades`
- `positions`
- `notes`
- `follows`
- `copytrade_settings`
- `subscriptions`
- `notifications`
- `referrals`
- `ledger_entries`

### 4.3 Onchain mimarisi
- Ag: Base mainnet (`8453`)
- Quote adapter:
  - primary provider
  - secondary provider
  - fallback davranisi
- Execution:
  - TradeExecutor kontrati
  - server orchestrasyonu + idempotency key
  - tx tracking + confirmation
- Accounting:
  - fee toplama
  - realized/unrealized pnl update
  - reconcile worker

### 4.4 Guvenlik mimarisi
- Protected actionlarda server-side auth verify zorunlu
- Endpoint tipine gore limit ve izolasyon
- Parasal islemlerde idempotency zorunlu
- Signer key hardening (HSM/KMS yol haritasi)
- Auth/trade/premium/copy audit log

## 5) Kritik kullanici akislarinin hedef davranisi

### 5.1 App acilis ve session akisi
1. Kullanici mini app'i Farcaster/Base icinde acar.
2. App standard web runtime olarak acilir ve wallet provider algilanir.
3. Quick auth token gerekiyorsa istenir ve verify edilir.
4. `GET /api/auth/status` ile popup zorlamadan session restore denenir.
5. Wallet Session kartinda su bilgiler gorunur:
- Connected durumu
- Auth durumu (Verified/Pending)
- Auth expiry zamani

### 5.2 Kontrat -> buy akisi
1. Kullanici kontrat adresi yapistirir.
2. Uygulama token metadata cozer.
3. Kullanici sparkline/holder/verified/tradable onizlemesini gorur.
4. USDC miktari girer ve isterse note yazar.
5. Idempotency key ile execution endpoint cagrilir.
6. Basari durumunda wallet summary ve feed guncellenir.

### 5.3 Sell ve realized pnl akisi
1. Kullanici hizli yuzde (`10/25/50/100`) veya custom yuzde secer.
2. Pozisyon yeterlilik kontrolu yapilir.
3. Islem execute edilir ve fee uygulanir.
4. Realized pnl hesaplanir, pozisyon update edilir.
5. Feed event ve bildirim olusturulur.

### 5.4 Premium ve copy akisi
1. Kullanici 20 USDC ile premium aktif eder.
2. Subscription'a `expiresAt` yazilir.
3. Copy settings sadece auth + premium sartlariyla kaydedilir.
4. Copy execution endpointi premium kosuluyla calisir.
5. Premium suresi biterse copy islemleri otomatik kilitlenir.

### 5.5 Bildirim akisi
1. Trade/social/system eventi olusur.
2. Event normalize edilir ve dedupe edilir.
3. In-app inbox ve secilen kanal(lar)a dagitilir.
4. Kullanici read/unread durumunu UI'da gorur.

## 6) Faz bazli derin yol haritasi

Aktif faz: **Faz 3**

### Faz 0 - Stabilizasyon ve dogruluk (temel tamam, hardening suruyor)
Hedef:
- Session/auth tarafini deterministik hale getirmek

Tamamlananlar:
- Protected action gate
- Auth status endpoint
- Pasif auth restore
- Wallet Session'da auth expiry gorunumu

Kalan hardening:
- Tum auth hata kodlari icin net UI mesaj standardi
- Auth transition telemetri eventi
- Popup-block senaryosu icin retry backoff

DoD:
- Kullanici auth neden pending/failed net gorur
- Silent auth loop olmaz
- Normal path'te refreshsiz session toparlanir

### Faz 1 - Persistence ve account modeli
Hedef:
- In-memory durumdan kalici veri katmanina gecmek

Kapsam:
- PostgreSQL schema ve migration
- Redis cache/queue/rate limit merkezilesmesi
- users/identities/wallet/trade/note/subscription persist

DoD:
- Backend restartta veri kaybi olmaz
- Cekirdek endpointler persistent kaynaktan servis eder
- Migration rollback stagingde test edilir

### Faz 2 - Token kesfi ve market data kalitesi
Hedef:
- Kontratla token kesfini guvenli ve guclu yapmak

Kapsam:
- Kontrat validation + checksum normalization
- Metadata enrichment pipeline (primary + fallback)
- Popular token skor modeli
- Verified token moderation workflow

DoD:
- Riskli/invalid kontratlar blok veya net uyarili
- Token resolve latency hedefte
- Popular list deterministik joblarla guncellenir

### Faz 3 - Gercek onchain execution ve muhasebe (aktif)
Hedef:
- MVP mock'tan production-grade onchain executiona gecmek

Alt Faz 3A (execution hatti):
- TradeExecutor entegrasyonunun son hali
- Tum execute pathlerde kati idempotency
- Tx state machine: requested/submitted/confirmed/failed

Alt Faz 3B (ledger hatti):
- Tum parasal hareketler icin ledger entry
- Realized/unrealized pnl recalc job
- Fee accounting + treasury rapor endpointi

Alt Faz 3C (reconcile hatti):
- Confirmation watcher worker
- Chain/internal ledger reconcile job
- Mismatch ve stuck tx alarmlari

DoD:
- Buy/sell/copy islemleri varsayilan olarak onchain-backed
- Ledger ve chain verisi tolerans icinde eslesir
- Staging soak testte kritik mismatch yok

### Faz 4 - Sosyal feed motoru ve profile derinligi
Hedef:
- Feed'i urunun merkezi yapmak

Kapsam:
- Trade/note/follow event ingestion queue
- Ranking v1 (recency + affinity + kalite skoru)
- Profile metricleri: followers/following/scans/copy stats/note timeline
- Token holder bolumu: uygulama ici holder + pnl gorunumu

DoD:
- Feed near-real-time guncellenir
- Profile sosyal/performance boyutlarini dogru gosterir
- Token detail sayfasi yeterli derinlige ulasir

### Faz 5 - Premium ve copy trade productionization
Hedef:
- Premium ve copy mekanigini olceklendirilebilir yapmak

Kapsam:
- Subscription state machine: active/grace/expired/canceled
- Expire oldugunda auto-stop copy
- Risk guardlar: max order, daily cap, slippage cap, emergency stop
- Copy execution journal + retry politikasi

DoD:
- Copy erisimi subscription state ile birebir tutarli
- Copy joblari izlenebilir ve debug edilebilir
- Ayni leader eventi icin duplicate execution olmaz

### Faz 6 - Bildirim, referral ve buyume donguleri
Hedef:
- Retention ve monetization dongulerini guclendirmek

Kapsam:
- Unified notification rules engine
- Kullanici tercihleri + sessiz saatler
- Referral kodu ve reward accounting
- Funnel analytics (activation, retention, premium conversion)

DoD:
- Bildirim delivery + dedupe kararlidir
- Referral rewardlar ledger ile reconcile olur
- Takim haftalik buyume metriklerini izler

### Faz 7 - Launch hardening ve operasyon
Hedef:
- Yuk altinda stabil production

Kapsam:
- SLO dashboard + alarm seti
- Peak traffic ve queue pressure load test
- Security review + remediation
- Incident runbook tamamlama

DoD:
- Error budget tanimli ve izleniyor
- P95 latency ve success hedefleri stabil
- Staging ve production checklistleri tam gecer

## 7) Simdiki uygulama sirasi (oncelikli backlog)

### P0 (once)
1. Faz 3A tx state machine'i persistent storage ile bitir
2. Faz 3B ledger write yolunu buy/sell/copy/premium icin tamamla
3. Faz 3C tx watcher + reconcile worker ekle
4. Feed/Profile tarafina tx state chiplerini ekle

### P1 (P0 sonrasi)
1. Token risk check ve blocked/high-risk davranislarini sertlestir
2. Profile detayini scans/copy metrics/note timeline ile genislet
3. Feed ranking v1 + anti-spam katmani

### P2 (paralel)
1. Notification preference + quiet hours
2. Referral summary dogrulugu + payout preview
3. Analytics event semasi + dashboard baseline

## 8) Environment variable sozlesmesi (production baseline)

### 8.1 Core app ve auth
- `APP_BASE_URL`
- `FC_HOME_URL`
- `FC_AUTH_REQUIRED`
- `FC_WEBHOOK_REQUIRE_VERIFY`
- `FC_AUTH_ALLOWED_DOMAINS`
- `FC_QUICK_AUTH_ORIGIN`
- `FC_ACCOUNT_ASSOC_HEADER`
- `FC_ACCOUNT_ASSOC_PAYLOAD`
- `FC_ACCOUNT_ASSOC_SIGNATURE`

### 8.2 Manifest ve bildirim
- `FC_NOTIFICATION_MODE` (`native` veya `neynar`)
- `FC_NEYNAR_EVENT_WEBHOOK_URL`
- `FC_WEBHOOK_URL`
- `NEYNAR_API_KEY`

### 8.3 Onchain execution
- `ENABLE_REAL_ONCHAIN`
- `BASE_RPC_URL`
- `TRADE_EXECUTOR_ADDRESS`
- `SERVER_SIGNER_PRIVATE_KEY`
- `TRADE_EXECUTOR_FUNCTION`
- `TRADE_EXECUTOR_ABI_JSON`
- `TRADE_EXECUTOR_ARGS_TEMPLATE_JSON`
- `BUILDER_CODE`

### 8.4 Guvenlik ve limitler
- `RATE_LIMIT_ENABLED`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX`
- `RATE_LIMIT_TRADE_MAX`
- `BODY_MAX_BYTES`
- `ALLOW_LOCAL_SIGNER_IN_PROD`

## 9) Test stratejisi

### 9.1 Zorunlu integration journeyler
1. Session:
- Mini app ac
- Auth verify et
- `auth/status` dogrula
- Wallet Session kartinda auth expiry gor

2. Trading:
- Kontratla token bul
- Note ile buy yap
- Quick percent ve custom sell yap
- Fee ve pnl update kontrol et

3. Premium ve copy:
- Premium aktive et
- Copy settings kaydet
- Copy trade execute et
- Subscription expire olunca copy lock dogrula

4. Bildirim ve feed:
- Trader takip et
- Trade event tetikle
- Inbox ve feed tutarliligini kontrol et

### 9.2 Non-functional testler
- Burst altinda rate limit davranisi
- Duplicate request idempotency
- Tx watcher retry politikasi
- API latency hedefleri

## 10) Release checklist
1. `/.well-known/farcaster.json` HTTPS uzerinden valid JSON donuyor mu?
2. Manifest medyalari erisilebilir mi? (icon/hero/screenshots/og)
3. Aktif release icin webhook mode dogru mu?
4. Auth diagnostics ve domain candidate listesi dogru mu?
5. Onchain config endpointi readiness durumunu dogru veriyor mu?
6. Premium/copy gate UI ve API'da tutarli mi?
7. Build/deploy sonrasi smoke testler temiz mi?

## 11) Sprint calisma disiplini
- PR etiketleri:
  - `phase:3` / `phase:4` / `phase:5`
- Her PR zorunlu icerik:
  - Kapsam ozeti
  - Risk notu
  - Test kaniti
  - Geri alma (rollback) notu

BaseRush bu noktadan sonra Faz 3 execution dogruluguna odaklanip, sonra sosyal derinlik ve buyume sistemlerine gecmelidir.
