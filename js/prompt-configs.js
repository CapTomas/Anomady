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