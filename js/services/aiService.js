// js/services/aiService.js
/**
 * @file Constructs prompts for the AI and manages the interaction flow
 * for main game turns and specialized calls like "Mull Over Shard".
 */
import {
    getCurrentTheme,
    getCurrentNarrativeLanguage,
    getPlayerIdentifier,
    getGameHistory,
    addTurnToGameHistory,
    // setCurrentPromptType, // This is typically managed by gameController based on AI response
    setLastKnownDashboardUpdates,
    setLastKnownGameStateIndicators,
    setCurrentSuggestedActions,
    setCurrentAiPlaceholder,
    setCurrentTurnUnlockData,
    getLastKnownEvolvedWorldLore,
    getLastKnownCumulativePlayerSummary,
    getCurrentModelName,
    getPlayerLevel,
    getEffectiveMaxIntegrity,
    getEffectiveMaxWillpower,
    getEffectiveAptitude,
    getEffectiveResilience,
    getAcquiredTraitKeys,
    getCurrentStrainLevel,
    getActiveConditions,
    getIsInitialGameLoad,
    setIsInitialGameLoad,
    getCurrentPromptType,
    getCurrentUser, // To get the token
} from '../core/state.js';
import {
    getThemeConfig,
    getThemeNarrativeLangPromptPart,
    getLoadedPromptText,
    // getThemePromptUrl, // Not directly needed by aiService for prompt text if using getLoadedPromptText
} from './themeService.js';
import * as apiService from '../core/apiService.js';
import {
    DEFAULT_THEME_ID, // Used as a fallback for certain prompt parts
    RECENT_INTERACTION_WINDOW_SIZE,
} from '../core/config.js';
import { log, LOG_LEVEL_INFO, LOG_LEVEL_ERROR, LOG_LEVEL_WARN, LOG_LEVEL_DEBUG } from '../core/logger.js';
import { getUIText } from './localizationService.js';
// AI Interaction Constants
const DEFAULT_GENERATION_CONFIG = {
    temperature: 0.7,
    topP: 0.95,
    maxOutputTokens: 8192, // Default, can be overridden by theme if necessary
    responseMimeType: "application/json",
};
const DEFAULT_SAFETY_SETTINGS = [
    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
];
/**
 * Constructs the system prompt for the AI based on the current game state and active prompt type.
 * This function relies on prompt templates being pre-loaded by themeService.
 * @param {string} [worldShardsPayloadForInitial="[]"] - JSON string of active world shards, relevant for initial prompt.
 * @returns {string} The fully constructed system prompt string, or an error JSON string if critical components are missing.
 */
export function getSystemPrompt(worldShardsPayloadForInitial = "[]") {
    const currentThemeId = getCurrentTheme();
    const narrativeLang = getCurrentNarrativeLanguage();
    const playerID = getPlayerIdentifier();
    const activePromptType = getIsInitialGameLoad() ? "initial" : getCurrentPromptType();
    const themeConfig = getThemeConfig(currentThemeId);
    if (!currentThemeId || !themeConfig || !themeConfig.dashboard_config) {
        log(LOG_LEVEL_ERROR, "getSystemPrompt: Active theme, its configuration, or dashboard_config is missing.");
        return `{"narrative": "SYSTEM ERROR: Active theme configuration is missing for prompt generation.", "dashboard_updates": {}, "suggested_actions": [], "game_state_indicators": {}, "xp_awarded": 0}`;
    }
    const dashboardLayoutConfig = themeConfig.dashboard_config;
    const isValidPromptText = (text) => text !== null && text !== undefined && !text.startsWith("ERROR:") && !text.startsWith("HELPER_FILE_NOT_FOUND:");
    let basePromptKey;
    if (getIsInitialGameLoad()) {
        basePromptKey = "master_initial";
    } else {
        basePromptKey = getCurrentPromptType();
    }
    let basePromptText = getLoadedPromptText(currentThemeId, basePromptKey);
    // Fallback logic if a theme-specific prompt (like combat_active) doesn't exist
    if (!isValidPromptText(basePromptText)) {
        log(LOG_LEVEL_DEBUG, `Prompt ${currentThemeId}/${basePromptKey} not valid/found. Falling back to 'master_default'.`);
        basePromptKey = "master_default";
        basePromptText = getLoadedPromptText("master", basePromptKey);
    }
    if (!isValidPromptText(basePromptText)) {
        log(LOG_LEVEL_ERROR, `CRITICAL PROMPT FAILURE: No valid default prompt found for key "${basePromptKey}" for theme "${currentThemeId}" or master. Cannot generate system prompt.`);
        return `{"narrative": "SYSTEM ERROR: Core prompt file (type: ${activePromptType}, final key: ${basePromptKey}) is critically missing or invalid.", "dashboard_updates": {}, "suggested_actions": ["Restart Game"], "game_state_indicators": {}, "xp_awarded": 0}`;
    }
    let generatedDashboardDescription = "";
    const dashboardItems = [...(dashboardLayoutConfig.left_panel || []), ...(dashboardLayoutConfig.right_panel || [])].flatMap(p => p.items);
    dashboardItems.forEach(item => {
        let description = `// "${item.id}": "string (${item.short_description || "No description available."}`;
        if (item.must_translate) description += ` This value MUST be in ${narrativeLang.toUpperCase()}.`;
        else description += ` This value does NOT require translation from English.`;
        if (item.type === "meter" && item.status_text_id) description += ` Associated status text field is '${item.status_text_id}'.`;
        if (item.default_value_key) description += ` Default UI text key: '${item.default_value_key}'.`;
        else if (item.default_value !== undefined) description += ` Default value: '${item.default_value}'.`;
        description += `)",\n`;
        generatedDashboardDescription += description;
    });
    if (generatedDashboardDescription.endsWith(",\n")) {
        generatedDashboardDescription = generatedDashboardDescription.slice(0, -2);
    }
    let generatedGameStateIndicators = "";
    if (dashboardLayoutConfig.game_state_indicators && Array.isArray(dashboardLayoutConfig.game_state_indicators)) {
        dashboardLayoutConfig.game_state_indicators.forEach(indicator => {
            let description = `"${indicator.id}": "boolean (${indicator.short_description || "No description."}`;
            if (indicator.default_value !== undefined) description += ` Default value: ${indicator.default_value}.`;
            description += `)",\n`;
            generatedGameStateIndicators += description;
        });
         if (!generatedGameStateIndicators.includes('"activity_status"')) { // Ensure activity_status is always described
             const activityStatusDesc = "MUST reflect the ongoing primary activity described in the narrative, IN THE NARRATIVE LANGUAGE.";
             generatedGameStateIndicators += `"activity_status": "string (${activityStatusDesc})",\n`;
        }
        if (generatedGameStateIndicators.endsWith(",\n")) {
            generatedGameStateIndicators = generatedGameStateIndicators.slice(0, -2);
        }
    } else {
        generatedGameStateIndicators = `"activity_status": "string (Reflects ongoing activity, in ${narrativeLang.toUpperCase()})",\n` +
                                      `"combat_engaged": "boolean (True if combat starts THIS turn)"`;
    }
    const instructionKeyForThemeText = basePromptKey.startsWith("master_") ? basePromptKey : activePromptType;
    let themeSpecificInstructions = getUIText(`theme_instructions_${instructionKeyForThemeText}_${currentThemeId}`, {}, { explicitThemeContext: currentThemeId });
    if (themeSpecificInstructions === `theme_instructions_${instructionKeyForThemeText}_${currentThemeId}` || !themeSpecificInstructions.trim()) {
        themeSpecificInstructions = "No specific instructions provided for this context.";
    }
    const helperPlaceholderRegex = /{{HELPER_RANDOM_LINE:([a-zA-Z0-9_]+)}}/g;
    let match;
    while ((match = helperPlaceholderRegex.exec(themeSpecificInstructions)) !== null) {
        const fullPlaceholder = match[0];
        const helperKey = match[1];
        let replacementText = `(Dynamic value for ${helperKey} could not be resolved)`;
        const helperContentCurrentTheme = getLoadedPromptText(currentThemeId, helperKey);
        const helperContentMasterTheme = getLoadedPromptText("master", helperKey);
        let lines = null;
        if (helperContentCurrentTheme && isValidPromptText(helperContentCurrentTheme)) lines = helperContentCurrentTheme.split("\n").map(s => s.trim()).filter(s => s.length > 0);
        else if (helperContentMasterTheme && isValidPromptText(helperContentMasterTheme)) lines = helperContentMasterTheme.split("\n").map(s => s.trim()).filter(s => s.length > 0);
        if (lines && lines.length > 0) replacementText = lines[Math.floor(Math.random() * lines.length)];
        else log(LOG_LEVEL_WARN, `Helper file for key '${helperKey}' not found or empty. Placeholder: ${fullPlaceholder}`);
        themeSpecificInstructions = themeSpecificInstructions.replace(fullPlaceholder, replacementText);
        helperPlaceholderRegex.lastIndex = 0;
    }
    const narrativeLangInstruction = getThemeNarrativeLangPromptPart(currentThemeId, narrativeLang);
    let processedPromptText = basePromptText;
    const playerLevel = getPlayerLevel ? getPlayerLevel() : 1;
    const effMaxIntegrity = getEffectiveMaxIntegrity ? getEffectiveMaxIntegrity() : (themeConfig?.base_attributes?.integrity || 100);
    const effMaxWillpower = getEffectiveMaxWillpower ? getEffectiveMaxWillpower() : (themeConfig?.base_attributes?.willpower || 50);
    const effAptitude = getEffectiveAptitude ? getEffectiveAptitude() : (themeConfig?.base_attributes?.aptitude || 50);
    const effResilience = getEffectiveResilience ? getEffectiveResilience() : (themeConfig?.base_attributes?.resilience || 50);
    const acquiredTraits = getAcquiredTraitKeys ? getAcquiredTraitKeys() : [];
    const currentStrain = getCurrentStrainLevel ? getCurrentStrainLevel() : 1;
    const activeConditions = getActiveConditions ? getActiveConditions() : [];
    const replacements = {
        'narrativeLanguageInstruction': narrativeLangInstruction,
        'currentNameForPrompt': playerID || getUIText("unknown"),
        'currentNarrativeLanguage\\.toUpperCase\\(\\)': narrativeLang.toUpperCase(),
        'theme_name': getUIText(themeConfig.name_key, {}, { explicitThemeContext: currentThemeId }),
        'theme_lore': getUIText(themeConfig.lore_key, {}, { explicitThemeContext: currentThemeId }),
        'theme_category': getUIText(themeConfig.category_key || `theme_category_${currentThemeId}`, {}, { explicitThemeContext: currentThemeId }),
        'theme_style': getUIText(themeConfig.style_key || `theme_style_${currentThemeId}`, {}, { explicitThemeContext: currentThemeId }),
        'theme_tone': getUIText(themeConfig.tone_key, {}, { explicitThemeContext: currentThemeId }),
        'theme_inspiration': getUIText(themeConfig.inspiration_key, {}, { explicitThemeContext: currentThemeId }),
        'theme_concept': getUIText(themeConfig.concept_key, {}, { explicitThemeContext: currentThemeId }),
        'theme_specific_instructions': themeSpecificInstructions,
        'generated_dashboard_description': generatedDashboardDescription,
        'generated_game_state_indicators': generatedGameStateIndicators,
        'game_history_lore': getLastKnownEvolvedWorldLore() || getUIText(themeConfig.lore_key, {}, { explicitThemeContext: currentThemeId }),
        'game_history_summary': getLastKnownCumulativePlayerSummary() || "No major long-term events have been summarized yet.",
        'RIW': String(RECENT_INTERACTION_WINDOW_SIZE),
        'world_shards_json_payload': (basePromptKey === "master_initial" ? worldShardsPayloadForInitial : "[]"),
        // Player Progression Placeholders
        'playerLevel': String(playerLevel),
        'effectiveMaxIntegrity': String(effMaxIntegrity),
        'effectiveMaxWillpower': String(effMaxWillpower),
        'effectiveAptitude': String(effAptitude),
        'effectiveResilience': String(effResilience),
        'acquiredTraitsJSON': JSON.stringify(acquiredTraits),
        'currentStrainLevel': String(currentStrain),
        'activeConditionsJSON': JSON.stringify(activeConditions),
    };
    for (const key in replacements) {
        processedPromptText = processedPromptText.replace(new RegExp(`\\$\\{${key}\\}`, "g"), replacements[key]);
    }
    if (basePromptKey === "master_initial") {
        const startsContent = getLoadedPromptText(currentThemeId, "starts") || getLoadedPromptText("master", "starts");
        if (startsContent) {
            const allStarts = startsContent.split("\n").map(s => s.trim()).filter(s => s.length > 0);
            const selectedStarts = allStarts.length > 0 ? [...allStarts].sort(() => 0.5 - Math.random()).slice(0, 3) : [];
            ["startIdea1", "startIdea2", "startIdea3"].forEach((placeholder, i) => {
                processedPromptText = processedPromptText.replace(new RegExp(`\\$\\{${placeholder}\\}`, "g"), selectedStarts[i] || `Generic ${getUIText(themeConfig.name_key, {}, { explicitThemeContext: currentThemeId })} scenario ${i + 1}`);
            });
        }
    }
    return processedPromptText;
}

/**
 * Constructs the system prompt for a "lore deep dive" on a World Shard.
 * @param {object} shardData - The data of the shard: { title, content, key_suggestion, unlock_condition_description }.
 * @returns {string} The fully constructed system prompt string, or an error JSON string.
 */
export function getSystemPromptForDeepDive(shardData) {
    const currentThemeId = getCurrentTheme();
    const narrativeLang = getCurrentNarrativeLanguage();
    const themeConfig = getThemeConfig(currentThemeId);
    const basePromptText = getLoadedPromptText("master", "master_lore_deep_dive");
    if (!basePromptText || !themeConfig) {
        log(LOG_LEVEL_ERROR, `getSystemPromptForDeepDive: Missing 'master_lore_deep_dive.txt' or theme config for ${currentThemeId}.`);
        return `{"narrative": "SYSTEM ERROR: Deep dive prompt template missing."}`;
    }
    const narrativeLangInstruction = getThemeNarrativeLangPromptPart(currentThemeId, narrativeLang);
    let processedPrompt = basePromptText;
    let summarySnippet = "No recent relevant game events to summarize for this reflection.";
    const history = getGameHistory();
    if (history.length >= 2) { // Player action (Mull Over) -> GM Response (This is the deep dive itself)
                               // So we look at history before the player selected "Mull Over"
        const turnBeforeMullOverPlayerAction = history[history.length - 2];
        const turnBeforeThatGMResponse = history[history.length -3];
        let playerActionText = "N/A";
        let gmNarrativeText = "N/A";
        if (turnBeforeMullOverPlayerAction && turnBeforeMullOverPlayerAction.role === 'user' && turnBeforeMullOverPlayerAction.parts[0].text){
            playerActionText = turnBeforeMullOverPlayerAction.parts[0].text.substring(0, 100) + (turnBeforeMullOverPlayerAction.parts[0].text.length > 100 ? "..." : "");
        }
         if (turnBeforeThatGMResponse && turnBeforeThatGMResponse.role === 'model' && turnBeforeThatGMResponse.parts[0].text){
            try {
                const modelResp = JSON.parse(turnBeforeThatGMResponse.parts[0].text);
                gmNarrativeText = modelResp.narrative.substring(0, 150) + (modelResp.narrative.length > 150 ? "..." : "");
            } catch(e) { /* ignore */ }
        }
        summarySnippet = `Prior Player Action: ${playerActionText}\nPrevious GM Narrative: ${gmNarrativeText}`;
    }
    const replacements = {
        'theme_name': getUIText(themeConfig.name_key, {}, { explicitThemeContext: currentThemeId }),
        'currentNarrativeLanguage\\.toUpperCase\\(\\)': narrativeLang.toUpperCase(),
        'lore_fragment_title': shardData.title,
        'lore_fragment_content': shardData.content,
        'game_history_lore': getLastKnownEvolvedWorldLore() || getUIText(themeConfig.lore_key, {}, { explicitThemeContext: currentThemeId }),
        'game_history_summary_snippet': summarySnippet
    };
    for (const key in replacements) {
        processedPrompt = processedPrompt.replace(new RegExp(`\\$\\{${key}\\}`, "g"), replacements[key]);
    }
    return processedPrompt;
}
/**
 * Processes a player's turn: constructs the prompt, calls the AI, and updates state.
 * @param {string} playerActionText - The text of the player's action (already added to history by gameController).
 * @param {string} [worldShardsPayloadForInitial="[]"] - Optional JSON string of world shards for the initial turn.
 * @returns {Promise<string|null>} The narrative string from the AI, or null on failure.
 */
export async function processAiTurn(playerActionText, worldShardsPayloadForInitial = "[]") {
    log(LOG_LEVEL_INFO, `Processing AI turn for player action: "${playerActionText.substring(0, 50)}..."`);
    const fullHistory = getGameHistory();
    let historyForAI;
    if (getIsInitialGameLoad()) {
        historyForAI = [{
            role: 'user',
            parts: [{ text: playerActionText }]
        }];
        log(LOG_LEVEL_DEBUG, "Initial game load: constructing temporary history for AI from initial action text.");
    } else {
        historyForAI = fullHistory
            .filter(turn => turn.role === 'user' || turn.role === 'model')
            .map(turn => ({
                role: turn.role,
                parts: turn.parts.map(part => ({ text: part.text }))
            }))
            .slice(-RECENT_INTERACTION_WINDOW_SIZE);
    }
    const systemPromptText = getSystemPrompt(worldShardsPayloadForInitial);
    if (systemPromptText.startsWith('{"narrative": "SYSTEM ERROR:')) {
        try {
            const errorResponse = JSON.parse(systemPromptText);
            setCurrentAiPlaceholder(getUIText("placeholder_command")); // Reset placeholder
            // gameController will handle displaying the error and UI state (like GM activity)
            log(LOG_LEVEL_ERROR, "System prompt generation failed:", errorResponse.narrative);
        } catch (e) {
            log(LOG_LEVEL_ERROR, "Failed to parse system error JSON from getSystemPrompt in processAiTurn:", e, systemPromptText);
        }
        return null; // Signal critical error to gameController
    }
    const currentUser = getCurrentUser();
    const token = currentUser ? currentUser.token : null;
    const payload = {
        contents: historyForAI,
        generationConfig: DEFAULT_GENERATION_CONFIG,
        safetySettings: DEFAULT_SAFETY_SETTINGS,
        systemInstruction: { parts: [{ text: systemPromptText }] },
        modelName: getCurrentModelName(),
    };
    try {
        const responseData = await apiService.callGeminiProxy(payload, token); // Pass token
        if (responseData.candidates && responseData.candidates[0]?.content?.parts?.[0]?.text) {
            let jsonStringFromAI = responseData.candidates[0].content.parts[0].text;
            let parsedAIResponse;
            try {
                parsedAIResponse = JSON.parse(jsonStringFromAI);
            } catch (parseError) {
                log(LOG_LEVEL_WARN, "Initial JSON.parse failed for AI response. Attempting cleanup. Raw:", jsonStringFromAI.substring(0, 300));
                const markdownMatch = jsonStringFromAI.match(/```(?:json)?\s*([\s\S]*?)\s*```/s);
                if (markdownMatch && markdownMatch[1]) {
                    parsedAIResponse = JSON.parse(markdownMatch[1].trim());
                } else {
                    const firstBrace = jsonStringFromAI.indexOf("{");
                    const lastBrace = jsonStringFromAI.lastIndexOf("}");
                    if (firstBrace !== -1 && lastBrace > firstBrace) {
                        parsedAIResponse = JSON.parse(jsonStringFromAI.substring(firstBrace, lastBrace + 1));
                    } else {
                        throw parseError; // Re-throw original if no cleanup worked
                    }
                }
            }
            if (!parsedAIResponse || typeof parsedAIResponse.narrative !== "string" ||
                typeof parsedAIResponse.dashboard_updates !== "object" || parsedAIResponse.dashboard_updates === null ||
                !Array.isArray(parsedAIResponse.suggested_actions) ||
                (parsedAIResponse.xp_awarded !== undefined && typeof parsedAIResponse.xp_awarded !== 'number') // Added XP validation
                ) {
                log(LOG_LEVEL_ERROR, "Parsed JSON from AI is missing required core fields, has wrong types, or invalid xp_awarded.", parsedAIResponse);
                throw new Error("Invalid JSON structure from AI: missing/invalid core fields or xp_awarded.");
            }
            addTurnToGameHistory({ role: "model", parts: [{ text: JSON.stringify(parsedAIResponse) }] });
            setLastKnownDashboardUpdates(parsedAIResponse.dashboard_updates);
            setCurrentSuggestedActions(parsedAIResponse.suggested_actions);
            setLastKnownGameStateIndicators(parsedAIResponse.game_state_indicators || {});
            setCurrentAiPlaceholder(parsedAIResponse.input_placeholder || getUIText("placeholder_command"));
            if (parsedAIResponse.new_persistent_lore_unlock) {
                setCurrentTurnUnlockData(parsedAIResponse.new_persistent_lore_unlock);
            } else {
                setCurrentTurnUnlockData(null);
            }
            if (getIsInitialGameLoad()) {
                setIsInitialGameLoad(false);
            }
            // Store awarded XP to be processed by gameController
            if (parsedAIResponse.xp_awarded !== undefined) {
                // We'll store it temporarily in state or pass it back directly
                // For now, let's assume gameController will grab it from the parsed response.
                // If we need to store it in state: state.setCurrentTurnXPAwarded(parsedAIResponse.xp_awarded);
                log(LOG_LEVEL_DEBUG, `XP awarded by AI this turn: ${parsedAIResponse.xp_awarded}`);
            }
            // CurrentPromptType is determined by handleGameStateIndicators in gameController AFTER this resolves
            return parsedAIResponse; // Return the full parsed object
        } else if (responseData.promptFeedback?.blockReason) {
            const blockDetails = responseData.promptFeedback.safetyRatings?.map(r => `${r.category}: ${r.probability}`).join(", ") || "No details.";
            log(LOG_LEVEL_WARN, "Content blocked by AI:", responseData.promptFeedback.blockReason, "Details:", blockDetails);
            throw new Error(`Content blocked by AI: ${responseData.promptFeedback.blockReason}.`);
        } else {
            log(LOG_LEVEL_WARN, "Unexpected response structure from AI (no candidates or blockReason):", responseData);
            throw new Error("No valid candidate or text found in AI response.");
        }
    } catch (error) {
        log(LOG_LEVEL_ERROR, "processAiTurn failed:", error.message);
        setCurrentAiPlaceholder(getUIText("placeholder_command")); // Reset placeholder on error
        throw error; // Re-throw for gameController to handle UI error display
    }
}
/**
 * Handles the "Mull Over Shard" action by making a specialized AI call.
 * @param {object} shardData - The data of the World Shard to reflect upon.
 * @returns {Promise<string|null>} The narrative string from the AI, or null on failure.
 */
export async function handleMullOverShardAction(shardData) {
    if (!shardData || !shardData.title || !shardData.content) {
        log(LOG_LEVEL_ERROR, "handleMullOverShardAction: Invalid shardData provided.", shardData);
        return null;
    }
    log(LOG_LEVEL_INFO, "Handling Mull Over Shard action for:", shardData.title);
    const systemPromptText = getSystemPromptForDeepDive(shardData);
    if (systemPromptText.startsWith('{"narrative": "SYSTEM ERROR:')) {
        log(LOG_LEVEL_ERROR, `Failed to generate system prompt for deep dive: ${systemPromptText}`);
        return null; // Signal critical error
    }
    const currentUser = getCurrentUser();
    const token = currentUser ? currentUser.token : null;
    const payload = {
        contents: [], // Deep dive context is in the system prompt
        generationConfig: { ...DEFAULT_GENERATION_CONFIG, temperature: 0.65, maxOutputTokens: 1024 },
        safetySettings: DEFAULT_SAFETY_SETTINGS,
        systemInstruction: { parts: [{ text: systemPromptText }] },
        modelName: getCurrentModelName(),
    };
    try {
        const responseData = await apiService.callGeminiProxy(payload, token); // Pass token
        if (responseData.candidates && responseData.candidates[0]?.content?.parts?.[0]?.text) {
            let jsonStringFromAI = responseData.candidates[0].content.parts[0].text;
            let parsedResponse;
            try {
                parsedResponse = JSON.parse(jsonStringFromAI);
            } catch (parseError) {
                log(LOG_LEVEL_WARN, "Initial JSON.parse failed for Deep Dive. Attempting cleanup. Raw:", jsonStringFromAI.substring(0,200));
                const markdownMatch = jsonStringFromAI.match(/```(?:json)?\s*([\s\S]*?)\s*```/s);
                if (markdownMatch && markdownMatch[1]) {
                    parsedResponse = JSON.parse(markdownMatch[1].trim());
                } else { throw parseError; }
            }
            if (parsedResponse && parsedResponse.deep_dive_narrative && typeof parsedResponse.deep_dive_narrative === 'string') {
                addTurnToGameHistory({
                    role: "model", // Could be a special role like "deep_dive" if needed for history filtering
                    parts: [{ text: JSON.stringify({
                        narrative: parsedResponse.deep_dive_narrative,
                        isDeepDive: true,
                        relatedShardTitle: shardData.title
                    }) }]
                });
                // The gameController will be responsible for saving state after this.
                return parsedResponse.deep_dive_narrative;
            } else {
                throw new Error("Deep dive AI response missing 'deep_dive_narrative' field or invalid format.");
            }
        } else {
            throw new Error("No valid candidate or text found in Deep Dive AI response.");
        }
    } catch (error) {
        log(LOG_LEVEL_ERROR, "handleMullOverShardAction failed:", error.message);
        throw error; // Re-throw for gameController to handle
    }
}
