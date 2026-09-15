<?php

return [

    // Keys listed here skip the XSS middleware's strip_tags(). Their values go
    // through an HTML allow-list in App\Http\Middleware\SanitizeRichTextInput
    // instead. The email template fields at the bottom stay raw, but only on the
    // email template editor's routes.
    'description',
    'outro_description',
    'summery',
    'note',
    'notes',
    'project_summary',
    'reply_heading',
    'comment',
    'message',
    'details',
    // Modules
    'job_description',
    'meta_description',
    'cover_letter',
    'candidate_comment',
    'remark',
    'reason',
    'about',
    'internal_note',
    'billing_address',
    'shipping_address',
    'item_summary',
    'note_details',
    'message2',
    'editedMessage',
    // Email templates (Settings > Automation > Email Templates) — body is a
    // deliberately raw-HTML field (full custom <html> documents, <style>
    // blocks, tables), authored only by admins with manage_company_setting.
    // Stripping tags here doesn't add meaningful XSS protection (the only
    // "victims" are the admin's own email recipients reading a template the
    // admin wrote on purpose) and silently breaks every template that isn't
    // plain text.
    'body',
    'subject',
    'preheader',
];
