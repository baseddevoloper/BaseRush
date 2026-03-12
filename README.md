# BaseRush

Mobil-first, FOMO-benzeri sosyal trader arena prototipi.

Slogan: **Trade Fast. Move First.**

## Ozellikler
- Farcaster veya Base ile tek giris
- Ana akis: kim ne alip satiyor, canli PnL kartlari
- Cuzdanim: USDC bakiye, depozito, acik pozisyonlar
- Takip ettiklerim + bildirim merkezi
- Premium ($20/ay USDC) ve copy trade kilidi
- React + Tailwind + shadcn/ui tabanli yeni arayuz (`web/`)

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
- Bu MVP bir prototiptir; onchain cagrilar ve custody guvenligi mock edilmi�tir.
- Uretimde HSM, key management, AML/KYC ve reg�lasyon uyumlulugu eklenmelidir.
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
```

Kontrol endpointi:
- `GET /api/onchain/config` -> config hazir mi gorursun.

Onchain endpointler:
- `POST /api/trade/execute-onchain`
- `POST /api/copytrade/execute-onchain`
- `GET /api/onchain/tx?txHash=...`

Not:
- Config eksikse sistem otomatik `ONCHAIN_MOCK` moduna duser.
- Canli kullanimda signer private key yerine KMS/HSM tercih edilmelidir.

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
