
@extends('mail.layouts.base')

@section('title', 'New User Signed Up - ' . config('app.name'))
@section('notifiableName', $notifiableName)

@section('actionText', __($actionText))
@section('actionUrl', $url)
@section('actionDescription', __('Click the button below to view details'))
@section('intro', __('email.newUserViaLink.subject'))
@section('content')
    {!! $content !!}
@endsection