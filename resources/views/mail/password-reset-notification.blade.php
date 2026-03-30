@extends('mail.layouts.base')

@section('title', $title ?? __('email.forgetPassword.subject') . ' - ' . config('app.name'))

@section('actionText', __($actionText ?? ''))
@section('actionUrl', $url ?? '#')
@section('actionDescription', $actionDescription ?? __('Click the button below to view details'))
@section('intro', $intro ?? __('email.forgetPassword.subject'))

@section('content')
    {!! $content !!}
@endsection

