<?php 
return [
  'maxRetriesToolTip' => 'Maximal zulässige Fehlversuche vor der Sperrung',
  'extendLockoutToolTip' => 'Verlängern Sie die Sperrzeit nach der ersten Sperre',
  'emailNotificationToolTip' => 'Nach (Anzahl der Aussperrungen) Aussperrungen. 0, um die E-Mail-Benachrichtigung zu deaktivieren',
  'ipToolTip' => 'Geben Sie eine IP pro Zeile ein',
  'loginExpiry' => 'Ihr Konto ist abgelaufen. Bitte wenden Sie sich an den Administrator.',
  'sessionDriverRequired' => 'Bitte setzen Sie den Sitzungstreiber auf Datenbank. Andernfalls funktioniert diese Funktion nicht. Sie können von :setting zur Datenbank wechseln.',
  'maxRetries' => 'Sie haben die maximale Anzahl an Wiederholungsversuchen erreicht. Bitte versuchen Sie es nach :time erneut.',
  'ipRequired' => 'Bitte geben Sie die IP-Adresse ein, wenn Sie die IP-Prüfung aktivieren möchten.',
  'blacklistEmail' => 'Ihre E-Mail-Adresse steht auf der schwarzen Liste. Bitte wenden Sie sich an den Administrator.',
  'blacklistIp' => 'Ihre IP ist auf der schwarzen Liste. Bitte wenden Sie sich an den Administrator.',
  'infoBox' => [
    'lockoutForMinutes' => 'Der Benutzer wird nach :maxRetries fehlgeschlagenen Versuchen für :lockoutTime Minuten gesperrt.',
    'extendedLockout' => 'Die Sperrzeit wird nach der ersten Sperrung auf :extendedLockoutTime Stunden verlängert.',
    'maxLockoutsAvailable' => 'Die maximal zulässigen Sperren betragen :maxLockouts.',
    'resetRetries' => 'Wiederholungsversuche werden nach :resetRetries Stunden zurückgesetzt.',
    'alertAfterLockouts' => 'Nach :alertAfterLockouts-Aussperrungen wird eine E-Mail-Benachrichtigung an :email gesendet.',
    'sendEmailDifferentIp' => 'Senden Sie eine E-Mail-Benachrichtigung, wenn Sie sich von einer anderen IP :ip aus anmelden.',
    'notSendEmailDifferentIp' => 'Senden Sie keine E-Mail-Benachrichtigung, wenn Sie sich von einer anderen IP aus anmelden.',
  ],
];