# 🎮 WebUI Control Center - Dokumentation

## 📋 Überblick

Das WebUI Control Center ist die zentrale Steuerungszentrale für Dudu. Es bietet ein modernes Web-Interface mit:

- ✅ **Dynamische Model-Auswahl** - Profile, Ollama & LM Studio Support
- ✅ **Live Bot-Monitoring** - 3D Viewer, Stats, Inventar & Chat
- ✅ **Auto-Save System** - Alle Einstellungen werden automatisch gespeichert
- ✅ **Advanced Bot Settings** - 20+ konfigurierbare Bot-Parameter
- ✅ **Real-time Updates** - Socket.IO Integration für Live-Daten

## 🚀 Schnellstart

### Neue Standardmethode (WebUI Control Center)

```bash
npm start
```

Dies startet nur die WebUI. Öffnen Sie dann:
- **http://localhost:8080**

Von dort aus können Sie:
1. Ein LLM-Modell auswählen (Profile/Ollama/LM Studio)
2. Minecraft-Server-Details eingeben
3. Den Bot mit dem "🚀 Start Bot" Button starten
4. Live-Daten im "Bot View & Communication" Bereich sehen

### Alternative: Direktstart (wie vorher)

```bash
npm run start-direct
```

Dies startet den Bot direkt wie in der alten Version (ohne WebUI).

### Nur WebUI starten

```bash
npm run webui
```

Identisch zu `npm start` - startet nur die WebUI ohne Bot.

## 🎯 Features im Detail

### 1. 🧠 AI Model Configuration

**Model Source Selection:**
- **Saved Profiles**: Lädt Profile aus `./profiles/` und `./Dudu.json`
- **Ollama (Local)**: Dynamische Erkennung aller installierten Ollama-Modelle
- **LM Studio (Local)**: Dynamische Erkennung aller geladenen LM Studio-Modelle

**Features:**
- Live Model Discovery von lokalen Modellen
- Service Status Anzeige (Ollama/LM Studio Online/Offline)
- Embedding Model Selection mit allen verfügbaren Embeddings
- Auto-Save: Alle Änderungen werden sofort gespeichert

**Unterstützte Model-Provider:**
- ✅ Ollama (localhost:11434)
- ✅ LM Studio (localhost:1234)
- ✅ OpenAI (GPT-4, GPT-3.5)
- ✅ Anthropic (Claude)
- ✅ Google (Gemini)
- ✅ Groq
- ✅ Mistral
- ✅ Hugging Face
- ✅ Replicate
- ✅ DeepSeek

### 2. 🎮 Minecraft Server Configuration

**Einstellungen:**
- Server Address (Standard: 127.0.0.1)
- Port (Standard: 25565)
- Bot Name (Standard: Dudu)
- Minecraft Version (Auto-Detection oder manuell)

**Auto-Save:**
Alle Server-Einstellungen werden automatisch im Browser gespeichert und bei F5 wiederhergestellt.

### 3. ⚙️ Advanced Settings (Collapsible)

**Quick Settings:**
- **Authentication**: Offline / Microsoft
- **Init Message**: Optionale Nachricht beim Bot-Start

**Features:**
- Aufklappbar (wie Accordion)
- Auto-Save aktiviert

### 4. 🛠️ Bot Settings (Advanced) - NEU!

**20+ Konfigurierbare Parameter:**

| Setting | Type | Beschreibung |
|---------|------|--------------|
| `base_profile` | select | survival, assistant, creative, god_mode |
| `load_memory` | boolean | Bot's vorherige Memory laden |
| `only_chat_with` | array | Liste von Agents für privaten Chat |
| `speak` | boolean | Text-to-Speech aktivieren |
| `language` | string | Auto-Übersetzung via Google Translate |
| `allow_vision` | boolean | Vision Capabilities aktivieren |
| `blocked_actions` | array | Liste blockierter Actions |
| `relevant_docs_count` | number | Anzahl relevanter Docs im Prompt (Standard: 5) |
| `max_messages` | number | Max. Nachrichten im Context (Standard: 15) |
| `num_examples` | number | Anzahl Examples für bessere Prompts (Standard: 2) |
| `max_commands` | number | Max. Commands in Responses (-1 = unbegrenzt) |
| `narrate_behavior` | boolean | Automatisches Verhalten chatten |
| `log_all_prompts` | boolean | Alle Prompts in Datei loggen (sehr verbose) |
| `show_command_syntax` | select | full, shortened, none |
| `chat_ingame` | boolean | Chat-Nachrichten im Game anzeigen |
| `chat_bot_messages` | boolean | Bot-zu-Bot Nachrichten öffentlich |
| `render_bot_view` | boolean | Bot View für User rendern |
| `allow_insecure_coding` | boolean | newAction Command erlauben (potenziell unsicher) |
| `code_timeout_mins` | number | Code-Execution Timeout (-1 = kein Timeout) |
| `task` | object | Task Object beim Start (null = kein Task) |

**Features:**
- ✅ Automatisches Speichern bei jeder Änderung
- ✅ Persistent im Browser (localStorage)
- ✅ Hilfe-Icons (?) mit Tooltips für Beschreibungen
- ✅ Grid-Layout mit automatischer Spaltenanpassung
- ✅ JSON Support für Arrays & Objects

### 5. 🤖 Bot View & Communication (Collapsible)

**Agent Stats (Real-time):**
- 📍 Position (X, Y, Z)
- ❤️ Health (0-20)
- 🍖 Food (0-20)
- ⭐ XP Level
- 🕐 Time (Minecraft-Zeit formatiert)
- 🎮 Mode (Current game mode)

**Bot Actions:**
- ⏸️ **Pause**: Bot pausieren
- ▶️ **Resume**: Bot fortsetzen
- 🛑 **Stop Bot**: Bot stoppen

**3D Viewer:**
- Live-Rendering des Bot-Views
- Iframe-Integration mit Prismarine-Viewer
- Automatische URL-Generierung

**🎒 Inventory Display:**
- Grid-Layout mit allen Items
- Sortiert nach Anzahl (absteigend)
- Live-Updates via Socket.IO

**💬 Chat with Bot:**
- Direkter Chat mit dem Bot
- Enter-Taste zum Senden
- Message-Historie (letzte 50 Nachrichten)
- Farbcodierte Nachrichten:
  - 🤖 Bot (lila)
  - 👤 User (blau)
  - 📢 System (grau)

**Features:**
- ✅ Collapsible Section (aufklappbar)
- ✅ Info-Box wenn Bot nicht läuft
- ✅ Auto-Aktivierung wenn Bot startet
- ✅ Real-time Updates alle 1000ms

### 6. 📋 System Logs

**Features:**
- Echtzeit-Logs im Browser
- Farbcodierte Nachrichten:
  - 🔵 Info (blau)
  - ✅ Success (grün)
  - ❌ Error (rot)
- Automatisches Scrollen
- Letzte 50 Logs werden behalten
- Zeitstempel für jeden Log-Entry

### 7. 💾 Auto-Save System - NEU!

**Was wird automatisch gespeichert:**

1. **Haupt-Einstellungen** (`dudu-bot-settings`):
   - Bot Name
   - Minecraft Server
   - Minecraft Port
   - Minecraft Version
   - Auth Mode
   - Init Message
   - Model Source (profiles/ollama/lmstudio)
   - LLM Model
   - Embedding Model

2. **Bot Settings Advanced** (`dudu-bot-advanced-settings`):
   - Alle 20+ Bot-Parameter aus settings_spec.json

**Wie funktioniert es:**
- ⚡ **Instant Save**: Bei jeder Änderung wird automatisch gespeichert
- 💾 **localStorage**: Alle Daten bleiben im Browser
- 🔄 **Auto-Reload**: Bei F5 werden alle Einstellungen wiederhergestellt
- 🎯 **Per Browser**: Jeder Browser hat seine eigenen Settings

## 📁 Dateistruktur

```
dudu-minecraft-ai/
├── webui-launcher.js           # Neuer Entry Point
├── main.js                      # Alter Entry Point (für direkten Start)
├── src/
│   ├── mindcraft/
│   │   ├── mindserver.js       # Erweitert um Express-Routen
│   │   └── public/
│   │       ├── control-panel.html  # Neues Control Panel
│   │       └── index.html          # Alte Chat-Oberfläche
│   └── agent/
│       └── model_manager.js    # Hot-Reload für Modelle
└── package.json                # Aktualisierte Scripts
```

## 🔧 API Endpoints

Das Control Center bietet folgende REST-API-Endpoints:

### GET `/api/models`
Gibt verfügbare LLM- und Embedding-Modelle zurück.

**Response:**
```json
{
  "llm_models": [
    {
      "name": "Dudu",
      "file": "./Dudu.json",
      "model": "gemma2:9b",
      "type": "ollama"
    }
  ],
  "embedding_models": [...],
  "current_settings": {...}
}
```

### POST `/api/start-bot`
Startet einen Bot mit den angegebenen Einstellungen.

**Request Body:**
```json
{
  "bot_name": "Dudu",
  "llm_model": "./Dudu.json",
  "minecraft_server": "localhost",
  "minecraft_port": "25565",
  "minecraft_version": "auto"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bot started successfully",
  "bot_name": "Dudu"
}
```

### POST `/api/stop-bot`
Stoppt einen laufenden Bot.

**Request Body:**
```json
{
  "bot_name": "Dudu"
}
```

### GET `/api/bot-status`
Gibt den aktuellen Status aller Bots zurück.

**Response:**
```json
{
  "running": true,
  "agents": [
    {
      "name": "Dudu",
      "running": true,
      "settings": {...}
    }
  ],
  "count": 1
}
```

### POST `/api/configure`
Speichert Konfigurationsänderungen.

**Request Body:**
```json
{
  "llm_model": "./Dudu.json",
  "minecraft_server": "localhost",
  "minecraft_port": "25565"
}
```

## 🔄 Hot-Reload (Model Manager)

Der Model Manager ermöglicht das Wechseln von Modellen zur Laufzeit ohne Bot-Neustart.

### Verwendung:

```javascript
import { ModelManager } from './src/agent/model_manager.js';

const manager = new ModelManager(agent);

// LLM wechseln
await manager.switchLLM('./profiles/claude.json');

// Embedding wechseln
await manager.switchEmbedding('nomic-embed-text');
```

### Unterstützte Modelle:
- ✅ OpenAI (GPT-4, GPT-3.5)
- ✅ Anthropic (Claude)
- ✅ Ollama (Llama, Gemma, Qwen, etc.)
- ✅ Google (Gemini)
- ✅ Groq
- ✅ Mistral
- ✅ LM Studio
- ✅ Hugging Face
- ✅ Replicate
- ✅ DeepSeek

## 🎨 UI Routen

- `/` oder `/control` - Control Panel (Standard)
- `/chat` - Original Chat Interface
- `/index.html` - Original Chat Interface (direkter Zugriff)

## ⚙️ Konfiguration

### Browser-Speicherung
Die WebUI speichert Ihre Einstellungen im Browser (localStorage):
- Bot-Name
- Minecraft-Version
- LLM-Model
- Embedding-Model

### Server-Speicherung
Die Konfiguration wird auch in `settings.js` gespeichert (wenn "Save Configuration" geklickt wird).

## 🐛 Troubleshooting

### Bot startet nicht
1. Überprüfen Sie, ob ein LLM-Modell ausgewählt ist
2. Stellen Sie sicher, dass der Minecraft-Server läuft
3. Überprüfen Sie die Logs im Control Panel

### API-Fehler
- Überprüfen Sie, ob die WebUI auf Port 8080 läuft
- Öffnen Sie die Browser-Konsole (F12) für detaillierte Fehlermeldungen

### Modell nicht gefunden
- Stellen Sie sicher, dass die Profil-JSON-Dateien existieren
- Überprüfen Sie die Pfade in `settings.js`

## 📝 Changelog

### Version 2.0 (WebUI Control Center)
- ✅ Neuer webui-launcher.js Entry Point
- ✅ Control Panel UI erstellt
- ✅ REST API für Bot-Steuerung
- ✅ Model Manager für Hot-Reload
- ✅ Live-Status-Überwachung
- ✅ Konfigurationsspeicherung

### Migration von Version 1.0
Wenn Sie die alte Version verwendet haben:
- `npm start` startet jetzt die WebUI (nicht mehr den Bot direkt)
- Verwenden Sie `npm run start-direct` für den alten direkten Start
- Alle bisherigen Konfigurationen in `settings.js` bleiben erhalten

## 🔮 Zukünftige Features

Geplante Erweiterungen:
- [ ] Multi-Bot-Management (mehrere Bots gleichzeitig)
- [ ] Performance-Monitoring
- [ ] Model-Benchmarking
- [ ] Profile-Editor im UI
- [ ] Task-Management über UI
- [ ] WebSocket-Integration für Echtzeit-Updates
- [ ] Dark Mode
- [ ] Mobile-optimiertes Design

## 📞 Support

Bei Fragen oder Problemen:
1. Überprüfen Sie die Logs im Control Panel
2. Schauen Sie in die Browser-Konsole (F12)
3. Öffnen Sie ein Issue auf GitHub

## 🎉 Viel Spaß mit dem neuen Control Center!
