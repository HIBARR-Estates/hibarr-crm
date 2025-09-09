<?php 
return [
  'maxRetriesToolTip' => 'Máximo de tentativas falhadas permitidas antes do bloqueio',
  'extendLockoutToolTip' => 'Prolongue o tempo de bloqueio após o primeiro bloqueio',
  'emailNotificationToolTip' => 'Após (nº de bloqueios) bloqueios. 0 para desativar a notificação por e-mail',
  'ipToolTip' => 'Insira um IP por linha',
  'loginExpiry' => 'Sua conta expirou. Entre em contato com o administrador.',
  'sessionDriverRequired' => 'Defina o driver de sessão como banco de dados. Caso contrário, este recurso não funcionará. Você pode mudar para o banco de dados de :setting.',
  'maxRetries' => 'Você atingiu o máximo de tentativas. Por favor, tente novamente depois de :time.',
  'ipRequired' => 'Por favor, insira o endereço IP se desejar ativar a verificação de IP.',
  'blacklistEmail' => 'Seu e-mail está na lista negra. Entre em contato com o administrador.',
  'blacklistIp' => 'Seu IP está na lista negra. Entre em contato com o administrador.',
  'infoBox' => [
    'lockoutForMinutes' => 'O usuário será bloqueado após :maxRetries tentativas malsucedidas por :lockoutTime minutos.',
    'extendedLockout' => 'O tempo de bloqueio será estendido para :extendedLockoutTime horas após o primeiro bloqueio.',
    'maxLockoutsAvailable' => 'O máximo de bloqueios permitidos é :maxLockouts.',
    'resetRetries' => 'As novas tentativas serão redefinidas após :resetRetries horas.',
    'alertAfterLockouts' => 'A notificação por e-mail será enviada após bloqueios de :alertAfterLockouts para :email.',
    'sendEmailDifferentIp' => 'Enviar notificação por e-mail se fizer login em IP :ip diferente.',
    'notSendEmailDifferentIp' => 'Não envie notificação por e-mail se fizer login em um IP diferente.',
  ],
];