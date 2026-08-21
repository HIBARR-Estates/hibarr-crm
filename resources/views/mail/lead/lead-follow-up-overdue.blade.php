@extends('mail.layouts.base')

@section('title', __('email.leadFollowUpOverdue.subject'))
@section('notifiableName', $notifiableName)

@section('actionText', $actionText)
@section('actionUrl', $url)
@section('actionDescription', __('email.leadFollowUpOverdue.footerNote'))
@section('intro', $preheader)

@section('content')
    {{ $overdueMessage }}
    @if(!empty($scheduledDate))
        <br><br>{{ $scheduledDate }}@if(!empty($scheduledTime)) {{ $scheduledTime }}@endif
        <br>{{ $entityName }}
    @endif
@endsection
