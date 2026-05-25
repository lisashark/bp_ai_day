// ===== 設定 =====
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxLau4f3MbiA7Aj8wzl3ajwmpY8uPoLJV4HND0Lsvtel67i5IIzXiDJRbBUI24zao0/exec';

// 本機測試開關：true = 不打 API，直接模擬成功（上線前改回 false）
const DEV_MODE = false;

// ===== DOM 參考 =====
const form = document.getElementById('registrationForm');
const timeSlotsContainer = document.getElementById('timeSlotsContainer');
const submitBtn = document.getElementById('submitBtn');
const btnText = submitBtn.querySelector('.btn-text');
const btnLoading = submitBtn.querySelector('.btn-loading');
const successScreen = document.getElementById('successScreen');
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalMsg = document.getElementById('modalMsg');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalXBtn = document.getElementById('modalXBtn');
const modalNotice = document.getElementById('modalNotice');

// ===== 載入時段 =====
// 時段設定來自 time-options.json，人數由 Google Sheet 即時提供
async function loadTimeSlots() {
  // 1. 從 time-options.json 讀取時段設定（可自由增刪時段、調整上限）
  let configSlots = [];
  try {
    const res = await fetch('time-options.json');
    const data = await res.json();
    if (data.slots && data.slots.length > 0) {
      configSlots = data.slots.map((s) => ({ ...s, count: 0 }));
    }
  } catch {
    // 抓取失敗，使用空陣列
  }

  // 2. 若已串接 Google Sheet，取得即時報名人數並合併
  if (GAS_URL !== 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL') {
    try {
      const res = await fetch(`${GAS_URL}?action=getSlots`);
      const data = await res.json();
      if (data.slots && data.slots.length > 0) {
        const countMap = Object.fromEntries(data.slots.map((s) => [s.time, s.count]));
        configSlots = configSlots.map((s) => ({
          ...s,
          count: countMap[s.time] ?? 0,
        }));
      }
    } catch {
      // GAS 抓取失敗，人數維持 0
    }
  }

  renderTimeSlots(configSlots);
}

function renderTimeSlots(slots) {
  timeSlotsContainer.innerHTML = '';

  slots.forEach((slot) => {
    const isFull = slot.count >= slot.max;
    const label = document.createElement('label');
    label.className = 'radio-btn' + (isFull ? ' disabled' : '');

    label.innerHTML = `
      <input type="radio" name="timeSlot" value="${slot.time}" ${isFull ? 'disabled' : ''} />
      <span class="radio-label">
        ${slot.time}
        <span class="slot-count">${isFull ? '❌ 已額滿' : `✅ <span class="slot-count-current">${slot.count}</span> / ${slot.max} 人`}</span>
      </span>
    `;

    timeSlotsContainer.appendChild(label);
  });
}

// ===== 表單驗證 =====
function validateForm() {
  let valid = true;
  const fields = ['name', 'department', 'empId'];

  fields.forEach((id) => {
    const el = document.getElementById(id);
    const group = document.getElementById(`group-${id}`);
    if (!el.value.trim()) {
      group.classList.add('has-error');
      valid = false;
    } else {
      group.classList.remove('has-error');
    }
  });

  // 時段
  const timeSlotChecked = form.querySelector('input[name="timeSlot"]:checked');
  const timeSlotGroup = document.getElementById('group-timeSlot');
  if (!timeSlotChecked) {
    timeSlotGroup.classList.add('has-error');
    valid = false;
  } else {
    timeSlotGroup.classList.remove('has-error');
  }

  // 角色
  const roleChecked = form.querySelector('input[name="role"]:checked');
  const roleGroup = document.getElementById('group-role');
  if (!roleChecked) {
    roleGroup.classList.add('has-error');
    valid = false;
  } else {
    roleGroup.classList.remove('has-error');
  }

  return valid;
}

// ===== 清除單欄錯誤（即時回饋）=====
function clearErrorOnInput() {
  ['name', 'empId'].forEach((id) => {
    document.getElementById(id).addEventListener('input', () => {
      document.getElementById(`group-${id}`).classList.remove('has-error');
    });
  });

  document.getElementById('department').addEventListener('change', () => {
    document.getElementById('group-department').classList.remove('has-error');
  });

  form.addEventListener('change', (e) => {
    if (e.target.name === 'timeSlot') {
      document.getElementById('group-timeSlot').classList.remove('has-error');
    }
    if (e.target.name === 'role') {
      document.getElementById('group-role').classList.remove('has-error');
    }
  });
}

// ===== 送出表單 =====
async function submitForm(payload) {
  if (DEV_MODE) {
    return { success: true };
  }

  // Content-Type 用 text/plain 避免 CORS preflight（GAS 不處理 OPTIONS）
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'submit', ...payload }),
  });
  return await res.json();
}

// ===== 顯示 Modal =====
function showModal(title, msg, notice = null) {
  modalTitle.textContent = title;
  modalMsg.innerHTML = msg;
  if (notice) {
    modalCloseBtn.hidden = true;
    modalNotice.textContent = notice;
    modalNotice.hidden = false;
  } else {
    modalCloseBtn.hidden = false;
    modalNotice.hidden = true;
  }
  modalOverlay.hidden = false;
}

function hideModal() {
  modalOverlay.hidden = true;
}

// ===== 設定送出狀態 =====
function setSubmitting(loading) {
  submitBtn.disabled = loading;
  btnText.hidden = loading;
  btnLoading.hidden = !loading;
}

// ===== 顯示成功畫面 =====
function showSuccess(payload) {
  form.closest('.form-container').hidden = true;
  document.querySelector('.site-header').hidden = true;
  successScreen.hidden = false;

  document.getElementById('successInfo').innerHTML = `
    <p><strong>姓名：</strong>${payload.name}</p>
    <p><strong>部門：</strong>${payload.department}</p>
    <p><strong>員編：</strong>${payload.empId}</p>
    <p><strong>時段：</strong>${payload.timeSlot}</p>
    <p><strong>角色：</strong>${payload.role}</p>
  `;
}

// ===== 事件：送出 =====
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!validateForm()) return;

  const payload = {
    name: document.getElementById('name').value.trim(),
    department: document.getElementById('department').value,
    empId: document.getElementById('empId').value.trim(),
    timeSlot: form.querySelector('input[name="timeSlot"]:checked').value,
    role: form.querySelector('input[name="role"]:checked').value,
  };

  setSubmitting(true);

  try {
    const result = await submitForm(payload);

    if (result.success) {
      showSuccess(payload);
    } else if (result.error === 'already_registered') {
      showModal('已完成報名', `您已經報名過了！<br><br>時段：${result.timeSlot}<br>角色：${result.role}`, '若需調整，請聯繫 事推-文珊');
    } else if (result.error === 'invalid_employee') {
      showModal('送出失敗', '您的資料填寫錯誤，請再次確認姓名、員編、部門是否正確。');
    } else if (result.error === 'slot_full') {
      showModal('送出失敗', '很抱歉，您選擇的時段已額滿，請重新選擇。');
      // 重新載入時段以更新狀態
      loadTimeSlots();
      // 清除已選時段
      const checked = form.querySelector('input[name="timeSlot"]:checked');
      if (checked) checked.checked = false;
    } else {
      showModal('送出失敗', result.message || '系統發生錯誤，請稍後再試。');
    }
  } catch {
    showModal('送出失敗', '網路連線異常，請確認網路後再試。');
  } finally {
    setSubmitting(false);
  }
});

// ===== 事件：關閉 Modal =====
modalCloseBtn.addEventListener('click', hideModal);
modalXBtn.addEventListener('click', hideModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) hideModal();
});

// ===== 初始化 =====
clearErrorOnInput();
loadTimeSlots();
