<?php 
return [
  'maxRetriesToolTip' => 'Nombre maximal de tentatives infructueuses autorisées avant le verrouillage',
  'extendLockoutToolTip' => 'Prolonger le temps de verrouillage après le premier verrouillage',
  'emailNotificationToolTip' => 'Après (nombre de verrouillages) verrouillages. 0 pour désactiver la notification par e-mail',
  'ipToolTip' => 'Entrez une IP par ligne',
  'loginExpiry' => 'Votre compte a expiré. Veuillez contacter l\'administrateur.',
  'sessionDriverRequired' => 'Veuillez définir le pilote de session sur la base de données. Sinon, cette fonctionnalité ne fonctionnera pas. Vous pouvez passer à la base de données à partir de :setting.',
  'maxRetries' => 'Vous avez atteint le nombre maximum de tentatives. Veuillez réessayer après :time.',
  'ipRequired' => 'Veuillez saisir l\'adresse IP si vous souhaitez activer la vérification IP.',
  'blacklistEmail' => 'Votre email est sur liste noire. Veuillez contacter l\'administrateur.',
  'blacklistIp' => 'Votre IP est sur liste noire. Veuillez contacter l\'administrateur.',
  'infoBox' => [
    'lockoutForMinutes' => 'L\'utilisateur se verrouille après :maxRetries tentatives infructueuses pendant :lockoutTime minutes.',
    'extendedLockout' => 'Le temps de verrouillage sera prolongé à :extendedLockoutTime heures après le premier verrouillage.',
    'maxLockoutsAvailable' => 'Les verrouillages maximum autorisés sont :maxLockouts.',
    'resetRetries' => 'Les tentatives seront réinitialisées après :resetRetries heures.',
    'alertAfterLockouts' => 'Une notification par e-mail sera envoyée après les verrouillages :alertAfterLockouts à :email.',
    'sendEmailDifferentIp' => 'Envoyer une notification par e-mail si vous vous connectez à partir d\'une adresse IP différente :ip.',
    'notSendEmailDifferentIp' => 'N\'envoyez pas de notification par e-mail si vous vous connectez à partir d\'une adresse IP différente.',
  ],
];