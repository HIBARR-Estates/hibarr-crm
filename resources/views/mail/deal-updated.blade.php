@extends('mail.layouts.base')

@section('title', 'Deal Updated')
@section('notifiableName', __($notifiableName))

@section('actionText', __($actionText))
@section('actionUrl', __($url))
@section('actionDescription', __('You can view the full details and take action on this deal by clicking the button below'))
@section('intro', __('email.dealStatus.text'))
@section('content')
    {!! $content !!}
@endsection