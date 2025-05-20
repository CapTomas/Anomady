// Located in: theme-configs.js

const ALL_THEMES_CONFIG = {
    scifi: {
        id: 'scifi',
        name_key: 'theme_name_scifi',
        icon: 'images/themes/icon_scifi.svg',
        lore_key: 'theme_lore_scifi',
        inspiration_key: 'theme_inspiration_scifi',
        tone_key: 'theme_tone_scifi',
        concept_key: 'theme_concept_scifi',
        category_key: 'theme_category_scifi', // Added
        style_key: 'theme_style_scifi',       // Added
        naming_convention: 'asset',           // Added: 'asset' for ships/tech, 'entity' for characters/creatures
        dashboard_config_ref: 'scifi',
        playable: true
    },
    fantasy: {
        id: 'fantasy',
        name_key: 'theme_name_fantasy',
        icon: 'images/themes/icon_fantasy.svg',
        lore_key: 'theme_lore_fantasy',
        inspiration_key: 'theme_inspiration_fantasy',
        tone_key: 'theme_tone_fantasy',
        concept_key: 'theme_concept_fantasy',
        category_key: 'theme_category_fantasy', // Added
        style_key: 'theme_style_fantasy',       // Added
        naming_convention: 'entity',            // Added
        dashboard_config_ref: 'fantasy',
        playable: true
    },
    cosmic_misrule: {
        id: 'cosmic_misrule',
        name_key: 'theme_name_cosmic_misrule',
        icon: 'images/themes/icon_cosmic_misrule.svg',
        lore_key: 'theme_lore_cosmic_misrule',
        inspiration_key: 'theme_inspiration_cosmic_misrule',
        tone_key: 'theme_tone_cosmic_misrule',
        concept_key: 'theme_concept_cosmic_misrule',
        category_key: 'theme_category_cosmic_misrule', // Added
        style_key: 'theme_style_cosmic_misrule',       // Added
        naming_convention: 'entity',                   // Added (can be adjusted if it has unique items)
        dashboard_config_ref: 'cosmic_misrule',
        playable: true
    }
    // Add more themes here
};

// --- Theme-Specific Dashboard Configurations ---
const THEME_DASHBOARD_CONFIGS = {
    scifi: {
        left_panel: [
            {
                id: 'captain-status-panel-box', title_key: 'title_captain_status', type: 'collapsible', initial_expanded: true, items: [
                    // Changed 'callsign' to 'name' for consistency with master prompts
                    { id: 'name', label_key: 'label_player_name', type: 'text', default_value_key: 'unknown', must_translate: false, short_description: 'Player character name or callsign chosen by the player.' },
                    { id: 'credits', label_key: 'label_player_credits', type: 'number_text', default_value_key: 'unknown', must_translate: true, short_description: 'Total amount of credits the player has. The "UEC" suffix is universal and should not be translated.' },
                    { id: 'reputation', label_key: 'label_player_reputation', type: 'text', default_value_key: 'unknown', must_translate: true, short_description: 'Reputation of the player. Be creative and avoid generic terms where possible. E.g., not just "Neutral", but perhaps something more flavorful if the scenario warrants it.' },
                    { id: 'affiliation', label_key: 'label_player_affiliation', type: 'text', default_value_key: 'unknown', must_translate: true, short_description: 'Describe the player\'s initial faction or organisation or background hint. E.g., not just "Independent".' },
                ]
            },
            {
                id: 'ship-status-panel-box', title_key: 'title_ship_status', type: 'collapsible', initial_expanded: false, boot_delay: 1200, items: [
                    { id: 'shipName', label_key: 'label_ship_name', type: 'text', default_value_key: 'unknown', must_translate: true, short_description: 'Original name of the ship.' },
                    { id: 'shipType', label_key: 'label_ship_type', type: 'text', default_value_key: 'unknown', must_translate: true, short_description: 'Original type of the ship.' },
                    { id: 'integrityPct', label_key: 'label_ship_integrity', type: 'meter', meter_type: 'integrity', default_value: '0', must_translate: false, short_description: 'Ship\'s integrity 0-100 (e.g., "100", "95", "15" ... if the start is rough).' },
                    { id: 'shieldsPct', label_key: 'label_ship_shields', type: 'meter', meter_type: 'shields', default_value: '0', status_text_id: 'shieldsStatus', default_status_key: 'offline', must_translate: true, short_description: 'Ship\'s shields 0-100 (e.g., "100", "70", "0") and The textual part describing shield state, e.g., "Online" or "Offline" as "shieldsStatus". If shields are active, `shieldsPct` must be > "0". If inactive, `shieldsPct` must be "0".' },
                    { id: 'fuelPct', label_key: 'label_ship_fuel', type: 'meter', meter_type: 'fuel', default_value: '0',  must_translate: false, short_description: 'Current fuel percentage (0-100).' },
                    { id: 'cargo', label_key: 'label_ship_cargo', type: 'text_long', default_value_key: 'cargo_empty_scu', must_translate: true, short_description: 'Describe cargo, including quantity and universal unit "SCU". Make it relevant and interesting.' },
                    { id: 'currentShipSpeed', label_key: 'label_ship_speed', type: 'text', default_value: '0 m/s', must_translate: true, short_description: 'Current speed of the ship (e.g., "0 m/s", "Docked", "Drifting - Engines Offline"). If numeric, include "m/s".' },
                ]
            },
            {
                id: 'comms-channel-panel-box', title_key: 'title_comms_channel', type: 'hidden_until_active', initial_expanded: true, indicator_key: 'comms_channel_active', items: [
                    { id: 'comms_channel_info', label_key: 'label_comms_status', type: 'text_long', default_value_key: 'comms_inactive', must_translate: true, short_description: 'Describe comms status. E.g., the conceptual equivalent of "No active channel" or "Encrypted signal detected".' },
                ]
            }
        ],
        right_panel: [
            {
                id: 'mission-intel-panel-box', title_key: 'title_active_directive', type: 'collapsible', initial_expanded: true, items: [
                    { id: 'objective', label_key: 'label_directive_details', type: 'text_long', default_value_key: 'objective_none', must_translate: true, short_description: 'A concise, compelling initial QUEST, crafted originally. This should be an engaging starting point for the story.' },
                    { id: 'directiveReward', label_key: 'label_directive_reward', type: 'text', default_value_key: 'unknown', must_translate: true, short_description: 'A tantalizing reward or hint of reward for completing the objective.' },
                    { id: 'directive_status', label_key: 'label_directive_status', type: 'text', default_value_key: 'status_idle', must_translate: true, short_description: 'A concise description of the player\'s current primary activity. This should translate the *concept* of an activity like "System Check", "Docked", "Investigating" into an appropriate, concise phrase.' },
                    { id: 'alertLevel', label_key: 'label_alert_level', type: 'status_text', default_value_key: 'alert_level_green', default_status_key: 'alert_level_green_val', must_translate: false, short_description: 'MUST be one of: "Green", "Yellow", "Red". The script uses these specific English key-phrases for parsing. (e.g. "Condition Green", "Condition Yellow", "Condition Red")' }
                ]
            },
            {
                id: 'navigation-data-panel-box', title_key: 'title_navigation_data', type: 'collapsible', initial_expanded: false, boot_delay: 1200, items: [
                    { id: 'location', label_key: 'label_current_location', type: 'text_long', default_value_key: 'unknown', must_translate: true, short_description: 'Current location of the ship. This should be a descriptive name of the location, not just a generic term. Be specific and evocative.' },
                    { id: 'systemFaction', label_key: 'label_system_faction', type: 'text', default_value_key: 'unknown', must_translate: true, short_description: 'Faction or organisation that controls the current location. Invent unique faction names.' },
                    { id: 'environment', label_key: 'label_environment', type: 'text_long', default_value_key: 'unknown', must_translate: true, short_description: 'Describe the environment of the current location. Be creative and avoid generic terms where possible.' },
                    { id: 'sensorConditions', label_key: 'label_sensor_conditions', type: 'text_long', default_value_key: 'unknown', must_translate: true, short_description: 'Describe sensor readings or ambient conditions.' },
                    { id: 'stardate', label_key: 'label_stardate', type: 'text', default_value_key: 'unknown', must_translate: false, short_description: 'Stardate in which the player is playing e.g., "SD 47632.4", "Cycle 89.Day 12.Shift 3" - pick a format.' },
                ]
            },
            {
                id: 'enemy-intel-panel-box', title_key: 'title_enemy_intel', type: 'hidden_until_active', initial_expanded: true, indicator_key: 'combat_engaged', items: [
                    { id: 'enemy_ship_type', label_key: 'label_enemy_ship_type', type: 'text', default_value_key: 'none', must_translate: true, short_description: 'Provide the NARRATIVE LANGUAGE equivalent for "None" or "N/A" if no enemy. If an enemy *is* present, its type MUST be an original name.' },
                    { id: 'enemy_shields_pct', label_key: 'label_enemy_shields', type: 'meter', meter_type: 'enemy_shields', default_value: '0', status_text_id: 'enemy_shields_status_text', default_status_key: 'offline', must_translate: true, short_description: 'Enemy shields 0-100 (e.g., "100", "70", "0") and The textual part describing shield state, e.g. "Online" or "Offline", as "enemy_shields_status_text". If active, `enemy_shields_pct` must be > "0". If inactive, `enemy_shields_pct` must be "0".' },
                    { id: 'enemy_hull_pct', label_key: 'label_enemy_hull', type: 'meter', meter_type: 'enemy_hull', default_value: '0', must_translate: false, short_description: 'Enemy hull integrity 0-100 (e.g., "100", "95", "15").' },
                ]
            }
        ],
        game_state_indicators: [ // Added for Sci-Fi
            { id: 'comms_channel_active', label_key: 'label_comms_channel_active', type: 'boolean', default_value: false, must_translate: false, short_description: 'Indicates if a direct communication channel is active (true) or not (false).' },
            { id: 'combat_engaged', label_key: 'label_combat_engaged', type: 'boolean', default_value: false, must_translate: false, short_description: 'Indicates if the player is currently in active combat (true) or not (false). Should be false on initial turn unless starting in combat.' },
            { id: 'rare_loot_finded', label_key: 'label_rare_loot_finded', type: 'boolean', default_value: false, must_translate: false, short_description: 'Indicates if the player has just found rare loot (true) or not (false). Typically set to true for one turn then false.' }
        ]
    },
    fantasy: { // Updated fantasy to match structure, including player identifier 'character_name'
        left_panel: [
            {
                id: 'character-overview-box', title_key: 'title_character_overview', type: 'static', items: [
                    { id: 'character_name', label_key: 'label_character_name', type: 'text', default_value_key: 'unknown', must_translate: false, short_description: 'Character name chosen by the player.' },
                    { id: 'character_class', label_key: 'label_character_class', type: 'text', default_value_key: 'unknown', must_translate: true, short_description: 'Player character\'s class or archetype.' },
                    { id: 'character_level', label_key: 'label_character_level', type: 'number_text', default_value: 1, must_translate: false, short_description: 'Player character\'s current level.' },
                    { id: 'gold', label_key: 'label_gold', type: 'number_text', default_value: 0, suffix: ' GP', must_translate: false, short_description: 'Amount of gold pieces the player possesses.' }
                ]
            },
            {
                id: 'character-vitals-box', title_key: 'title_character_vitals', type: 'collapsible', initial_expanded: true, items: [
                    { id: 'hp', label_key: 'label_hp', type: 'meter', meter_type: 'health', default_value: '100', must_translate: false, short_description: 'Character health points (0-100%).' },
                    { id: 'mana', label_key: 'label_mana', type: 'meter', meter_type: 'mana', default_value: '100', must_translate: false, short_description: 'Character mana or magic points (0-100%).' },
                    { id: 'stamina', label_key: 'label_stamina', type: 'meter', meter_type: 'stamina', default_value: '100', must_translate: false, short_description: 'Character stamina or energy points (0-100%).' },
                    { id: 'equipped_weapon', label_key: 'label_equipped_weapon', type: 'text', default_value_key: 'none', must_translate: true, short_description: 'Name of the currently equipped weapon.' },
                    { id: 'equipped_armor', label_key: 'label_equipped_armor', type: 'text', default_value_key: 'none', must_translate: true, short_description: 'Name of the currently equipped armor.' }
                ]
            }
        ],
        right_panel: [
            {
                id: 'quest-log-box', title_key: 'title_quest_log', type: 'static', items: [
                    { id: 'current_quest', label_key: 'label_current_quest', type: 'text_long', default_value_key: 'objective_none', must_translate: true, short_description: 'A concise, compelling current QUEST or objective.' },
                    { id: 'quest_reward', label_key: 'label_quest_reward', type: 'text', default_value_key: 'unknown', must_translate: true, short_description: 'The reward for completing the current quest.' },
                    { id: 'quest_status', label_key: 'label_quest_status', type: 'text', default_value_key: 'status_idle', must_translate: true, short_description: 'Current status of the quest or primary activity.' },
                    { id: 'alert_level', label_key: 'label_alert_level_fantasy', type: 'status_text', default_value_key: 'alert_level_calm', default_status_key: 'alert_level_calm_val', must_translate: false, short_description: 'Current awareness or danger level. MUST be "Calm", "Wary", or "Danger".' }
                ]
            },
            {
                id: 'enemy-focus-box', title_key: 'title_enemy_focus', type: 'hidden_until_active', initial_expanded: true, indicator_key: 'combat_engaged', items: [
                    { id: 'enemy_name', label_key: 'label_enemy_name', type: 'text', default_value_key: 'none', must_translate: true, short_description: 'Name of the enemy if in combat, "None" otherwise.' },
                    { id: 'enemy_hp', label_key: 'label_enemy_hp', type: 'meter', meter_type: 'health', default_value: '0', must_translate: false, short_description: 'Enemy health points (0-100%) if in combat.' }
                ]
            }
        ],
        game_state_indicators: [ // Added for Fantasy
            { id: 'combat_engaged', label_key: 'label_combat_engaged', type: 'boolean', default_value: false, must_translate: false, short_description: 'Indicates if the player is currently in active combat (true) or not (false). Should be false on initial turn unless starting in combat.' },
            { id: 'magic_detected', label_key: 'label_magic_detected', type: 'boolean', default_value: false, must_translate: false, short_description: 'Indicates if a magical effect or presence has just been detected (true) or not (false). Typically set to true for one turn then false.' },
            { id: 'rare_loot_finded', label_key: 'label_rare_loot_finded', type: 'boolean', default_value: false, must_translate: false, short_description: 'Indicates if the player has just found rare loot (true) or not (false). Typically set to true for one turn then false.' }
        ]
    },
    cosmic_misrule: {
        left_panel: [
            {
                id: 'bureaucratic-status-box', title_key: 'title_bureaucratic_status', type: 'static', items: [
                    { id: 'name', label_key: 'label_player_name', type: 'text', default_value_key: 'unknown', must_translate: false, short_description: 'The operative\'s designation or name.' },
                    { id: 'clearance_level', label_key: 'label_clearance_level', type: 'text', default_value_key: 'level_0_unclassified', must_translate: true, short_description: 'Current bureaucratic clearance level (e.g., "Level 7 Sub-Paragraph Q").' },
                    { id: 'pending_forms', label_key: 'label_pending_forms', type: 'number_text', default_value: 42, must_translate: false, short_description: 'Number of unresolved forms or tasks.' },
                    { id: 'department_affiliation', label_key: 'label_department_affiliation', type: 'text', default_value_key: 'dept_unassigned', must_translate: true, short_description: 'Current departmental assignment (e.g., "Ministry of Redundant Paperwork").' }
                ]
            },
            {
                id: 'reality-integrity-box', title_key: 'title_reality_integrity', type: 'collapsible', initial_expanded: true, items: [
                    { id: 'local_reality_status', label_key: 'label_local_reality_status', type: 'text', default_value_key: 'reality_stable_ish', must_translate: true, short_description: 'Current stability of the local reality (e.g., "Nominally Coherent", "Experiencing Minor Paradoxes").' },
                    { id: 'absurdity_index', label_key: 'label_absurdity_index', type: 'meter', meter_type: 'absurdity', default_value: '10', must_translate: false, short_description: 'Local absurdity levels (0-100%). Higher is... more interesting.' },
                    { id: 'stapler_supply', label_key: 'label_stapler_supply', type: 'text', default_value_key: 'staples_critically_low', must_translate: true, short_description: 'Status of crucial office supplies.' }
                ]
            }
        ],
        right_panel: [
            {
                id: 'current-mandate-box', title_key: 'title_current_mandate', type: 'static', items: [
                    { id: 'objective', label_key: 'label_mandate_objective', type: 'text_long', default_value_key: 'mandate_awaiting_assignment', must_translate: true, short_description: 'The current ludicrous task or directive assigned by the bureaucracy.' },
                    { id: 'mandate_reward', label_key: 'label_mandate_reward', type: 'text', default_value_key: 'reward_extra_staple', must_translate: true, short_description: 'The (likely underwhelming) reward for completing the mandate.' },
                    { id: 'mandate_status', label_key: 'label_mandate_status', type: 'text', default_value_key: 'status_pending_ triplicate', must_translate: true, short_description: 'Current status of the mandate (e.g., "Pending Form 3022-C Approval").' },
                    { id: 'alertLevel', label_key: 'label_alert_level_cosmic', type: 'status_text', default_value_key: 'alert_level_beige', default_status_key: 'alert_level_beige_val', must_translate: false, short_description: 'Bureaucratic alert level. MUST be "Beige", "Mauve", or "Plaid".' }
                ]
            },
            {
                id: 'target-entity-box', title_key: 'title_target_entity', type: 'hidden_until_active', initial_expanded: true, indicator_key: 'audit_in_progress', items: [ // Example of a custom indicator
                    { id: 'entity_name', label_key: 'label_entity_name', type: 'text', default_value_key: 'none', must_translate: true, short_description: 'Name of the entity being audited/investigated.' },
                    { id: 'entity_compliance_rating', label_key: 'label_entity_compliance', type: 'meter', meter_type: 'compliance', default_value: '50', must_translate: false, short_description: 'Compliance rating of the target entity (0-100%).' }
                ]
            }
        ],
        game_state_indicators: [
            { id: 'audit_in_progress', label_key: 'label_audit_in_progress', type: 'boolean', default_value: false, must_translate: false, short_description: 'Indicates if a bureaucratic audit or investigation is active (true) or not (false).' },
            { id: 'paradox_event_imminent', label_key: 'label_paradox_event_imminent', type: 'boolean', default_value: false, must_translate: false, short_description: 'Indicates if a reality-bending paradox event is about to occur (true) or not (false).' }
        ]
    }
};