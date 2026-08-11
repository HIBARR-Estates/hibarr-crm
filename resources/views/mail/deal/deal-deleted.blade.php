@extends('mail.layouts.base')

@section('title', 'Deal removed')
@section('notifiableName', $notifiableName)

@section('actionText', __($actionText))
@section('actionUrl', $url)
@section('actionDescription', __('You can review your remaining deals in the CRM.'))
@section('intro', $preheader)

@section('content')
    {{ __('email.dealDeleted.text', ['dealName' => $dealName, 'deletedBy' => $deletedByName]) }}
@endsection
