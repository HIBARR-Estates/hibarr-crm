@extends('mail.layouts.base')

@section('title', __('email.leadMerged.subject'))
@section('badgeLabel', __('email.leadMerged.subject'))
@section('notifiableName', $notifiableName)

@section('actionText', $actionText)
@section('actionUrl', $url)
@section('actionDescription', __('email.leadMerged.actionDescription'))
@section('intro', $preheader)

@section('content')
    {{ $bodyText }}
@endsection
