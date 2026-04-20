@extends('mail.layouts.base')

@section('title', $subject)

@section('actionText', $actionText)
@section('actionUrl', $url)
@section('actionDescription', __('Click the button below to view the deal details.'))
@section('intro', $introText)
@section('content')
    {!! $content !!}
@endsection
