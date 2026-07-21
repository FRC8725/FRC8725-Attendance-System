# Workshop 點名系統（NFC 學生證 + Firebase）

原生 HTML / CSS / ES Modules 的深色 SPA，依照 `DESIGN-SPEC.md` 的 Shell、色彩、元件與響應式規則實作。功能：以 Android 手機的 NFC 感應學生證進行點名，資料存在 Firebase Firestore；讀卡/場次/成員管理需輸入共用密碼才能進入，資料匯總頁不需要密碼。

## 目錄結構

```
project/
├── index.html
├── pages/            # summary / scan / sessions / members / lock 五個 fragment
├── js/
│   ├── core/          main.js、router.js（Hash Router）、shell.js（側欄）
│   ├── services/       firebase-config.js、db.js（Firestore CRUD）、
│   │                    auth-gate.js（密碼鎖）、nfc.js（Web NFC）
│   ├── pages/           每頁的 mountPage(context) 控制器
│   ├── ui/              toast.js、modal.js
│   └── utils/           format.js、icon.js
├── css/                theme / layout / components / attendance
├── config/app-config.json   側欄選單與摘要卡片文字（可自行調整，不需要改程式碼）
├── images/icons/*.svg   外部 SVG 圖示，以 CSS mask 呈色
└── firestore.rules      建議的 Firestore 安全規則
```

## 重要限制：Web NFC

- 只有 **Android 手機上的 Chrome 瀏覽器**支援 Web NFC（`NDEFReader`），iOS 與桌面瀏覽器都無法使用「點名讀卡」頁。
- 必須是 **HTTPS**（或 `localhost`）環境，否則 NFC API 會直接失敗；純用 `file://` 開啟 `index.html` 也不會動作。
- 網頁只能讀到學生證 NFC 晶片的**序號（UID）**，讀不到卡片內受保護的學號等資料。因此系統用「UID ↔ 成員」的對應表來辨識身分：
  - 可以先到「成員管理」預先登記每張卡的 UID；
  - 也可以直接在「點名讀卡」感應到陌生卡片時，現場輸入姓名建立成員（系統會記住這張卡的 UID，之後同一張卡就能直接辨識）。
- 開始感應必須由使用者實際點擊按鈕觸發（瀏覽器規定的使用者手勢限制），無法在頁面載入時自動開始。

## 開發用「模擬模式」（無 NFC 硬體也能測試）

在電腦瀏覽器上開發時沒有 NFC 硬體，可以用網址加上查詢參數觸發模擬模式，跳過真實 Web NFC，改用手動輸入卡號測試整套簽到流程：

```
https://你的網址/#/scan?demo=1
```

模擬模式下，讀卡頁會顯示「模擬模式 DEMO」標籤與提示橫幅，原本的「開始感應」按鈕會換成一個卡號輸入框（可從已登記成員中自動帶出選項）與「模擬感應」按鈕，按下後會走跟真實感應完全相同的邏輯（比對成員、記錄簽到、彈出新成員建立表單等），方便在電腦上測試而不必真的用手機感應。**正式使用時網址不要帶這個參數**，一般點名時仍須用 Android 手機的 Chrome 進行真實 NFC 感應。

## 調整隊伍識別（Logo／隊名）

側欄與手機頂欄左上角的隊徽、隊名、副標題都在 `config/app-config.json` 的 `brand` 欄位設定：

```json
"brand": {
  "name": "Team 8725",
  "subtitle": "Misty Panther · Workshop",
  "logo": "images/brand/team-logo.png"
}
```

要換 logo 圖片，把新圖片放進 `images/brand/` 資料夾並更新 `logo` 路徑即可，不需要改任何程式碼。手機版（≤768px）為了節省橫向空間，只會顯示隊名，不顯示副標題與導覽文字（導覽列在手機上改為純圖示）。

## Firebase 設定步驟

1. 到 [Firebase Console](https://console.firebase.google.com/) 建立新專案，啟用 **Firestore Database**（正式環境模式即可，稍後會套用 `firestore.rules`）。
2. 專案設定 → 一般 → 新增網頁應用程式，取得設定物件，貼到 `js/services/firebase-config.js` 的 `firebaseConfig`。
3. 部署 `firestore.rules`（可用 Firebase CLI：`firebase deploy --only firestore:rules`，或直接貼到 Console 的規則編輯器）。
4. 到 Firestore Console 手動建立一份文件：collection `settings`、文件 ID `app`，欄位 `readPassword`（字串），填入你要用的共用密碼。這一步刻意不開放從網頁寫入，避免密碼被任何前端程式改掉。
5. 建議直接用 **Firebase Hosting** 部署整個 `project/` 資料夾：Hosting 預設就是 HTTPS，同時滿足 Web NFC 的安全環境要求，也方便手機直接開網址使用。

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init hosting   # public 目錄選這個 project 資料夾
   firebase deploy
   ```

### 關於密碼機制的安全性

這是「單一共用密碼」方案，密碼存在 Firestore、由前端直接讀出比對，**不是** Firebase Authentication 等級的身分驗證，只能當作降低隨手誤用的門檻。`firestore.rules` 已將 `settings` 設為禁止任何用戶端寫入、但仍需要開放讀取才能比對，這是此方案本質上的取捨。如果之後需要更嚴謹的保護（例如公開網址、擔心密碼被找到），建議改用 Firebase Authentication 帳號登入，我可以再協助調整。

## 本機開發

純靜態檔案，但 ES Modules 需要透過 HTTP(S) 而非 `file://` 開啟，也建議用手機在同一網路下用 HTTPS 測試 NFC。最簡單的方式：

```bash
npx serve project        # 或 python3 -m http.server 5173 -d project
```

若要在手機上測試 NFC，仍需部署到有 HTTPS 的網址（Firebase Hosting 最方便），或使用 `ngrok` 之類的工具建立臨時 HTTPS 通道。

## 資料模型（Firestore）

| Collection | 欄位 | 說明 |
|---|---|---|
| `settings/app` | `readPassword` | 共用密碼，僅可讀取，需由後台維護 |
| `members/{id}` | `name`, `cardUID`, `note`, `createdAt` | 成員與其學生證 UID 對應 |
| `sessions/{id}` | `name`, `date`, `note`, `createdAt` | 點名場次（活動） |
| `attendance/{id}` | `sessionId`, `memberId`, `memberName`, `cardUID`, `checkedInAt` | 每筆簽到紀錄；同一場次同一成員只會建立一筆 |

## 頁面與密碼保護

| 路由 | 頁面 | 需要密碼 |
|---|---|---|
| `#/summary` | 資料匯總（三欄：場次列表／出席名單／統計卡片） | 否 |
| `#/scan` | 點名讀卡（NFC 感應，手機優化） | 是 |
| `#/sessions` | 場次管理 | 是 |
| `#/members` | 成員管理（含 UID 登記） | 是 |

解鎖狀態存在 `sessionStorage`，關閉分頁或重新整理瀏覽器分頁群組後會需要重新輸入；側欄底部也提供「重新鎖定」按鈕可手動鎖回。

## 調整文案與選單

`config/app-config.json` 集中管理側欄選單文字、圖示與資料匯總頁的統計卡片標籤，不需要改 JavaScript 就能調整顯示內容，符合設計規範第 12 節「JSON 驅動設定」的原則。
