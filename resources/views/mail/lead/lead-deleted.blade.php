@extends('mail.layouts.base')

@section('title', 'Lead removed')
@section('notifiableName', $notifiableName)

@section('actionText', __($actionText))
@section('actionUrl', $url)
@section('actionDescription', __('You can review your remaining leads in the CRM.'))
@section('intro', $preheader)

@section('content')
    {{ __('email.leadDeleted.text', ['leadName' => $leadName, 'deletedBy' => $deletedByName]) }}
    @if(!empty($leadEmail))
        <br><br>{{ __('modules.lead.clientEmail') }}: {{ $leadEmail }}
    @endif
@endsection
