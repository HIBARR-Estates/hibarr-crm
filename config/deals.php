<?php

return [
    /*
    | Number of days before close_date to start sending "deadline approaching"
    | notifications (inclusive of close_date).
    */
    'close_date_reminder_days' => (int) env('DEAL_CLOSE_DATE_REMINDER_DAYS', 3),
];
