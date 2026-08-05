export interface AnalysisCurrency {
    code: string;
    symbol: string;
    name: string;
}

export const ANALYSIS_CURRENCIES: AnalysisCurrency[] = [
    { code: "GBP", symbol: "£", name: "British Pound" },
    { code: "USD", symbol: "$", name: "US Dollar" },
    { code: "EUR", symbol: "€", name: "Euro" },
    { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
    { code: "CHF", symbol: "Fr", name: "Swiss Franc" },
    { code: "CAD", symbol: "CA$", name: "Canadian Dollar" },
    { code: "AUD", symbol: "A$", name: "Australian Dollar" },
    { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
    { code: "JPY", symbol: "¥", name: "Japanese Yen" },
    { code: "TRY", symbol: "₺", name: "Turkish Lira" },
    { code: "RUB", symbol: "₽", name: "Russian Ruble" },
    { code: "NOK", symbol: "kr", name: "Norwegian Krone" },
    { code: "SEK", symbol: "kr", name: "Swedish Krone" },
    { code: "DKK", symbol: "kr", name: "Danish Krone" },
    { code: "PLN", symbol: "zł", name: "Polish Złoty" },
    { code: "KWD", symbol: "KD", name: "Kuwaiti Dinar" },
    { code: "QAR", symbol: "QR", name: "Qatari Riyal" },
    { code: "SAR", symbol: "SR", name: "Saudi Riyal" },
];
