// Located in: theme-configs.js

const ALL_THEMES_CONFIG = {
  scifi: {
    id: "scifi",
    name_short_key: "theme_name_short_scifi",
    name_long_key: "theme_name_long_scifi",
    icon: "images/themes/icon_scifi.svg",
    lore_key: "theme_lore_scifi",
    inspiration_key: "theme_inspiration_scifi",
    tone_key: "theme_tone_scifi",
    concept_key: "theme_concept_scifi",
    category_key: "theme_category_scifi",
    style_key: "theme_style_scifi",
    naming_convention: "asset",
    dashboard_config_ref: "scifi",
    playable: true,
  },
  grim_warden: {
    id: "grim_warden",
    name_short_key: "theme_name_short_grim_warden",
    name_long_key: "theme_name_long_grim_warden",
    icon: "images/themes/icon_grim_warden.svg", // Ensure this icon exists or use a placeholder
    lore_key: "theme_lore_grim_warden",
    inspiration_key: "theme_inspiration_grim_warden",
    tone_key: "theme_tone_grim_warden",
    concept_key: "theme_concept_grim_warden",
    category_key: "theme_category_grim_warden",
    style_key: "theme_style_grim_warden",
    naming_convention: "entity",
    dashboard_config_ref: "grim_warden",
    playable: true,
  },
  // Add more themes here
};

// --- Theme-Specific Dashboard Configurations ---
const THEME_DASHBOARD_CONFIGS = {
  scifi: {
    left_panel: [
      {
        id: "captain-status-panel-box",
        title_key: "title_captain_status",
        type: "collapsible",
        initial_expanded: true,
        items: [
          {
            id: "name",
            label_key: "label_player_name",
            type: "text",
            default_value_key: "unknown",
            must_translate: false,
            short_description:
              "Player character name or callsign chosen by the player.",
          },
          {
            id: "credits",
            label_key: "label_player_credits",
            type: "number_text",
            default_value_key: "unknown",
            must_translate: true,
            short_description:
              'Total amount of credits the player has. The "UEC" suffix is universal and should not be translated.',
          },
          {
            id: "reputation",
            label_key: "label_player_reputation",
            type: "text",
            default_value_key: "unknown",
            must_translate: true,
            short_description:
              'Reputation of the player. Be creative and avoid generic terms where possible. E.g., not just "Neutral", but perhaps something more flavorful if the scenario warrants it.',
          },
          {
            id: "affiliation",
            label_key: "label_player_affiliation",
            type: "text",
            default_value_key: "unknown",
            must_translate: true,
            short_description:
              'Describe the player\'s initial faction or organisation or background hint. E.g., not just "Independent".',
          },
        ],
      },
      {
        id: "ship-status-panel-box",
        title_key: "title_ship_status",
        type: "collapsible",
        initial_expanded: false,
        boot_delay: 1200,
        items: [
          {
            id: "shipName",
            label_key: "label_ship_name",
            type: "text",
            default_value_key: "unknown",
            must_translate: true,
            short_description: "Original name of the ship.",
          },
          {
            id: "shipType",
            label_key: "label_ship_type",
            type: "text",
            default_value_key: "unknown",
            must_translate: true,
            short_description: "Original type of the ship.",
          },
          {
            id: "integrityPct",
            label_key: "label_ship_integrity",
            type: "meter",
            meter_type: "integrity",
            default_value: "0",
            must_translate: false,
            short_description:
              'Ship\'s integrity 0-100 (e.g., "100", "95", "15" ... if the start is rough).',
          },
          {
            id: "shieldsPct",
            label_key: "label_ship_shields",
            type: "meter",
            meter_type: "shields",
            default_value: "0",
            status_text_id: "shieldsStatus",
            default_status_key: "offline",
            must_translate: true,
            short_description:
              'Ship\'s shields 0-100 (e.g., "100", "70", "0") and The textual part describing shield state, e.g., "Online" or "Offline" as "shieldsStatus". If shields are active, `shieldsPct` must be > "0". If inactive, `shieldsPct` must be "0".',
          },
          {
            id: "fuelPct",
            label_key: "label_ship_fuel",
            type: "meter",
            meter_type: "fuel",
            default_value: "0",
            must_translate: false,
            short_description: "Current fuel percentage (0-100).",
          },
          {
            id: "cargo",
            label_key: "label_ship_cargo",
            type: "text_long",
            default_value_key: "cargo_empty_scu",
            must_translate: true,
            short_description:
              'Describe cargo, including quantity and universal unit "SCU". Make it relevant and interesting.',
          },
          {
            id: "currentShipSpeed",
            label_key: "label_ship_speed",
            type: "text",
            default_value: "0 m/s",
            must_translate: true,
            short_description:
              'Current speed of the ship (e.g., "0 m/s", "Docked", "Drifting - Engines Offline"). If numeric, include "m/s".',
          },
        ],
      },
      {
        id: "comms-channel-panel-box",
        title_key: "title_comms_channel",
        type: "hidden_until_active",
        initial_expanded: true,
        indicator_key: "comms_channel_active",
        items: [
          {
            id: "comms_channel_info",
            label_key: "label_comms_status",
            type: "text_long",
            default_value_key: "comms_inactive",
            must_translate: true,
            short_description:
              'Describe comms status. E.g., the conceptual equivalent of "No active channel" or "Encrypted signal detected".',
          },
        ],
      },
    ],
    right_panel: [
      {
        id: "mission-intel-panel-box",
        title_key: "title_active_directive",
        type: "collapsible",
        initial_expanded: true,
        items: [
          {
            id: "objective",
            label_key: "label_directive_details",
            type: "text_long",
            default_value_key: "objective_none",
            must_translate: true,
            short_description:
              "A concise, compelling initial QUEST, crafted originally. This should be an engaging starting point for the story.",
          },
          {
            id: "directiveReward",
            label_key: "label_directive_reward",
            type: "text",
            default_value_key: "unknown",
            must_translate: true,
            short_description:
              "A tantalizing reward or hint of reward for completing the objective.",
          },
          {
            id: "directive_status",
            label_key: "label_directive_status",
            type: "text",
            default_value_key: "status_idle",
            must_translate: true,
            short_description:
              'A concise description of the player\'s current primary activity. This should translate the *concept* of an activity like "System Check", "Docked", "Investigating" into an appropriate, concise phrase.',
          },
          {
            id: "alertLevel",
            label_key: "label_alert_level",
            type: "status_text",
            default_value_key: "alert_level_green",
            default_status_key: "alert_level_green_val",
            must_translate: false,
            short_description:
              'MUST be one of: "Green", "Yellow", "Red". The script uses these specific English key-phrases for parsing. (e.g. "Condition Green", "Condition Yellow", "Condition Red")',
          },
        ],
      },
      {
        id: "navigation-data-panel-box",
        title_key: "title_navigation_data",
        type: "collapsible",
        initial_expanded: false,
        boot_delay: 1200,
        items: [
          {
            id: "location",
            label_key: "label_current_location",
            type: "text_long",
            default_value_key: "unknown",
            must_translate: true,
            short_description:
              "Current location of the ship. This should be a descriptive name of the location, not just a generic term. Be specific and evocative.",
          },
          {
            id: "systemFaction",
            label_key: "label_system_faction",
            type: "text",
            default_value_key: "unknown",
            must_translate: true,
            short_description:
              "Faction or organisation that controls the current location. Invent unique faction names.",
          },
          {
            id: "environment",
            label_key: "label_environment",
            type: "text_long",
            default_value_key: "unknown",
            must_translate: true,
            short_description:
              "Describe the environment of the current location. Be creative and avoid generic terms where possible.",
          },
          {
            id: "sensorConditions",
            label_key: "label_sensor_conditions",
            type: "text_long",
            default_value_key: "unknown",
            must_translate: true,
            short_description:
              "Describe sensor readings or ambient conditions.",
          },
          {
            id: "stardate",
            label_key: "label_stardate",
            type: "text",
            default_value_key: "unknown",
            must_translate: false,
            short_description:
              'Stardate in which the player is playing e.g., "SD 47632.4", "Cycle 89.Day 12.Shift 3" - pick a format.',
          },
        ],
      },
      {
        id: "enemy-intel-panel-box",
        title_key: "title_enemy_intel",
        type: "hidden_until_active",
        initial_expanded: true,
        indicator_key: "combat_engaged",
        items: [
          {
            id: "enemy_ship_type",
            label_key: "label_enemy_ship_type",
            type: "text",
            default_value_key: "none",
            must_translate: true,
            short_description:
              'Provide the NARRATIVE LANGUAGE equivalent for "None" or "N/A" if no enemy. If an enemy *is* present, its type MUST be an original name.',
          },
          {
            id: "enemy_shields_pct",
            label_key: "label_enemy_shields",
            type: "meter",
            meter_type: "enemy_shields",
            default_value: "0",
            status_text_id: "enemy_shields_status_text",
            default_status_key: "offline",
            must_translate: true,
            short_description:
              'Enemy shields 0-100 (e.g., "100", "70", "0") and The textual part describing shield state, e.g. "Online" or "Offline", as "enemy_shields_status_text". If active, `enemy_shields_pct` must be > "0". If inactive, `enemy_shields_pct` must be "0".',
          },
          {
            id: "enemy_hull_pct",
            label_key: "label_enemy_hull",
            type: "meter",
            meter_type: "enemy_hull",
            default_value: "0",
            must_translate: false,
            short_description:
              'Enemy hull integrity 0-100 (e.g., "100", "95", "15").',
          },
        ],
      },
    ],
    game_state_indicators: [
      {
        id: "comms_channel_active",
        label_key: "label_comms_channel_active",
        type: "boolean",
        default_value: false,
        must_translate: false,
        short_description:
          "Indicates if a direct communication channel is active (true) or not (false).",
      },
      {
        id: "combat_engaged",
        label_key: "label_combat_engaged",
        type: "boolean",
        default_value: false,
        must_translate: false,
        short_description:
          "Indicates if the player is currently in active combat (true) or not (false). Should be false on initial turn unless starting in combat.",
      },
      {
        id: "rare_loot_finded",
        label_key: "label_rare_loot_finded",
        type: "boolean",
        default_value: false,
        must_translate: false,
        short_description:
          "Indicates if the player has just found rare loot (true) or not (false). Typically set to true for one turn then false.",
      },
    ],
  },
  grim_warden: {
    left_panel: [
      {
        id: "character-status-panel-box",
        title_key: "title_character_status_grim_warden",
        type: "collapsible",
        initial_expanded: true,
        items: [
          {
            id: "character_name",
            label_key: "label_character_name_grim_warden",
            type: "text",
            default_value_key: "unknown_warden",
            must_translate: false, // Name is chosen by player, not translated by AI
            short_description: "Player character's chosen name or title.",
          },
          {
            id: "silver_pieces",
            label_key: "label_character_coin_grim_warden",
            type: "number_text", // e.g., "15 Silver"
            default_value_key: "pouch_light",
            must_translate: true, // The amount and descriptive term, unit "Silver" is universal
            short_description:
              "Amount of silver currency the Warden possesses. Use descriptive terms or numbers. Unit 'Silver' is common.",
          },
          {
            id: "renown",
            label_key: "label_character_renown_grim_warden",
            type: "text",
            default_value_key: "unknown_figure",
            must_translate: true,
            short_description:
              "The Warden's reputation. E.g., 'Whispered Dread', 'Grim Savior', 'Untested Novice', 'Bane of Ghouls'.",
          },
          {
            id: "oath_allegiance",
            label_key: "label_character_oath_grim_warden",
            type: "text",
            default_value_key: "warden_initiate",
            must_translate: true,
            short_description:
              "Warden's standing/oath. E.g., 'Bound by the Old Code', 'Exiled Seeker', 'Last of the Silent Chapter', 'Mercenary Heart'.",
          },
        ],
      },
      {
        id: "vitality-gear-panel-box",
        title_key: "title_vitality_gear_grim_warden",
        type: "collapsible",
        initial_expanded: false,
        boot_delay: 1000, // Slightly different delay for variety
        items: [
          {
            id: "healthPct",
            label_key: "label_character_health_grim_warden",
            type: "meter",
            meter_type: "health", // For potential specific styling/logic
            default_value: "0", // Will be set by AI, this is for UI init
            must_translate: false, // The percentage value
            short_description:
              "Character's current health 0-100 (e.g., '100', '65', '10' for near death).",
          },
          {
            id: "staminaPct",
            label_key: "label_character_stamina_grim_warden",
            type: "meter",
            meter_type: "stamina", // For potential specific styling/logic
            default_value: "0",
            must_translate: false,
            short_description:
              "Character's current stamina/energy 0-100. Used for combat maneuvers, sprinting etc.",
          },
          {
            id: "elixir_charges",
            label_key: "label_elixir_charges_grim_warden",
            type: "text", // Can be "2 Charges", "None", "One Brew Left"
            default_value_key: "charges_none",
            must_translate: true,
            short_description:
              "Number of available potent alchemical elixirs or poultices. E.g., '2 Charges', 'One Dose Left', 'Empty Vials'.",
          },
          {
            id: "armor_condition",
            label_key: "label_armor_condition_grim_warden",
            type: "text",
            default_value_key: "armor_worn",
            must_translate: true,
            short_description:
              "Descriptive condition of the Warden's armor. E.g., 'Pristine Leather', 'Battle-Scarred Plate', 'Tattered Gambeson'.",
          },
          {
            id: "weapon_condition",
            label_key: "label_weapon_condition_grim_warden",
            type: "text",
            default_value_key: "weapon_reliable",
            must_translate: true,
            short_description:
              "Descriptive condition of the Warden's primary weapon. E.g., 'Keen Edge', 'Chipped Axe', 'Silvered Blade (Dull)'.",
          },
          {
            id: "current_burden",
            label_key: "label_current_burden_grim_warden",
            type: "text_long", // Allows more descriptive text
            default_value_key: "burden_unencumbered",
            must_translate: true,
            short_description:
              "Current encumbrance. E.g., 'Unencumbered', 'Lightly Laden (Herbs & Scrolls)', 'Heavily Burdened (Gryphon Head)'.",
          },
        ],
      },
      {
        id: "omens-whispers-panel-box",
        title_key: "title_omens_whispers_grim_warden",
        type: "hidden_until_active", // Shows when 'omen_detected' is true
        initial_expanded: true,
        indicator_key: "omen_detected",
        items: [
          {
            id: "omen_details",
            label_key: "label_omen_details_grim_warden",
            type: "text_long",
            default_value_key: "omens_none_active",
            must_translate: true,
            short_description:
              "Details of active omens, visions, or unnatural whispers. E.g., 'A chilling premonition of a beast in the old mill', 'The wind carries faint, mournful cries from the barrow downs'.",
          },
        ],
      },
    ],
    right_panel: [
      {
        id: "current-hunt-panel-box",
        title_key: "title_current_hunt_grim_warden",
        type: "collapsible",
        initial_expanded: true,
        items: [
          {
            id: "current_quest",
            label_key: "label_current_quest_grim_warden",
            type: "text_long",
            default_value_key: "quest_none_active",
            must_translate: true,
            short_description:
              "The current primary QUEST or HUNT. E.g., 'Track the Wight terrorizing Oakhaven', 'Investigate the Blighted Spring in Gloomwood'.",
          },
          {
            id: "quest_reward_rumor",
            label_key: "label_quest_reward_grim_warden",
            type: "text",
            default_value_key: "reward_unknown",
            must_translate: true,
            short_description:
              "Rumored reward for the quest. E.g., 'A hefty pouch of silver', 'Ancient Warden schematics', 'The Baron's Favor'.",
          },
          {
            id: "activity_status", // Renamed from directive_status
            label_key: "label_activity_status_grim_warden",
            type: "text",
            default_value_key: "status_vigilant", // e.g., "Vigilant", "Tracking"
            must_translate: true,
            short_description:
              "Warden's current primary activity. E.g., 'Tracking Prey', 'Preparing Ambush', 'Consulting Locals', 'Resting at Campfire'.",
          },
          {
            id: "threat_level", // Renamed from alertLevel
            label_key: "label_threat_level_grim_warden",
            type: "status_text",
            default_value_key: "threat_level_calm", // UI display text key
            default_status_key: "threat_level_calm_val", // AI value key (e.g. "Calm")
            must_translate: false, // The *value* like "Calm", "Wary", "Danger" is English for AI. UI text is translated.
            short_description:
              "MUST be one of: 'Calm', 'Wary', 'Danger'. Represents immediate environmental threat. (e.g. UI: 'Conditions Calm', AI Value: 'Calm').",
          },
        ],
      },
      {
        id: "local-environment-panel-box",
        title_key: "title_local_environment_grim_warden",
        type: "collapsible",
        initial_expanded: false,
        boot_delay: 1000,
        items: [
          {
            id: "current_location_desc",
            label_key: "label_current_location_grim_warden",
            type: "text_long",
            default_value_key: "location_unknown_wilds",
            must_translate: true,
            short_description:
              "Descriptive name of current location. Be evocative. E.g., 'The Gloomwood Forest', 'Ruins of Old Kingspire', 'Brackish Mire near Oakhaven'.",
          },
          {
            id: "regional_control",
            label_key: "label_regional_control_grim_warden",
            type: "text",
            default_value_key: "control_disputed_lands",
            must_translate: true,
            short_description:
              "Faction controlling current region. E.g., 'Barony of Falcrest (Decaying)', 'Blightspawn Territory', 'Nomad Clans (Hostile)'.",
          },
          {
            id: "ambient_conditions",
            label_key: "label_ambient_conditions_grim_warden",
            type: "text_long",
            default_value_key: "conditions_bleak",
            must_translate: true,
            short_description:
              "Immediate environment/weather. E.g., 'Overcast, chilling wind', 'Dense, unnaturally silent fog', 'Twisted, Blighted flora under a sickly moon'.",
          },
          {
            id: "blight_intensity",
            label_key: "label_blight_intensity_grim_warden",
            type: "text_long",
            default_value_key: "blight_faint_traces",
            must_translate: true,
            short_description:
              "Perceived Blight intensity. E.g., 'Faint Traces', 'Moderate Corruption - Twisted Fauna', 'Overwhelming Blight - Air Thickens'.",
          },
          {
            id: "current_moon_cycle",
            label_key: "label_moon_cycle_grim_warden",
            type: "text",
            default_value_key: "moon_cycle_unknown",
            must_translate: false, // Format consistent, elements can be words translated by UI layer if needed
            short_description:
              "Current moon phase or local time. E.g., 'Full Moon, Midnight', 'Third Bell, Waning Crescent', 'Blood Moon Rising'.",
          },
        ],
      },
      {
        id: "monster-intel-panel-box",
        title_key: "title_monster_intel_grim_warden",
        type: "hidden_until_active", // Shows when 'combat_active' is true
        initial_expanded: true,
        indicator_key: "combat_active", // Themed version of combat_engaged
        items: [
          {
            id: "monster_type",
            label_key: "label_monster_type_grim_warden",
            type: "text",
            default_value_key: "target_none_sighted",
            must_translate: true,
            short_description:
              "Type of monster engaged. MUST be original/thematic. E.g., 'Gravewight', 'Blightfang Wolf', 'Rotting Treant'. Use 'None Sighted' or similar if no target.",
          },
          {
            id: "monster_toughness_pct",
            label_key: "label_monster_toughness_grim_warden",
            type: "meter",
            meter_type: "monster_defense", // For specific styling/logic
            default_value: "0",
            status_text_id: "monster_defense_status_text", // Associated status text field
            default_status_key: "defense_breached", // Default status if 0%
            must_translate: true, // The status text (e.g., "Armor Intact")
            short_description:
              "Monster's defenses (armor/hide/magic) 0-100. Status text (e.g. 'Armor Intact', 'Weakened') as 'monster_defense_status_text'. If active, pct > 0.",
          },
          {
            id: "monster_vitality_pct",
            label_key: "label_monster_vitality_grim_warden",
            type: "meter",
            meter_type: "monster_health", // For specific styling/logic
            default_value: "0",
            must_translate: false, // The percentage value
            short_description:
              "Monster's remaining vitality/health 0-100. E.g., '100', '50', 'Near Death (5)'.",
          },
        ],
      },
    ],
    game_state_indicators: [
      {
        id: "omen_detected",
        label_key: "label_omen_detected_grim_warden",
        type: "boolean",
        default_value: false,
        must_translate: false,
        short_description:
          "Indicates if a mystical omen or significant whisper is currently active (true) or not (false).",
      },
      {
        id: "combat_active", // Themed version of combat_engaged
        label_key: "label_combat_active_grim_warden",
        type: "boolean",
        default_value: false,
        must_translate: false,
        short_description:
          "Indicates if the Warden is in active combat (true) or not (false). False on initial turn unless starting in combat.",
      },
      {
        id: "rare_trophy_claimed", // Themed version of rare_loot_finded
        label_key: "label_rare_trophy_claimed_grim_warden",
        type: "boolean",
        default_value: false,
        must_translate: false,
        short_description:
          "Indicates if the Warden has just claimed a rare monster trophy or valuable item (true) or not (false). Typically true for one turn then false.",
      },
    ],
  },
};
