<?php 
return [
  'maxRetriesToolTip' => 'Số lần thử thất bại tối đa được phép trước khi khóa',
  'extendLockoutToolTip' => 'Kéo dài thời gian khóa sau lần khóa đầu tiên',
  'emailNotificationToolTip' => 'Sau (số lần khóa) khóa. 0 để tắt thông báo email',
  'ipToolTip' => 'Nhập một IP trên mỗi dòng',
  'loginExpiry' => 'Tài khoản của bạn đã hết hạn. Vui lòng liên hệ với quản trị viên.',
  'sessionDriverRequired' => 'Vui lòng đặt trình điều khiển phiên vào cơ sở dữ liệu. Nếu không, tính năng này sẽ không hoạt động. Bạn có thể thay đổi cơ sở dữ liệu từ :setting.',
  'maxRetries' => 'Bạn đã đạt đến số lần thử lại tối đa. Vui lòng thử lại sau :time.',
  'ipRequired' => 'Vui lòng nhập địa chỉ IP nếu bạn muốn kích hoạt kiểm tra IP.',
  'blacklistEmail' => 'Email của bạn bị liệt vào danh sách đen. Vui lòng liên hệ với quản trị viên.',
  'blacklistIp' => 'IP của bạn bị liệt vào danh sách đen. Vui lòng liên hệ với quản trị viên.',
  'infoBox' => [
    'lockoutForMinutes' => 'Người dùng sẽ khóa sau :maxRetries lần thử không thành công trong :lockoutTime phút.',
    'extendedLockout' => 'Thời gian khóa sẽ được kéo dài lên :extendedLockoutTime giờ sau lần khóa đầu tiên.',
    'maxLockoutsAvailable' => 'Số lần khóa tối đa được phép là :maxLockouts.',
    'resetRetries' => 'Việc thử lại sẽ được đặt lại sau :resetRetries giờ.',
    'alertAfterLockouts' => 'Thông báo qua email sẽ được gửi sau khi khóa :alertAfterLockouts thành :email.',
    'sendEmailDifferentIp' => 'Gửi thông báo qua email nếu đăng nhập từ IP khác :ip.',
    'notSendEmailDifferentIp' => 'Không gửi thông báo qua email nếu đăng nhập từ IP khác.',
  ],
];