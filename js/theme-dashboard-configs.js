const ALL_THEMES_CONFIG = {
    scifi: {
        id: 'scifi',
        name_key: 'theme_name_scifi',
        icon: 'images/icon_scifi.svg',
        lore_key: 'theme_lore_scifi',
        setting_key: 'theme_setting_scifi',
        details_key: 'theme_details_scifi',
        dashboard_config_ref: 'scifi'
    },
    fantasy: {
        id: 'fantasy',
        name_key: 'theme_name_fantasy',
        icon: 'images/icon_fantasy.svg',
        lore_key: 'theme_lore_fantasy',
        setting_key: 'theme_setting_fantasy',
        details_key: 'theme_details_fantasy',
        dashboard_config_ref: 'fantasy'
    }
    // ... more themes
};

// --- Theme-Specific Dashboard Configurations ---
const THEME_DASHBOARD_CONFIGS = {
    scifi: {
        left_panel: [
            { id: 'captain-status-panel-box', title_key: 'title_captain_status', type: 'collapsible', initial_expanded: true, items: [
                { id: 'callsign', label_key: 'label_player_callsign', type: 'text', default_value_key: 'unknown' },
                { id: 'credits', label_key: 'label_player_credits', type: 'number_text', default_value_key: 'unknown', suffix: ' UEC' },
                { id: 'reputation', label_key: 'label_player_reputation', type: 'text', default_value_key: 'unknown' },
                { id: 'affiliation', label_key: 'label_player_affiliation', type: 'text', default_value_key: 'unknown' }
            ]},
            { id: 'ship-status-panel-box', title_key: 'title_ship_status', type: 'collapsible', initial_expanded: false, boot_delay: 1200, items: [
                { id: 'shipName', label_key: 'label_ship_name', type: 'text', default_value_key: 'unknown' },
                { id: 'shipType', label_key: 'label_ship_type', type: 'text', default_value_key: 'unknown' },
                { id: 'integrityPct', label_key: 'label_ship_integrity', type: 'meter', meter_type: 'integrity', default_value: '0' },
                { id: 'shieldsPct', label_key: 'label_ship_shields', type: 'meter', meter_type: 'shields', default_value: '0', status_text_id: 'shieldsStatus', default_status_key: 'offline' },
                { id: 'fuelPct', label_key: 'label_ship_fuel', type: 'meter', meter_type: 'fuel', default_value: '0' },
                { id: 'cargo', label_key: 'label_ship_cargo', type: 'text_long', default_value_key: 'cargo_empty_scu' },
                { id: 'currentShipSpeed', label_key: 'label_ship_speed', type: 'text', default_value: '0 m/s' }
            ]},
            { id: 'comms-channel-panel-box', title_key: 'title_comms_channel', type: 'hidden_until_active', initial_expanded: true, indicator_key: 'comms_channel_active', items: [
                { id: 'comms_channel_info', label_key: 'label_comms_status', type: 'text_long', default_value_key: 'comms_inactive' }
            ]}
        ],
        right_panel: [
            { id: 'mission-intel-panel-box', title_key: 'title_active_directive', type: 'collapsible', initial_expanded: true, items: [
                { id: 'objective', label_key: 'label_directive_details', type: 'text_long', default_value_key: 'objective_none' },
                { id: 'directiveReward', label_key: 'label_directive_reward', type: 'text', default_value_key: 'unknown' },
                { id: 'directive_status', label_key: 'label_directive_status', type: 'text', default_value_key: 'status_idle' },
                { id: 'alertLevel', label_key: 'label_alert_level', type: 'status_text', default_value_key: 'alert_level_green', default_status_key: 'alert_level_green_val' }
            ]},
            { id: 'navigation-data-panel-box', title_key: 'title_navigation_data', type: 'collapsible', initial_expanded: false, boot_delay: 1200, items: [
                { id: 'location', label_key: 'label_current_location', type: 'text_long', default_value_key: 'unknown' },
                { id: 'systemFaction', label_key: 'label_system_faction', type: 'text', default_value_key: 'unknown' },
                { id: 'environment', label_key: 'label_environment', type: 'text_long', default_value_key: 'unknown' },
                { id: 'sensorConditions', label_key: 'label_sensor_conditions', type: 'text_long', default_value_key: 'unknown' },
                { id: 'stardate', label_key: 'label_stardate', type: 'text', default_value_key: 'unknown' }
            ]},
            { id: 'enemy-intel-panel-box', title_key: 'title_enemy_intel', type: 'hidden_until_active', initial_expanded: true, indicator_key: 'combat_engaged', items: [
                { id: 'enemy_ship_type', label_key: 'label_enemy_ship_type', type: 'text', default_value_key: 'none' },
                { id: 'enemy_shields_pct', label_key: 'label_enemy_shields', type: 'meter', meter_type: 'enemy_shields', default_value: '0', status_text_id: 'enemy_shields_status_text', default_status_key: 'offline' },
                { id: 'enemy_hull_pct', label_key: 'label_enemy_hull', type: 'meter', meter_type: 'enemy_hull', default_value: '0' }
            ]}
        ]
    },
    fantasy: {
        left_panel: [
            { id: 'character-overview-box', title_key: 'title_character_overview', type: 'static', items: [
                { id: 'character_name', label_key: 'label_character_name', type: 'text', default_value_key: 'unknown' },
                { id: 'character_class', label_key: 'label_character_class', type: 'text', default_value_key: 'unknown' },
                { id: 'character_level', label_key: 'label_character_level', type: 'number_text', default_value: 1 },
                { id: 'gold', label_key: 'label_gold', type: 'number_text', default_value: 0, suffix: ' GP' }
            ]},
            { id: 'character-vitals-box', title_key: 'title_character_vitals', type: 'collapsible', initial_expanded: true, items: [
                { id: 'hp', label_key: 'label_hp', type: 'meter', meter_type: 'health', default_value: '100' },
                { id: 'mana', label_key: 'label_mana', type: 'meter', meter_type: 'mana', default_value: '100' },
                { id: 'stamina', label_key: 'label_stamina', type: 'meter', meter_type: 'stamina', default_value: '100' },
                { id: 'equipped_weapon', label_key: 'label_equipped_weapon', type: 'text', default_value_key: 'none' },
                { id: 'equipped_armor', label_key: 'label_equipped_armor', type: 'text', default_value_key: 'none' }
            ]}
        ],
        right_panel: [
            { id: 'quest-log-box', title_key: 'title_quest_log', type: 'static', items: [
                { id: 'current_quest', label_key: 'label_current_quest', type: 'text_long', default_value_key: 'objective_none' },
                { id: 'quest_reward', label_key: 'label_quest_reward', type: 'text', default_value_key: 'unknown' },
                { id: 'quest_status', label_key: 'label_quest_status', type: 'text', default_value_key: 'status_idle' },
                { id: 'alert_level', label_key: 'label_alert_level_fantasy', type: 'status_text', default_value_key: 'alert_level_calm', default_status_key: 'alert_level_calm_val' }
            ]},
            { id: 'enemy-focus-box', title_key: 'title_enemy_focus', type: 'hidden_until_active', initial_expanded: true, indicator_key: 'combat_engaged', items: [
                { id: 'enemy_name', label_key: 'label_enemy_name', type: 'text', default_value_key: 'none' },
                { id: 'enemy_hp', label_key: 'label_enemy_hp', type: 'meter', meter_type: 'health', default_value: '0' }
            ]}
        ]
    }
};