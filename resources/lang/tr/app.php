<?php

return [
    'mlmCommissionType' => [
        'agent' => 'Temsilci',
        'upline' => 'Üst hat',
        'system' => 'Sistem',
        'referral' => 'Yönlendirme',
    ],

    // Common buttons
    'save' => 'Kaydet',
    'update' => 'Güncelle',
    'cancel' => 'İptal',
    'delete' => 'Sil',
    'edit' => 'Düzenle',
    'view' => 'Görüntüle',
    'show_more' => 'Daha fazla göster',
    'show_less' => 'Daha az göster',
    'back' => 'Geri',
    'reset' => 'Sıfırla',
    'apply' => 'Uygula',
    'confirm' => 'Onayla',
    'close' => 'Kapat',
    'search' => 'Ara',
    'filter' => 'Filtrele',
    'export' => 'Dışa Aktar',
    'import' => 'İçe Aktar',
    'add' => 'Ekle',
    'addNew' => 'Yeni Ekle',
    'submit' => 'Gönder',
    'select' => 'Seç',
    'selectAll' => 'Tümünü Seç',

    // Common labels
    'name' => 'Ad',
    'email' => 'E-posta',
    'phone' => 'Telefon',
    'mobile' => 'Cep Telefonu',
    'address' => 'Adres',
    'status' => 'Durum',
    'date' => 'Tarih',
    'time' => 'Saat',
    'description' => 'Açıklama',
    'notes' => 'Notlar',
    'type' => 'Tür',
    'title' => 'Başlık',
    'amount' => 'Tutar',
    'price' => 'Fiyat',
    'total' => 'Toplam',
    'range' => 'Aralık (min - max)',
    'currency_range' => 'Para birimi aralığı (min - max)',
    'createdAt' => 'Oluşturulma Tarihi',
    'updatedAt' => 'Güncellenme Tarihi',

    // Status labels
    'active' => 'Aktif',
    'inactive' => 'Pasif',
    'pending' => 'Beklemede',
    'completed' => 'Tamamlandı',
    'approved' => 'Onaylandı',
    'rejected' => 'Reddedildi',

    // Auth related
    'logout' => 'Çıkış Yap',
    'login' => 'Giriş Yap',
    'password' => 'Şifre',
    'confirmPassword' => 'Şifreyi Onayla',

    // Support
    'support' => 'Destek',
    'reportBugs' => 'Hata Bildir',
    'requestFeatures' => 'Özellik İste',
    'collapse' => 'Daralt',

    // Messages
    'noData' => 'Veri yok',
    'loading' => 'Yükleniyor...',
    'success' => 'Başarılı',
    'error' => 'Hata',
    'warning' => 'Uyarı',
    'info' => 'Bilgi',

    // Language
    'changeLanguage' => 'Dili Değiştir',
    'language' => 'Dil',

    // Extended menu items
    'menu' => [
        'calls' => 'Aramalar',
        'dashboard' => 'Gösterge Paneli',
        'lead' => 'Potansiyel Müşteriler',
        'deal' => 'Anlaşmalar',
        'allDeals' => 'Tüm Anlaşmalar',
        'tasks' => 'Görevler',
        'properties' => 'Gayrimenkuller',
        'settings' => 'Ayarlar',
        'employees' => 'Çalışanlar',
        'clients' => 'Müşteriler',
        'projects' => 'Projeler',
        'reports' => 'Raporlar',
        'meetings' => 'Toplantılar',
        'offers' => 'Teklifler',
        'partner_network' => 'Ortak Ağı',
        'affiliate_workspace' => 'Affiliate Alanı',
        'mlm' => [
            'dashboard' => 'Gösterge Paneli',
            'levels' => 'Seviyeler',
            'commission_settings' => 'Komisyon Ayarları',
            'cycle_management' => 'Döngü Yönetimi',
            'agent_hierarchy' => 'Ajan Hiyerarşisi',
            'commission_ledger' => 'Komisyon Defteri',
            'agent_metrics' => 'Ajan Metrikleri',
            'level_history' => 'Seviye Geçmişi',
        ],
        'affiliate' => [
            'commissions' => 'Komisyonlar',
            'network' => 'Ağ',
        ],
        'settings_menu' => [
            'reminder_preferences' => 'Hatırlatıcı Tercihleri',
            'preferences' => 'Tercihler',
            'mailbox' => 'Posta kutusu',
            'email_pilot' => 'E-posta pilotu',
            'entity_reminder_defaults' => 'Hatırlatıcı Varsayılanları',
            'reminder_ledger' => 'Hatırlatmalar',
        ],
        'reminderDefaults' => 'Hatırlatıcı Varsayılanları',
        'entityReminderDefaults' => 'Hatırlatıcı Varsayılanları',
        'integrationsHub' => 'Entegrasyon Merkezi',
        'automation' => 'Otomasyon',
        'customFields' => 'Özel alanlar',
        'notes' => 'Notlar',
        'notificationSettings' => 'Bildirim ayarları',
        'packages' => 'Paketler',
        'partner_leads' => 'Yönlendirilen potansiyel müşteriler',
        'partners' => 'İş ortakları',
        'payment_requests' => 'Ödeme talepleri',
        'inAppNotifications' => 'Uygulama içi bildirimler',
        'pipeline' => 'Süreç hattı',
    ],

    // Breadcrumb
    'breadcrumb' => [
        'home' => 'Ana Sayfa',
    ],

    // Dashboard
    'dashboard' => [
        'greeting' => 'Merhaba',
        'good_morning' => 'Günaydın',
        'good_afternoon' => 'İyi günler',
        'good_evening' => 'İyi akşamlar',
        'subtitle' => 'Panonuza hoş geldiniz',
        'stats' => [
            'total_tasks' => 'Toplam Görevler',
            'overdue_tasks' => 'Gecikmiş Görevler',
            'total_deals' => 'Toplam Anlaşmalar',
            'weekly_activities' => 'Haftalık Aktiviteler',
        ],
        'stat_text' => [
            'tasks_completed' => 'görev tamamlandı',
            'active_deals' => 'anlaşma',
            'activities_this_week' => 'bu hafta aktivite',
        ],
        'quick_actions' => [
            'title' => 'Hızlı İşlemler',
        ],
    ],

    // Priorities
    'priorities' => [
        'low' => 'Düşük',
        'medium' => 'Orta',
        'high' => 'Yüksek',
    ],

    // Views
    'views' => [
        'kanban' => 'Kanban Panosu',
        'list' => 'Liste Görünümü',
    ],

    // Tasks
    'tasks' => [
        'search_placeholder' => 'Başlığa göre ara...',
        'manage_subtitle' => 'Görevleri yönet ve takip et',
        'labels' => [
            'private' => 'Gizli Görev',
            'billable' => 'Ücretli Görev',
        ],
        'table' => [
            'created_by' => 'Oluşturan',
        ],
        'actions' => [
            'create' => 'Görev Oluştur',
            'edit' => 'Görevi Düzenle',
            'duplicate' => 'Görevi Çoğalt',
            'delete' => 'Görevi Sil',
        ],
        'errors' => [
            'not_found' => 'Görev Bulunamadı',
        ],
    ],

    // Leads
    'leads' => [
        'search_placeholder' => 'Potansiyel müşteri adı, e-posta, şirket, cep telefonu, ülke ara...',
        'tabs' => [
            'profile' => 'Profil',
            'deals' => 'Anlaşmalar',
            'notes' => 'Notlar',
            'marketing' => 'Pazarlama',
            'tasks' => 'Görevler',
            'events' => 'Etkinlikler',
        ],
        'actions' => [
            'change_to_client' => 'Müşteriye Dönüştür',
            'add' => 'Potansiyel Müşteri Ekle',
            'import' => 'İçe Aktar',
        ],
    ],

    // Gender
    'gender' => [
        'male' => 'Erkek',
        'female' => 'Kadın',
    ],

    // Common
    'common' => [
        'sections' => [
            'details' => 'Detaylar',
            'team' => 'Takım',
            'progress' => 'İlerleme',
        ],
        'tabs' => [
            'overview' => 'Genel Bakış',
        ],
        'actions' => [
            'refresh' => 'Yenile',
            'download' => 'İndir',
            'expand_all' => 'Tümünü genişlet',
            'collapse_all' => 'Tümünü daralt',
        ],
        'filters' => [
            'all' => 'Tümü',
        ],
    ],

    // Deals
    'deals' => [
        'search_placeholder' => 'Anlaşma başlığı, İletiqim, e-posta ile ara...',
        'sections' => [
            'overview' => 'Anlaşmaya Genel Bakış',
            'contact_info' => 'İletişim Bilgileri',
            'interest_budget' => 'İlgi & Bütçe',
            'documentation' => 'Belgeler',
        ],
        'actions' => [
            'create' => 'Anlaşma Oluştur',
            'new_conversation' => 'Yeni Konuşma',
        ],
    ],

    // Meetings
    'meetings' => [
        'my_meetings' => 'Toplantılarım',
        'select_deal_label' => 'Anlaşma Seç',
        'select_deal_placeholder' => 'Anlaşma ara ve seç...',
        'schedule_drawer_title' => 'Toplantı Planla',
        'stats' => [
            'upcoming' => 'Yakında',
            'this_week' => 'Bu Hafta',
            'live_now' => 'Şu An Canlı',
            'completed' => 'Tamamlandı',
        ],
        'sections' => [
            'upcoming' => 'Yakında Olan Toplantılar',
            'past' => 'Geçmiş Toplantılar',
        ],
        'empty' => [
            'upcoming' => 'Planlanmış toplantı yok.',
            'past' => 'Geçmiş toplantı bulunamadı.',
        ],
        'actions' => [
            'schedule' => 'Toplantı Planla',
            'reschedule' => 'Toplantıyı Yeniden Planla',
            'join' => 'Toplantıya Katıl',
        ],
        'linked_lead_label' => 'Bağlı müşteri adayı',
        'optional_deal_label' => 'Anlaşmaya bağla (isteğe bağlı)',
        'optional_deal_placeholder' => 'Anlaşma ara ve seç...',
        'linked_deal_column' => 'Bağlı anlaşma',
        'lead_owner_required' => 'Bu müşteri adayına atanmış bir sahip yok. Toplantı oluşturmadan önce bir sahip atayın veya temsilcisi olan bir anlaşma bağlayın.',
        'success' => [
            'title' => 'Toplantı planlandı',
            'description' => 'Toplantı başarıyla oluşturuldu.',
            'book_another' => 'Başka bir toplantı planla',
            'done' => 'Tamam',
        ],
        'sections_detail' => [
            'participants' => 'Katılımcılar',
            'summary' => 'Toplantı Özeti',
            'agenda_remarks' => 'Ajanda ve Notlar',
            'reminders' => 'Hatırlatıcılar',
        ],
        'errors' => [
            'invalid_link' => 'Geçersiz bağlantı',
        ],
        'platforms' => [
            'zoom' => 'Zoom',
            'teams' => 'Microsoft Teams',
            'google_meet' => 'Google Meet',
            'phone' => 'Telefon',
            'office' => 'Ofis',
            'physical' => 'Yüz Yüze',
            'skype' => 'Skype',
        ],
        'entity_type_deal' => 'Fırsat',
        'entity_type_label' => 'Toplantı planlanacak kayıt',
        'entity_type_lead' => 'Potansiyel müşteri',
        'select_lead_label' => 'Potansiyel müşteri seçin',
        'select_lead_placeholder' => 'Bir potansiyel müşteri arayın ve seçin...',
    ],

    // Meeting types
    'meeting_types' => [
        'video' => 'Video Toplantısı',
        'office' => 'Ofis Toplantısı',
        'phone' => 'Telefon Toplantısı',
        'physical' => 'Yüz Yüze Toplantı',
        'office_meeting' => 'Ofis Toplantısı',
        'phone_meeting' => 'Telefon Toplantısı',
        'physical_meeting' => 'Yüz Yüze Toplantı',
    ],

    // Communication channels
    'communication' => [
        'channels' => [
            'email' => 'E-posta',
            'whatsapp' => 'WhatsApp',
            'phone_call' => 'Telefon Araması',
            'telegram' => 'Telegram',
            'instagram' => 'Instagram',
        ],
    ],

    // Notes
    'notes' => [
        'actions' => [
            'add' => 'Not Ekle',
            'edit' => 'Notu Düzenle',
            'delete' => 'Notu Sil',
            'delete_selected' => 'Seçili Notları Sil',
        ],
    ],

    // Follow-ups
    'followups' => [
        'actions' => [
            'edit' => 'Takibi Düzenle',
            'delete' => 'Takibi Sil',
            'delete_selected' => 'Seçili Takipleri Sil',
            'mark_completed' => 'Tamamlandı Olarak İşaretle',
            'mark_cancelled' => 'İptal Edildi Olarak İşaretle',
        ],
    ],

    // Proposals
    'proposals' => [
        'actions' => [
            'edit' => 'Teklifi Düzenle',
            'delete' => 'Teklifi Sil',
        ],
    ],

    // Files
    'files' => [
        'actions' => [
            'upload' => 'Dosya Yükle',
        ],
    ],

    // Properties
    'properties' => [
        'search_placeholder' => 'Gayrimenkul ara...',
        'tabs' => [
            'my_drafts' => 'Taslaklarım',
        ],
        'filters' => [
            'advanced_title' => 'Gelişmiş Gayrimenkul Filtreleri',
            'property_type' => 'Gayrimenkul türü seçin',
            'sale_type' => 'Satış türü seçin',
            'status' => 'Durum seçin',
            'city' => 'şehir adı girin',
        ],
    ],

    // Property types
    'property_types' => [
        'apartment' => 'Daire',
        'villa' => 'Villa',
        'townhouse' => 'Sıra Ev',
        'penthouse' => 'Pänthouse',
        'studio' => 'Stüdyo',
        'office' => 'Ofis',
        'retail' => 'Perakende',
        'warehouse' => 'Depo',
        'land' => 'Arazi',
    ],

    // Sale types
    'sale_types' => [
        'for_sale' => 'Satışlık',
        'for_rent' => 'Kiralık',
        'for_daily_rental' => 'Günlük Kiralama',
    ],

    // Property statuses
    'property_statuses' => [
        'available' => 'Müsait',
        'under_offer' => 'Teklif Altında',
        'sold' => 'Satıldı',
        'withdrawn' => 'Geri Çekildi',
    ],

    // Export
    'export' => [
        'title' => 'Gayrimenkulleri Dışa Aktar',
        'description' => 'Dışa aktarma filtrelerini yapılandırın ve verileri indirin',
        'button' => 'Verileri Dışa Aktar',
        'section' => [
            'basic_filters' => 'Temel Filtreler',
        ],
    ],

    // Filters
    'filters' => [
        'no_limit' => 'Sınır Yok',
    ],

    // Time periods
    'time_periods' => [
        'this_week' => 'Bu Hafta',
        'this_month' => 'Bu Ay',
        'last_month' => 'Geçen Ay',
        'this_quarter' => 'Bu Çeyrek',
        'this_year' => 'Bu Yıl',
    ],

    // Time units
    'time_units' => [
        'minutes' => 'Dakika',
        'hours' => 'Saat',
        'days' => 'Gün',
    ],

    // Reports
    'reports' => [
        'title' => 'Ajan Raporları',
        'filters' => [
            'title' => 'Etkinlikleri Filtrele',
        ],
        'groupby' => [
            'agent' => 'Ajan',
            'department' => 'Departman',
        ],
        'metrics' => [
            'leads' => 'Potansiyel Müşteriler',
            'deals_created' => 'Oluşturulan Anlaşmalar',
            'deals_closed' => 'Kapatılan Anlaşmalar',
            'meetings' => 'Toplantılar',
            'deal_notes' => 'Anlaşma Notları',
            'lead_notes' => 'Müşteri Notları',
        ],
    ],

    // Notifications
    'notifications' => [
        'title' => 'Bildirimler',
        'search_placeholder' => 'Bildirimleri ara...',
        'filter_by_type' => 'Türe göre filtrele',
        'done' => 'Tamam',
        'select' => 'Seç',
        'actions_label' => 'İşlemler',
        'bulk_delete_title' => 'Bildirimleri Sil',
        'bulk_delete_read_title' => 'Okunmuş Bildirimleri Sil',
        'bulk_delete_read_content' => 'Tüm okunmuş bildirimleri silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
        'actions' => [
            'mark_read' => 'Okundu Olarak İşaretle',
            'mark_all_read' => 'Tümünü Okundu İşaretle',
            'delete_all_read' => 'Tüm Okunmuşları Sil',
        ],
        'filters' => [
            'all' => 'Tüm Bildirimler',
            'unread' => 'Okunmamış',
            'read' => 'Okunmuş',
        ],
    ],

    // MLM / Partner Network
    'mlm' => [
        'admin' => [
            'dashboard' => 'Gösterge Paneli',
        ],
        'menu' => [
            'levels' => 'Seviyeler',
            'commission_settings' => 'Komisyon Ayarları',
            'cycle_management' => 'Döngü Yönetimi',
            'agent_hierarchy' => 'Ajan Hiyerarşisi',
            'commission_ledger' => 'Komisyon Defteri',
            'agent_metrics' => 'Ajan Metrikleri',
            'level_history' => 'Seviye Geçmişi',
        ],
        'agent' => [
            'dashboard' => 'Panom',
            'commissions' => 'Komisyonlarım',
            'network' => 'Ağım',
            'my_uplines' => 'Upline’larım',
            'my_level' => 'Seviyem',
            'my_deals' => 'Anlaşmalarım',
        ],
        'level_assignment' => [
            'automatic' => 'Otomatik',
            'manual' => 'Manuel',
        ],
        'commission_cycle' => [
            'monthly' => 'Aylık (~30 gün)',
            'quarterly' => 'Çeyreklik (~90 gün)',
            'custom' => 'Özel Süre',
        ],
    ],

    // Operators
    'operators' => [
        'gte' => '>= (büyük veya eşit)',
        'lte' => '<= (küçük veya eşit)',
        'eq' => '= (eşit)',
        'gt' => '> (büyük)',
        'lt' => '< (küçük)',
    ],

    // Agents
    'agents' => [
        'title' => 'Ajanlar',
        'search_placeholder' => 'Ajanlara ad veya e-posta ile ara...',
        'filters' => [
            'status' => 'Durum',
            'category' => 'Kategori',
        ],
        'actions' => [
            'add' => 'Ajan Ekle',
            'import' => 'İçe Aktar',
        ],
        'status' => [
            'active' => 'Aktif',
            'disabled' => 'Devre dışı',
        ],
    ],
    // ── Phase 4 ────────────────────────────────────────────────────────────────

    'deals' => [
        'search_placeholder' => 'Anlaşmaları başlık, kişi adı, e-posta ile ara...',
        'actions' => [
            'add' => 'Anlaşma Ekle',
            'schedule_meeting' => 'Toplantı Planla',
        ],
    ],

    'properties' => [
        'search_placeholder' => 'Mülkleri başlık, alan, açıklama ile ara...',
        'actions' => [
            'edit_access_requests' => 'Erişim taleplerini düzenle',
            'add' => 'Mülk Ekle',
            'availability_requests' => 'Uygunluk Talepleri',
            'publish_requests' => 'Yayınlama Talepleri',
            'configuration' => 'Yapılandırma',
        ],
    ],

    'mlm' => [
        'title' => 'MLM',
        'admin' => [
            'dashboard' => 'MLM Paneli',
            'levels' => 'MLM Seviyeleri',
            'levels_short' => 'Seviyeler',
            'level_rules' => 'Seviye Kuralları',
            'commission_settings' => 'Komisyon Ayarları',
            'agent_hierarchy' => 'Temsilci Hiyerarşisi',
            'commission_ledger' => 'Komisyon Defteri',
            'agent_metrics' => 'Temsilci Metrikleri',
            'level_history' => 'Seviye Geçmişi',
            'cycle_management' => 'Döngü Yönetimi',
        ],
        'agent' => [
            'dashboard' => 'MLM Panom',
            'commissions' => 'Komisyonlarım',
            'network' => 'Ağım',
            'level' => 'Seviyem',
            'uplines' => 'Üst Satırlarım',
            'deals' => 'Anlaşmalarım',
        ],
    ],

    'crm_events' => [
        'title' => 'CRM Olayları',
    ],

    'developers' => [
        'title' => 'Geliştiriciler',
    ],

    'offers' => [
        'title' => 'Teklifler',
    ],

    'leadboards' => [
        'kanban' => 'Kanban',
    ],

    'project_locations' => [
        'locations' => 'Konumlar',
    ],

    'settings' => [
        'reminder_preferences' => 'Hatırlatıcı Tercihleri',
        'preferences' => 'Tercihler',
        'entity_reminder_defaults' => 'Hatırlatıcı Varsayılanları',
        'reminder_defaults' => 'Hatırlatıcı Varsayılanları',
    ],
    // Layouts
    'layouts' => [
        'form' => 'Form',
        'wizard' => 'Sihirbaz',
        'tabs' => 'Sekmeler',
    ],

    // Recommendations
    'recommendations' => [
        'cache_notice' => 'Sonuçlar performans için önbelleğe alınıyor',
    ],

    'access_inspector' => [
        'title' => 'Erişim',
        'flags' => 'Bayraklar',
        'permissions' => 'İzinler',
        'search_flags' => 'Bayrak ara',
        'search_permissions' => 'İzin ara',
        'empty' => 'Eşleşme yok',
        'on' => 'Açık',
        'off' => 'Kapalı',
        'read_only' => 'Salt okunur',
        'this_page' => 'Bu sayfa',
        'undeclared' => 'Bu sayfa için kayıt yok. Tüm bayraklar ve izinler gösteriliyor.',
        'any_of' => 'Bunlardan biri yeterli.',
        'needs' => 'Gerekli: {{scopes}}',
    ],
    'mr' => 'Bay',
    'mrs' => 'Bayan',
    'miss' => 'Bayan',
    'dr' => 'Dr.',
    'sir' => 'Bay',
    'madam' => 'Bayan',
    'herr' => 'Herr',
    'frau' => 'Frau',
    'auditLog' => [
        'title' => 'Denetim kaydı',
        'cardDesc' => 'CRM\'de yapılan her değişikliği, kimin yaptığını ve ne zaman yapıldığını görün.',
        'subtitle' => 'CRM genelindeki her oluşturma, güncelleme, silme ve oturum açma — kim yaptı, ne zaman ve ne değişti.',
        'search' => 'Kayıt, kişi, URL veya IP ara',
        'user' => 'Kullanıcı',
        'action' => 'İşlem',
        'recordType' => 'Kayıt türü',
        'source' => 'Kaynak',
        'recordId' => 'Kayıt kimliği',
        'dateFrom' => 'Başlangıç',
        'dateTo' => 'Bitiş',
        'clearFilters' => 'Filtreleri temizle',
        'refresh' => 'Yenile',
        'system' => 'Sistem',
        'when' => 'Ne zaman',
        'who' => 'Kim',
        'record' => 'Kayıt',
        'changes' => 'Değişiklikler',
        'fieldsChanged' => '{{count}} alan değişti',
        'oneFieldChanged' => '1 alan değişti',
        'field' => 'Alan',
        'before' => 'Önce',
        'after' => 'Sonra',
        'details' => 'Ayrıntılar',
        'ipAddress' => 'IP adresi',
        'device' => 'Cihaz',
        'origin' => 'Kaynak adres',
        'openRecord' => 'Kaydı aç',
        'noValues' => 'Bu kayıt için alan değeri kaydedilmedi.',
        'emptyTitle' => 'Etkinlik bulunamadı',
        'emptyDescription' => 'Bu filtrelere uyan bir şey yok. Tarih aralığını genişletin veya filtreleri temizleyin.',
        'loadFailed' => 'Denetim kaydı yüklenemedi. Tekrar deneyin.',
        'emptyValue' => 'boş',
        'redacted' => 'gizli',
        'anyUser' => 'Tüm kullanıcılar',
        'anyAction' => 'Tüm işlemler',
        'anyRecordType' => 'Tüm kayıt türleri',
        'anySource' => 'Tüm kaynaklar',
        'events' => [
            'created' => 'Oluşturuldu',
            'updated' => 'Güncellendi',
            'deleted' => 'Silindi',
            'restored' => 'Geri yüklendi',
            'login' => 'Oturum açtı',
            'logout' => 'Oturumu kapattı',
            'login_failed' => 'Oturum açma başarısız',
            'password_reset' => 'Şifre sıfırlandı',
        ],
        'sources' => [
            'web' => 'Web',
            'api' => 'API',
            'console' => 'Konsol',
            'queue' => 'Arka plan işi',
        ],
    ],
    'action' => 'İşlem',
    'addNewLeadSource' => 'Yeni potansiyel müşteri kaynağı ekle',
    'automation' => [
        'active' => 'Aktif',
        'addCondition' => 'Koşul ekle',
        'addMapping' => 'Eşleme ekle',
        'addStep' => 'Adım ekle',
        'allMeetingTypes' => 'Tüm toplantı türleri',
        'allPipelines' => 'Tüm süreç hatları',
        'assignTo' => 'Atanacak kişi',
        'automation' => 'Otomasyon',
        'automationFor' => 'Hedef',
        'automations' => 'Otomasyonlar',
        'automationsSubtitle' => 'CRM\'de bir şey olduğunda otomatik çalışan kurallar.',
        'backToAutomations' => 'Otomasyonlara dön',
        'backToTemplates' => 'Şablonlara dön',
        'beforeRunning' => 'çalışmadan önce',
        'body' => 'İçerik',
        'bodyHint' => 'Basit içerik (paragraflar, bağlantılar, ara sıra bir tablo) otomatik olarak ortalanmış standart bir e-posta düzenine yerleştirilir. Tasarımın tam kontrolünü almak için eksiksiz bir <html>…</html> belgesi yapıştırın.',
        'columns' => [
            'automation' => 'Otomasyon',
            'detail' => 'Ayrıntı',
            'lastRun' => 'Son çalışma',
            'record' => 'Kayıt',
            'result' => 'Sonuç',
            'runs' => 'Çalışmalar',
            'status' => 'Durum',
            'steps' => 'Adımlar',
            'then' => 'Sonra',
            'time' => 'Zaman',
            'trigger' => 'Tetikleyici',
        ],
        'conditions' => 'Koşullar',
        'content' => 'İçerik',
        'createdBy' => 'Oluşturan / ekleyen',
        'ctaUrl' => 'CTA URL\'si',
        'customEmails' => 'Özel e-posta adres(ler)i',
        'dateField' => 'Tarih alanı',
        'dealAutomation' => 'Fırsat otomasyonu',
        'deals' => 'Fırsatlar',
        'deletedRecord' => 'Silinmiş kayıt',
        'description' => 'Açıklama',
        'details' => 'Ayrıntılar',
        'dueIn' => 'Süre',
        'dueTime' => 'Bitiş saati',
        'editAutomation' => 'Otomasyonu düzenle',
        'editFlow' => 'Akışı düzenle',
        'editMetaEvent' => 'Meta olayını düzenle',
        'editTemplate' => 'Şablonu düzenle',
        'editorSubtitle' => 'İçeriği solda düzenleyin; önizleme örnek verilerle güncellenir.',
        'emailTemplates' => 'E-posta şablonları',
        'eventName' => 'Olay adı',
        'eventNamePlaceholder' => 'örn. Nitelikli, Taahhüt edildi',
        'eventValue' => 'Olay değeri',
        'field' => 'Alan',
        'filters' => [
            'active' => 'Aktif',
            'all' => 'Tümü',
            'paused' => 'Duraklatıldı',
        ],
        'firedFor' => 'Tetiklenen kayıt',
        'flow' => 'Akış',
        'forwardOnly' => 'Yalnızca ileri',
        'if' => 'Eğer',
        'immediate' => 'Hemen',
        'insertMergeTag' => 'Birleştirme etiketi ekle',
        'leadAutomation' => 'Potansiyel müşteri otomasyonu',
        'leads' => 'Potansiyel müşteriler',
        'loadFromPlunk' => 'Plunk\'tan yükle…',
        'lockDealHint' => 'Bu işlem fırsatı kilitler; aşama, değer ve diğer önemli alanlarda değişiklik yapılamaz.',
        'manage' => 'Yönet',
        'meetingTypeScope' => 'Toplantı türleri',
        'meetingTypeScopeAll' => 'Her toplantı türü için çalışır. Sınırlamak için bir veya daha fazla tür seçin.',
        'meetingTypeScopeSome' => 'Yalnızca seçilen türlerdeki toplantılar için çalışır.',
        'mergeTags' => 'Birleştirme etiketleri',
        'metaEvents' => 'Meta olayları',
        'metaEventsSubtitle' => 'Varsayılan değeri olan, bir Meta Dönüşüm otomasyon adımında seçilmeye hazır adlandırılmış dönüşüm olayları.',
        'mode' => 'Mod',
        'moreActions' => 'Diğer işlemler',
        'newAutomation' => 'Yeni otomasyon',
        'newMetaEvent' => 'Yeni Meta olayı',
        'newTemplate' => 'Yeni şablon',
        'noActivityYet' => 'Henüz etkinlik yok',
        'noActivityYetDescription' => 'Bir otomasyon tetiklenir tetiklenmez çalışmalar burada görünecek.',
        'noAutomationsFound' => 'Otomasyon bulunamadı',
        'noAutomationsFoundDescription' => 'Farklı bir arama veya filtre deneyin.',
        'noAutomationsYet' => 'Henüz otomasyon yok',
        'noAutomationsYetDescription' => 'İşlemleri otomatik çalıştırmak için ilk otomasyonunuzu oluşturun.',
        'noFieldsMatch' => 'Eşleşen alan yok',
        'noMetaEventsYet' => 'Henüz Meta olayı yok',
        'noMetaEventsYetDescription' => 'Her seferinde ad ve değer yazmak yerine bir Meta Dönüşüm otomasyon adımında seçmek için bir tane oluşturun.',
        'noTemplatesFound' => 'Şablon bulunamadı',
        'noTemplatesFoundDescription' => 'Farklı bir arama veya filtre deneyin.',
        'noTemplatesYet' => 'Henüz e-posta şablonu yok',
        'noTemplatesYetDescription' => 'Bir send_email otomasyon adımında kullanmak için ilk şablonunuzu oluşturun.',
        'noTriggerWarning' => 'Tetikleyici seçilmedi — bu otomasyon, koşullar sağlandığında konu türüne ait her uygun olayda çalışacak. Gerçekten bunu istemiyorsanız belirli bir tetikleyici seçin.',
        'notUsedYet' => 'Henüz kullanılmadı',
        'noteTitleOptional' => 'Not başlığı (isteğe bağlı)',
        'oneRun' => '1 çalışma',
        'oneStep' => '1 adım',
        'optional' => 'isteğe bağlı',
        'overview' => 'Genel bakış',
        'overviewSubtitle' => 'Otomasyonlarınızın potansiyel müşteriler, fırsatlar ve toplantılarda nasıl performans gösterdiği.',
        'paused' => 'Duraklatıldı',
        'pipelineScope' => 'Süreç hattı kapsamı',
        'plunkTemplateId' => 'Plunk şablon kimliği',
        'preheader' => 'Ön başlık',
        'preview' => 'Önizleme',
        'priority' => 'Öncelik',
        'recentActivity' => 'Son etkinlik',
        'recentRuns' => 'Son çalışmalar',
        'recurrence' => 'Tekrar',
        'refresh' => 'Yenile',
        'results' => [
            'failed' => 'Başarısız',
            'skipped' => 'Atlandı',
            'success' => 'Başarılı',
        ],
        'runCount' => '{{count}} çalışma',
        'runHistory' => 'Çalışma geçmişi',
        'runHistorySubtitle' => 'Bir otomasyonun her tetiklenişi ve ne olduğu.',
        'runImmediately' => 'Hemen çalıştır',
        'runsCount' => '{{count}} çalışma',
        'runsLast7Days' => 'Çalışmalar · son 7 gün',
        'sameAsSource' => 'Kaynakla aynı',
        'saveAutomation' => 'Otomasyonu kaydet',
        'saveTemplate' => 'Şablonu kaydet',
        'searchAutomations' => 'Otomasyonlarda ara',
        'searchFields' => 'Alanlarda ara…',
        'searchTemplates' => 'Şablonlarda ara',
        'selectField' => 'Bir alan seçin',
        'selectRecurrence' => 'Tekrar seçin',
        'selectStage' => 'Hedef aşamayı seçin',
        'selectTemplate' => 'Bir şablon seçin',
        'selectTrigger' => 'Bir tetikleyici seçin',
        'selectTriggerHint' => 'Bu otomasyonu neyin başlatacağını seçin.',
        'selectUser' => 'Bir kullanıcı seçin',
        'selectValue' => 'Bir değer seçin',
        'sendTestEvent' => 'Test olayı gönder',
        'sendTestEventHint' => 'Tek bir potansiyel müşteri için şu anda gerçek bir Meta Conversions API olayı gönderir ve otomasyonları tamamen atlar — bir otomasyonun aynısını göndermesine güvenmeden önce pikselinizi ve erişim jetonunuzu doğrulamak için kullanın.',
        'sendTo' => 'Alıcı',
        'settings' => 'Ayarlar',
        'specificUsers' => 'Belirli kullanıcı(lar)',
        'stats' => [
            'activeAutomations' => 'Etkin otomasyonlar',
            'allTime' => 'tüm zamanlar',
            'configuredWait' => 'Yapılandırılmış bekleme',
            'pausedCount' => '{{count}} duraklatıldı',
            'recordsFiredFor' => 'Tetiklenen kayıtlar',
            'runsLast7d' => 'Çalışmalar · 7 g',
            'runsToday' => 'Bugünkü çalışmalar',
            'successRate' => 'Başarı oranı',
            'totalRuns' => 'Toplam çalışma',
        ],
        'status' => 'Durum',
        'statusHint' => 'Etkin otomasyonlar canlı çalışır',
        'step' => 'Adım',
        'stepCount' => '{{count}} adım',
        'subjectLine' => 'Konu satırı',
        'summary' => 'Özet',
        'summaryText' => '{{trigger}} ile başlar, ardından {{count}} adım çalıştırır.',
        'targetPipeline' => 'Hedef süreç hattı',
        'targetStage' => 'Hedef aşama',
        'templateName' => 'Şablon adı',
        'templatesSubtitle' => 'Otomasyonlarınızın gönderdiği yeniden kullanılabilir e-postalar. Birleştirme etiketleriyle kişiselleştirin.',
        'testEventAccepted' => 'Meta tarafından kabul edildi (HTTP {{status}})',
        'testEventCode' => 'Test olayı kodu (isteğe bağlı)',
        'testEventCodeHint' => 'Meta\'nın olayları test etmek için standart yolu — kodunuzu Events Manager > Test Events altında bulabilirsiniz. Ayarlandığında olay, gerçek reklam raporlamasına sayılmak yerine orada canlı görünür.',
        'testEventCodePlaceholder' => 'örn. TEST73823',
        'testEventFailed' => 'Meta tarafından reddedildi',
        'testLeadId' => 'Potansiyel müşteri',
        'testLeadIdPlaceholder' => 'Potansiyel müşterileri ad veya e-postaya göre ara…',
        'thenDoThis' => 'Sonra şunu yap',
        'title' => 'Başlık',
        'toggleAutomation' => 'Otomasyonu aç/kapat',
        'triggerHint' => 'Bu otomasyonun dinlediği olay.',
        'unconnectedTagsHint' => 'Bu birleştirme etiketleri bu otomasyon için kullanılamaz ve boş gönderilir:',
        'untitledAutomation' => 'Adsız otomasyon',
        'untitledTemplate' => 'Adsız şablon',
        'usedByAutomations' => '{{count}} otomasyon tarafından kullanılıyor',
        'usedInCount' => '{{count}} otomasyonda kullanılıyor',
        'value' => 'Değer',
        'valueFallbackHint' => 'Yalnızca fırsatın değeri yoksa kullanılır. 0 göndermek için boş bırakın.',
        'valueFallbackLabel' => 'Yedek değer',
        'valueFixedLabel' => 'Sabit değer',
        'valueSourceDeal' => 'Fırsat değeri',
        'valueSourceDealLive' => 'Olay tetiklendiği andaki güncel fırsat değerini gönderir.',
        'valueSourceFixed' => 'Sabit değer',
        'variableName' => 'Değişken adı',
        'viewAll' => 'Tümünü görüntüle',
        'waitBeforeRunning' => 'Çalışmadan önce bekle',
        'waitFor' => 'Bekle',
        'waitsDurationBeforeContinuing' => 'Devam etmeden önce {{value}} {{unit}} bekler',
        'when' => 'Ne zaman',
        'yourAutomations' => 'Otomasyonlarınız',
        'emailTemplate' => 'E-posta şablonu',
    ],
    'clearFilters' => 'Temizle',
    'deal' => 'Fırsatlar',
    'default' => 'Varsayılan',
    'designation' => 'Ünvan',
    'impersonation' => [
        'allDepartments' => 'Tüm departmanlar',
        'allDesignations' => 'Tüm ünvanlar',
        'allRoles' => 'Tüm roller',
        'allStatuses' => 'Tüm durumlar',
        'clearFilters' => 'Filtreleri temizle',
        'confirmMessage' => 'Kendi hesabınıza dönene kadar uygulamayı {{name}} olarak göreceksiniz.',
        'confirmTitle' => '{{name}} olarak oturum açılsın mı?',
        'department' => 'Departman',
        'employee' => 'Çalışan',
        'impersonate' => 'Kullanıcı olarak giriş yap',
        'noEmployees' => 'Henüz çalışan yok',
        'noEmployeesDescription' => 'Şirketinizdeki çalışanlar burada görünecek.',
        'noResults' => 'Eşleşen çalışan yok',
        'noResultsDescription' => 'Farklı bir ad, e-posta veya filtre deneyin.',
        'onBehalfOf' => '{{admin}}, {{name}} adına',
        'return' => 'Hesabınıza dönün',
        'role' => 'Rol',
        'searchPlaceholder' => 'Ad, e-posta veya çalışan kimliği ara',
        'signedInAs' => '{{name}} olarak oturum açtınız.',
        'subtitle' => 'Bir çalışanın yetkileriyle uygulamayı kullanmak için onun olarak oturum açın. İstediğiniz zaman kendi hesabınıza dönebilirsiniz.',
    ],
    'next' => 'İleri',
    'no' => 'Hayır',
    'previous' => 'Önceki',
    'pushNotification' => 'Anlık bildirim',
    'remove' => 'Kaldır',
    'settingsHub' => [
        'automationDesc' => 'Potansiyel müşteriler, fırsatlar ve toplantılarda çalışan e-posta şablonlarını ve otomasyonları yönetin.',
        'comingSoon' => 'Yakında',
        'connected' => 'Bağlı',
        'dealsDesc' => 'Fırsat kategorilerini, süreç hatlarını ve aşamaları yönetin.',
        'employeesDesc' => 'Çalışanları bulun ve uygulamayı onların hesabından görmek için onlar olarak oturum açın.',
        'leadsDesc' => 'Kaynaklar, durumlar ve ilk iletişim süresi dahil, potansiyel müşterilerin nasıl ele alınacağına dair şirket varsayılanları.',
        'manage' => 'Yönet',
        'meetingsDesc' => 'Toplantı türlerini ve planlama varsayılanlarını yönetin.',
        'notConnected' => 'Bağlı değil',
        'notesDesc' => 'Not türlerini ve varsayılan görünürlüğü yönetin.',
        'notificationsDesc' => 'Her bildirim türünün hangi kanallardan gönderileceğini yönetin.',
        'packagesDesc' => 'Paketler oluşturun ve fiyatlandırın, her paketin komisyonu nasıl ödeyeceğini belirleyin.',
        'reminders' => 'Hatırlatmalar',
        'remindersDesc' => 'Her kayıt türü için gönderilen varsayılan hatırlatmaları yönetin.',
        'tasksDesc' => 'Görevleri etiketlemek için kullanılan kategorileri oluşturun ve yönetin.',
    ],
    'slack' => 'Slack',
    'yes' => 'Evet',
];
