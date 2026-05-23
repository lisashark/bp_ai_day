// ===== 設定 =====
// 將此腳本部署後，把 Web App URL 填回 js/app.js 的 GAS_URL 變數

const SPREADSHEET_ID = 'YOUR_GOOGLE_SHEET_ID'; // 換成你的 Google Sheet ID
const SHEET_EMPLOYEES = '全體職員';
const SHEET_SLOTS = '時段選項';
const SHEET_RESULTS = '結果';
const MAX_PER_SLOT = 8;

// ===== CORS Headers =====
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== GET：取得時段列表 =====
function doGet(e) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_SLOTS);
    const rows = sheet.getDataRange().getValues();

    // 第一列為標題：時段 | 已選人數 | 狀態
    const slots = rows.slice(1).map((row) => ({
      time: row[0],
      count: Number(row[1]) || 0,
      max: MAX_PER_SLOT,
      status: row[2],
    }));

    return jsonResponse({ slots });
  } catch (err) {
    return jsonResponse({ error: 'server_error', message: err.message });
  }
}

// ===== POST：送出報名 =====
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const { name, department, empId, timeSlot, role } = body;

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // 1. 驗證員工資料
    const empSheet = ss.getSheetByName(SHEET_EMPLOYEES);
    const empRows = empSheet.getDataRange().getValues();
    // 欄位：姓名 | 部門 | 員編（第一列為標題）
    const matched = empRows.slice(1).some((row) =>
      String(row[0]).trim() === name.trim() &&
      String(row[1]).trim() === department.trim() &&
      String(row[2]).trim() === empId.trim()
    );

    if (!matched) {
      return jsonResponse({ success: false, error: 'invalid_employee' });
    }

    // 2. 檢查是否已報名（以員編為唯一識別）
    const resultsSheet = ss.getSheetByName(SHEET_RESULTS);
    const resultRows = resultsSheet.getDataRange().getValues();
    // 欄位：時間戳 | 姓名 | 部門 | 員編 | 時段 | 角色
    const existing = resultRows.slice(1).find((row) =>
      String(row[3]).trim() === empId.trim()
    );

    if (existing) {
      return jsonResponse({
        success: false,
        error: 'already_registered',
        timeSlot: existing[4],
        role: existing[5],
      });
    }

    // 3. 確認時段未額滿
    const slotsSheet = ss.getSheetByName(SHEET_SLOTS);
    const slotRows = slotsSheet.getDataRange().getValues();
    // 欄位：時段 | 已選人數 | 狀態
    let slotRowIndex = -1;
    let currentCount = 0;

    for (let i = 1; i < slotRows.length; i++) {
      if (String(slotRows[i][0]).trim() === timeSlot.trim()) {
        slotRowIndex = i + 1; // Sheets 行號從 1 開始，且有標題列
        currentCount = Number(slotRows[i][1]) || 0;
        break;
      }
    }

    if (slotRowIndex === -1) {
      return jsonResponse({ success: false, error: 'slot_not_found' });
    }

    if (currentCount >= MAX_PER_SLOT) {
      return jsonResponse({ success: false, error: 'slot_full' });
    }

    // 4. 寫入結果（時段選項的人數與狀態由 Sheet 公式自動計算）
    const now = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
    resultsSheet.appendRow([now, name, department, empId, timeSlot, role]);

    return jsonResponse({ success: true });

  } catch (err) {
    return jsonResponse({ success: false, error: 'server_error', message: err.message });
  }
}
