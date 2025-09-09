<?php 
return [
  'maxRetriesToolTip' => 'Máximo de intentos fallidos permitidos antes del bloqueo',
  'extendLockoutToolTip' => 'Ampliar el tiempo de bloqueo después del primer bloqueo',
  'emailNotificationToolTip' => 'Después de (n° de bloqueos) bloqueos. 0 para desactivar la notificación por correo electrónico',
  'ipToolTip' => 'Introduce una IP por línea',
  'loginExpiry' => 'Su cuenta ha caducado. Por favor contacte al administrador.',
  'sessionDriverRequired' => 'Configure el controlador de sesión en la base de datos. De lo contrario, esta característica no funcionará. Puede cambiar a base de datos desde :setting.',
  'maxRetries' => 'Has alcanzado el máximo de reintentos. Inténtelo de nuevo después de :time.',
  'ipRequired' => 'Ingrese la dirección IP si desea habilitar la verificación de IP.',
  'blacklistEmail' => 'Su correo electrónico está en la lista negra. Por favor contacte al administrador.',
  'blacklistIp' => 'Tu IP está en la lista negra. Por favor contacte al administrador.',
  'infoBox' => [
    'lockoutForMinutes' => 'El usuario se bloqueará después de :maxRetries intentos fallidos durante :lockoutTime minutos.',
    'extendedLockout' => 'El tiempo de bloqueo se ampliará a :extendedLockoutTime horas después del primer bloqueo.',
    'maxLockoutsAvailable' => 'Los bloqueos máximos permitidos son :maxLockouts.',
    'resetRetries' => 'Los reintentos se restablecerán después de :resetRetries horas.',
    'alertAfterLockouts' => 'Se enviará una notificación por correo electrónico después de los bloqueos de :alertAfterLockouts a :email.',
    'sendEmailDifferentIp' => 'Enviar notificación por correo electrónico si inicia sesión desde una IP diferente :ip.',
    'notSendEmailDifferentIp' => 'No envíe notificaciones por correo electrónico si inicia sesión desde una IP diferente.',
  ],
];