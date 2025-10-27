import * as Mindcraft from './src/mindcraft/mindcraft.js';
import settings from './settings.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { readFileSync } from 'fs';

// Suppress known protodef PartialReadError spam (MC 1.21+ compatibility issue)
// See: https://github.com/PrismarineJS/mineflayer/issues/3756
let protodefWarningShown = false;
const originalStderrWrite = process.stderr.write.bind(process.stderr);
process.stderr.write = (chunk, encoding, callback) => {
    const str = chunk.toString();

    // Filter out PartialReadError entity_metadata spam
    if (str.includes('PartialReadError') && str.includes('entity_metadata')) {
        if (!protodefWarningShown) {
            originalStderrWrite('\n⚠️  Known issue: PartialReadError with entity_metadata (MC 1.21+). Bot continues working normally.\n');
            originalStderrWrite('   See: https://github.com/PrismarineJS/mineflayer/issues/3756\n');
            originalStderrWrite('   These errors will be suppressed to reduce console spam.\n\n');
            protodefWarningShown = true;
        }
        // Suppress the actual error
        if (typeof callback === 'function') callback();
        return true;
    }

    // Pass through all other stderr writes
    return originalStderrWrite(chunk, encoding, callback);
};

function parseArguments() {
    return yargs(hideBin(process.argv))
        .option('profiles', {
            type: 'array',
            describe: 'List of agent profile paths',
        })
        .option('task_path', {
            type: 'string',
            describe: 'Path to task file to execute'
        })
        .option('task_id', {
            type: 'string',
            describe: 'Task ID to execute'
        })
        .help()
        .alias('help', 'h')
        .parse();
}
const args = parseArguments();
if (args.profiles) {
    settings.profiles = args.profiles;
}
if (args.task_path) {
    let tasks = JSON.parse(readFileSync(args.task_path, 'utf8'));
    if (args.task_id) {
        settings.task = tasks[args.task_id];
        settings.task.task_id = args.task_id;
    }
    else {
        throw new Error('task_id is required when task_path is provided');
    }
}

// these environment variables override certain settings
if (process.env.MINECRAFT_PORT) {
    settings.port = process.env.MINECRAFT_PORT;
}
if (process.env.MINDSERVER_PORT) {
    settings.mindserver_port = process.env.MINDSERVER_PORT;
}
if (process.env.PROFILES && JSON.parse(process.env.PROFILES).length > 0) {
    settings.profiles = JSON.parse(process.env.PROFILES);
}
if (process.env.INSECURE_CODING) {
    settings.allow_insecure_coding = true;
}
if (process.env.BLOCKED_ACTIONS) {
    settings.blocked_actions = JSON.parse(process.env.BLOCKED_ACTIONS);
}
if (process.env.MAX_MESSAGES) {
    settings.max_messages = process.env.MAX_MESSAGES;
}
if (process.env.NUM_EXAMPLES) {
    settings.num_examples = process.env.NUM_EXAMPLES;
}
if (process.env.LOG_ALL) {
    settings.log_all_prompts = process.env.LOG_ALL;
}

Mindcraft.init(false, settings.mindserver_port, settings.auto_open_ui);

for (let profile of settings.profiles) {
    const profile_json = JSON.parse(readFileSync(profile, 'utf8'));
    settings.profile = profile_json;
    Mindcraft.createAgent(settings);
}