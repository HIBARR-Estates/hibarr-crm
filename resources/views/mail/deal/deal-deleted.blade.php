@extends('mail.layouts.base')

@section('title', 'Deal removed')
@section('badgeLabel', __('email.dealDeleted.subject'))
@section('notifiableName', $notifiableName)

@section('actionText', $actionText)
@section('actionUrl', $url)
@section('actionDescription', __('email.dealDeleted.actionDescription'))
@section('intro', $preheader)

@section('content')
    {{ __('email.dealDeleted.text', ['dealName' => $dealName, 'deletedBy' => $deletedByName]) }}
@endsection
