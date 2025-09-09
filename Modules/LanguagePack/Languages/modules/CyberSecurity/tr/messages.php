<?php 
return [
  'maxRetriesToolTip' => 'Kilitlenmeden önce izin verilen maksimum başarısız denemeler',
  'extendLockoutToolTip' => 'İlk kilitlemeden sonra Kilitleme süresini uzatın',
  'emailNotificationToolTip' => '(Kilitleme sayısı) kilitlemelerden sonra. E-posta bildirimini devre dışı bırakmak için 0',
  'ipToolTip' => 'Her satıra bir IP girin',
  'loginExpiry' => 'Hesabınızın süresi doldu. Lütfen yöneticiyle iletişime geçin.',
  'sessionDriverRequired' => 'Lütfen oturum sürücüsünü veritabanına ayarlayın. Aksi takdirde bu özellik çalışmayacaktır. Veritabanına :setting\'den değiştirebilirsiniz.',
  'maxRetries' => 'Maksimum yeniden deneme sayısına ulaştınız. Lütfen :time\'den sonra tekrar deneyin.',
  'ipRequired' => 'IP kontrolünü etkinleştirmek istiyorsanız lütfen IP adresini girin.',
  'blacklistEmail' => 'E-postanız kara listeye alındı. Lütfen yöneticiyle iletişime geçin.',
  'blacklistIp' => 'IP\'niz kara listeye alındı. Lütfen yöneticiyle iletişime geçin.',
  'infoBox' => [
    'lockoutForMinutes' => 'Kullanıcı, :lockoutTime dakika boyunca :maxRetries başarısız denemeden sonra kilitlenecektir.',
    'extendedLockout' => 'Kilitleme süresi, ilk kilitlemeden sonra 1 saate kadar uzatılacaktır.',
    'maxLockoutsAvailable' => 'İzin verilen maksimum kilitleme sayısı :maxLockouts\'dir.',
    'resetRetries' => 'Yeniden denemeler 1 saat sonra sıfırlanacak.',
    'alertAfterLockouts' => ' :alertAfterLockouts kilitlemeden sonra :email\'ye e-posta bildirimi gönderilecektir.',
    'sendEmailDifferentIp' => 'Farklı IP :ip\'den giriş yaparsanız e-posta bildirimi gönderin.',
    'notSendEmailDifferentIp' => 'Farklı IP\'den giriş yapıyorsanız e-posta bildirimi göndermeyin.',
  ],
];