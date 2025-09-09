<?php 
return [
  'maxRetriesToolTip' => '锁定前允许的最大失败尝试次数',
  'extendLockoutToolTip' => '首次锁定后延长锁定时间',
  'emailNotificationToolTip' => '在（停工次数）停工之后。 0 禁用电子邮件通知',
  'ipToolTip' => '每行输入一个IP',
  'loginExpiry' => '您的帐户已过期。请联系管理员。',
  'sessionDriverRequired' => '请将会话驱动程序设置为数据库。否则，该功能将无法使用。您可以从 :setting 更改为数据库。',
  'maxRetries' => '您已达到最大重试次数。请在 :time 后重试。',
  'ipRequired' => '如果要启用IP检查，请输入IP地址。',
  'blacklistEmail' => '您的电子邮件已被列入黑名单。请联系管理员。',
  'blacklistIp' => '您的IP已被列入黑名单。请联系管理员。',
  'infoBox' => [
    'lockoutForMinutes' => '尝试 :maxRetries 次失败后，用户将被锁定 :lockoutTime 分钟。',
    'extendedLockout' => '首次锁定后锁定时间将延长至 :extendedLockoutTime 小时。',
    'maxLockoutsAvailable' => '允许的最大锁定次数为 :maxLockouts。',
    'resetRetries' => '重试将在 :resetRetries 小时后重置。',
    'alertAfterLockouts' => ' :alertAfterLockouts 锁定后，将向 :email 发送电子邮件通知。',
    'sendEmailDifferentIp' => '如果从不同的 IP 登录，发送电子邮件通知 :ip。',
    'notSendEmailDifferentIp' => '如果从不同的 IP 登录，则不发送电子邮件通知。',
  ],
];