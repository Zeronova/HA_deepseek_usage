"""Sensor platform for DeepSeek Usage."""

from __future__ import annotations

from homeassistant.components.sensor import (
    SensorEntity,
    SensorEntityDescription,
    SensorStateClass,
)
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import EntityCategory
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import (
    CoordinatorEntity,
    DataUpdateCoordinator,
)

from . import DeepSeekConfigEntry
from .const import DOMAIN


SENSOR_TYPES: tuple[SensorEntityDescription, ...] = (
    SensorEntityDescription(
        key="platform_status",
        translation_key="platform_status",
        entity_category=EntityCategory.DIAGNOSTIC,
    ),
    SensorEntityDescription(
        key="balance",
        translation_key="balance",
        native_unit_of_measurement="$",
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=2,
    ),
    SensorEntityDescription(
        key="monthly_tokens",
        translation_key="monthly_tokens",
        native_unit_of_measurement="TK",
        state_class=SensorStateClass.TOTAL_INCREASING,
    ),
    SensorEntityDescription(
        key="monthly_cost",
        translation_key="monthly_cost",
        native_unit_of_measurement="$",
        state_class=SensorStateClass.TOTAL_INCREASING,
        suggested_display_precision=2,
    ),
    SensorEntityDescription(
        key="monthly_requests",
        translation_key="monthly_requests",
        state_class=SensorStateClass.TOTAL_INCREASING,
    ),
    SensorEntityDescription(
        key="estimated_tokens",
        translation_key="estimated_tokens",
        native_unit_of_measurement="TK",
        state_class=SensorStateClass.MEASUREMENT,
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: DeepSeekConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up DeepSeek usage sensors."""
    coordinator = entry.runtime_data.coordinator

    async_add_entities(
        DeepSeekSensor(coordinator, entry, description)
        for description in SENSOR_TYPES
    )


class DeepSeekSensor(CoordinatorEntity[dict], SensorEntity):
    """Sensor that reads from DeepSeekPlatformCoordinator."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: DataUpdateCoordinator[dict],
        entry: DeepSeekConfigEntry,
        description: SensorEntityDescription,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator)
        self.entity_description = description
        self._attr_unique_id = f"{entry.entry_id}_{description.key}"
        self._attr_device_info = {
            "identifiers": {(DOMAIN, entry.entry_id)},
            "name": "DeepSeek Usage",
            "manufacturer": "DeepSeek",
            "model": "DeepSeek API Usage Monitor",
            "sw_version": "0.2.0",
        }

    @property
    def available(self) -> bool:
        """Return True for platform_status, otherwise check data."""
        if self.entity_description.key == "platform_status":
            return True
        if not self.coordinator.data:
            return False
        return self.coordinator.data.get("status") == "valid"

    @property
    def native_value(self) -> str | float | int | None:
        """Return the sensor value."""
        DATA_KEY_MAP = {
            "platform_status": "status",
            "balance": "balance",
            "monthly_tokens": "monthly_tokens",
            "monthly_cost": "monthly_cost",
            "monthly_requests": "monthly_requests",
            "estimated_tokens": "estimated_tokens",
        }
        data_key = DATA_KEY_MAP.get(self.entity_description.key)
        if not self.coordinator.data or not data_key:
            if self.entity_description.key == "platform_status":
                return "unknown"
            return None
        return self.coordinator.data.get(data_key)

    @property
    def extra_state_attributes(self) -> dict | None:
        """Return extra attributes for platform_status."""
        if self.entity_description.key != "platform_status":
            return None
        data = self.coordinator.data or {}
        attrs = {"last_update": data.get("last_update", "")}
        if data.get("error"):
            attrs["error"] = data["error"]
        return attrs
