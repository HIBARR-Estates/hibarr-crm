@extends('mail.layouts.base')

@section('title', 'Deal Assigned')
@section('notifiableName', $notifiableName)

@section('actionText', __($actionText))
@section('actionUrl', $url)
@section('actionDescription', __('You can view the full details and take action on this deal by clicking the button below:'))
@section('intro', __('email.leadAgent.text'))

@section('content')
    {!! $content !!}
@endsection