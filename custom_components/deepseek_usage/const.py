"""Constants for DeepSeek Usage."""

from __future__ import annotations

from homeassistant.const import Platform

DOMAIN = "deepseek_usage"
LOGGER_NAME = "deepseek_usage"

PLATFORMS = [Platform.SENSOR]

DEEPSEEK_PLATFORM_API_BASE = "https://platform.deepseek.com/api/v0"
CONF_PLATFORM_TOKEN = "platform_token"

PLATFORM_REFRESH_INTERVAL_MINUTES = 30
