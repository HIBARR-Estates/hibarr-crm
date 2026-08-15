{{--
  Keep in sync with resources/views/mail/plunk/entity-activity.plunk.html
  Plunk: ENTITY_ACTIVITY_PLUNK_TEMPLATE_ID — see plunk/TEMPLATE_REGISTRY.md
--}}
@extends('mail.layouts.base')

@section('title', $subject)

@section('actionText', $actionText)
@section('actionUrl', $url)
@section('actionDescription', __('Click the button below to view the lead details.'))
@section('intro', $introText)
@section('content')
    {!! $content !!}
@endsection
