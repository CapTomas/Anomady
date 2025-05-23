// Located in: theme-texts.js

// --- UI Text Data (Localization) ---
const themeTextData = {
  scifi: {
    en: {
      theme_name: "Sci-Fi",
      theme_name_short_scifi: "Stellar Anomaly",
      theme_name_long_scifi: "Stellar Anomaly: The Kepler Mystery",
      theme_name_scifi: "Stellar Anomaly",
      theme_category_scifi: "space opera",
      theme_style_scifi: "exploration and mystery",
      theme_lore_scifi:
        "In the year 2247, humanity has scattered across the stars. You are a captain on the fringes of known space, where strange signals and ancient mysteries await. Every jump could be your last, or your greatest discovery.",
      theme_inspiration_scifi:
        "Classic space operas (Star Trek, The Expanse) & hard sci-fi novels.",
      theme_tone_scifi:
        "Exploratory, mysterious, with moments of high tension and philosophical questions.",
      theme_concept_scifi:
        "Humanity's relentless drive to explore confronting vast, ancient cosmic entities and moral ambiguities at the final frontier.",
      theme_icon_alt_text_default_scifi: "Stellar Anomaly Scenario",
      theme_instructions_master_initial_scifi:
        "For this initial turn, create a highly engaging and active starting situation for the player. Avoid passive observation. Invent unique names for ships, locations, and non-player characters. Ensure all initial dashboard fields are populated with creative and contextually relevant information. For example, the player's ship could be named something like '{{HELPER_RANDOM_LINE:asset_names}}'.",
      theme_instructions_master_default_scifi:
        "For standard turns, remember that player quests are meaningful and should progress logically or be explicitly abandoned/failed. Quest rewards must be appropriate for the task. Game state variables must persist unless explicitly changed by the narrative. Ensure any changes to the dashboard are directly justified by the current turn's events.",
      // Example for a trigger-specific prompt, if you had one like 'combat_engaged.txt' and wanted specific instructions for it
      // "theme_instructions_combat_engaged_scifi": "When combat is engaged, describe the enemy vividly and provide clear tactical options or challenges. Update enemy intel on the dashboard.",

      title_captain_status: "Captain's Log",
      label_player_name: "Designation:",
      label_player_credits: "Credits:",
      label_player_reputation: "Reputation:",
      label_player_affiliation: "Affiliation:",
      title_ship_status: "Ship Diagnostics",
      label_ship_name: "Registry:",
      label_ship_type: "Class:",
      label_ship_integrity: "Integrity:",
      label_ship_shields: "Shields:",
      label_ship_fuel: "Fuel:",
      label_ship_cargo: "Cargo:",
      label_ship_speed: "Speed:",
      title_comms_channel: "Comms Channel",
      label_comms_status: "Channel:",
      label_comms_channel_active: "Comms Link:",
      title_active_directive: "Directive",
      label_directive_details: "Objective:",
      label_directive_reward: "Reward:",
      label_directive_status: "Status:",
      label_alert_level: "Alert:",
      title_navigation_data: "NavData",
      label_current_location: "Location:",
      label_system_faction: "Faction:",
      label_environment: "Env.:",
      label_sensor_conditions: "Sensors:",
      label_stardate: "Stardate:",
      title_enemy_intel: "Enemy Intel",
      label_enemy_ship_type: "Target Type:",
      label_enemy_shields: "Target Shields:",
      label_enemy_hull: "Target Hull:",
      cargo_empty_scu: "Empty / 0 SCU",
      comms_inactive: "Inactive / Offline",
      objective_none: "No active objective.",
      status_idle: "Idle",
      alert_level_green: "Condition Green",
      alert_level_yellow: "Condition Yellow",
      alert_level_red: "Condition Red",
      alert_level_info: "Status Nominal",
      alert_level_green_val: "Green",
      alert_level_yellow_val: "Yellow",
      alert_level_red_val: "Red",
      alert_level_info_val: "Nominal",
      confirm_new_game_theme_scifi:
        "Start new Stellar Anomaly adventure? Current progress will be lost.",
      label_combat_engaged: "Combat Status:",
      label_rare_loot_finded: "Loot Discovery:",
    },
    cs: {
      theme_name: "Sci-Fi",
      theme_name_scifi: "Hvězdná Anomálie",
      theme_category_scifi: "space opera",
      theme_style_scifi: "průzkum a tajemno",
      theme_lore_scifi:
        "V roce 2247 se lidstvo rozprchlo mezi hvězdy. Jste kapitán na okraji známého vesmíru, kde čekají podivné signály a prastaré záhady. Každý skok může být váš poslední, nebo váš největší objev.",
      theme_inspiration_scifi:
        "Klasické space opery (Star Trek, Expanze) a hard sci-fi romány.",
      theme_tone_scifi:
        "Průzkumný, tajemný, s momenty vysokého napětí a filozofickými otázkami.",
      theme_concept_scifi:
        "Nezastavitelná touha lidstva po objevování čelí obrovským, prastarým kosmickým entitám a morálním nejednoznačnostem na poslední hranici.",
      theme_icon_alt_text_default_scifi: "Scénář Hvězdná Anomálie",
      theme_instructions_master_initial_scifi:
        "Pro tento úvodní tah vytvořte pro hráče velmi poutavou a aktivní výchozí situaci. Vyhněte se pasivnímu pozorování. Vymyslete jedinečná jména pro lodě, lokace a nehráčské postavy. Zajistěte, aby všechna počáteční pole na informačním panelu byla vyplněna kreativními a kontextově relevantními informacemi.  Například hráčova loď by se mohla jmenovat třeba '{{HELPER_RANDOM_LINE:asset_names}}",
      theme_instructions_master_default_scifi:
        "Pro standardní tahy pamatujte, že hráčské úkoly jsou smysluplné a měly by logicky postupovat nebo být explicitně opuštěny/selhány. Odměny za úkoly musí odpovídat úkolu. Proměnné stavu hry musí přetrvávat, pokud nejsou explicitně změněny příběhem. Ujistěte se, že jakékoli změny na informačním panelu jsou přímo odůvodněny událostmi aktuálního tahu.",
      // "theme_instructions_combat_engaged_scifi": "Když dojde k boji, živě popište nepřítele a poskytněte jasné taktické možnosti nebo výzvy. Aktualizujte informace o nepříteli na informačním panelu.",

      title_captain_status: "Kapitánský Záznam",
      label_player_name: "Označení:",
      label_player_credits: "Kredity:",
      label_player_reputation: "Reputace:",
      label_player_affiliation: "Příslušnost:",
      title_ship_status: "Diagnostika Lodi",
      label_ship_name: "Registrace:",
      label_ship_type: "Třída:",
      label_ship_integrity: "Integrita:",
      label_ship_shields: "Štíty:",
      label_ship_fuel: "Palivo:",
      label_ship_cargo: "Náklad:",
      label_ship_speed: "Rychlost:",
      title_comms_channel: "Kom. Kanál",
      label_comms_status: "Kanál:",
      label_comms_channel_active: "Kom. Spojení:",
      title_active_directive: "Direktiva",
      label_directive_details: "Úkol:",
      label_directive_reward: "Odměna:",
      label_directive_status: "Stav:",
      label_alert_level: "Výstraha:",
      title_navigation_data: "NavData",
      label_current_location: "Pozice:",
      label_system_faction: "Frakce:",
      label_environment: "Prostředí:",
      label_sensor_conditions: "Senzory:",
      label_stardate: "Hvězdné datum:",
      title_enemy_intel: "Nepřítel Info",
      label_enemy_ship_type: "Typ Cíle:",
      label_enemy_shields: "Štíty Cíle:",
      label_enemy_hull: "Trup Cíle:",
      cargo_empty_scu: "Prázdný / 0 SCU",
      comms_inactive: "Neaktivní / Offline",
      objective_none: "Žádný aktivní úkol.",
      status_idle: "Nečinný",
      alert_level_green: "Stav Zelený",
      alert_level_yellow: "Stav Žlutý",
      alert_level_red: "Stav Červený",
      alert_level_info: "Stav Nominální",
      alert_level_green_val: "Zelená",
      alert_level_yellow_val: "Žlutá",
      alert_level_red_val: "Červená",
      alert_level_info_val: "Nominální",
      confirm_new_game_theme_scifi:
        "Začít nové dobrodružství Hvězdná Anomálie? Aktuální postup bude ztracen.",
      label_combat_engaged: "Bojový Stav:",
      label_rare_loot_finded: "Nález Kořisti:",
    },
  },
  grim_warden: {
    en: {
      theme_name_short_grim_warden: "Grim Wardens",
      theme_name_long_grim_warden: "Wardens of the Blighted Frontier",
      theme_name_grim_warden: "Grim Wardens", // General display name
      theme_category_grim_warden: "Dark Fantasy Monster Hunter",
      theme_style_grim_warden: "Grit & Desperation, Tactical Combat Encounters",
      theme_lore_grim_warden:
        "The land of Atheria is dying. A creeping corruption known as the Blight leeches life from the earth, twisting creatures into monstrous abominations and driving mortals to madness. What were once thriving kingdoms are now decaying baronies, huddled behind crumbling walls, their fields fallow and their forests haunted. The very air in blighted zones feels heavy, charged with an unseen malevolence that whispers insidious promises to the weak-willed.\n\nFor centuries, the Order of Wardens stood as humanity's shield against the encroaching darkness. These highly trained, alchemically augmented warriors dedicated their lives to studying the Blight, hunting its spawn, and protecting the innocent. But time and relentless attrition have taken their toll. The Order is a shadow of its former self, its fortresses isolated, its knowledge fragmented, and its numbers dwindling. Many now see the Wardens as relics of a bygone era, clinging to a hopeless cause.\n\nThe few remaining Wardens operate on the fringes, often mistrusted by the very people they protect. Internal strife within the Order, fueled by desperation and divergent philosophies on how to combat the Blight—some seeking forgotten lore, others advocating for more radical, dangerous methods—threatens to tear it apart. Meanwhile, opportunistic warlords and insidious cults rise in the power vacuum, eager to exploit the chaos. Whispers of the Blight's source, a long-forgotten cataclysm, and the possibility of a cure, however faint, drive some Wardens to undertake perilous quests into the heart of the corruption.",
      theme_inspiration_grim_warden:
        "The Witcher × Bloodborne",
      theme_tone_grim_warden: "Bleak, Ominous, Heroic, Macabre",
      theme_concept_grim_warden:
        "You are a Warden of the dwindling Order—scarred by alchemical trials, under-equipped, and viewed with suspicion by those you protect. Bound by ancient oaths and the grim necessity of your craft, you hunt the Blight's horrors from a crumbling frontier outpost. You've survived long enough to earn a grim reputation, but few offer thanks. Lately, the Blighted creatures behave erratically, and old, unsettling whispers about the Blight's nature are resurfacing.",
      theme_icon_alt_text_default_grim_warden: "Grim Wardens Scenario",
      theme_instructions_master_initial_grim_warden:
        "For this initial turn, establish a grim and perilous starting situation for the Warden. They should be on the frontier, perhaps at a dilapidated outpost or tracking a dangerous beast. Invent unique, thematic names for locations, NPCs, and any initial monstrous threats. Populate all dashboard fields with creative, contextually relevant information reflecting a dark fantasy, monster-hunting setting. Emphasize the bleakness and the Warden's resilience.",
      theme_instructions_master_default_grim_warden:
        "For standard turns, maintain the dark, gritty tone. Quests (Hunts) should be challenging and meaningful. Rewards should reflect the harsh world (e.g., scarce resources, vital information, temporary safety). Game state variables must persist. Any changes to the dashboard must be a direct result of the turn's narrative events. Describe Blighted creatures and environments vividly. Ensure the Warden's actions have consequences in this unforgiving world.",
      theme_instructions_combat_active_grim_warden: "Combat is joined! Describe the sudden ferocity of the enemy and the Warden's immediate tactical assessment. The monster should be a clear and present danger. Update the monster intel panel fully. Player suggestions should focus on survival and exploiting any perceived weakness.",
      theme_instructions_omen_detected_grim_warden: "An unsettling omen has occurred. Describe it with a sense of mystery and foreboding. What subtle or overt signs does the Warden perceive? Update the 'Omens & Whispers' panel. Player suggestions should focus on interpretation, investigation, or cautious preparation.",
      // Character Status Panel
      title_character_status_grim_warden: "Warden's Ledger",
      label_character_name_grim_warden: "Name/Title:",
      unknown_warden: "Unknown Warden",
      label_character_coin_grim_warden: "Coin:",
      pouch_light: "A few coppers",
      label_character_renown_grim_warden: "Renown:",
      unknown_figure: "Obscure Figure",
      label_character_oath_grim_warden: "Oath/Affiliation:",
      warden_initiate: "Order Initiate",

      // Vitality & Gear Panel
      title_vitality_gear_grim_warden: "Condition & Kit",
      label_character_health_grim_warden: "Health:",
      label_character_stamina_grim_warden: "Stamina:",
      label_elixir_charges_grim_warden: "Elixirs:",
      charges_none: "None",
      label_armor_condition_grim_warden: "Armor:",
      armor_worn: "Worn Leather",
      label_weapon_condition_grim_warden: "Weapon:",
      weapon_reliable: "Reliable Steel",
      label_current_burden_grim_warden: "Burden:",
      burden_unencumbered: "Unencumbered",

      // Omens & Whispers Panel
      title_omens_whispers_grim_warden: "Omens & Whispers",
      label_omen_details_grim_warden: "Signs:",
      omens_none_active: "The air is still.",

      // Current Hunt Panel
      title_current_hunt_grim_warden: "Current Hunt",
      label_current_quest_grim_warden: "Objective:",
      quest_none_active: "No active contract.",
      label_quest_reward_grim_warden: "Bounty:",
      reward_unknown: "To be determined",
      label_activity_status_grim_warden: "Activity:",
      status_vigilant: "Vigilant",
      label_threat_level_grim_warden: "Threat:",
      threat_level_calm: "Conditions Calm", // UI Display
      threat_level_wary: "Environment Wary", // UI Display
      threat_level_danger: "Imminent Danger", // UI Display
      threat_level_calm_val: "Calm", // AI Value (English)
      threat_level_wary_val: "Wary", // AI Value (English)
      threat_level_danger_val: "Danger", // AI Value (English)

      // Local Environment Panel
      title_local_environment_grim_warden: "Locale & Conditions",
      label_current_location_grim_warden: "Location:",
      location_unknown_wilds: "Unnamed Wilds",
      label_regional_control_grim_warden: "Dominion:",
      control_disputed_lands: "Disputed Territory",
      label_ambient_conditions_grim_warden: "Ambiance:",
      conditions_bleak: "Bleak and Overcast",
      label_blight_intensity_grim_warden: "Blight:",
      blight_faint_traces: "Faint Traces",
      label_moon_cycle_grim_warden: "Time/Moon:",
      moon_cycle_unknown: "Indeterminate",

      // Monster Intel Panel
      title_monster_intel_grim_warden: "Beastiary Intel",
      label_monster_type_grim_warden: "Target:",
      target_none_sighted: "None Sighted",
      label_monster_toughness_grim_warden: "Defense:",
      defense_breached: "Breached", // Default status for 0% monster defense
      defense_holding: "Holding", // Example status for >0% monster defense
      label_monster_vitality_grim_warden: "Vitality:",

      // Game State Indicators
      label_omen_detected_grim_warden: "Omen Active:",
      label_combat_active_grim_warden: "Combat Status:",
      label_rare_trophy_claimed_grim_warden: "Trophy Claimed:",

      // Confirmation
      confirm_new_game_theme_grim_warden:
        "Begin a new chronicle as a Grim Warden? All current progress in this saga will be lost.",
    },
    cs: {
      theme_name_short_grim_warden: "Ponurí strážci",
      theme_name_long_grim_warden: "Strážci zchátralé hranice",
      theme_name_grim_warden: "Ponurí strážci",
      theme_category_grim_warden: "Temná fantasy – Lovci nestvůr",
      theme_style_grim_warden: "Drsnost a zoufalství, taktická střetnutí",
      theme_lore_grim_warden: "Země Atherie umírá. Pomalá nákaza známá jako Zkáza vysává život z půdy, překrucuje tvory v nestvůrná znetvoření a dohání smrtelníky k šílenství. Co kdysi bývalo vzkvétajícími královstvími, jsou dnes tlející baronství, schoulená za rozpadajícími se zdmi, s brajglivými poli a  lesy plnými přízraků. Samotný vzduch v zamořených oblastech je těžký, nabitý neviditelnou zlovolností, která našeptává slabým duším zrádné sliby. \n\n Po celá staletí stál Řád Strážců jako štít lidstva proti blížící se temnotě. Vysoce vycvičení, alchymicky pozměnění válečníci zasvětili své životy studiu Zkázy, lovu jejích zplozenců a ochraně nevinných. Ale čas a neúnavné ztráty si vybraly svou daň. Řád je pouhým stínem své  někdejší slávy – jeho pevnosti osiřely, vědění se rozpadlo a řady řídnou. Mnozí dnes Strážce považují za přežitky minulosti, držící se beznadějné mise.\n\nZbylí Strážci operují na okraji civilizace, často nedůvěřovaní těmi, které chrání. Uvnitř samotného Řádu narůstají spory – zoufalství a rozkolné filozofie, jak se Zkáze postavit, hrozí roztrhnout řád zevnitř. Jedni hledají zapomenutá vědění, druzí volají po radikálních a  nebezpečných metodách. Mezitím v prázdném prostoru po padlých vládách povstávají váleční lordi a zákeřné kulty, připravené využít chaos. A šepoty o původu Zkázy – dávno zapomenuté pohromě – a možném léku, byť jen nepatrném, ženou některé Strážce na nebezpečné výpravy do srdce  zkázy.",
      theme_inspiration_grim_warden: "Zaklínač × Bloodborne",
      theme_tone_grim_warden: "Ponurý, zlověstný, hrdinský, makabrózní",
      theme_concept_grim_warden: "Jsi Strážce upadajícího Řádu – poznamenaný alchymickými pokusy, nedostatečně vybavený a podezříván těmi, které bráníš. Spoután prastarými přísahami a tvrdou nutností svého řemesla, lovíš hrůzy Zkázy z rozpadající se pohraniční tvrze. Přežil jsi dost dlouho na to, abys získal ponurou pověst, ale díků se ti nedostává. V poslední době se však zamořené bytosti chovají podivně a staré, neklidné šepoty o pravé podstatě Zkázy znovu vyplouvají na povrch.",
      theme_icon_alt_text_default_grim_warden: "Scénář Ponurých strážců",
      theme_instructions_master_initial_grim_warden: "V tomto úvodním tahu vytvoř temnou a nebezpečnou výchozí situaci pro Strážce. Vymysli jedinečné, tematické názvy pro lokace, postavy i první monstrózní hrozby. Vyplň všechny části rozhraní tvořivými, kontextově silnými prvky, které odrážejí temné fantasy prostředí plné lovu nestvůr. Důraz dej na bezútěšnost světa a odolnost Strážce.",
      theme_instructions_master_default_grim_warden: "Při běžných tazích udržuj temný, syrový tón. Úkoly (Lovy) by měly být výzvou a nést význam. Odměny by měly odrážet krutost světa – vzácné zdroje, klíčové informace, dočasné bezpečí. Herní proměnné musí zůstávat konzistentní. Jakékoli změny na rozhraní musí být přímým důsledkem  dění ve vyprávění. Popisuj zamořené tvory a prostředí barvitě a sugestivně. Činy Strážce musí mít následky v tomto nelítostném světě.",
      theme_instructions_combat_active_grim_warden: "Boj započal! Popiš náhlou zuřivost nepřítele a Strážcovo okamžité taktické vyhodnocení. Nestvůra musí představovat jasné a aktuální nebezpečí. Plně aktualizuj panel s informacemi o nestvůře. Návrhy pro hráče by se měly soustředit na přežití a využití jakékoli vnímané slabiny.",
      theme_instructions_omen_detected_grim_warden: "Došlo k znepokojivému znamení. Popište jej s pocitem tajemna a zlé předtuchy. Jaké jemné či zjevné znaky Strážce vnímá? Aktualizujte panel 'Znamení & Šepoty'. Návrhy pro hráče by se měly zaměřit na výklad, vyšetřování nebo opatrnou přípravu.",
      // Panel Stav Postavy
      title_character_status_grim_warden: "Strážcův Zápisník",
      label_character_name_grim_warden: "Jméno/Titul:",
      unknown_warden: "Neznámý Strážce",
      label_character_coin_grim_warden: "Mince:",
      pouch_light: "Pár měďáků",
      label_character_renown_grim_warden: "Pověst:",
      unknown_figure: "Nejasná Postava",
      label_character_oath_grim_warden: "Přísaha/Příslušnost:",
      warden_initiate: "Iniciát Řádu",

      // Panel Vitalita & Výbava
      title_vitality_gear_grim_warden: "Stav & Výstroj",
      label_character_health_grim_warden: "Zdraví:",
      label_character_stamina_grim_warden: "Výdrž:",
      label_elixir_charges_grim_warden: "Elixíry:",
      charges_none: "Žádné",
      label_armor_condition_grim_warden: "Zbroj:",
      armor_worn: "Opotřebená Kůže",
      label_weapon_condition_grim_warden: "Zbraň:",
      weapon_reliable: "Spolehlivá Ocel",
      label_current_burden_grim_warden: "Zátěž:",
      burden_unencumbered: "Nezatížen",

      // Panel Znamení & Šepoty
      title_omens_whispers_grim_warden: "Znamení & Šepoty",
      label_omen_details_grim_warden: "Znaky:",
      omens_none_active: "Vzduch je klidný.",

      // Panel Aktuální Lov
      title_current_hunt_grim_warden: "Současný Lov",
      label_current_quest_grim_warden: "Úkol:",
      quest_none_active: "Žádná aktivní zakázka.",
      label_quest_reward_grim_warden: "Odměna:",
      reward_unknown: "Bude určeno",
      label_activity_status_grim_warden: "Činnost:",
      status_vigilant: "Ostražitý",
      label_threat_level_grim_warden: "Hrozba:",
      threat_level_calm: "Okolnosti Klidné", // UI Zobrazení
      threat_level_wary: "Prostředí Nejisté", // UI Zobrazení
      threat_level_danger: "Bezprostřední Nebezpečí", // UI Zobrazení
      threat_level_calm_val: "Calm", // AI Hodnota (Anglicky) - interně se nemění
      threat_level_wary_val: "Wary", // AI Hodnota (Anglicky)
      threat_level_danger_val: "Danger", // AI Hodnota (Anglicky)

      // Panel Místní Prostředí
      title_local_environment_grim_warden: "Místo & Podmínky",
      label_current_location_grim_warden: "Poloha:",
      location_unknown_wilds: "Nepojmenované Divočiny",
      label_regional_control_grim_warden: "Nadvláda:",
      control_disputed_lands: "Sporné Území",
      label_ambient_conditions_grim_warden: "Atmosféra:",
      conditions_bleak: "Ponuro a Zataženo",
      label_blight_intensity_grim_warden: "Mor:",
      blight_faint_traces: "Slabé Stopy",
      label_moon_cycle_grim_warden: "Čas/Měsíc:",
      moon_cycle_unknown: "Neurčito",

      // Panel Informace o Nestvůře
      title_monster_intel_grim_warden: "Zvěd Bestiáře",
      label_monster_type_grim_warden: "Cíl:",
      target_none_sighted: "Žádný Spatřen",
      label_monster_toughness_grim_warden: "Obrana:",
      defense_breached: "Prolomena", // Výchozí stav pro 0% obrany nestvůry
      defense_holding: "Drží", // Příklad stavu pro >0% obrany nestvůry
      label_monster_vitality_grim_warden: "Vitalita:",

      // Indikátory Stavu Hry
      label_omen_detected_grim_warden: "Znamení Aktivní:",
      label_combat_active_grim_warden: "Bojový Stav:",
      label_rare_trophy_claimed_grim_warden: "Trofej Získána:",

      // Potvrzení
      confirm_new_game_theme_grim_warden:
        "Začít novou kroniku jako Ponurý Strážce? Veškerý dosavadní postup v této sáze bude ztracen.",
    },
  },
};
