<?php 
return [
  'maxRetriesToolTip' => 'Upaya gagal maksimum yang diperbolehkan sebelum lockout',
  'extendLockoutToolTip' => 'Perpanjang waktu Lockout setelah lockout pertama',
  'emailNotificationToolTip' => 'Setelah (jumlah lockout) lockout. 0 untuk menonaktifkan notifikasi email',
  'ipToolTip' => 'Masukkan satu IP per baris',
  'loginExpiry' => 'Akun Anda telah kedaluwarsa. Silakan hubungi administrator.',
  'sessionDriverRequired' => 'Silakan atur driver sesi ke database. Jika tidak, fitur ini tidak akan berfungsi. Anda dapat mengubah ke database dari :setting.',
  'maxRetries' => 'Anda telah mencapai percobaan ulang maksimum. Silakan coba lagi setelah :time.',
  'ipRequired' => 'Silakan masukkan alamat IP jika Anda ingin mengaktifkan pemeriksaan IP.',
  'blacklistEmail' => 'Email Anda masuk daftar hitam. Silakan hubungi administrator.',
  'blacklistIp' => 'IP Anda masuk daftar hitam. Silakan hubungi administrator.',
  'infoBox' => [
    'lockoutForMinutes' => 'Pengguna akan terkunci setelah :maxRetries upaya gagal selama :lockoutTime menit.',
    'extendedLockout' => 'Waktu lockout akan diperpanjang hingga :extendedLockoutTime jam setelah lockout pertama.',
    'maxLockoutsAvailable' => 'Penguncian maksimum yang diperbolehkan adalah :maxLockouts.',
    'resetRetries' => 'Percobaan ulang akan diatur ulang setelah :resetRetries jam.',
    'alertAfterLockouts' => 'Notifikasi email akan dikirim setelah :alertAfterLockouts lockout ke :email.',
    'sendEmailDifferentIp' => 'Kirim email notifikasi jika login dari IP berbeda :ip.',
    'notSendEmailDifferentIp' => 'Jangan kirim email notifikasi jika login dari IP berbeda.',
  ],
];