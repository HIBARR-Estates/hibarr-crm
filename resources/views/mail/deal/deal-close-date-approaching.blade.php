@extends('mail.layouts.base')

@section('title', __('email.dealCloseDateApproaching.subject'))
@section('badgeLabel', __('email.dealCloseDateApproaching.subject'))
@section('notifiableName', $notifiableName ?? '')

@section('actionText', $actionText)
@section('actionUrl', $url)
@section('actionDescription', __('Review the deal and update the close date if plans have changed.'))
@section('intro', $preheader ?? '')

@section('detail')
    @if(!empty($closeDate))
        <div class="detail-block">
            <div class="detail-title">{{ $closeDate }}</div>
            <div class="detail-meta">{{ $dealName }}</div>
        </div>
    @endif
@endsection

@section('closing', 'none')
