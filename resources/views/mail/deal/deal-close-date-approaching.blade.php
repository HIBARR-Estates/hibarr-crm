@extends('mail.layouts.base')

@section('title', 'Deal close date approaching')
@section('badgeLabel', __('email.dealCloseDateApproaching.subject'))
@section('notifiableName', $notifiableName)

@section('actionText', __($actionText))
@section('actionUrl', $url)
@section('actionDescription', __('Review the deal and update the close date if plans have changed.'))
@section('intro', $preheader)

@section('content')
    {{ __('email.dealCloseDateApproaching.text', ['dealName' => $dealName, 'closeDate' => $closeDate]) }}
@endsection

@section('detail')
    @if(!empty($closeDate))
        <div class="detail-block">
            <div class="detail-title">{{ $closeDate }}</div>
            <div class="detail-meta">{{ $dealName }}</div>
        </div>
    @endif
@endsection

@section('closing', 'none')
