<?php 
return [
  'maxRetriesToolTip' => '잠금 전에 허용되는 최대 실패 시도 횟수',
  'extendLockoutToolTip' => '첫 번째 잠금 후 잠금 시간 연장',
  'emailNotificationToolTip' => '(잠금 횟수) 이후 잠금. 이메일 알림을 비활성화하려면 0',
  'ipToolTip' => 'IP를 한 줄에 하나씩 입력하세요.',
  'loginExpiry' => '귀하의 계정이 만료되었습니다. 관리자에게 문의하세요.',
  'sessionDriverRequired' => '세션 드라이버를 데이터베이스로 설정하십시오. 그렇지 않으면 이 기능이 작동하지 않습니다. :setting에서 데이터베이스로 변경할 수 있습니다.',
  'maxRetries' => '최대 재시도 횟수에 도달했습니다. 1회 후에 다시 시도해 주세요.',
  'ipRequired' => 'IP 확인을 활성화하려면 IP 주소를 입력하세요.',
  'blacklistEmail' => '귀하의 이메일은 블랙리스트에 등록되어 있습니다. 관리자에게 문의하세요.',
  'blacklistIp' => '귀하의 IP가 블랙리스트에 등록되어 있습니다. 관리자에게 문의하세요.',
  'infoBox' => [
    'lockoutForMinutes' => ' :lockoutTime분 동안 :maxRetries회 실패하면 사용자가 잠깁니다.',
    'extendedLockout' => '잠금 시간은 첫 번째 잠금 이후 1시간으로 연장됩니다.',
    'maxLockoutsAvailable' => '허용되는 최대 잠금은 :maxLockouts입니다.',
    'resetRetries' => '재시도는 1시간 후에 재설정됩니다.',
    'alertAfterLockouts' => ' :alertAfterLockouts이 :email로 잠긴 후 이메일 알림이 전송됩니다.',
    'sendEmailDifferentIp' => '다른 IP에서 로그인하면 이메일 알림을 보냅니다. :ip.',
    'notSendEmailDifferentIp' => '다른 IP에서 로그인하는 경우 이메일 알림을 보내지 않습니다.',
  ],
];