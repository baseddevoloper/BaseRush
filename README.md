# BaseRush

Mobil-first, FOMO-benzeri sosyal trader arena prototipi.

Slogan: **Trade Fast. Move First.**

## Ozellikler
- Mini app acilisinda otomatik wallet + signature session
- Ana akis: kim ne alip satiyor, canli PnL kartlari
- Cuzdanim: USDC bakiye, depozito, acik pozisyonlar
- Takip ettiklerim + bildirim merkezi
- Premium ($20/ay USDC) ve copy trade kilidi
- React + Tailwind + shadcn/ui tabanli yeni arayuz (`web/`)
- Legacy `app.js`/`app.css` akis devre disi (server sadece `web-dist` servis eder)

## Calistirma
Backend:
```bash
npm start
```

React UI (ayri terminal):
```bash
npm run dev:web
```

- Backend: `http://localhost:3000`
- React UI: `http://localhost:5173`

## Build (React UI)
```bash
npm run build:web
```

## Test
```bash
npm test
```

## Notlar
- Bu MVP bir prototiptir; onchain cagrilar ve custody guvenligi mock edilmiÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¿Ãƒâ€šÃ‚Â½tir.
- Uretimde HSM, key management, AML/KYC ve regÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¿Ãƒâ€šÃ‚Â½lasyon uyumlulugu eklenmelidir.
## Real Onchain Mod (Base RPC + TradeExecutor)
Sunucu varsayilan olarak `ONCHAIN_MOCK` modunda calisir.
Gercek zincir islemi icin su env degiskenlerini ayarla:

```bash
ENABLE_REAL_ONCHAIN=true
BASE_RPC_URL=https://mainnet.base.org
TRADE_EXECUTOR_ADDRESS=0xYourTradeExecutor
SERVER_SIGNER_PRIVATE_KEY=0xYourServerSignerPrivateKey
# opsiyonel:
TRADE_EXECUTOR_FUNCTION=executeTrade
TRADE_EXECUTOR_ABI_JSON=["function executeTrade(address token,uint8 side,uint256 amountUsdc,uint256 minOut,address recipient,bytes32 orderId)"]
ONCHAIN_CONFIRMATIONS=1
ONCHAIN_CONFIRM_TIMEOUT_MS=120000
USDC_BASE_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
USDC_DEPOSIT_RECEIVER=0xYourTradeExecutorAddress
UNISWAP_V3_ROUTER=0x2626664c2603336E57B271c5C0b26F421741e481
AERODROME_ROUTER=0xcf77a3ba9a5ca399b7c97c74d54e5be8d5e8f9f3
AERODROME_FACTORY=0x420DD381b31aEf6683db6B902084cB0FFECe40Da
DEFAULT_UNI_POOL_FEE=500
```

Kontrol endpointi:
- `GET /api/onchain/config` -> config hazir mi gorursun.

Onchain endpointler:
- `POST /api/trade/execute-onchain`
- `POST /api/copytrade/execute-onchain`
- Kontrat: `executeTrade` (uyumluluk) + `executeTradeWithOptions` (Uniswap/Aerodrome)
- `GET /api/onchain/tx?txHash=...`
- `GET /api/balance/deposit-intent`
- `POST /api/balance/deposit-usdc/confirm`

Not:
- Config eksikse sistem otomatik `ONCHAIN_MOCK` moduna duser.
- Gercek modda tx once `submitted` doner; confirm/fail arka planda asenkron islenir.
- Confirm polling parametreleri: `ONCHAIN_CONFIRMATIONS`, `ONCHAIN_CONFIRM_TIMEOUT_MS`.
- Canli kullanimda signer private key yerine KMS/HSM tercih edilmelidir.
- Deposit akisi: mini app wallet -> USDC transfer -> backend tx receipt/log verify -> bakiye kredi.
- Gercek trade icin `USDC_DEPOSIT_RECEIVER` TradeExecutor kontrat adresi olmalidir (kontrat USDC bakiyesi ile swap atar).

- Opsiyonel ABI arg mapping: `TRADE_EXECUTOR_ARGS_TEMPLATE_JSON=["$tokenAddress","$sideInt","$usdcAmount","$minOut","$recipient","$orderId"]`
- Smoke endpoint: `POST /api/onchain/smoke` (tx atmadan kontrat call simule etmek icin).

- CLI smoke komutu: `npm run onchain:smoke` (varsayilan: http://localhost:3000)


## TradeExecutor Deploy (Base)
1. `.env` olustur (`.env.example` kopyasi):
   - `DEPLOYER_PRIVATE_KEY=0x...`
   - `BASE_RPC_URL=https://mainnet.base.org`
2. Kontrati derle:
   - `npm run contract:compile`
3. Base mainnet deploy:
   - `npm run contract:deploy:base`
4. Cikan adresi `.env` icine yaz:
   - `TRADE_EXECUTOR_ADDRESS=0x...`
5. Backend gercek mod:
   - `ENABLE_REAL_ONCHAIN=true`
   - `SERVER_SIGNER_PRIVATE_KEY=0x...`

Not: `SERVER_SIGNER_PRIVATE_KEY` ile `DEPLOYER_PRIVATE_KEY` ayni olabilir ama guvenlik icin ayri signer onerilir.

## Server Signer Bakiye Rehberi (Base ETH)
- Tek bir `executeTrade` tx'si icin tipik gaz: ~120k - 250k.
- 0.02 gwei - 0.2 gwei gaz bandinda tx maliyeti genelde cok dusuktur.
- Operasyonel guvenli tampon onerisi:
  - Test/MVP: en az **0.005 ETH**
  - Rahat calisma: **0.02 ETH**
  - Yogun kullanim: **0.05 ETH+**

Bu bakiye sadece gaz icindir; USDC islem bakiyesi ayri tutulur.

## Mini App Manifest (Farcaster + Base App)
Server artik '/.well-known/farcaster.json' icin iki kaynak destekler:
- Env tabanli dinamik manifest (onerilen, production)
- Repo dosyasi: .well-known/farcaster.json (fallback)

Gerekli env alanlari:
`APP_BASE_URL`, `FC_HOME_URL`, `FC_ICON_URL`, `FC_IMAGE_URL`, `FC_SPLASH_IMAGE_URL`, `FC_WEBHOOK_URL`,
`FC_ACCOUNT_ASSOC_HEADER`, `FC_ACCOUNT_ASSOC_PAYLOAD`, `FC_ACCOUNT_ASSOC_SIGNATURE`

Kontrol endpointleri:
- `GET /.well-known/farcaster.json`
- `GET /api/miniapp/manifest-status`

Manifest durumu ornegi:
`{ source: "env" | "static_file", dynamicEnabled: boolean }`




## Builder Code Attribution (Base)
Server-side onchain tx'lerde builder code otomatik olarak calldata sonuna (ERC-8021 data suffix) eklenir.

Env:
- `BUILDER_CODE=bc_g19kvpy7`
- Opsiyonel override: `BUILDER_DATA_SUFFIX=0x...`

Kontrol:
- `GET /api/onchain/config` -> `builderCode`, `builderSuffixConfigured`

## API Hardening (Prod)
- In-memory rate limit aktif:
  - `RATE_LIMIT_ENABLED=true`
  - `RATE_LIMIT_WINDOW_MS=60000`
  - `RATE_LIMIT_MAX=120`
  - `RATE_LIMIT_TRADE_MAX=30`
- JSON body limit:
  - `BODY_MAX_BYTES=262144`
- Farcaster webhook dogrulama (canli format, resmi SDK):
  - `FC_WEBHOOK_REQUIRE_VERIFY=true`
  - `NEYNAR_API_KEY=...`
  - Endpoint: `POST /api/farcaster/webhook`
  - Sunucu `@farcaster/miniapp-node` ile `parseWebhookEvent(...)` kullanir (JFS body: `header/payload/signature`).
- Production signer guard:
  - Varsayilan: `ALLOW_LOCAL_SIGNER_IN_PROD=false`
  - Bu durumda prod'da local private key signer ile onchain endpointler `503 local_signer_blocked_in_production` doner.
  - Gecici olarak acmak icin: `ALLOW_LOCAL_SIGNER_IN_PROD=true` (onerilmez).

Kontrol:
- `GET /api/onchain/config` -> `signerStrategy` ve `localSignerAllowed` alanlarini doner.
## Neynar Notification Mode (Switch)
Manifest webhook hedefini Neynar event URL'ine cevirmek icin:
- `FC_NOTIFICATION_MODE=neynar`
- `FC_NEYNAR_EVENT_WEBHOOK_URL=https://api.neynar.com/f/app/<APP_ID>/event`

Native moda donmek icin:
- `FC_NOTIFICATION_MODE=native`
- `FC_WEBHOOK_URL=https://baserush.app/api/farcaster/webhook`

Kontrol:
- `GET /api/miniapp/manifest-status` -> `notificationMode`, `webhookUrl`

## Wallet Session (Auto)
- Manuel Connect Wallet butonu yoktur.
- Uygulama acilisinda mini app context icinde otomatik olarak:
  - Signature izni istenir (Farcaster sign-in/quick auth)
  - Wallet baglantisi istenir (Base chain)
- Baglanti tamamlanmadan uygulama icerigi kilitli kalir ve otomatik retry yapar.

## Wallet-Direct Trade (Non-custodial)
Bu modelde kullanici para yatirmaz. Islem kendi cuzdanindan imzalanir:
- tokenIn `transferFrom(user)` ile cekilir
- swap yapilir (Uniswap/Aerodrome)
- fee tokenOut uzerinden treasury'ye kesilir
- kalan tokenOut kullaniciya gider

Yeni kontrat:
- `contracts/UserTradeRouter.sol`

Deploy komutlari:
- `npm run contract:compile`
- `npm run contract:deploy:user-router:base`
- `npm run contract:deploy:user-router:base-sepolia`

Gerekli env:
- `USER_TRADE_ROUTER_ADDRESS=0x...`
- `USER_TRADE_ROUTER_OWNER=0x...` (opsiyonel, default deployer)
- `FEE_TREASURY_ADDRESS=0x...`
- `TRADE_FEE_BPS=100`
- `UNISWAP_V3_ROUTER=0x2626664c2603336E57B271c5C0b26F421741e481`
- `AERODROME_ROUTER=0xcf77a3ba9a5ca399b7c97c74d54e5be8d5e8f9f3`
- `AERODROME_FACTORY=0x420DD381b31aEf6683db6B902084cB0FFECe40Da`
