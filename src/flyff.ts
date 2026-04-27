import "bootstrap";
import "bootstrap/dist/css/bootstrap.css";

import Draggabilly from "draggabilly";
import * as html from "./ui/html";
import Input from "./utils/inputs";
import { timer } from "./utils/timer";
import { ImageDetection } from "./utils/imageDetection";
import { initDebugConsole, debugLog } from "./utils/debugConsole";

// Declare global chrome/browser APIs
declare const chrome: any;
declare const browser: any;

const canvas = <HTMLElement>html.get(`canvas`);

class App {
    private canvas = canvas;
    private canvas2D!: HTMLCanvasElement;
    private ctx2D!: CanvasRenderingContext2D;

    private input = new Input(canvas);
    private timer_counter = 0;
    private timer_key_counter = new Map();
    private key_counter = 0;
    private keyIntervals = new Map<number, number>();
    private timelineIntervals = new Map<number, number>();
    private isFocused = false;
    private monsterDetection = new ImageDetection();
    private lastAltBuffTime = 0;
    private partySkillIntervals = new Map<string, number>();
    private buffWarningTimeout: number | null = null;
    private buffWarningBlinkInterval: number | null = null;
    private buffWarningSoundInterval: number | null = null;
    private buffPressCounter: number = 0;
    private buffWarningEnabled: boolean = false;

    constructor() {
        const container = html.toElement(html.container)!;
        document.body.appendChild(container);
        new Draggabilly(<Element>container, {});

        initDebugConsole();
        (window as any).dnkLog = debugLog;
        debugLog('DNK Debug Console iniciada', 'success');

        let interval = -1;
        const follow = <HTMLInputElement>html.get(`#input_follow`);
        follow.addEventListener("change", (event: Event) => {
            const target = event.target as HTMLInputElement;
            const enabled = target.checked;
            if (!enabled) {
                clearInterval(interval);
                return (interval = -1);
            }

            interval = setInterval(() => {
                this.input.send({ cast: 100, key: "z" });
            }, 5000);
        });

        // Buff warning toggle
        const buffWarningCheckbox = <HTMLInputElement>html.get(`#input_buff_warning`);
        buffWarningCheckbox.addEventListener("change", (event: Event) => {
            const target = event.target as HTMLInputElement;
            this.buffWarningEnabled = target.checked;
            // Save state to localStorage
            localStorage.setItem('flyff_bot_buff_warning_enabled', JSON.stringify(this.buffWarningEnabled));
            
            // If disabling, clear any active warning
            if (!this.buffWarningEnabled) {
                this.clearBuffWarning();
            }
        });
        
        // Load buff warning state from localStorage
        const savedBuffWarningState = localStorage.getItem('flyff_bot_buff_warning_enabled');
        if (savedBuffWarningState !== null) {
            this.buffWarningEnabled = JSON.parse(savedBuffWarningState);
            buffWarningCheckbox.checked = this.buffWarningEnabled;
        }

        const button = <HTMLInputElement>html.get(`#cheats_add_timeline`);
        button.addEventListener("pointerdown", this.createTimer.bind(this));

        const button2 = <HTMLInputElement>html.get(`#cheats_add_key`);
        button2.addEventListener("pointerdown", this.createKey.bind(this));

        const buffsButton = <HTMLInputElement>html.get(`#cheats_open_buffs`);
        buffsButton.addEventListener("pointerdown", this.openBuffsModal.bind(this));

        const buffsModalClose = <HTMLInputElement>html.get(`#cheats_buffs_modal_close`);
        buffsModalClose.addEventListener("click", this.closeBuffsModal.bind(this));

        const buffsModal = <HTMLElement>html.get(`#cheats_buffs_modal`);
        buffsModal.addEventListener("click", (e: Event) => {
            if (e.target === buffsModal) {
                this.closeBuffsModal();
            }
        });

        const buffsSave = <HTMLInputElement>html.get(`#cheats_buffs_save`);
        buffsSave.addEventListener("click", this.saveBuffsConfig.bind(this));

        const partySkillsButton = <HTMLInputElement>html.get(`#cheats_open_party_skills`);
        partySkillsButton.addEventListener("pointerdown", this.openPartySkillsModal.bind(this));

        const partySkillsModalClose = <HTMLInputElement>html.get(`#cheats_party_skills_modal_close`);
        partySkillsModalClose.addEventListener("click", this.closePartySkillsModal.bind(this));

        const partySkillsModal = <HTMLElement>html.get(`#cheats_party_skills_modal`);
        partySkillsModal.addEventListener("click", (e: Event) => {
            if (e.target === partySkillsModal) {
                this.closePartySkillsModal();
            }
        });

        const partySkillsSave = <HTMLInputElement>html.get(`#cheats_party_skills_save`);
        partySkillsSave.addEventListener("click", this.savePartySkillsConfig.bind(this));

        const saveButton = <HTMLInputElement>html.get(`#cheats_save_settings`);
        saveButton.addEventListener("click", this.saveSettings.bind(this));

        const loadButton = <HTMLInputElement>html.get(`#cheats_load_settings`);
        loadButton.addEventListener("click", this.loadSettings.bind(this));

        const deleteButton = <HTMLInputElement>html.get(`#cheats_delete_settings`);
        deleteButton.addEventListener("click", this.deleteSettings.bind(this));

        const toggleAllButton = <HTMLInputElement>html.get(`#cheats_toggle_all`);
        toggleAllButton.addEventListener("pointerdown", this.toggleAll.bind(this));

        const minimizeButton = <HTMLInputElement>html.get(`#cheats_minimize`);
        minimizeButton.addEventListener("pointerdown", this.minimizeUI.bind(this));

        const maximizeButton = <HTMLInputElement>html.get(`#cheats_maximize`);
        maximizeButton.addEventListener("pointerdown", this.maximizeUI.bind(this));

        this.updateConfigList();

        // Load buffs configuration on startup
        this.loadBuffsConfig();

        // Load party skills configuration on startup
        this.loadPartySkillsConfig();

        container.addEventListener("pointerdown", () => {
            this.isFocused = true;
        });
        this.canvas.addEventListener("pointerdown", () => {
            if (!this.isFocused) return;

            this.isFocused = false;
            this.canvas.focus();
        });

        // Insert key combo trigger
        window.addEventListener("keydown", async (event: KeyboardEvent) => {
            // Close modals on Escape
            if (event.key === "Escape") {
                const buffsModal = <HTMLElement>html.get(`#cheats_buffs_modal`);
                if (buffsModal && buffsModal.style.display === 'flex') {
                    this.closeBuffsModal();
                    return;
                }
                const partySkillsModal = <HTMLElement>html.get(`#cheats_party_skills_modal`);
                if (partySkillsModal && partySkillsModal.style.display === 'flex') {
                    this.closePartySkillsModal();
                    return;
                }
            }

            if (this.isFocused) return; // Don't trigger if UI is focused

            // Check party skills hotkeys
            this.checkPartySkillHotkey(event);

            // Check buff activation key
            const buffConfig = this.getBuffsConfig();
            const activationKey = buffConfig.activationKey || '`';
            if (event.key === activationKey) {
                event.preventDefault();
                this.triggerBuffsWithPause();
            }
            if (event.key === "Tab") {
                event.preventDefault();
                // Press Tab key in game
                await this.input.send({ cast: 100, key: "Tab" });
                await timer(100);
                // Then press Z key
                await this.input.send({ cast: 100, key: "z" });
                await timer(100);
                // Then toggle all timers/keys
                this.toggleAll();
            }
            if (event.key === "Alt") {
                event.preventDefault();
                this.detectAndClickMonster();
            }
        });

        const target = <HTMLInputElement>html.get(`#cheats_target`);
        target.addEventListener("pointerdown", async () => {
            target.classList.remove("btn-primary");
            target.classList.add("btn-secondary");
            await this.searchTarget();
            target.classList.remove("btn-secondary");
            target.classList.add("btn-primary");
        });

        // Initialize maximize button color
        this.updateMaximizeButtonColor();

        this.create2DCanvas();
        
        // Load monster template image
        this.loadMonsterTemplate();
    }

    private createTimer() {
        const timer_counter_save = this.timer_counter++;

        const cheats_container = <HTMLElement>html.get(`#cheats_collapse`);
        const timer = html.toElement(html.collapseTimeline(timer_counter_save));
        cheats_container?.appendChild(timer);

        const button = <HTMLInputElement>(
            html.get(`#timeline_${timer_counter_save}_add`)
        );
        button.addEventListener(
            "pointerdown",
            this.createTimerKey.bind(this, timer_counter_save)
        );

        const button2 = <HTMLInputElement>(
            html.get(`#timeline_${timer_counter_save}_add_click`)
        );
        button2.addEventListener(
            "pointerdown",
            this.createClickKey.bind(this, timer_counter_save)
        );

        const removeButton = <HTMLInputElement>(
            html.get(`#timeline_${timer_counter_save}_remove`)
        );
        removeButton.addEventListener("click", function () {
            const parentElement = this.closest(`[id^="input_timeline_"]`);
            if (parentElement) {
                parentElement.remove();
            }
        });

        const block = <HTMLInputElement>(
            html.get(`#timeline_${timer_counter_save}_on`)
        );
        block?.addEventListener("change", (event: Event) => {
            const target = event.target as HTMLInputElement;

            const id = timer_counter_save;
            const duration = html.getInput(`timeline_${id}_time`)!.value;
            if (Number(duration) <= 0) return (target.checked = false);

            this.onCheckboxChange(event);

            const enabled = target.checked;
            if (!enabled) {
                const existingInterval = this.timelineIntervals.get(timer_counter_save);
                if (existingInterval) {
                    clearInterval(existingInterval);
                    this.timelineIntervals.delete(timer_counter_save);
                }
                return;
            }

            const keys_blocks = <HTMLInputElement[]>(
                html.getAll(`div[name="input_timeline_${id}_timer"]`)
            );
            const keys = [...keys_blocks].map((block) => {
                const key = (<HTMLInputElement>(
                    block.querySelector(`input[name="key"]`)
                ))?.value;
                const cast = (<HTMLInputElement>(
                    block.querySelector(`input[name="cast"]`)
                ))?.value;

                const x = (<HTMLInputElement>(
                    block.querySelector(`input[name="x"]`)
                ))?.value;
                const y = (<HTMLInputElement>(
                    block.querySelector(`input[name="y"]`)
                ))?.value;

                if (key && cast && key !== "" && cast !== "") {
                    return { cast: +cast, key };
                }

                if (x && y && x !== "" && y !== "") {
                    return { x: +x, y: +y, cast: 100 };
                }
            });

            const interval = setInterval(() => {
                keys.forEach((data) => {
                    this.input.send(data!);
                });
            }, Number(duration));
            this.timelineIntervals.set(timer_counter_save, interval);
        });
    }

    private createTimerKey(timer_counter_save: number) {
        const key_counter_save =
            this.timer_key_counter.get(timer_counter_save) || 0;
        this.timer_key_counter.set(timer_counter_save, key_counter_save + 1);

        const cheats_container = <HTMLElement>(
            html.get(`#timeline_${timer_counter_save}_collapse`)
        );

        const timer = html.toElement(
            html.input_timeline_group(
                `timeline_${timer_counter_save}_timer`,
                `timeline_${timer_counter_save}_timer_${key_counter_save}`
            )
        );

        cheats_container?.appendChild(timer);

        const button = <HTMLInputElement>(
            html.get(
                `#input_timeline_${timer_counter_save}_timer_${key_counter_save}_remove`
            )
        );
        button.addEventListener("pointerdown", function (event: Event) {
            const target = event.target as HTMLInputElement;
            const block = target.getAttribute("data-block-id");
            (<HTMLElement>html.get(`#${block}`)).remove();
        });
    }

    private createClickKey(timer_counter_save: number) {
        const key_counter_save =
            this.timer_key_counter.get(timer_counter_save) || 0;
        this.timer_key_counter.set(timer_counter_save, key_counter_save + 1);

        const cheats_container = <HTMLElement>(
            html.get(`#timeline_${timer_counter_save}_collapse`)
        );

        const timer = html.toElement(
            html.click_timeline_group(
                `timeline_${timer_counter_save}_timer`,
                `timeline_${timer_counter_save}_timer_${key_counter_save}`
            )
        );

        cheats_container?.appendChild(timer);

        const button = <HTMLInputElement>(
            html.get(
                `#input_timeline_${timer_counter_save}_timer_${key_counter_save}_remove`
            )
        );
        button.addEventListener("pointerdown", function (event: Event) {
            const target = event.target as HTMLInputElement;
            const block = target.getAttribute("data-block-id");
            (<HTMLElement>html.get(`#${block}`)).remove();
        });

        const button2 = <HTMLInputElement>(
            html.get(
                `#input_timeline_${timer_counter_save}_timer_${key_counter_save}_pos`
            )
        );

        let enabled = true;
        button2.addEventListener("pointerdown", (event: Event) => {
            if (!enabled) return;
            enabled = false;

            const canvas = this.canvas;

            const id = (e: string) =>
                `input_timeline_${timer_counter_save}_timer_${key_counter_save}_${e}`;
            const input_x = html.getInput(id("x"))!;
            const input_y = html.getInput(id("y"))!;

            const update_pos = (event: MouseEvent) => {
                const x = event.offsetX;
                const y = event.offsetY;

                input_x.value = x.toString();
                input_y.value = y.toString();
            };

            function remove() {
                canvas.removeEventListener("pointermove", update_pos);
                canvas.removeEventListener("pointerdown", remove);
                enabled = true;
            }

            canvas.addEventListener("pointermove", update_pos);
            canvas.addEventListener("pointerdown", remove);
        });
    }

    private createKey() {
        const key_counter_save = this.key_counter++;
        const cheats_container = <HTMLElement>html.get(`#cheats_collapse`);
        const timer = html.toElement(html.input_key_group(key_counter_save))!;
        cheats_container?.appendChild(timer);

        const block = <HTMLInputElement>(
            html.get(`#input_${key_counter_save}_on`)
        );
        block?.addEventListener("change", (event: Event) => {
            this.onCheckboxChange(event);

            const target = event.target as HTMLInputElement;
            const enabled = target.checked;
            if (!enabled) {
                const existingInterval = this.keyIntervals.get(key_counter_save);
                if (existingInterval) {
                    clearInterval(existingInterval);
                    this.keyIntervals.delete(key_counter_save);
                }
                return;
            }

            const id = key_counter_save;
            const duration = html.getInput(`input_${id}_time`)!.value;
            const cast = html.getInput(`input_${id}_cast`)!.value;
            const key = html.getInput(`input_${id}_key`)!.value;

            if (key.indexOf("TAB") !== -1) {
                let done = false;
                const target = <HTMLInputElement>html.get(`#cheats_target`);
                const interval = setInterval(async () => {
                    if (done) return;
                    done = true;
                    await this.attackTarget(target, {
                        count: Number(duration),
                        key: key.replace("TAB+", ""),
                        cast: Number(cast),
                    });
                    done = false;
                }, 100);
                this.keyIntervals.set(key_counter_save, interval);
            } else {
                const interval = setInterval(() => {
                    this.input.send({ cast: +cast, key });
                }, Number(duration));
                this.keyIntervals.set(key_counter_save, interval);
            }
        });

        const removeButton = <HTMLInputElement>(
            html.get(`#input_${key_counter_save}_remove`)
        );
        removeButton.addEventListener("click", function () {
            const blockId = this.getAttribute("data-block-id");
            const parentElement = document.getElementById(blockId!);
            if (parentElement) {
                parentElement.remove();
            }
        });
    }

    private openBuffsModal() {
        const modal = <HTMLElement>html.get(`#cheats_buffs_modal`);
        modal.style.display = 'flex';
        this.loadBuffsConfig();
        this.setupBuffKeyboardCapture();
    }

    private closeBuffsModal() {
        const modal = <HTMLElement>html.get(`#cheats_buffs_modal`);
        modal.style.display = 'none';
    }

    private getBuffsConfig(): Record<string, string> {
        return {
            patient: (<HTMLInputElement>html.get(`#buff_patient`))?.value || '',
            mental: (<HTMLInputElement>html.get(`#buff_mental`))?.value || '',
            quickstep: (<HTMLInputElement>html.get(`#buff_quickstep`))?.value || '',
            heapup: (<HTMLInputElement>html.get(`#buff_heapup`))?.value || '',
            haste: (<HTMLInputElement>html.get(`#buff_haste`))?.value || '',
            catsreflex: (<HTMLInputElement>html.get(`#buff_catsreflex`))?.value || '',
            cannonball: (<HTMLInputElement>html.get(`#buff_cannonball`))?.value || '',
            beefup: (<HTMLInputElement>html.get(`#buff_beefup`))?.value || '',
            accuracy: (<HTMLInputElement>html.get(`#buff_accuracy`))?.value || '',
            protect: (<HTMLInputElement>html.get(`#buff_protect`))?.value || '',
            spiritfortune: (<HTMLInputElement>html.get(`#buff_spiritfortune`))?.value || '',
            geburahtiphreth: (<HTMLInputElement>html.get(`#buff_geburahtiphreth`))?.value || '',
            activationKey: (<HTMLInputElement>html.get(`#buff_activation_key`))?.value || '`',
            warningTime: (<HTMLInputElement>html.get(`#buff_warning_time`))?.value || '900'
        };
    }

    private loadBuffsConfig() {
        const saved = localStorage.getItem('flyff_bot_buffs');
        if (saved) {
            const config = JSON.parse(saved);
            Object.keys(config).forEach((key) => {
                // Handle special cases with underscores in HTML IDs
                let htmlId = `#buff_${key}`;
                if (key === 'activationKey') {
                    htmlId = '#buff_activation_key';
                } else if (key === 'warningTime') {
                    htmlId = '#buff_warning_time';
                }
                
                const input = <HTMLInputElement>html.get(htmlId);
                if (input) {
                    input.value = config[key] || '';
                }
            });
        }
    }

    private saveBuffsConfig() {
        const config = this.getBuffsConfig();
        localStorage.setItem('flyff_bot_buffs', JSON.stringify(config));
        this.closeBuffsModal();
    }

    private setupBuffKeyboardCapture() {
        const buffInputIds = [
            'buff_patient',
            'buff_mental',
            'buff_quickstep',
            'buff_heapup',
            'buff_haste',
            'buff_catsreflex',
            'buff_cannonball',
            'buff_beefup',
            'buff_accuracy',
            'buff_protect',
            'buff_spiritfortune',
            'buff_geburahtiphreth',
            'buff_activation_key'
        ];

        buffInputIds.forEach((inputId) => {
            const input = <HTMLInputElement>html.get(`#${inputId}`);
            if (!input) return;

            // Remove existing listeners to avoid duplicates
            const newInput = input.cloneNode(true) as HTMLInputElement;
            input.parentNode?.replaceChild(newInput, input);

            // Add focus event to indicate recording mode
            newInput.addEventListener('focus', () => {
                newInput.placeholder = 'Press key combination...';
                newInput.style.backgroundColor = '#fff3cd';
            });

            newInput.addEventListener('blur', () => {
                newInput.placeholder = 'e.g. Alt+1';
                newInput.style.backgroundColor = '';
            });

            // Capture keyboard input
            newInput.addEventListener('keydown', (e: KeyboardEvent) => {
                e.preventDefault();
                e.stopPropagation();

                // Don't capture if it's Escape (let it close modal)
                if (e.key === 'Escape') {
                    newInput.blur();
                    return;
                }

                // Build key combination string
                const parts: string[] = [];

                if (e.altKey) parts.push('Alt');
                if (e.ctrlKey) parts.push('Ctrl');
                if (e.shiftKey) parts.push('Shift');

                // Get the main key
                let mainKey = e.key;

                // Handle special keys
                if (mainKey === ' ') {
                    mainKey = 'Space';
                } else if (mainKey === 'Tab') {
                    mainKey = 'Tab';
                } else if (mainKey === 'Enter') {
                    mainKey = 'Enter';
                } else if (mainKey === 'Escape') {
                    mainKey = 'Escape';
                } else if (mainKey.length > 1) {
                    // For other special keys, use as is (like ArrowUp, etc.)
                    // But for function keys, we might want to format differently
                    if (mainKey.startsWith('F') && mainKey.length <= 3) {
                        // Function keys like F1, F2, etc.
                        mainKey = mainKey;
                    } else {
                        // Skip keys like ArrowUp, ArrowDown, etc. that don't make sense for buffs
                        return;
                    }
                }

                // Only add main key if it's not a modifier
                if (mainKey !== 'Alt' && mainKey !== 'Control' && mainKey !== 'Shift' && mainKey !== 'Meta') {
                    parts.push(mainKey);
                }

                // Update input value
                if (parts.length > 0) {
                    newInput.value = parts.join('+');
                    // Auto-save to localStorage (but don't close modal)
                    const config = this.getBuffsConfig();
                    localStorage.setItem('flyff_bot_buffs', JSON.stringify(config));
                }

                // Blur after capturing
                setTimeout(() => {
                    newInput.blur();
                }, 100);
            });
        });
    }

    // Party Skills Methods
    private openPartySkillsModal() {
        const modal = <HTMLElement>html.get(`#cheats_party_skills_modal`);
        modal.style.display = 'flex';
        this.loadPartySkillsConfig();
        this.setupPartySkillsKeyboardCapture();
    }

    private closePartySkillsModal() {
        const modal = <HTMLElement>html.get(`#cheats_party_skills_modal`);
        modal.style.display = 'none';
    }

    private getPartySkillsConfig(): Record<string, { location: string; pressed: string }> {
        return {
            linked_attack: {
                location: (<HTMLInputElement>html.get(`#party_skill_linked_attack_location`))?.value || '',
                pressed: (<HTMLInputElement>html.get(`#party_skill_linked_attack_pressed`))?.value || ''
            },
            global_attack: {
                location: (<HTMLInputElement>html.get(`#party_skill_global_attack_location`))?.value || '',
                pressed: (<HTMLInputElement>html.get(`#party_skill_global_attack_pressed`))?.value || ''
            },
            lucky_drop: {
                location: (<HTMLInputElement>html.get(`#party_skill_lucky_drop_location`))?.value || '',
                pressed: (<HTMLInputElement>html.get(`#party_skill_lucky_drop_pressed`))?.value || ''
            },
            gift_box: {
                location: (<HTMLInputElement>html.get(`#party_skill_gift_box_location`))?.value || '',
                pressed: (<HTMLInputElement>html.get(`#party_skill_gift_box_pressed`))?.value || ''
            }
        };
    }

    private loadPartySkillsConfig() {
        const saved = localStorage.getItem('flyff_bot_party_skills');
        if (saved) {
            const config = JSON.parse(saved);
            Object.keys(config).forEach((key) => {
                const skillConfig = config[key];
                // Handle new format with location and pressed keys
                if (typeof skillConfig === 'object' && skillConfig !== null) {
                    const locationInput = <HTMLInputElement>html.get(`#party_skill_${key}_location`);
                    const pressedInput = <HTMLInputElement>html.get(`#party_skill_${key}_pressed`);
                    if (locationInput) {
                        locationInput.value = skillConfig.location || '';
                    }
                    if (pressedInput) {
                        pressedInput.value = skillConfig.pressed || '';
                    }
                } else {
                    // Handle old format (single key) for backwards compatibility
                    const locationInput = <HTMLInputElement>html.get(`#party_skill_${key}_location`);
                    if (locationInput && skillConfig) {
                        locationInput.value = skillConfig;
                    }
                }
            });
        }
    }

    private savePartySkillsConfig() {
        const config = this.getPartySkillsConfig();
        localStorage.setItem('flyff_bot_party_skills', JSON.stringify(config));
        this.closePartySkillsModal();
    }

    private setupPartySkillsKeyboardCapture() {
        const partySkillInputIds = [
            'party_skill_linked_attack_location',
            'party_skill_linked_attack_pressed',
            'party_skill_global_attack_location',
            'party_skill_global_attack_pressed',
            'party_skill_lucky_drop_location',
            'party_skill_lucky_drop_pressed',
            'party_skill_gift_box_location',
            'party_skill_gift_box_pressed'
        ];

        partySkillInputIds.forEach((inputId) => {
            const input = <HTMLInputElement>html.get(`#${inputId}`);
            if (!input) return;

            // Remove existing listeners to avoid duplicates
            const newInput = input.cloneNode(true) as HTMLInputElement;
            input.parentNode?.replaceChild(newInput, input);

            // Add focus event to indicate recording mode
            newInput.addEventListener('focus', () => {
                newInput.placeholder = 'Press key combination...';
                newInput.style.backgroundColor = '#fff3cd';
            });

            newInput.addEventListener('blur', () => {
                const originalPlaceholder = inputId.includes('location') ? 'e.g. Alt+1' : 'e.g. Insert';
                newInput.placeholder = originalPlaceholder;
                newInput.style.backgroundColor = '';
            });

            // Capture keyboard input
            newInput.addEventListener('keydown', (e: KeyboardEvent) => {
                e.preventDefault();
                e.stopPropagation();

                // Don't capture if it's Escape (let it close modal)
                if (e.key === 'Escape') {
                    newInput.blur();
                    return;
                }

                // Build key combination string
                const parts: string[] = [];

                if (e.altKey) parts.push('Alt');
                if (e.ctrlKey) parts.push('Ctrl');
                if (e.shiftKey) parts.push('Shift');

                // Get the main key
                let mainKey = e.key;

                // Handle special keys
                if (mainKey === ' ') {
                    mainKey = 'Space';
                } else if (mainKey === 'Tab') {
                    mainKey = 'Tab';
                } else if (mainKey === 'Enter') {
                    mainKey = 'Enter';
                } else if (mainKey.length > 1) {
                    // For function keys like F1, F2, etc.
                    if (mainKey.startsWith('F') && mainKey.length <= 3) {
                        mainKey = mainKey;
                    } else {
                        // Allow special keys like Insert, Home, PageUp, PageDown, Delete, End
                        // These are commonly used for party skills
                        mainKey = mainKey;
                    }
                }

                // Only add main key if it's not a modifier
                if (mainKey !== 'Alt' && mainKey !== 'Control' && mainKey !== 'Shift' && mainKey !== 'Meta') {
                    parts.push(mainKey);
                }

                // Update input value
                if (parts.length > 0) {
                    newInput.value = parts.join('+');
                    // Auto-save to localStorage (but don't close modal)
                    const config = this.getPartySkillsConfig();
                    localStorage.setItem('flyff_bot_party_skills', JSON.stringify(config));
                }

                // Blur after capturing
                setTimeout(() => {
                    newInput.blur();
                }, 100);
            });
        });
    }

    private checkPartySkillHotkey(event: KeyboardEvent) {
        const config = this.getPartySkillsConfig();
        
        // Build current key combination
        const parts: string[] = [];
        if (event.altKey) parts.push('Alt');
        if (event.ctrlKey) parts.push('Ctrl');
        if (event.shiftKey) parts.push('Shift');
        
        let mainKey = event.key;
        if (mainKey === ' ') {
            mainKey = 'Space';
        } else if (mainKey.startsWith('F') && mainKey.length <= 3) {
            // Function keys
            mainKey = mainKey;
        }
        
        if (mainKey !== 'Alt' && mainKey !== 'Control' && mainKey !== 'Shift' && mainKey !== 'Meta') {
            parts.push(mainKey);
        }
        
        const currentCombo = parts.join('+');
        
        // Check each party skill's pressed key
        if (config.linked_attack.pressed && currentCombo === config.linked_attack.pressed) {
            event.preventDefault();
            this.triggerPartySkill('linked_attack', 60);
        } else if (config.global_attack.pressed && currentCombo === config.global_attack.pressed) {
            event.preventDefault();
            this.triggerPartySkill('global_attack', 60);
        } else if (config.lucky_drop.pressed && currentCombo === config.lucky_drop.pressed) {
            event.preventDefault();
            this.triggerPartySkill('lucky_drop', 12);
        } else if (config.gift_box.pressed && currentCombo === config.gift_box.pressed) {
            event.preventDefault();
            this.triggerPartySkill('gift_box', 12);
        }
    }

    private async triggerPartySkill(skillName: string, pressCount: number) {
        // Check if this skill is already running
        if (this.partySkillIntervals.has(skillName)) {
            console.log(`${skillName} is already running`);
            return;
        }

        const config = this.getPartySkillsConfig();
        const skillConfig = config[skillName];
        
        if (!skillConfig || !skillConfig.location || skillConfig.location.trim() === '') {
            console.log(`No location key configured for ${skillName}`);
            return;
        }

        console.log(`Triggering ${skillName} - ${pressCount} times with 500ms interval using location key: ${skillConfig.location}`);

        let count = 0;
        const interval = setInterval(async () => {
            if (count >= pressCount) {
                clearInterval(interval);
                this.partySkillIntervals.delete(skillName);
                console.log(`${skillName} completed`);
                return;
            }
            
            await this.input.send({ cast: 500, key: skillConfig.location });
            count++;
        }, 500);

        this.partySkillIntervals.set(skillName, interval);
    }

    private onCheckboxChange(event: Event) {
        const target = event.target as HTMLInputElement;
        const block = target.getAttribute("data-block-id");
        const enabled = target.checked;

        const block_element = document.getElementById(block!);

        const notCheckboxes = block_element?.querySelectorAll(
            `input:not([type="checkbox"])`
        )!;
        notCheckboxes.forEach((input) => {
            (<HTMLInputElement>input).disabled = enabled;
        });

        const notLocked = block_element?.querySelectorAll(
            `button:not(.cant_lock)`
        )!;
        notLocked.forEach((input) => {
            (<HTMLButtonElement>input).disabled = enabled;
        });

        // Update maximize button color when checkbox changes
        this.updateMaximizeButtonColor();

        // Clear buff warning and timer if all features are turned off
        if (!enabled && !this.isAppActive()) {
            this.clearBuffWarning();
        }
    }

    private searchTarget() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const centerX = width / 2;
        const centerY = height / 2;

        let done = false;
        let [x, x2, y, y2] = [0, 0, 0, 0];
        let currentAngle = 0;

        const time = new Date().getTime();

        debugLog(`[radar] inicio — pantalla: ${width}x${height} | centro: (${Math.round(centerX)}, ${Math.round(centerY)})`, 'info');

        return new Promise((resolve) => {
            this.input.cursorMutation = () => {
                this.input.mouseClickEmmit(x, y);
                done = true;
                this.input.cursorMutation = new Function();

                const elapsed = new Date().getTime() - time;
                (<any>window).timeout = elapsed;

                const distFromCenter = Math.round(Math.hypot(x - centerX, y - centerY));
                const cursorVal = document.body.style.getPropertyValue('cursor');

                // sample pixel color at detected position
                let pixelInfo = '';
                try {
                    const gameCanvas = document.querySelector('canvas') as HTMLCanvasElement;
                    const tmp = document.createElement('canvas');
                    tmp.width = gameCanvas.width;
                    tmp.height = gameCanvas.height;
                    const ctx = tmp.getContext('2d')!;
                    ctx.drawImage(gameCanvas, 0, 0);
                    const scaleX = gameCanvas.width / width;
                    const scaleY = gameCanvas.height / height;
                    const px = ctx.getImageData(Math.round(x * scaleX), Math.round(y * scaleY), 1, 1).data;
                    pixelInfo = ` | pixel: rgb(${px[0]},${px[1]},${px[2]})`;
                } catch (_) {}

                debugLog(`[radar] MOB DETECTADO`, 'success');
                debugLog(`  pos: (${Math.round(x)}, ${Math.round(y)}) | dist_centro: ${distFromCenter}px`, 'info');
                debugLog(`  angulo: ${currentAngle.toFixed(2)} rad | tiempo: ${elapsed}ms${pixelInfo}`, 'info');
                debugLog(`  cursor: ${cursorVal}`, 'info');

                resolve(true);
            };

            (async () => {
                this.ctx2D.clearRect(0, 0, width, height);
                this.ctx2D.moveTo(centerX, centerY);
                this.ctx2D.beginPath();

                for (let angle = 0.01; angle < 72; angle += 0.01) {
                    currentAngle = angle;
                    x2 = centerX + (10 + 5 * angle) * Math.cos(angle);
                    y2 = centerY + (10 + 5 * angle) * Math.sin(angle);

                    if (x2 < 0 || y2 < 0) continue;
                    if (x2 > width || y2 > height) continue;
                    if (Math.hypot(x2 - x, y2 - y) < 7) continue;

                    [x, y] = [x2, y2];

                    this.ctx2D.arc(x, y, 3, 0, 2 * Math.PI);
                    this.ctx2D.strokeStyle = "#fff";
                    this.ctx2D.stroke();

                    await this.input.mouseMoveEmmit(x, y);

                    if (done) break;
                }

                this.ctx2D.closePath();

                this.input.cursorMutation = new Function();

                timer(1000).then(() =>
                    this.ctx2D.clearRect(0, 0, width, height)
                );

                const elapsed = new Date().getTime() - time;
                (<any>window).timeout = elapsed;

                if (!done) {
                    debugLog(`[radar] sin resultado — recorrido completo en ${elapsed}ms`, 'warn');
                }

                resolve(false);
            })();
        });
    }

    private sampleTargetUI() {
        try {
            const gameCanvas = document.querySelector('canvas') as HTMLCanvasElement;
            const cw = gameCanvas.width;
            const ch = gameCanvas.height;

            const tmp = document.createElement('canvas');
            tmp.width = cw;
            tmp.height = ch;
            const ctx = tmp.getContext('2d')!;
            ctx.drawImage(gameCanvas, 0, 0);

            // Sample top 20% of canvas — where target name/level/HP bar appears
            const stripH = Math.floor(ch * 0.20);
            const data = ctx.getImageData(0, 0, cw, stripH);
            const pixels = data.data;

            const buckets = { red: 0, orange: 0, white: 0, yellow: 0, green: 0, other: 0 };
            const total = pixels.length / 4;

            for (let i = 0; i < pixels.length; i += 4) {
                const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
                // ignore near-black (background)
                if (r < 20 && g < 20 && b < 20) continue;

                if (r > 180 && g < 80  && b < 80)  buckets.red++;
                else if (r > 200 && g > 100 && g < 180 && b < 60) buckets.orange++;
                else if (r > 200 && g > 200 && b < 100) buckets.yellow++;
                else if (r > 200 && g > 200 && b > 200) buckets.white++;
                else if (g > 150 && r < 100 && b < 100) buckets.green++;
                else buckets.other++;
            }

            const pct = (n: number) => ((n / total) * 100).toFixed(2) + '%';

            debugLog(`[target UI] franja superior (20%) — ${cw}x${stripH}px`, 'info');
            debugLog(`  rojo: ${pct(buckets.red)} | naranja: ${pct(buckets.orange)} | amarillo: ${pct(buckets.yellow)}`, 'info');
            debugLog(`  blanco: ${pct(buckets.white)} | verde: ${pct(buckets.green)} | otro: ${pct(buckets.other)}`, 'info');

            // sample 5 individual points across top strip to capture name text color
            const samplePoints = [0.1, 0.25, 0.4, 0.55, 0.7].map(xRatio => {
                const px = Math.floor(xRatio * cw);
                const py = Math.floor(stripH * 0.3);
                const idx = (py * cw + px) * 4;
                return `(${px},${py})=rgb(${pixels[idx]},${pixels[idx+1]},${pixels[idx+2]})`;
            });
            debugLog(`  muestras: ${samplePoints.join(' | ')}`, 'info');

        } catch (e) {
            debugLog(`[target UI] error al samplear: ${e}`, 'error');
        }
    }

    private async attackTarget(
        target: HTMLInputElement,
        data: {
            count: number;
            key: string;
            cast: number;
        }
    ) {
        target.classList.remove("btn-primary");
        target.classList.add("btn-secondary");

        if (await this.searchTarget()) {
            await timer(500);
            // Press Tab key first to target the monster
            await this.input.send({ cast: 100, key: "Tab" });
            await timer(400);
            this.sampleTargetUI();
            await timer(100);
            // Then press Z key
            await this.input.send({ cast: 100, key: "z" });
            await timer(100);
            // Then continue with the configured skill key
            for (let i = 0; i < data.count; i++) {
                await this.input.send({ cast: data.cast, key: data.key });
            }
        }

        target.classList.remove("btn-secondary");
        target.classList.add("btn-primary");
    }

    private async triggerBuffsWithPause() {
        // Check if cooldown is active (1 second = 1000ms)
        const now = Date.now();
        const cooldownPeriod = 1000; // 1 second in milliseconds
        
        if (now - this.lastAltBuffTime < cooldownPeriod) {
            const remainingTime = Math.ceil((cooldownPeriod - (now - this.lastAltBuffTime)) / 1000);
            console.log(`Alt buff is on cooldown. Please wait ${remainingTime} seconds.`);
            return;
        }
        
        // Increment buff press counter
        this.buffPressCounter++;
        
        // Clear the buff warning message and sound only after 2nd press
        if (this.buffPressCounter >= 2) {
            const width = window.innerWidth;
            const height = window.innerHeight;
            this.ctx2D.clearRect(0, 0, width, height);
            
            // Clear blinking animation
            if (this.buffWarningBlinkInterval) {
                clearInterval(this.buffWarningBlinkInterval);
                this.buffWarningBlinkInterval = null;
            }
            
            // Clear sound loop
            if (this.buffWarningSoundInterval) {
                clearInterval(this.buffWarningSoundInterval);
                this.buffWarningSoundInterval = null;
            }
            
            // Reset counter
            this.buffPressCounter = 0;
        }
        
        // Update the last buff time
        this.lastAltBuffTime = now;
        
        // Clear any existing buff warning timer
        if (this.buffWarningTimeout) {
            clearTimeout(this.buffWarningTimeout);
        }
        
        // Only set buff warning timer if:
        // 1. Buff warning is enabled
        // 2. At least one buff is configured
        const buffConfig = this.getBuffsConfig();
        const hasConfiguredBuffs = Object.values(buffConfig).some(key => key && key.trim() !== '');
        
        if (this.buffWarningEnabled && hasConfiguredBuffs) {
            // Get warning time from config (in seconds), default to 900 (15 minutes)
            const warningTimeSeconds = parseInt(buffConfig.warningTime || '900');
            const warningTimeMs = warningTimeSeconds * 1000;
            
            // Set a new timer to show buff warning
            this.buffWarningTimeout = setTimeout(() => {
                this.showBuffWarning();
            }, warningTimeMs);
        }
        
        // Store which features were active before pausing
        const activeKeys: Array<{ id: string; checkbox: HTMLInputElement }> = [];
        const activeTimelines: Array<{ id: string; checkbox: HTMLInputElement }> = [];
        let followWasActive = false;

        // Collect active keys
        const keyBlocks = <HTMLElement[]>html.getAll(`div[name="input_key"]`);
        keyBlocks.forEach((block) => {
            const id = block.id.replace('input_', '');
            const checkbox = <HTMLInputElement>html.get(`#input_${id}_on`);
            if (checkbox && checkbox.checked) {
                activeKeys.push({ id, checkbox });
                // Uncheck to pause
                checkbox.checked = false;
                checkbox.dispatchEvent(new Event('change'));
            }
        });

        // Collect active timelines
        const timelineBlocks = <HTMLElement[]>html.getAll(`div[name="input_timeline"]`);
        timelineBlocks.forEach((block) => {
            const id = block.id.replace('input_timeline_', '');
            const checkbox = <HTMLInputElement>html.get(`#timeline_${id}_on`);
            if (checkbox && checkbox.checked) {
                activeTimelines.push({ id, checkbox });
                // Uncheck to pause
                checkbox.checked = false;
                checkbox.dispatchEvent(new Event('change'));
            }
        });

        // Check follow checkbox
        const followCheckbox = <HTMLInputElement>html.get(`#input_follow`);
        if (followCheckbox && followCheckbox.checked) {
            followWasActive = true;
            followCheckbox.checked = false;
            followCheckbox.dispatchEvent(new Event('change'));
        }

        // Wait a bit for intervals to clear
        await timer(100);

        // Execute buffs
        await this.triggerBuffs();

        // Wait a bit after buffs complete
        await timer(100);

        // Restore active keys
        activeKeys.forEach(({ checkbox }) => {
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change'));
        });

        // Restore active timelines
        activeTimelines.forEach(({ checkbox }) => {
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change'));
        });

        // Restore follow if it was active
        if (followWasActive && followCheckbox) {
            followCheckbox.checked = true;
            followCheckbox.dispatchEvent(new Event('change'));
        }
    }

    private async triggerBuffs() {
        // Get all configured buffs from the modal inputs
        const buffConfig = this.getBuffsConfig();
        const buffs: Array<{ key: string }> = [];

        // Define buff order
        const buffOrder = [
            'patient',
            'mental',
            'quickstep',
            'heapup',
            'haste',
            'catsreflex',
            'cannonball',
            'beefup',
            'accuracy',
            'protect',
            'spiritfortune',
            'geburahtiphreth'
        ];

        // Collect buffs that have keys configured
        buffOrder.forEach((buffName) => {
            const key = buffConfig[buffName];
            if (key && key.trim() !== '') {
                buffs.push({ key: key.trim() });
            }
        });

        // If no buffs configured, use default combo (backward compatibility)
        if (buffs.length === 0) {
            // Default: Press ALT+1 through ALT+9 with 500ms interval
            for (let i = 1; i <= 9; i++) {
                await this.input.send({ cast: 500, key: `Alt+${i}` });
            }
        } else {
            // Trigger all configured buffs with 500ms interval
            for (const buff of buffs) {
                await this.input.send({ cast: 500, key: buff.key });
            }
        }
    }

    private playWarningSound() {
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            
            // Create oscillator for aggressive alarm sound
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Set frequency higher and use square wave for harsh sound
            oscillator.frequency.value = 1200;
            oscillator.type = 'square';
            
            // Set volume (max)
            gainNode.gain.setValueAtTime(1.0, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            // Play sound
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
            
            // Play rapid beeps for urgency
            setTimeout(() => {
                const osc2 = audioContext.createOscillator();
                const gain2 = audioContext.createGain();
                osc2.connect(gain2);
                gain2.connect(audioContext.destination);
                osc2.frequency.value = 1400;
                osc2.type = 'square';
                gain2.gain.setValueAtTime(1.0, audioContext.currentTime);
                gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                osc2.start(audioContext.currentTime);
                osc2.stop(audioContext.currentTime + 0.3);
            }, 200);
            
            setTimeout(() => {
                const osc3 = audioContext.createOscillator();
                const gain3 = audioContext.createGain();
                osc3.connect(gain3);
                gain3.connect(audioContext.destination);
                osc3.frequency.value = 1200;
                osc3.type = 'square';
                gain3.gain.setValueAtTime(1.0, audioContext.currentTime);
                gain3.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                osc3.start(audioContext.currentTime);
                osc3.stop(audioContext.currentTime + 0.3);
            }, 400);
            
            setTimeout(() => {
                const osc4 = audioContext.createOscillator();
                const gain4 = audioContext.createGain();
                osc4.connect(gain4);
                gain4.connect(audioContext.destination);
                osc4.frequency.value = 1400;
                osc4.type = 'square';
                gain4.gain.setValueAtTime(1.0, audioContext.currentTime);
                gain4.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                osc4.start(audioContext.currentTime);
                osc4.stop(audioContext.currentTime + 0.3);
            }, 600);
        } catch (e) {
            console.error('Failed to play warning sound:', e);
        }
    }

    private clearBuffWarning() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.ctx2D.clearRect(0, 0, width, height);

        // Clear buff warning timeout
        if (this.buffWarningTimeout) {
            clearTimeout(this.buffWarningTimeout);
            this.buffWarningTimeout = null;
        }

        // Clear blinking animation
        if (this.buffWarningBlinkInterval) {
            clearInterval(this.buffWarningBlinkInterval);
            this.buffWarningBlinkInterval = null;
        }

        // Clear sound loop
        if (this.buffWarningSoundInterval) {
            clearInterval(this.buffWarningSoundInterval);
            this.buffWarningSoundInterval = null;
        }

        // Reset counter
        this.buffPressCounter = 0;
    }

    private showBuffWarning() {
        // Don't show warning if it's disabled or app is not active
        if (!this.buffWarningEnabled || !this.isAppActive()) {
            return;
        }

        // Play warning sound immediately
        this.playWarningSound();
        
        // Clear any existing sound interval
        if (this.buffWarningSoundInterval) {
            clearInterval(this.buffWarningSoundInterval);
        }
        
        // Keep playing sound every 2 seconds
        this.buffWarningSoundInterval = setInterval(() => {
            this.playWarningSound();
        }, 2000);
        
        // Reset buff press counter
        this.buffPressCounter = 0;
        
        const width = window.innerWidth;
        const height = window.innerHeight;
        const centerX = width / 2;
        const centerY = height / 2;
        
        let visible = true;
        
        const drawWarning = () => {
            // Clear the canvas
            this.ctx2D.clearRect(0, 0, width, height);
            
            if (visible) {
                // Set text properties (bigger font)
                this.ctx2D.font = 'bold 80px Arial';
                this.ctx2D.textAlign = 'center';
                this.ctx2D.textBaseline = 'middle';
                
                // Draw background rectangle for better visibility
                const text = 'Buff is almost done.';
                const textMetrics = this.ctx2D.measureText(text);
                const padding = 40;
                const rectWidth = textMetrics.width + padding * 2;
                const rectHeight = 110;
                
                this.ctx2D.fillStyle = 'rgba(255, 0, 0, 0.9)';
                this.ctx2D.fillRect(
                    centerX - rectWidth / 2,
                    centerY - rectHeight / 2,
                    rectWidth,
                    rectHeight
                );
                
                // Draw text in white
                this.ctx2D.fillStyle = '#ffffff';
                this.ctx2D.strokeStyle = '#000000';
                this.ctx2D.lineWidth = 4;
                this.ctx2D.strokeText(text, centerX, centerY);
                this.ctx2D.fillText(text, centerX, centerY);
            }
            
            visible = !visible;
        };
        
        // Draw immediately
        drawWarning();
        
        // Clear any existing blink interval
        if (this.buffWarningBlinkInterval) {
            clearInterval(this.buffWarningBlinkInterval);
        }
        
        // Start blinking animation (toggle every 500ms)
        this.buffWarningBlinkInterval = setInterval(drawWarning, 500);
    }

    private async triggerComboKeys() {
        // Press ALT+1 through ALT+9 with 400ms interval
        for (let i = 1; i <= 9; i++) {
            await this.input.send({ cast: 400, key: `Alt+${i}` });
        }

        // Press 3, 4, 5 with 400ms interval
        await this.input.send({ cast: 400, key: "3" });
        await this.input.send({ cast: 400, key: "4" });
        await this.input.send({ cast: 400, key: "5" });
    }

    private toggleAll() {
        // Check if any key or timeline is currently active
        let hasActive = false;

        const keyBlocks = <HTMLElement[]>html.getAll(`div[name="input_key"]`);
        keyBlocks.forEach((block) => {
            const id = block.id.replace('input_', '');
            const checkbox = <HTMLInputElement>html.get(`#input_${id}_on`);
            if (checkbox && checkbox.checked) {
                hasActive = true;
            }
        });

        const timelineBlocks = <HTMLElement[]>html.getAll(`div[name="input_timeline"]`);
        timelineBlocks.forEach((block) => {
            const id = block.id.replace('input_timeline_', '');
            const checkbox = <HTMLInputElement>html.get(`#timeline_${id}_on`);
            if (checkbox && checkbox.checked) {
                hasActive = true;
            }
        });

        // Check follow checkbox
        const followCheckbox = <HTMLInputElement>html.get(`#input_follow`);
        if (followCheckbox && followCheckbox.checked) {
            hasActive = true;
        }

        // Note: We don't check buff warning checkbox here as it's independent

        // If any is active, turn all off; otherwise turn all on
        const newState = !hasActive;

        // Toggle all individual keys
        keyBlocks.forEach((block) => {
            const id = block.id.replace('input_', '');
            const checkbox = <HTMLInputElement>html.get(`#input_${id}_on`);
            if (checkbox && checkbox.checked !== newState) {
                checkbox.checked = newState;
                checkbox.dispatchEvent(new Event('change'));
            }
        });

        // Toggle all timelines
        timelineBlocks.forEach((block) => {
            const id = block.id.replace('input_timeline_', '');
            const checkbox = <HTMLInputElement>html.get(`#timeline_${id}_on`);
            if (checkbox && checkbox.checked !== newState) {
                checkbox.checked = newState;
                checkbox.dispatchEvent(new Event('change'));
            }
        });

        // Toggle follow 'z by default'
        if (followCheckbox && followCheckbox.checked !== newState) {
            followCheckbox.checked = newState;
            followCheckbox.dispatchEvent(new Event('change'));
        }

        // Update maximize button color
        this.updateMaximizeButtonColor();

        // Clear buff warning if turning everything off
        if (!newState) {
            this.clearBuffWarning();
        }
    }

    private minimizeUI() {
        const mainContent = <HTMLElement>html.get(`#cheats_main_content`);
        const minimized = <HTMLElement>html.get(`#cheats_minimized`);

        mainContent.style.display = 'none';
        minimized.style.display = 'flex';
    }

    private maximizeUI() {
        const mainContent = <HTMLElement>html.get(`#cheats_main_content`);
        const minimized = <HTMLElement>html.get(`#cheats_minimized`);

        mainContent.style.display = 'flex';
        minimized.style.display = 'none';
    }

    private isAppActive(): boolean {
        const keyBlocks = <HTMLElement[]>html.getAll(`div[name="input_key"]`);
        for (const block of keyBlocks) {
            const id = block.id.replace('input_', '');
            const checkbox = <HTMLInputElement>html.get(`#input_${id}_on`);
            if (checkbox && checkbox.checked) {
                return true;
            }
        }

        const timelineBlocks = <HTMLElement[]>html.getAll(`div[name="input_timeline"]`);
        for (const block of timelineBlocks) {
            const id = block.id.replace('input_timeline_', '');
            const checkbox = <HTMLInputElement>html.get(`#timeline_${id}_on`);
            if (checkbox && checkbox.checked) {
                return true;
            }
        }

        const follow = <HTMLInputElement>html.get(`#input_follow`);
        if (follow && follow.checked) {
            return true;
        }

        return false;
    }

    private updateMaximizeButtonColor() {
        const maximizeButton = <HTMLElement>html.get(`#cheats_maximize`);
        if (!maximizeButton) return;

        const hasActive = this.isAppActive();

        // Update button color based on state
        if (hasActive) {
            maximizeButton.style.backgroundColor = '#28a745';
            maximizeButton.style.borderColor = '#28a745';
            maximizeButton.style.filter = 'blur(0.5px)';
            maximizeButton.style.opacity = '0.5';
        } else {
            maximizeButton.style.backgroundColor = 'red';
            maximizeButton.style.borderColor = 'red';
            maximizeButton.style.filter = 'blur(0.5px)';
            maximizeButton.style.opacity = '0.5';
        }
    }

    private updateConfigList() {
        const select = <HTMLSelectElement>html.get(`#cheats_config_select`);
        const savedConfigs = localStorage.getItem('flyff_bot_configs');
        const configs = savedConfigs ? JSON.parse(savedConfigs) : {};

        select.innerHTML = '<option value="">Config</option>';
        Object.keys(configs).forEach((name) => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        });
    }

    private saveSettings() {
        const configNameInput = <HTMLInputElement>html.get(`#cheats_config_name`);
        const configName = configNameInput.value.trim();

        if (!configName) {
            alert('Please enter a configuration name!');
            return;
        }

        const settings: any = {
            follow: (<HTMLInputElement>html.get(`#input_follow`))?.checked || false,
            keys: [],
            timelines: [],
            buffs: this.getBuffsConfig()
        };

        // Save individual keys
        const keyBlocks = <HTMLElement[]>html.getAll(`div[name="input_key"]`);
        keyBlocks.forEach((block) => {
            const id = block.id.replace('input_', '');
            const isOn = (<HTMLInputElement>html.get(`#input_${id}_on`))?.checked || false;
            const time = (<HTMLInputElement>html.get(`#input_${id}_time`))?.value || '';
            const cast = (<HTMLInputElement>html.get(`#input_${id}_cast`))?.value || '';
            const key = (<HTMLInputElement>html.get(`#input_${id}_key`))?.value || '';

            settings.keys.push({ id, isOn, time, cast, key });
        });

        // Save timelines
        const timelineBlocks = <HTMLElement[]>html.getAll(`div[name="input_timeline"]`);
        timelineBlocks.forEach((block) => {
            const id = block.id.replace('input_timeline_', '');
            const isOn = (<HTMLInputElement>html.get(`#timeline_${id}_on`))?.checked || false;
            const time = (<HTMLInputElement>html.get(`#timeline_${id}_time`))?.value || '';

            const timelineKeys: any[] = [];
            const keyElements = <HTMLElement[]>html.getAll(`div[name="input_timeline_${id}_timer"]`);
            keyElements.forEach((keyBlock) => {
                const keyId = keyBlock.id;
                const key = (<HTMLInputElement>keyBlock.querySelector(`input[name="key"]`))?.value;
                const cast = (<HTMLInputElement>keyBlock.querySelector(`input[name="cast"]`))?.value;
                const x = (<HTMLInputElement>keyBlock.querySelector(`input[name="x"]`))?.value;
                const y = (<HTMLInputElement>keyBlock.querySelector(`input[name="y"]`))?.value;

                if (key !== undefined && cast !== undefined) {
                    timelineKeys.push({ type: 'key', key, cast });
                } else if (x !== undefined && y !== undefined) {
                    timelineKeys.push({ type: 'click', x, y });
                }
            });

            settings.timelines.push({ id, isOn, time, keys: timelineKeys });
        });

        const savedConfigs = localStorage.getItem('flyff_bot_configs');
        const configs = savedConfigs ? JSON.parse(savedConfigs) : {};
        configs[configName] = settings;

        localStorage.setItem('flyff_bot_configs', JSON.stringify(configs));
        configNameInput.value = '';
        this.updateConfigList();
        alert(`Configuration "${configName}" saved successfully!`);
    }

    private deleteSettings() {
        const select = <HTMLSelectElement>html.get(`#cheats_config_select`);
        const configName = select.value;

        if (!configName) {
            alert('Please select a configuration to delete!');
            return;
        }

        if (!confirm(`Are you sure you want to delete "${configName}"?`)) {
            return;
        }

        const savedConfigs = localStorage.getItem('flyff_bot_configs');
        const configs = savedConfigs ? JSON.parse(savedConfigs) : {};
        delete configs[configName];

        localStorage.setItem('flyff_bot_configs', JSON.stringify(configs));
        this.updateConfigList();
        alert(`Configuration "${configName}" deleted successfully!`);
    }

    private loadSettings() {
        const select = <HTMLSelectElement>html.get(`#cheats_config_select`);
        const configName = select.value;

        if (!configName) {
            alert('Please select a configuration to load!');
            return;
        }

        const savedConfigs = localStorage.getItem('flyff_bot_configs');
        if (!savedConfigs) {
            alert('No saved configurations found!');
            return;
        }

        const configs = JSON.parse(savedConfigs);
        const settings = configs[configName];

        if (!settings) {
            alert(`Configuration "${configName}" not found!`);
            return;
        }

        // Clear existing elements
        const keyBlocks = <HTMLElement[]>html.getAll(`div[name="input_key"]`);
        keyBlocks.forEach((block) => block.remove());

        const timelineBlocks = <HTMLElement[]>html.getAll(`div[name="input_timeline"]`);
        timelineBlocks.forEach((block) => block.remove());

        // Restore follow checkbox
        const follow = <HTMLInputElement>html.get(`#input_follow`);
        if (follow) {
            follow.checked = settings.follow || false;
            follow.dispatchEvent(new Event('change'));
        }

        // Restore individual keys
        settings.keys?.forEach((keyData: any) => {
            this.createKey();
            const currentId = this.key_counter - 1;

            setTimeout(() => {
                const timeInput = <HTMLInputElement>html.get(`#input_${currentId}_time`);
                const castInput = <HTMLInputElement>html.get(`#input_${currentId}_cast`);
                const keyInput = <HTMLInputElement>html.get(`#input_${currentId}_key`);
                const onInput = <HTMLInputElement>html.get(`#input_${currentId}_on`);

                if (timeInput) timeInput.value = keyData.time;
                if (castInput) castInput.value = keyData.cast;
                if (keyInput) keyInput.value = keyData.key;
                if (onInput && keyData.isOn) {
                    onInput.checked = true;
                    onInput.dispatchEvent(new Event('change'));
                }
            }, 10);
        });

        // Restore timelines
        settings.timelines?.forEach((timelineData: any) => {
            this.createTimer();
            const currentTimelineId = this.timer_counter - 1;

            setTimeout(() => {
                const timeInput = <HTMLInputElement>html.get(`#timeline_${currentTimelineId}_time`);
                if (timeInput) timeInput.value = timelineData.time;

                // Restore timeline keys
                timelineData.keys?.forEach((keyData: any) => {
                    if (keyData.type === 'key') {
                        this.createTimerKey(currentTimelineId);
                        const keyCounter = this.timer_key_counter.get(currentTimelineId) - 1;

                        setTimeout(() => {
                            const castInput = <HTMLInputElement>html.get(`#input_timeline_${currentTimelineId}_timer_${keyCounter}_cast`);
                            const keyInput = <HTMLInputElement>html.get(`#input_timeline_${currentTimelineId}_timer_${keyCounter}_key`);

                            if (castInput) castInput.value = keyData.cast;
                            if (keyInput) keyInput.value = keyData.key;
                        }, 10);
                    } else if (keyData.type === 'click') {
                        this.createClickKey(currentTimelineId);
                        const keyCounter = this.timer_key_counter.get(currentTimelineId) - 1;

                        setTimeout(() => {
                            const xInput = <HTMLInputElement>html.get(`#input_timeline_${currentTimelineId}_timer_${keyCounter}_x`);
                            const yInput = <HTMLInputElement>html.get(`#input_timeline_${currentTimelineId}_timer_${keyCounter}_y`);

                            if (xInput) xInput.value = keyData.x;
                            if (yInput) yInput.value = keyData.y;
                        }, 10);
                    }
                });

                // Set timeline on/off state
                const onInput = <HTMLInputElement>html.get(`#timeline_${currentTimelineId}_on`);
                if (onInput && timelineData.isOn) {
                    setTimeout(() => {
                        onInput.checked = true;
                        onInput.dispatchEvent(new Event('change'));
                    }, 50);
                }
            }, 10);
        });

        // Restore buffs
        if (settings.buffs) {
            Object.keys(settings.buffs).forEach((key) => {
                // Handle special cases with underscores in HTML IDs
                let htmlId = `#buff_${key}`;
                if (key === 'activationKey') {
                    htmlId = '#buff_activation_key';
                } else if (key === 'warningTime') {
                    htmlId = '#buff_warning_time';
                }
                
                const input = <HTMLInputElement>html.get(htmlId);
                if (input) {
                    input.value = settings.buffs[key] || '';
                }
            });
            // Save to localStorage as well
            localStorage.setItem('flyff_bot_buffs', JSON.stringify(settings.buffs));
        }

        alert(`Configuration "${configName}" loaded successfully!`);
    }

    private create2DCanvas() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        const canvas = document.createElement("canvas");
        document.body.append(canvas);

        canvas.setAttribute("id", "canvas2D");
        canvas.setAttribute("width", String(width));
        canvas.setAttribute("height", String(height));

        canvas.style.setProperty("pointer-events", "none");
        canvas.style.setProperty("width", "100%");
        canvas.style.setProperty("height", "100%");
        canvas.style.setProperty("position", "absolute");
        canvas.style.setProperty("opacity", "0.2");

        window.addEventListener("resize", () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            canvas.setAttribute("width", String(width));
            canvas.setAttribute("height", String(height));
        });

        this.canvas2D = canvas;
        this.ctx2D = canvas.getContext("2d")!;
    }

    private async loadMonsterTemplate() {
        try {
            // Load the Captain Samoset monster image
            let imagePath: string;
            
            try {
                // Try Chrome API first
                imagePath = chrome?.runtime?.getURL('assets/Captain Samoset.png');
            } catch {
                // Fallback to Firefox API
                imagePath = browser?.runtime?.getURL('assets/Captain Samoset.png');
            }
            
            await this.monsterDetection.loadTemplate(imagePath);
            console.log('Monster template loaded successfully');
        } catch (error) {
            console.error('Failed to load monster template:', error);
        }
    }

    private async detectAndClickMonster() {
        try {
            console.log('=== Monster Detection Started ===');
            
            // Get the game canvas
            const gameCanvas = document.querySelector('canvas') as HTMLCanvasElement;
            if (!gameCanvas) {
                console.error('❌ Game canvas not found');
                return;
            }
            console.log(`✓ Game canvas found: ${gameCanvas.width}x${gameCanvas.height}`);

            // Check if template is loaded
            if (!this.monsterDetection.isTemplateLoaded()) {
                console.error('❌ Template image not loaded');
                return;
            }
            console.log('✓ Template image loaded');

            // Detect monster in canvas
            console.log('🔍 Scanning for monster...');
            const result = this.monsterDetection.detectInCanvas(gameCanvas, 0.7); // 70% confidence threshold

            if (result.found) {
                console.log(`✓ Monster FOUND at (${result.x}, ${result.y}) with confidence: ${result.confidence.toFixed(2)}`);

                // Click on the monster
                console.log('🖱️ Clicking monster...');
                await this.input.mouseClickEmmit(result.x, result.y);
            } else {
                console.log(`❌ Monster NOT found. Best match confidence: ${result.confidence.toFixed(2)}`);
            }
            
            console.log('=== Detection Complete ===\n');
        } catch (error) {
            console.error('❌ Error in monster detection:', error);
        }
    }
}

new App();
