// Paths to prompt files, organized by theme and prompt type
const PROMPT_URLS_BY_THEME = {
    scifi: {
        initial: 'prompts/scifi/initial.txt',
        default: 'prompts/scifi/default.txt',
        combat: 'prompts/scifi/combat.txt',
        starts: 'prompts/scifi/helpers/starts.txt',
        asset_names_en: 'prompts/scifi/helpers/ship_names_en.txt',
        asset_names_cs: 'prompts/scifi/helpers/ship_names_cs.txt'
    },
    fantasy: {
        initial: 'prompts/fantasy/initial.txt',
        default: 'prompts/fantasy/default.txt',
        combat: 'prompts/fantasy/combat.txt',
        starts: 'prompts/fantasy/helpers/start_scenarios.txt',
        entity_names_en: 'prompts/fantasy/helpers/character_names_en.txt',
        entity_names_cs: 'prompts/fantasy/helpers/character_names_cs.txt'
    },
    cosmic_misrule: { 
        initial: 'prompts/cosmic_misrule/initial.txt',
        default: 'prompts/cosmic_misrule/default.txt',
        starts: 'prompts/cosmic_misrule/helpers/starts.txt'
    }
};

// Narrative Language Instructions for AI Prompts
const NARRATIVE_LANG_PROMPT_PARTS_BY_THEME = {
    scifi: {
        en: `This narrative must be written in fluent, immersive English, suitable for a high-quality sci-fi novel. Dialogue should be natural.`,
        cs: `Tento příběh musí být napsán plynulou, poutavou češtinou, vhodnou pro kvalitní sci-fi román. Dialogy by měly být přirozené.`
    },
    fantasy: {
        en: `This narrative must be written in fluent, immersive English, suitable for a high-quality fantasy novel. Dialogue should be epic and archaic or modern as appropriate.`,
        cs: `Tento příběh musí být napsán plynulou, poutavou češtinou, vhodnou pro kvalitní fantasy román. Dialogy by měly být epické a archaické nebo moderní podle potřeby.`
    },
    cosmic_misrule: {
        en: `This narrative must be written in a highly satirical, absurdist, and bureaucratic tone, reflecting the chaotic nature of the Cosmic Misrule. Maintain a comedic and witty style.`,
        cs: `Tento příběh musí být napsán vysoce satirickým, absurdním a byrokratickým tónem, odrážejícím chaotickou povahu Kosmického zmatku. Udržujte komediální a vtipný styl.`
    }
};