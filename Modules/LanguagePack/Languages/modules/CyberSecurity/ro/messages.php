<?php 
return [
  'maxRetriesToolTip' => 'Numărul maxim de încercări eșuate permise înainte de blocare',
  'extendLockoutToolTip' => 'Prelungiți timpul de blocare după prima blocare',
  'emailNotificationToolTip' => 'După (nr. de blocări) blocări. 0 pentru a dezactiva notificarea prin e-mail',
  'ipToolTip' => 'Introduceți un IP pe linie',
  'loginExpiry' => 'Contul dvs. a fost expirat. Vă rugăm să contactați administratorul.',
  'sessionDriverRequired' => 'Vă rugăm să setați driverul de sesiune la baza de date. În caz contrar, această caracteristică nu va funcționa. Puteți trece la baza de date de la :setting.',
  'maxRetries' => 'Ați atins numărul maxim de încercări. Vă rugăm să încercați din nou după :time.',
  'ipRequired' => 'Vă rugăm să introduceți adresa IP dacă doriți să activați verificarea IP.',
  'blacklistEmail' => 'E-mailul dvs. este pe lista neagră. Vă rugăm să contactați administratorul.',
  'blacklistIp' => 'IP-ul tău este pe lista neagră. Vă rugăm să contactați administratorul.',
  'infoBox' => [
    'lockoutForMinutes' => 'Utilizatorul se va bloca după :maxRetries încercări eșuate timp de :lockoutTime minute.',
    'extendedLockout' => 'Timpul de blocare va fi extins la :extendedLockoutTime oră după prima blocare.',
    'maxLockoutsAvailable' => 'Blocările maxime permise sunt :maxLockouts.',
    'resetRetries' => 'Reîncercările vor fi resetate după :resetRetries ore.',
    'alertAfterLockouts' => 'Notificarea prin e-mail va fi trimisă după blocarea :alertAfterLockouts la :email.',
    'sendEmailDifferentIp' => 'Trimiteți o notificare prin e-mail dacă vă conectați de la IP diferit :ip.',
    'notSendEmailDifferentIp' => 'Nu trimiteți notificare prin e-mail dacă vă conectați de la IP diferit.',
  ],
];