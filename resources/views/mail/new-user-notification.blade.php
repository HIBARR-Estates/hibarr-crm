
@extends('mail.layouts.base')

@section('title', 'New User Signed Up - ' . config('app.name'))
@section('notifiableName', __($notifiableName))

@section('actionText', __($actionText))
@section('actionUrl', __($url))
@section('actionDescription', __('Click the button below to view details'))
@section('intro', __('email.newUserViaLink.subject'))
@section('content')
    {!! $content !!}
@endsection