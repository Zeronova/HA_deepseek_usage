"""Config flow for DeepSeek Usage."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.helpers import selector

from .const import CONF_PLATFORM_TOKEN, DOMAIN


class DeepSeekUsageConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle config flow for DeepSeek Usage."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Handle initial configuration step."""
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")

        if user_input is not None:
            return self.async_create_entry(
                title="DeepSeek Usage",
                data={},
                options={
                    CONF_PLATFORM_TOKEN: user_input.get(CONF_PLATFORM_TOKEN, ""),
                },
            )

        return self.async_show_form(
            step_id="user",
            data_schema=self.add_suggested_values_to_schema(
                vol.Schema(
                    {
                        vol.Required(CONF_PLATFORM_TOKEN): selector.TextSelector(
                            selector.TextSelectorConfig(
                                type="password",
                                autocomplete="off",
                            ),
                        ),
                    }
                ),
                {},
            ),
        )

    @staticmethod
    def async_get_options_flow(
        config_entry: ConfigEntry,
    ) -> OptionsFlow:
        """Return the options flow."""
        return DeepSeekUsageOptionsFlowHandler()


class DeepSeekUsageOptionsFlowHandler(OptionsFlow):
    """Handle options flow to update token."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Manage the options."""
        if user_input is not None:
            return self.async_create_entry(
                title="",
                data=user_input,
            )

        current_token = self.config_entry.options.get(CONF_PLATFORM_TOKEN, "")

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(
                {
                    vol.Required(
                        CONF_PLATFORM_TOKEN,
                        default=current_token,
                    ): selector.TextSelector(
                        selector.TextSelectorConfig(
                            type="password",
                            autocomplete="off",
                        ),
                    ),
                }
            ),
        )
