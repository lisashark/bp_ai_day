# 比賽報名系統

現代化、可愛風報名網站，串接 Google Sheets 作為資料庫，部署於 GitHub Pages。

---

## 一、建立 Google Sheet

1. 前往 [Google Sheets](https://sheets.google.com) 新建一份試算表
2. 記下網址列中的 **試算表 ID**（`/d/` 和 `/edit` 之間那段字串）
3. 在試算表中建立以下三個分頁（Sheet Tab）：

### 全體職員
| 姓名 | 部門 | 員編 |
|------|------|------|
| 王小明 | 電子商務部 | E001 |
| 李小花 | 數據加值部 | E002 |

### 時段選項
| 時段 | 已選人數 | 狀態 |
|------|---------|------|
| 09:00 - 09:30 | 0 | 可選 |
| 09:30 - 10:00 | 0 | 可選 |
| 10:00 - 10:30 | 0 | 可選 |
| 10:30 - 11:00 | 0 | 可選 |
| 11:00 - 11:30 | 0 | 可選 |
| 11:30 - 12:00 | 0 | 可選 |
| 13:00 - 13:30 | 0 | 可選 |
| 13:30 - 14:00 | 0 | 可選 |
| 14:00 - 14:30 | 0 | 可選 |
| 14:30 - 15:00 | 0 | 可選 |

### 結果
| 送出時間 | 姓名 | 部門 | 員編 | 選擇時段 | 角色 |
|---------|------|------|------|---------|------|
（空白，系統自動填入）

---

## 二、部署 Google Apps Script

1. 在 Google Sheet 中點上方選單 **「擴充功能」→「Apps Script」**
2. 刪除預設內容，把 `google-apps-script/Code.gs` 的全部內容貼上
3. 把第 5 行的 `YOUR_GOOGLE_SHEET_ID` 換成你在步驟一記下的 ID
4. 點上方 **「部署」→「新增部署作業」**
5. 類型選 **「網頁應用程式」**
6. 執行身分：**「我（你的帳號）」**
7. 誰可以存取：**「所有人」**
8. 點「部署」，複製生成的 **Web App URL**

---

## 三、填入 Web App URL

開啟 `js/app.js`，找到第 3 行，把 URL 貼進去：

```js
const GAS_URL = 'https://script.google.com/macros/s/XXXXXXX/exec';
```

---

## 四、本機預覽

```bash
npm install        # 第一次需要執行
npm run watch      # 自動監聽 SCSS 變更並重新編譯
```

直接用瀏覽器開啟 `index.html` 即可預覽。

---

## 五、部署到 GitHub Pages

1. 在 GitHub 建立新 Repository（建議命名 `registration-system`）
2. 把這個資料夾推上去：
   ```bash
   git init
   git add .
   git commit -m "init"
   git branch -M main
   git remote add origin https://github.com/你的帳號/registration-system.git
   git push -u origin main
   ```
3. 在 GitHub Repository 設定中：
   - 前往 **Settings → Pages**
   - Source 選 **「GitHub Actions」**
4. Push 後，GitHub Actions 會自動編譯 SCSS 並部署
5. 完成後網址為：`https://你的帳號.github.io/registration-system/`

---

## 檔案結構

```
├── index.html                  # 報名表單頁面
├── scss/
│   └── main.scss               # SCSS 樣式原始檔
├── css/
│   └── main.css                # 編譯後的 CSS（勿手動修改）
├── js/
│   └── app.js                  # 前端邏輯
├── google-apps-script/
│   └── Code.gs                 # 後端（部署到 Google Apps Script）
├── .github/workflows/
│   └── deploy.yml              # GitHub Actions 自動部署設定
└── package.json
```
