// Located in: theme-prompts.js
const DEFAULT_THEME_ID = 'scifi';
// Paths to prompt files, organized by theme and prompt type
const PROMPT_URLS_BY_THEME = {
    scifi: {
        // Master prompts - typically shared, but could be overridden per theme if structure differs
        master_initial: 'prompts/master/master_initial.txt',
        master_default: 'prompts/master/master_default.txt',

        // Trigger-specific prompts for scifi
        // combat_engaged: 'prompts/scifi/combat_engaged.txt', 
        // comms_channel_active: 'prompts/master/comms_channel_active.txt', 
        // rare_loot_finded: 'prompts/scifi/rare_loot_finded.txt', 

        // Helper files for populating master prompts
        starts: 'prompts/scifi/helpers/starts.txt',
        asset_names_en: 'prompts/scifi/helpers/ship_names_en.txt',
        asset_names_cs: 'prompts/scifi/helpers/ship_names_cs.txt'
    },
    fantasy: {
        master_initial: 'prompts/master/master_initial.txt',
        master_default: 'prompts/master/master_default.txt',

        // Trigger-specific prompts for fantasy
        combat_engaged: 'prompts/fantasy/combat_engaged.txt', 
        magic_detected: 'prompts/fantasy/magic_detected.txt', 
        rare_loot_finded: 'prompts/fantasy/rare_loot_finded.txt', 

        // Helper files
        starts: 'prompts/fantasy/helpers/start_scenarios.txt',
        entity_names_en: 'prompts/fantasy/helpers/character_names_en.txt',
        entity_names_cs: 'prompts/fantasy/helpers/character_names_cs.txt'
    },
    cosmic_misrule: {
        master_initial: 'prompts/master/master_initial.txt',
        master_default: 'prompts/master/master_default.txt',

        audit_in_progress: 'prompts/cosmic_misrule/audit_in_progress.txt',
        paradox_event_imminent: 'prompts/cosmic_misrule/paradox_event_imminent.txt',

        // Helper files
        starts: 'prompts/cosmic_misrule/helpers/starts.txt'
    }
};

// Narrative Language Instructions for AI Prompts (ensure these align with theme characteristics)
const NARRATIVE_LANG_PROMPT_PARTS_BY_THEME = {
    scifi: {
        en: `This narrative must be written in fluent, immersive English, suitable for a high-quality sci-fi novel. Dialogue should be natural.`,
        cs: `Tento příběh musí být napsán plynulou, poutavou češtinou, vhodnou pro kvalitní sci-fi román. Dialogy by měly být přirozené.`
    },
    fantasy: {
        en: `This narrative must be written in fluent, immersive English, suitable for a high-quality fantasy novel. Dialogue should be appropriately styled for a fantasy setting (can range from archaic to modern depending on character/context).`,
        cs: `Tento příběh musí být napsán plynulou, poutavou češtinou, vhodnou pro kvalitní fantasy román. Dialogy by měly být vhodně stylizované pro fantasy prostředí (mohou sahat od archaických po moderní v závislosti na postavě/kontextu).`
    },
    cosmic_misrule: {
        en: `This narrative must be written in a highly satirical, absurdist, and bureaucratic tone, reflecting the chaotic nature of the Cosmic Misrule. Maintain a comedic and witty style. Emphasize nonsensical rules, jargon, and the general incompetence of cosmic entities.`,
        cs: `Tento příběh musí být napsán vysoce satirickým, absurdním a byrokratickým tónem, odrážejícím chaotickou povahu Kosmického zmatku. Udržujte komediální a vtipný styl. Zdůrazněte nesmyslná pravidla, žargon a obecnou nekompetentnost kosmických entit.`
    }
};