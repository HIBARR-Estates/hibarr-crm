{{--
  Keep in sync with resources/views/mail/plunk/property-request.plunk.html
  Plunk: config/email.php → plunk_template_ids.property_request
--}}
@extends('mail.layouts.base')

@section('title', $subject)
@section('badgeLabel', $badgeLabel ?? $subject)
@section('notifiableName', $notifiableName ?? '')
@section('actionText', $actionText)
@section('actionUrl', $url)
@section('actionDescription', $actionDescription ?? __('Please use the button below to respond.'))
@section('intro', $introText)
@section('content')
    {!! $content !!}
@endsection
@if(!empty($footerNote))
@section('footerNote', $footerNote)
@endif
