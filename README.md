# DeepSeek Usage

Home Assistant Integration zur Anzeige von DeepSeek Platform-Verbrauchsdaten.

## Installation

1. In HACS via benutzerdefiniertes Repository hinzufügen: `https://github.com/Zeronova/HA_deepseek_usage`
2. Integration installieren
3. Home Assistant neustarten
4. Einstellungen → Geräte & Dienste → Integration hinzufügen → **DeepSeek Usage**
5. Platform-Token eingeben

## Sensoren

| Sensor | Beschreibung |
|--------|-------------|
| Platform-Status | Token-Gültigkeit (valid, expired, not_configured, error) |
| Guthaben | Aktuelles Kontoguthaben in USD |
| Monatliche Token | Token-Verbrauch diesen Monat |
| Monatliche Kosten | Kosten diesen Monat in USD |
| Monatliche Anfragen | API-Requests diesen Monat |
| Geschätzte Token | Restliche Token basierend auf Guthaben |

## Token

Das DeepSeek Platform-Token findest du unter https://platform.deepseek.com → API Keys → Session-Token.
Token kann jederzeit über Integration → Optionen aktualisiert werden.
