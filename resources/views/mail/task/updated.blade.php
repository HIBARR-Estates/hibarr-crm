{{--
  Task updated — concise entity-activity layout.
--}}
@include('mail.entity.activity', [
    'subject' => $subject ?? __('email.taskUpdate.subject'),
    'badgeLabel' => 'Task Update',
    'actionText' => $actionText ?? __('email.taskUpdate.action'),
    'url' => $url,
    'actionDescription' => __('email.taskUpdate.footer'),
    'introText' => $introText ?? __('email.taskUpdate.intro'),
    'detailHtml' => $detailHtml ?? '',
    'content' => $content ?? '',
    'notifiableName' => $notifiableName ?? '',
])
