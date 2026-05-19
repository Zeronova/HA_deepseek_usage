"""Init for DeepSeek Usage."""

from __future__ import annotations

from datetime import timedelta
from dataclasses import dataclass, field

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator

from .const import (
    CONF_PLATFORM_TOKEN,
    DEEPSEEK_PLATFORM_API_BASE,
    DOMAIN,
    LOGGER_NAME,
    PLATFORM_REFRESH_INTERVAL_MINUTES,
)

import logging

LOGGER = logging.getLogger(LOGGER_NAME)

PLATFORMS = [Platform.SENSOR]


@dataclass
class DeepSeekUsageData:
    """Runtime data for DeepSeek Usage."""

    coordinator: DataUpdateCoordinator = field(repr=False)
    token_status: str = "not_configured"
    balance: float = 0.0
    monthly_cost: float = 0.0
    monthly_tokens: int = 0
    monthly_requests: int = 0
    estimated_tokens: int = 0
    last_update: str = ""
    error: str = ""


type DeepSeekConfigEntry = ConfigEntry[DeepSeekUsageData]


async def async_setup_entry(hass: HomeAssistant, entry: DeepSeekConfigEntry) -> bool:
    """Set up DeepSeek Usage from a config entry."""
    coordinator = DeepSeekPlatformCoordinator(hass, entry)
    entry.runtime_data = DeepSeekUsageData(coordinator=coordinator)

    await coordinator.async_config_entry_first_refresh()

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    entry.async_on_unload(entry.add_update_listener(_async_update_listener))

    return True


async def async_unload_entry(hass: HomeAssistant, entry: DeepSeekConfigEntry) -> bool:
    """Unload a config entry."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def _async_update_listener(
    hass: HomeAssistant, entry: DeepSeekConfigEntry
) -> None:
    """Handle options update."""
    await hass.config_entries.async_reload(entry.entry_id)


class DeepSeekPlatformCoordinator(DataUpdateCoordinator[dict]):
    """Poll DeepSeek platform API for usage data."""

    def __init__(self, hass: HomeAssistant, entry: DeepSeekConfigEntry) -> None:
        super().__init__(
            hass,
            LOGGER,
            name=f"DeepSeek Usage",
            update_interval=timedelta(minutes=PLATFORM_REFRESH_INTERVAL_MINUTES),
        )
        self.entry = entry

    async def _async_update_data(self) -> dict:
        data = self.entry.runtime_data
        token = self.entry.options.get(CONF_PLATFORM_TOKEN, "")

        if not token:
            result = self._empty_result("not_configured")
            self._apply_to_runtime(data, result)
            return result

        import httpx

        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                summary_resp = await client.get(
                    f"{DEEPSEEK_PLATFORM_API_BASE}/users/get_user_summary",
                    headers=headers,
                )
                summary_data = summary_resp.json()

                code = summary_data.get("code")
                if code == 40003:
                    result = self._empty_result(
                        "expired", "Token ungültig oder abgelaufen"
                    )
                    self._apply_to_runtime(data, result)
                    return result

                if code != 0:
                    result = self._empty_result(
                        "error", summary_data.get("msg", "Unbekannter Fehler")
                    )
                    self._apply_to_runtime(data, result)
                    return result

                sdata = summary_data.get("data", {}).get("biz_data", {})
                wallets = sdata.get("normal_wallets") or []
                costs = sdata.get("monthly_costs") or []

                now = __import__("datetime").datetime.now(
                    __import__("datetime").timezone.utc
                )
                result = {
                    "status": "valid",
                    "balance": float(wallets[0].get("balance", 0)) if wallets else 0.0,
                    "estimated_tokens": (
                        int(wallets[0].get("token_estimation", 0)) if wallets else 0
                    ),
                    "monthly_cost": float(costs[0].get("amount", 0)) if costs else 0.0,
                    "monthly_tokens": int(sdata.get("monthly_token_usage", 0)),
                    "monthly_requests": 0,
                    "last_update": now.isoformat(),
                    "error": "",
                }

                # Get request count from usage/amount endpoint
                try:
                    now_local = __import__("datetime").datetime.now()
                    usage_resp = await client.get(
                        f"{DEEPSEEK_PLATFORM_API_BASE}/usage/amount"
                        f"?year={now_local.year}&month={now_local.month}",
                        headers=headers,
                    )
                    usage_data = usage_resp.json()
                    if usage_data.get("code") == 0:
                        models = (
                            usage_data.get("data", {})
                            .get("biz_data", {})
                            .get("total", [])
                        )
                        total_requests = 0
                        for model in models:
                            for u in model.get("usage", []):
                                if u["type"] == "REQUEST":
                                    total_requests += int(u["amount"])
                        result["monthly_requests"] = total_requests
                except Exception as err:
                    LOGGER.debug("Failed to fetch request count: %s", err)

        except httpx.RequestError as err:
            result = self._empty_result("error", str(err))
            self._apply_to_runtime(data, result)
            return result

        self._apply_to_runtime(data, result)
        return result

    @staticmethod
    def _empty_result(status: str, error: str = "") -> dict:
        return {
            "status": status,
            "balance": 0.0,
            "estimated_tokens": 0,
            "monthly_cost": 0.0,
            "monthly_tokens": 0,
            "monthly_requests": 0,
            "last_update": "",
            "error": error,
        }

    @staticmethod
    def _apply_to_runtime(data: DeepSeekUsageData, result: dict) -> None:
        data.token_status = result["status"]
        data.balance = result["balance"]
        data.monthly_cost = result["monthly_cost"]
        data.monthly_tokens = result["monthly_tokens"]
        data.monthly_requests = result["monthly_requests"]
        data.estimated_tokens = result["estimated_tokens"]
        data.last_update = result["last_update"]
        data.error = result.get("error", "")
