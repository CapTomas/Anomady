document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration Constants & Global State ---
    let GEMINI_API_KEY = "";
    const DEFAULT_LANGUAGE = 'cs';
    const DEFAULT_THEME = 'scifi';
    const UPDATE_HIGHLIGHT_DURATION = 5000; // ms

    // Storage Keys
    const THEME_STORAGE_KEY = 'anomaliaCurrentTheme';
    const GAME_STATE_STORAGE_KEY_PREFIX = 'anomaliaGameState_';
    const MODEL_PREFERENCE_STORAGE_KEY = 'anomaliaModelPreference';
    const LANGUAGE_PREFERENCE_STORAGE_KEY = 'preferredAppLanguage';
    const NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY = 'preferredNarrativeLanguage';

    // AI Model Configuration
    const PAID_MODEL_NAME = "gemini-1.5-flash-latest";
    const FREE_MODEL_NAME = "gemini-1.5-flash-latest";
    let currentModelName = localStorage.getItem(MODEL_PREFERENCE_STORAGE_KEY) || FREE_MODEL_NAME;

    // Application State Variables
    let currentTheme = localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME;
    let currentAppLanguage = localStorage.getItem(LANGUAGE_PREFERENCE_STORAGE_KEY) || DEFAULT_LANGUAGE;
    let currentNarrativeLanguage = localStorage.getItem(NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY) || currentAppLanguage;
    let gamePrompts = {};
    let currentPromptType = 'initial';
    let gameHistory = [];
    let playerIdentifier = '';
    let isInitialGameLoad = true;
    let lastKnownDashboardUpdates = {};
    let lastKnownGameStateIndicators = {};

    // Prompt File URLs by Theme
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

    // UI Element References
    // ... (UI element references remain the same)
    const applicationLogoElement = document.getElementById('application-logo');
    const themeSelectorElement = document.getElementById('theme-selector');
    const systemStatusIndicator = document.getElementById('system-status-indicator');
    const gmSpecificActivityIndicator = document.getElementById('gm-activity-indicator');
    const languageToggleButton = document.getElementById('language-toggle-button');
    const newGameButton = document.getElementById('new-game-button');
    const modelToggleButton = document.getElementById('model-toggle-button');
    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('right-panel');
    const storyLog = document.getElementById('story-log');
    const storyLogViewport = document.getElementById('story-log-viewport');
    const suggestedActionsWrapper = document.getElementById('suggested-actions-wrapper');
    const nameInputSection = document.getElementById('name-input-section');
    const playerIdentifierInputEl = document.getElementById('player-identifier-input');
    const startGameButton = document.getElementById('start-game-button');
    const actionInputSection = document.getElementById('action-input-section');
    const playerActionInput = document.getElementById('player-action-input');
    const sendActionButton = document.getElementById('send-action-button');

    // THEME_DASHBOARD_CONFIGS is now in theme-dashboard-configs.js
    // uiTextData is now in ui-text-data.js
    // NARRATIVE_LANG_PROMPT_PARTS_BY_THEME is now in ui-text-data.js

    // --- Core Utility Functions ---
    // ... (getUIText, setupApiKey, saveGameState, loadGameState, clearGameStateInternal, clearGameState, fetchPrompt, loadAllPromptsForTheme, getSystemPrompt remain the same)
    function getUIText(key, replacements = {}) {
        let text = uiTextData[currentTheme]?.[currentAppLanguage]?.[key] ||
                   uiTextData[currentTheme]?.en?.[key] ||
                   uiTextData[DEFAULT_THEME]?.[currentAppLanguage]?.[key] ||
                   uiTextData[DEFAULT_THEME]?.en?.[key] ||
                   key;
        for (const placeholder in replacements) {
            text = text.replace(new RegExp(`{${placeholder}}`, 'g'), replacements[placeholder]);
        }
        return text;
    }

    function setupApiKey() {
        GEMINI_API_KEY = localStorage.getItem('userGeminiApiKey');
        if (!GEMINI_API_KEY) {
            GEMINI_API_KEY = prompt(getUIText('prompt_enter_api_key', {"DEFAULT_VALUE": ""}), "");
            if (GEMINI_API_KEY && GEMINI_API_KEY.trim() !== "") {
                localStorage.setItem('userGeminiApiKey', GEMINI_API_KEY);
            } else {
                GEMINI_API_KEY = "";
                alert(getUIText('alert_api_key_required'));
            }
        }
        if (!GEMINI_API_KEY) {
            addMessageToLog(getUIText('error_critical_no_api_key'), 'system');
            if (systemStatusIndicator) {
                systemStatusIndicator.textContent = getUIText('status_error');
                systemStatusIndicator.className = 'status-indicator status-danger';
            }
            [startGameButton, playerIdentifierInputEl, playerActionInput, sendActionButton].forEach(el => {
                if (el) el.disabled = true;
            });
            return false;
        }
        return true;
    }

    function saveGameState() {
        if (!playerIdentifier) return;
        const gameStateKey = GAME_STATE_STORAGE_KEY_PREFIX + currentTheme;
        const gameState = {
            playerIdentifier: playerIdentifier, gameHistory: gameHistory,
            lastDashboardUpdates: lastKnownDashboardUpdates, lastGameStateIndicators: lastKnownGameStateIndicators,
            currentPromptType: currentPromptType, currentNarrativeLanguage: currentNarrativeLanguage,
        };
        try { localStorage.setItem(gameStateKey, JSON.stringify(gameState)); }
        catch (e) { addMessageToLog(getUIText('error_saving_progress'), 'system-error'); }
    }

    function loadGameState() {
        const gameStateKey = GAME_STATE_STORAGE_KEY_PREFIX + currentTheme;
        try {
            const savedStateString = localStorage.getItem(gameStateKey);
            if (!savedStateString) return false;
            const savedState = JSON.parse(savedStateString);
            if (!savedState.playerIdentifier || !savedState.gameHistory || savedState.gameHistory.length === 0) {
                clearGameStateInternal(); return false;
            }
            playerIdentifier = savedState.playerIdentifier; gameHistory = savedState.gameHistory;
            lastKnownDashboardUpdates = savedState.lastDashboardUpdates || {};
            lastKnownGameStateIndicators = savedState.lastGameStateIndicators || {};
            currentPromptType = savedState.currentPromptType || 'default';
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
            const playerIdentifierConfigKey = currentTheme === 'scifi' ? 'callsign' : 'character_name';
            const playerIdentifierConfig = findItemConfigById(THEME_DASHBOARD_CONFIGS[currentTheme], playerIdentifierConfigKey);
            if (playerIdentifierConfig) {
                const el = document.getElementById(`info-${playerIdentifierConfig.id}`);
                if (el) el.textContent = playerIdentifier;
            }
            isInitialGameLoad = false; return true;
        } catch (e) {
            clearGameStateInternal(); localStorage.removeItem(gameStateKey); return false;
        }
    }

    function clearGameStateInternal() {
        gameHistory = []; playerIdentifier = ''; currentPromptType = 'initial';
        isInitialGameLoad = true; lastKnownDashboardUpdates = {}; lastKnownGameStateIndicators = {};
        if (storyLog) storyLog.innerHTML = ''; clearSuggestedActions();
    }

    function clearGameState() {
        localStorage.removeItem(GAME_STATE_STORAGE_KEY_PREFIX + currentTheme);
        clearGameStateInternal();
    }

    async function fetchPrompt(promptName, theme) {
        const themePrompts = PROMPT_URLS_BY_THEME[theme];
        if (!themePrompts || !themePrompts[promptName]) return `Error: Prompt "${promptName}" for theme "${theme}" not found.`;
        try {
            const response = await fetch(themePrompts[promptName]);
            if (!response.ok) throw new Error(`Prompt ${theme}/${promptName}: ${response.statusText}`);
            return await response.text();
        } catch (error) {
            addMessageToLog(getUIText('error_load_prompt_file', { THEME: theme, PROMPT_NAME: promptName }), 'system');
            return `Error: Prompt "${theme}/${promptName}" load failed. ${error.message}`;
        }
    }

    async function loadAllPromptsForTheme(theme) {
        if (!PROMPT_URLS_BY_THEME[theme]) {
            addMessageToLog(getUIText('error_no_prompts_for_theme', { THEME: theme }), 'system'); return false;
        }
        if (!gamePrompts[theme]) gamePrompts[theme] = {};
        const promptNames = Object.keys(PROMPT_URLS_BY_THEME[theme]);
        const loadingPromises = promptNames.map(name => fetchPrompt(name, theme).then(text => gamePrompts[theme][name] = text));
        try {
            await Promise.all(loadingPromises);
            for (const name of promptNames) if (gamePrompts[theme][name]?.startsWith("Error:")) throw new Error(`Load fail: ${theme}/${name}`);
            return true;
        } catch (error) {
            if (systemStatusIndicator) { systemStatusIndicator.textContent = getUIText('status_error'); systemStatusIndicator.className = 'status-indicator status-danger'; }
            [startGameButton, playerIdentifierInputEl].forEach(el => { if (el) el.disabled = true; });
            return false;
        }
    }

    const getSystemPrompt = (currentPlayerIdentifierParam, promptTypeToUse) => {
        const narrativeLangInstruction = NARRATIVE_LANG_PROMPT_PARTS_BY_THEME[currentTheme]?.[currentNarrativeLanguage] || NARRATIVE_LANG_PROMPT_PARTS_BY_THEME[DEFAULT_THEME]?.[DEFAULT_LANGUAGE];
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
                ['startIdea1', 'startIdea2', 'startIdea3'].forEach((ph, i) => basePromptText = basePromptText.replace(new RegExp(`\\$\\{${ph}\\}`, 'g'), selStarts[i] || `Generic ${currentTheme} scenario ${i+1}`));
            }
            let assetNamesContent = null;
            const assetKey = currentTheme === 'scifi' ? `asset_names_${currentNarrativeLanguage}` : `entity_names_${currentNarrativeLanguage}`;
            const fallbackAssetKey = currentTheme === 'scifi' ? 'asset_names_en' : 'entity_names_en';
            if (gamePrompts[currentTheme][assetKey]) assetNamesContent = gamePrompts[currentTheme][assetKey];
            else if (gamePrompts[currentTheme][fallbackAssetKey]) assetNamesContent = gamePrompts[currentTheme][fallbackAssetKey];
            if (assetNamesContent) {
                const allAssets = assetNamesContent.split('\n').map(n => n.trim()).filter(n => n.length > 0);
                const selAssets = allAssets.length > 0 ? [...allAssets].sort(() => 0.5 - Math.random()).slice(0, 3) : [];
                ['suggestedName1', 'suggestedName2', 'suggestedName3'].forEach((ph, i) => basePromptText = basePromptText.replace(new RegExp(`\\$\\{${ph}\\}`, 'g'), selAssets[i] || `DefaultName${i+1}`));
                ['suggestedShipName1', 'suggestedShipName2', 'suggestedShipName3'].forEach((ph, i) => basePromptText = basePromptText.replace(new RegExp(`\\$\\{${ph}\\}`, 'g'), selAssets[i] || `DefaultAssetName${i+1}`));
            } else {
                ['suggestedName1', 'suggestedName2', 'suggestedName3'].forEach((ph, i) => basePromptText = basePromptText.replace(new RegExp(`\\$\\{${ph}\\}`, 'g'), `InventedName${i+1}`));
                ['suggestedShipName1', 'suggestedShipName2', 'suggestedShipName3'].forEach((ph, i) => basePromptText = basePromptText.replace(new RegExp(`\\$\\{${ph}\\}`, 'g'), `InventedAssetName${i+1}`));
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
        if (!isProcessing && actionInputSection?.style.display !== 'none' && playerActionInput) playerActionInput.focus();
    }

    function highlightElementUpdate(element) {
        if (!element) return;
        const target = element.closest('.info-item, .info-item-meter');
        if (target) { target.classList.add('value-updated'); setTimeout(() => target.classList.remove('value-updated'), UPDATE_HIGHLIGHT_DURATION); }
    }

    function addMessageToLog(text, sender) {
        if (!storyLog) return;
        if (sender === 'player' && gameHistory.length > 0 && gameHistory[0].role === 'user' && text === gameHistory[0].parts[0].text && text.startsWith(`My identifier is`)) return;
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message', `${sender}-message`);
        text = text.replace(/_([^_]+)_|\*([^*]+)\*/g, (m, p1, p2) => `<em>${p1 || p2}</em>`);
        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim() !== '');
        if (paragraphs.length === 0 && text.trim() !== '') paragraphs.push(text.trim());
        paragraphs.forEach(para => { const p = document.createElement('p'); p.innerHTML = para.replace(/\n/g, '<br>'); msgDiv.appendChild(p); });
        storyLog.appendChild(msgDiv);
        if (storyLog.parentElement) storyLog.parentElement.scrollTop = storyLog.parentElement.scrollHeight;
    }

    function displaySuggestedActions(actions) {
        if (!suggestedActionsWrapper) return;
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

    // MODIFIED: setMeter now returns true if an update occurred, false otherwise.
    const setMeter = (barEl, textEl, newPctStr, meterType, opts = {}) => {
        const { highlight = true, newStatusText, initialPlaceholder } = opts;
        let updatedOccurred = false; // Track if any change happens

        if (!barEl) {
            if (textEl && newPctStr !== undefined && newPctStr !== null) {
                const na = getUIText('not_available_short'), unk = getUIText('unknown');
                const newContent = (newPctStr === "---" || newPctStr === na || String(newPctStr).toLowerCase() === unk.toLowerCase()) ? newPctStr : `${parseInt(newPctStr,10)}%`;
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
                    if (textEl.textContent !== newPctStr) { textEl.textContent = newPctStr; updatedOccurred = true;}
                    if (barEl.style.width !== '0%') { barEl.style.width = '0%'; updatedOccurred = true;}
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

    // NEW HELPER FUNCTION
    // Finds the configuration of the parent panel for a given item ID.
    function getParentPanelConfig(itemId) {
        const themeConfig = THEME_DASHBOARD_CONFIGS[currentTheme];
        if (!themeConfig) return null;

        for (const panelSideKey of ['left_panel', 'right_panel']) {
            if (themeConfig[panelSideKey]) {
                for (const panelConfig of themeConfig[panelSideKey]) {
                    if (panelConfig.items && panelConfig.items.some(item => item.id === itemId)) {
                        return panelConfig;
                    }
                }
            }
        }
        return null;
    }

    // MODIFIED: updateDashboard to auto-expand parent panel on update.
    function updateDashboard(updatesFromAI, highlightChanges = true) {
        if (!updatesFromAI || Object.keys(updatesFromAI).length === 0) return;
        const themeCfg = THEME_DASHBOARD_CONFIGS[currentTheme]; if (!themeCfg) return;
        
        const allItems = [...themeCfg.left_panel.flatMap(b => b.items), ...themeCfg.right_panel.flatMap(b => b.items)];
        const itemCfgsMap = new Map(allItems.map(i => [i.id, i]));

        for (const key in updatesFromAI) { // 'key' is the itemId
            if (Object.prototype.hasOwnProperty.call(updatesFromAI, key)) {
                const val = updatesFromAI[key]; 
                let itemCfg = itemCfgsMap.get(key);
                let actualUpdateOccurred = false;

                if (!itemCfg && key === 'callsign' && currentTheme === 'fantasy') { 
                    itemCfg = itemCfgsMap.get('character_name'); 
                    if (itemCfg) playerIdentifier = val; // Direct update, may not trigger panel open unless 'character_name' also updated
                }
                if (!itemCfg) continue;
                
                if (key === 'callsign' || key === 'character_name') playerIdentifier = val;
                
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
                        // Determine statusClass based on item ID and value
                        if (itemCfg.id === 'alertLevel') { 
                            if (lowVal.includes('red')) statClass = 'status-danger'; 
                            else if (lowVal.includes('yellow')) statClass = 'status-warning'; 
                            else if (lowVal.includes('green')) statClass = 'status-ok'; 
                        } else if (itemCfg.id === 'alert_level') { 
                            if (lowVal.includes(getUIText('alert_level_danger_val').toLowerCase())) statClass = 'status-danger'; 
                            else if (lowVal.includes(getUIText('alert_level_wary_val').toLowerCase())) statClass = 'status-warning'; 
                            else if (lowVal.includes(getUIText('alert_level_calm_val').toLowerCase())) statClass = 'status-ok';
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

                // If an update occurred, check if the parent panel needs to be expanded
                if (actualUpdateOccurred) {
                    const parentPanelConfig = getParentPanelConfig(key); // key is itemId
                    if (parentPanelConfig && parentPanelConfig.type === 'collapsible') {
                        const panelElement = document.getElementById(parentPanelConfig.id);
                        if (panelElement && !panelElement.classList.contains('is-expanded')) {
                            animatePanelBox(parentPanelConfig.id, true, false); // Expand, don't manage visibility here
                        }
                    }
                }
            }
        }
        lastKnownDashboardUpdates = {...lastKnownDashboardUpdates, ...updatesFromAI};
    }

    // ... (initializeDashboardDefaultTexts, findItemConfigById, autoGrowTextarea remain the same)
    // ... (animatePanelBox, initializeCollapsiblePanelBoxes remain the same)
    // ... (updateModelToggleButtonText, updateThemeSelectorActiveState remain the same)
    function initializeDashboardDefaultTexts() {
        const themeCfg = THEME_DASHBOARD_CONFIGS[currentTheme]; if (!themeCfg) return;
        ['left_panel', 'right_panel'].forEach(sideKey => {
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
                            if (itemCfg.id === 'alertLevel') { if (lowVal.includes('red')) statClass = 'status-danger'; else if (lowVal.includes('yellow')) statClass = 'status-warning'; else if (lowVal.includes('green')) statClass = 'status-ok'; }
                            else if (itemCfg.id === 'alert_level') { if (lowVal.includes(getUIText('alert_level_danger_val').toLowerCase())) statClass = 'status-danger'; else if (lowVal.includes(getUIText('alert_level_wary_val').toLowerCase())) statClass = 'status-warning'; else if (lowVal.includes(getUIText('alert_level_calm_val').toLowerCase())) statClass = 'status-ok'; }
                            valEl.className = `value ${statClass}`;
                        }
                    } else { if (valEl) { const suffix = itemCfg.suffix || ''; valEl.textContent = `${defVal}${suffix}`; } }
                });
            });
        });
        if (isInitialGameLoad || !playerIdentifier) {
            const idKey = currentTheme === 'scifi' ? 'callsign' : 'character_name';
            const idCfg = findItemConfigById(themeCfg, idKey);
            if (idCfg) { const el = document.getElementById(`info-${idCfg.id}`); if (el) el.textContent = getUIText(idCfg.default_value_key); }
        }
    }

    function findItemConfigById(themeDashCfg, itemId) {
        if (!themeDashCfg) return null;
        for (const sideKey of ['left_panel', 'right_panel']) {
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
        if (shouldExpand) {
            if (box.style.display === 'none') { box.style.opacity = '0'; box.style.display = 'block'; }
            requestAnimationFrame(() => { box.classList.add('is-expanded'); box.style.opacity = '1'; header.setAttribute('aria-expanded', 'true'); content.setAttribute('aria-hidden', 'false'); });
        } else {
            box.classList.remove('is-expanded'); header.setAttribute('aria-expanded', 'false'); content.setAttribute('aria-hidden', 'true');
            if (manageVisibility) {
                box.style.opacity = '0';
                const hideEnd = (ev) => {
                    if (ev.target === content || ev.target === box) { if (!box.classList.contains('is-expanded')) box.style.display = 'none'; content.removeEventListener('transitionend', hideEnd); box.removeEventListener('transitionend', hideEnd); }
                };
                content.addEventListener('transitionend', hideEnd); box.addEventListener('transitionend', hideEnd);
                setTimeout(() => { if (!box.classList.contains('is-expanded')) box.style.display = 'none'; }, parseFloat(getComputedStyle(content).transitionDuration.replace('s',''))*1000 + 50);
            }
        }
    }

    function initializeCollapsiblePanelBoxes() {
        const themeCfg = THEME_DASHBOARD_CONFIGS[currentTheme]; if (!themeCfg) return;
        const allCfgs = [...themeCfg.left_panel, ...themeCfg.right_panel];
        allCfgs.forEach(boxCfg => {
            const box = document.getElementById(boxCfg.id); if (!box) return;
            const header = box.querySelector('.panel-box-header'); 
            if (!header) return;
            if (boxCfg.type === 'collapsible' || boxCfg.type === 'hidden_until_active') {
                header.addEventListener('click', () => { if (box.style.display !== 'none') animatePanelBox(boxCfg.id, !box.classList.contains('is-expanded')); });
                header.setAttribute('tabindex', '0');
                header.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && box.style.display !== 'none') { e.preventDefault(); animatePanelBox(boxCfg.id, !box.classList.contains('is-expanded')); } });
            }
            if (boxCfg.type === 'static') { animatePanelBox(boxCfg.id, true, false); box.style.display = 'block'; box.style.opacity = '1'; }
            else if (boxCfg.type === 'hidden_until_active') { box.style.display = 'none'; box.style.opacity = '0'; animatePanelBox(boxCfg.id, false); }
            else { box.style.display = 'block'; box.style.opacity = '1'; const delay = boxCfg.boot_delay || 0; setTimeout(() => animatePanelBox(boxCfg.id, boxCfg.initial_expanded || false), delay); }
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
    
    function updateThemeSelectorActiveState() {
        if (!themeSelectorElement) return;
        themeSelectorElement.querySelectorAll('.theme-button').forEach(btn => btn.classList.toggle('active', btn.dataset.theme === currentTheme));
    }


    // --- Application Flow & Game Logic Functions ---
    // ... (toggleModelType, setAppLanguageAndTheme, toggleAppLanguage, handleGameStateIndicators remain the same)
    // ... (callGeminiAPI, startGameAfterIdentifier, sendPlayerAction, startNewGameSession remain the same)
    // ... (generatePanelsForTheme, changeTheme, initializeApp, and Event Listeners remain the same)

    function toggleModelType() {
        currentModelName = (currentModelName === PAID_MODEL_NAME) ? FREE_MODEL_NAME : PAID_MODEL_NAME;
        localStorage.setItem(MODEL_PREFERENCE_STORAGE_KEY, currentModelName);
        updateModelToggleButtonText();
        const msgKey = (currentModelName === PAID_MODEL_NAME) ? "system_model_set_paid" : "system_model_set_free";
        addMessageToLog(getUIText(msgKey, { MODEL_NAME: currentModelName }), 'system');
    }

    function setAppLanguageAndTheme(lang, theme) {
        currentAppLanguage = lang; localStorage.setItem(LANGUAGE_PREFERENCE_STORAGE_KEY, lang);
        if (document.documentElement) document.documentElement.lang = lang;
        document.body.className = ''; document.body.classList.add(`theme-${theme}`);
        if (languageToggleButton) {
            const otherLang = lang === 'en' ? 'cs' : 'en';
            languageToggleButton.textContent = uiTextData[theme]?.[otherLang]?.toggle_language || (otherLang === 'cs' ? 'Česky' : 'English');
            const ariaToggleKey = `aria_label_toggle_language`;
            const toggleAria = uiTextData[theme]?.[otherLang]?.[ariaToggleKey] || `Switch to ${otherLang}`;
            languageToggleButton.setAttribute('aria-label', toggleAria); languageToggleButton.title = toggleAria;
        }
        if (newGameButton) { newGameButton.textContent = getUIText('button_new_game'); newGameButton.title = getUIText('aria_label_new_game'); newGameButton.setAttribute('aria-label', getUIText('aria_label_new_game')); }
        if (modelToggleButton) modelToggleButton.title = getUIText('aria_label_toggle_model_generic');
        if(systemStatusIndicator) systemStatusIndicator.textContent = getUIText(systemStatusIndicator.dataset.langKey || 'system_status_online_short');
        if(gmSpecificActivityIndicator) gmSpecificActivityIndicator.textContent = getUIText(gmSpecificActivityIndicator.dataset.langKey || 'system_processing_short');
        const themeCfg = THEME_DASHBOARD_CONFIGS[theme];
        if (themeCfg) {
            ['left_panel', 'right_panel'].forEach(sideKey => {
                themeCfg[sideKey].forEach(boxCfg => {
                    const titleEl = document.querySelector(`#${boxCfg.id} .panel-box-title`); 
                    if (titleEl) titleEl.textContent = getUIText(boxCfg.title_key);
                    boxCfg.items.forEach(itemCfg => {
                        const labelEl = document.querySelector(`#info-item-container-${itemCfg.id} .label`);
                        if (labelEl) labelEl.textContent = getUIText(itemCfg.label_key);
                    });
                });
            });
        }
        if (playerIdentifierInputEl) playerIdentifierInputEl.placeholder = getUIText('placeholder_callsign_login');
        if (startGameButton) startGameButton.textContent = getUIText('button_access_systems');
        if (playerActionInput) playerActionInput.placeholder = getUIText('placeholder_command');
        if (sendActionButton) sendActionButton.textContent = getUIText('button_execute_command');
        initializeDashboardDefaultTexts(); updateModelToggleButtonText();
    }

    function toggleAppLanguage() {
        const newLang = currentAppLanguage === 'en' ? 'cs' : 'en';
        currentNarrativeLanguage = newLang; localStorage.setItem(NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY, newLang);
        setAppLanguageAndTheme(newLang, currentTheme);
        addMessageToLog(getUIText(newLang === 'en' ? "system_lang_set_en" : "system_lang_set_cs"), 'system');
        saveGameState();
    }

    function handleGameStateIndicators(indicators, isInitialBoot = false) {
        if (!indicators || !THEME_DASHBOARD_CONFIGS[currentTheme]) return;
        lastKnownGameStateIndicators = {...lastKnownGameStateIndicators, ...indicators};
        const themePanels = [...THEME_DASHBOARD_CONFIGS[currentTheme].left_panel, ...THEME_DASHBOARD_CONFIGS[currentTheme].right_panel];
        themePanels.forEach(boxCfg => {
            if (boxCfg.type === 'hidden_until_active' && boxCfg.indicator_key) {
                const boxEl = document.getElementById(boxCfg.id); if (!boxEl) return;
                const shouldShow = indicators[boxCfg.indicator_key] === true;
                const isShowing = boxEl.style.display !== 'none' && boxEl.style.opacity !== '0';
                if (shouldShow && !isShowing) { const delay = isInitialBoot && boxCfg.boot_delay ? boxCfg.boot_delay : 0; setTimeout(() => animatePanelBox(boxCfg.id, true, true), delay); }
                else if (!shouldShow && isShowing) animatePanelBox(boxCfg.id, false, true);
            }
        });
        if (indicators.combat_engaged === true && currentPromptType !== 'combat') currentPromptType = 'combat';
        else if (indicators.combat_engaged === false && currentPromptType === 'combat') currentPromptType = 'default';
    }

    async function callGeminiAPI(currentTurnHistory) {
        if (!GEMINI_API_KEY) {
            addMessageToLog(getUIText('error_critical_no_api_key'), 'system');
            if (systemStatusIndicator) { systemStatusIndicator.textContent = getUIText('status_error'); systemStatusIndicator.className = 'status-indicator status-danger'; }
            setGMActivity(false); return null;
        }
        setGMActivity(true); clearSuggestedActions();
        const activePType = (isInitialGameLoad || (currentTurnHistory.length === 1 && gameHistory[0].role === 'user')) ? 'initial' : currentPromptType;
        const sysPrompt = getSystemPrompt(playerIdentifier, activePType);
        if (sysPrompt.startsWith('{"narrative": "SYSTEM ERROR:')) {
            try { const errResp = JSON.parse(sysPrompt); addMessageToLog(errResp.narrative, 'system'); if (errResp.suggested_actions) displaySuggestedActions(errResp.suggested_actions); } catch (e) {}
            setGMActivity(false); return null;
        }
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${currentModelName}:generateContent?key=${GEMINI_API_KEY}`;
        let genCfg = { temperature: 0.7, topP: 0.95, maxOutputTokens: 8192, responseMimeType: "application/json" };
        let payload = { contents: currentTurnHistory, generationConfig: genCfg, safetySettings: [ { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }], systemInstruction: { parts: [{ text: sysPrompt }] } };
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
                    if (isInitialGameLoad) isInitialGameLoad = false; saveGameState();
                    if (systemStatusIndicator) { systemStatusIndicator.textContent = getUIText('system_status_online_short'); systemStatusIndicator.className = 'status-indicator status-ok'; }
                    return parsed.narrative;
                } catch (e) { throw new Error(`Invalid JSON from AI: ${e.message}. String: ${jsonStr.substring(0,500)}...`); }
            } else if (respData.promptFeedback?.blockReason) { const blockDet = respData.promptFeedback.safetyRatings?.map(r => `${r.category}: ${r.probability}`).join(', ') || "No details."; throw new Error(`Content blocked: ${respData.promptFeedback.blockReason}. Ratings: ${blockDet}`);
            } else throw new Error("No valid candidate/text in AI response.");
        } catch (error) {
            addMessageToLog(getUIText('error_api_call_failed', { ERROR_MSG: error.message }), 'system');
            if (systemStatusIndicator) { systemStatusIndicator.textContent = getUIText('status_error'); systemStatusIndicator.className = 'status-indicator status-danger'; }
            return null;
        } finally { setGMActivity(false); }
    }

    async function startGameAfterIdentifier() {
        const enteredId = playerIdentifierInputEl ? playerIdentifierInputEl.value.trim() : "";
        if (!enteredId) { alert(getUIText('alert_identifier_required')); if (playerIdentifierInputEl) playerIdentifierInputEl.focus(); return; }
        playerIdentifier = enteredId; isInitialGameLoad = true; currentPromptType = 'initial';
        document.body.classList.remove('initial-state');
        if (nameInputSection) nameInputSection.style.display = 'none';
        if (actionInputSection) actionInputSection.style.display = 'flex';
        if (storyLogViewport) storyLogViewport.classList.add('spawn-animation');
        if (playerActionInput) { playerActionInput.value = ''; playerActionInput.dispatchEvent(new Event('input', { bubbles: true })); autoGrowTextarea(playerActionInput); }
        const idKey = currentTheme === 'scifi' ? 'callsign' : 'character_name';
        updateDashboard({ [idKey]: playerIdentifier }, false); 
        addMessageToLog(getUIText('connecting', { PLAYER_ID: playerIdentifier }), 'system');
        gameHistory = [{ role: "user", parts: [{ text: `My identifier is ${playerIdentifier}. I am ready to start the game in ${currentTheme} theme.` }] }];
        clearSuggestedActions();
        const narrative = await callGeminiAPI(gameHistory);
        if (narrative) addMessageToLog(narrative, 'gm');
        else {
            document.body.classList.add('initial-state'); if (nameInputSection) nameInputSection.style.display = 'flex';
            if (actionInputSection) actionInputSection.style.display = 'none'; if (storyLogViewport) storyLogViewport.classList.remove('spawn-animation');
            addMessageToLog(getUIText('error_session_init_failed'), 'system');
        }
    }

    async function sendPlayerAction() {
        const action = playerActionInput ? playerActionInput.value.trim() : "";
        if (!action) { if (playerActionInput) playerActionInput.focus(); return; }
        addMessageToLog(action, 'player');
        if (playerActionInput) { playerActionInput.value = ''; playerActionInput.dispatchEvent(new Event('input', { bubbles: true })); autoGrowTextarea(playerActionInput); }
        clearSuggestedActions(); gameHistory.push({ role: "user", parts: [{ text: action }] });
        const narrative = await callGeminiAPI(gameHistory);
        if (narrative) addMessageToLog(narrative, 'gm');
    }

    function startNewGameSession() {
        const confirmKey = `confirm_new_game_theme_${currentTheme}`;
        const themeName = getUIText(`theme_name`);
        const confirmMsg = getUIText(confirmKey, { THEME_NAME: themeName }) || getUIText('confirm_new_game');
        if (confirm(confirmMsg)) { addMessageToLog(getUIText('system_new_game_initiated', { THEME_NAME: themeName }), 'system'); changeTheme(currentTheme, true); }
    }
    
    function generatePanelsForTheme(themeName) {
        const config = THEME_DASHBOARD_CONFIGS[themeName]; if (!config || !leftPanel || !rightPanel) return;
        leftPanel.innerHTML = ''; rightPanel.innerHTML = '';
        const createSide = (sideContainer, panelConfigs) => {
            panelConfigs.forEach(panelConfig => {
                const panelBox = document.createElement('div'); panelBox.id = panelConfig.id;
                panelBox.classList.add('panel-box'); 
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
                        if (item.type === 'text_long') valSpan.classList.add('objective-text'); itemCont.appendChild(valSpan);
                    }
                    content.appendChild(itemCont);
                });
                panelBox.appendChild(content); sideContainer.appendChild(panelBox);
            });
        };
        createSide(leftPanel, config.left_panel); createSide(rightPanel, config.right_panel);
        initializeDashboardDefaultTexts(); initializeCollapsiblePanelBoxes();
    }

    async function changeTheme(newTheme, forceNewGame = false) {
        if (currentTheme === newTheme && !forceNewGame) return;
        const oldTheme = currentTheme; currentTheme = newTheme;
        localStorage.setItem(THEME_STORAGE_KEY, currentTheme); clearGameStateInternal(); 
        if (forceNewGame) localStorage.removeItem(GAME_STATE_STORAGE_KEY_PREFIX + newTheme);
        generatePanelsForTheme(currentTheme);
        const promptsOk = await loadAllPromptsForTheme(currentTheme);
        if (!promptsOk) { addMessageToLog(getUIText('error_load_prompts_critical', { THEME: currentTheme }), 'system-error'); if (startGameButton) startGameButton.disabled = true; return; }
        if (startGameButton) startGameButton.disabled = false;
        setAppLanguageAndTheme(currentAppLanguage, currentTheme); updateThemeSelectorActiveState();
        if (!forceNewGame && loadGameState()) {
            isInitialGameLoad = false; document.body.classList.remove('initial-state');
            if (nameInputSection) nameInputSection.style.display = 'none'; if (actionInputSection) actionInputSection.style.display = 'flex';
            if (storyLogViewport) { storyLogViewport.classList.remove('spawn-animation'); storyLogViewport.style.opacity = 1; storyLogViewport.style.transform = 'none'; }
            addMessageToLog(getUIText('system_session_resumed', { PLAYER_ID: playerIdentifier, THEME_NAME: getUIText('theme_name') }), 'system');
            if (playerActionInput) playerActionInput.focus();
            if (systemStatusIndicator) { systemStatusIndicator.textContent = getUIText('system_status_online_short'); systemStatusIndicator.className = 'status-indicator status-ok'; }
        } else {
            isInitialGameLoad = true; currentPromptType = 'initial'; document.body.classList.add('initial-state');
            if (nameInputSection) nameInputSection.style.display = 'flex'; if (actionInputSection) actionInputSection.style.display = 'none';
            if (storyLogViewport) { storyLogViewport.style.opacity = '0'; storyLogViewport.classList.remove('spawn-animation'); }
            if (playerIdentifierInputEl) playerIdentifierInputEl.focus();
            if (systemStatusIndicator) { systemStatusIndicator.textContent = getUIText('standby'); systemStatusIndicator.className = 'status-indicator status-warning'; }
            if (oldTheme !== newTheme) addMessageToLog(getUIText(`system_theme_set_${newTheme}`) || `System: Theme set to ${newTheme}.`, 'system');
            if (forceNewGame) addMessageToLog(getUIText('system_new_game_initiated', { THEME_NAME: getUIText('theme_name')}), 'system');
        }
        if (playerIdentifierInputEl) playerIdentifierInputEl.placeholder = getUIText('placeholder_callsign_login');
        if (startGameButton) startGameButton.textContent = getUIText('button_access_systems');
    }

    // --- Initialization ---
    async function initializeApp() {
        currentTheme = localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME;
        currentAppLanguage = localStorage.getItem(LANGUAGE_PREFERENCE_STORAGE_KEY) || DEFAULT_LANGUAGE;
        currentNarrativeLanguage = localStorage.getItem(NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY) || currentAppLanguage;
        currentModelName = localStorage.getItem(MODEL_PREFERENCE_STORAGE_KEY) || FREE_MODEL_NAME;
        generatePanelsForTheme(currentTheme); setAppLanguageAndTheme(currentAppLanguage, currentTheme); updateThemeSelectorActiveState();
        if (!setupApiKey()) { document.body.classList.add('initial-state'); if (nameInputSection) nameInputSection.style.display = 'flex'; if (actionInputSection) actionInputSection.style.display = 'none'; return; }
        if (!await loadAllPromptsForTheme(currentTheme)) {
            addMessageToLog(getUIText('error_load_prompts_critical', { THEME: currentTheme }), 'system-error');
            if (startGameButton) startGameButton.disabled = true; if (playerIdentifierInputEl) playerIdentifierInputEl.disabled = true;
            document.body.classList.remove('initial-state'); if (nameInputSection) nameInputSection.style.display = 'none'; if (actionInputSection) actionInputSection.style.display = 'none'; return;
        }
        if (loadGameState()) {
            document.body.classList.remove('initial-state'); if (nameInputSection) nameInputSection.style.display = 'none'; if (actionInputSection) actionInputSection.style.display = 'flex';
            if (storyLogViewport) { storyLogViewport.classList.remove('spawn-animation'); storyLogViewport.style.opacity = 1; storyLogViewport.style.transform = 'none'; }
            addMessageToLog(getUIText('system_session_resumed', { PLAYER_ID: playerIdentifier, THEME_NAME: getUIText('theme_name') }), 'system');
            if (playerActionInput) playerActionInput.focus();
            if (systemStatusIndicator) { systemStatusIndicator.textContent = getUIText('system_status_online_short'); systemStatusIndicator.className = 'status-indicator status-ok'; }
        } else {
            document.body.classList.add('initial-state'); if (nameInputSection) nameInputSection.style.display = 'flex'; if (actionInputSection) actionInputSection.style.display = 'none';
            if (playerIdentifierInputEl) playerIdentifierInputEl.focus();
            if (systemStatusIndicator) { systemStatusIndicator.textContent = getUIText('standby'); systemStatusIndicator.className = 'status-indicator status-warning'; }
        }
        if (playerActionInput) autoGrowTextarea(playerActionInput); clearSuggestedActions();
    }

    // Event Listeners Setup
    if (languageToggleButton) languageToggleButton.addEventListener('click', toggleAppLanguage);
    if (newGameButton) newGameButton.addEventListener('click', startNewGameSession);
    if (modelToggleButton) modelToggleButton.addEventListener('click', toggleModelType);
    if (themeSelectorElement) themeSelectorElement.addEventListener('click', (e) => { const btn = e.target.closest('.theme-button'); if (btn?.dataset.theme && btn.dataset.theme !== currentTheme) changeTheme(btn.dataset.theme, false); });
    if (startGameButton) startGameButton.addEventListener('click', startGameAfterIdentifier);
    if (playerIdentifierInputEl) playerIdentifierInputEl.addEventListener('keypress', (e) => { if (e.key === 'Enter') startGameAfterIdentifier(); });
    if (sendActionButton) sendActionButton.addEventListener('click', sendPlayerAction);
    if (playerActionInput) {
        playerActionInput.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendPlayerAction(); } });
        playerActionInput.addEventListener('input', () => autoGrowTextarea(playerActionInput));
    }
    initializeApp();
});