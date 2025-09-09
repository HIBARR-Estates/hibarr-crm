<?php 
return [
  'maxRetriesToolTip' => '鎖定前允許的最大失敗嘗試次數',
  'extendLockoutToolTip' => '首次鎖定後延長鎖定時間',
  'emailNotificationToolTip' => '在（停工次數）停工之後。 0 停用電子郵件通知',
  'ipToolTip' => '每行輸入一個IP',
  'loginExpiry' => '您的帳戶已過期。請聯絡管理員。',
  'sessionDriverRequired' => '請將會話驅動程式設定為資料庫。否則，該功能將無法使用。您可以從 :setting 變更為資料庫。',
  'maxRetries' => '您已達到最大重試次數。請在 :time 後重試。',
  'ipRequired' => '如果要啟用IP檢查，請輸入IP位址。',
  'blacklistEmail' => '您的電子郵件已被列入黑名單。請聯絡管理員。',
  'blacklistIp' => '您的IP已被列入黑名單。請聯絡管理員。',
  'infoBox' => [
    'lockoutForMinutes' => '嘗試 :maxRetries 次失敗後，使用者將被鎖定 :lockoutTime 分鐘。',
    'extendedLockout' => '首次鎖定後鎖定時間將延長至 :extendedLockoutTime 小時。',
    'maxLockoutsAvailable' => '允許的最大鎖定次數為 :maxLockouts。',
    'resetRetries' => '重試次數將在 :resetRetries 小時後重設。',
    'alertAfterLockouts' => ' :alertAfterLockouts 鎖定後，將向 :email 發送電子郵件通知。',
    'sendEmailDifferentIp' => '如果從不同的 IP 登錄，發送電子郵件通知 :ip。',
    'notSendEmailDifferentIp' => '如果從不同的 IP 登錄，則不發送電子郵件通知。',
  ],
];