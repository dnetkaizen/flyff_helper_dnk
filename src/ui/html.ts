import { version } from "../../package.json";
import * as svg from "./svg";

export function toElement(html: string) {
    var template = document.createElement("template");
    html = html.trim(); // Never return a text node of whitespace as the result
    template.innerHTML = html;
    return template.content.firstChild!;
}

export function toElements(html: string) {
    var template = document.createElement("template");
    template.innerHTML = html;
    return template.content.childNodes;
}

export function getInput(
    id: string,
    parent: Element = <Element>document.body
): HTMLInputElement | null {
    return <HTMLInputElement>document.querySelector(`#${id}`);
}

export function get<T>(selectors: string): T {
    return document.querySelector(selectors) as any as T;
}

export function getAll<T>(selectors: string): T {
    return document.querySelectorAll(selectors) as any as T;
}

// ========================================
// WINDOW SIZE SETTINGS - ADJUST THESE VALUES
// ========================================
const WINDOW_FONT_SIZE = '9px';      // Change this to make text smaller/larger (e.g., '8px', '10px', '12px')
const WINDOW_PADDING = '2px';        // Change this to make window more/less compact (e.g., '3px', '5px', '8px')
const BUTTON_MARGIN = '2px';         // Change this to adjust spacing between buttons (e.g., '2px', '4px', '5px')
const BUTTON_PADDING = '4px 8px';    // Change button padding (vertical horizontal) (e.g., '1px 4px', '3px 8px')
const BUTTON_FONT_SIZE = '11px';      // Change button text size (e.g., '8px', '10px', '11px')
// ========================================

const cheats_container_style = `position: fixed;
width: fit-content;
top: 0px;
right: 0;
background-color: white;
padding: ${WINDOW_PADDING};
display: flex;
flex-direction: column;
align-items: center;
border-radius: 6px;
font-size: ${WINDOW_FONT_SIZE};
z-index: 9999;`;

export const partySkillsModal = () => `
<div id="cheats_party_skills_modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); z-index: 10000; align-items: center; justify-content: center;">
    <div style="background-color: white; padding: 20px; border-radius: 8px; max-width: 550px; width: 90%; max-height: 90vh; overflow-y: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3 style="margin: 0; font-size: 16px;">Configure Party Skills</h3>
            <button id="cheats_party_skills_modal_close" class="btn btn-secondary" type="button" style="font-size: ${BUTTON_FONT_SIZE}; padding: ${BUTTON_PADDING};">×</button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 12px;">
            <div style="border: 1px solid #ddd; padding: 10px; border-radius: 5px;">
                <div style="font-weight: bold; margin-bottom: 8px; font-size: ${BUTTON_FONT_SIZE};">Linked Attack</div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                    <label style="width: 100px; font-size: ${BUTTON_FONT_SIZE}; margin: 0;">Location Key:</label>
                    <input id="party_skill_linked_attack_location" type="text" class="form-control" placeholder="e.g. Alt+1" style="flex: 1; padding: 3px; font-size: ${BUTTON_FONT_SIZE}; cursor: pointer;">
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <label style="width: 100px; font-size: ${BUTTON_FONT_SIZE}; margin: 0;">Pressed Key:</label>
                    <input id="party_skill_linked_attack_pressed" type="text" class="form-control" placeholder="e.g. Insert" style="flex: 1; padding: 3px; font-size: ${BUTTON_FONT_SIZE}; cursor: pointer;">
                </div>
            </div>
            <div style="border: 1px solid #ddd; padding: 10px; border-radius: 5px;">
                <div style="font-weight: bold; margin-bottom: 8px; font-size: ${BUTTON_FONT_SIZE};">Global Attack</div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                    <label style="width: 100px; font-size: ${BUTTON_FONT_SIZE}; margin: 0;">Location Key:</label>
                    <input id="party_skill_global_attack_location" type="text" class="form-control" placeholder="e.g. Alt+2" style="flex: 1; padding: 3px; font-size: ${BUTTON_FONT_SIZE}; cursor: pointer;">
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <label style="width: 100px; font-size: ${BUTTON_FONT_SIZE}; margin: 0;">Pressed Key:</label>
                    <input id="party_skill_global_attack_pressed" type="text" class="form-control" placeholder="e.g. Home" style="flex: 1; padding: 3px; font-size: ${BUTTON_FONT_SIZE}; cursor: pointer;">
                </div>
            </div>
            <div style="border: 1px solid #ddd; padding: 10px; border-radius: 5px;">
                <div style="font-weight: bold; margin-bottom: 8px; font-size: ${BUTTON_FONT_SIZE};">Lucky Drop</div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                    <label style="width: 100px; font-size: ${BUTTON_FONT_SIZE}; margin: 0;">Location Key:</label>
                    <input id="party_skill_lucky_drop_location" type="text" class="form-control" placeholder="e.g. Alt+3" style="flex: 1; padding: 3px; font-size: ${BUTTON_FONT_SIZE}; cursor: pointer;">
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <label style="width: 100px; font-size: ${BUTTON_FONT_SIZE}; margin: 0;">Pressed Key:</label>
                    <input id="party_skill_lucky_drop_pressed" type="text" class="form-control" placeholder="e.g. PageUp" style="flex: 1; padding: 3px; font-size: ${BUTTON_FONT_SIZE}; cursor: pointer;">
                </div>
            </div>
            <div style="border: 1px solid #ddd; padding: 10px; border-radius: 5px;">
                <div style="font-weight: bold; margin-bottom: 8px; font-size: ${BUTTON_FONT_SIZE};">Gift Box</div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                    <label style="width: 100px; font-size: ${BUTTON_FONT_SIZE}; margin: 0;">Location Key:</label>
                    <input id="party_skill_gift_box_location" type="text" class="form-control" placeholder="e.g. Alt+4" style="flex: 1; padding: 3px; font-size: ${BUTTON_FONT_SIZE}; cursor: pointer;">
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <label style="width: 100px; font-size: ${BUTTON_FONT_SIZE}; margin: 0;">Pressed Key:</label>
                    <input id="party_skill_gift_box_pressed" type="text" class="form-control" placeholder="e.g. PageDown" style="flex: 1; padding: 3px; font-size: ${BUTTON_FONT_SIZE}; cursor: pointer;">
                </div>
            </div>
        </div>
        <div style="margin-top: 15px; display: flex; flex-direction: column; gap: 10px;">
            <div style="text-align: center; font-size: ${BUTTON_FONT_SIZE}; color: #666; font-style: italic;">
                Linked/Global Attack: 60 presses (500ms interval)<br>
                Lucky Drop/Gift Box: 12 presses (500ms interval)
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button id="cheats_party_skills_save" class="btn btn-success" type="button" style="font-size: ${BUTTON_FONT_SIZE}; padding: ${BUTTON_PADDING};">Save</button>
            </div>
        </div>
    </div>
</div>
`;

export const buffsModal = () => `
<div id="cheats_buffs_modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); z-index: 10000; align-items: center; justify-content: center;">
    <div style="background-color: white; padding: 20px; border-radius: 8px; max-width: 400px; width: 90%; max-height: 90vh; overflow-y: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3 style="margin: 0; font-size: 16px;">Configure Buffs</h3>
            <button id="cheats_buffs_modal_close" class="btn btn-secondary" type="button" style="font-size: ${BUTTON_FONT_SIZE}; padding: ${BUTTON_PADDING};">×</button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <label style="width: 130px; font-size: ${BUTTON_FONT_SIZE}; margin: 0;">Patient:</label>
                <input id="buff_patient" type="text" class="form-control" placeholder="Click and press key..." style="flex: 1; padding: 3px; font-size: ${BUTTON_FONT_SIZE}; cursor: pointer;">
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <label style="width: 130px; font-size: ${BUTTON_FONT_SIZE}; margin: 0;">Mental:</label>
                <input id="buff_mental" type="text" class="form-control" placeholder="Click and press key..." style="flex: 1; padding: 3px; font-size: ${BUTTON_FONT_SIZE}; cursor: pointer;">
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <label style="width: 130px; font-size: ${BUTTON_FONT_SIZE}; margin: 0;">Quick Step:</label>
                <input id="buff_quickstep" type="text" class="form-control" placeholder="Click and press key..." style="flex: 1; padding: 3px; font-size: ${BUTTON_FONT_SIZE}; cursor: pointer;">
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <label style="width: 130px; font-size: ${BUTTON_FONT_SIZE}; margin: 0;">Heap Up:</label>
                <input id="buff_heapup" type="text" class="form-control" placeholder="Click and press key..." style="flex: 1; padding: 3px; font-size: ${BUTTON_FONT_SIZE}; cursor: pointer;">
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <label style="width: 130px; font-size: ${BUTTON_FONT_SIZE}; margin: 0;">Haste:</label>
                <input id="buff_haste" type="text" class="form-control" placeholder="Click and press key..." style="flex: 1; padding: 3px; font-size: ${BUTTON_FONT_SIZE}; cursor: pointer;">
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <label style="width: 130px; font-size: ${BUTTON_FONT_SIZE}; margin: 0;">Cat's Reflex:</label>
                <input id="buff_catsreflex" type="text" class="form-control" placeholder="Click and press key..." style="flex: 1; padding: 3px; font-size: ${BUTTON_FONT_SIZE}; cursor: pointer;">
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <label style="width: 130px; font-size: ${BUTTON_FONT_SIZE}; margin: 0;">Cannon Ball:</label>
                <input id="buff_cannonball" type="text" class="form-control" placeholder="Click and press key..." style="flex: 1; padding: 3px; font-size: ${BUTTON_FONT_SIZE}; cursor: pointer;">
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <label style="width: 130px; font-size: ${BUTTON_FONT_SIZE}; margin: 0;">Beef Up:</label>
                <input id="buff_beefup" type="text" class="form-control" placeholder="Click and press key..." style="flex: 1; padding: 3px; font-size: ${BUTTON_FONT_SIZE}; cursor: pointer;">
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <label style="width: 130px; font-size: ${BUTTON_FONT_SIZE}; margin: 0;">Accuracy:</label>
                <input id="buff_accuracy" type="text" class="form-control" placeholder="Click and press key..." style="flex: 1; padding: 3px; font-size: ${BUTTON_FONT_SIZE}; cursor: pointer;">
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <label style="width: 130px; font-size: ${BUTTON_FONT_SIZE}; margin: 0;">Protect:</label>
                <input id="buff_protect" type="text" class="form-control" placeholder="Click and press key..." style="flex: 1; padding: 3px; font-size: ${BUTTON_FONT_SIZE}; cursor: pointer;">
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <label style="width: 130px; font-size: ${BUTTON_FONT_SIZE}; margin: 0;">Spirit Fortune:</label>
                <input id="buff_spiritfortune" type="text" class="form-control" placeholder="Click and press key..." style="flex: 1; padding: 3px; font-size: ${BUTTON_FONT_SIZE}; cursor: pointer;">
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <label style="width: 130px; font-size: ${BUTTON_FONT_SIZE}; margin: 0;">Geburah Tiphreth:</label>
                <input id="buff_geburahtiphreth" type="text" class="form-control" placeholder="Click and press key..." style="flex: 1; padding: 3px; font-size: ${BUTTON_FONT_SIZE}; cursor: pointer;">
            </div>
        </div>
        <div style="margin-top: 15px; display: flex; flex-direction: column; gap: 10px;">
            <div style="border-top: 1px solid #ddd; padding-top: 10px;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                    <label style="width: 130px; font-size: ${BUTTON_FONT_SIZE}; margin: 0;">Activation Key:</label>
                    <input id="buff_activation_key" type="text" class="form-control" placeholder="e.g. Grave Accent" style="flex: 1; padding: 3px; font-size: ${BUTTON_FONT_SIZE}; cursor: pointer;">
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <label style="width: 130px; font-size: ${BUTTON_FONT_SIZE}; margin: 0;">Warning Time (sec):</label>
                    <input id="buff_warning_time" type="number" class="form-control" placeholder="e.g. 900 (15 mins)" style="flex: 1; padding: 3px; font-size: ${BUTTON_FONT_SIZE};">
                </div>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button id="cheats_buffs_save" class="btn btn-success" type="button" style="font-size: ${BUTTON_FONT_SIZE}; padding: ${BUTTON_PADDING};">Save</button>
            </div>
        </div>
    </div>
</div>
`;

export const container = `<div id="cheats_container" style="${cheats_container_style}">
    <div id="cheats_main_content" style="align-items: center; display: flex; flex-direction: column;">
        <button id="cheats_minimize" class="btn btn-secondary" type="button" style="margin: ${BUTTON_MARGIN}; font-size: 10px; padding: 2px 6px; opacity: 0.5; filter: blur(0.5px);">−</button>
        <div id="cheats_collapse" class="collapse card card-body" style="margin-bottom: ${BUTTON_MARGIN};">
            <div class="card card-body" style="margin-bottom: ${BUTTON_MARGIN};">
                <div class="input-group">
                    <div class="form-check form-switch">  
                        <input id="input_follow" class="form-check-input" type="checkbox" role="switch">
                        <span class="" id="basic-addon1" style="margin-left: 5px;">follow \`z by default\`</span>
                    </div>
                </div>
                <div class="input-group" style="margin-top: 5px;">
                    <div class="form-check form-switch">  
                        <input id="input_buff_warning" class="form-check-input" type="checkbox" role="switch">
                        <span class="" id="basic-addon2" style="margin-left: 5px;">enable buff warning</span>
                    </div>
                </div>
            </div>
            <div class="card card-body" style="margin-bottom: ${BUTTON_MARGIN};">
                <div class="input-group" style="justify-content: center;">
                    <span class="" style="font-size: ${BUTTON_FONT_SIZE}; color: #666;">Press Alt to detect & click monster</span>
                </div>
            </div>
            <div class="input-group" style="margin-bottom: ${BUTTON_MARGIN}; justify-content: center;">
                <span class="input-group-text" style="font-size: ${BUTTON_FONT_SIZE}; padding: ${BUTTON_PADDING};">Add</span>
                <button id="cheats_add_timeline" class="btn btn-primary" type="button" style="font-size: ${BUTTON_FONT_SIZE}; padding: ${BUTTON_PADDING};">Timeline</button>
                <button id="cheats_add_key" class="btn btn-primary" type="button" style="font-size: ${BUTTON_FONT_SIZE}; padding: ${BUTTON_PADDING};">Key</button>
                <button id="cheats_open_buffs" class="btn btn-primary" type="button" style="font-size: ${BUTTON_FONT_SIZE}; padding: ${BUTTON_PADDING};">Buffs</button>
            </div>
            <div class="input-group" style="margin-bottom: ${BUTTON_MARGIN}; justify-content: center;">
                <button id="cheats_open_party_skills" class="btn btn-primary" type="button" style="font-size: ${BUTTON_FONT_SIZE}; padding: ${BUTTON_PADDING};">Party Skills</button>
            </div>
            <div class="input-group" style="margin-bottom: ${BUTTON_MARGIN}; justify-content: center;">
                <input id="cheats_config_name" type="text" class="form-control" placeholder="Config name" aria-label="Config name" style="max-width: 150px; font-size: ${BUTTON_FONT_SIZE}; padding: ${BUTTON_PADDING};">
            </div>
            <div class="input-group" style="margin-bottom: ${BUTTON_MARGIN}; justify-content: center;">
                <button id="cheats_save_settings" class="btn btn-success" type="button" style="font-size: ${BUTTON_FONT_SIZE}; padding: ${BUTTON_PADDING};">Save</button>
                <select id="cheats_config_select" class="form-select" style="max-width: 150px; font-size: ${BUTTON_FONT_SIZE}; padding: ${BUTTON_PADDING};">
                    <option value="">Config...</option>
                </select>
                <button id="cheats_load_settings" class="btn btn-info" type="button" style="font-size: ${BUTTON_FONT_SIZE}; padding: ${BUTTON_PADDING};">Load</button>
                <button id="cheats_delete_settings" class="btn btn-danger" type="button" style="font-size: ${BUTTON_FONT_SIZE}; padding: ${BUTTON_PADDING};">Delete</button>
            </div>
        </div>
        <button id="cheats_toggle_all" class="btn btn-success" type="button" style="margin: ${BUTTON_MARGIN}; font-size: ${BUTTON_FONT_SIZE}; padding: ${BUTTON_PADDING};">On/Off</button>
        <button id="cheats_target" class="btn btn-primary" type="button" style="margin: ${BUTTON_MARGIN}; font-size: ${BUTTON_FONT_SIZE}; padding: ${BUTTON_PADDING};">Target</button>
        <button class="btn btn-primary" type="button" data-bs-toggle="collapse" data-bs-target="#cheats_collapse" aria-expanded="false" aria-controls="collapse_cheats" style="margin: ${BUTTON_MARGIN}; font-size: ${BUTTON_FONT_SIZE}; padding: ${BUTTON_PADDING};">Cheats</button>
        <button id="dnk_console_toggle" class="btn btn-secondary" type="button" style="margin: ${BUTTON_MARGIN}; font-size: ${BUTTON_FONT_SIZE}; padding: ${BUTTON_PADDING};">Console</button>
        <div id="dnk_console_body" style="display:none; flex-direction:column; width:280px; margin-top:2px;">
            <div style="display:flex; justify-content:space-between; align-items:center; padding:3px 6px; background:#161b22; border-radius:4px 4px 0 0; border:1px solid #30363d; border-bottom:none;">
                <span style="color:#58a6ff; font-size:10px; font-family:monospace; font-weight:bold;">DNK Console</span>
                <div style="display:flex; gap:3px;">
                    <button id="dnk_debug_copy" style="background:#238636;color:#fff;border:none;border-radius:3px;padding:1px 6px;font-size:10px;cursor:pointer;">Copy</button>
                    <button id="dnk_debug_download" style="background:#1f6feb;color:#fff;border:none;border-radius:3px;padding:1px 6px;font-size:10px;cursor:pointer;">DL</button>
                    <button id="dnk_debug_clear" style="background:#da3633;color:#fff;border:none;border-radius:3px;padding:1px 6px;font-size:10px;cursor:pointer;">Clear</button>
                </div>
            </div>
            <div id="dnk_debug_log" style="height:160px;overflow-y:auto;padding:4px 6px;background:#0d1117;border:1px solid #30363d;border-radius:0 0 4px 4px;font-family:monospace;font-size:10px;"></div>
        </div>
        <a id="cheats_upgrade" name="v${version}" href="#" style="text-align: center;">v${version}</a>
    </div>
    <div id="cheats_minimized" style="display: none; align-items: center; justify-content: center;">
        <button id="cheats_maximize" class="btn btn-primary" type="button" style="margin: ${BUTTON_MARGIN}; font-size: ${BUTTON_FONT_SIZE}; padding: ${BUTTON_PADDING};">+</button>
    </div>
    ${partySkillsModal()}
    ${buffsModal()}
</div>`;

export const collapseTimeline = (id: number) => `
<div style="align-items: center; display: flex; flex-direction: column; margin-top: 5px;" name="input_timeline" id="input_timeline_${id}">
    <div id="timeline_${id}_collapse" class="collapse card card-body" style="margin-bottom: 5px;"></div>
    <div class="input-group">
        <div class="form-check form-switch" style="display: flex; align-items: center;">
            <input id="timeline_${id}_on" class="form-check-input" type="checkbox" role="switch" data-block-id="input_timeline_${id}">
        </div>
        <button class="btn btn-primary cant_lock" type="button" data-bs-toggle="collapse" data-bs-target="#timeline_${id}_collapse" aria-expanded="false" aria-controls="timeline_${id}_collapse" style="border-top-left-radius: 5px; border-bottom-left-radius: 5px;">Settings</button>
        <button id="timeline_${id}_add" class="btn btn-primary" type="button">Key</button>
        <button id="timeline_${id}_add_click" class="btn btn-primary" type="button">Click</button>
        <input id="timeline_${id}_time" type="string" class="form-control" placeholder="interval" aria-label="Interval" style="width: 70px; padding: 3px;">
        <button id="timeline_${id}_remove" type="button" class="btn btn-secondary" aria-label="Close" data-block-id="timeline_${id}">x</button>
    </div>
</div>`;

export const input_key_group = (id: number) => `
<div style="display: flex; margin-top: 0.5em;" name="input_key" id="input_${id}">
    <div class="form-check form-switch" style="display: flex; align-items: center;">
        <input id="input_${id}_on" class="form-check-input" type="checkbox" role="switch" data-block-id="input_${id}">
    </div>
    <div class="input-group">
        <input id="input_${id}_time" type="string" class="form-control" placeholder="interval" aria-label="Interval" style="width: 70px; padding: 3px;">
        <input id="input_${id}_cast" type="string" class="form-control" placeholder="casting" aria-label="Casting" style="width: 70px; padding: 3px;">
        <input id="input_${id}_key" type="string" class="form-control" placeholder="key" aria-label="Key" style="width: 55px; padding: 3px;">
        <button id="input_${id}_remove" type="button" class="btn btn-secondary" aria-label="Close" data-block-id="input_${id}">x</button>
    </div>
</div>
`;

export const input_timeline_group = (parent: string, name: string) => `
<div style="display: flex; width: 234px; margin-bottom: 0.5em;" name="input_${parent}" id="input_${name}">
    <div class="input-group">
        <span class="input-group-text">${svg.key}</span>
        <input name="cast" id="input_${name}_cast" type="string" class="form-control" placeholder="casting" aria-label="Casting" style="width: 45px; padding: 3px;">
        <input name="key" id="input_${name}_key" type="string" class="form-control" placeholder="key" aria-label="Key" style="width: 20px; padding: 3px;">
        <button id="input_${name}_remove" type="button" class="btn btn-secondary" aria-label="Close" data-block-id="input_${name}">x</button>
    </div>
</div>
`;

export const click_timeline_group = (parent: string, name: string) => `
<div style="display: flex; width: 234px; margin-bottom: 0.5em;" name="input_${parent}" id="input_${name}">
    <div class="input-group">
        <button id="input_${name}_pos" type="button" class="btn btn-info">${svg.mouse}</button>
        <input name="x" id="input_${name}_x" type="string" class="form-control" placeholder="x" aria-label="X" style="width: 45px; padding: 3px;">
        <input name="y" id="input_${name}_y" type="string" class="form-control" placeholder="y" aria-label="Y" style="width: 20px; padding: 3px;">
        <button id="input_${name}_remove" type="button" class="btn btn-secondary" aria-label="Close" data-block-id="input_${name}">x</button>
    </div>
</div>
`;
