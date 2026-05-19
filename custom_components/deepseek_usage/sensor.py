"""Sensor platform for DeepSeek Usage."""

from __future__ import annotations

from datetime import datetime

from homeassistant.components.sensor import SensorEntity, SensorStateClass
from homeassistant.const import UnitOfInformation
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import EntityCategory
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity, DataUpdateCoordinator

from . import DeepSeekConfigEntry
from .const import DOMAIN


async def async_setup_entry(
    hass: HomeAssistant,
    entry: DeepSeekConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up DeepSeek usage sensors."""
    coordinator = entry.runtime_data.coordinator

    async_add_entities([
        DeepSeekPlatformStatusSensor(coordinator, entry),
        DeepSeekBalanceSensor(coordinator, entry),
        DeepSeekMonthlyTokensSensor(coordinator, entry),
        DeepSeekMonthlyCostSensor(coordinator, entry),
        DeepSeekMonthlyRequestsSensor(coordinator, entry),
        DeepSeekEstimatedTokensSensor(coordinator, entry),
    ])


class DeepSeekSensor(CoordinatorEntity[dict], SensorEntity):
    """Base sensor that reads from DeepSeekPlatformCoordinator."""

    _attr_has_entity_name = True
    coordinator: DataUpdateCoordinator[dict]

    def __init__(
        self,
        coordinator: DataUpdateCoordinator[dict],
        entry: DeepSeekConfigEntry,
    ) -> None:
        super().__init__(coordinator)
        self._entry = entry

    @property
    def available(self) -> bool:
        """Only available when token is valid and we have data."""
        if not self.coordinator.data:
            return False
        return self.coordinator.data.get("status") == "valid"


class DeepSeekPlatformStatusSensor(DeepSeekSensor):
    """DeepSeek platform token status."""

    _attr_translation_key = "platform_status"
    _attr_entity_category = EntityCategory.DIAGNOSTIC

    def __init__(
        self,
        coordinator: DataUpdateCoordinator[dict],
        entry: DeepSeekConfigEntry,
    ) -> None:
        super().__init__(coordinator, entry)
        self._attr_unique_id = f"{entry.entry_id}_platform_status"

    @property
    def available(self) -> bool:
        return True  # always show status

    @property
    def native_value(self) -> str:
        if not self.coordinator.data:
            return "unknown"
        return self.coordinator.data.get("status", "unknown")

    @property
    def extra_state_attributes(self) -> dict:
        data = self.coordinator.data or {}
        attrs = {"last_update": data.get("last_update", "")}
        if data.get("error"):
            attrs["error"] = data["error"]
        return attrs


class DeepSeekBalanceSensor(DeepSeekSensor):
    """Current DeepSeek account balance."""

    _attr_translation_key = "balance"
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_native_unit_of_measurement = "$"
    _attr_suggested_display_precision = 2

    def __init__(
        self,
        coordinator: DataUpdateCoordinator[dict],
        entry: DeepSeekConfigEntry,
    ) -> None:
        super().__init__(coordinator, entry)
        self._attr_unique_id = f"{entry.entry_id}_balance"

    @property
    def native_value(self) -> float | None:
        if not self.coordinator.data:
            return None
        return self.coordinator.data.get("balance")


class DeepSeekMonthlyTokensSensor(DeepSeekSensor):
    """Monthly token usage."""

    _attr_translation_key = "monthly_tokens"
    _attr_native_unit_of_measurement = UnitOfInformation.TOKENS
    _attr_state_class = SensorStateClass.TOTAL_INCREASING

    def __init__(
        self,
        coordinator: DataUpdateCoordinator[dict],
        entry: DeepSeekConfigEntry,
    ) -> None:
        super().__init__(coordinator, entry)
        self._attr_unique_id = f"{entry.entry_id}_monthly_tokens"

    @property
    def native_value(self) -> int | None:
        if not self.coordinator.data:
            return None
        return self.coordinator.data.get("monthly_tokens")


class DeepSeekMonthlyCostSensor(DeepSeekSensor):
    """Monthly cost on DeepSeek."""

    _attr_translation_key = "monthly_cost"
    _attr_state_class = SensorStateClass.TOTAL_INCREASING
    _attr_native_unit_of_measurement = "$"
    _attr_suggested_display_precision = 2

    def __init__(
        self,
        coordinator: DataUpdateCoordinator[dict],
        entry: DeepSeekConfigEntry,
    ) -> None:
        super().__init__(coordinator, entry)
        self._attr_unique_id = f"{entry.entry_id}_monthly_cost"

    @property
    def native_value(self) -> float | None:
        if not self.coordinator.data:
            return None
        return self.coordinator.data.get("monthly_cost")


class DeepSeekMonthlyRequestsSensor(DeepSeekSensor):
    """Monthly API request count."""

    _attr_translation_key = "monthly_requests"
    _attr_state_class = SensorStateClass.TOTAL_INCREASING

    def __init__(
        self,
        coordinator: DataUpdateCoordinator[dict],
        entry: DeepSeekConfigEntry,
    ) -> None:
        super().__init__(coordinator, entry)
        self._attr_unique_id = f"{entry.entry_id}_monthly_requests"

    @property
    def native_value(self) -> int | None:
        if not self.coordinator.data:
            return None
        return self.coordinator.data.get("monthly_requests")


class DeepSeekEstimatedTokensSensor(DeepSeekSensor):
    """Estimated remaining tokens based on balance."""

    _attr_translation_key = "estimated_tokens"
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_native_unit_of_measurement = UnitOfInformation.TOKENS

    def __init__(
        self,
        coordinator: DataUpdateCoordinator[dict],
        entry: DeepSeekConfigEntry,
    ) -> None:
        super().__init__(coordinator, entry)
        self._attr_unique_id = f"{entry.entry_id}_estimated_tokens"

    @property
    def native_value(self) -> int | None:
        if not self.coordinator.data:
            return None
        return self.coordinator.data.get("estimated_tokens")
