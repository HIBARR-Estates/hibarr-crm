@extends('mail.layouts.base')

@section('title', 'Welcome to ' . config('app.name'))
@section('notifiableName', $notifiableName)

@section('actionText', __($actionText))
@section('actionUrl', $url)
@section('actionDescription', __('Click the button below to get started with your new account'))
@section('intro', __('email.newUser.message'))
@section('content')
    {!! $content !!}
@endsection