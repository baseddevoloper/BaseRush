# Base/Farcaster Trader Social Mini App - Product & Delivery Blueprint

Last update: 2026-03-11  
Owner: Product + Engineering  
Status: Active working spec (MVP + Production roadmap)

## 0) Dokumanin Amaci
Bu dokuman su 3 soruya net cevap verir:
- Urun neyi cozecek ve nasil para kazanacak?
- Teknik olarak Coinbase Smart Wallet, trade, social feed ve premium copy trade nasil calisacak?
- Takim bunu fazlara bolup hangi sira ile nasil teslim edecek?

Bu repo icindeki mevcut kod, **MVP prototip** seviyesindedir (in-memory state + simule trade).
Bu dokuman, ayni urunu production seviyesine cikarmak icin detayli yol haritasini da icerir.

## 1) Urun Ozeti

### 1.1 Product Vision
Base aginda, Farcaster sosyal etkisini ve trader davranisini birlestiren, mobil-first bir mini app:
- Kullanici kontrat adresi ile token bulur.
- USDC ile hizli al/sat yapar.
- Islem yaparken token notu yazar, feed'e duser.
- Takip ettigi traderlari gorur, bildirim alir.
- Premium ise copy trade acar.

### 1.2 Core Value Proposition
- Trader icin: hizli execution + sosyal gorunurluk.
- Takipci icin: kimin ne aldigi/sattigi ve PnL etkisi.
- Uygulama icin: trade fee + premium abonelik gelir modeli.

### 1.3 Paketler
- Free:
  - Home/Friends/Feed/Referrals/Profile
  - Kontrat ile token arama
  - Basic al/sat, wallet gorunumu, bildirim
  - Takip mekanigi
- Premium ($20/ay, USDC on Base):
  - Copy trade
  - Oncelikli sinyal/bildirim
  - Gelismis trader filtreleri

### 1.4 Gelir Modeli
- Subscription: `$20/ay` (USDC)
- Trade Fee: her al/sat isleminden bps komisyon
- Gelecek faz: referral share (arkadas fee gelirinin %X'i)

## 2) Mevcut Durum (Repo Reality Check)

### 2.1 Simdi Calisanlar (MVP)
- Unified login endpoint: `/api/auth/login`
- USDC deposit, premium aktivasyon, buy/sell, wallet summary
- Token resolve endpoint: kontrat veya symbol ile token secimi
- Idempotency korumasi (trade + premium)
- React mobil arayuz:
  - `Home`, `Friends`, `Feed`, `Referrals`, `Profile`
  - Kontrat yapistirarak token secme
  - Buy + sell (%10/%25/%50/%100 + custom)
  - Token note yazip feed'e gonderme

### 2.2 Bilinen MVP Sinirlari
- Cuzdan custody mock
- Onchain trade yok (server-side simule)
- Gercek fiyat/likidite quote yok
- Social ingest local/mock agirlikli
- Veri kaliciligi yok (in-memory)

## 3) Bilgi Mimarisi ve Ekranlar (Mobile-First)

### 3.1 Bottom Navigation
- Home
- Friends
- Feed
- Referrals
- Profile

### 3.2 Home
- Portfolio card (USDC + 24h PnL + fee)
- Deposit card
- Popular Tokens listesi (verified rozet destekli)
- Quick Trade modulu:
  - Symbol search
  - Contract paste
  - Token preview
  - Buy input + note
  - Sell percent chips + custom sell

### 3.3 Friends
- Takip edilen trader listesi
- Son PnL snapshot
- Takipten cik / profile git

### 3.4 Feed
- Islem kartlari (kim, ne aldi/satti, ne kadar)
- Token note postlari
- PnL etkisi ve zaman damgasi
- Filtre: Following / Global / Verified

### 3.5 Referrals
- Toplam referral kazanci
- Son 7 gun
- Refer edilen kullanici sayisi
- Referral link kopyala/paylas

### 3.6 Profile
- Kullanici performansi (cash, realized/unrealized PnL)
- Acik pozisyonlar
- Follower/following/copy ayarlari
- Premium durumu + aktivasyon

## 4) Coinbase Smart Wallet Mimarisi

### 4.1 Hedef
Kullanicinin seed phrase yonetmeden, mini app icinde sorunsuz onchain islem yapabilmesi.

### 4.2 Temel Yapi
- Auth katmani:
  - Farcaster context login
  - Base app context login
- Wallet katmani:
  - Coinbase Smart Wallet olusturma/baglama
  - Tek kullaniciya tek birincil smart wallet adresi
- App account katmani:
  - `user` + `identity` + `wallet` mapping

### 4.3 Account Linking Kurali
- Bir kullanici hem Farcaster hem Base ile giris yapabilir.
- Ilk giriste yeni user acilir.
- Sonraki girislerde identity eslesirse ayni user'a baglanir.
- Ayni user'in primary smart wallet adresi degismez (rotation disinda).

### 4.4 Wallet Lifecycle
1. Kullanici mini app'e girer.
2. Auth provider dogrulanir.
3. Smart wallet mevcut degilse olusturulur.
4. Wallet address profile'a yazilir.
5. USDC bakiye ve allowance kontrol edilir.
6. Trade/premium islemler wallet imzasi ile tetiklenir.

### 4.5 Gas ve Sponsorluk Stratejisi
- MVP production:
  - Baslangicta kullanici gas oder (en basit)
- V2:
  - Paymaster/sponsored transaction modeli
  - Limitli sponsor policy (gunde X islem, kullanici basina cap)

### 4.6 Guvenlik Notlari
- Private key asla plain-text saklanmaz.
- Server tarafinda imza gerekiyorsa HSM/KMS ile ayrik yonetim.
- Session token kisa omurlu ve rotate edilmeli.
- Wallet olusturma/execute aksiyonlari audit log'a yazilmali.

## 5) Trade Engine Tasarimi

### 5.1 Trade Modlari
- Simule mod (su anki MVP)
- Onchain execution mod (production hedef)

### 5.2 Buy Akisi (Production)
1. Kullanici tokeni symbol veya kontratla secer.
2. Backend token metadata ve risk sinifini dogrular.
3. Quote servisi en iyi route'u doner.
4. Slippage limiti hesaplanir.
5. Kullanici onaylar.
6. Smart wallet swap transaction gonderir.
7. Chain confirm olur.
8. Ledger update:
   - gross/net/fee
   - position amount
   - cost basis
   - unrealized/realized PnL
9. Feed event + notification uretilir.

### 5.3 Sell Akisi (Production)
1. Kullanici `%10/%25/%50/%100` veya custom miktar secer.
2. Miktar yeterlilik kontrolu yapilir.
3. Quote alinir, slippage check edilir.
4. Execute edilir.
5. Realized PnL hesaplanir:
   - `realizedPnl = netProceeds - reducedCostBasis`
6. Position kalan miktara gore guncellenir.
7. Feed/bildirim guncellenir.

### 5.4 Komisyon Muhasebesi
- Uygulama komisyonu `feeBps` ile hesaplanir.
- Buy'da: gross icinden fee kesilir.
- Sell'de: cikis tutarindan fee kesilir.
- Tum fee kayitlari kullanici bazli ve sistem bazli toplanir.

### 5.5 Idempotency ve Tutarlilik
- Trade execute endpoint zorunlu `idempotencyKey` ister.
- Ayni key ile ikinci cagrida replay donecek.
- Ledger update tek transaction boundary icinde calisir.

## 6) Kontrat Ile Token Arama ve Satin Alma

### 6.1 Input Kurallari
- Address format check (`0x` + 40 hex)
- Network check (yalnizca Base)
- Token blacklist/deny-list check

### 6.2 Token Resolve Akisi
1. Frontend kontrat girer.
2. Backend `/api/token/resolve` cagirir.
3. Registry'de varsa aninda doner.
4. Registry'de yoksa production'da indexer/RPC fallback ile metadata ceker.
5. UI token onizleme karti acilir (symbol, name, contract, risk badge).

### 6.3 Satin Alma Akisi
1. Kullanici USDC miktari girer.
2. Quote + expected amount gosterilir.
3. Kullanici isterse token note yazar.
4. Islem execute edilir.
5. Islem basariliysa:
   - position guncellenir
   - note feed'e post olur
   - notifications uretilir

### 6.4 Popular ve Verified Token Mantigi
- Popular listesi: hacim + trade sayisi + sosyal mention skoru
- Verified badge:
  - internal allowlist
  - contract ownership/metadata kontrolleri
  - manuel moderation onayi

## 7) Sosyal Veri Cekme ve Feed Mimarisi

### 7.1 Veri Kaynaklari
- Uygulama ici olaylar:
  - buy/sell events
  - token notes
  - follow/unfollow
- Farcaster olaylari:
  - cast
  - reaction
  - takip iliskileri
- Base onchain olaylari:
  - wallet trade aktiviteleri (izinli kapsamda)

### 7.2 Social Graph
- Node tipleri:
  - user
  - wallet
  - token
- Edge tipleri:
  - follows
  - traded
  - posted_note
  - copied_from

### 7.3 Feed Uretim Katmani
- Event ingestion queue
- Event normalization
- Ranking:
  - recency
  - relationship strength (takip puani)
  - trader quality score (PnL / win rate / sample size)
  - verified boost

### 7.4 Token Note Sistemi
- Kullanici buy esnasinda not yazar.
- Not trade event ile baglanir (`tradeId` foreign key).
- Feed kartinda token satiri altinda gosterilir.
- Spam/risk moderasyonu:
  - max length
  - toxic/spam filtre
  - rate limit

## 8) Bildirim Mimarisi (Farcaster + Base + In-App)

### 8.1 Channel Tipleri
- `in_app`
- `farcaster`
- `base`

### 8.2 Notification Event Tipleri
- `auth`
- `wallet`
- `social`
- `premium`
- `system`

### 8.3 Tetikleyiciler
- Takip edilen trader trade yapti.
- Copy trade execute oldu / fail oldu.
- Premium suresi doluyor (T-3 gun, T-1 gun).
- Buy/sell tamamlandi.
- Referral odulu olustu.

### 8.4 Dedupe ve Sessizlik Kurallari
- Ayni olaya 60 sn icinde duplicate push yok.
- Kullanici mute ayarlari:
  - only following
  - only copy trade
  - critical only

## 9) Premium ve Copy Trade Detayi

### 9.1 Premium Aktivasyon
- Fiyat: `$20 / ay`
- Odeme: `USDC on Base`
- Baslangic:
  - odeme basarili -> premium active
  - `expiresAt = now + 30 gun`

### 9.2 Premium Durumlari
- `active`
- `grace` (opsiyonel sonraki faz)
- `expired`
- `canceled` (term sonuna kadar active kalabilir)

### 9.3 Copy Trade Konfig
- Hangi trader kopyalanacak
- Kopya oran modeli:
  - fixed USDC
  - proportional size
- Risk kontrolleri:
  - max order size
  - max daily loss
  - max slippage
  - stop copy switch

### 9.4 Copy Trade Calisma Akisi
1. Leader trade eventi ingestion'a gelir.
2. Follower premium status kontrol edilir.
3. Follower copy policy check edilir.
4. Trade quote + execute edilir.
5. Sonuc follower feed/bildirimine yazilir.

## 10) API Sozlesmesi

### 10.1 Mevcut Endpointler (Repo'da var)
- `POST /api/auth/login`
- `POST /api/auth/farcaster/login`
- `POST /api/auth/base/login`
- `POST /api/balance/deposit-usdc`
- `POST /api/trade/execute`
- `GET /api/wallet/summary`
- `POST /api/premium/activate`
- `GET /api/premium/status`
- `GET /api/copytrade/status`
- `POST /api/follow`
- `GET /api/notifications/inbox`
- `GET /api/token/resolve`

### 10.2 Production Icin Eklenecek Endpointler
- `POST /api/wallet/connect-smart-wallet`
- `GET /api/wallet/balances`
- `POST /api/trade/quote`
- `POST /api/trade/execute-onchain`
- `POST /api/copytrade/config`
- `POST /api/copytrade/toggle`
- `GET /api/feed/global`
- `GET /api/feed/following`
- `POST /api/feed/note`
- `GET /api/referrals/summary`
- `POST /api/referrals/create-link`

### 10.3 Event Contracts (Queue)
- `trade.executed`
- `trade.failed`
- `note.created`
- `follow.changed`
- `premium.activated`
- `premium.expired`
- `copytrade.executed`
- `notification.dispatch.requested`

## 11) Veri Modeli (Production DB Taslagi)

### 11.1 Tablolar
- `users`
  - id, username, created_at, status
- `identities`
  - id, user_id, provider (`farcaster|base`), provider_user_id, verified_at
- `wallets`
  - id, user_id, chain_id, address, wallet_type (`coinbase_smart`)
- `tokens`
  - id, chain_id, contract, symbol, name, decimals, verified
- `orders`
  - id, user_id, token_id, side, input_usdc, status, idempotency_key
- `trades`
  - id, order_id, tx_hash, gross_usdc, fee_usdc, net_usdc, amount, price
- `positions`
  - user_id, token_id, amount, cost_basis, updated_at
- `pnl_snapshots`
  - user_id, realized, unrealized, total, snapshot_at
- `notes`
  - id, user_id, token_id, trade_id, body, created_at
- `follows`
  - follower_user_id, leader_user_id, created_at
- `copytrade_configs`
  - user_id, leader_user_id, mode, value, risk_limits, active
- `subscriptions`
  - user_id, plan, status, starts_at, expires_at, renewed_at
- `notifications`
  - id, user_id, channel, type, payload, sent_at, read_at
- `referrals`
  - referrer_user_id, referred_user_id, code, created_at
- `referral_rewards`
  - referrer_user_id, trade_id, amount_usdc, status

### 11.2 Kritik Indexler
- `tokens(contract, chain_id)` unique
- `orders(idempotency_key)` unique
- `trades(tx_hash)` unique
- `notifications(user_id, sent_at desc)`
- `follows(follower_user_id, leader_user_id)` unique

## 12) Guvenlik, Uyum ve Risk Kontrolleri

### 12.1 Uygulama Guvenligi
- JWT/session rotate
- CSRF + rate limit
- Request validation (zod/joi)
- Strict allowlist for chain/token operations

### 12.2 Finansal Guvenlik
- Decimal precision guard
- Slippage cap
- Max order limit
- Replay korumasi
- Trade and settlement reconciliation jobs

### 12.3 Operasyonel Kontroller
- Audit log (auth, trade, premium, copy)
- Alerting (failed tx spike, quote latency, notification backlog)
- Incident runbook

### 12.4 Hukuki/Uyum Basliklari
- KYC/AML policy (ulke bazli)
- Risk disclosure ekranlari
- Kullanici sozlesmesi + fee disclosure
- Data retention + KVKK/GDPR uyum plani

## 13) Faz Bazli Yapim Plani (Detayli)

### Faz 0 - Foundation Hardening (1 hafta)
Hedef: Mevcut MVP'yi kalici ve olculur hale getirmek.
- In-memory'den PostgreSQL'e gecis
- Basic migration seti
- Config/env temizligi
- Logging + health endpoint
- DoD:
  - staging'de 24 saat data kaybi olmadan calisma
  - tum mevcut testlerin gecmesi

### Faz 1 - Kimlik ve Smart Wallet Entegrasyonu (1-2 hafta)
Hedef: Farcaster/Base login + Coinbase Smart Wallet baglama.
- Identity linking servisi
- Smart wallet olusturma/baglama endpointi
- Wallet profile ekrani (address, network, status)
- DoD:
  - yeni kullanicida wallet olusumu
  - tekrar giriste ayni wallet map'i
  - audit log aktif

### Faz 2 - Gercek Token Kesfi ve Quote Katmani (1 hafta)
Hedef: kontrat adresinden guvenli token bulma + quote gosterimi.
- Contract validation
- Metadata fetch pipeline (registry + fallback)
- Quote endpoint + slippage preview
- DoD:
  - kontrat aramada < 1.5 sn median
  - invalid kontratlarda guvenli hata mesaji

### Faz 3 - Onchain Trade Engine + PnL Ledger (2 hafta)
Hedef: buy/sell'in gercek execute edilmesi.
- Execute-onchain servisi
- Trade lifecycle state machine
- PnL ve position update worker
- Fee accounting raporlama
- DoD:
  - idempotent execute
  - realized/unrealized PnL dogrulugu
  - failed tx rollback/retry stratejisi

### Faz 4 - Sosyal Feed ve Note Sistemi (1-2 hafta)
Hedef: feed'in urunun kalbi haline gelmesi.
- Event ingestion queue
- Feed ranking v1
- Token note moderasyon katmani
- Following stream + global stream
- DoD:
  - event-to-feed gecikmesi < 3 sn
  - duplicate event orani < %0.5

### Faz 5 - Bildirim Omurgasi (1 hafta)
Hedef: Farcaster/Base/In-app bildirimlerinin tutarli calismasi.
- Notification template servisi
- Channel adapterlari
- Dedupe + preference sistemi
- DoD:
  - kritik eventlerde bildirim kacirma yok
  - read/unread tutarliligi

### Faz 6 - Premium + Copy Trade Production (2 hafta)
Hedef: $20/ay premium ve copy trade canli.
- Subscription state machine
- Copy config UI + risk limitler
- Copy executor worker
- Paywall ve downgrade davranisi
- DoD:
  - premium degilken copy locked
  - premium bitince copy otomatik durur
  - copy trade logs izlenebilir

### Faz 7 - Referrals + Growth + Launch Hardening (1 hafta)
Hedef: buyume mekanizmasi ve launch oncesi son kontroller.
- Referral link generation
- Fee share hesaplama
- Analytics funnel
- Final performance ve security pass
- DoD:
  - referral revenue hesaplari dogru
  - P95 API latency hedefi saglanir

## 14) Test Stratejisi

### 14.1 Unit
- fee hesaplama
- PnL fonksiyonlari
- idempotency handler
- subscription state transitions

### 14.2 Integration
- login -> wallet -> deposit -> quote -> trade
- buy + sell + summary tutarliligi
- premium activate + expire
- copytrade trigger -> execute -> notify

### 14.3 E2E (Mobile)
- Home'da kontratla token bulup buy
- Sell chips (%10/%25/%50/%100) ve custom
- Note yazarak feed'e dusurme
- Following trader eventlerinden bildirim

### 14.4 Regression Checklist
- Decimal/rounding drift
- Double execution
- Negative balance bug
- Feed ordering bozulmasi
- Notification flood

## 15) Operasyon ve Deployment

### 15.1 Ornek Servis Ayrimi
- `api-gateway`
- `trade-service`
- `wallet-service`
- `social-service`
- `notification-service`
- `worker` (queue consumers)

### 15.2 Ortamlar
- local
- staging
- production

### 15.3 Izleme KPI'lari
- Trade success rate
- Quote-to-execute conversion
- Copy trade adoption
- D1/D7 retention
- Premium conversion
- Avg revenue per active trader

## 16) Bu Dokumanin Uygulanis Sirasi (Pratik Baslangic)
1. Faz 0 tasklarini issue'lara bol.
2. DB migration + persistence'i once bitir.
3. Smart wallet spike branch'i ac ve POC yap.
4. Trade quote/execute katmanini ayir.
5. Sosyal event pipeline'i queue ile ekle.
6. Premium/copytrade'i state machine ile kilitle.
7. Launch oncesi security + load test yap.

## 17) Acik Kararlar (Takim Onayi Gerektirir)
- Smart wallet entegrasyonunda hangi SDK net secilecek?
- Quote/execution icin hangi liquidity route provider(lar)i kullanilacak?
- Gas sponsorship Faz 1'de mi Faz 3'te mi acilacak?
- Verified token kural seti otomatik mi manuel mi agirlikli olacak?

## 18) Son Not
Bu dokumanin hedefi fikir vermek degil, direkt teslimata yon vermektir.
Kod degistirme sirasinda her PR asagidaki etiketi tasimalidir:
- `phase:X`
- `feature:wallet|trade|social|premium|referral`
- `risk:low|medium|high`

## 19) Teknoloji Secimi (Production Baseline)

### 19.1 Frontend
- React + Vite + TypeScript
- Tailwind + shadcn/ui
- State:
  - Server state: TanStack Query
  - Local UI state: Zustand
- Wallet UX:
  - viem + wagmi
  - Coinbase wallet/smart wallet adapter katmani

### 19.2 Backend
- Node.js + TypeScript + Fastify (veya NestJS/Fastify adapter)
- API schema:
  - zod validation
  - OpenAPI otomatik dokuman
- Auth:
  - JWT access token + refresh token rotation
  - provider signature verification middleware

### 19.3 Data, Queue, Cache
- PostgreSQL (core transactional data)
- Redis (cache + rate limit + queue backend)
- BullMQ (copy trade, notification, indexing jobs)
- Optional analytics store:
  - ClickHouse (feed/ranking/event analytics)

### 19.4 Chain ve Onchain Katmani
- Base mainnet `chainId=8453`
- RPC:
  - primary + secondary endpoint failover
- Smart contract interaction:
  - viem public client + wallet client
- Price/quote provider abstraction:
  - aggregator adapter 1
  - aggregator adapter 2
  - direct DEX quoter fallback

### 19.5 Observability
- OpenTelemetry traces
- Prometheus metrics
- Grafana dashboard
- Error tracking (Sentry vb.)

## 20) USDC-Merkezli Trade Modeli (Her Token Nasil Alinip Satilacak)

### 20.1 Core Prensip
Tum emirler USDC bazli acilir/kapanir.  
Boylece:
- PnL tek para biriminde tutulur (USDC)
- Fee hesaplama sade olur
- Portfolio karsilastirmasi net olur

### 20.2 Base Uzerinde Referans Varliklar
- Quote asset: `USDC` (Base)
- Bridge asset: `WETH` (gerektiginde cok hop route icin)
- Optional: stable route (USDC -> cbBTC/WETH -> token)

### 20.3 Buy Route Mantigi
1. Input her zaman USDC miktari.
2. Router su olasiliklari quote eder:
   - direct pool: `USDC -> TOKEN`
   - 2-hop: `USDC -> WETH -> TOKEN`
   - 3-hop: sadece likidite gerekiyorsa
3. Her route icin su skor hesaplanir:
   - cikis token miktari
   - price impact
   - gas tahmini
   - fail riski (low liquidity, stale pool)
4. En iyi route secilir, user onaylar.

### 20.4 Sell Route Mantigi
1. Input token miktari veya yuzde.
2. Cikis varligi zorunlu USDC.
3. Route secimi `TOKEN -> USDC` veya multi-hop.
4. Net USDC = gross - protocolFee - gasCostEquivalent (istege bagli metrik).

### 20.5 Uygulama Fee Toplama Modeli
- Fee bps (ornek: 35 bps) order bazinda hesaplanir.
- Teknik uygulama secenekleri:
  - Option A: uygulama trade oncesi/sonrasi fee transferi alir (custody/risk daha yuksek)
  - Option B (onerilen): `TradeExecutor` kontrati, fee kesip treasury'e yollar
- Treasury:
  - `feeTreasury` adresinde USDC birikir
  - gunluk mutabakat job'u calisir

### 20.6 Her Coini Trade Etme Kriteri
Bir token trade'e acilmadan once:
- Base chain'de mi? (zorunlu)
- ERC20 standard uyumu
- Decimals/symbol/name cekilebiliyor mu?
- Pool likiditesi minimum threshold ustunde mi?
- Honeypot/transfer-tax/phishing risk skoru kabul edilebilir mi?

### 20.7 Token Risk Siniflari
- `verified`: ekip/manuel onayli
- `listed`: otomatik kurallari gecmis
- `high_risk`: trade acik ama belirgin uyari goster
- `blocked`: trade kapali

## 21) Akilli Kontrat Katmani (Onchain Core)

### 21.1 TradeExecutor Kontrati
Gorevi:
- Kullanici adina approved tokenlari alir
- DEX router cagrisi yapar
- Fee keser
- Kalani kullaniciya yollar
- Event yayinlar

Onerilen eventler:
- `TradeExecuted(user, tokenIn, tokenOut, amountIn, amountOut, fee, routeId)`
- `TradeFailed(user, reasonCode)`

### 21.2 SubscriptionManager Kontrati
Gorevi:
- Premium odemesini USDC ile toplar
- `premiumExpiresAt` bilgisini event olarak yayinlar
- Offchain subscription servisiyle reconcile edilir

### 21.3 ReferralVault Kontrati
Gorevi:
- Referral fee payini toplar
- Claim mekanigini saglar
- Fraud/replay kontrolu icin nonce tutar

### 21.4 Contract Security Checklist
- Reentrancy guard
- SafeERC20 kullanimi
- Slippage ve deadline kontrolu
- Pausable emergency stop
- Upgrade policy (proxy kullanilacaksa acik governance)

## 22) Cuzdan Mimarisi ve Cuzdan Listeleme

### 22.1 Cuzdan Tipleri
- Primary wallet: Coinbase Smart Wallet
- Linked wallets:
  - kullanicinin bagladigi EOA adresleri
  - read-only izlenen adresler (opsiyonel)

### 22.2 Neyi Listeleyecegiz?
Profile/Cuzdanim ekraninda:
- Wallet listesi (label + address + type + createdAt)
- Her wallet icin:
  - USDC balance
  - toplam token degeri
  - acik pozisyon sayisi
- Unified portfolio:
  - tum walletlarin birlestirilmis gorunumu

### 22.3 Wallet Discovery Akisi
1. Kullanici login olur.
2. `users` + `identities` maplenir.
3. Primary smart wallet yoksa create edilir.
4. Linked wallets DB'den cekilir.
5. Balance indexer her wallet icin snapshot alir.
6. UI aggregate gorunumu cizer.

### 22.4 Portfolio Indexleme Yontemi
- Gercek zaman:
  - trade event gelince anlik update
- Arka plan:
  - periyodik balance reconcile job (5-15 dk)
- Kaynak:
  - multicall balanceOf
  - Transfer event scan (sync veya provider API)

### 22.5 Address Book ve Alias
- Kullanici walletlara isim verebilir (`Main`, `Sniper`, `Vault`)
- Varsayilan trade wallet secilebilir
- Copy trade icin ayri execution wallet secimi desteklenebilir

## 23) Token Metadata ve Search Altyapisi

### 23.1 Search Input Tipleri
- Symbol (ETH, AERO)
- Contract address (`0x...`)
- Token name (partial match)

### 23.2 Resolve Pipeline
1. Local token cache/registry
2. DB token table
3. Onchain metadata fetch
4. Risk engine enrichment
5. Search index update

### 23.3 Search Performans Hedefi
- P50 < 200 ms (cache hit)
- P95 < 900 ms (cache miss + onchain fetch)

### 23.4 Kontrat Yapistirma UX Kurallari
- Auto-trim
- Checksum normalize
- Hatali adreslerde aninda inline error
- Riskli tokenlarda kirmizi uyarilar + confirm step

## 24) Copy Trade Motoru (Detay)

### 24.1 Leader Secimi
- Kullanici bir veya birden cok leader takip eder.
- Her leader icin ayri ayar:
  - mode: fixed/proportional
  - max order
  - max daily loss

### 24.2 Execution Sirasi
1. Leader trade event queue'ya girer.
2. Eligible followerlar cekilir (premium + active config).
3. Her follower icin risk check uygulanir.
4. Quote + execute job baslatilir.
5. Sonuc trade ledger + notification + feed'e yazilir.

### 24.3 Failover Davranisi
- Leader trade fail -> follower denemesi yok
- Follower trade fail -> retry policy (max N)
- Slippage limiti asildiysa skip + notify

### 24.4 Copy Trade Ucretlendirme
- Base fee: premium abonelik
- Opsiyonel gelecekte:
  - performance fee
  - copy execution fee

## 25) Social Data Ingestion (Farcaster + App Events)

### 25.1 Ingestion Katmanlari
- `app_events_consumer`
- `farcaster_events_consumer`
- `onchain_activity_consumer`

### 25.2 Normalized Event Semasi
- `eventId`
- `eventType`
- `actorUserId`
- `tokenContract`
- `amount`
- `usdcValue`
- `createdAt`
- `source` (`app|farcaster|chain`)

### 25.3 Feed Ranking v2 Formulu (Ornek)
`score = recencyWeight + socialAffinity + pnlCredibility + verifiedBoost - spamPenalty`

### 25.4 Anti-Spam
- Per-user post rate limit
- Duplicate note hash detection
- Shadow throttle (sert ban yerine gorunurlugu azaltma)

## 26) Bildirim Dagitim Katmani

### 26.1 Notification Pipeline
1. Event olusur.
2. Rule engine hedef kitleyi hesaplar.
3. Channel adapter secilir.
4. Dedupe kontrolu.
5. Delivery + retry + dead letter queue.

### 26.2 Priority Seviyeleri
- `critical`: trade/copy failure
- `high`: followed trader buy/sell
- `normal`: social etkilesim
- `low`: growth/referral

### 26.3 User Preferences
- Channel bazli ac/kapat
- Sessiz saatler (timezone aware)
- Sadece takip edilenler filtresi

## 27) Operasyonel Mimari ve SLO

### 27.1 SLO Hedefleri
- Trade API availability: `99.9%`
- Quote latency P95: `< 800 ms`
- Feed event delay P95: `< 3 sn`
- Notification dispatch success: `> 99%`

### 27.2 Incident Kategorileri
- P0: trade execution kesintisi
- P1: quote bozulmasi / premium odeme bug
- P2: feed gecikmesi / notification gecikmesi

### 27.3 Runbook Minimumlari
- Trade freeze switch
- Premium payment fallback
- Queue lag cleanup script
- RPC failover manual override

## 28) Finansal Muhasebe ve Raporlama

### 28.1 Ledger Kurali
Her finansal hareket immutable ledger kaydina yazilir:
- deposit
- withdrawal (ileride)
- buy
- sell
- fee
- premium_payment
- referral_reward

### 28.2 Gun Sonu Mutabakat
- Onchain tx hash ile ledger kayitlari eslenir.
- Eslesmeyen kayitlar reconciliation queue'ya atilir.
- Finans raporu:
  - gross volume
  - net fee income
  - premium revenue

### 28.3 PnL Hesap Standardi
- Cost basis: weighted average (MVP) veya FIFO (opsiyon)
- Realized: satilan kisimdan
- Unrealized: mark price ile anlik
- Total: realized + unrealized

## 29) Uygulama Ici Contract Konfigurasyonu (Base)

### 29.1 Zorunlu Config Degerleri
- `BASE_CHAIN_ID=8453`
- `USDC_BASE_CONTRACT=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- `TRADE_EXECUTOR_CONTRACT=<deploy_edilecek>`
- `SUBSCRIPTION_MANAGER_CONTRACT=<deploy_edilecek>`
- `FEE_TREASURY_ADDRESS=<deploy_edilecek>`

### 29.2 RPC ve Provider
- `BASE_RPC_PRIMARY`
- `BASE_RPC_SECONDARY`
- `BASE_RPC_TIMEOUT_MS`

### 29.3 Risk Config
- `MAX_SLIPPAGE_BPS`
- `MAX_ORDER_USDC`
- `MIN_POOL_LIQUIDITY_USDC`
- `BLOCKED_TOKENS[]`

## 30) Uygulama Gelistirme Sirasi (Teknik Backlog)

### Sprint A - Core Infra
- TS backend migration
- PostgreSQL + Prisma
- Redis + BullMQ
- Auth hardening

### Sprint B - Wallet + Token Search
- Smart wallet create/link
- Wallet listing API
- Token metadata pipeline
- Contract paste UX hardening

### Sprint C - Quote + Execute
- quote endpoint
- onchain execute endpoint
- fee treasury flow
- tx confirmation worker

### Sprint D - Social + Feed
- event ingestion
- ranking v1
- token note moderation
- following feed

### Sprint E - Premium + Copy
- onchain premium payment
- copy config/risk engine
- follower execution jobs
- paywall enforcement

### Sprint F - Referrals + Launch
- referral rewards
- analytics dashboard
- load test
- security audit remediation

## 31) Mini App Manifest ve Yayin Plani (Farcaster + Base App)

Bu bolum MVP'den production'a gecerken mini app'in platformlara dogru sekilde tanitilmasi icin zorunlu checklist'i icerir.

### 31.1 Mevcut Dosya
- Manifest yolu: `/.well-known/farcaster.json`
- Repo dosyasi: `.well-known/farcaster.json`
- Su an bu dosya **placeholder** degerler iceriyor (`example.com`, `REPLACE_WITH_*`).
- Canliya cikmadan once tum alanlar gercek domain, gorsel ve webhook ile degistirilmelidir.

### 31.2 Farcaster Manifest Zorunlu Alanlar
`accountAssociation`:
- `header`
- `payload`
- `signature`

`frame`:
- `version` (su an `1`)
- `name`
- `homeUrl`
- `iconUrl`
- `imageUrl`
- `buttonTitle`
- `splashImageUrl`
- `splashBackgroundColor`
- `webhookUrl`

### 31.3 Domain ve HTTPS Gereksinimleri
- Tum URL'ler `https://` olmak zorunda.
- `homeUrl`, `iconUrl`, `imageUrl`, `splashImageUrl`, `webhookUrl` ayni guvenilir domain'de tutulmali.
- CDN kullanilacaksa cache invalidation plani tanimlanmali.

### 31.4 Yayin Oncesi Teknik Checklist
1. `/.well-known/farcaster.json` endpoint'i 200 donuyor mu?
2. JSON valid mi? (syntax + field completeness)
3. `homeUrl` mini app ana sayfasini aciyor mu?
4. `iconUrl`, `imageUrl`, `splashImageUrl` mobilde dogru oranla aciliyor mu?
5. `webhookUrl` imza dogrulamasi ile event aliyor mu?
6. Login akisi:
   - Farcaster login
   - Base login
   - hesap birlestirme
7. Onchain akisi:
   - quote
   - execute-onchain
   - tx explorer link
8. Bildirim akisi:
   - in-app
   - farcaster/base push
9. Rate-limit + idempotency testleri gecti mi?
10. Premium/copy trade gate dogru mu?

### 31.5 Base App Yayin Notlari
Base App tarafta da mini app metadata'si ile tutarlilik korunmali:
- App adi, icon, aciklama metni Farcaster ile ayni olmalı.
- Deep-link / entry URL tek bir canonical `homeUrl` uzerinden yonetilmeli.
- Login callback/redirect URL'leri prod domain'e sabitlenmeli.
- Smart Wallet baglantisi ve Base chain parametreleri dogrulanmali.

### 31.6 Guvenlik ve Operasyon
- `SERVER_SIGNER_PRIVATE_KEY` asla repoya yazilmaz.
- Production'da signer icin HSM/KMS hedeflenir.
- Webhook endpoint'inde imza/nonce/timestamp dogrulamasi yapilir.
- Failover RPC listesi (primary + fallback) tanimlanir.
- Monitoring:
  - webhook hata orani
  - onchain tx success rate
  - premium activation success rate

### 31.7 Release Sirasi (Onerilen)
1. Staging domain + staging farcaster.json
2. Base Sepolia smoke testleri
3. Farcaster test distribution
4. Mainnet contract adresi + prod env freeze
5. Production farcaster.json update
6. Kademeli rollout (10% -> 50% -> 100%)

### 31.8 Bu Repo Icin Somut Yapilacaklar
- `.well-known/farcaster.json` icindeki su alanlar guncellenecek:
  - `REPLACE_WITH_HEADER`
  - `REPLACE_WITH_PAYLOAD`
  - `REPLACE_WITH_SIGNATURE`
  - `https://example.com` URL'leri
- `homeUrl` app'in canli domain'i olacak.
- `webhookUrl` backend production endpoint'ine alinacak.
- Deploy sonrasi dogrulama:
  - `GET /.well-known/farcaster.json`
  - mini app launch
  - webhook event receipt

### 31.9 Done Kriteri
- Her iki platformdan (Farcaster + Base App) mini app acilabiliyor.
- Login, trade, copy trade, bildirim akislari production ortamda calisiyor.
- Manifest dogrulamasi ve medya asset kalite kontrolu tamamlandi.
