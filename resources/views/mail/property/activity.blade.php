{{--
  Keep in sync with resources/views/mail/plunk/entity-activity.plunk.html (entityUrl)
  Plunk: config/email.php → plunk_template_ids.entity_activity (or expose_ready)
--}}
@extends('mail.layouts.base')



@section('title', $subject)



@section('actionText', $actionText)

@section('actionUrl', $url)

@section('actionDescription', __('Click the button below to view the property details.'))

@section('intro', $introText)

@section('content')

    {!! $content !!}

@endsection

