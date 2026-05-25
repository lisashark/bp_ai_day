// ===== 設定 =====

// Spreadsheet ID 請存在 Apps Script 的 Script Properties，不要寫在這裡
// 設定方式：Apps Script 編輯器 → 專案設定 → 指令碼屬性 → 新增 SPREADSHEET_ID
const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
const SHEET_EMPLOYEES = '全體職員';
const SHEET_SLOTS = '時段選項';
const SHEET_RESULTS = '結果';
const MAX_PER_SLOT = 8;


function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== GET：取得時段列表 =====
function doGet(e) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // 從結果表統計各時段實際人數，避免依賴 Sheet 公式的延遲
    const resultRows = ss.getSheetByName(SHEET_RESULTS).getDataRange().getValues();
    const countMap = {};
    resultRows.slice(1).forEach((row) => {
      const slot = String(row[4]).trim();
      if (slot) countMap[slot] = (countMap[slot] || 0) + 1;
    });

    const rows = ss.getSheetByName(SHEET_SLOTS).getDataRange().getValues();
    const slots = rows.slice(1).map((row) => {
      const time = String(row[0]).trim();
      return {
        time,
        count: countMap[time] || 0,
        max: MAX_PER_SLOT,
        status: row[2],
      };
    });

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

    if (!name || !department || !empId || !timeSlot || !role) {
      return jsonResponse({ success: false, error: 'missing_fields' });
    }

    const VALID_ROLES = ['PM', 'SA', 'PG', '業務', '客服', '行政'];
    if (!VALID_ROLES.includes(role)) {
      return jsonResponse({ success: false, error: 'invalid_role' });
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // 1. 驗證員工資料（Lock 外執行，不影響名額競爭）
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

    // 2-4. 用 Script Lock 保護名額檢查與寫入，防止超額報名
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000); // 最多等 10 秒
    } catch (lockErr) {
      return jsonResponse({ success: false, error: 'server_busy', message: '系統忙碌，請稍後再試' });
    }

    try {
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

      // 3. 確認時段未額滿（直接從結果表計算，避免公式延遲）
      const currentCount = resultRows.slice(1).filter((row) =>
        String(row[4]).trim() === timeSlot.trim()
      ).length;

      if (currentCount >= MAX_PER_SLOT) {
        return jsonResponse({ success: false, error: 'slot_full' });
      }

      // 確認時段名稱有效
      const slotsSheet = ss.getSheetByName(SHEET_SLOTS);
      const slotRows = slotsSheet.getDataRange().getValues();
      const slotExists = slotRows.slice(1).some((row) =>
        String(row[0]).trim() === timeSlot.trim()
      );

      if (!slotExists) {
        return jsonResponse({ success: false, error: 'slot_not_found' });
      }

      // 4. 寫入結果
      const now = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
      resultsSheet.appendRow([now, name, department, empId, timeSlot, role]);

      return jsonResponse({ success: true });

    } finally {
      lock.releaseLock();
    }

  } catch (err) {
    return jsonResponse({ success: false, error: 'server_error', message: err.message });
  }
}
