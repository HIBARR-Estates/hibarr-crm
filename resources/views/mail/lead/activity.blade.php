{{--
  Keep in sync with resources/views/mail/plunk/entity-activity.plunk.html
--}}
@extends('mail.entity.activity')

@php
    $badgeLabel = $badgeLabel ?? 'Lead Activity';
    $actionDescription = __('Click the button below to view the lead details.');
@endphp
