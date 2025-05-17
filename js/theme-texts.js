// --- UI Text Data (Localization) ---
const themeTextData = {
    scifi: {
        en: {
            "theme_name": "Sci-Fi",
            "theme_name_scifi": "Stellar Anomaly",
            "theme_lore_scifi": "In the year 2247, humanity has scattered across the stars. You are a captain on the fringes of known space, where strange signals and ancient mysteries await. Every jump could be your last, or your greatest discovery.",
            "theme_inspiration_scifi": "Classic space operas (Star Trek, The Expanse) & hard sci-fi novels.",
            "theme_tone_scifi": "Exploratory, mysterious, with moments of high tension and philosophical questions.",
            "theme_concept_scifi": "Humanity's relentless drive to explore confronting vast, ancient cosmic entities and moral ambiguities at the final frontier.",
            "theme_icon_alt_text_default_scifi": "Stellar Anomaly Scenario",
            
            // Sci-Fi Specific Dashboard Labels & Defaults
            "title_captain_status": "Captain's Log", "label_player_callsign": "Callsign:", "label_player_credits": "Credits:", "label_player_reputation": "Reputation:", "label_player_affiliation": "Affiliation:",
            "title_ship_status": "Ship Diagnostics", "label_ship_name": "Registry:", "label_ship_type": "Class:", "label_ship_integrity": "Integrity:", "label_ship_shields": "Shields:", "label_ship_fuel": "Fuel:", "label_ship_cargo": "Cargo:", "label_ship_speed": "Speed:",
            "title_comms_channel": "Comms Channel", "label_comms_status": "Channel:",
            "title_active_directive": "Directive", "label_directive_details": "Objective:", "label_directive_reward": "Reward:", "label_directive_status": "Status:", "label_alert_level": "Alert:",
            "title_navigation_data": "NavData", "label_current_location": "Location:", "label_system_faction": "Faction:", "label_environment": "Env.:", "label_sensor_conditions": "Sensors:", "label_stardate": "Stardate:",
            "title_enemy_intel": "Enemy Intel", "label_enemy_ship_type": "Target Type:", "label_enemy_shields": "Target Shields:", "label_enemy_hull": "Target Hull:",
            "cargo_empty_scu": "Empty / 0 SCU", "comms_inactive": "Inactive", "objective_none": "No active objective.", "status_idle": "Idle",
            "alert_level_green": "Condition Green", "alert_level_yellow": "Condition Yellow", "alert_level_red": "Condition Red", "alert_level_info": "Status Nominal",
            "alert_level_green_val": "Green", "alert_level_yellow_val": "Yellow", "alert_level_red_val": "Red", "alert_level_info_val": "Nominal",
            "confirm_new_game_theme_scifi": "Start new Sci-Fi adventure? Current Sci-Fi progress will be lost."
        },
        cs: { 
            "theme_name": "Sci-Fi",
            "theme_name_scifi": "Hvězdná Anomálie", 
            "theme_lore_scifi": "V roce 2247 se lidstvo rozprchlo mezi hvězdy. Jste kapitán na okraji známého vesmíru, kde čekají podivné signály a prastaré záhady. Každý skok může být váš poslední, nebo váš největší objev.",
            "theme_inspiration_scifi": "Klasické space opery (Star Trek, Expanze) a hard sci-fi romány.",
            "theme_tone_scifi": "Průzkumný, tajemný, s momenty vysokého napětí a filozofickými otázkami.",
            "theme_concept_scifi": "Nezastavitelná touha lidstva po objevování čelí obrovským, prastarým kosmickým entitám a morálním nejednoznačnostem na poslední hranici.",
            "theme_icon_alt_text_default_scifi": "Scénář Hvězdná Anomálie",

            "title_captain_status": "Kapitánský Záznam", "label_player_callsign": "Volací Znak:", "label_player_credits": "Kredity:", "label_player_reputation": "Reputace:", "label_player_affiliation": "Příslušnost:",
            "title_ship_status": "Diagnostika Lodi", "label_ship_name": "Registrace:", "label_ship_type": "Třída:", "label_ship_integrity": "Integrita:", "label_ship_shields": "Štíty:", "label_ship_fuel": "Palivo:", "label_ship_cargo": "Náklad:", "label_ship_speed": "Rychlost:",
            "title_comms_channel": "Kom. Kanál", "label_comms_status": "Kanál:",
            "title_active_directive": "Direktiva", "label_directive_details": "Úkol:", "label_directive_reward": "Odměna:", "label_directive_status": "Stav:", "label_alert_level": "Výstraha:",
            "title_navigation_data": "NavData", "label_current_location": "Pozice:", "label_system_faction": "Frakce:", "label_environment": "Prostředí:", "label_sensor_conditions": "Senzory:", "label_stardate": "Hvězdné datum:",
            "title_enemy_intel": "Nepřítel Info", "label_enemy_ship_type": "Typ Cíle:", "label_enemy_shields": "Štíty Cíle:", "label_enemy_hull": "Trup Cíle:",
            "cargo_empty_scu": "Prázdný / 0 SCU", "comms_inactive": "Neaktivní", "objective_none": "Žádný aktivní úkol.", "status_idle": "Nečinný",
            "alert_level_green": "Stav Zelený", "alert_level_yellow": "Stav Žlutý", "alert_level_red": "Stav Červený", "alert_level_info": "Stav Nominální",
            "alert_level_green_val": "Zelená", "alert_level_yellow_val": "Žlutá", "alert_level_red_val": "Červená", "alert_level_info_val": "Nominální",
            "confirm_new_game_theme_scifi": "Začít nové Sci-Fi dobrodružství? Aktuální Sci-Fi postup bude ztracen."
        }
    },
    fantasy: {
        en: { 
            "theme_name": "Fantasy",
            "theme_name_fantasy": "Whispers of Eldoria", 
            "theme_lore_fantasy": "The ancient kingdom of Eldoria is shrouded in mist and fading magic. Prophecies speak of a hero who will rise to challenge the encroaching darkness. Your journey begins in a humble village, unaware of the destiny that awaits.",
            "theme_inspiration_fantasy": "High fantasy epics (Lord of the Rings, The Witcher) and ancient mythologies.",
            "theme_tone_fantasy": "Heroic, perilous, with a sense of ancient mystery and moral choices.",
            "theme_concept_fantasy": "A reluctant hero's journey to fulfill a world-shaping prophecy against a backdrop of crumbling empires and resurgent dark powers.",
            "theme_icon_alt_text_default_fantasy": "Whispers of Eldoria Adventure",
            
            // Fantasy Specific Dashboard Labels & Defaults
            "title_character_overview": "Character", "label_character_name": "Name:", "label_character_class": "Class:", "label_character_level": "Level:", "label_gold": "Gold:",
            "title_character_vitals": "Vitals", "label_hp": "Health:", "label_mana": "Mana:", "label_stamina": "Stamina:", "label_equipped_weapon": "Weapon:", "label_equipped_armor": "Armor:",
            "title_quest_log": "Quest Log", "label_current_quest": "Current Quest:", "label_quest_reward": "Reward:", "label_quest_status": "Status:", "label_alert_level_fantasy": "Awareness:",
            "title_enemy_focus": "Enemy Focus", "label_enemy_name": "Enemy:", "label_enemy_hp": "Enemy Health:",
            "objective_none": "No active quest.", "status_idle": "Resting",
            "alert_level_calm": "Calm", "alert_level_wary": "Wary", "alert_level_danger": "Danger!", "alert_level_info": "Situation Normal",
            "alert_level_calm_val": "Calm", "alert_level_wary_val": "Wary", "alert_level_danger_val": "Danger", "alert_level_info_val": "Normal",
            "confirm_new_game_theme_fantasy": "Start new Fantasy adventure? Current Fantasy progress will be lost."
        },
        cs: { 
            "theme_name": "Fantasy",
            "theme_name_fantasy": "Šepoty Eldorie", 
            "theme_lore_fantasy": "Starobylé království Eldoria je zahaleno mlhou a slábnoucí magií. Proroctví hovoří o hrdinovi, který povstane, aby vyzval blížící se temnotu. Vaše cesta začíná v poklidné vesnici, aniž byste tušili osud, který na vás čeká.",
            "theme_inspiration_fantasy": "Epická high fantasy (Pán prstenů, Zaklínač) a starověké mytologie.",
            "theme_tone_fantasy": "Hrdinský, nebezpečný, s pocitem starodávného tajemství a morálních voleb.",
            "theme_concept_fantasy": "Cesta zdráhajícího se hrdiny k naplnění proroctví, které změní svět, na pozadí rozpadajících se říší a znovu ožívajících temných sil.",
            "theme_icon_alt_text_default_fantasy": "Dobrodružství Šepoty Eldorie",

            "title_character_overview": "Postava", "label_character_name": "Jméno:", "label_character_class": "Třída:", "label_character_level": "Úroveň:", "label_gold": "Zlaťáky:",
            "title_character_vitals": "Životní síly", "label_hp": "Zdraví:", "label_mana": "Mana:", "label_stamina": "Výdrž:", "label_equipped_weapon": "Zbraň:", "label_equipped_armor": "Zbroj:",
            "title_quest_log": "Deník Úkolů", "label_current_quest": "Aktuální Úkol:", "label_quest_reward": "Odměna:", "label_quest_status": "Stav:", "label_alert_level_fantasy": "Ostražitost:",
            "title_enemy_focus": "Zaměření na Nepřítele", "label_enemy_name": "Nepřítel:", "label_enemy_hp": "Zdraví Nepřítele:",
            "objective_none": "Žádný aktivní úkol.", "status_idle": "Odpočívám",
            "alert_level_calm": "Klid", "alert_level_wary": "Ostražitý", "alert_level_danger": "Nebezpečí!", "alert_level_info": "Situace Normální",
            "alert_level_calm_val": "Klid", "alert_level_wary_val": "Ostražitý", "alert_level_danger_val": "Nebezpečí", "alert_level_info_val": "Normální",
            "confirm_new_game_theme_fantasy": "Začít nové Fantasy dobrodružství? Aktuální Fantasy postup bude ztracen."
        }
    },
    cosmic_misrule: { 
        en: { 
            "theme_name": "Cosmic Misrule",
            "theme_name_cosmic_misrule": "Cosmic Misrule",
            "theme_lore_cosmic_misrule": "Reality is run by the most incompetent bureaucracy in the universe.\n\nLong ago, a memo titled “Form 00-A: Reality Exists” was accidentally approved by an infinite office orbiting a black hole made of unresolved paperwork. Since then, the universe has been held together by misfiled documents, contradictory policies, and obsolete cosmic protocols.\n\nStars burn due to outdated budget sheets. Gravity exists because of a typo. Death was privatized. Whole planets vanish because someone marked them “draft.”\n\nDeities, clerks, and sentient spreadsheets now fight over metaphysical zoning laws, while somewhere—on the Highest Floor—something keeps stamping approvals.\n\nNo one remembers why.",
            "theme_inspiration_cosmic_misrule": "Hitchhiker's Guide to the Galaxy × Discworld × Brazil (film)",
            "theme_tone_cosmic_misrule": "Absurdist cosmic satire, bureaucratic humor, existential dread (lightly seasoned).",
            "theme_concept_cosmic_misrule": "Navigate a universe governed by chaotic, often nonsensical, bureaucratic rules where filing the right (or wrong) form can alter reality itself.",
            "theme_icon_alt_text_default_cosmic_misrule": "Cosmic Misrule Scenario",
            "confirm_new_game_theme_cosmic_misrule": "Initiate Cosmic Misrule Protocol? Previous bureaucratic entanglements will be... archived."
            // Add cosmic_misrule specific dashboard labels and defaults if/when it has a unique dashboard
            // Example: "title_paperwork_status": "Bureaucratic Overview", "label_form_count": "Pending Forms:"
        },  
        cs: { 
            "theme_name": "Cosmic Misrule",
            "theme_name_cosmic_misrule": "Kosmický zmatek",
            "theme_lore_cosmic_misrule": "Realitu řídí ta nejneschopnější byrokracie ve vesmíru. Kdysi dávno byla směrnice s názvem „Formulář 00-A: Realita existuje“ omylem schválena nekonečnou kanceláří obíhající černou díru tvořenou nevyřízenými dokumenty. Od té doby drží vesmír pohromadě špatně zařazené dokumenty, protichůdné směrnice a zastaralé kosmické protokoly. Hvězdy hoří kvůli zastaralým rozpočtovým tabulkám. Gravitace existuje kvůli překlepu. Smrt byla zprivatizována. Celé planety mizí, protože je někdo označil jako „koncept“. Božstva, úředníci a vnímající tabulkové procesory se nyní přou o metafyzické územní zákony, zatímco někde – na Nejvyšším patře – něco neustále razítkuje schválení. Nikdo si nepamatuje proč.",
            "theme_inspiration_cosmic_misrule": "Stopařův průvodce Galaxií × Zeměplocha × Brazil (film)",
            "theme_tone_cosmic_misrule": "Absurdní kosmická satira, byrokratický humor, existenciální tíseň (lehce kořeněná).",
            "theme_concept_cosmic_misrule": "Proplouvejte vesmírem řízeným chaotickými, často nesmyslnými byrokratickými pravidly, kde podání správného (nebo špatného) formuláře může změnit samotnou realitu.",
            "theme_icon_alt_text_default_cosmic_misrule": "Scénář Kosmický zmatek",
            "confirm_new_game_theme_cosmic_misrule": "Zahájit Protokol Kosmického Zmatku? Předchozí byrokratické propletence budou... archivovány."
            // Přidejte specifické popisky a výchozí hodnoty pro panel cosmic_misrule, pokud/až bude mít unikátní panel
        }
    }
};
