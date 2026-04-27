<?php

namespace App\Contracts;

interface AiSummaryInterface
{
    /**
     * Generate a summary of the given notes text.
     *
     * @param  string  $notesText  Concatenated note bodies
     * @param  string  $context    e.g. "Agent John Doe" or "Sales Department"
     * @param  string  $startDate  Human-readable start date
     * @param  string  $endDate    Human-readable end date
     * @return string  The generated summary text
     */
    public function summarize(string $notesText, string $context, string $startDate, string $endDate): string;
}
