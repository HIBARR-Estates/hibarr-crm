<?php 
return [
  'maxRetriesToolTip' => 'Numero massimo di tentativi falliti consentiti prima del blocco',
  'extendLockoutToolTip' => 'Estendere il tempo di blocco dopo il primo blocco',
  'emailNotificationToolTip' => 'Dopo (n. di blocchi) blocchi. 0 per disabilitare la notifica e-mail',
  'ipToolTip' => 'Inserisci un IP per riga',
  'loginExpiry' => 'Il tuo account è scaduto. Si prega di contattare l\'amministratore.',
  'sessionDriverRequired' => 'Impostare il driver di sessione sul database. Altrimenti, questa funzione non funzionerà. È possibile passare al database da :setting.',
  'maxRetries' => 'Hai raggiunto il numero massimo di tentativi. Riprova dopo :time.',
  'ipRequired' => 'Inserisci l\'indirizzo IP se desideri abilitare il controllo IP.',
  'blacklistEmail' => 'La tua email è nella lista nera. Si prega di contattare l\'amministratore.',
  'blacklistIp' => 'Il tuo IP è nella lista nera. Si prega di contattare l\'amministratore.',
  'infoBox' => [
    'lockoutForMinutes' => 'L\'utente si bloccherà dopo :maxRetries tentativi falliti per :lockoutTime minuti.',
    'extendedLockout' => 'Il tempo di blocco verrà esteso a :extendedLockoutTime ore dopo il primo blocco.',
    'maxLockoutsAvailable' => 'Il numero massimo di blocchi consentiti è :maxLockouts.',
    'resetRetries' => 'I nuovi tentativi verranno reimpostati dopo :resetRetries ore.',
    'alertAfterLockouts' => 'La notifica e-mail verrà inviata dopo i blocchi :alertAfterLockouts a :email.',
    'sendEmailDifferentIp' => 'Invia notifica e-mail se accedi da IP diversi :ip.',
    'notSendEmailDifferentIp' => 'Non inviare notifiche e-mail se si accede da IP diversi.',
  ],
];