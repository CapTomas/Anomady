// Located in: theme-prompts.js

// Paths to prompt files, organized by theme and prompt type
const PROMPT_URLS_BY_THEME = {
  scifi: {
    // Master prompts - typically shared, but could be overridden per theme if structure differs
    master_initial: "prompts/master/master_initial.txt",
    master_default: "prompts/master/master_default.txt",

    // Trigger-specific prompts for scifi
    combat_engaged: "prompts/scifi/combat_engaged.txt",
    // comms_channel_active: 'prompts/master/comms_channel_active.txt',
    // rare_loot_finded: 'prompts/scifi/rare_loot_finded.txt',

    // Helper files for populating master prompts
    starts: "prompts/scifi/helpers/starts.txt",
    asset_names_en: "prompts/scifi/helpers/ship_names_en.txt",
    asset_names_cs: "prompts/scifi/helpers/ship_names_cs.txt",
  },
  grim_warden: {
    // Master prompts
    master_initial: "prompts/master/master_initial.txt",
    master_default: "prompts/master/master_default.txt",

    // Trigger-specific prompts for grim_warden
    combat_active: "prompts/grim_warden/combat_active.txt", // For when combat begins
    omen_detected: "prompts/grim_warden/omen_detected.txt", // For when a significant omen is revealed

    // Helper files for populating master prompts
    starts: "prompts/grim_warden/helpers/starts.txt", // Ideas for starting scenarios
  },
};

// Narrative Language Instructions for AI Prompts (ensure these align with theme characteristics)
const NARRATIVE_LANG_PROMPT_PARTS_BY_THEME = {
  scifi: {
    en: `This narrative must be written in fluent, immersive English, suitable for a high-quality sci-fi novel. Dialogue should be natural.`,
    cs: `Tento příběh musí být napsán plynulou, poutavou češtinou, vhodnou pro kvalitní sci-fi román. Dialogy by měly být přirozené.`,
  },
  grim_warden: {
    en: `This narrative must be written in rich, immersive English, evoking the style of a dark fantasy novel. Dialogue should feel authentic to hardened characters in a bleak, gritty world, potentially with slightly archaic or formal touches where appropriate for the setting. Emphasize visceral descriptions of combat, eerie environments, and the psychological toll of the Blight.`,
    cs: `Tento příběh musí být napsán bohatou, pohlcující češtinou, evokující styl temného fantasy románu. Dialogy by měly působit autenticky pro zocelené postavy v ponurém, drsném světě, případně s lehce archaickými či formálními prvky tam, kde to odpovídá prostředí. Zdůrazněte viscerální popisy soubojů, strašidelná prostředí a psychologickou daň Zkázy.`,
  },
};
