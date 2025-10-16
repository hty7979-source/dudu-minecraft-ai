import * as skills from './skills.js';
import * as world from './utils/world.js';

// Export new organized structure
export * from './systems/collection.js';
export * from './systems/mining.js';
export * from './systems/crafting_system.js';
export * from './systems/task_manager.js';
export * from './utils/world.js';
export * from './utils/state.js';
export * from './utils/lockdown.js';


export function docHelper(functions, module_name) {
    let docArray = [];
    for (let skillFunc of functions) {
        let str = skillFunc.toString();
        if (str.includes('/**')) {
            let docEntry = `${module_name}.${skillFunc.name}\n`;
            docEntry += str.substring(str.indexOf('/**') + 3, str.indexOf('**/')).trim();
            docArray.push(docEntry);
        }
    }
    return docArray;
}

export function getSkillDocs() {
    let docArray = [];
    docArray = docArray.concat(docHelper(Object.values(skills), 'skills'));
    docArray = docArray.concat(docHelper(Object.values(world), 'world'));
    return docArray;
}
