{{--
  MLM event mail — use entity-activity layout directly (do not wrap in mail.layouts.base).
  Same pattern as resources/views/mail/task/updated.blade.php
--}}
@include('mail.entity.activity', [
    'subject' => $subject ?? '',
    'badgeLabel' => $badgeLabel ?? __('email.mlm.badge'),
    'introText' => $introText ?? '',
    'detailHtml' => $detailHtml ?? '',
    'content' => $content ?? '',
    'actionText' => $actionText ?? __('app.view'),
    'url' => $url ?? '#',
    'actionDescription' => $footerNote ?? '',
    'notifiableName' => $notifiableName ?? '',
])
