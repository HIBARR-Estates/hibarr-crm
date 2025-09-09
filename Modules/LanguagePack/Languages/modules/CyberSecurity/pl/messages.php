<?php 
return [
  'maxRetriesToolTip' => 'Maksymalna liczba nieudanych prób dozwolonych przed blokadą',
  'extendLockoutToolTip' => 'Wydłuż czas blokady po pierwszej blokadzie',
  'emailNotificationToolTip' => 'Po (liczba blokad) blokad. 0, aby wyłączyć powiadomienia e-mail',
  'ipToolTip' => 'Wprowadź jeden adres IP w każdym wierszu',
  'loginExpiry' => 'Twoje konto wygasło. Skontaktuj się z administratorem.',
  'sessionDriverRequired' => 'Proszę ustawić sterownik sesji na bazę danych. W przeciwnym razie ta funkcja nie będzie działać. Możesz zmienić bazę danych z :setting.',
  'maxRetries' => 'Osiągnięto maksymalną liczbę ponownych prób. Spróbuj ponownie po :time.',
  'ipRequired' => 'Wprowadź adres IP, jeśli chcesz włączyć sprawdzanie adresu IP.',
  'blacklistEmail' => 'Twój e-mail jest na czarnej liście. Skontaktuj się z administratorem.',
  'blacklistIp' => 'Twoje IP jest na czarnej liście. Skontaktuj się z administratorem.',
  'infoBox' => [
    'lockoutForMinutes' => 'Użytkownik zostanie zablokowany po :maxRetries nieudanych próbach na :lockoutTime minuty.',
    'extendedLockout' => 'Czas blokady zostanie wydłużony do :extendedLockoutTime godzin po pierwszej blokadzie.',
    'maxLockoutsAvailable' => 'Maksymalne dozwolone blokady to :maxLockouts.',
    'resetRetries' => 'Ponowne próby zostaną zresetowane po :resetRetries godzinach.',
    'alertAfterLockouts' => 'Powiadomienie e-mail zostanie wysłane po blokadzie :alertAfterLockouts na adres :email.',
    'sendEmailDifferentIp' => 'Wyślij powiadomienie e-mailem, jeśli zalogujesz się z innego adresu IP :ip.',
    'notSendEmailDifferentIp' => 'Nie wysyłaj powiadomień e-mailem, jeśli logujesz się z innego adresu IP.',
  ],
];