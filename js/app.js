document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration Constants & Global State ---
    let GEMINI_API_KEY = "";
    const DEFAULT_LANGUAGE = 'cs';
    const DEFAULT_THEME_ID = 'scifi'; // Used as a fallback
    const UPDATE_HIGHLIGHT_DURATION = 5000; // ms

    // Storage Keys
    const CURRENT_THEME_STORAGE_KEY = 'anomaliaCurrentTheme'; // Actively playing theme
    const GAME_STATE_STORAGE_KEY_PREFIX = 'anomaliaGameState_';
    const MODEL_PREFERENCE_STORAGE_KEY = 'anomaliaModelPreference';
    const LANGUAGE_PREFERENCE_STORAGE_KEY = 'preferredAppLanguage';
    const NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY = 'preferredNarrativeLanguage';
    const PLAYING_THEMES_STORAGE_KEY = 'anomaliaPlayingThemes'; // Themes user has chosen to play
    const LIKED_THEMES_STORAGE_KEY = 'anomaliaLikedThemes';   // Themes user has liked
    const LANDING_SELECTED_GRID_THEME_KEY = 'anomaliaLandingSelectedGridTheme';


    // AI Model Configuration
    const PAID_MODEL_NAME = "gemini-1.5-flash-latest";
    const FREE_MODEL_NAME = "gemini-1.5-flash-latest";
    let currentModelName = localStorage.getItem(MODEL_PREFERENCE_STORAGE_KEY) || FREE_MODEL_NAME;

    // Application State Variables
    let currentTheme = localStorage.getItem(CURRENT_THEME_STORAGE_KEY) || null; // null means no active game, show landing
    let currentAppLanguage = localStorage.getItem(LANGUAGE_PREFERENCE_STORAGE_KEY) || DEFAULT_LANGUAGE;
    let currentNarrativeLanguage = localStorage.getItem(NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY) || currentAppLanguage;
    let gamePrompts = {};
    let currentPromptType = 'initial';
    let gameHistory = [];
    let playerIdentifier = '';
    let isInitialGameLoad = true; // For a specific theme's game session
    let lastKnownDashboardUpdates = {};
    let lastKnownGameStateIndicators = {};

    let playingThemes = []; // Array of theme IDs
    let likedThemes = [];   // Array of theme IDs
    let currentLandingGridSelection = null; // Theme ID selected in the landing page grid

    // --- THEME DEFINITIONS (Should be in a separate file or theme-dashboard-configs.js) ---
    // This is a simplified structure. Icon paths, lore, details etc., need to be properly defined.
    // Keys like 'name_key', 'lore_key' point to uiTextData for localization.
    const ALL_THEMES_CONFIG = {
        scifi: {
            id: 'scifi',
            name_key: 'theme_name_scifi',
            icon: 'images/icon_scifi.svg',
            lore_key: 'theme_lore_scifi',
            setting_key: 'theme_setting_scifi',
            details_key: 'theme_details_scifi',
            dashboard_config_ref: 'scifi' // Points to key in THEME_DASHBOARD_CONFIGS
        },
        fantasy: {
            id: 'fantasy',
            name_key: 'theme_name_fantasy',
            icon: 'images/icon_fantasy.svg',
            lore_key: 'theme_lore_fantasy',
            setting_key: 'theme_setting_fantasy',
            details_key: 'theme_details_fantasy',
            dashboard_config_ref: 'fantasy' // Points to key in THEME_DASHBOARD_CONFIGS
        }
        // Add more themes here
    };
    // --- END THEME DEFINITIONS ---


    // Prompt File URLs by Theme (remains the same)
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
        }
    };
    // Fill in PROMPT_URLS_BY_THEME as in original file
    PROMPT_URLS_BY_THEME.scifi = {
        initial: 'prompts/scifi/initial.txt', default: 'prompts/scifi/default.txt', combat: 'prompts/scifi/combat.txt',
        starts: 'prompts/scifi/helpers/starts.txt', asset_names_en: 'prompts/scifi/helpers/ship_names_en.txt', asset_names_cs: 'prompts/scifi/helpers/ship_names_cs.txt'
    };
    PROMPT_URLS_BY_THEME.fantasy = {
        initial: 'prompts/fantasy/initial.txt', default: 'prompts/fantasy/default.txt', combat: 'prompts/fantasy/combat.txt',
        starts: 'prompts/fantasy/helpers/start_scenarios.txt', entity_names_en: 'prompts/fantasy/helpers/character_names_en.txt', entity_names_cs: 'prompts/fantasy/helpers/character_names_cs.txt'
    };


    // UI Element References
    const appRoot = document.getElementById('app-root');
    const applicationLogoElement = document.getElementById('application-logo');
    // const themeSelectorElement = document.getElementById('theme-selector'); // This is now a container
    const playingThemesContainer = document.getElementById('playing-themes-container');
    const likedThemesSeparator = document.getElementById('liked-themes-separator');
    const likedThemesContainer = document.getElementById('liked-themes-container');

    const systemStatusIndicator = document.getElementById('system-status-indicator');
    const gmSpecificActivityIndicator = document.getElementById('gm-activity-indicator');
    const languageToggleButton = document.getElementById('language-toggle-button');
    const newGameButton = document.getElementById('new-game-button'); // Behavior might change if on landing page
    const modelToggleButton = document.getElementById('model-toggle-button');

    const mainLayout = document.getElementById('main-layout');
    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('right-panel');
    const centerColumn = document.getElementById('center-column');

    // Landing Page Specific Elements
    const themeGridContainer = document.getElementById('theme-grid-container');
    const landingThemeDescriptionContainer = document.getElementById('landing-theme-description-container');
    const landingThemeLoreText = document.getElementById('landing-theme-lore-text');
    const landingThemeDetailsContainer = document.getElementById('landing-theme-details-container');
    const landingThemeInfoContent = document.getElementById('landing-theme-info-content'); // For setting, details
    const landingThemeActions = document.getElementById('landing-theme-actions'); // For choose/like buttons

    // Game View Specific Elements
    const storyLog = document.getElementById('story-log');
    const storyLogViewport = document.getElementById('story-log-viewport');
    const suggestedActionsWrapper = document.getElementById('suggested-actions-wrapper');
    const playerInputControlPanel = document.getElementById('player-input-control-panel');
    const nameInputSection = document.getElementById('name-input-section');
    const playerIdentifierInputEl = document.getElementById('player-identifier-input');
    const startGameButton = document.getElementById('start-game-button');
    const actionInputSection = document.getElementById('action-input-section');
    const playerActionInput = document.getElementById('player-action-input');
    const sendActionButton = document.getElementById('send-action-button');


    // --- Core Utility Functions ---
    function getUIText(key, replacements = {}) {
        // Use currentTheme if available for theme-specific UI text, otherwise default to a general context (e.g., DEFAULT_THEME_ID or a dedicated 'app' context)
        const themeForUI = currentTheme || DEFAULT_THEME_ID;
        let text = uiTextData[themeForUI]?.[currentAppLanguage]?.[key] ||
            uiTextData[themeForUI]?.en?.[key] ||
            uiTextData[DEFAULT_THEME_ID]?.[currentAppLanguage]?.[key] || // Fallback to default theme
            uiTextData[DEFAULT_THEME_ID]?.en?.[key] ||
            key; // Fallback to key itself
        for (const placeholder in replacements) {
            text = text.replace(new RegExp(`{${placeholder}}`, 'g'), replacements[placeholder]);
        }
        return text;
    }

    function setupApiKey() {
        GEMINI_API_KEY = localStorage.getItem('userGeminiApiKey');
        if (!GEMINI_API_KEY) {
            GEMINI_API_KEY = prompt(getUIText('prompt_enter_api_key', { "DEFAULT_VALUE": "" }), "");
            if (GEMINI_API_KEY && GEMINI_API_KEY.trim() !== "") {
                localStorage.setItem('userGeminiApiKey', GEMINI_API_KEY);
            } else {
                GEMINI_API_KEY = "";
                alert(getUIText('alert_api_key_required'));
            }
        }
        if (!GEMINI_API_KEY) {
            // No currentTheme context here for getUIText if on initial load before theme selection.
            // Fallback gracefully or use a default context.
            const errorMsg = uiTextData[DEFAULT_THEME_ID]?.[currentAppLanguage]?.error_critical_no_api_key || "CRITICAL: Gemini API Key not provided.";
            const statusErrorMsg = uiTextData[DEFAULT_THEME_ID]?.[currentAppLanguage]?.status_error || "Error";
            addMessageToLog(errorMsg, 'system'); // This might not be visible if story log is hidden
            console.error(errorMsg); // Ensure it's visible in console
            if (systemStatusIndicator) {
                systemStatusIndicator.textContent = statusErrorMsg;
                systemStatusIndicator.className = 'status-indicator status-danger';
            }
            [startGameButton, playerIdentifierInputEl, playerActionInput, sendActionButton].forEach(el => {
                if (el) el.disabled = true;
            });
            // Disable theme choosing if API key is missing
            if (themeGridContainer) themeGridContainer.style.pointerEvents = 'none';
            return false;
        }
        if (themeGridContainer) themeGridContainer.style.pointerEvents = 'auto';
        return true;
    }

    function saveGameState() { // Saves state for the *currentTheme*
        if (!playerIdentifier || !currentTheme) return;
        const gameStateKey = GAME_STATE_STORAGE_KEY_PREFIX + currentTheme;
        const gameState = {
            playerIdentifier: playerIdentifier, gameHistory: gameHistory,
            lastDashboardUpdates: lastKnownDashboardUpdates, lastGameStateIndicators: lastKnownGameStateIndicators,
            currentPromptType: currentPromptType, currentNarrativeLanguage: currentNarrativeLanguage,
        };
        try { localStorage.setItem(gameStateKey, JSON.stringify(gameState)); }
        catch (e) { addMessageToLog(getUIText('error_saving_progress'), 'system-error'); }
    }

    function loadGameState(themeIdToLoad) { // Loads state for a *specific theme*
        const gameStateKey = GAME_STATE_STORAGE_KEY_PREFIX + themeIdToLoad;
        try {
            const savedStateString = localStorage.getItem(gameStateKey);
            if (!savedStateString) return false;
            const savedState = JSON.parse(savedStateString);
            if (!savedState.playerIdentifier || !savedState.gameHistory || savedState.gameHistory.length === 0) {
                clearGameStateInternal(themeIdToLoad); return false;
            }
            playerIdentifier = savedState.playerIdentifier; gameHistory = savedState.gameHistory;
            lastKnownDashboardUpdates = savedState.lastDashboardUpdates || {};
            lastKnownGameStateIndicators = savedState.lastGameStateIndicators || {};
            currentPromptType = savedState.currentPromptType || 'default'; // 'initial' is for first ever start
            currentNarrativeLanguage = savedState.currentNarrativeLanguage || currentAppLanguage;

            if (storyLog) storyLog.innerHTML = '';
            gameHistory.forEach(turn => {
                if (turn.role === 'user') addMessageToLog(turn.parts[0].text, 'player');
                else if (turn.role === 'model') {
                    try { addMessageToLog(JSON.parse(turn.parts[0].text).narrative, 'gm'); }
                    catch (e) { addMessageToLog(getUIText('error_reconstruct_story'), 'system'); }
                }
            });
            updateDashboard(lastKnownDashboardUpdates, false);
            handleGameStateIndicators(lastKnownGameStateIndicators, false);

            const themeConfig = ALL_THEMES_CONFIG[themeIdToLoad];
            if (themeConfig) {
                const dashboardConfig = THEME_DASHBOARD_CONFIGS[themeConfig.dashboard_config_ref];
                const playerIdentifierConfigKey = themeIdToLoad === 'scifi' ? 'callsign' : 'character_name';
                const playerIdentifierConfig = findItemConfigById(dashboardConfig, playerIdentifierConfigKey);
                if (playerIdentifierConfig) {
                    const el = document.getElementById(`info-${playerIdentifierConfig.id}`);
                    if (el) el.textContent = playerIdentifier;
                }
            }
            isInitialGameLoad = false; return true;
        } catch (e) {
            console.error("Error loading game state for " + themeIdToLoad + ":", e);
            clearGameStateInternal(themeIdToLoad); localStorage.removeItem(gameStateKey); return false;
        }
    }

    function clearGameStateInternal(themeIdToClear) { // Clears state for *specific theme*
        if (themeIdToClear === currentTheme) { // Only reset global vars if clearing the active theme
            gameHistory = [];
            playerIdentifier = '';
            currentPromptType = 'initial'; // Reset to initial for the next game in this theme
            isInitialGameLoad = true;
            lastKnownDashboardUpdates = {};
            lastKnownGameStateIndicators = {};
            if (storyLog) storyLog.innerHTML = '';
            clearSuggestedActions();
        }
    }

    function clearGameState(themeIdToClear) { // Public function to clear a theme's game state
        localStorage.removeItem(GAME_STATE_STORAGE_KEY_PREFIX + themeIdToClear);
        clearGameStateInternal(themeIdToClear);
    }


    async function fetchPrompt(promptName, themeId) {
        const themePrompts = PROMPT_URLS_BY_THEME[themeId];
        if (!themePrompts || !themePrompts[promptName]) return `Error: Prompt "${promptName}" for theme "${themeId}" not found.`;
        try {
            const response = await fetch(themePrompts[promptName]);
            if (!response.ok) throw new Error(`Prompt ${themeId}/${promptName}: ${response.statusText}`);
            return await response.text();
        } catch (error) {
            addMessageToLog(getUIText('error_load_prompt_file', { THEME: themeId, PROMPT_NAME: promptName }), 'system');
            return `Error: Prompt "${themeId}/${promptName}" load failed. ${error.message}`;
        }
    }

    async function loadAllPromptsForTheme(themeId) {
        const themeConfig = ALL_THEMES_CONFIG[themeId];
        if (!themeConfig || !PROMPT_URLS_BY_THEME[themeId]) {
            addMessageToLog(getUIText('error_no_prompts_for_theme', { THEME: themeId }), 'system'); return false;
        }
        if (!gamePrompts[themeId]) gamePrompts[themeId] = {};
        const promptNames = Object.keys(PROMPT_URLS_BY_THEME[themeId]);
        const loadingPromises = promptNames.map(name => fetchPrompt(name, themeId).then(text => gamePrompts[themeId][name] = text));
        try {
            await Promise.all(loadingPromises);
            for (const name of promptNames) if (gamePrompts[themeId][name]?.startsWith("Error:")) throw new Error(`Load fail: ${themeId}/${name}`);
            return true;
        } catch (error) {
            console.error(`Error loading prompts for ${themeId}:`, error);
            if (systemStatusIndicator) { systemStatusIndicator.textContent = getUIText('status_error'); systemStatusIndicator.className = 'status-indicator status-danger'; }
            [startGameButton, playerIdentifierInputEl].forEach(el => { if (el) el.disabled = true; });
            return false;
        }
    }

    const getSystemPrompt = (currentPlayerIdentifierParam, promptTypeToUse) => {
        if (!currentTheme) return `{"narrative": "SYSTEM ERROR: No active theme for prompt generation.", "dashboard_updates": {}, "suggested_actions": [], "game_state_indicators": {}}`;

        const narrativeLangInstruction = NARRATIVE_LANG_PROMPT_PARTS_BY_THEME[currentTheme]?.[currentNarrativeLanguage] || NARRATIVE_LANG_PROMPT_PARTS_BY_THEME[DEFAULT_THEME_ID]?.[DEFAULT_LANGUAGE];
        let basePromptText = gamePrompts[currentTheme]?.[promptTypeToUse] || gamePrompts[currentTheme]?.default;
        if (!basePromptText || basePromptText.startsWith("Error:")) return `{"narrative": "SYSTEM ERROR: Prompt data missing for ${currentTheme}/${promptTypeToUse}.", "dashboard_updates": {}, "suggested_actions": ["Check panel.", "Change theme."], "game_state_indicators": {"activity_status": "Error", "combat_engaged": false, "comms_channel_active": false}}`;

        basePromptText = basePromptText.replace(/\$\{narrativeLanguageInstruction\}/g, narrativeLangInstruction);
        basePromptText = basePromptText.replace(/\$\{currentCallsignForPrompt\}/g, currentPlayerIdentifierParam || getUIText('unknown'));
        basePromptText = basePromptText.replace(/\$\{currentPlayerIdentifier\}/g, currentPlayerIdentifierParam || getUIText('unknown'));
        basePromptText = basePromptText.replace(/\$\{currentNarrativeLanguage\.toUpperCase\(\)\}/g, currentNarrativeLanguage.toUpperCase());

        if (promptTypeToUse === 'initial' && gamePrompts[currentTheme]) {
            if (gamePrompts[currentTheme].starts) {
                const allStarts = gamePrompts[currentTheme].starts.split('\n').map(s => s.trim()).filter(s => s.length > 0);
                const selStarts = allStarts.length > 0 ? [...allStarts].sort(() => 0.5 - Math.random()).slice(0, 3) : [];
                ['startIdea1', 'startIdea2', 'startIdea3'].forEach((ph, i) => basePromptText = basePromptText.replace(new RegExp(`\\$\\{${ph}\\}`, 'g'), selStarts[i] || `Generic ${currentTheme} scenario ${i + 1}`));
            }
            let assetNamesContent = null;
            const assetKey = currentTheme === 'scifi' ? `asset_names_${currentNarrativeLanguage}` : `entity_names_${currentNarrativeLanguage}`;
            const fallbackAssetKey = currentTheme === 'scifi' ? 'asset_names_en' : 'entity_names_en';
            if (gamePrompts[currentTheme][assetKey]) assetNamesContent = gamePrompts[currentTheme][assetKey];
            else if (gamePrompts[currentTheme][fallbackAssetKey]) assetNamesContent = gamePrompts[currentTheme][fallbackAssetKey];

            if (assetNamesContent) {
                const allAssets = assetNamesContent.split('\n').map(n => n.trim()).filter(n => n.length > 0);
                const selAssets = allAssets.length > 0 ? [...allAssets].sort(() => 0.5 - Math.random()).slice(0, 3) : [];
                ['suggestedName1', 'suggestedName2', 'suggestedName3', 'suggestedShipName1', 'suggestedShipName2', 'suggestedShipName3'].forEach((ph, iMod) => {
                    const i = iMod % 3; // Handle cases with more placeholders than assets
                    basePromptText = basePromptText.replace(new RegExp(`\\$\\{${ph}\\}`, 'g'), selAssets[i] || `Default${ph.includes('Ship') ? 'Asset' : ''}Name${i + 1}`);
                });
            } else {
                ['suggestedName1', 'suggestedName2', 'suggestedName3'].forEach((ph, i) => basePromptText = basePromptText.replace(new RegExp(`\\$\\{${ph}\\}`, 'g'), `InventedName${i + 1}`));
                ['suggestedShipName1', 'suggestedShipName2', 'suggestedShipName3'].forEach((ph, i) => basePromptText = basePromptText.replace(new RegExp(`\\$\\{${ph}\\}`, 'g'), `InventedAssetName${i + 1}`));
            }
        }
        basePromptText = basePromptText.replace(/\$\{currentNarrativeLanguage\.toUpperCase\(\) === 'EN' \? "'Online' or 'Offline'" : "'Připojeno' or 'Odpojeno'"\}/g, currentNarrativeLanguage.toUpperCase() === 'EN' ? "'Online' or 'Offline'" : `'${getUIText('online')}' or '${getUIText('offline')}'`);
        return basePromptText;
    };

    // --- UI Manipulation & State Display Functions ---
    function setGMActivity(isProcessing) {
        if (gmSpecificActivityIndicator) gmSpecificActivityIndicator.style.display = isProcessing ? 'inline-flex' : 'none';
        if (systemStatusIndicator) systemStatusIndicator.style.display = isProcessing ? 'none' : 'inline-flex';
        if (playerActionInput) playerActionInput.disabled = isProcessing;
        if (sendActionButton) sendActionButton.disabled = isProcessing;
        document.querySelectorAll('#suggested-actions-wrapper .ui-button').forEach(btn => btn.disabled = isProcessing);
        if (!isProcessing && actionInputSection?.style.display !== 'none' && playerActionInput && document.body.contains(playerActionInput)) {
            playerActionInput.focus();
        }
    }

    function highlightElementUpdate(element) {
        if (!element) return;
        const target = element.closest('.info-item, .info-item-meter');
        if (target) { target.classList.add('value-updated'); setTimeout(() => target.classList.remove('value-updated'), UPDATE_HIGHLIGHT_DURATION); }
    }

    function addMessageToLog(text, sender) {
        // if (!storyLog || storyLogViewport.style.display === 'none') { // OLD Condition
        if (!storyLog) { // NEW Condition: Only check if storyLog element itself exists
            console.log(`Message (${sender}): ${text} (storyLog element not found)`);
            return;
        }
        // The following check for "My identifier is..." is specific and can remain
        if (sender === 'player' && gameHistory.length > 0 && gameHistory[0].role === 'user' && text === gameHistory[0].parts[0].text && text.startsWith(`My identifier is`)) return;
        
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message', `${sender}-message`);
        
        // Sanitize/escape HTML-like content in 'text' before setting innerHTML if it's purely user/AI generated and not meant to be HTML.
        // For now, assuming existing behavior of allowing <em> is intentional.
        const processedText = text.replace(/_([^_]+)_|\*([^*]+)\*/g, (m, p1, p2) => `<em>${p1 || p2}</em>`);
        
        const paragraphs = processedText.split(/\n\s*\n/).filter(p => p.trim() !== '');
        if (paragraphs.length === 0 && processedText.trim() !== '') {
            paragraphs.push(processedText.trim());
        }
        
        paragraphs.forEach(para => {
            const p = document.createElement('p');
            // If para might contain HTML tags you want to render (like <br> from your current replace), use innerHTML.
            // If para is plain text and newlines should be <br>, do the replace here.
            p.innerHTML = para.replace(/\n/g, '<br>'); 
            msgDiv.appendChild(p);
        });
        
        storyLog.appendChild(msgDiv);
        
        // Scroll to bottom only if the viewport is actually visible and the user isn't trying to scroll manually
        if (storyLog.parentElement && storyLogViewport.style.display !== 'none') {
            // More advanced scroll check: only scroll if user is already near the bottom
            const isScrolledToBottom = storyLog.parentElement.scrollHeight - storyLog.parentElement.clientHeight <= storyLog.parentElement.scrollTop + 1;
            if(isScrolledToBottom || storyLog.children.length <= 2) { // Auto-scroll if at bottom or very few messages
                 storyLog.parentElement.scrollTop = storyLog.parentElement.scrollHeight;
            }
        }
    }

    function displaySuggestedActions(actions) {
        if (!suggestedActionsWrapper || suggestedActionsWrapper.style.display === 'none') return;
        suggestedActionsWrapper.innerHTML = '';
        if (actions && Array.isArray(actions) && actions.length > 0) {
            actions.slice(0, 3).forEach(actionTxt => {
                if (typeof actionTxt === 'string' && actionTxt.trim() !== '') {
                    const btn = document.createElement('button'); btn.classList.add('ui-button'); btn.textContent = actionTxt;
                    btn.addEventListener('click', () => {
                        if (playerActionInput) { playerActionInput.value = actionTxt; playerActionInput.focus(); playerActionInput.dispatchEvent(new Event('input', { bubbles: true })); autoGrowTextarea(playerActionInput); }
                    });
                    suggestedActionsWrapper.appendChild(btn);
                }
            });
        }
    }

    function clearSuggestedActions() { if (suggestedActionsWrapper) suggestedActionsWrapper.innerHTML = ''; }

    const setMeter = (barEl, textEl, newPctStr, meterType, opts = {}) => {
        const { highlight = true, newStatusText, initialPlaceholder } = opts;
        let updatedOccurred = false;

        if (!barEl) {
            if (textEl && newPctStr !== undefined && newPctStr !== null) {
                const na = getUIText('not_available_short'), unk = getUIText('unknown');
                const newContent = (newPctStr === "---" || newPctStr === na || String(newPctStr).toLowerCase() === unk.toLowerCase()) ? newPctStr : `${parseInt(newPctStr, 10)}%`;
                if (textEl.textContent !== newContent) {
                    textEl.textContent = newContent;
                    updatedOccurred = true;
                }
            }
            return updatedOccurred;
        }

        let finalPct = -1;
        if (newPctStr !== undefined && newPctStr !== null) {
            let pPct = parseInt(newPctStr, 10);
            if (!isNaN(pPct)) finalPct = Math.max(0, Math.min(100, pPct));
            else {
                const na = getUIText('not_available_short'), unk = getUIText('unknown');
                if (textEl && (newPctStr === "---" || newPctStr === na || String(newPctStr).toLowerCase() === unk.toLowerCase())) {
                    if (textEl.textContent !== newPctStr) { textEl.textContent = newPctStr; updatedOccurred = true; }
                    if (barEl.style.width !== '0%') { barEl.style.width = '0%'; updatedOccurred = true; }
                    const oldClasses = Array.from(barEl.classList).filter(c => c.startsWith('meter-'));
                    if (oldClasses.length > 0) updatedOccurred = true;
                    oldClasses.forEach(c => barEl.classList.remove(c));
                    return updatedOccurred;
                }
                finalPct = (meterType === 'shields' || meterType === 'enemy_shields' || meterType === 'mana') ? 0 : 100;
            }
        } else {
            if (textEl) { const m = textEl.textContent.match(/(\d+)%/); if (m) finalPct = parseInt(m[1], 10); }
            if (finalPct === -1) {
                const phM = initialPlaceholder ? initialPlaceholder.match(/(\d+)%/) : null;
                finalPct = phM ? parseInt(phM[1], 10) : ((meterType === 'shields' || meterType === 'enemy_shields' || meterType === 'mana') ? 0 : 100);
            }
        }
        finalPct = Math.max(0, Math.min(100, finalPct));

        let finalStatusTxt = null;
        if (meterType === 'shields' || meterType === 'enemy_shields') {
            if (newStatusText !== undefined && newStatusText !== null) finalStatusTxt = newStatusText;
            else {
                let curDomStat = null; if (textEl) { const m = textEl.textContent.match(/^(.*?):\s*(\d+)%/); if (m && m[1]) curDomStat = m[1].trim(); }
                finalStatusTxt = curDomStat || (finalPct > 0 ? getUIText('online') : getUIText('offline'));
            }
            if (finalPct === 0) finalStatusTxt = getUIText('offline');
            else if (finalStatusTxt && finalStatusTxt.toLowerCase() === getUIText('offline').toLowerCase()) finalStatusTxt = getUIText('online');
        } else if ((meterType === 'mana' || meterType === 'stamina') && newStatusText !== undefined && newStatusText !== null) finalStatusTxt = newStatusText;

        let newTxt = '';
        if (meterType === 'shields' || meterType === 'enemy_shields') newTxt = `${finalStatusTxt || getUIText('unknown')}: ${finalPct}%`;
        else if ((meterType === 'mana' || meterType === 'stamina') && finalStatusTxt && finalStatusTxt.toLowerCase() !== getUIText('unknown').toLowerCase()) newTxt = `${finalStatusTxt}: ${finalPct}%`;
        else newTxt = `${finalPct}%`;

        let newBarClasses = [];
        const isOffline = (meterType === 'shields' || meterType === 'enemy_shields') && finalStatusTxt && finalStatusTxt.toLowerCase() === getUIText('offline').toLowerCase();
        if (isOffline) newBarClasses.push('meter-offline');
        else {
            if (finalPct === 0 && !isOffline) newBarClasses.push('meter-critical');
            else if (finalPct > 0 && finalPct <= 10) newBarClasses.push('meter-critical');
            else if (finalPct > 10 && finalPct <= 25) newBarClasses.push('meter-low');
            else if (finalPct > 25 && finalPct <= 50) newBarClasses.push('meter-medium');
            else {
                newBarClasses.push('meter-full');
                if (meterType === 'shields' || meterType === 'enemy_shields') newBarClasses.push('meter-ok-shield');
                else if (meterType === 'fuel') newBarClasses.push('meter-ok-fuel');
                else if (meterType === 'stamina') newBarClasses.push('meter-ok-stamina');
                else if (meterType === 'mana') newBarClasses.push('meter-ok-mana');
            }
        }

        if (textEl && textEl.textContent !== newTxt) { textEl.textContent = newTxt; updatedOccurred = true; }
        if (barEl.style.width !== `${finalPct}%`) { barEl.style.width = `${finalPct}%`; updatedOccurred = true; }

        const exClasses = Array.from(barEl.classList).filter(cls => cls.startsWith('meter-'));
        let classesDiff = newBarClasses.length !== exClasses.length || !newBarClasses.every(cls => exClasses.includes(cls));
        if (classesDiff) {
            exClasses.forEach(cls => { if (cls !== 'meter-bar') barEl.classList.remove(cls); });
            if (!barEl.classList.contains('meter-bar')) barEl.classList.add('meter-bar');
            newBarClasses.forEach(cls => { if (cls && cls.trim() !== '' && cls !== 'meter-bar') barEl.classList.add(cls); });
            updatedOccurred = true;
        } else if (!barEl.classList.contains('meter-bar')) barEl.classList.add('meter-bar'); // Ensure base class

        if (highlight && updatedOccurred) { const c = textEl ? textEl.closest('.info-item, .info-item-meter') : barEl.closest('.info-item, .info-item-meter'); if (c) highlightElementUpdate(c); }
        return updatedOccurred;
    };

    function getParentPanelConfig(itemId, dashboardConfig) { // Pass dashboardConfig
        if (!dashboardConfig) return null;
        for (const panelSideKey of ['left_panel', 'right_panel']) {
            if (dashboardConfig[panelSideKey]) {
                for (const panelConfig of dashboardConfig[panelSideKey]) {
                    if (panelConfig.items && panelConfig.items.some(item => item.id === itemId)) {
                        return panelConfig;
                    }
                }
            }
        }
        return null;
    }

    function updateDashboard(updatesFromAI, highlightChanges = true) {
        if (!updatesFromAI || Object.keys(updatesFromAI).length === 0 || !currentTheme) return;
        const currentThemeFullConfig = ALL_THEMES_CONFIG[currentTheme];
        if (!currentThemeFullConfig) return;
        const themeCfg = THEME_DASHBOARD_CONFIGS[currentThemeFullConfig.dashboard_config_ref];
        if (!themeCfg) return;

        const allItems = [...(themeCfg.left_panel || []).flatMap(b => b.items), ...(themeCfg.right_panel || []).flatMap(b => b.items)];
        const itemCfgsMap = new Map(allItems.map(i => [i.id, i]));

        for (const key in updatesFromAI) {
            if (Object.prototype.hasOwnProperty.call(updatesFromAI, key)) {
                const val = updatesFromAI[key];
                let itemCfg = itemCfgsMap.get(key);
                let actualUpdateOccurred = false;

                if (!itemCfg && key === 'callsign' && currentTheme === 'fantasy') {
                    itemCfg = itemCfgsMap.get('character_name');
                    if (itemCfg) playerIdentifier = String(val);
                } else if (key === 'callsign' || key === 'character_name') {
                    playerIdentifier = String(val);
                }
                if (!itemCfg) continue;

                const valEl = document.getElementById(`info-${itemCfg.id}`);
                const meterBarEl = document.getElementById(`meter-${itemCfg.id}`);

                if (itemCfg.type === 'meter') {
                    if (valEl || meterBarEl) {
                        actualUpdateOccurred = setMeter(meterBarEl, valEl, String(val), itemCfg.meter_type, {
                            highlight: highlightChanges,
                            newStatusText: itemCfg.status_text_id ? updatesFromAI[itemCfg.status_text_id] : undefined
                        });
                    }
                } else if (itemCfg.type === 'status_text') {
                    if (valEl) {
                        const newStatTxt = String(val);
                        let statClass = 'status-info';
                        const lowVal = newStatTxt.toLowerCase();
                        if (itemCfg.id === 'alertLevel' || itemCfg.id === 'alert_level') {
                            // Use specific values from uiTextData for comparison for robustness
                            if (lowVal.includes(getUIText('alert_level_danger_val', {}, currentTheme).toLowerCase())) statClass = 'status-danger';
                            else if (lowVal.includes(getUIText('alert_level_wary_val', {}, currentTheme).toLowerCase()) || lowVal.includes(getUIText('alert_level_yellow_val', {}, currentTheme).toLowerCase())) statClass = 'status-warning';
                            else if (lowVal.includes(getUIText('alert_level_calm_val', {}, currentTheme).toLowerCase()) || lowVal.includes(getUIText('alert_level_green_val', {}, currentTheme).toLowerCase())) statClass = 'status-ok';
                        }
                        if (valEl.textContent !== newStatTxt || !valEl.className.includes(statClass)) {
                            valEl.textContent = newStatTxt;
                            valEl.className = `value ${statClass}`;
                            if (highlightChanges) highlightElementUpdate(valEl);
                            actualUpdateOccurred = true;
                        }
                    }
                } else { // text, number_text, text_long
                    if (valEl) {
                        const suffix = itemCfg.suffix || '';
                        const newVTxt = `${val}${suffix}`;
                        if (valEl.textContent !== newVTxt) {
                            valEl.textContent = newVTxt;
                            if (highlightChanges) highlightElementUpdate(valEl);
                            actualUpdateOccurred = true;
                        }
                    }
                }

                if (actualUpdateOccurred) {
                    const parentPanelConfig = getParentPanelConfig(key, themeCfg);
                    if (parentPanelConfig && parentPanelConfig.type === 'collapsible') {
                        const panelElement = document.getElementById(parentPanelConfig.id);
                        if (panelElement && !panelElement.classList.contains('is-expanded')) {
                            animatePanelBox(parentPanelConfig.id, true, false);
                        }
                    }
                }
            }
        }
        lastKnownDashboardUpdates = { ...lastKnownDashboardUpdates, ...updatesFromAI };
    }

    function initializeDashboardDefaultTexts() {
        if (!currentTheme) return; // No dashboard to init if no theme active (e.g. on landing page)
        const currentThemeFullConfig = ALL_THEMES_CONFIG[currentTheme];
        if (!currentThemeFullConfig) return;
        const themeCfg = THEME_DASHBOARD_CONFIGS[currentThemeFullConfig.dashboard_config_ref];
        if (!themeCfg) return;

        ['left_panel', 'right_panel'].forEach(sideKey => {
            if (!themeCfg[sideKey]) return;
            themeCfg[sideKey].forEach(boxCfg => {
                boxCfg.items.forEach(itemCfg => {
                    const valEl = document.getElementById(`info-${itemCfg.id}`); const meterBarEl = document.getElementById(`meter-${itemCfg.id}`);
                    const defVal = itemCfg.default_value !== undefined ? String(itemCfg.default_value) : getUIText(itemCfg.default_value_key);
                    if (itemCfg.type === 'meter') {
                        if (valEl || meterBarEl) { const defStat = itemCfg.default_status_key ? getUIText(itemCfg.default_status_key) : getUIText('offline'); setMeter(meterBarEl, valEl, defVal, itemCfg.meter_type, { highlight: false, newStatusText: defStat, initialPlaceholder: `${defStat}: ${defVal}%` }); }
                    } else if (itemCfg.type === 'status_text') {
                        if (valEl) {
                            const dspDef = getUIText(itemCfg.default_value_key); const statValDef = itemCfg.default_status_key ? getUIText(itemCfg.default_status_key) : dspDef;
                            valEl.textContent = dspDef; let statClass = 'status-info'; const lowVal = statValDef.toLowerCase();
                            if (itemCfg.id === 'alertLevel' || itemCfg.id === 'alert_level') {
                                if (lowVal.includes(getUIText('alert_level_danger_val', {}, currentTheme).toLowerCase())) statClass = 'status-danger';
                                else if (lowVal.includes(getUIText('alert_level_wary_val', {}, currentTheme).toLowerCase()) || lowVal.includes(getUIText('alert_level_yellow_val', {}, currentTheme).toLowerCase())) statClass = 'status-warning';
                                else if (lowVal.includes(getUIText('alert_level_calm_val', {}, currentTheme).toLowerCase()) || lowVal.includes(getUIText('alert_level_green_val', {}, currentTheme).toLowerCase())) statClass = 'status-ok';
                            }
                            valEl.className = `value ${statClass}`;
                        }
                    } else { if (valEl) { const suffix = itemCfg.suffix || ''; valEl.textContent = `${defVal}${suffix}`; } }
                });
            });
        });
        // isInitialGameLoad refers to the game session, not app load.
        // If playerIdentifier is already known (e.g. from loaded game state), use it.
        // Otherwise, use default.
        const idKey = currentTheme === 'scifi' ? 'callsign' : 'character_name';
        const idCfg = findItemConfigById(themeCfg, idKey);
        if (idCfg) {
            const el = document.getElementById(`info-${idCfg.id}`);
            if (el) el.textContent = playerIdentifier || getUIText(idCfg.default_value_key);
        }
    }

    function findItemConfigById(themeDashCfg, itemId) { // themeDashCfg is from THEME_DASHBOARD_CONFIGS
        if (!themeDashCfg) return null;
        for (const sideKey of ['left_panel', 'right_panel']) {
            if (!themeDashCfg[sideKey]) continue;
            for (const boxCfg of themeDashCfg[sideKey]) {
                const found = boxCfg.items.find(i => i.id === itemId);
                if (found) return found;
            }
        } return null;
    }

    function autoGrowTextarea(textarea) {
        if (!textarea) return;
        textarea.style.height = 'auto'; let newH = textarea.scrollHeight;
        const maxH = parseInt(window.getComputedStyle(textarea).maxHeight, 10) || Infinity;
        if (newH > maxH) { newH = maxH; textarea.style.overflowY = 'auto'; }
        else textarea.style.overflowY = 'hidden';
        textarea.style.height = newH + 'px';
    }

    function animatePanelBox(boxId, shouldExpand, manageVisibility = false) {
        const box = document.getElementById(boxId); if (!box) return;
        const header = box.querySelector('.panel-box-header');
        const content = box.querySelector('.panel-box-content');
        if (!header || !content) return;

        const isCurrentlyExpanded = box.classList.contains('is-expanded');

        if (shouldExpand) {
            if (box.style.display === 'none' && manageVisibility) { // Only manage visibility if asked
                box.style.opacity = '0'; box.style.display = 'flex'; // flex for panel-box
            } else if (box.style.display === 'none') { // If not managing visibility but hidden, make it flex
                box.style.display = 'flex';
            }
            // Ensure content is visible before trying to measure scrollHeight for expansion
            content.style.display = 'block'; // Temporarily ensure it's block for correct height calculation

            requestAnimationFrame(() => { // Allow DOM to update
                box.classList.add('is-expanded');
                if (manageVisibility) box.style.opacity = '1';
                header.setAttribute('aria-expanded', 'true');
                content.setAttribute('aria-hidden', 'false');
                // Max height is set in CSS, JS just toggles class
            });
        } else { // Collapse
            box.classList.remove('is-expanded');
            header.setAttribute('aria-expanded', 'false');
            content.setAttribute('aria-hidden', 'true');

            if (manageVisibility) { // Only manage visibility if asked
                box.style.opacity = '0';
                const transitionDuration = parseFloat(getComputedStyle(content).transitionDuration.replace('s', '')) * 1000 || 300; // Fallback

                const hideEnd = (ev) => {
                    if (ev.target === content || ev.target === box) {
                        if (!box.classList.contains('is-expanded')) {
                            box.style.display = 'none';
                            content.style.display = ''; // Reset temporary style
                        }
                        content.removeEventListener('transitionend', hideEnd);
                        box.removeEventListener('transitionend', hideEnd);
                    }
                };
                content.addEventListener('transitionend', hideEnd);
                box.addEventListener('transitionend', hideEnd);
                // Fallback timeout in case transitionend doesn't fire reliably
                setTimeout(() => {
                    if (!box.classList.contains('is-expanded') && box.style.opacity === '0') {
                        box.style.display = 'none';
                        content.style.display = ''; // Reset temporary style
                    }
                }, transitionDuration + 100);
            } else {
                // If not managing visibility, ensure content display is reset if needed
                // but generally the CSS handles this with max-height: 0 and overflow: hidden
            }
        }
    }

    function initializeCollapsiblePanelBoxes(themeIdForPanels) {
        const themeFullConfig = ALL_THEMES_CONFIG[themeIdForPanels];
        if (!themeFullConfig) return;
        const themeCfg = THEME_DASHBOARD_CONFIGS[themeFullConfig.dashboard_config_ref];
        if (!themeCfg) return;

        const allPanelCfgs = [...(themeCfg.left_panel || []), ...(themeCfg.right_panel || [])];
        allPanelCfgs.forEach(boxCfg => {
            const box = document.getElementById(boxCfg.id); if (!box) return;
            const header = box.querySelector('.panel-box-header');
            if (!header) return;

            if (boxCfg.type === 'collapsible' || boxCfg.type === 'hidden_until_active') {
                header.addEventListener('click', () => {
                    if (box.style.display !== 'none' || boxCfg.type === 'collapsible') { // Allow expanding hidden_until_active if it became visible
                        animatePanelBox(boxCfg.id, !box.classList.contains('is-expanded'), boxCfg.type === 'hidden_until_active');
                    }
                });
                header.setAttribute('tabindex', '0');
                header.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && (box.style.display !== 'none' || boxCfg.type === 'collapsible')) { e.preventDefault(); animatePanelBox(boxCfg.id, !box.classList.contains('is-expanded'), boxCfg.type === 'hidden_until_active'); } });
            }

            // Initial state
            if (boxCfg.type === 'static') {
                box.style.display = 'flex'; box.style.opacity = '1';
                animatePanelBox(boxCfg.id, true, false);
            } else if (boxCfg.type === 'hidden_until_active') {
                box.style.display = 'none'; box.style.opacity = '0';
                animatePanelBox(boxCfg.id, false, true); // Collapse it, manage visibility
            } else { // collapsible
                box.style.display = 'flex'; box.style.opacity = '1';
                const delay = boxCfg.boot_delay || 0;
                setTimeout(() => animatePanelBox(boxCfg.id, boxCfg.initial_expanded || false, false), delay);
            }
        });
    }

    function updateModelToggleButtonText() {
        if (!modelToggleButton) return;
        const isPaid = currentModelName === PAID_MODEL_NAME;
        const txtKey = isPaid ? "button_toggle_to_free" : "button_toggle_to_paid";
        const ariaKey = isPaid ? "aria_label_current_model_paid" : "aria_label_current_model_free";
        modelToggleButton.textContent = getUIText(txtKey, { MODEL_NAME: currentModelName });
        const ariaLbl = getUIText(ariaKey, { MODEL_NAME: currentModelName });
        modelToggleButton.setAttribute('aria-label', ariaLbl); modelToggleButton.title = ariaLbl;
    }

    // --- Theme Management (Playing/Liked) & Topbar ---
    function saveThemeListsToStorage() {
        localStorage.setItem(PLAYING_THEMES_STORAGE_KEY, JSON.stringify(playingThemes));
        localStorage.setItem(LIKED_THEMES_STORAGE_KEY, JSON.stringify(likedThemes));
    }

    function loadThemeListsFromStorage() {
        playingThemes = JSON.parse(localStorage.getItem(PLAYING_THEMES_STORAGE_KEY) || '[]');
        likedThemes = JSON.parse(localStorage.getItem(LIKED_THEMES_STORAGE_KEY) || '[]');
    }

    function isThemePlaying(themeId) {
        return playingThemes.includes(themeId);
    }

    function isThemeLiked(themeId) {
        return likedThemes.includes(themeId);
    }

    function addPlayingTheme(themeId) { // Called when a theme starts playing
        if (!isThemePlaying(themeId)) {
            // Remove from the visual playingThemes array if it's there from a previous state (e.g., page reload bug)
            const currentIndex = playingThemes.indexOf(themeId);
            if (currentIndex > -1) {
                playingThemes.splice(currentIndex, 1);
            }
            playingThemes.unshift(themeId); // Add to the beginning as most recent
        }
        // Note: We NO LONGER remove it from likedThemes here.
        // A theme can be simultaneously "liked" and "playing".
        // The UI will show it in the "playing" section if it's in playingThemes.
        saveThemeListsToStorage();
        updateTopbarThemeIcons(); // This will correctly place it based on playingThemes precedence
    }

    function addLikedTheme(themeId) { // Called from landing page "like" button
        if (!isThemeLiked(themeId)) { // Only add if not already liked
            likedThemes.push(themeId);
            saveThemeListsToStorage();
            updateTopbarThemeIcons();
            // If on landing page and this is the selected grid theme, update its heart icon
            if (!currentTheme && currentLandingGridSelection === themeId) {
                const likeButton = document.getElementById('like-theme-button');
                if (likeButton) {
                    likeButton.innerHTML = `<img src="images/icon_heart_filled.svg" alt="${getUIText('aria_label_unlike_theme')}" class="like-icon">`;
                    likeButton.setAttribute('aria-label', getUIText('aria_label_unlike_theme'));
                    likeButton.title = likeButton.getAttribute('aria-label');
                    likeButton.classList.add('liked');
                }
            }
        }
    }

    function addLikedTheme(themeId) {
        if (!isThemeLiked(themeId) && !isThemePlaying(themeId)) { // Can't like if already playing
            likedThemes.push(themeId);
            saveThemeListsToStorage();
            updateTopbarThemeIcons();
        }
    }

    function removePlayingTheme(themeId, moveToLiked = true) {
        const index = playingThemes.indexOf(themeId);
        if (index > -1) {
            playingThemes.splice(index, 1);
            if (moveToLiked && !isThemeLiked(themeId)) { // Only move if not already liked
                likedThemes.push(themeId);
            }
            saveThemeListsToStorage();
            updateTopbarThemeIcons();
        }
    }

    function removeLikedTheme(themeId) { // Called from landing page "unlike" or if closing a liked-only theme
        const index = likedThemes.indexOf(themeId);
        if (index > -1) {
            likedThemes.splice(index, 1);
            saveThemeListsToStorage();
            updateTopbarThemeIcons();
            // If on landing page and this is the selected grid theme, update its heart icon
            if (!currentTheme && currentLandingGridSelection === themeId) {
                const likeButton = document.getElementById('like-theme-button');
                if (likeButton) {
                    likeButton.innerHTML = `<img src="images/icon_heart_empty.svg" alt="${getUIText('aria_label_like_theme')}" class="like-icon">`;
                    likeButton.setAttribute('aria-label', getUIText('aria_label_like_theme'));
                    likeButton.title = likeButton.getAttribute('aria-label');
                    likeButton.classList.remove('liked');
                }
            }
        }
    }

    function handleCloseTopbarIcon(themeId) {
        let wasPlaying = false;
        const playingIndex = playingThemes.indexOf(themeId);
        if (playingIndex > -1) {
            playingThemes.splice(playingIndex, 1);
            wasPlaying = true;
        }

        // If it was not playing (i.e., it was a liked-only theme being closed)
        // OR if it was playing but NOT liked (meaning this 'close' is a full removal)
        // then remove from likedThemes as well.
        if (!wasPlaying || (wasPlaying && !isThemeLiked(themeId))) {
            const likedIndex = likedThemes.indexOf(themeId);
            if (likedIndex > -1) {
                likedThemes.splice(likedIndex, 1);
            }
        }
        // If it was playing AND it is liked, it remains in likedThemes, effectively moving it to the "liked" section.

        saveThemeListsToStorage();
        updateTopbarThemeIcons();

        // If the closed theme was the currently active game view theme
        if (wasPlaying && currentTheme === themeId) {
            currentTheme = null;
            localStorage.removeItem(CURRENT_THEME_STORAGE_KEY);
            switchToLandingView();
        }
    }

    function createThemeTopbarIcon(themeId, type) { // type is now more of a HINT for styling 'active'
        const themeConfig = ALL_THEMES_CONFIG[themeId];
        if (!themeConfig) return null;

        const isCurrentlyPlaying = isThemePlaying(themeId); // Primary determinant for section
        const isCurrentlyLiked = isThemeLiked(themeId);

        const button = document.createElement('button');
        button.classList.add('theme-button');
        
        // The 'active' class is for the theme that matches `currentTheme` (the one in game view)
        if (isCurrentlyPlaying && themeId === currentTheme) {
            button.classList.add('active');
        }
        button.dataset.theme = themeId;
        // dataset.type could indicate 'playing' or 'liked' based on where it's rendered by updateTopbarThemeIcons
        // but the click handler logic will mainly use isThemePlaying and isThemeLiked.

        const themeNameText = getUIText(themeConfig.name_key);
        let statusText = "";
        if (isCurrentlyPlaying) {
            statusText = getUIText('theme_icon_alt_text_playing');
        } else if (isCurrentlyLiked) {
            statusText = getUIText('theme_icon_alt_text_liked');
        }
        button.title = `${themeNameText}${statusText ? ` (${statusText})` : ''}`;


        const img = document.createElement('img');
        img.src = themeConfig.icon;
        img.alt = button.title;
        button.appendChild(img);

        const closeBtn = document.createElement('button');
        closeBtn.classList.add('theme-button-close');
        closeBtn.innerHTML = '×'; 
        closeBtn.title = getUIText('close_theme_button_aria_label', {THEME_NAME: themeNameText});
        closeBtn.setAttribute('aria-label', closeBtn.title);
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            handleCloseTopbarIcon(themeId); // Use the new handler
        });
        button.appendChild(closeBtn);

        button.addEventListener('click', () => handleTopbarThemeIconClick(themeId)); // Simplified click handler
        return button;
    }

    function updateTopbarThemeIcons() {
        playingThemesContainer.innerHTML = '';
        likedThemesContainer.innerHTML = '';

        // Render icons for themes that are in playingThemes list
        playingThemes.forEach(themeId => {
            const icon = createThemeTopbarIcon(themeId, 'playing'); // Pass 'playing' as type hint
            if (icon) {
                icon.dataset.type = 'playing'; // For specific click handling if needed later
                playingThemesContainer.appendChild(icon);
            }
        });

        // Render icons for themes that are in likedThemes list AND NOT in playingThemes list
        likedThemes.forEach(themeId => {
            if (!isThemePlaying(themeId)) { // Only show in liked if not already shown in playing
                const icon = createThemeTopbarIcon(themeId, 'liked'); // Pass 'liked' as type hint
                if (icon) {
                    icon.dataset.type = 'liked';
                    likedThemesContainer.appendChild(icon);
                }
            }
        });

        const showSeparator = (playingThemesContainer.children.length > 0 && likedThemesContainer.children.length > 0) ||
                              (playingThemesContainer.children.length === 0 && likedThemesContainer.children.length > 0);
        likedThemesSeparator.style.display = showSeparator ? 'block' : 'none';
    }

    function handleTopbarThemeIconClick(themeId) {
        const themeIsCurrentlyPlayingInView = (currentTheme === themeId);
        
        if (isThemePlaying(themeId)) { // Icon is in the "playing" section (or should be)
            if (!themeIsCurrentlyPlayingInView) {
                // Switch to this already "active session" theme's view
                changeThemeAndStart(themeId, false); 
            }
            // If already currentTheme, clicking it does nothing.
        } else if (isThemeLiked(themeId)) { // Icon is in the "liked" section
            // Start playing this liked theme.
            changeThemeAndStart(themeId, false); // This will also call addPlayingTheme
        }
        // If it's somehow neither, it's an orphaned icon, shouldn't happen.
    }


    // --- Application Flow & Game Logic Functions ---
    function toggleModelType() {
        currentModelName = (currentModelName === PAID_MODEL_NAME) ? FREE_MODEL_NAME : PAID_MODEL_NAME;
        localStorage.setItem(MODEL_PREFERENCE_STORAGE_KEY, currentModelName);
        updateModelToggleButtonText();
        const msgKey = (currentModelName === PAID_MODEL_NAME) ? "system_model_set_paid" : "system_model_set_free";
        addMessageToLog(getUIText(msgKey, { MODEL_NAME: currentModelName }), 'system');
    }

    function setAppLanguageAndThemeUI(lang, themeIdForUIContext) { // Renamed to avoid conflict
        currentAppLanguage = lang; localStorage.setItem(LANGUAGE_PREFERENCE_STORAGE_KEY, lang);
        if (document.documentElement) document.documentElement.lang = lang;

        // Set body class based on actual currentTheme if game is active, or default for landing
        const bodyTheme = currentTheme || DEFAULT_THEME_ID;
        document.body.className = ''; // Clear existing theme classes
        document.body.classList.add(`theme-${bodyTheme}`);
        if (!currentTheme) document.body.classList.add('landing-page-active'); // Specific class for landing styling
        else document.body.classList.remove('landing-page-active');


        if (languageToggleButton) {
            const otherLang = lang === 'en' ? 'cs' : 'en';
            languageToggleButton.textContent = uiTextData[themeIdForUIContext]?.[otherLang]?.toggle_language || (otherLang === 'cs' ? 'Česky' : 'English');
            const ariaToggleKey = `aria_label_toggle_language`;
            const toggleAria = uiTextData[themeIdForUIContext]?.[otherLang]?.[ariaToggleKey] || `Switch to ${otherLang}`;
            languageToggleButton.setAttribute('aria-label', toggleAria); languageToggleButton.title = toggleAria;
        }

        if (newGameButton) { newGameButton.textContent = getUIText('button_new_game'); newGameButton.title = getUIText('aria_label_new_game'); newGameButton.setAttribute('aria-label', getUIText('aria_label_new_game')); }
        if (modelToggleButton) modelToggleButton.title = getUIText('aria_label_toggle_model_generic'); // Generic as it's not theme dependent

        // Status indicators can use default theme texts if no currentTheme
        if (systemStatusIndicator) systemStatusIndicator.textContent = getUIText(systemStatusIndicator.dataset.langKey || 'system_status_online_short');
        if (gmSpecificActivityIndicator) gmSpecificActivityIndicator.textContent = getUIText(gmSpecificActivityIndicator.dataset.langKey || 'system_processing_short');

        // Update panel titles and labels if in game view
        if (currentTheme) {
            const currentThemeFullCfg = ALL_THEMES_CONFIG[currentTheme];
            const dashboardCfg = THEME_DASHBOARD_CONFIGS[currentThemeFullCfg.dashboard_config_ref];
            if (dashboardCfg) {
                ['left_panel', 'right_panel'].forEach(sideKey => {
                    if (!dashboardCfg[sideKey]) return;
                    dashboardCfg[sideKey].forEach(boxCfg => {
                        const titleEl = document.querySelector(`#${boxCfg.id} .panel-box-title`);
                        if (titleEl) titleEl.textContent = getUIText(boxCfg.title_key);
                        boxCfg.items.forEach(itemCfg => {
                            const labelEl = document.querySelector(`#info-item-container-${itemCfg.id} .label`);
                            if (labelEl) labelEl.textContent = getUIText(itemCfg.label_key);
                        });
                    });
                });
            }
        } else { // Update landing page panel titles
            const descTitle = landingThemeDescriptionContainer.querySelector('.panel-box-title');
            if (descTitle) descTitle.textContent = getUIText('landing_theme_description_title');
            const detailsTitle = landingThemeDetailsContainer.querySelector('.panel-box-title');
            if (detailsTitle) detailsTitle.textContent = getUIText('landing_theme_info_title');
        }

        if (playerIdentifierInputEl) playerIdentifierInputEl.placeholder = getUIText('placeholder_callsign_login');
        if (startGameButton) startGameButton.textContent = getUIText('button_access_systems');
        if (playerActionInput) playerActionInput.placeholder = getUIText('placeholder_command');
        if (sendActionButton) sendActionButton.textContent = getUIText('button_execute_command');

        if (currentTheme) initializeDashboardDefaultTexts(); // Only if a game is active
        updateModelToggleButtonText();
        updateTopbarThemeIcons(); // Re-render topbar icons with new lang titles
        if (!currentTheme && currentLandingGridSelection) { // If on landing page, re-render selected theme info
            updateLandingPagePanels(currentLandingGridSelection, false); // Don't re-animate panels
        }
    }

    function toggleAppLanguage() {
        const newLang = currentAppLanguage === 'en' ? 'cs' : 'en';
        // Narrative language might be independent, or follow UI. For now, link them.
        currentNarrativeLanguage = newLang; localStorage.setItem(NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY, newLang);

        setAppLanguageAndThemeUI(newLang, currentTheme || DEFAULT_THEME_ID); // Use active theme or default for UI context

        // System message about language change - this needs to be handled carefully if story log is hidden
        const langChangeMsgKey = newLang === 'en' ? "system_lang_set_en" : "system_lang_set_cs";
        if (currentTheme && storyLogViewport.style.display !== 'none') { // Only if in game view
            addMessageToLog(getUIText(langChangeMsgKey), 'system');
        } else {
            console.log(getUIText(langChangeMsgKey)); // Log to console if not in game
        }

        if (currentTheme) saveGameState(); // Save if in a game
    }

    function handleGameStateIndicators(indicators, isInitialBoot = false) {
        if (!indicators || !currentTheme) return;
        const currentThemeFullCfg = ALL_THEMES_CONFIG[currentTheme];
        if (!currentThemeFullCfg) return;
        const themeDashCfg = THEME_DASHBOARD_CONFIGS[currentThemeFullCfg.dashboard_config_ref];
        if (!themeDashCfg) return;

        lastKnownGameStateIndicators = { ...lastKnownGameStateIndicators, ...indicators };

        const themePanels = [...(themeDashCfg.left_panel || []), ...(themeDashCfg.right_panel || [])];
        themePanels.forEach(boxCfg => {
            if (boxCfg.type === 'hidden_until_active' && boxCfg.indicator_key) {
                const boxEl = document.getElementById(boxCfg.id); if (!boxEl) return;
                const shouldShow = indicators[boxCfg.indicator_key] === true;
                const isShowing = boxEl.style.display !== 'none' && parseFloat(boxEl.style.opacity || '0') > 0;

                if (shouldShow && !isShowing) {
                    const delay = isInitialBoot && boxCfg.boot_delay ? boxCfg.boot_delay : 0;
                    setTimeout(() => animatePanelBox(boxCfg.id, true, true), delay);
                }
                else if (!shouldShow && isShowing) {
                    animatePanelBox(boxCfg.id, false, true);
                }
            }
        });
        if (indicators.combat_engaged === true && currentPromptType !== 'combat') currentPromptType = 'combat';
        else if (indicators.combat_engaged === false && currentPromptType === 'combat') currentPromptType = 'default';
    }

    async function callGeminiAPI(currentTurnHistory) {
        if (!GEMINI_API_KEY) { /* ... (same as original, but use currentTheme for getUIText) ... */
            addMessageToLog(getUIText('error_critical_no_api_key'), 'system');
            if (systemStatusIndicator) { systemStatusIndicator.textContent = getUIText('status_error'); systemStatusIndicator.className = 'status-indicator status-danger'; }
            setGMActivity(false); return null;
        }
        setGMActivity(true); clearSuggestedActions();
        // isInitialGameLoad is for the *session* of currentTheme
        const activePType = (isInitialGameLoad || (currentTurnHistory.length === 1 && gameHistory[0].role === 'user' && gameHistory[0].parts[0].text.includes("ready to start the game"))) ? 'initial' : currentPromptType;

        const sysPrompt = getSystemPrompt(playerIdentifier, activePType);
        if (sysPrompt.startsWith('{"narrative": "SYSTEM ERROR:')) {
            try { const errResp = JSON.parse(sysPrompt); addMessageToLog(errResp.narrative, 'system'); if (errResp.suggested_actions) displaySuggestedActions(errResp.suggested_actions); } catch (e) { }
            setGMActivity(false); return null;
        }
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${currentModelName}:generateContent?key=${GEMINI_API_KEY}`;
        let genCfg = { temperature: 0.7, topP: 0.95, maxOutputTokens: 8192, responseMimeType: "application/json" };
        let payload = { contents: currentTurnHistory, generationConfig: genCfg, safetySettings: [{ category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }], systemInstruction: { parts: [{ text: sysPrompt }] } };
        try {
            const resp = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const respData = await resp.json();
            if (!resp.ok) { let errDet = respData.error?.message || `API Error ${resp.status}`; if (respData.error?.details) errDet += ` Details: ${JSON.stringify(respData.error.details)}`; throw new Error(errDet); }
            if (respData.candidates && respData.candidates[0]?.content?.parts?.[0]?.text) {
                let jsonStr = respData.candidates[0].content.parts[0].text;
                try {
                    const parsed = JSON.parse(jsonStr);
                    if (typeof parsed.narrative !== 'string' || typeof parsed.dashboard_updates !== 'object' || !Array.isArray(parsed.suggested_actions) || typeof parsed.game_state_indicators !== 'object') throw new Error("Invalid JSON structure from AI.");
                    gameHistory.push({ role: "model", parts: [{ text: JSON.stringify(parsed) }] });
                    updateDashboard(parsed.dashboard_updates); displaySuggestedActions(parsed.suggested_actions); handleGameStateIndicators(parsed.game_state_indicators, isInitialGameLoad);
                    if (isInitialGameLoad) isInitialGameLoad = false; // Mark current session as no longer initial
                    saveGameState(); // Saves for currentTheme
                    if (systemStatusIndicator) { systemStatusIndicator.textContent = getUIText('system_status_online_short'); systemStatusIndicator.className = 'status-indicator status-ok'; }
                    return parsed.narrative;
                } catch (e) { throw new Error(`Invalid JSON from AI: ${e.message}. String: ${jsonStr.substring(0, 500)}...`); }
            } else if (respData.promptFeedback?.blockReason) {
                const blockDet = respData.promptFeedback.safetyRatings?.map(r => `${r.category}: ${r.probability}`).join(', ') || "No details."; throw new Error(`Content blocked: ${respData.promptFeedback.blockReason}. Ratings: ${blockDet}`);
            } else throw new Error("No valid candidate/text in AI response.");
        } catch (error) {
            addMessageToLog(getUIText('error_api_call_failed', { ERROR_MSG: error.message }), 'system');
            if (systemStatusIndicator) { systemStatusIndicator.textContent = getUIText('status_error'); systemStatusIndicator.className = 'status-indicator status-danger'; }
            return null;
        } finally { setGMActivity(false); }
    }

    async function startGameAfterIdentifier() { // Called after user enters name for currentTheme
        const enteredId = playerIdentifierInputEl ? playerIdentifierInputEl.value.trim() : "";
        if (!enteredId) { alert(getUIText('alert_identifier_required')); if (playerIdentifierInputEl) playerIdentifierInputEl.focus(); return; }

        playerIdentifier = enteredId;
        isInitialGameLoad = true; // This is the first interaction for this player in this theme session
        currentPromptType = 'initial'; // Ensure initial prompt is used

        // UI transition from name input to action input
        if (nameInputSection) nameInputSection.style.display = 'none';
        if (actionInputSection) actionInputSection.style.display = 'flex';
        if (storyLogViewport && storyLogViewport.classList.contains('spawn-animation')) {
            // Animation already handled by switchToGameView or changeThemeAndStart
        } else if (storyLogViewport) { // If somehow no animation class, just ensure visible
            storyLogViewport.style.opacity = '1';
            storyLogViewport.style.transform = 'translateY(0) scale(1)';
        }

        if (playerActionInput) { playerActionInput.value = ''; playerActionInput.dispatchEvent(new Event('input', { bubbles: true })); autoGrowTextarea(playerActionInput); playerActionInput.focus(); }

        const idKey = currentTheme === 'scifi' ? 'callsign' : 'character_name';
        updateDashboard({ [idKey]: playerIdentifier }, false);

        addMessageToLog(getUIText('connecting', { PLAYER_ID: playerIdentifier }), 'system');

        // Reset game history for this new start (player name implies new beginning for this session)
        gameHistory = [{ role: "user", parts: [{ text: `My identifier is ${playerIdentifier}. I am ready to start the game in ${currentTheme} theme.` }] }];
        saveGameState(); // Save the identifier and initial history entry

        clearSuggestedActions();
        const narrative = await callGeminiAPI(gameHistory); // API call uses currentTheme
        if (narrative) {
            addMessageToLog(narrative, 'gm');
        } else {
            // Failed to get initial narrative. Revert to name input? Or show error?
            // For now, log error. User might need to retry or check API key.
            if (nameInputSection) nameInputSection.style.display = 'flex'; // Re-show name input
            if (actionInputSection) actionInputSection.style.display = 'none';
            addMessageToLog(getUIText('error_session_init_failed'), 'system');
        }
    }

    async function sendPlayerAction() {
        const action = playerActionInput ? playerActionInput.value.trim() : "";
        if (!action) { if (playerActionInput) playerActionInput.focus(); return; }
        addMessageToLog(action, 'player');
        if (playerActionInput) { playerActionInput.value = ''; playerActionInput.dispatchEvent(new Event('input', { bubbles: true })); autoGrowTextarea(playerActionInput); }
        clearSuggestedActions(); gameHistory.push({ role: "user", parts: [{ text: action }] });
        // saveGameState(); // Save before API call
        const narrative = await callGeminiAPI(gameHistory); // Uses currentTheme
        if (narrative) addMessageToLog(narrative, 'gm');
        // saveGameState(); // Save after successful API call (already done in callGeminiAPI)
    }

    function startNewGameSession() { // "New Game" button in top bar
        if (!currentTheme && !currentLandingGridSelection) { // On landing page, no theme selected yet
            alert(getUIText('alert_select_theme_first')); // Placeholder UI text
            return;
        }
        const themeToStartNewGameIn = currentTheme || currentLandingGridSelection;
        if (!themeToStartNewGameIn) return; // Should not happen if check above is good

        const themeName = getUIText(ALL_THEMES_CONFIG[themeToStartNewGameIn].name_key);
        const confirmKey = `confirm_new_game_theme_${themeToStartNewGameIn}`; // e.g., confirm_new_game_theme_scifi
        const confirmMsg = getUIText(confirmKey, { THEME_NAME: themeName }) || getUIText('confirm_new_game_generic', { THEME_NAME: themeName });

        if (confirm(confirmMsg)) {
            addMessageToLog(getUIText('system_new_game_initiated', { THEME_NAME: themeName }), 'system');
            changeThemeAndStart(themeToStartNewGameIn, true); // true = force new game
        }
    }

    function generatePanelsForTheme(themeId) {
        const themeFullConfig = ALL_THEMES_CONFIG[themeId];
        if (!themeFullConfig || !leftPanel || !rightPanel) return;
        const config = THEME_DASHBOARD_CONFIGS[themeFullConfig.dashboard_config_ref];
        if (!config) {
            console.error(`Dashboard config not found for ${themeFullConfig.dashboard_config_ref}`);
            leftPanel.innerHTML = '<p>Error: Dashboard configuration missing.</p>';
            rightPanel.innerHTML = '';
            return;
        }

        leftPanel.innerHTML = ''; rightPanel.innerHTML = ''; // Clear previous panels

        // Hide landing page specific panels if they were visible
        landingThemeDescriptionContainer.style.display = 'none';
        landingThemeDetailsContainer.style.display = 'none';


        const createSide = (sideContainer, panelConfigs) => {
            if (!panelConfigs) return;
            panelConfigs.forEach(panelConfig => {
                const panelBox = document.createElement('div'); panelBox.id = panelConfig.id;
                panelBox.classList.add('panel-box');
                // Add 'flex' display style, used to be implicit
                panelBox.style.display = 'flex';
                panelBox.style.flexDirection = 'column';

                if (panelConfig.type === 'collapsible' || panelConfig.type === 'hidden_until_active') panelBox.classList.add('collapsible');

                const header = document.createElement('div'); header.classList.add('panel-box-header');
                const title = document.createElement('h3'); title.classList.add('panel-box-title');
                title.textContent = getUIText(panelConfig.title_key);
                header.appendChild(title); panelBox.appendChild(header);

                const content = document.createElement('div'); content.classList.add('panel-box-content');
                panelConfig.items.forEach(item => {
                    const itemCont = document.createElement('div'); itemCont.id = `info-item-container-${item.id}`;
                    itemCont.classList.add(item.type === 'meter' ? 'info-item-meter' : 'info-item');
                    if (item.type === 'text_long' || ['objective', 'current_quest', 'location', 'environment', 'sensorConditions'].includes(item.id)) itemCont.classList.add('full-width');

                    const label = document.createElement('span'); label.classList.add('label'); label.textContent = getUIText(item.label_key); itemCont.appendChild(label);

                    if (item.type === 'meter') {
                        const meterCont = document.createElement('div'); meterCont.classList.add('meter-bar-container');
                        const meterBar = document.createElement('div'); meterBar.id = `meter-${item.id}`; meterBar.classList.add('meter-bar');
                        meterCont.appendChild(meterBar); itemCont.appendChild(meterCont);
                        const valOver = document.createElement('span'); valOver.id = `info-${item.id}`; valOver.classList.add('value-overlay'); itemCont.appendChild(valOver);
                    } else {
                        const valSpan = document.createElement('span'); valSpan.id = `info-${item.id}`; valSpan.classList.add('value');
                        if (item.type === 'text_long') valSpan.classList.add('objective-text'); // For potential styling
                        itemCont.appendChild(valSpan);
                    }
                    content.appendChild(itemCont);
                });
                panelBox.appendChild(content); sideContainer.appendChild(panelBox);
            });
        };
        createSide(leftPanel, config.left_panel); createSide(rightPanel, config.right_panel);
    }

    async function changeThemeAndStart(newThemeId, forceNewGame = false) {
        const oldThemeId = currentTheme;

        if (oldThemeId === newThemeId && !forceNewGame) { // Clicking active theme in topbar
            // If game view is not active, switch to it. Otherwise, do nothing.
            if (storyLogViewport.style.display === 'none') {
                switchToGameView(newThemeId); // Ensure game view is shown
                if (playerActionInput && actionInputSection.style.display !== 'none') playerActionInput.focus();
            }
            return;
        }

        // Update current theme and playing/liked lists
        currentTheme = newThemeId;
        localStorage.setItem(CURRENT_THEME_STORAGE_KEY, currentTheme);
        addPlayingTheme(currentTheme); // Moves from liked if it was there, updates topbar

        // Clear game state variables for the new/loading theme
        clearGameStateInternal(currentTheme); // Resets playerIdentifier, gameHistory etc. for currentTheme
        if (forceNewGame) {
            localStorage.removeItem(GAME_STATE_STORAGE_KEY_PREFIX + currentTheme); // Remove saved state file
        }

        switchToGameView(currentTheme); // Handles UI transition to game mode

        // Regenerate dashboard panels for the new theme
        generatePanelsForTheme(currentTheme);
        // Set UI text language and theme-specific texts for the new theme
        setAppLanguageAndThemeUI(currentAppLanguage, currentTheme);
        // Initialize new panels (collapsible, default texts)
        initializeDashboardDefaultTexts(); // Sets default values based on currentTheme
        initializeCollapsiblePanelBoxes(currentTheme);


        const promptsOk = await loadAllPromptsForTheme(currentTheme);
        if (!promptsOk) {
            addMessageToLog(getUIText('error_load_prompts_critical', { THEME: currentTheme }), 'system-error');
            if (startGameButton) startGameButton.disabled = true;
            // Potentially revert to landing or show a critical error state
            switchToLandingView(); // Revert to landing if prompts fail
            return;
        }
        if (startGameButton) startGameButton.disabled = false;

        updateTopbarThemeIcons(); // Ensure correct 'active' state on topbar icon

        if (!forceNewGame && loadGameState(currentTheme)) { // Try to load existing game for this theme
            // Game state loaded successfully (playerIdentifier, history, etc. are now set)
            isInitialGameLoad = false; // Not the first load for this session

            // UI should already be in game view from switchToGameView
            // Hide name input, show action input
            nameInputSection.style.display = 'none';
            actionInputSection.style.display = 'flex';
            if (playerActionInput) playerActionInput.focus();

            addMessageToLog(getUIText('system_session_resumed', { PLAYER_ID: playerIdentifier, THEME_NAME: getUIText(ALL_THEMES_CONFIG[currentTheme].name_key) }), 'system');
            if (systemStatusIndicator) { systemStatusIndicator.textContent = getUIText('system_status_online_short'); systemStatusIndicator.className = 'status-indicator status-ok'; }
        } else {
            // No game state found, or forced new game: Start fresh for this theme
            isInitialGameLoad = true; // This will be an initial load for this theme's session
            currentPromptType = 'initial';
            // Clear any old messages from a different theme
            if (storyLog) storyLog.innerHTML = '';
            clearSuggestedActions();

            // UI should be in game view, now show name input
            nameInputSection.style.display = 'flex';
            actionInputSection.style.display = 'none';
            if (playerIdentifierInputEl) {
                playerIdentifierInputEl.value = ''; // Clear previous name if any
                playerIdentifierInputEl.placeholder = getUIText('placeholder_callsign_login'); // Ensure placeholder is correct
                playerIdentifierInputEl.focus();
            }

            if (systemStatusIndicator) { systemStatusIndicator.textContent = getUIText('standby'); systemStatusIndicator.className = 'status-indicator status-warning'; }
            if (oldThemeId !== newThemeId) {
                addMessageToLog(getUIText('system_theme_set_generic', { THEME_NAME: getUIText(ALL_THEMES_CONFIG[newThemeId].name_key) }), 'system');
            }
            if (forceNewGame) {
                addMessageToLog(getUIText('system_new_game_initiated', { THEME_NAME: getUIText(ALL_THEMES_CONFIG[currentTheme].name_key) }), 'system');
            }
        }

        if (startGameButton) startGameButton.textContent = getUIText('button_access_systems');
    }

    function initializeSpecificPanelHeader(panelContainerElement) { // Pass the container element directly
        if (!panelContainerElement) {
            console.error(`Panel container element not found for click listener.`);
            return;
        }
        const box = panelContainerElement.querySelector('.panel-box'); // Find the panel-box inside
        const header = box ? box.querySelector('.panel-box-header') : null;

        if (box && header) {
            // Ensure box has an ID for animatePanelBox if it doesn't
            if (!box.id) {
                box.id = `${panelContainerElement.id}-box`; // Generate a unique ID
            }

            const newHeader = header.cloneNode(true);
            header.parentNode.replaceChild(newHeader, header);

            newHeader.addEventListener('click', () => {
                animatePanelBox(box.id, !box.classList.contains('is-expanded'), false);
            });
            newHeader.setAttribute('tabindex', '0');
            newHeader.addEventListener('keydown', (e) => {
                if ((e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    animatePanelBox(box.id, !box.classList.contains('is-expanded'), false);
                }
            });
            // console.log(`Initialized click listener for panel within ${panelContainerElement.id}`);
        } else {
            // console.error(`Header or panel-box not found within ${panelContainerElement.id}`);
        }
    }

    // --- Landing Page Specific Functions ---
    function switchToLandingView() {
        currentTheme = null;
        localStorage.removeItem(CURRENT_THEME_STORAGE_KEY);
        playerIdentifier = '';
        gameHistory = [];

        document.body.classList.add('landing-page-active');
        document.body.classList.remove(...Array.from(document.body.classList).filter(cn => cn.startsWith('theme-')));
        document.body.classList.add(`theme-${DEFAULT_THEME_ID}`);

        storyLogViewport.style.display = 'none';
        suggestedActionsWrapper.style.display = 'none';
        playerInputControlPanel.style.display = 'none';
        nameInputSection.style.display = 'none';
        actionInputSection.style.display = 'none';

        // Clear game panels first to ensure clean sidebars
        const gameLeftPanelContent = Array.from(leftPanel.children).filter(el => el.id !== 'landing-theme-description-container');
        gameLeftPanelContent.forEach(el => el.remove());
        const gameRightPanelContent = Array.from(rightPanel.children).filter(el => el.id !== 'landing-theme-details-container');
        gameRightPanelContent.forEach(el => el.remove());

        themeGridContainer.style.display = 'grid';

        // Ensure landing panel containers are present and visible
        landingThemeDescriptionContainer.style.display = 'flex';
        landingThemeDetailsContainer.style.display = 'flex';

        if (!leftPanel.contains(landingThemeDescriptionContainer)) {
            leftPanel.appendChild(landingThemeDescriptionContainer);
        }
        if (!rightPanel.contains(landingThemeDetailsContainer)) {
            rightPanel.appendChild(landingThemeDetailsContainer);
        }

        const descTitle = landingThemeDescriptionContainer.querySelector('.panel-box-title');
        if (descTitle) descTitle.textContent = getUIText('landing_theme_description_title');
        landingThemeLoreText.textContent = getUIText('landing_select_theme_prompt_lore');

        const detailsTitle = landingThemeDetailsContainer.querySelector('.panel-box-title');
        if (detailsTitle) detailsTitle.textContent = getUIText('landing_theme_info_title');
        landingThemeInfoContent.innerHTML = `<p>${getUIText('landing_select_theme_prompt_details')}</p>`;
        landingThemeActions.style.display = 'none';
        landingThemeActions.innerHTML = '';

        // --- CRITICAL FIX: Add IDs to the .panel-box elements within landing containers if not already ---
        // Assuming your HTML for landing panels is:
        // <div id="landing-theme-description-container"> <div class="panel-box" id="landing-lore-panel"> ... </div> </div>
        // If the .panel-box doesn't have an ID, animatePanelBox won't find it.
        // Let's assume the container IDs ARE the box IDs for simplicity or assign them:
        const lorePanelBox = landingThemeDescriptionContainer.querySelector('.panel-box');
        if (lorePanelBox && !lorePanelBox.id) lorePanelBox.id = 'landing-lore-panel-box'; // Assign ID if missing
        const detailsPanelBox = landingThemeDetailsContainer.querySelector('.panel-box');
        if (detailsPanelBox && !detailsPanelBox.id) detailsPanelBox.id = 'landing-details-panel-box'; // Assign ID if missing

        // Expand them and add click listeners
        const lorePanelBoxInContainer = landingThemeDescriptionContainer.querySelector('.panel-box');
        if (lorePanelBoxInContainer) {
            if (!lorePanelBoxInContainer.id) lorePanelBoxInContainer.id = 'landing-lore-panel-box-generated';
            animatePanelBox(lorePanelBoxInContainer.id, true, false);
        }
        initializeSpecificPanelHeader(landingThemeDescriptionContainer); // Pass the container

        const detailsPanelBoxInContainer = landingThemeDetailsContainer.querySelector('.panel-box');
        if (detailsPanelBoxInContainer) {
            if (!detailsPanelBoxInContainer.id) detailsPanelBoxInContainer.id = 'landing-details-panel-box-generated';
            animatePanelBox(detailsPanelBoxInContainer.id, true, false);
        }
        initializeSpecificPanelHeader(landingThemeDetailsContainer); // Pass the containernelHeader(detailsPanelBox ? detailsPanelBox.id : landingThemeDetailsContainer.id);


        currentLandingGridSelection = localStorage.getItem(LANDING_SELECTED_GRID_THEME_KEY);
        renderThemeGrid();
        if (currentLandingGridSelection && ALL_THEMES_CONFIG[currentLandingGridSelection]) {
            updateLandingPagePanels(currentLandingGridSelection, false);
            const selectedBtn = themeGridContainer.querySelector(`.theme-grid-icon[data-theme="${currentLandingGridSelection}"]`);
            if (selectedBtn) selectedBtn.classList.add('active');
        }

        if (systemStatusIndicator) { systemStatusIndicator.textContent = getUIText('standby'); systemStatusIndicator.className = 'status-indicator status-warning'; }
        updateTopbarThemeIcons();
        setAppLanguageAndThemeUI(currentAppLanguage, DEFAULT_THEME_ID);
    }

    function switchToGameView(themeId) {
        document.body.classList.remove('landing-page-active');
        document.body.classList.remove(...Array.from(document.body.classList).filter(cn => cn.startsWith('theme-')));
        document.body.classList.add(`theme-${themeId}`);

        // Hide landing elements
        themeGridContainer.style.display = 'none';
        landingThemeDescriptionContainer.style.display = 'none';
        landingThemeDetailsContainer.style.display = 'none';

        // Show game elements (story log might be animated in later)
        storyLogViewport.style.display = 'block'; // Make it block first
        suggestedActionsWrapper.style.display = 'flex'; // Assuming flex display
        playerInputControlPanel.style.display = 'block'; // Or flex depending on its internal layout

        // Spawn animation for story log
        storyLogViewport.classList.remove('spawn-animation'); // Remove if present
        requestAnimationFrame(() => { // Ensure class is removed then re-added for animation
            storyLogViewport.style.opacity = '0'; // Start transparent for animation
            storyLogViewport.style.transform = 'translateY(20px) scale(0.98)';
            storyLogViewport.classList.add('spawn-animation');
        });

        // Name input or action input will be shown by changeThemeAndStart logic
        // Panels are generated by generatePanelsForTheme
    }

    function renderThemeGrid() {
        if (!themeGridContainer) return;
        themeGridContainer.innerHTML = '';
        Object.values(ALL_THEMES_CONFIG).forEach(theme => {
            const button = document.createElement('button');
            button.classList.add('theme-grid-icon');
            button.dataset.theme = theme.id;
            button.title = getUIText(theme.name_key);

            const img = document.createElement('img');
            img.src = theme.icon;
            img.alt = getUIText('theme_icon_alt_text_default', { THEME_NAME: getUIText(theme.name_key) }); // Placeholder

            const nameSpan = document.createElement('span');
            nameSpan.classList.add('theme-grid-icon-name');
            nameSpan.textContent = getUIText(theme.name_key);

            button.appendChild(img);
            button.appendChild(nameSpan);

            button.addEventListener('click', () => handleThemeGridIconClick(theme.id));
            themeGridContainer.appendChild(button);
        });
    }

    function handleThemeGridIconClick(themeId) {
        currentLandingGridSelection = themeId;
        localStorage.setItem(LANDING_SELECTED_GRID_THEME_KEY, themeId);

        // Update active state in grid
        themeGridContainer.querySelectorAll('.theme-grid-icon.active').forEach(btn => btn.classList.remove('active'));
        const clickedBtn = themeGridContainer.querySelector(`.theme-grid-icon[data-theme="${themeId}"]`);
        if (clickedBtn) clickedBtn.classList.add('active');

        updateLandingPagePanels(themeId, true); // Animate panel expansion if needed
    }

    function updateLandingPagePanels(themeId, animate = true) {
        const themeConfig = ALL_THEMES_CONFIG[themeId];
        if (!themeConfig) return;

        // Left Panel: Lore
        landingThemeLoreText.textContent = getUIText(themeConfig.lore_key);
        if (animate) animatePanelBox(landingThemeDescriptionContainer.id, true, false);


        // Right Panel: Details & Actions
        landingThemeInfoContent.innerHTML = `
            <p><strong data-lang-key="landing_theme_setting_label">${getUIText('landing_theme_setting_label')}:</strong> <span id="landing-selected-theme-setting">${getUIText(themeConfig.setting_key)}</span></p>
            <p><strong data-lang-key="landing_theme_details_label">${getUIText('landing_theme_details_label')}:</strong> <span id="landing-selected-theme-details-text">${getUIText(themeConfig.details_key)}</span></p>
        `;

        renderLandingPageActionButtons(themeId);
        landingThemeActions.style.display = 'flex'; // Assuming flex for button layout
        if (animate) animatePanelBox(landingThemeDetailsContainer.id, true, false);
    }

    function renderLandingPageActionButtons(themeId) {
        landingThemeActions.innerHTML = '';

        const chooseButton = document.createElement('button');
        chooseButton.id = 'choose-theme-button';
        chooseButton.classList.add('ui-button', 'primary');
        chooseButton.textContent = getUIText('landing_choose_theme_button');
        chooseButton.addEventListener('click', () => handleChooseThisThemeClick(themeId));

        const likeButton = document.createElement('button');
        likeButton.id = 'like-theme-button';
        likeButton.classList.add('ui-button', 'icon-button', 'like-theme-button'); // Add specific class for styling heart
        const liked = isThemeLiked(themeId);
        likeButton.innerHTML = `<img src="${liked ? 'images/icon_heart_filled.svg' : 'images/icon_heart_empty.svg'}" alt="${liked ? getUIText('aria_label_unlike_theme') : getUIText('aria_label_like_theme')}" class="like-icon">`;
        likeButton.setAttribute('aria-label', liked ? getUIText('aria_label_unlike_theme') : getUIText('aria_label_like_theme'));
        likeButton.title = likeButton.getAttribute('aria-label');
        if (liked) likeButton.classList.add('liked');

        likeButton.addEventListener('click', () => handleLikeThemeClick(themeId, likeButton));

        landingThemeActions.appendChild(chooseButton);
        landingThemeActions.appendChild(likeButton);
    }

    function handleChooseThisThemeClick(themeId) {
        // This will effectively start the game with this theme
        changeThemeAndStart(themeId, false); // false = don't force new game, try to resume if possible
    }

    function handleLikeThemeClick(themeId, likeButtonElement) { // likeButtonElement is from landing page
        const themeConfig = ALL_THEMES_CONFIG[themeId];
        if (!themeConfig) return;

        if (isThemeLiked(themeId)) {
            // Unlike it. This will also remove it from the liked section in topbar.
            // If it was also playing, it remains playing but is no longer "liked" for future demotion.
            removeLikedTheme(themeId); // This function now correctly updates the button on landing page too
        } else {
            // Like it. Adds to likedThemes and updates topbar.
            addLikedTheme(themeId); // This function now correctly updates the button on landing page too
        }
        // updateTopbarThemeIcons() is called by addLikedTheme/removeLikedTheme
    }


    // --- Initialization ---
    async function initializeApp() {
        loadThemeListsFromStorage(); 

        currentTheme = localStorage.getItem(CURRENT_THEME_STORAGE_KEY) || null; 
        currentAppLanguage = localStorage.getItem(LANGUAGE_PREFERENCE_STORAGE_KEY) || DEFAULT_LANGUAGE;
        currentNarrativeLanguage = localStorage.getItem(NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY) || currentAppLanguage;
        currentModelName = localStorage.getItem(MODEL_PREFERENCE_STORAGE_KEY) || FREE_MODEL_NAME;
        
        updateModelToggleButtonText(); 
        
        if (!setupApiKey()) { 
            switchToLandingView();
            // Apply UI text after switching to landing view so elements are there
            setAppLanguageAndThemeUI(currentAppLanguage, DEFAULT_THEME_ID); 
            return; 
        }

        let gameToResume = null;
        let successfullyLoadedStateForResume = false; // Flag

        if (currentTheme && isThemePlaying(currentTheme)) { 
            const tempPlayerId = playerIdentifier;
            const tempGameHistory = gameHistory;
            playerIdentifier = ''; 
            gameHistory = [];

            // Prompts must be loaded before game state which might depend on them (e.g. initial prompts)
            if (await loadAllPromptsForTheme(currentTheme)) {
                if (loadGameState(currentTheme)) { // This populates gameHistory, playerIdentifier, lastKnownDashboardUpdates etc.
                    gameToResume = currentTheme;
                    successfullyLoadedStateForResume = true; 
                } else {
                    // Failed to load game state, prompts were ok
                    removePlayingTheme(currentTheme, false); 
                    currentTheme = null;
                    localStorage.removeItem(CURRENT_THEME_STORAGE_KEY);
                    playerIdentifier = tempPlayerId; // Restore if loadGameState failed
                    gameHistory = tempGameHistory;
                }
            } else {
                // Failed to load prompts for currentTheme
                removePlayingTheme(currentTheme, false); 
                currentTheme = null;
                localStorage.removeItem(CURRENT_THEME_STORAGE_KEY);
                playerIdentifier = tempPlayerId; // Restore
                gameHistory = tempGameHistory;
            }
        } else if (currentTheme) { 
            currentTheme = null;
            localStorage.removeItem(CURRENT_THEME_STORAGE_KEY);
        }

        if (gameToResume && successfullyLoadedStateForResume) {
            // --- This is the direct game resume path on page reload ---
            currentTheme = gameToResume; 
            
            switchToGameView(currentTheme); // Sets up basic view, hides landing, shows game containers
            
            // 1. Generate panel structure (critical that this happens before trying to populate them)
            generatePanelsForTheme(currentTheme);
            
            // 2. Set UI language and theme-specific static texts (panel titles, labels)
            setAppLanguageAndThemeUI(currentAppLanguage, currentTheme);
            
            // 3. Initialize default texts for panels (placeholders before actual data)
            initializeDashboardDefaultTexts(); // This uses playerIdentifier if already loaded by loadGameState
            
            // 4. CRITICAL: Apply the loaded game state to the newly created dashboard elements
            updateDashboard(lastKnownDashboardUpdates, false); // `false` means don't highlight on initial load
            handleGameStateIndicators(lastKnownGameStateIndicators, true); // `true` for initialBoot behavior for panels

            // 5. Make panels interactive
            initializeCollapsiblePanelBoxes(currentTheme);
            
            // 6. Final UI state adjustments for game view
            nameInputSection.style.display = 'none';
            actionInputSection.style.display = 'flex';
            if (playerActionInput && document.body.contains(playerActionInput)) { // Ensure it's in DOM
                 playerActionInput.focus();
            }
            
            // Messages and status (story log should be populated by loadGameState already)
            addMessageToLog(getUIText('system_session_resumed', { PLAYER_ID: playerIdentifier, THEME_NAME: getUIText(ALL_THEMES_CONFIG[currentTheme].name_key) }), 'system');
            if (systemStatusIndicator) { systemStatusIndicator.textContent = getUIText('system_status_online_short'); systemStatusIndicator.className = 'status-indicator status-ok'; }
            
            isInitialGameLoad = false; // Since we resumed a game
        } else {
            // No game to resume, or failed to resume -> Go to Landing Page
            switchToLandingView(); 
        }

        updateTopbarThemeIcons(); 
        if (playerActionInput) autoGrowTextarea(playerActionInput);
        // clearSuggestedActions(); // Cleared by switchToGameView or loadGameState or switchToLandingView as appropriate
    }

    // Event Listeners Setup
    if (applicationLogoElement) applicationLogoElement.addEventListener('click', switchToLandingView);
    if (languageToggleButton) languageToggleButton.addEventListener('click', toggleAppLanguage);
    if (newGameButton) newGameButton.addEventListener('click', startNewGameSession);
    if (modelToggleButton) modelToggleButton.addEventListener('click', toggleModelType);

    if (startGameButton) startGameButton.addEventListener('click', startGameAfterIdentifier);
    if (playerIdentifierInputEl) playerIdentifierInputEl.addEventListener('keypress', (e) => { if (e.key === 'Enter') startGameAfterIdentifier(); });

    if (sendActionButton) sendActionButton.addEventListener('click', sendPlayerAction);
    if (playerActionInput) {
        playerActionInput.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendPlayerAction(); } });
        playerActionInput.addEventListener('input', () => autoGrowTextarea(playerActionInput));
    }

    initializeApp();
});