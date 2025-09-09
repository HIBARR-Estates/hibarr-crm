<?php 
return [
  'maxRetriesToolTip' => 'ロックアウトまでに許容される失敗試行の最大数',
  'extendLockoutToolTip' => '最初のロックアウト後のロックアウト時間を延長する',
  'emailNotificationToolTip' => '(ロックアウト回数) 回のロックアウト後。 0: 電子メール通知を無効にする',
  'ipToolTip' => '1 行に 1 つの IP を入力します',
  'loginExpiry' => 'アカウントの有効期限が切れています。管理者に連絡してください。',
  'sessionDriverRequired' => 'セッションドライバーをデータベースに設定してください。そうしないと、この機能は動作しません。 :settingからデータベースに変更できます。',
  'maxRetries' => '最大再試行回数に達しました。 :time 後にもう一度お試しください。',
  'ipRequired' => 'IPチェックを有効にする場合はIPアドレスを入力してください。',
  'blacklistEmail' => 'あなたのメールはブラックリストに登録されています。管理者に連絡してください。',
  'blacklistIp' => 'あなたの IP はブラックリストに登録されています。管理者に連絡してください。',
  'infoBox' => [
    'lockoutForMinutes' => ' :lockoutTime 分間試行が 1 回失敗すると、ユーザーはロックアウトされます。',
    'extendedLockout' => '最初のロックアウト後、ロックアウト時間は 1 時間に延長されます。',
    'maxLockoutsAvailable' => '許可されるロックアウトの最大数は :maxLockouts です。',
    'resetRetries' => '再試行は :resetRetries 時間後にリセットされます。',
    'alertAfterLockouts' => ' :alertAfterLockouts から :email へのロックアウト後に電子メール通知が送信されます。',
    'sendEmailDifferentIp' => '異なるIP :ipからログインした場合にメール通知を送信します。',
    'notSendEmailDifferentIp' => '異なる IP からログインした場合は電子メール通知を送信しません。',
  ],
];