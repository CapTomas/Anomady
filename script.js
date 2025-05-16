document.addEventListener('DOMContentLoaded', () => {
    let GEMINI_API_KEY = "";
    const DEFAULT_LANGUAGE = 'cs';
    const DEFAULT_THEME = 'scifi';
    const UPDATE_HIGHLIGHT_DURATION = 5000; // ms

    const THEME_STORAGE_KEY = 'soperaCurrentTheme';
    const GAME_STATE_STORAGE_KEY_PREFIX = 'soperaGameState_';
    const MODEL_PREFERENCE_STORAGE_KEY = 'soperaModelPreference';
    const LANGUAGE_PREFERENCE_STORAGE_KEY = 'preferredAppLanguage'; // Using this for app lang
    const NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY = 'preferredNarrativeLanguage';


    const PAID_MODEL_NAME = "gemini-1.5-flash-latest"; // Updated model
    const FREE_MODEL_NAME = "gemini-1.5-flash-latest"; // For now, can be different later
    let currentModelName = localStorage.getItem(MODEL_PREFERENCE_STORAGE_KEY) || FREE_MODEL_NAME;

    let currentTheme = localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME;
    let currentAppLanguage = localStorage.getItem(LANGUAGE_PREFERENCE_STORAGE_KEY) || DEFAULT_LANGUAGE;
    let currentNarrativeLanguage = localStorage.getItem(NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY) || currentAppLanguage;


    const PROMPT_URLS_BY_THEME = {
        scifi: {
            initial: 'prompts/scifi/initial.txt',
            default: 'prompts/scifi/default.txt',
            combat: 'prompts/scifi/combat.txt',
            starts: 'prompts/scifi/helpers/starts.txt',
            entity_names_en: 'prompts/scifi/helpers/ship_names_en.txt', // Generic name for entities
            entity_names_cs: 'prompts/scifi/helpers/ship_names_cs.txt'
        },
        fantasy: {
            initial: 'prompts/fantasy/initial.txt',
            default: 'prompts/fantasy/default.txt',
            combat: 'prompts/fantasy/combat.txt',
            starts: 'prompts/fantasy/helpers/start_scenarios.txt',
            entity_names_en: 'prompts/fantasy/helpers/character_names_en.txt',
            entity_names_cs: 'prompts/fantasy/helpers/character_names_cs.txt'
        }
    };
    let gamePrompts = {}; // Will be populated as { theme: { promptName: promptText } }

    let currentPromptType = 'initial';

    // UI Elements (Core Controls)
    const platformLogoElement = document.getElementById('platform-logo');
    const themeSelectorElement = document.getElementById('theme-selector');
    const systemStatusIndicator = document.getElementById('system-status-indicator');
    const gmSpecificActivityIndicator = document.getElementById('gm-activity-indicator');
    const languageToggleButton = document.getElementById('language-toggle-button');
    const newGameButton = document.getElementById('new-game-button');
    const modelToggleButton = document.getElementById('model-toggle-button');

    // Dynamic Console Containers
    const leftConsole = document.getElementById('left-console');
    const rightConsole = document.getElementById('right-console');

    // Story & Input
    const storyLog = document.getElementById('story-log');
    const storyLogViewport = document.getElementById('story-log-viewport');
    const suggestedActionsWrapper = document.getElementById('suggested-actions-wrapper');
    const nameInputSection = document.getElementById('name-input-section');
    const playerCallsignInput = document.getElementById('player-name-input'); // Name can be callsign, character name, etc.
    const startGameButton = document.getElementById('start-game-button');
    const actionInputSection = document.getElementById('action-input-section');
    const playerActionInput = document.getElementById('player-action-input');
    const sendActionButton = document.getElementById('send-action-button');

    let gameHistory = [];
    let playerIdentifier = ''; // Used for callsign, character name, etc.
    let isInitialGameLoad = true;

    let lastKnownDashboardUpdates = {};
    let lastKnownGameStateIndicators = {};

    // --- THEME_DASHBOARD_CONFIGS ---
    const THEME_DASHBOARD_CONFIGS = {
        scifi: {
            left_console: [
                {
                    id: 'captain-status-console-box', title_key: 'title_captain_status', type: 'collapsible', initial_expanded: true,
                    items: [
                        { id: 'callsign', label_key: 'label_player_callsign', type: 'text', default_value_key: 'unknown' },
                        { id: 'credits', label_key: 'label_player_credits', type: 'number_text', default_value_key: 'unknown', suffix: ' UEC' },
                        { id: 'reputation', label_key: 'label_player_reputation', type: 'text', default_value_key: 'unknown' },
                        { id: 'affiliation', label_key: 'label_player_affiliation', type: 'text', default_value_key: 'unknown' }
                    ]
                },
                {
                    id: 'ship-status-console-box', title_key: 'title_ship_status', type: 'collapsible', initial_expanded: false, boot_delay: 1200,
                    items: [
                        { id: 'shipName', label_key: 'label_ship_name', type: 'text', default_value_key: 'unknown' },
                        { id: 'shipType', label_key: 'label_ship_type', type: 'text', default_value_key: 'unknown' },
                        { id: 'integrityPct', label_key: 'label_ship_integrity', type: 'meter', meter_type: 'integrity', default_value: '0' },
                        { id: 'shieldsPct', label_key: 'label_ship_shields', type: 'meter', meter_type: 'shields', default_value: '0', status_text_id: 'shieldsStatus', default_status_key: 'offline' },
                        { id: 'fuelPct', label_key: 'label_ship_fuel', type: 'meter', meter_type: 'fuel', default_value: '0' },
                        { id: 'cargo', label_key: 'label_ship_cargo', type: 'text_long', default_value_key: 'cargo_empty_scu' },
                        { id: 'currentShipSpeed', label_key: 'label_ship_speed', type: 'text', default_value: '0 m/s' }
                    ]
                },
                {
                    id: 'comms-channel-console-box', title_key: 'title_comms_channel', type: 'hidden_until_active', initial_expanded: true, indicator_key: 'comms_channel_active',
                    items: [
                        { id: 'comms_channel_info', label_key: 'label_comms_status', type: 'text_long', default_value_key: 'comms_inactive' }
                    ]
                }
            ],
            right_console: [
                {
                    id: 'mission-intel-console-box', title_key: 'title_active_directive', type: 'collapsible', initial_expanded: true,
                    items: [
                        { id: 'objective', label_key: 'label_directive_details', type: 'text_long', default_value_key: 'objective_none' },
                        { id: 'directiveReward', label_key: 'label_directive_reward', type: 'text', default_value_key: 'unknown' },
                        { id: 'directive_status', label_key: 'label_directive_status', type: 'text', default_value_key: 'status_idle' },
                        { id: 'alertLevel', label_key: 'label_alert_level', type: 'status_text', default_value_key: 'alert_level_green', default_status_key: 'alert_level_green_val' } // default_status_key provides the actual value for status_text
                    ]
                },
                {
                    id: 'navigation-data-console-box', title_key: 'title_navigation_data', type: 'collapsible', initial_expanded: false, boot_delay: 1200,
                    items: [
                        { id: 'location', label_key: 'label_current_location', type: 'text_long', default_value_key: 'unknown' },
                        { id: 'systemFaction', label_key: 'label_system_faction', type: 'text', default_value_key: 'unknown' },
                        { id: 'environment', label_key: 'label_environment', type: 'text_long', default_value_key: 'unknown' },
                        { id: 'sensorConditions', label_key: 'label_sensor_conditions', type: 'text_long', default_value_key: 'unknown' },
                        { id: 'stardate', label_key: 'label_stardate', type: 'text', default_value_key: 'unknown' }
                    ]
                },
                {
                    id: 'enemy-intel-console-box', title_key: 'title_enemy_intel', type: 'hidden_until_active', initial_expanded: true, indicator_key: 'combat_engaged',
                    items: [
                        { id: 'enemy_ship_type', label_key: 'label_enemy_ship_type', type: 'text', default_value_key: 'none' },
                        { id: 'enemy_shields_pct', label_key: 'label_enemy_shields', type: 'meter', meter_type: 'enemy_shields', default_value: '0', status_text_id: 'enemy_shields_status_text', default_status_key: 'offline' },
                        { id: 'enemy_hull_pct', label_key: 'label_enemy_hull', type: 'meter', meter_type: 'enemy_hull', default_value: '0' }
                    ]
                }
            ]
        },
        fantasy: {
            left_console: [
                {
                    id: 'character-overview-box', title_key: 'title_character_overview', type: 'static', // Static means always expanded, no collapse
                    items: [
                        { id: 'character_name', label_key: 'label_character_name', type: 'text', default_value_key: 'unknown' },
                        { id: 'character_class', label_key: 'label_character_class', type: 'text', default_value_key: 'unknown' },
                        { id: 'character_level', label_key: 'label_character_level', type: 'number_text', default_value: 1 },
                        { id: 'gold', label_key: 'label_gold', type: 'number_text', default_value: 0, suffix: ' GP' }
                    ]
                },
                {
                    id: 'character-vitals-box', title_key: 'title_character_vitals', type: 'collapsible', initial_expanded: true, // Collapsible means it can be expanded/collapsed
                    items: [
                        { id: 'hp', label_key: 'label_hp', type: 'meter', meter_type: 'health', default_value: '100' },
                        { id: 'mana', label_key: 'label_mana', type: 'meter', meter_type: 'mana', default_value: '100' },
                        { id: 'stamina', label_key: 'label_stamina', type: 'meter', meter_type: 'stamina', default_value: '100' },
                        { id: 'equipped_weapon', label_key: 'label_equipped_weapon', type: 'text', default_value_key: 'none' },
                        { id: 'equipped_armor', label_key: 'label_equipped_armor', type: 'text', default_value_key: 'none' }
                    ]
                }
            ],
            right_console: [
                {
                    id: 'quest-log-box', title_key: 'title_quest_log', type: 'static',
                    items: [
                        { id: 'current_quest', label_key: 'label_current_quest', type: 'text_long', default_value_key: 'objective_none' },
                        { id: 'quest_reward', label_key: 'label_quest_reward', type: 'text', default_value_key: 'unknown' },
                        { id: 'quest_status', label_key: 'label_quest_status', type: 'text', default_value_key: 'status_idle' },
                        { id: 'alert_level', label_key: 'label_alert_level_fantasy', type: 'status_text', default_value_key: 'alert_level_calm', default_status_key: 'alert_level_calm_val' } 
                    ]
                },
                {
                    id: 'enemy-focus-box', title_key: 'title_enemy_focus', type: 'hidden_until_active', initial_expanded: true, indicator_key: 'combat_engaged', // This will be shown when combat is engaged
                    items: [
                        { id: 'enemy_name', label_key: 'label_enemy_name', type: 'text', default_value_key: 'none' },
                        { id: 'enemy_hp', label_key: 'label_enemy_hp', type: 'meter', meter_type: 'health', default_value: '0' } 
                    ]
                }
            ]
        }
    };

    // --- UI TEXT DATA ---
    const uiTextData = {
        scifi: {
            en: {
                "theme_name": "Sci-Fi",
                "toggle_language": "Česky", "aria_label_toggle_language": "Switch to Czech",
                "system_status_online_short": "Core Online", "system_processing_short": "Processing...",
                "title_captain_status": "Captain's Log", "label_player_callsign": "Callsign:", "label_player_credits": "Credits:", "label_player_reputation": "Reputation:", "label_player_affiliation": "Affiliation:",
                "title_ship_status": "Ship Diagnostics", "label_ship_name": "Registry:", "label_ship_type": "Class:", "label_ship_integrity": "Integrity:", "label_ship_shields": "Shields:", "label_ship_fuel": "Fuel:", "label_ship_cargo": "Cargo:", "label_ship_speed": "Speed:",
                "title_comms_channel": "Comms Channel", "label_comms_status": "Channel:",
                "title_active_directive": "Directive", "label_directive_details": "Objective:", "label_directive_reward": "Reward:", "label_directive_status": "Status:", "label_alert_level": "Alert:",
                "title_navigation_data": "NavData", "label_current_location": "Location:", "label_system_faction": "Faction:", "label_environment": "Env.:", "label_sensor_conditions": "Sensors:", "label_stardate": "Stardate:",
                "title_enemy_intel": "Enemy Intel", "label_enemy_ship_type": "Target Type:", "label_enemy_shields": "Target Shields:", "label_enemy_hull": "Target Hull:",
                "placeholder_callsign_login": "Enter Callsign...", "placeholder_command": "Enter command...", "button_access_systems": "Access Systems", "button_execute_command": "Transmit",
                "status_ok": "Operational", "status_warning": "Caution", "status_danger": "Critical", "status_error": "System Fault",
                "unknown": "Unknown", "standby": "Standby", "online": "Online", "offline": "Offline", "none": "None", "not_available_short": "N/A", "cargo_empty_scu": "Empty / 0 SCU", "comms_inactive": "Inactive", "objective_none": "No active objective.", "status_idle": "Idle",
                "initializing": "Initializing...", "connecting": "Authenticating: {PLAYER_ID}",
                "active": "Active", "failed": "Failure",
                "system_lang_set_en": "System: UI & Narrative set to ENGLISH.", "system_lang_set_cs": "System: UI & Narrative set to CZECH.",
                "alert_level_green": "Condition Green", "alert_level_yellow": "Condition Yellow", "alert_level_red": "Condition Red", "alert_level_info": "Status Nominal",
                "alert_level_green_val": "Green", "alert_level_yellow_val": "Yellow", "alert_level_red_val": "Red", "alert_level_info_val": "Nominal",
                "activity_exploring": "Exploring", "activity_fighting": "Combat", "activity_communicating": "Comms Active",
                "button_new_game": "New Game", "aria_label_new_game": "Start a new game",
                "confirm_new_game": "Start new game? Progress in the current theme will be lost.",
                "confirm_new_game_theme_scifi": "Start new Sci-Fi adventure? Current Sci-Fi progress will be lost.",
                "confirm_new_game_theme_fantasy": "Start new Fantasy adventure? Current Fantasy progress will be lost.",
                "label_toggle_model": "Model", "aria_label_toggle_model_generic": "Toggle AI Model",
                "button_toggle_to_free": "Free Model", "button_toggle_to_paid": "Paid Model",
                "aria_label_current_model_paid": "Using Paid AI. Switch to Free.", "aria_label_current_model_free": "Using Free AI. Switch to Paid.",
                "system_model_set_paid": "System: Switched to Paid AI Model ({MODEL_NAME}).", "system_model_set_free": "System: Switched to Free AI Model ({MODEL_NAME}).",
                "system_session_resumed": "Welcome back, {PLAYER_ID}! Session resumed for {THEME_NAME}.",
                "system_theme_set_scifi": "System: Sci-Fi theme activated. Loading assets...",
                "system_theme_set_fantasy": "System: Fantasy theme activated. Loading assets...",
                "system_new_game_initiated": "System: New {THEME_NAME} game sequence initiated.",
            },
            cs: {
                "theme_name": "Sci-Fi",
                "toggle_language": "English", "aria_label_toggle_language": "Přepnout do angličtiny",
                "system_status_online_short": "Jádro OK", "system_processing_short": "Zpracovávám...",
                "title_captain_status": "Kapitánský Záznam", "label_player_callsign": "Volací Znak:", "label_player_credits": "Kredity:", "label_player_reputation": "Reputace:", "label_player_affiliation": "Příslušnost:",
                "title_ship_status": "Diagnostika Lodi", "label_ship_name": "Registrace:", "label_ship_type": "Třída:", "label_ship_integrity": "Integrita:", "label_ship_shields": "Štíty:", "label_ship_fuel": "Palivo:", "label_ship_cargo": "Náklad:", "label_ship_speed": "Rychlost:",
                "title_comms_channel": "Kom. Kanál", "label_comms_status": "Kanál:",
                "title_active_directive": "Direktiva", "label_directive_details": "Úkol:", "label_directive_reward": "Odměna:", "label_directive_status": "Stav:", "label_alert_level": "Výstraha:",
                "title_navigation_data": "NavData", "label_current_location": "Pozice:", "label_system_faction": "Frakce:", "label_environment": "Prostředí:", "label_sensor_conditions": "Senzory:", "label_stardate": "Hvězdné datum:",
                "title_enemy_intel": "Nepřítel Info", "label_enemy_ship_type": "Typ Cíle:", "label_enemy_shields": "Štíty Cíle:", "label_enemy_hull": "Trup Cíle:",
                "placeholder_callsign_login": "Zadejte volací znak...", "placeholder_command": "Zadejte příkaz...", "button_access_systems": "Připojit k Systému", "button_execute_command": "Odeslat",
                "status_ok": "V provozu", "status_warning": "Pozor", "status_danger": "Kritické", "status_error": "Chyba systému",
                "unknown": "Neznámý", "standby": "Pohotovost", "online": "Online", "offline": "Offline", "none": "Žádný", "not_available_short": "N/A", "cargo_empty_scu": "Prázdný / 0 SCU", "comms_inactive": "Neaktivní", "objective_none": "Žádný aktivní úkol.", "status_idle": "Nečinný",
                "initializing": "Inicializuji...", "connecting": "Ověřuji totožnost: {PLAYER_ID}",
                "active": "Aktivní", "failed": "Selhání",
                "system_lang_set_en": "Systém: UI a Příběh nastaveny na ANGLIČTINU.", "system_lang_set_cs": "Systém: UI a Příběh nastaveny na ČEŠTINU.",
                "alert_level_green": "Stav Zelený", "alert_level_yellow": "Stav Žlutý", "alert_level_red": "Stav Červený", "alert_level_info": "Stav Nominální",
                "alert_level_green_val": "Zelená", "alert_level_yellow_val": "Žlutá", "alert_level_red_val": "Červená", "alert_level_info_val": "Nominální",
                "activity_exploring": "Průzkum", "activity_fighting": "Boj", "activity_communicating": "Komunikace Aktivní",
                "button_new_game": "Nová Hra", "aria_label_new_game": "Začít novou hru",
                "confirm_new_game": "Začít novou hru? Postup v aktuálním tématu bude ztracen.",
                "confirm_new_game_theme_scifi": "Začít nové Sci-Fi dobrodružství? Aktuální Sci-Fi postup bude ztracen.",
                "confirm_new_game_theme_fantasy": "Začít nové Fantasy dobrodružství? Aktuální Fantasy postup bude ztracen.",
                "label_toggle_model": "Model", "aria_label_toggle_model_generic": "Přepnout AI Model",
                "button_toggle_to_free": "Model Zdarma", "button_toggle_to_paid": "Placený Model",
                "aria_label_current_model_paid": "Používáte Placený AI. Přepnout na Zdarma.", "aria_label_current_model_free": "Používáte Zdarma AI. Přepnout na Placený.",
                "system_model_set_paid": "Systém: Přepnuto na Placený AI Model ({MODEL_NAME}).", "system_model_set_free": "Systém: Přepnuto na Model Zdarma ({MODEL_NAME}).",
                "system_session_resumed": "Vítejte zpět, {PLAYER_ID}! Relace obnovena pro {THEME_NAME}.",
                "system_theme_set_scifi": "Systém: Sci-Fi téma aktivováno. Nahrávám zdroje...",
                "system_theme_set_fantasy": "Systém: Fantasy téma aktivováno. Nahrávám zdroje...",
                "system_new_game_initiated": "Systém: Zahájena sekvence nové hry ({THEME_NAME}).",
            }
        },
        fantasy: {
            en: {
                "theme_name": "Fantasy",
                "toggle_language": "Česky", "aria_label_toggle_language": "Switch to Czech",
                "system_status_online_short": "Magic Active", "system_processing_short": "Divining...",
                "title_character_overview": "Character", "label_character_name": "Name:", "label_character_class": "Class:", "label_character_level": "Level:", "label_gold": "Gold:",
                "title_character_vitals": "Vitals", "label_hp": "Health:", "label_mana": "Mana:", "label_stamina": "Stamina:", "label_equipped_weapon": "Weapon:", "label_equipped_armor": "Armor:",
                "title_quest_log": "Quest Log", "label_current_quest": "Current Quest:", "label_quest_reward": "Reward:", "label_quest_status": "Status:", "label_alert_level_fantasy": "Awareness:", // Fantasy specific alert label
                "title_enemy_focus": "Enemy Focus", "label_enemy_name": "Enemy:", "label_enemy_hp": "Enemy Health:",
                "placeholder_callsign_login": "Enter Character Name...", "placeholder_command": "Declare action...", "button_access_systems": "Begin Adventure", "button_execute_command": "Declare",
                "status_ok": "Stable", "status_warning": "Wary", "status_danger": "Peril", "status_error": "Curse Active",
                "unknown": "Obscured", "standby": "Ready", "online": "Awake", "offline": "Dormant", "none": "None", "not_available_short": "N/A", "objective_none": "No active quest.", "status_idle": "Resting",
                "initializing": "Awakening...", "connecting": "Known as: {PLAYER_ID}",
                "active": "Engaged", "failed": "Defeated",
                "system_lang_set_en": "System: Scrolls and whispers now in ENGLISH.", "system_lang_set_cs": "System: Scrolls and whispers now in CZECH.",
                "alert_level_calm": "Calm", "alert_level_wary": "Wary", "alert_level_danger": "Danger!", "alert_level_info": "Situation Normal", // Fantasy specific alert levels
                "alert_level_calm_val": "Calm", "alert_level_wary_val": "Wary", "alert_level_danger_val": "Danger", "alert_level_info_val": "Normal",
                "activity_exploring": "Exploring", "activity_fighting": "Combat", "activity_communicating": "Speaking", // Fantasy activity
                "button_new_game": "New Tale", "aria_label_new_game": "Start a new tale",
                "confirm_new_game": "Begin new tale? Progress in the current realm will be lost.",
                "confirm_new_game_theme_scifi": "Start new Sci-Fi adventure? Current Sci-Fi progress will be lost.",
                "confirm_new_game_theme_fantasy": "Start new Fantasy adventure? Current Fantasy progress will be lost.",
                "label_toggle_model": "Oracle", "aria_label_toggle_model_generic": "Toggle Oracle Source",
                "button_toggle_to_free": "Free Oracle", "button_toggle_to_paid": "True Oracle",
                "aria_label_current_model_paid": "Using True Oracle. Switch to Free.", "aria_label_current_model_free": "Using Free Oracle. Switch to True.",
                "system_model_set_paid": "System: Switched to True Oracle ({MODEL_NAME}).", "system_model_set_free": "System: Switched to Free Oracle ({MODEL_NAME}).",
                "system_session_resumed": "Welcome back, {PLAYER_ID}! Your legend continues in {THEME_NAME}.",
                "system_theme_set_scifi": "System: Sci-Fi theme activated. Loading assets...",
                "system_theme_set_fantasy": "System: Fantasy theme activated. Loading assets...",
                "system_new_game_initiated": "System: New {THEME_NAME} tale begins.",
            },
            cs: {
                "theme_name": "Fantasy",
                "toggle_language": "English", "aria_label_toggle_language": "Přepnout do angličtiny",
                "system_status_online_short": "Magie Aktivní", "system_processing_short": "Věštím...",
                "title_character_overview": "Postava", "label_character_name": "Jméno:", "label_character_class": "Třída:", "label_character_level": "Úroveň:", "label_gold": "Zlaťáky:",
                "title_character_vitals": "Životní síly", "label_hp": "Zdraví:", "label_mana": "Mana:", "label_stamina": "Výdrž:", "label_equipped_weapon": "Zbraň:", "label_equipped_armor": "Zbroj:",
                "title_quest_log": "Deník Úkolů", "label_current_quest": "Aktuální Úkol:", "label_quest_reward": "Odměna:", "label_quest_status": "Stav:", "label_alert_level_fantasy": "Ostražitost:",
                "title_enemy_focus": "Zaměření na Nepřítele", "label_enemy_name": "Nepřítel:", "label_enemy_hp": "Zdraví Nepřítele:",
                "placeholder_callsign_login": "Zadejte jméno postavy...", "placeholder_command": "Popište akci...", "button_access_systems": "Začít Dobrodružství", "button_execute_command": "Provést",
                "status_ok": "Stabilní", "status_warning": "Obezřetný", "status_danger": "Nebezpečí", "status_error": "Kletba Aktivní",
                "unknown": "Zahalené", "standby": "Připraven", "online": "Vzhůru", "offline": "Spící", "none": "Žádné", "not_available_short": "N/A", "objective_none": "Žádný aktivní úkol.", "status_idle": "Odpočívám",
                "initializing": "Probouzím se...", "connecting": "Známý jako: {PLAYER_ID}",
                "active": "V akci", "failed": "Poražen",
                "system_lang_set_en": "Systém: Svityky a šepot nyní v ANGLIČTINĚ.", "system_lang_set_cs": "Systém: Svityky a šepot nyní v ČEŠTINĚ.",
                "alert_level_calm": "Klid", "alert_level_wary": "Ostražitý", "alert_level_danger": "Nebezpečí!", "alert_level_info": "Situace Normální",
                "alert_level_calm_val": "Klid", "alert_level_wary_val": "Ostražitý", "alert_level_danger_val": "Nebezpečí", "alert_level_info_val": "Normální",
                "activity_exploring": "Průzkum", "activity_fighting": "Boj", "activity_communicating": "Rozmluva",
                "button_new_game": "Nový Příběh", "aria_label_new_game": "Začít nový příběh",
                "confirm_new_game": "Začít nový příběh? Postup v aktuální říši bude ztracen.",
                "confirm_new_game_theme_scifi": "Začít nové Sci-Fi dobrodružství? Aktuální Sci-Fi postup bude ztracen.",
                "confirm_new_game_theme_fantasy": "Začít nové Fantasy dobrodružství? Aktuální Fantasy postup bude ztracen.",
                "label_toggle_model": "Věštba", "aria_label_toggle_model_generic": "Přepnout Zdroj Věštby",
                "button_toggle_to_free": "Věštba Zdarma", "button_toggle_to_paid": "Pravá Věštba",
                "aria_label_current_model_paid": "Používáte Pravou Věštbu. Přepnout na Zdarma.", "aria_label_current_model_free": "Používáte Věštbu Zdarma. Přepnout na Pravou.",
                "system_model_set_paid": "Systém: Přepnuto na Pravou Věštbu ({MODEL_NAME}).", "system_model_set_free": "Systém: Přepnuto na Věštbu Zdarma ({MODEL_NAME}).",
                "system_session_resumed": "Vítejte zpět, {PLAYER_ID}! Vaše legenda pokračuje v {THEME_NAME}.",
                "system_theme_set_scifi": "Systém: Sci-Fi téma aktivováno. Nahrávám zdroje...",
                "system_theme_set_fantasy": "Systém: Fantasy téma aktivováno. Nahrávám zdroje...",
                "system_new_game_initiated": "Systém: Začíná nový příběh ({THEME_NAME}).",
            }
        }
    };

    const NARRATIVE_LANG_PROMPT_PARTS_BY_THEME = {
        scifi: {
            en: `This narrative must be written in fluent, immersive English, suitable for a high-quality sci-fi novel. Dialogue should be natural.`,
            cs: `Tento příběh musí být napsán plynulou, poutavou češtinou, vhodnou pro kvalitní sci-fi román. Dialogy by měly být přirozené.`
        },
        fantasy: {
            en: `This narrative must be written in fluent, immersive English, suitable for a high-quality fantasy novel. Dialogue should be epic and archaic or modern as appropriate.`,
            cs: `Tento příběh musí být napsán plynulou, poutavou češtinou, vhodnou pro kvalitní fantasy román. Dialogy by měly být epické a archaické nebo moderní podle potřeby.`
        }
    };


    /**
     * Get localized and themed UI text.
     * @param {string} key - The translation key.
     * @param {object} [replacements={}] - Optional replacements for placeholders like {PLACEHOLDER}.
     * @returns {string} The translated text or the key itself if not found.
     */
    function getUIText(key, replacements = {}) {
        let text = uiTextData[currentTheme]?.[currentAppLanguage]?.[key] ||
                   uiTextData[currentTheme]?.en?.[key] || // Fallback to English for current theme
                   uiTextData[DEFAULT_THEME]?.[currentAppLanguage]?.[key] || // Fallback to default theme, current lang
                   uiTextData[DEFAULT_THEME]?.en?.[key] || // Fallback to default theme, English
                   key; // Fallback to the key itself

        for (const placeholder in replacements) {
            text = text.replace(new RegExp(`{${placeholder}}`, 'g'), replacements[placeholder]);
        }
        return text;
    }


    function updateModelToggleButtonText() {
        if (!modelToggleButton) return;
        const isPaidActive = currentModelName === PAID_MODEL_NAME;
        
        const textKey = isPaidActive ? "button_toggle_to_free" : "button_toggle_to_paid";
        const ariaKey = isPaidActive ? "aria_label_current_model_paid" : "aria_label_current_model_free";

        modelToggleButton.textContent = getUIText(textKey, { MODEL_NAME: currentModelName });
        const ariaLabelText = getUIText(ariaKey, { MODEL_NAME: currentModelName });
        modelToggleButton.setAttribute('aria-label', ariaLabelText);
        modelToggleButton.setAttribute('title', ariaLabelText);
    }

    function toggleModelType() {
        currentModelName = (currentModelName === PAID_MODEL_NAME) ? FREE_MODEL_NAME : PAID_MODEL_NAME;
        localStorage.setItem(MODEL_PREFERENCE_STORAGE_KEY, currentModelName);
        updateModelToggleButtonText();

        const messageKey = (currentModelName === PAID_MODEL_NAME) ? "system_model_set_paid" : "system_model_set_free";
        addMessageToLog(getUIText(messageKey, { MODEL_NAME: currentModelName }), 'system');
    }

    function setupApiKey() {
        GEMINI_API_KEY = localStorage.getItem('userGeminiApiKey');
        if (!GEMINI_API_KEY) {
            GEMINI_API_KEY = prompt("Welcome to the Interactive Narrative Engine!\nPlease enter your Google Gemini API Key to begin:", "");
            if (GEMINI_API_KEY && GEMINI_API_KEY.trim() !== "") {
                localStorage.setItem('userGeminiApiKey', GEMINI_API_KEY);
            } else {
                GEMINI_API_KEY = ""; // Ensure it's blank if cancelled or empty
                alert("Gemini API Key is required. Please refresh and provide a key, or check console for manual override.");
            }
        }

        if (!GEMINI_API_KEY) {
            const apiKeyErrorMsg = "CRITICAL: Gemini API Key not provided.\n" +
                                 "The application cannot connect to the AI.\n" +
                                 "Please refresh and enter your key. To change it later: F12 -> Application -> Local Storage -> delete 'userGeminiApiKey', then refresh.";
            addMessageToLog(apiKeyErrorMsg, 'system');
            if (systemStatusIndicator) {
                systemStatusIndicator.textContent = getUIText('status_error');
                systemStatusIndicator.className = 'status-indicator status-danger';
            }
            [startGameButton, playerCallsignInput, playerActionInput, sendActionButton].forEach(el => {
                if (el) el.disabled = true;
            });
            return false;
        }
        return true;
    }

    /**
     * Saves the current game state to localStorage, specific to the current theme.
     */
    function saveGameState() {
        if (!playerIdentifier) return; // Don't save if no active player/game
        const gameStateKey = GAME_STATE_STORAGE_KEY_PREFIX + currentTheme;
        const gameState = {
            playerIdentifier: playerIdentifier,
            gameHistory: gameHistory,
            lastDashboardUpdates: lastKnownDashboardUpdates,
            lastGameStateIndicators: lastKnownGameStateIndicators,
            currentPromptType: currentPromptType,
            currentNarrativeLanguage: currentNarrativeLanguage,
            // currentAppLanguage is saved globally, not per-game
        };
        try {
            localStorage.setItem(gameStateKey, JSON.stringify(gameState));
            console.log(`Game state saved for theme '${currentTheme}'.`);
        } catch (e) {
            console.error("Error saving game state:", e);
            addMessageToLog("System: Error saving game progress.", 'system-error');
        }
    }

    /**
     * Loads game state from localStorage for the current theme.
     * @returns {boolean} True if game state was successfully loaded, false otherwise.
     */
    function loadGameState() {
        const gameStateKey = GAME_STATE_STORAGE_KEY_PREFIX + currentTheme;
        try {
            const savedStateString = localStorage.getItem(gameStateKey);
            if (!savedStateString) {
                console.log(`No saved game state found for theme '${currentTheme}'.`);
                return false;
            }

            const savedState = JSON.parse(savedStateString);
            if (!savedState.playerIdentifier || !savedState.gameHistory || savedState.gameHistory.length === 0) {
                console.warn("Saved game state is incomplete for theme '${currentTheme}'. Starting new game for this theme.");
                clearGameStateInternal(); // Clear internal vars, but not localStorage for this theme yet
                return false;
            }

            playerIdentifier = savedState.playerIdentifier;
            gameHistory = savedState.gameHistory;
            lastKnownDashboardUpdates = savedState.lastDashboardUpdates || {};
            lastKnownGameStateIndicators = savedState.lastGameStateIndicators || {};
            currentPromptType = savedState.currentPromptType || 'default';
            currentNarrativeLanguage = savedState.currentNarrativeLanguage || currentAppLanguage;
            // currentAppLanguage is global, loaded in initializeApp

            if (storyLog) storyLog.innerHTML = '';
            gameHistory.forEach(turn => {
                if (turn.role === 'user') {
                    addMessageToLog(turn.parts[0].text, 'player');
                } else if (turn.role === 'model') {
                    try {
                        const modelResponse = JSON.parse(turn.parts[0].text);
                        addMessageToLog(modelResponse.narrative, 'gm');
                    } catch (e) {
                        console.error("Error parsing model response from saved history:", e);
                        addMessageToLog("Error: Could not reconstruct part of the story.", 'system');
                    }
                }
            });

            if (Object.keys(lastKnownDashboardUpdates).length > 0) {
                updateDashboard(lastKnownDashboardUpdates, false); // false = not initial AI update
            } else {
                 initializeDashboardDefaultTexts(); // If no updates, set defaults
            }
            if (Object.keys(lastKnownGameStateIndicators).length > 0) {
                handleGameStateIndicators(lastKnownGameStateIndicators, false); // false = not initial boot
            }
            
            // Update player identifier display if applicable for the theme
            const playerIdentifierConfig = findItemConfigById(THEME_DASHBOARD_CONFIGS[currentTheme], 'callsign') || findItemConfigById(THEME_DASHBOARD_CONFIGS[currentTheme], 'character_name');
            if (playerIdentifierConfig) {
                const el = document.getElementById(`info-${playerIdentifierConfig.id}`);
                if (el) el.textContent = playerIdentifier;
            }


            console.log(`Game state loaded successfully for theme '${currentTheme}'.`);
            isInitialGameLoad = false;
            return true;

        } catch (e) {
            console.error(`Error loading game state for theme '${currentTheme}':`, e);
            clearGameStateInternal(); // Clear potentially corrupted state
            localStorage.removeItem(gameStateKey); // Remove corrupted save
            return false;
        }
    }
    
    /** Clears only the internal JS variables for game state. */
    function clearGameStateInternal() {
        gameHistory = [];
        playerIdentifier = '';
        currentPromptType = 'initial';
        isInitialGameLoad = true;
        lastKnownDashboardUpdates = {};
        lastKnownGameStateIndicators = {};
        if (storyLog) storyLog.innerHTML = '';
        clearSuggestedActions();
    }


    /**
     * Clears game state from localStorage for the current theme and resets internal state.
     */
    function clearGameState() {
        const gameStateKey = GAME_STATE_STORAGE_KEY_PREFIX + currentTheme;
        localStorage.removeItem(gameStateKey);
        clearGameStateInternal();
        // Dashboard defaults will be set by generateConsolesForTheme -> initializeDashboardDefaultTexts
        console.log(`Game state cleared for theme '${currentTheme}'.`);
    }

    /**
     * Fetches a single prompt file for a given theme.
     * @param {string} promptName - The name of the prompt (e.g., 'initial', 'default').
     * @param {string} theme - The theme to load the prompt for.
     * @returns {Promise<string>} The prompt text or an error message.
     */
    async function fetchPrompt(promptName, theme) {
        const themePrompts = PROMPT_URLS_BY_THEME[theme];
        if (!themePrompts || !themePrompts[promptName]) {
            console.error(`Prompt URL for "${promptName}" in theme "${theme}" not defined.`);
            return `Error: Prompt "${promptName}" for theme "${theme}" not found.`;
        }
        try {
            const response = await fetch(themePrompts[promptName]);
            if (!response.ok) {
                throw new Error(`Failed to load prompt ${theme}/${promptName}: ${response.statusText}`);
            }
            return await response.text();
        } catch (error) {
            console.error(error);
            addMessageToLog(`SYSTEM ERROR: Could not load critical game prompt: ${theme}/${promptName}.`, 'system');
            return `Error: Prompt "${theme}/${promptName}" could not be loaded. ${error.message}`;
        }
    }

    /**
     * Loads all prompts for the specified theme into the gamePrompts object.
     * @param {string} theme - The theme for which to load prompts.
     * @returns {Promise<boolean>} True if all prompts loaded successfully, false otherwise.
     */
    async function loadAllPromptsForTheme(theme) {
        if (!PROMPT_URLS_BY_THEME[theme]) {
            console.error(`No prompts defined for theme: ${theme}`);
            addMessageToLog(`SYSTEM ERROR: Prompts for theme "${theme}" are not configured.`, 'system');
            return false;
        }
        if (!gamePrompts[theme]) {
            gamePrompts[theme] = {};
        }

        const promptNames = Object.keys(PROMPT_URLS_BY_THEME[theme]);
        const loadingPromises = promptNames.map(name =>
            fetchPrompt(name, theme).then(text => {
                gamePrompts[theme][name] = text;
            })
        );

        try {
            await Promise.all(loadingPromises);
            console.log(`All prompts for theme "${theme}" loaded.`);
            for (const name of promptNames) {
                if (gamePrompts[theme][name] && gamePrompts[theme][name].startsWith("Error:")) {
                    throw new Error(`Failed to load prompt: ${theme}/${name}`);
                }
            }
            return true;
        } catch (error) {
            console.error(`Failed to load one or more prompts for theme "${theme}":`, error);
            if (systemStatusIndicator) {
                systemStatusIndicator.textContent = getUIText('status_error');
                systemStatusIndicator.className = 'status-indicator status-danger';
            }
            [startGameButton, playerCallsignInput].forEach(el => { if (el) el.disabled = true; });
            return false;
        }
    }


    /**
     * Sets the application language and applies theme-specific UI text.
     * Also updates the body class for theme-specific CSS.
     * @param {string} lang - The language code (e.g., 'en', 'cs').
     * @param {string} theme - The current theme name (e.g., 'scifi', 'fantasy').
     */
    function setAppLanguageAndTheme(lang, theme) {
        currentAppLanguage = lang;
        localStorage.setItem(LANGUAGE_PREFERENCE_STORAGE_KEY, lang);
        // currentNarrativeLanguage might be different, handle separately or sync if desired
        if (document.documentElement) {
            document.documentElement.lang = lang;
        }

        // Update body theme class
        document.body.className = ''; // Clear all previous classes first
        document.body.classList.add(`theme-${theme}`);
        if (document.body.classList.contains('initial-state')) { // Preserve initial-state if present
             // This class is managed by game flow, not theme/lang changes directly
        }


        // Update general UI elements that might exist before dashboard generation
        if (languageToggleButton) {
            const otherLang = lang === 'en' ? 'cs' : 'en'; // Simple toggle
            languageToggleButton.textContent = uiTextData[theme]?.[otherLang]?.toggle_language || (otherLang === 'cs' ? 'Česky' : 'English');
            const ariaKeyForToggleAction = `aria_label_toggle_language`;
            languageToggleButton.setAttribute('aria-label', uiTextData[theme]?.[otherLang]?.[ariaKeyForToggleAction] || `Switch to ${otherLang}`);
            languageToggleButton.title = languageToggleButton.getAttribute('aria-label');
        }
        if (newGameButton) {
            newGameButton.textContent = getUIText('button_new_game');
            newGameButton.title = getUIText('aria_label_new_game');
            newGameButton.setAttribute('aria-label', getUIText('aria_label_new_game'));
        }
         if (modelToggleButton) {
            modelToggleButton.title = getUIText('aria_label_toggle_model_generic');
            // Actual text content is handled by updateModelToggleButtonText
        }
        if(systemStatusIndicator) systemStatusIndicator.textContent = getUIText(systemStatusIndicator.dataset.langKey || 'system_status_online_short');
        if(gmSpecificActivityIndicator) gmSpecificActivityIndicator.textContent = getUIText(gmSpecificActivityIndicator.dataset.langKey || 'system_processing_short');


        // Update dynamically generated dashboard elements (titles, labels)
        // This should ideally run *after* generateConsolesForTheme has populated the DOM
        const themeConfig = THEME_DASHBOARD_CONFIGS[theme];
        if (themeConfig) {
            ['left_console', 'right_console'].forEach(consoleSideKey => {
                themeConfig[consoleSideKey].forEach(boxConfig => {
                    const boxTitleEl = document.querySelector(`#${boxConfig.id} .console-box-title`);
                    if (boxTitleEl) {
                        boxTitleEl.textContent = getUIText(boxConfig.title_key);
                    }
                    boxConfig.items.forEach(itemConfig => {
                        const itemLabelEl = document.querySelector(`#info-item-container-${itemConfig.id} .label`);
                        if (itemLabelEl) {
                            itemLabelEl.textContent = getUIText(itemConfig.label_key);
                        }
                    });
                });
            });
        }

        // Update placeholders for input fields
        if (playerCallsignInput) playerCallsignInput.placeholder = getUIText('placeholder_callsign_login');
        if (startGameButton) startGameButton.textContent = getUIText('button_access_systems');
        if (playerActionInput) playerActionInput.placeholder = getUIText('placeholder_command');
        if (sendActionButton) sendActionButton.textContent = getUIText('button_execute_command');


        initializeDashboardDefaultTexts(); // Refresh defaults with new language/theme
        updateModelToggleButtonText();
        // Narrative language prompt part is handled in getSystemPrompt
    }

    function toggleAppLanguage() {
        const newLang = currentAppLanguage === 'en' ? 'cs' : 'en';
        // currentNarrativeLanguage also changes with app language by default now
        currentNarrativeLanguage = newLang; 
        localStorage.setItem(NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY, newLang);
        
        setAppLanguageAndTheme(newLang, currentTheme);

        const systemMessageKey = newLang === 'en' ? "system_lang_set_en" : "system_lang_set_cs";
        addMessageToLog(getUIText(systemMessageKey), 'system');
        saveGameState(); // Save language preference within game state if it affects narrative
    }

    /**
     * Constructs the system prompt for the AI, incorporating theme and language.
     */
    const getSystemPrompt = (currentIdentifierForPrompt, promptTypeToUse) => {
        const narrativeLanguageInstruction = NARRATIVE_LANG_PROMPT_PARTS_BY_THEME[currentTheme]?.[currentNarrativeLanguage] ||
                                           NARRATIVE_LANG_PROMPT_PARTS_BY_THEME[DEFAULT_THEME]?.[DEFAULT_LANGUAGE];
        
        let basePromptText = gamePrompts[currentTheme]?.[promptTypeToUse] || gamePrompts[currentTheme]?.default;

        if (!basePromptText || basePromptText.startsWith("Error:")) {
            console.error(`Error: Prompt text for theme "${currentTheme}", type "${promptTypeToUse}" is invalid.`);
            // Fallback to a generic error narrative if prompts are broken
            return `{"narrative": "SYSTEM ERROR: Critical prompt data missing for ${currentTheme}/${promptTypeToUse}. Cannot proceed.", "dashboard_updates": {}, "suggested_actions": ["Check console log.", "Try changing theme."], "game_state_indicators": {"activity_status": "Error", "combat_engaged": false, "comms_channel_active": false}}`;
        }
        
        basePromptText = basePromptText.replace(/\$\{narrativeLanguageInstruction\}/g, narrativeLanguageInstruction);
        basePromptText = basePromptText.replace(/\$\{currentCallsignForPrompt\}/g, currentIdentifierForPrompt || getUIText('unknown')); // Use playerIdentifier
        basePromptText = basePromptText.replace(/\$\{currentNarrativeLanguage\.toUpperCase\(\)\}/g, currentNarrativeLanguage.toUpperCase());
        
        // Theme-specific helper injections (e.g., start ideas, entity names)
        if (promptTypeToUse === 'initial' && gamePrompts[currentTheme]) {
            if (gamePrompts[currentTheme].starts) {
                const allStartIdeas = gamePrompts[currentTheme].starts.split('\n').map(idea => idea.trim()).filter(idea => idea.length > 0);
                let selectedIdeas = [];
                if (allStartIdeas.length > 0) {
                    const shuffledIdeas = [...allStartIdeas].sort(() => 0.5 - Math.random());
                    selectedIdeas = shuffledIdeas.slice(0, 3); // Get 3 random ideas
                }
                basePromptText = basePromptText.replace(/\$\{startIdea1\}/g, selectedIdeas[0] || `Generic ${currentTheme} scenario 1`);
                basePromptText = basePromptText.replace(/\$\{startIdea2\}/g, selectedIdeas[1] || `Generic ${currentTheme} scenario 2`);
                basePromptText = basePromptText.replace(/\$\{startIdea3\}/g, selectedIdeas[2] || `Generic ${currentTheme} scenario 3`);
            }

            let entityNamesFileContent = null;
            const entityNamesKey = `entity_names_${currentNarrativeLanguage}`; // e.g., entity_names_en
            if (gamePrompts[currentTheme][entityNamesKey]) {
                entityNamesFileContent = gamePrompts[currentTheme][entityNamesKey];
            } else if (gamePrompts[currentTheme].entity_names_en) { // Fallback to English names for the theme
                entityNamesFileContent = gamePrompts[currentTheme].entity_names_en;
            }

            if (entityNamesFileContent) {
                const allEntityNameIdeas = entityNamesFileContent.split('\n').map(name => name.trim()).filter(name => name.length > 0);
                let selectedEntityNames = [];
                if (allEntityNameIdeas.length > 0) {
                    const shuffledNames = [...allEntityNameIdeas].sort(() => 0.5 - Math.random());
                    selectedEntityNames = shuffledNames.slice(0, 3);
                }
                // Generic placeholder names for initial prompt template
                basePromptText = basePromptText.replace(/\$\{suggestedName1\}/g, selectedEntityNames[0] || `DefaultNameAlpha`);
                basePromptText = basePromptText.replace(/\$\{suggestedName2\}/g, selectedEntityNames[1] || `DefaultNameBeta`);
                basePromptText = basePromptText.replace(/\$\{suggestedName3\}/g, selectedEntityNames[2] || `DefaultNameGamma`);
                 // For scifi, if placeholders are specific like suggestedShipName1
                basePromptText = basePromptText.replace(/\$\{suggestedShipName1\}/g, selectedEntityNames[0] || `DefaultShipAlpha`);
                basePromptText = basePromptText.replace(/\$\{suggestedShipName2\}/g, selectedEntityNames[1] || `DefaultShipBeta`);
                basePromptText = basePromptText.replace(/\$\{suggestedShipName3\}/g, selectedEntityNames[2] || `DefaultShipGamma`);
            } else {
                 basePromptText = basePromptText.replace(/\$\{suggestedName1\}/g, `InventedName1`);
                 basePromptText = basePromptText.replace(/\$\{suggestedName2\}/g, `InventedName2`);
                 basePromptText = basePromptText.replace(/\$\{suggestedName3\}/g, `InventedName3`);
                 basePromptText = basePromptText.replace(/\$\{suggestedShipName1\}/g, `InventedShip1`);
                 basePromptText = basePromptText.replace(/\$\{suggestedShipName2\}/g, `InventedShip2`);
                 basePromptText = basePromptText.replace(/\$\{suggestedShipName3\}/g, `InventedShip3`);
            }
        }
        // This specific placeholder seems to be only in scifi combat.txt for shield status.
        // It's quite specific, so might need adjustment if used broadly.
        basePromptText = basePromptText.replace(/\$\{currentNarrativeLanguage\.toUpperCase\(\) === 'EN' \? "'Online' or 'Offline'" : "'Připojeno' or 'Odpojeno'"\}/g, 
            currentNarrativeLanguage.toUpperCase() === 'EN' ? "'Online' or 'Offline'" : `'${getUIText('online')}' or '${getUIText('offline')}'`);


        return basePromptText;
    };


    function highlightElementUpdate(element) {
        if (!element) return;
        // Target the .info-item or .info-item-meter container for the background flash
        const targetContainer = element.closest('.info-item, .info-item-meter');
        if (targetContainer) {
            targetContainer.classList.add('value-updated');
            setTimeout(() => {
                targetContainer.classList.remove('value-updated');
            }, UPDATE_HIGHLIGHT_DURATION);
        } else if (element.classList.contains('value') || element.classList.contains('value-overlay')) {
            // Fallback if somehow the element itself is passed and not its container
            element.classList.add('value-updated-direct'); // Could use a different animation
             setTimeout(() => {
                element.classList.remove('value-updated-direct');
            }, UPDATE_HIGHLIGHT_DURATION);
        }
    }

    function addMessageToLog(text, sender) {
        if (!storyLog) return;
    
        // Skip initial "My name is..." message from log if it's the standard starting phrase
        if (sender === 'player' && 
            gameHistory.length > 0 && // Ensure history is not empty
            gameHistory[0].role === 'user' && // Check the first message in actual history
            text === gameHistory[0].parts[0].text && // Compare with the *actual first user message text*
            text.startsWith(`My identifier is`) && 
            text.includes(`ready to start the game in ${currentTheme} theme`)) {
            console.log("Skipping initial identifier message for story log:", text);
            return;
        }
    
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${sender}-message`);
    
        text = text.replace(/_([^_]+)_|\*([^*]+)\*/g, (match, p1, p2) => `<em>${p1 || p2}</em>`);
    
        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim() !== '');
        if (paragraphs.length === 0 && text.trim() !== '') {
            paragraphs.push(text.trim()); // Handle single line text without double newlines
        }
    
        paragraphs.forEach(paraText => {
            const p = document.createElement('p');
            p.innerHTML = paraText.replace(/\n/g, '<br>'); // Preserve single newlines within paragraphs as <br>
            messageDiv.appendChild(p);
        });
    
        storyLog.appendChild(messageDiv);
        if (storyLog.parentElement) { // Scroll viewport
            storyLog.parentElement.scrollTop = storyLog.parentElement.scrollHeight;
        }
    }

    function setGMActivity(isProcessing) {
        if (gmSpecificActivityIndicator) gmSpecificActivityIndicator.style.display = isProcessing ? 'inline-flex' : 'none';
        if (systemStatusIndicator) systemStatusIndicator.style.display = isProcessing ? 'none' : 'inline-flex';

        if (playerActionInput) playerActionInput.disabled = isProcessing;
        if (sendActionButton) sendActionButton.disabled = isProcessing;
        document.querySelectorAll('#suggested-actions-wrapper .ui-button').forEach(btn => btn.disabled = isProcessing);

        if (!isProcessing && actionInputSection && actionInputSection.style.display !== 'none' && playerActionInput) {
            playerActionInput.focus();
        }
    }

    /**
     * Sets the value and appearance of a meter.
     * @param {HTMLElement} barEl - The meter bar element.
     * @param {HTMLElement} textEl - The element to display text (percentage, status).
     * @param {string|number} newPercentageStr - The new percentage value (0-100).
     * @param {string} meterType - Type of meter (e.g., 'integrity', 'shields', 'health', 'mana').
     * @param {object} options - Additional options.
     * @param {boolean} [options.highlight=true] - Whether to highlight the update.
     * @param {string} [options.newStatusText] - Specific status text (for shields, mana etc.).
     * @param {string} [options.initialPlaceholder] - Placeholder text for initialization.
     */

    const setMeter = (barEl, textEl, newPercentageStr, meterType, options = {}) => {
        const { highlight = true, newStatusText, initialPlaceholder } = options;

        console.log(`setMeter called for: type=${meterType}, newPctStr=${newPercentageStr}, textEl=${textEl ? textEl.id : 'null'}, barEl=${barEl ? barEl.id : 'null'}`);

        if (!barEl) { // We absolutely need barEl for color
            // console.warn(`setMeter: barEl is null for meterType "${meterType}". Cannot set color.`);
            // Still try to set text if textEl exists
            if (textEl && newPercentageStr !== undefined && newPercentageStr !== null) {
                 // Simplified text setting if only textEl exists
                const naShortText = getUIText('not_available_short');
                const unknownText = getUIText('unknown');
                if (newPercentageStr === "---" || newPercentageStr === naShortText || newPercentageStr.toLowerCase() === unknownText.toLowerCase()) {
                    textEl.textContent = newPercentageStr;
                } else {
                    textEl.textContent = `${parseInt(newPercentageStr,10)}%`; // Basic fallback
                }
            }
            return;
        }
        // If only barEl exists and not textEl, we can still set width and color, but text logic will be skipped.

        let finalPct = -1; 

        // 1. Determine finalPct
        if (newPercentageStr !== undefined && newPercentageStr !== null) {
            let parsedPct = parseInt(newPercentageStr, 10);
            if (!isNaN(parsedPct)) {
                finalPct = Math.max(0, Math.min(100, parsedPct));
            } else {
                const naShortText = getUIText('not_available_short');
                const unknownText = getUIText('unknown');
                if (textEl && (newPercentageStr === "---" || newPercentageStr === naShortText || newPercentageStr.toLowerCase() === unknownText.toLowerCase())) {
                    if (textEl.textContent !== newPercentageStr) textEl.textContent = newPercentageStr;
                    if (barEl.style.width !== '0%') barEl.style.width = '0%';
                    const existingCls = Array.from(barEl.classList).filter(c => c.startsWith('meter-'));
                    existingCls.forEach(c => barEl.classList.remove(c));
                    console.log(`setMeter: Cleared bar for N/A - type=${meterType}, barId=${barEl.id}`);
                    return; 
                }
                finalPct = (meterType === 'shields' || meterType === 'enemy_shields' || meterType === 'mana') ? 0 : 100; 
            }
        } else { 
            if (textEl) {
                const pctMatch = textEl.textContent.match(/(\d+)%/);
                if (pctMatch) finalPct = parseInt(pctMatch[1], 10);
            }
            if (finalPct === -1) {
                const phMatch = initialPlaceholder ? initialPlaceholder.match(/(\d+)%/) : null;
                if (phMatch) finalPct = parseInt(phMatch[1], 10);
                else finalPct = (meterType === 'shields' || meterType === 'enemy_shields' || meterType === 'mana') ? 0 : 100;
            }
        }
        finalPct = Math.max(0, Math.min(100, finalPct));
        console.log(`setMeter: type=${meterType}, finalPct=${finalPct}`);

        // 2. Determine finalStatusTextPart
        let finalStatusTextPart = null; 
        if (meterType === 'shields' || meterType === 'enemy_shields') {
            if (newStatusText !== undefined && newStatusText !== null) {
                finalStatusTextPart = newStatusText;
            } else {
                let currentStatusFromDOM = null;
                if (textEl) {
                    const statusMatch = textEl.textContent.match(/^(.*?):\s*(\d+)%/);
                    if (statusMatch && statusMatch[1]) currentStatusFromDOM = statusMatch[1].trim();
                }
                finalStatusTextPart = currentStatusFromDOM || (finalPct > 0 ? getUIText('online') : getUIText('offline'));
            }
            if (finalPct === 0) finalStatusTextPart = getUIText('offline');
            else if (finalStatusTextPart && finalStatusTextPart.toLowerCase() === getUIText('offline').toLowerCase()) {
                finalStatusTextPart = getUIText('online');
            }
        } else if ((meterType === 'mana' || meterType === 'stamina') && newStatusText !== undefined && newStatusText !== null) {
            finalStatusTextPart = newStatusText;
        }
        console.log(`setMeter: type=${meterType}, finalStatusTextPart=${finalStatusTextPart}`);

        // 3. Determine Text Content for UI
        let newTextContent = '';
        if (meterType === 'shields' || meterType === 'enemy_shields') {
            newTextContent = `${finalStatusTextPart || getUIText('unknown')}: ${finalPct}%`;
        } else if ((meterType === 'mana' || meterType === 'stamina') && finalStatusTextPart && finalStatusTextPart.toLowerCase() !== getUIText('unknown').toLowerCase()) {
            newTextContent = `${finalStatusTextPart}: ${finalPct}%`;
        } else {
            newTextContent = `${finalPct}%`;
        }
        console.log(`setMeter: type=${meterType}, newTextContent='${newTextContent}'`);

        // 4. Determine Bar Color Class(es)
        let newBarColorClasses = []; 
        const isOfflineShield = (meterType === 'shields' || meterType === 'enemy_shields') && 
                                finalStatusTextPart && 
                                finalStatusTextPart.toLowerCase() === getUIText('offline').toLowerCase();

        if (isOfflineShield) {
            newBarColorClasses.push('meter-offline');
        } else {
            if (finalPct === 0 && !isOfflineShield) newBarColorClasses.push('meter-critical');
            else if (finalPct > 0 && finalPct <= 10) newBarColorClasses.push('meter-critical');
            else if (finalPct > 10 && finalPct <= 25) newBarColorClasses.push('meter-low');
            else if (finalPct > 25 && finalPct <= 50) newBarColorClasses.push('meter-medium');
            else { // finalPct > 50
                newBarColorClasses.push('meter-full'); 
                if (meterType === 'shields' || meterType === 'enemy_shields') newBarColorClasses.push('meter-ok-shield'); 
                else if (meterType === 'fuel') newBarColorClasses.push('meter-ok-fuel'); 
                else if (meterType === 'stamina') newBarColorClasses.push('meter-ok-stamina'); 
                else if (meterType === 'mana') newBarColorClasses.push('meter-ok-mana'); 
            }
        }
        console.log(`setMeter: type=${meterType}, finalPct=${finalPct}, Determined color classes: [${newBarColorClasses.join(', ')}] for barId=${barEl.id}`);
        
        // 5. Apply to DOM
        let textChanged = false;
        let barStyleChanged = false;

        if (textEl && textEl.textContent !== newTextContent) {
            textEl.textContent = newTextContent;
            textChanged = true;
        }

        if (barEl.style.width !== `${finalPct}%`) {
            barEl.style.width = `${finalPct}%`;
            barStyleChanged = true;
        }
        
        const existingColorClasses = Array.from(barEl.classList).filter(cls => cls.startsWith('meter-'));
        let classesAreDifferent = false;
        if (newBarColorClasses.length !== existingColorClasses.length) {
            classesAreDifferent = true;
        } else {
            const sortedNew = [...newBarColorClasses].sort();
            const sortedExisting = [...existingColorClasses].sort();
            for (let i = 0; i < sortedNew.length; i++) {
                if (sortedNew[i] !== sortedExisting[i]) {
                    classesAreDifferent = true;
                    break;
                }
            }
        }

        if (classesAreDifferent) {
            // Remove only the old *color-specific* meter classes, preserve 'meter-bar'
            existingColorClasses.forEach(cls => {
                if (cls !== 'meter-bar') { // Don't remove the base class
                    barEl.classList.remove(cls);
                }
            });
            
            // Ensure 'meter-bar' is present if it somehow got removed (shouldn't with the above)
            if (!barEl.classList.contains('meter-bar')) {
                barEl.classList.add('meter-bar');
            }

            // Add the new color classes
            newBarColorClasses.forEach(cls => {
                if (cls && cls.trim() !== '' && cls !== 'meter-bar') { // Don't re-add meter-bar if it's in this array
                    barEl.classList.add(cls);
                }
            });
            barStyleChanged = true;
            console.log(`setMeter: Applied classes. Final classList for barId=${barEl.id}: ${barEl.classList}`);
        } else {
            // Ensure 'meter-bar' is present even if color classes didn't change
            if (!barEl.classList.contains('meter-bar')) {
                barEl.classList.add('meter-bar');
                console.log(`setMeter: Ensured meter-bar class on barId=${barEl.id}. Final classList: ${barEl.classList}`);
            }
        }

        if (highlight && (textChanged || barStyleChanged)) {
            const container = textEl ? textEl.closest('.info-item, .info-item-meter') : barEl.closest('.info-item, .info-item-meter');
            if (container) highlightElementUpdate(container);
        }
    };

    /**
     * Updates the dashboard UI with data from the AI.
     * @param {object} updatesFromAI - Key-value pairs of dashboard items to update.
     * @param {boolean} [highlightChanges=true] - Whether to highlight updated elements.
     */
    function updateDashboard(updatesFromAI, highlightChanges = true) {
        if (!updatesFromAI || Object.keys(updatesFromAI).length === 0) return;

        const themeConfig = THEME_DASHBOARD_CONFIGS[currentTheme];
        if (!themeConfig) {
            console.error(`No dashboard config found for theme: ${currentTheme}`);
            return;
        }
        
        // Flatten item configs for easier lookup
        const allItems = [...themeConfig.left_console.flatMap(box => box.items), ...themeConfig.right_console.flatMap(box => box.items)];
        const itemConfigsMap = new Map(allItems.map(item => [item.id, item]));

        for (const key in updatesFromAI) {
            if (Object.prototype.hasOwnProperty.call(updatesFromAI, key)) {
                const value = updatesFromAI[key];
                const itemConfig = itemConfigsMap.get(key);

                if (!itemConfig) {
                    // console.warn(`No dashboard item configuration found for AI update key: '${key}' in theme '${currentTheme}'. Skipping update.`);
                    // Silently ignore if AI sends a key not in config - common for "only send changes"
                    if(key === 'callsign' && currentTheme === 'fantasy') { // Special handling if AI sends 'callsign' for fantasy
                        const charNameConfig = itemConfigsMap.get('character_name');
                        if (charNameConfig) {
                             const el = document.getElementById(`info-${charNameConfig.id}`);
                             if (el && el.textContent !== value) {
                                el.textContent = value;
                                if (highlightChanges) highlightElementUpdate(el);
                            }
                            playerIdentifier = value; // Also update playerIdentifier
                        }
                        continue;
                    }
                    continue;
                }
                
                // Update playerIdentifier if the key matches the theme's identifier field
                if (key === 'callsign' || key === 'character_name') {
                    playerIdentifier = value;
                }

                const valueElement = document.getElementById(`info-${key}`); // For text part of meter or simple text
                const meterBarElement = document.getElementById(`meter-${key}`); // The bar itself for meters

                if (itemConfig.type === 'meter') {
                    if (valueElement || meterBarElement) {
                        setMeter(meterBarElement, valueElement, String(value), itemConfig.meter_type, {
                            highlight: highlightChanges,
                            newStatusText: itemConfig.status_text_id ? updatesFromAI[itemConfig.status_text_id] : undefined
                        });
                    }
                } else if (itemConfig.type === 'status_text') {
                     if (valueElement) {
                        const newStatusText = String(value); // AI sends the display text directly
                        let statusClass = 'status-info'; // Default
                        const lowerVal = newStatusText.toLowerCase();

                        // This logic could be made more robust or config-driven
                        if (key === 'alertLevel') { // Sci-fi alert
                            if (lowerVal.includes('red')) statusClass = 'status-danger';
                            else if (lowerVal.includes('yellow')) statusClass = 'status-warning';
                            else if (lowerVal.includes('green')) statusClass = 'status-ok';
                        } else if (key === 'alert_level') { // Fantasy alert
                             if (lowerVal.includes(getUIText('alert_level_danger_val').toLowerCase())) statusClass = 'status-danger';
                             else if (lowerVal.includes(getUIText('alert_level_wary_val').toLowerCase())) statusClass = 'status-warning';
                             else if (lowerVal.includes(getUIText('alert_level_calm_val').toLowerCase())) statusClass = 'status-ok';
                        }
                        
                        if (valueElement.textContent !== newStatusText || !valueElement.className.includes(statusClass)) {
                            valueElement.textContent = newStatusText;
                            valueElement.className = `value ${statusClass}`; // Remove old status classes
                            if (highlightChanges) highlightElementUpdate(valueElement);
                        }
                    }
                } else { // text, number_text, text_long
                    if (valueElement) {
                        const suffix = itemConfig.suffix || '';
                        const newValueText = `${value}${suffix}`;
                        if (valueElement.textContent !== newValueText) {
                            valueElement.textContent = newValueText;
                            if (highlightChanges) highlightElementUpdate(valueElement);
                        }
                    }
                }
            }
        }
        lastKnownDashboardUpdates = {...lastKnownDashboardUpdates, ...updatesFromAI}; // Merge updates
    }


    function displaySuggestedActions(actions) {
        if (!suggestedActionsWrapper) return;
        suggestedActionsWrapper.innerHTML = '';
        if (actions && Array.isArray(actions) && actions.length > 0) {
            actions.slice(0, 3).forEach(actionText => {
                if (typeof actionText === 'string' && actionText.trim() !== '') {
                    const button = document.createElement('button');
                    button.classList.add('ui-button');
                    button.textContent = actionText; // AI provides this in narrative language
                    button.addEventListener('click', () => {
                        if (playerActionInput) {
                            playerActionInput.value = actionText;
                            playerActionInput.focus();
                            playerActionInput.dispatchEvent(new Event('input', { bubbles: true }));
                            autoGrowTextarea(playerActionInput); // Ensure textarea resizes
                        }
                    });
                    suggestedActionsWrapper.appendChild(button);
                }
            });
        }
    }

    function clearSuggestedActions() {
        if (suggestedActionsWrapper) suggestedActionsWrapper.innerHTML = '';
    }

    /**
     * Handles game state indicators, like showing/hiding conditional console boxes.
     * @param {object} indicators - The game_state_indicators object from AI.
     * @param {boolean} [isDuringInitialBoot=false] - True if called during initial game/theme load.
     */
    function handleGameStateIndicators(indicators, isDuringInitialBoot = false) {
        if (!indicators || !THEME_DASHBOARD_CONFIGS[currentTheme]) return;
        lastKnownGameStateIndicators = {...lastKnownGameStateIndicators, ...indicators}; // Merge

        const themeConsoles = [
            ...THEME_DASHBOARD_CONFIGS[currentTheme].left_console,
            ...THEME_DASHBOARD_CONFIGS[currentTheme].right_console
        ];

        themeConsoles.forEach(boxConfig => {
            if (boxConfig.type === 'hidden_until_active' && boxConfig.indicator_key) {
                const consoleBoxEl = document.getElementById(boxConfig.id);
                if (!consoleBoxEl) return;

                const shouldBeVisible = indicators[boxConfig.indicator_key] === true;
                const isCurrentlyVisible = consoleBoxEl.style.display !== 'none' && consoleBoxEl.style.opacity !== '0';

                if (shouldBeVisible && !isCurrentlyVisible) {
                    const delay = isDuringInitialBoot && boxConfig.boot_delay ? boxConfig.boot_delay : 0;
                    setTimeout(() => {
                        animateConsoleBox(boxConfig.id, true, true); // True for expand, true for make visible
                    }, delay);
                } else if (!shouldBeVisible && isCurrentlyVisible) {
                    animateConsoleBox(boxConfig.id, false, true); // False for collapse, true to also hide after animation
                }
            }
        });

        // Update currentPromptType based on combat_engaged
        if (indicators.combat_engaged === true && currentPromptType !== 'combat') {
            currentPromptType = 'combat';
            console.log("Combat prompt type activated.");
        } else if (indicators.combat_engaged === false && currentPromptType === 'combat') {
            currentPromptType = 'default'; // Revert to default after combat
            console.log("Default prompt type restored after combat.");
        }
        // Note: initial prompt type is handled by game flow (startGame, changeTheme)
    }


    async function callGeminiAPI(currentTurnHistory) {
        if (!GEMINI_API_KEY) {
            addMessageToLog(getUIText('system_error_no_api_key'), 'system'); // Add this key to uiTextData
            if (systemStatusIndicator) {
                systemStatusIndicator.textContent = getUIText('status_error');
                systemStatusIndicator.className = 'status-indicator status-danger';
            }
            setGMActivity(false);
            return null;
        }

        setGMActivity(true);
        clearSuggestedActions();

        // Determine active prompt type: 'initial' if first turn, otherwise currentPromptType
        const activePromptType = (isInitialGameLoad || (currentTurnHistory.length === 1 && gameHistory[0].role === 'user')) ? 'initial' : currentPromptType;
        const systemPromptText = getSystemPrompt(playerIdentifier, activePromptType);

        if (systemPromptText.startsWith('{"narrative": "SYSTEM ERROR:')) { // Check if getSystemPrompt returned an error JSON
            try {
                const errorResponse = JSON.parse(systemPromptText);
                addMessageToLog(errorResponse.narrative, 'system');
                if (errorResponse.suggested_actions) displaySuggestedActions(errorResponse.suggested_actions);
            } catch (e) {
                addMessageToLog("System prompt generation failed catastrophically.", 'system');
            }
            setGMActivity(false);
            return null;
        }
        

        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${currentModelName}:generateContent?key=${GEMINI_API_KEY}`;
        console.log(`Using AI Model: ${currentModelName} for theme: ${currentTheme}, prompt type: ${activePromptType}`);

        let generationConfig = {
            temperature: 0.7, // Adjust as needed
            topP: 0.95,       // Adjust as needed
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
        };
         if (currentModelName.includes("1.5-flash")) { // Gemini 1.5 Flash specific
            // No thinkingConfig for 1.5 flash as per current docs, it's for 1.5 Pro
        }


        let payload = {
            contents: currentTurnHistory,
            generationConfig: generationConfig,
            safetySettings: [ // Standard safety settings
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            ],
            systemInstruction: { parts: [{ text: systemPromptText }] }
        };

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const responseData = await response.json();

            if (!response.ok) {
                console.error("API Error Response:", responseData);
                let errDetail = responseData.error?.message || `API Error ${response.status}`;
                if (responseData.error?.details) errDetail += ` Details: ${JSON.stringify(responseData.error.details)}`;
                throw new Error(errDetail);
            }

            if (responseData.candidates && responseData.candidates[0]?.content?.parts?.[0]?.text) {
                let jsonStr = responseData.candidates[0].content.parts[0].text;
                try {
                    const parsed = JSON.parse(jsonStr);
                    if (typeof parsed.narrative !== 'string' ||
                        typeof parsed.dashboard_updates !== 'object' ||
                        !Array.isArray(parsed.suggested_actions) ||
                        typeof parsed.game_state_indicators !== 'object') {
                        console.error("Parsed JSON structure is invalid:", parsed);
                        throw new Error("Invalid JSON structure from AI. Missing core fields.");
                    }
                    
                    gameHistory.push({ role: "model", parts: [{ text: JSON.stringify(parsed) }] });
                    
                    updateDashboard(parsed.dashboard_updates); // Highlight changes by default
                    displaySuggestedActions(parsed.suggested_actions);
                    handleGameStateIndicators(parsed.game_state_indicators, isInitialGameLoad);

                    if (isInitialGameLoad) isInitialGameLoad = false;
                    saveGameState();

                    if (systemStatusIndicator) {
                        systemStatusIndicator.textContent = getUIText('system_status_online_short');
                        systemStatusIndicator.className = 'status-indicator status-ok';
                    }
                    return parsed.narrative;
                } catch (e) {
                    console.error("JSON Parsing Error:", e, "Received String:", jsonStr);
                    throw new Error(`Invalid JSON from AI: ${e.message}. Ensure AI response is valid JSON. String was: ${jsonStr.substring(0,500)}...`);
                }
            } else if (responseData.promptFeedback?.blockReason) {
                console.error("Content Blocked by API:", responseData.promptFeedback);
                const blockDetails = responseData.promptFeedback.safetyRatings?.map(r => `${r.category}: ${r.probability}`).join(', ') || "No specific details.";
                throw new Error(`Content blocked by API: ${responseData.promptFeedback.blockReason}. Ratings: ${blockDetails}`);
            } else {
                console.error("No valid candidate or text in API response:", responseData);
                throw new Error("No valid candidate or text part in AI response.");
            }
        } catch (error) {
            console.error('callGeminiAPI Error:', error);
            addMessageToLog(`SYSTEM ERROR: ${error.message}`, 'system');
            if (systemStatusIndicator) {
                systemStatusIndicator.textContent = getUIText('status_error');
                systemStatusIndicator.className = 'status-indicator status-danger';
            }
            return null;
        } finally {
            setGMActivity(false);
        }
    }

    /**
     * Starts a new game after player enters their identifier.
     */
    async function startGameAfterIdentifier() {
        const enteredIdentifier = playerCallsignInput ? playerCallsignInput.value.trim() : "";
        if (!enteredIdentifier) {
            alert(getUIText('placeholder_callsign_login')); // Generic, placeholder should be themed
            if (playerCallsignInput) playerCallsignInput.focus();
            return;
        }

        // `clearGameState()` should have been called by `changeTheme(..., true)` or `startNewGameSession`
        // We just set the identifier and proceed with the initial API call.
        playerIdentifier = enteredIdentifier;
        isInitialGameLoad = true; // Critical for initial prompt type selection
        currentPromptType = 'initial'; // Explicitly set for a new game start

        document.body.classList.remove('initial-state');
        if (nameInputSection) nameInputSection.style.display = 'none';
        if (actionInputSection) actionInputSection.style.display = 'flex';
        if (storyLogViewport) storyLogViewport.classList.add('spawn-animation'); // Animate viewport in

        if (playerActionInput) {
            playerActionInput.value = '';
            playerActionInput.dispatchEvent(new Event('input', { bubbles: true }));
            autoGrowTextarea(playerActionInput);
        }
        
        // Update dashboard with the new player identifier
        // This is a bit of a hack, ideally the initial prompt would return this.
        const idKey = currentTheme === 'scifi' ? 'callsign' : 'character_name';
        updateDashboard({ [idKey]: playerIdentifier }, false); 

        addMessageToLog(getUIText('connecting', { PLAYER_ID: playerIdentifier }), 'system');

        gameHistory = [{
            role: "user",
            // The AI's initial prompt expects this format for the first user message.
            parts: [{ text: `My identifier is ${playerIdentifier}. I am ready to start the game in ${currentTheme} theme.` }]
        }];
        clearSuggestedActions();

        const narrative = await callGeminiAPI(gameHistory);
        if (narrative) {
            addMessageToLog(narrative, 'gm');
            // Initial console box animations are handled by generateConsolesForTheme and handleGameStateIndicators
            // based on their config (boot_delay, initial_expanded)
        } else {
            // Handle API call failure during startup
            document.body.classList.add('initial-state');
            if (nameInputSection) nameInputSection.style.display = 'flex';
            if (actionInputSection) actionInputSection.style.display = 'none';
            if (storyLogViewport) storyLogViewport.classList.remove('spawn-animation');
            addMessageToLog("Failed to initialize session. Please check console and try again.", 'system');
        }
    }

    async function sendPlayerAction() {
        const action = playerActionInput ? playerActionInput.value.trim() : "";
        if (!action) {
            if (playerActionInput) playerActionInput.focus();
            return;
        }
        addMessageToLog(action, 'player');
        if (playerActionInput) {
            playerActionInput.value = '';
            playerActionInput.dispatchEvent(new Event('input', { bubbles: true }));
            autoGrowTextarea(playerActionInput);
        }
        clearSuggestedActions();

        gameHistory.push({ role: "user", parts: [{ text: action }] });
        const narrative = await callGeminiAPI(gameHistory);
        if (narrative) {
            addMessageToLog(narrative, 'gm');
        }
    }

    /**
     * Sets default text values for all dashboard items based on current theme's config.
     * Called after generating dashboard or changing language/theme.
     */
    function initializeDashboardDefaultTexts() {
        const themeConfig = THEME_DASHBOARD_CONFIGS[currentTheme];
        if (!themeConfig) return;

        ['left_console', 'right_console'].forEach(consoleSideKey => {
            themeConfig[consoleSideKey].forEach(boxConfig => {
                boxConfig.items.forEach(itemConfig => {
                    const valueElement = document.getElementById(`info-${itemConfig.id}`);
                    const meterBarElement = document.getElementById(`meter-${itemConfig.id}`);
                    const defaultValue = itemConfig.default_value !== undefined ? String(itemConfig.default_value) : getUIText(itemConfig.default_value_key);

                    if (itemConfig.type === 'meter') {
                        if (valueElement || meterBarElement) {
                             const defaultStatus = itemConfig.default_status_key ? getUIText(itemConfig.default_status_key) : getUIText('offline');
                            setMeter(meterBarElement, valueElement, defaultValue, itemConfig.meter_type, {
                                highlight: false,
                                newStatusText: defaultStatus,
                                initialPlaceholder: `${defaultStatus}: ${defaultValue}%` // For parsing if needed
                            });
                        }
                    } else if (itemConfig.type === 'status_text') {
                        if (valueElement) {
                            // For status_text, default_value_key gives the key for the display text
                            // And default_status_key might give the actual value for class setting
                            const displayDefault = getUIText(itemConfig.default_value_key);
                            const statusValDefault = itemConfig.default_status_key ? getUIText(itemConfig.default_status_key) : displayDefault;
                            valueElement.textContent = displayDefault;
                            
                            let statusClass = 'status-info'; // Default
                            const lowerVal = statusValDefault.toLowerCase();

                            if (itemConfig.id === 'alertLevel') { // Sci-fi
                                if (lowerVal.includes('red')) statusClass = 'status-danger';
                                else if (lowerVal.includes('yellow')) statusClass = 'status-warning';
                                else if (lowerVal.includes('green')) statusClass = 'status-ok';
                            } else if (itemConfig.id === 'alert_level') { // Fantasy
                                 if (lowerVal.includes(getUIText('alert_level_danger_val').toLowerCase())) statusClass = 'status-danger';
                                 else if (lowerVal.includes(getUIText('alert_level_wary_val').toLowerCase())) statusClass = 'status-warning';
                                 else if (lowerVal.includes(getUIText('alert_level_calm_val').toLowerCase())) statusClass = 'status-ok';
                            }
                            valueElement.className = `value ${statusClass}`;
                        }
                    } else { // text, number_text, text_long
                        if (valueElement) {
                            const suffix = itemConfig.suffix || '';
                            valueElement.textContent = `${defaultValue}${suffix}`;
                        }
                    }
                });
            });
        });
        // Special case for player identifier if a game is not loaded yet
        if (isInitialGameLoad || !playerIdentifier) {
            const idKey = currentTheme === 'scifi' ? 'callsign' : 'character_name';
            const idConfig = findItemConfigById(themeConfig, idKey);
            if (idConfig) {
                const el = document.getElementById(`info-${idConfig.id}`);
                if (el) el.textContent = getUIText(idConfig.default_value_key);
            }
        }
    }
    
    /** Helper to find item config by ID within a theme's dashboard config */
    function findItemConfigById(themeDashboardConfig, itemId) {
        if (!themeDashboardConfig) return null;
        for (const consoleSideKey of ['left_console', 'right_console']) {
            for (const boxConfig of themeDashboardConfig[consoleSideKey]) {
                const foundItem = boxConfig.items.find(item => item.id === itemId);
                if (foundItem) return foundItem;
            }
        }
        return null;
    }


    function autoGrowTextarea(textarea) {
        if (!textarea) return;
        textarea.style.height = 'auto'; // Temporarily shrink to get correct scrollHeight
        let newHeight = textarea.scrollHeight;
        const maxHeight = parseInt(window.getComputedStyle(textarea).maxHeight, 10) || Infinity;

        if (newHeight > maxHeight) {
            newHeight = maxHeight;
            textarea.style.overflowY = 'auto';
        } else {
            textarea.style.overflowY = 'hidden';
        }
        textarea.style.height = newHeight + 'px';
    }

    /**
     * Animates a console box (expand/collapse) and optionally manages its visibility.
     * @param {string} boxId - The ID of the console box.
     * @param {boolean} shouldExpand - True to expand, false to collapse.
     * @param {boolean} [manageVisibility=false] - If true, also handles display:none after collapse.
     */
    function animateConsoleBox(boxId, shouldExpand, manageVisibility = false) {
        const box = document.getElementById(boxId);
        if (!box) return;

        const header = box.querySelector('.console-box-header');
        const content = box.querySelector('.console-box-content');
        if (!header || !content) return;

        if (shouldExpand) {
            if (box.style.display === 'none') { // If hidden, make it block first
                 box.style.opacity = '0'; // Start transparent for fade-in
                 box.style.display = 'block';
            }
            // Delay adding class to allow display:block to take effect for transition
            requestAnimationFrame(() => {
                box.classList.add('is-expanded');
                box.style.opacity = '1'; // Fade in
                header.setAttribute('aria-expanded', 'true');
                content.setAttribute('aria-hidden', 'false');
            });
        } else { // Collapsing
            box.classList.remove('is-expanded');
            header.setAttribute('aria-expanded', 'false');
            content.setAttribute('aria-hidden', 'true');
            if (manageVisibility) {
                box.style.opacity = '0'; // Fade out
                // Listen for transition end on opacity or max-height to set display: none
                const hideAfterTransition = (event) => {
                    if (event.target === content || event.target === box) { // Check if transition is on content or box opacity
                        if (!box.classList.contains('is-expanded')) { // Ensure it's still meant to be hidden
                           box.style.display = 'none';
                        }
                        content.removeEventListener('transitionend', hideAfterTransition);
                        box.removeEventListener('transitionend', hideAfterTransition);
                    }
                };
                content.addEventListener('transitionend', hideAfterTransition);
                box.addEventListener('transitionend', hideAfterTransition); // For opacity transition on box
                // Fallback timeout in case transitionend doesn't fire (e.g. if no actual transition occurs)
                setTimeout(() => {
                    if (!box.classList.contains('is-expanded')) box.style.display = 'none';
                }, parseFloat(getComputedStyle(content).transitionDuration.replace('s',''))*1000 + 50); // Match content's transition duration
            }
        }
    }

    /**
     * Initializes collapsible behavior for dynamically created console boxes.
     * Also handles initial expansion, boot delays, and visibility for hidden_until_active.
     */
    function initializeCollapsibleConsoleBoxes() {
        const themeConfig = THEME_DASHBOARD_CONFIGS[currentTheme];
        if (!themeConfig) return;

        const allConsoleConfigs = [...themeConfig.left_console, ...themeConfig.right_console];

        allConsoleConfigs.forEach(boxConfig => {
            const box = document.getElementById(boxConfig.id);
            if (!box) return;

            const header = box.querySelector('.console-box-header');
            if (!header) return;

            if (boxConfig.type === 'collapsible' || boxConfig.type === 'hidden_until_active') {
                header.addEventListener('click', () => {
                    if (box.style.display !== 'none') { // Don't toggle if explicitly hidden
                        animateConsoleBox(boxConfig.id, !box.classList.contains('is-expanded'));
                    }
                });
                header.setAttribute('tabindex', '0'); // Make focusable
                header.addEventListener('keydown', (e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && box.style.display !== 'none') {
                        e.preventDefault();
                        animateConsoleBox(boxConfig.id, !box.classList.contains('is-expanded'));
                    }
                });
            }
            
            // Initial state based on config
            if (boxConfig.type === 'static') {
                animateConsoleBox(boxConfig.id, true, false); // Always expand, don't manage visibility beyond initial
                box.style.display = 'block';
                box.style.opacity = '1';
            } else if (boxConfig.type === 'hidden_until_active') {
                box.style.display = 'none'; // Initially hidden
                box.style.opacity = '0';
                animateConsoleBox(boxConfig.id, false); // Ensure it's collapsed internally
                // Visibility will be managed by handleGameStateIndicators
            } else { // 'collapsible'
                box.style.display = 'block'; // Default visible
                box.style.opacity = '1';
                const delay = boxConfig.boot_delay || 0;
                setTimeout(() => {
                    animateConsoleBox(boxConfig.id, boxConfig.initial_expanded || false);
                }, delay);
            }
        });
    }

    /**
     * Handles request to start a new game, confirming with the user.
     * Calls changeTheme with forceNewGame = true for the current theme.
     */
    function startNewGameSession() {
        const confirmKey = `confirm_new_game_theme_${currentTheme}`;
        const themeNameText = getUIText(`theme_name`);
        const confirmMsg = getUIText(confirmKey, { THEME_NAME: themeNameText }) || getUIText('confirm_new_game');
        
        if (confirm(confirmMsg)) {
            addMessageToLog(getUIText('system_new_game_initiated', { THEME_NAME: themeNameText }), 'system');
            changeTheme(currentTheme, true); // Force new game for the *current* theme
        }
    }

    /**
     * Generates console boxes and their items dynamically based on theme configuration.
     * @param {string} themeName - The name of the theme to generate consoles for.
     */
    function generateConsolesForTheme(themeName) {
        const config = THEME_DASHBOARD_CONFIGS[themeName];
        if (!config || !leftConsole || !rightConsole) {
            console.error(`Dashboard config for theme "${themeName}" not found or console containers missing.`);
            return;
        }

        leftConsole.innerHTML = '';
        rightConsole.innerHTML = '';

        const createConsoleSide = (side, consoleConfigs) => {
            consoleConfigs.forEach(boxConfig => {
                const consoleBox = document.createElement('div');
                consoleBox.id = boxConfig.id;
                consoleBox.classList.add('console-box');
                if (boxConfig.type === 'collapsible' || boxConfig.type === 'hidden_until_active') {
                    consoleBox.classList.add('collapsible');
                }
                // `hidden_until_active` styling/logic handled by initializeCollapsibleConsoleBoxes and handleGameStateIndicators

                const header = document.createElement('div');
                header.classList.add('console-box-header');
                const title = document.createElement('h3');
                title.classList.add('console-box-title');
                title.textContent = getUIText(boxConfig.title_key); // Initial text set here
                header.appendChild(title);
                consoleBox.appendChild(header);

                const content = document.createElement('div');
                content.classList.add('console-box-content');

                boxConfig.items.forEach(item => {
                    const itemContainer = document.createElement('div');
                    // Assign an ID to the container for easier label targeting later
                    itemContainer.id = `info-item-container-${item.id}`; 
                    itemContainer.classList.add(item.type === 'meter' ? 'info-item-meter' : 'info-item');
                    if (item.type === 'text_long' || item.id === 'objective' || item.id === 'current_quest' || item.id === 'location' || item.id === 'environment' || item.id === 'sensorConditions') {
                        itemContainer.classList.add('full-width'); // Example for wider items
                    }


                    const label = document.createElement('span');
                    label.classList.add('label');
                    label.textContent = getUIText(item.label_key); // Initial text
                    itemContainer.appendChild(label);

                    if (item.type === 'meter') {
                        const meterBarContainer = document.createElement('div');
                        meterBarContainer.classList.add('meter-bar-container');
                        const meterBar = document.createElement('div');
                        meterBar.id = `meter-${item.id}`; // For bar manipulation
                        meterBar.classList.add('meter-bar');
                        meterBarContainer.appendChild(meterBar);
                        itemContainer.appendChild(meterBarContainer);

                        const valueOverlay = document.createElement('span');
                        valueOverlay.id = `info-${item.id}`; // For text value of meter
                        valueOverlay.classList.add('value-overlay');
                        itemContainer.appendChild(valueOverlay);
                    } else { // text, number_text, text_long, status_text
                        const valueSpan = document.createElement('span');
                        valueSpan.id = `info-${item.id}`; // For direct value display
                        valueSpan.classList.add('value');
                        if (item.type === 'text_long') valueSpan.classList.add('objective-text'); // Or more generic 'long-text'
                        if (item.type === 'status_text') { /* Class added by updateDashboard/initializeDefaults */ }
                        itemContainer.appendChild(valueSpan);
                    }
                    content.appendChild(itemContainer);
                });
                consoleBox.appendChild(content);
                side.appendChild(consoleBox);
            });
        };

        createConsoleSide(leftConsole, config.left_console);
        createConsoleSide(rightConsole, config.right_console);

        initializeDashboardDefaultTexts(); // Populate with defaults for the new structure
        initializeCollapsibleConsoleBoxes(); // Setup interactions and initial states
    }
    
    /**
     * Updates the visual active state on theme selector buttons.
     */
    function updateThemeSelectorActiveState() {
        const buttons = themeSelectorElement.querySelectorAll('.theme-button');
        buttons.forEach(button => {
            if (button.dataset.theme === currentTheme) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }

    /**
     * Changes the current game theme.
     * @param {string} newTheme - The theme to switch to (e.g., 'scifi', 'fantasy').
     * @param {boolean} [forceNewGame=false] - If true, starts a new game in the newTheme, ignoring any saved state.
     */
    async function changeTheme(newTheme, forceNewGame = false) {
        if (currentTheme === newTheme && !forceNewGame) {
            console.log(`Theme "${newTheme}" is already active.`);
            // If forcing new game on current theme, proceed
            if(!forceNewGame) return;
        }

        console.log(`Changing theme to: ${newTheme}, Force new game: ${forceNewGame}`);
        const oldTheme = currentTheme;
        currentTheme = newTheme;
        localStorage.setItem(THEME_STORAGE_KEY, currentTheme);

        // Reset core game state variables before loading/generating new theme specifics
        clearGameStateInternal(); 
        if (forceNewGame) { // If forcing new game, also clear localStorage for the target theme
            localStorage.removeItem(GAME_STATE_STORAGE_KEY_PREFIX + newTheme);
        }


        // 1. Regenerate Dashboard UI for the new theme
        generateConsolesForTheme(currentTheme); // This also calls initializeDashboardDefaultTexts & initializeCollapsibleConsoleBoxes

        // 2. Load Prompts for the new theme
        const promptsLoaded = await loadAllPromptsForTheme(currentTheme);
        if (!promptsLoaded) {
            addMessageToLog(`Critical error: Failed to load prompts for theme "${currentTheme}". Game may not function correctly.`, 'system-error');
            // Potentially revert theme or disable game start
             if (startGameButton) startGameButton.disabled = true;
             return; // Stop theme change if prompts fail
        } else {
             if (startGameButton) startGameButton.disabled = false;
        }


        // 3. Apply Language and Theme specific UI texts and body class
        // currentAppLanguage is already set from localStorage or default
        setAppLanguageAndTheme(currentAppLanguage, currentTheme);

        // 4. Update Theme Selector UI
        updateThemeSelectorActiveState();

        // 5. Attempt to load game state for newTheme or prepare for new game
        if (!forceNewGame && loadGameState()) { // loadGameState now uses currentTheme
            // Game loaded successfully for the new theme
            isInitialGameLoad = false; // Mark that a game is loaded
            document.body.classList.remove('initial-state');
            if (nameInputSection) nameInputSection.style.display = 'none';
            if (actionInputSection) actionInputSection.style.display = 'flex';
            if (storyLogViewport) { // Ensure viewport is visible
                storyLogViewport.classList.remove('spawn-animation');
                storyLogViewport.style.opacity = 1;
                storyLogViewport.style.transform = 'none';
            }
            addMessageToLog(getUIText('system_session_resumed', { PLAYER_ID: playerIdentifier, THEME_NAME: getUIText('theme_name') }), 'system');
            if (playerActionInput) playerActionInput.focus();
            if (systemStatusIndicator) {
                systemStatusIndicator.textContent = getUIText('system_status_online_short');
                systemStatusIndicator.className = 'status-indicator status-ok';
            }
        } else {
            // No save found for newTheme, or forceNewGame was true
            isInitialGameLoad = true; // Mark that it's a new game setup
            currentPromptType = 'initial'; // Reset for new game
            document.body.classList.add('initial-state');
            if (nameInputSection) nameInputSection.style.display = 'flex';
            if (actionInputSection) actionInputSection.style.display = 'none';
            if (storyLogViewport) { // Reset viewport for potential spawn animation
                storyLogViewport.style.opacity = '0'; 
                storyLogViewport.classList.remove('spawn-animation');
            }
            if (playerCallsignInput) playerCallsignInput.focus();
            if (systemStatusIndicator) {
                systemStatusIndicator.textContent = getUIText('standby');
                systemStatusIndicator.className = 'status-indicator status-warning';
            }
             // Add system message about theme switch / new game start
            if (oldTheme !== newTheme) {
                 const themeSetKey = `system_theme_set_${newTheme}`;
                 addMessageToLog(getUIText(themeSetKey) || `System: Theme set to ${newTheme}.`, 'system');
            }
            if (forceNewGame) {
                 addMessageToLog(getUIText('system_new_game_initiated', { THEME_NAME: getUIText('theme_name')}), 'system');
            }
        }
        
        // Ensure player input placeholder is correct for the theme/state
        if (playerCallsignInput) playerCallsignInput.placeholder = getUIText('placeholder_callsign_login');
        if (startGameButton) startGameButton.textContent = getUIText('button_access_systems');

        console.log(`Theme changed to "${currentTheme}". Initial game load: ${isInitialGameLoad}`);
    }


    async function initializeApp() {
        // 1. Load preferences (theme, language, model)
        currentTheme = localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME;
        currentAppLanguage = localStorage.getItem(LANGUAGE_PREFERENCE_STORAGE_KEY) || DEFAULT_LANGUAGE;
        currentNarrativeLanguage = localStorage.getItem(NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY) || currentAppLanguage;
        currentModelName = localStorage.getItem(MODEL_PREFERENCE_STORAGE_KEY) || FREE_MODEL_NAME;
        
        // 2. Initial UI setup (dashboard structure for current/default theme)
        // generateConsolesForTheme must be called before setAppLanguageAndTheme if setAppLang... updates dynamic parts
        generateConsolesForTheme(currentTheme);

        // 3. Set language and theme texts, body class
        setAppLanguageAndTheme(currentAppLanguage, currentTheme); // This also calls initializeDashboardDefaultTexts & updateModelToggleButtonText

        // 4. Update theme selector UI
        updateThemeSelectorActiveState();
        
        // 5. Setup API Key
        const apiKeyAvailable = setupApiKey();
        if (!apiKeyAvailable) {
            document.body.classList.add('initial-state'); // Ensure name input visible if API key fails
            if (nameInputSection) nameInputSection.style.display = 'flex';
            if (actionInputSection) actionInputSection.style.display = 'none';
            // initializeDashboardDefaultTexts is called by setAppLanguageAndTheme
            // initializeCollapsibleConsoleBoxes is called by generateConsolesForTheme
            return; // Stop if no API key
        }

        // 6. Load all prompts for the current theme
        const promptsLoaded = await loadAllPromptsForTheme(currentTheme);
        if (!promptsLoaded) {
            addMessageToLog(`CRITICAL: Essential game prompts for theme "${currentTheme}" failed to load. Cannot continue.`, 'system-error');
            if (startGameButton) startGameButton.disabled = true;
            if (playerCallsignInput) playerCallsignInput.disabled = true;
            // UI state for error
            document.body.classList.remove('initial-state'); // Show main UI but with error state
            if (nameInputSection) nameInputSection.style.display = 'none';
            if (actionInputSection) actionInputSection.style.display = 'none'; // Hide action input too
            return;
        }

        // 7. Try to load existing game state for the current theme
        const gameWasLoaded = loadGameState(); // This now uses currentTheme internally

        // 8. Finalize UI based on whether a game was loaded
        if (gameWasLoaded) {
            document.body.classList.remove('initial-state');
            if (nameInputSection) nameInputSection.style.display = 'none';
            if (actionInputSection) actionInputSection.style.display = 'flex';
            if (storyLogViewport) { // Make sure it's visible, no animation needed on resume
                storyLogViewport.classList.remove('spawn-animation');
                storyLogViewport.style.opacity = 1;
                storyLogViewport.style.transform = 'none';
            }
            addMessageToLog(getUIText('system_session_resumed', { PLAYER_ID: playerIdentifier, THEME_NAME: getUIText('theme_name') }), 'system');
            if (playerActionInput) playerActionInput.focus();
            if (systemStatusIndicator) {
                systemStatusIndicator.textContent = getUIText('system_status_online_short');
                systemStatusIndicator.className = 'status-indicator status-ok';
            }
        } else { // New game for this theme
            document.body.classList.add('initial-state');
            if (nameInputSection) nameInputSection.style.display = 'flex';
            if (actionInputSection) actionInputSection.style.display = 'none';
            // initializeDashboardDefaultTexts already called by setAppLanguageAndTheme
            if (playerCallsignInput) playerCallsignInput.focus();
            if (systemStatusIndicator) {
                systemStatusIndicator.textContent = getUIText('standby');
                systemStatusIndicator.className = 'status-indicator status-warning';
            }
        }
        
        // initializeCollapsibleConsoleBoxes is called by generateConsolesForTheme
        if (playerActionInput) autoGrowTextarea(playerActionInput);
        clearSuggestedActions();
        // updateModelToggleButtonText is called by setAppLanguageAndTheme
    }

    // Event Listeners
    if (languageToggleButton) languageToggleButton.addEventListener('click', toggleAppLanguage);
    if (newGameButton) newGameButton.addEventListener('click', startNewGameSession);
    if (modelToggleButton) modelToggleButton.addEventListener('click', toggleModelType);
    
    if (themeSelectorElement) {
        themeSelectorElement.addEventListener('click', (event) => {
            const button = event.target.closest('.theme-button');
            if (button && button.dataset.theme) {
                const newThemeSelected = button.dataset.theme;
                if (newThemeSelected !== currentTheme) {
                    changeTheme(newThemeSelected, false); // false = try to load save
                } else {
                    // If clicking active theme, maybe offer to start new game in it?
                    // For now, do nothing or log "Theme already active"
                    console.log(`Theme ${newThemeSelected} is already active.`);
                }
            }
        });
    }

    if (startGameButton) startGameButton.addEventListener('click', startGameAfterIdentifier);
    if (playerCallsignInput) playerCallsignInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') startGameAfterIdentifier();
    });
    if (sendActionButton) sendActionButton.addEventListener('click', sendPlayerAction);
    if (playerActionInput) {
        playerActionInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendPlayerAction();
            }
        });
        playerActionInput.addEventListener('input', () => autoGrowTextarea(playerActionInput));
    }

    initializeApp();
});