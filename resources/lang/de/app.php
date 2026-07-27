<?php

return [
    // Common buttons
    'save' => 'Speichern',
    'update' => 'Aktualisieren',
    'cancel' => 'Abbrechen',
    'delete' => 'Löschen',
    'edit' => 'Bearbeiten',
    'view' => 'Ansehen',
    'show_more' => 'Mehr anzeigen',
    'show_less' => 'Weniger anzeigen',
    'back' => 'Zurück',
    'reset' => 'Zurücksetzen',
    'apply' => 'Anwenden',
    'confirm' => 'Bestätigen',
    'close' => 'Schließen',
    'search' => 'Suchen',
    'filter' => 'Filtern',
    'export' => 'Exportieren',
    'import' => 'Importieren',
    'add' => 'Hinzufügen',
    'addNew' => 'Neu hinzufügen',
    'submit' => 'Absenden',
    'select' => 'Auswählen',
    'selectAll' => 'Alle auswählen',

    // Common labels
    'name' => 'Name',
    'email' => 'E-Mail',
    'phone' => 'Telefon',
    'mobile' => 'Mobil',
    'address' => 'Adresse',
    'status' => 'Status',
    'date' => 'Datum',
    'time' => 'Zeit',
    'description' => 'Beschreibung',
    'notes' => 'Notizen',
    'type' => 'Typ',
    'title' => 'Titel',
    'amount' => 'Betrag',
    'price' => 'Preis',
    'total' => 'Gesamt',
    'range' => 'Bereich (min - max)',
    'currency_range' => 'Währungsbereich (min - max)',
    'createdAt' => 'Erstellt am',
    'updatedAt' => 'Aktualisiert am',

    // Status labels
    'active' => 'Aktiv',
    'inactive' => 'Inaktiv',
    'pending' => 'Ausstehend',
    'completed' => 'Abgeschlossen',
    'approved' => 'Genehmigt',
    'rejected' => 'Abgelehnt',

    // Auth related
    'logout' => 'Abmelden',
    'login' => 'Anmelden',
    'password' => 'Passwort',
    'confirmPassword' => 'Passwort bestätigen',

    // Support
    'support' => 'Support',
    'reportBugs' => 'Fehler melden',
    'requestFeatures' => 'Funktion anfragen',
    'collapse' => 'Einklappen',

    // Messages
    'noData' => 'Keine Daten',
    'loading' => 'Laden...',
    'success' => 'Erfolg',
    'error' => 'Fehler',
    'warning' => 'Warnung',
    'info' => 'Info',

    // Language
    'changeLanguage' => 'Sprache ändern',
    'language' => 'Sprache',

    // Extended menu items
    'menu' => [
        'dashboard' => 'Dashboard',
        'lead' => 'Leads',
        'deal' => 'Deals',
        'allDeals' => 'Alle Deals',
        'tasks' => 'Aufgaben',
        'properties' => 'Immobilien',
        'settings' => 'Einstellungen',
        'employees' => 'Mitarbeiter',
        'clients' => 'Kunden',
        'projects' => 'Projekte',
        'reports' => 'Berichte',
        'meetings' => 'Meetings',
        'offers' => 'Angebote',
        'partner_network' => 'Partnernetzwerk',
        'affiliate_workspace' => 'Affiliate-Bereich',
        'mlm' => [
            'dashboard' => 'Dashboard',
            'levels' => 'Stufen',
            'commission_settings' => 'Provisionseinstellungen',
            'cycle_management' => 'Zyklusverwaltung',
            'agent_hierarchy' => 'Agentenhierarchie',
            'commission_ledger' => 'Provisionsübersicht',
            'agent_metrics' => 'Agentenmetriken',
            'level_history' => 'Stufenverlauf',
        ],
        'affiliate' => [
            'commissions' => 'Provisionen',
            'network' => 'Netzwerk',
        ],
        'settings_menu' => [
            'reminder_preferences' => 'Erinnerungseinstellungen',
        ],
    ],

    // Breadcrumb
    'breadcrumb' => [
        'home' => 'Startseite',
    ],

    // Dashboard
    'dashboard' => [
        'greeting'       => 'Guten Tag',
        'good_morning'   => 'Guten Morgen',
        'good_afternoon' => 'Guten Tag',
        'good_evening'   => 'Guten Abend',
        'subtitle' => 'Willkommen zurück in Ihrem Dashboard',
        'stats' => [
            'total_tasks'      => 'Aufgaben gesamt',
            'overdue_tasks'    => 'Überfällige Aufgaben',
            'total_deals'      => 'Deals gesamt',
            'weekly_activities' => 'Wöchentliche Aktivitäten',
        ],
        'stat_text' => [
            'tasks_completed'      => 'Aufgaben abgeschlossen',
            'active_deals'         => 'Deals',
            'activities_this_week' => 'Aktivitäten diese Woche',
        ],
        'quick_actions' => [
            'title' => 'Schnellaktionen',
        ],
    ],

    // Priorities
    'priorities' => [
        'low' => 'Niedrig',
        'medium' => 'Mittel',
        'high' => 'Hoch',
    ],

    // Views
    'views' => [
        'kanban' => 'Kanban-Board',
        'list' => 'Listenansicht',
    ],

    // Tasks
    'tasks' => [
        'search_placeholder' => 'Nach Titel suchen...',
        'manage_subtitle' => 'Aufgaben verwalten und verfolgen',
        'labels' => [
            'private' => 'Private Aufgabe',
            'billable' => 'Abrechenbare Aufgabe',
        ],
        'table' => [
            'created_by' => 'Erstellt von',
        ],
        'actions' => [
            'create'    => 'Aufgabe erstellen',
            'edit'      => 'Aufgabe bearbeiten',
            'duplicate' => 'Aufgabe duplizieren',
            'delete'    => 'Aufgabe löschen',
        ],
        'errors' => [
            'not_found' => 'Aufgabe nicht gefunden',
        ],
    ],

    // Leads
    'leads' => [
        'search_placeholder' => 'Leads nach Name, E-Mail, Unternehmen, Mobilnummer, Land suchen...',
        'tabs' => [
            'profile'   => 'Profil',
            'deals'     => 'Deals',
            'notes'     => 'Notizen',
            'marketing' => 'Marketing',
            'tasks'     => 'Aufgaben',
            'events'    => 'Ereignisse',
        ],
        'actions' => [
            'change_to_client' => 'Zu Kunde konvertieren',
            'add'    => 'Lead hinzufügen',
            'import' => 'Importieren',
        ],
    ],

    // Gender
    'gender' => [
        'male' => 'Männlich',
        'female' => 'Weiblich',
    ],

    // Common
    'common' => [
        'sections' => [
            'details' => 'Details',
            'team' => 'Team',
            'progress' => 'Fortschritt',
        ],
        'tabs' => [
            'overview' => 'Übersicht',
        ],
        'actions' => [
            'refresh'      => 'Aktualisieren',
            'download'     => 'Herunterladen',
            'expand_all'   => 'Alle ausklappen',
            'collapse_all' => 'Alle einklappen',
        ],
        'filters' => [
            'all' => 'Alle',
        ],
    ],

    // Deals
    'deals' => [
        'search_placeholder' => 'Deals nach Titel, Kontakt, E-Mail suchen...',
        'sections' => [
            'overview' => 'Deal-Übersicht',
            'contact_info' => 'Kontaktinformationen',
            'interest_budget' => 'Interesse & Budget',
            'documentation' => 'Dokumentation',
        ],
        'actions' => [
            'create' => 'Deal erstellen',
            'new_conversation' => 'Neue Konversation',
        ],
    ],

    // Meetings
    'meetings' => [
        'my_meetings'             => 'Meine Meetings',
        'select_deal_label'       => 'Deal auswählen',
        'select_deal_placeholder' => 'Deal suchen und auswählen...',
        'schedule_drawer_title'   => 'Meeting planen',
        'stats' => [
            'upcoming'  => 'Bevorstehend',
            'this_week' => 'Diese Woche',
            'live_now'  => 'Jetzt live',
            'completed' => 'Abgeschlossen',
        ],
        'sections' => [
            'upcoming' => 'Bevorstehende Meetings',
            'past'     => 'Vergangene Meetings',
        ],
        'empty' => [
            'upcoming' => 'Keine bevorstehenden Meetings geplant.',
            'past'     => 'Keine vergangenen Meetings gefunden.',
        ],
        'actions' => [
            'schedule'   => 'Meeting planen',
            'reschedule' => 'Meeting verschieben',
            'join'       => 'Meeting beitreten',
        ],
        'linked_lead_label' => 'Verknüpfter Lead',
        'optional_deal_label' => 'Mit Deal verknüpfen (optional)',
        'optional_deal_placeholder' => 'Deal suchen und auswählen...',
        'linked_deal_column' => 'Verknüpfter Deal',
        'lead_owner_required' => 'Diesem Lead ist kein Eigentümer zugewiesen. Weisen Sie einen Lead-Eigentümer zu oder verknüpfen Sie einen Deal mit einem Agenten, bevor Sie ein Meeting buchen.',
        'success' => [
            'title' => 'Meeting geplant',
            'description' => 'Das Meeting wurde erfolgreich erstellt.',
            'book_another' => 'Weiteres Meeting buchen',
            'done' => 'Fertig',
        ],
        'sections_detail' => [
            'participants' => 'Teilnehmer',
            'summary'      => 'Meeting-Zusammenfassung',
            'agenda_remarks' => 'Agenda & Anmerkungen',
            'reminders'    => 'Erinnerungen',
        ],
        'errors' => [
            'invalid_link' => 'Ungültiger Link',
        ],
        'platforms' => [
            'zoom'        => 'Zoom',
            'teams'       => 'Microsoft Teams',
            'google_meet' => 'Google Meet',
            'phone'       => 'Telefon',
            'office'      => 'Büro',
            'physical'    => 'Vor Ort',
            'skype'       => 'Skype',
        ],
    ],

    // Meeting types
    'meeting_types' => [
        'video' => 'Video-Meeting',
        'office' => 'Büro-Meeting',
        'phone' => 'Telefon-Meeting',
        'physical' => 'Persönliches Meeting',
        'office_meeting' => 'Büro-Meeting',
        'phone_meeting' => 'Telefon-Meeting',
        'physical_meeting' => 'Persönliches Meeting',
    ],

    // Communication channels
    'communication' => [
        'channels' => [
            'email' => 'E-Mail',
            'whatsapp' => 'WhatsApp',
            'phone_call' => 'Anruf',
            'telegram' => 'Telegram',
            'instagram' => 'Instagram',
        ],
    ],

    // Notes
    'notes' => [
        'actions' => [
            'add' => 'Notiz hinzufügen',
            'edit' => 'Notiz bearbeiten',
            'delete' => 'Notiz löschen',
            'delete_selected' => 'Ausgewählte Notizen löschen',
        ],
    ],

    // Follow-ups
    'followups' => [
        'actions' => [
            'edit' => 'Follow-up bearbeiten',
            'delete' => 'Follow-up löschen',
            'delete_selected' => 'Ausgewählte Follow-ups löschen',
            'mark_completed' => 'Als abgeschlossen markieren',
            'mark_cancelled' => 'Als abgebrochen markieren',
        ],
    ],

    // Proposals
    'proposals' => [
        'actions' => [
            'edit' => 'Angebot bearbeiten',
            'delete' => 'Angebot löschen',
        ],
    ],

    // Files
    'files' => [
        'actions' => [
            'upload' => 'Dateien hochladen',
        ],
    ],

    // Properties
    'properties' => [
        'search_placeholder' => 'Immobilien suchen...',
        'tabs' => [
            'my_drafts' => 'Meine Entwürfe',
        ],
        'filters' => [
            'advanced_title' => 'Erweiterte Immobilienfilter',
            'property_type' => 'Immobilientyp auswählen',
            'sale_type' => 'Verkaufstyp auswählen',
            'status' => 'Status auswählen',
            'city' => 'Stadtname eingeben',
        ],
    ],

    // Property types
    'property_types' => [
        'apartment' => 'Wohnung',
        'villa' => 'Villa',
        'townhouse' => 'Stadthaus',
        'penthouse' => 'Penthouse',
        'studio' => 'Studio',
        'office' => 'Büro',
        'retail' => 'Einzelhandel',
        'warehouse' => 'Lager',
        'land' => 'Grundstück',
    ],

    // Sale types
    'sale_types' => [
        'for_sale' => 'Zum Verkauf',
        'for_rent' => 'Zur Miete',
        'for_daily_rental' => 'Zur Tagesmiete',
    ],

    // Property statuses
    'property_statuses' => [
        'available' => 'Verfügbar',
        'under_offer' => 'Unter Angebot',
        'sold' => 'Verkauft',
        'withdrawn' => 'Zurückgezogen',
    ],

    // Export
    'export' => [
        'title' => 'Immobilien exportieren',
        'description' => 'Exportfilter konfigurieren und Immobiliendaten herunterladen',
        'button' => 'Daten exportieren',
        'section' => [
            'basic_filters' => 'Grundfilter',
        ],
    ],

    // Filters
    'filters' => [
        'no_limit' => 'Kein Limit',
    ],

    // Time periods
    'time_periods' => [
        'this_week' => 'Diese Woche',
        'this_month' => 'Diesen Monat',
        'last_month' => 'Letzter Monat',
        'this_quarter' => 'Dieses Quartal',
        'this_year' => 'Dieses Jahr',
    ],

    // Time units
    'time_units' => [
        'minutes' => 'Minuten',
        'hours' => 'Stunden',
        'days' => 'Tage',
    ],

    // Reports
    'reports' => [
        'title' => 'Agentenberichte',
        'filters' => [
            'title' => 'Ereignisse filtern',
        ],
        'groupby' => [
            'agent' => 'Agent',
            'department' => 'Abteilung',
        ],
        'metrics' => [
            'leads' => 'Leads',
            'deals_created' => 'Deals erstellt',
            'deals_closed' => 'Deals abgeschlossen',
            'meetings' => 'Meetings',
            'deal_notes' => 'Deal-Notizen',
            'lead_notes' => 'Lead-Notizen',
        ],
    ],

    // Notifications
    'notifications' => [
        'title'              => 'Benachrichtigungen',
        'search_placeholder' => 'Benachrichtigungen suchen...',
        'filter_by_type'     => 'Nach Typ filtern',
        'done'               => 'Fertig',
        'select'             => 'Auswählen',
        'actions_label'      => 'Aktionen',
        'bulk_delete_title'        => 'Benachrichtigungen löschen',
        'bulk_delete_read_title'   => 'Gelesene Benachrichtigungen löschen',
        'bulk_delete_read_content' => 'Möchten Sie alle gelesenen Benachrichtigungen löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
        'actions' => [
            'mark_read'       => 'Als gelesen markieren',
            'mark_all_read'   => 'Alle als gelesen markieren',
            'delete_all_read' => 'Alle gelesenen löschen',
        ],
        'filters' => [
            'all'    => 'Alle Benachrichtigungen',
            'unread' => 'Ungelesen',
            'read'   => 'Gelesen',
        ],
    ],

    // MLM / Partner Network
    'mlm' => [
        'admin' => [
            'dashboard' => 'Dashboard',
        ],
        'menu' => [
            'levels' => 'Stufen',
            'commission_settings' => 'Provisionseinstellungen',
            'cycle_management' => 'Zyklusverwaltung',
            'agent_hierarchy' => 'Agentenhierarchie',
            'commission_ledger' => 'Provisionsübersicht',
            'agent_metrics' => 'Agentenmetriken',
            'level_history' => 'Stufenverlauf',
        ],
        'agent' => [
            'dashboard' => 'Mein Dashboard',
            'commissions' => 'Meine Provisionen',
            'network' => 'Mein Netzwerk',
            'my_uplines' => 'Meine Uplines',
            'my_level' => 'Meine Stufe',
            'my_deals' => 'Meine Deals',
        ],
        'level_assignment' => [
            'automatic' => 'Automatisch',
            'manual' => 'Manuell',
        ],
        'commission_cycle' => [
            'monthly' => 'Monatlich (~30 Tage)',
            'quarterly' => 'Vierteljährlich (~90 Tage)',
            'custom' => 'Benutzerdefiniert',
        ],
    ],

    // Operators
    'operators' => [
        'gte' => '>= (größer oder gleich)',
        'lte' => '<= (kleiner oder gleich)',
        'eq' => '= (gleich)',
        'gt' => '> (größer als)',
        'lt' => '< (kleiner als)',
    ],

    // Agents
    'agents' => [
        'title'              => 'Agenten',
        'search_placeholder' => 'Agenten nach Name oder E-Mail suchen...',
        'filters' => [
            'status'   => 'Status',
            'category' => 'Kategorie',
        ],
        'actions' => [
            'add'    => 'Agent hinzufügen',
            'import' => 'Importieren',
        ],
    ],

    // ── Phase 4 ────────────────────────────────────────────────────────────────

    'deals' => [
        'search_placeholder' => 'Deals nach Titel, Kontaktname, E-Mail suchen...',
        'actions' => [
            'add'              => 'Deal hinzufügen',
            'schedule_meeting' => 'Besprechung planen',
        ],
    ],

    'properties' => [
        'search_placeholder' => 'Objekte nach Titel, Bereich, Beschreibung suchen...',
        'actions' => [
            'add'                   => 'Objekt hinzufügen',
            'availability_requests' => 'Verfügbarkeitsanfragen',
            'publish_requests'      => 'Veröffentlichungsanfragen',
            'configuration'         => 'Konfiguration',
        ],
    ],

    'mlm' => [
        'title' => 'MLM',
        'admin' => [
            'dashboard'           => 'MLM-Dashboard',
            'levels'              => 'MLM-Ebenen',
            'levels_short'        => 'Ebenen',
            'level_rules'         => 'Ebenenregeln',
            'commission_settings' => 'Provisionseinstellungen',
            'agent_hierarchy'     => 'Agentenhierarchie',
            'commission_ledger'   => 'Provisionsbuch',
            'agent_metrics'       => 'Agentenmetriken',
            'level_history'       => 'Ebenenverlauf',
            'cycle_management'    => 'Zyklusverwaltung',
        ],
        'agent' => [
            'dashboard'   => 'Mein MLM-Dashboard',
            'commissions' => 'Meine Provisionen',
            'network'     => 'Mein Netzwerk',
            'level'       => 'Meine Ebene',
            'uplines'     => 'Meine Uplines',
            'deals'       => 'Meine Deals',
        ],
    ],

    'crm_events' => [
        'title' => 'CRM-Ereignisse',
    ],

    'developers' => [
        'title' => 'Entwickler',
    ],

    'offers' => [
        'title' => 'Angebote',
    ],

    'leadboards' => [
        'kanban' => 'Kanban',
    ],

    'project_locations' => [
        'locations' => 'Standorte',
    ],

    'settings' => [
        'reminder_preferences' => 'Erinnerungseinstellungen',
    ],

    // Layouts
    'layouts' => [
        'form' => 'Formular',
        'wizard' => 'Assistent',
        'tabs' => 'Tabs',
    ],

    // Recommendations
    'recommendations' => [
        'cache_notice' => 'Ergebnisse werden zur Leistungsoptimierung zwischengespeichert',
    ],
];
