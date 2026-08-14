@extends('mail.layouts.base')

@section('title', 'Lead removed')
@section('badgeLabel', __('email.leadDeleted.subject'))
@section('notifiableName', $notifiableName)

@section('actionText', $actionText)
@section('actionUrl', $url)
@section('actionDescription', __('email.leadDeleted.actionDescription'))
@section('intro', $preheader)

@section('content')
    {{ __('email.leadDeleted.text', ['leadName' => $leadName, 'deletedBy' => $deletedByName]) }}
@endsection
