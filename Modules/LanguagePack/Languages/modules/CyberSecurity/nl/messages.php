<?php 
return [
  'maxRetriesToolTip' => 'Maximaal aantal mislukte pogingen toegestaan ​​vóór uitsluiting',
  'extendLockoutToolTip' => 'Verleng de uitsluitingstijd na de eerste uitsluiting',
  'emailNotificationToolTip' => 'Na (aantal uitsluitingen) uitsluitingen. 0 om e-mailmeldingen uit te schakelen',
  'ipToolTip' => 'Voer één IP per regel in',
  'loginExpiry' => 'Uw account is verlopen. Neem contact op met de beheerder.',
  'sessionDriverRequired' => 'Stel het sessiestuurprogramma in op de database. Anders werkt deze functie niet. U kunt vanaf :setting overschakelen naar de database.',
  'maxRetries' => 'U heeft het maximale aantal nieuwe pogingen bereikt. Probeer het opnieuw na :time.',
  'ipRequired' => 'Voer het IP-adres in als u IP-controle wilt inschakelen.',
  'blacklistEmail' => 'Uw e-mailadres staat op de zwarte lijst. Neem contact op met de beheerder.',
  'blacklistIp' => 'Uw IP staat op de zwarte lijst. Neem contact op met de beheerder.',
  'infoBox' => [
    'lockoutForMinutes' => 'De gebruiker wordt vergrendeld na :maxRetries mislukte pogingen gedurende :lockoutTime minuten.',
    'extendedLockout' => 'De uitsluitingstijd wordt verlengd tot :extendedLockoutTime uur na de eerste uitsluiting.',
    'maxLockoutsAvailable' => 'De maximaal toegestane uitsluitingen zijn :maxLockouts.',
    'resetRetries' => 'Nieuwe pogingen worden na :resetRetries uur gereset.',
    'alertAfterLockouts' => 'Er wordt een e-mailmelding verzonden na :alertAfterLockouts-uitsluitingen naar :email.',
    'sendEmailDifferentIp' => 'Stuur een e-mailmelding als u zich aanmeldt vanaf een ander IP-adres :ip.',
    'notSendEmailDifferentIp' => 'Stuur geen e-mailmelding als u zich aanmeldt vanaf een ander IP-adres.',
  ],
];