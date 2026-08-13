@extends('mail.layouts.base')

@section('title', 'Lead Assigned')
@section('notifiableName', $notifiableName)

@section('actionText', __($actionText))
@section('actionUrl', $url)
@section('actionDescription', __('You can view the full details and take action on this lead by clicking the button below:'))

@section('intro')
{{ $intro ?? $preheader ?? __('email.leadAgentAssigned.subject') }}
@endsection

@section('content')
    {!! $content !!}
@endsection
