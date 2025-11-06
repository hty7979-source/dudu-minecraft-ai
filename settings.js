const settings = {
    "minecraft_version": "auto",
    "host": "127.0.0.1",
    "port": 25565,
    "auth": "offline",
    "mindserver_port": 8080,
    "auto_open_ui": true,
    "base_profile": "assistant",
    "profiles": [
        "./Dudu.json"
    ],
    "load_memory": false,
    "init_message": "Respond with hello world and your name",
    "only_chat_with": [],
    "speak": false,
    "chat_ingame": true,
    "language": "en",
    "render_bot_view": false,
    "allow_insecure_coding": false,
    "allow_vision": false,
    "blocked_actions": [
        "!newAction",
        "!collectBlocks",
        "!craftRecipe",
        "!checkBlueprint",
        "!checkBlueprintLevel",
        "!getBlueprint",
        "!getBlueprintLevel"
    ],
    "code_timeout_mins": -1,
    "relevant_docs_count": 5,
    "max_messages": 15,
    "num_examples": 2,
    "max_commands": -1,
    "show_command_syntax": "full",
    "narrate_behavior": true,
    "chat_bot_messages": true,
    "block_place_delay": 0,
    "log_all_prompts": false
}

export default settings;
