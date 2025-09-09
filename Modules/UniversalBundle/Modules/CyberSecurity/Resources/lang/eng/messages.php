<?php

return array(
    'maxRetriesToolTip' => 'Maximum failed attempts allowed before lockout',
    'extendLockoutToolTip' => 'Extend Lockout time after first lockout',
    'emailNotificationToolTip' => 'After (no. of lockouts) lockouts. 0 to disable email notification',
    'ipToolTip' => 'Enter one IP per line',
    'loginExpiry' => 'Your account has been expired. Please contact administrator.',
    'sessionDriverRequired' => 'Please set session driver to database. Otherwise, this feature will not work. You can change to database from :setting.',
    'maxRetries' => 'You have reached maximum retries. Please try again after :time.',
    'ipRequired' => 'Please enter IP address if you want to enable IP check.',
    'blacklistEmail' => 'Your email is blacklisted. Please contact administrator.',
    'blacklistIp' => 'Your IP is blacklisted. Please contact administrator.',
    'infoBox' => [
        'lockoutForMinutes' => 'User will lockout after :maxRetries failed attempts for :lockoutTime minutes.',
        'extendedLockout' => 'Lockout time will be extended to :extendedLockoutTime hours after first lockout.',
        'maxLockoutsAvailable' => 'Maximum lockouts allowed are :maxLockouts.',
        'resetRetries' => 'Retries will be reset after :resetRetries hours.',
        'alertAfterLockouts' => 'Email notification will be sent after :alertAfterLockouts lockouts to :email.',
        'sendEmailDifferentIp' => 'Send email notification if login from different IP :ip.',
        'notSendEmailDifferentIp' => 'Do not send email notification if login from different IP.',
    ],
);
