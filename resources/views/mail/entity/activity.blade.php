{{--
  Shared entity-activity layout (deal, lead, task).
  Keep in sync with resources/views/mail/plunk/entity-activity.plunk.html
--}}
@extends('mail.layouts.base')

@section('title', $subject)
@section('badgeLabel', $badgeLabel ?? $subject)
@section('actionText', $actionText)
@section('actionUrl', $url)
@section('actionDescription', $actionDescription ?? '')
@section('notifiableName', $notifiableName ?? '')
@section('intro', $introText)

@if(!empty($detailHtml))
@section('detail')
    {!! $detailHtml !!}
@endsection
@endif

@if(!empty($content))
@section('content')
    {!! $content !!}
@endsection
@endif
