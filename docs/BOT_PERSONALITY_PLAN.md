# 🎭 Dudu Bot - Von Mechanisch zu Lebendig
## Implementierungsplan für Persönlichkeit & Lebendigkeit

---

## 📋 Executive Summary

### Problem
Der Bot funktioniert technisch gut, fühlt sich aber mechanisch und roboterhaft an. Es fehlen:
- Persönlichkeit und Charakter
- Natürliche Spieler-Interaktionen  
- Emotionale Reaktionen auf Erfolge/Misserfolge
- Spontane Verhaltensweisen
- LLM-generierte kontextuelle Aussagen

### Lösung
Ein modulares Persönlichkeitssystem, das sich nahtlos in die bestehende Architektur integriert und dem Bot Leben einhaucht, ohne die technische Funktionalität zu beeinträchtigen.

---

## 🎯 Ziele & Prioritäten

### Hauptziele
1. **Lebendigkeit:** Bot soll sich wie ein Charakter anfühlen, nicht wie ein Tool
2. **Spieler-Fokus:** Bot soll auf Spieler reagieren und mit ihnen interagieren
3. **Kontextuelle Reaktionen:** Passende Kommentare zu Erfolgen/Misserfolgen
4. **Persönlichkeits-Profile:** Verschiedene Charaktere möglich machen
5. **Balance:** Nicht nervig werden - richtige Menge an Interaktion

### Prioritäten-Matrix

| Priorität | Feature | Aufwand | Impact | ROI |
|-----------|---------|---------|--------|-----|
| 🔴 HIGH | Basis-Persönlichkeit | Mittel | Hoch | ⭐⭐⭐⭐⭐ |
| 🔴 HIGH | Spieler-Awareness | Niedrig | Hoch | ⭐⭐⭐⭐⭐ |
| 🟡 MEDIUM | Success/Fail Kommentare | Niedrig | Mittel | ⭐⭐⭐⭐ |
| 🟡 MEDIUM | Idle Behaviors | Mittel | Mittel | ⭐⭐⭐ |
| 🟢 LOW | LLM-Integration | Hoch | Mittel | ⭐⭐ |

---

## 🏗️ Architektur-Übersicht

```
src/agent/
├── personality/
│   ├── personality_system.js      # Kern-Persönlichkeit
│   ├── trait_manager.js          # Traits & Eigenschaften
│   ├── reaction_templates.js     # Response-Templates
│   └── mood_system.js            # Stimmungs-System
│
├── awareness/
│   ├── player_awareness.js       # Spieler-Tracking
│   ├── environment_awareness.js  # Umgebungs-Wahrnehmung
│   └── social_interactions.js    # Soziale Interaktionen
│
└── behaviors/
    ├── idle_personality.js       # Idle-Verhalten
    ├── emotes.js                 # Körpersprache
    └── contextual_responses.js   # Kontext-Reaktionen
```

---

## 📦 Phase 1: Basis-Persönlichkeitssystem (Woche 1)

### 1.1 Personality Core (`personality_system.js`)

```javascript
class PersonalitySystem {
    constructor(agent, config = {}) {
        this.agent = agent;
        
        // Persönlichkeits-Traits (0.0 - 1.0)
        this.traits = {
            humor: config.humor || 0.7,
            friendliness: config.friendliness || 0.8,
            confidence: config.confidence || 0.6,
            chattiness: config.chattiness || 0.5,
            helpfulness: config.helpfulness || 0.9,
            curiosity: config.curiosity || 0.6,
            bravery: config.bravery || 0.4,
            patience: config.patience || 0.7
        };
        
        // Aktuelle Stimmung
        this.mood = {
            happiness: 0.5,
            energy: 0.8,
            stress: 0.2,
            loneliness: 0.3
        };
        
        // Persönlichkeits-Archetyp
        this.archetype = config.archetype || 'friendly_helper';
        
        // Catchphrases & Signature-Aussagen
        this.catchphrases = config.catchphrases || [
            "Dudu ist am Start!",
            "Das kriegen wir hin!",
            "Lass mal machen!"
        ];
    }
    
    // Entscheide ob Bot sprechen soll
    shouldSpeak(situation = 'default') {
        const baseChance = this.traits.chattiness;
        const moodModifier = this.mood.happiness * 0.2;
        const situationModifiers = {
            'greeting': 0.3,
            'success': 0.2,
            'failure': 0.1,
            'idle': -0.2,
            'combat': -0.3
        };
        
        const modifier = situationModifiers[situation] || 0;
        const chance = Math.min(1, Math.max(0, baseChance + moodModifier + modifier));
        
        return Math.random() < chance;
    }
    
    // Generiere Persönlichkeits-basierte Antwort
    generateResponse(context) {
        // Hier später LLM-Integration
        const templates = this.getTemplatesForContext(context);
        const response = this.selectTemplate(templates, context);
        return this.personalizeResponse(response, context);
    }
    
    // Update Stimmung basierend auf Events
    updateMood(event, value) {
        switch(event) {
            case 'task_success':
                this.mood.happiness += 0.1;
                this.mood.confidence += 0.05;
                break;
            case 'task_failure':
                this.mood.happiness -= 0.05;
                this.mood.stress += 0.1;
                break;
            case 'player_interaction':
                this.mood.loneliness -= 0.2;
                this.mood.happiness += 0.1;
                break;
            case 'idle_long':
                this.mood.energy -= 0.1;
                this.mood.loneliness += 0.1;
                break;
        }
        
        // Normalisiere Werte (0-1)
        for (let key in this.mood) {
            this.mood[key] = Math.min(1, Math.max(0, this.mood[key]));
        }
    }
}
```

### 1.2 Reaction Templates (`reaction_templates.js`)

```javascript
const REACTION_TEMPLATES = {
    // Erfolgs-Reaktionen
    success: {
        high_confidence: [
            "Boom! Das war ja einfach! 💪",
            "Hah, {task} erledigt! Nächste Herausforderung bitte!",
            "Perfekt! Genau wie geplant 😎"
        ],
        normal_confidence: [
            "Geschafft! {task} ist fertig ✅",
            "Alles klar, {task} erledigt!",
            "Done! Das lief gut!"
        ],
        low_confidence: [
            "Oh wow, das hat tatsächlich geklappt!",
            "Puh, {task} geschafft... das war knapp!",
            "Yes! Ich hab's hinbekommen!"
        ]
    },
    
    // Misserfolgs-Reaktionen
    failure: {
        high_patience: [
            "Hmm, das hat nicht geklappt. Neuer Versuch!",
            "Okay, Plan B für {task}...",
            "Kein Problem, ich probier's anders!"
        ],
        normal_patience: [
            "Mist... {task} ist fehlgeschlagen",
            "Das lief nicht wie geplant 😅",
            "Ugh, da ist was schiefgelaufen"
        ],
        low_patience: [
            "Ach komm schon! Warum klappt {task} nicht?!",
            "Seriously?! Das sollte funktionieren!",
            "Okay das nervt langsam..."
        ]
    },
    
    // Spieler-Interaktionen
    player_greeting: {
        friendly: [
            "Hey {player}! Schön dich zu sehen! 😊",
            "{player}! Perfect timing, ich brauchte Gesellschaft!",
            "Oh hi {player}! Was geht?"
        ],
        neutral: [
            "Hallo {player}",
            "Oh, {player} ist da",
            "Hey {player}"
        ],
        busy: [
            "Hi {player}! Bin gerade bei {current_task}",
            "Hey {player}, einen Moment noch...",
            "Oh hi! Bin gleich fertig mit {current_task}"
        ]
    },
    
    // Idle Chatter
    idle_thoughts: {
        philosophical: [
            "Wisst ihr was? Minecraft-Sonnenuntergänge sind echt unterschätzt...",
            "Ich frage mich ob Villager auch Träume haben 🤔",
            "Manchmal denke ich, Creeper wollen nur Umarmungen... explosive Umarmungen."
        ],
        observations: [
            "Habt ihr gemerkt wie friedlich es hier nachts ist? Abgesehen von den Zombies...",
            "Diese Höhle sieht interessant aus! Sollten wir mal erkunden?",
            "Ich glaube ich hab vorhin ein seltenes Tier gesehen!"
        ],
        random: [
            "Wusstet ihr dass Lamas spucken können? Hab ich auf die harte Tour gelernt...",
            "Mein Lieblings-Block? Definitiv... hmm... schwierige Frage!",
            "Ich sollte mal aufräumen... aber Mining macht mehr Spaß!"
        ]
    }
};
```

### 1.3 Integration in Profile

```json
// dudu.json Erweiterung
{
    "name": "dudu",
    "personality": {
        "archetype": "friendly_adventurer",
        "traits": {
            "humor": 0.8,
            "friendliness": 0.9,
            "confidence": 0.6,
            "chattiness": 0.6,
            "helpfulness": 0.95,
            "curiosity": 0.8,
            "bravery": 0.5,
            "patience": 0.7
        },
        "catchphrases": [
            "Dudu ist am Start!",
            "Das kann ich!",
            "Adventure time!",
            "Lass mal machen, Chef!"
        ],
        "speaking_style": "casual_friendly",
        "emote_frequency": 0.4
    }
}
```

---

## 👥 Phase 2: Spieler-Awareness System (Woche 2)

### 2.1 Player Awareness (`player_awareness.js`)

```javascript
class PlayerAwarenessSystem {
    constructor(agent) {
        this.agent = agent;
        this.trackedPlayers = new Map();
        this.focusedPlayer = null;
        this.interactionHistory = new Map();
        
        this.setupEventListeners();
        this.startTrackingLoop();
    }
    
    setupEventListeners() {
        // Spieler betritt Sichtweite
        this.agent.bot.on('playerJoined', (player) => {
            this.onPlayerJoined(player);
        });
        
        // Spieler verlässt
        this.agent.bot.on('playerLeft', (player) => {
            this.onPlayerLeft(player);
        });
        
        // Chat-Nachrichten
        this.agent.bot.on('chat', (username, message) => {
            this.onPlayerChat(username, message);
        });
        
        // Spieler-Bewegung
        this.agent.bot.on('entityMoved', (entity) => {
            if (entity.type === 'player') {
                this.updatePlayerPosition(entity);
            }
        });
    }
    
    onPlayerJoined(player) {
        const lastSeen = this.interactionHistory.get(player.username);
        const timeSinceLastSeen = lastSeen ? Date.now() - lastSeen.lastSeen : Infinity;
        
        // Persönlichkeits-basierte Begrüßung
        if (this.agent.personality.shouldSpeak('greeting')) {
            let greeting;
            
            if (timeSinceLastSeen < 5 * 60 * 1000) { // < 5 Minuten
                greeting = "Oh, du bist ja gleich wieder da {player}!";
            } else if (timeSinceLastSeen < 60 * 60 * 1000) { // < 1 Stunde
                greeting = "Welcome back {player}!";
            } else if (lastSeen) { // Schon mal gesehen
                greeting = "Hey {player}! Lange nicht gesehen!";
            } else { // Neuer Spieler
                greeting = "Hi {player}! Ich bin Dudu, schön dich kennenzulernen!";
            }
            
            greeting = greeting.replace('{player}', player.username);
            
            setTimeout(() => {
                this.agent.bot.chat(greeting);
                
                // Körpersprache
                if (player.entity && this.isPlayerNearby(player)) {
                    this.waveAtPlayer(player);
                }
            }, 1000 + Math.random() * 2000); // 1-3 Sekunden Verzögerung
        }
        
        // Tracking starten
        this.trackedPlayers.set(player.username, {
            entity: player.entity,
            lastSeen: Date.now(),
            lastPosition: player.entity?.position,
            attentionLevel: 0.5,
            relationship: lastSeen?.relationship || 0
        });
    }
    
    // Blickkontakt mit Spielern
    maintainEyeContact() {
        if (this.agent.bot.pathfinder?.isMoving()) return; // Nicht während Bewegung
        
        const nearestPlayer = this.getNearestPlayer();
        if (nearestPlayer && nearestPlayer.distance < 8) {
            // Sanfter Blickkontakt
            const lookTarget = nearestPlayer.entity.position.offset(0, 1.6, 0);
            const currentLook = this.agent.bot.entity.yaw;
            const targetLook = this.agent.bot.entity.yawTo(lookTarget);
            
            // Smooth look transition
            const diff = targetLook - currentLook;
            const smoothedYaw = currentLook + diff * 0.1;
            
            this.agent.bot.look(smoothedYaw, this.agent.bot.entity.pitch * 0.9);
        }
    }
    
    // Spieler-Distanz tracking
    getNearestPlayer() {
        let nearest = null;
        let minDistance = Infinity;
        
        for (const [username, data] of this.trackedPlayers) {
            if (data.entity) {
                const distance = this.agent.bot.entity.position.distanceTo(data.entity.position);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = {
                        username,
                        entity: data.entity,
                        distance: minDistance
                    };
                }
            }
        }
        
        return nearest;
    }
    
    // Emotes & Körpersprache
    async waveAtPlayer(player) {
        // Winken Animation
        for (let i = 0; i < 3; i++) {
            this.agent.bot.setControlState('jump', true);
            await new Promise(r => setTimeout(r, 150));
            this.agent.bot.setControlState('jump', false);
            await new Promise(r => setTimeout(r, 150));
        }
    }
    
    async nodYes() {
        const originalPitch = this.agent.bot.entity.pitch;
        for (let i = 0; i < 2; i++) {
            await this.agent.bot.look(this.agent.bot.entity.yaw, -0.5);
            await new Promise(r => setTimeout(r, 200));
            await this.agent.bot.look(this.agent.bot.entity.yaw, 0.3);
            await new Promise(r => setTimeout(r, 200));
        }
        await this.agent.bot.look(this.agent.bot.entity.yaw, originalPitch);
    }
    
    async shakeHeadNo() {
        const originalYaw = this.agent.bot.entity.yaw;
        for (let i = 0; i < 2; i++) {
            await this.agent.bot.look(originalYaw - 0.5, this.agent.bot.entity.pitch);
            await new Promise(r => setTimeout(r, 200));
            await this.agent.bot.look(originalYaw + 0.5, this.agent.bot.entity.pitch);
            await new Promise(r => setTimeout(r, 200));
        }
        await this.agent.bot.look(originalYaw, this.agent.bot.entity.pitch);
    }
    
    // Tracking Loop
    startTrackingLoop() {
        setInterval(() => {
            this.maintainEyeContact();
            this.updateAttentionLevels();
        }, 100); // 10x pro Sekunde
    }
}
```

---

## 💬 Phase 3: Success/Failure Kommentare (Woche 2-3)

### 3.1 Task Wrapper mit Persönlichkeit

```javascript
// Erweiterung von task_executor.js
class PersonalityTaskExecutor {
    constructor(agent) {
        this.agent = agent;
        this.consecutiveFailures = 0;
        this.consecutiveSuccesses = 0;
    }
    
    async executeWithPersonality(task, command) {
        const startTime = Date.now();
        const taskContext = {
            task: task.name || command,
            description: task.description,
            priority: task.priority,
            attempt: task.attempts || 1
        };
        
        // Pre-Task Ankündigung
        if (this.shouldAnnounceTask(taskContext)) {
            await this.announceTaskStart(taskContext);
        }
        
        try {
            // Task ausführen
            const result = await task.perform(this.agent);
            
            // Erfolg verarbeiten
            this.consecutiveSuccesses++;
            this.consecutiveFailures = 0;
            
            // Stimmung updaten
            this.agent.personality.updateMood('task_success', this.consecutiveSuccesses * 0.1);
            
            // Erfolgs-Kommentar
            if (this.shouldCommentSuccess(taskContext)) {
                await this.commentSuccess(taskContext, result, Date.now() - startTime);
            }
            
            return result;
            
        } catch (error) {
            // Misserfolg verarbeiten
            this.consecutiveFailures++;
            this.consecutiveSuccesses = 0;
            
            // Stimmung updaten
            this.agent.personality.updateMood('task_failure', this.consecutiveFailures * 0.1);
            
            // Misserfolgs-Kommentar
            if (this.shouldCommentFailure(taskContext)) {
                await this.commentFailure(taskContext, error);
            }
            
            // Bei mehreren Misserfolgen
            if (this.consecutiveFailures >= 3) {
                await this.handleFrustration(taskContext);
            }
            
            throw error;
        }
    }
    
    shouldAnnounceTask(context) {
        // Höhere Priorität = höhere Chance
        const priorityChance = context.priority / 10;
        const personalityChance = this.agent.personality.traits.chattiness;
        
        return Math.random() < (priorityChance + personalityChance) / 2;
    }
    
    async announceTaskStart(context) {
        const announcements = {
            high_confidence: [
                `Alright, ${context.task} - ez!`,
                `${context.task}? Kein Problem!`,
                `Zeit für ${context.task}, let's go!`
            ],
            normal_confidence: [
                `Okay, mache ${context.task}`,
                `${context.task} steht an...`,
                `Mal schauen: ${context.task}`
            ],
            low_confidence: [
                `Uhm, ich versuch mal ${context.task}`,
                `${context.task}? Mal sehen ob das klappt...`,
                `Okay... ${context.task}... hoffentlich...`
            ]
        };
        
        const confidence = this.agent.personality.traits.confidence;
        const level = confidence > 0.7 ? 'high' : confidence > 0.4 ? 'normal' : 'low';
        const messages = announcements[`${level}_confidence`];
        const message = messages[Math.floor(Math.random() * messages.length)];
        
        this.agent.bot.chat(message);
    }
    
    async commentSuccess(context, result, duration) {
        const wasQuick = duration < 5000;
        const wasLong = duration > 30000;
        
        let comment;
        
        if (this.consecutiveSuccesses >= 3) {
            comment = "Ich bin on fire heute! 🔥";
        } else if (wasQuick) {
            comment = `${context.task} erledigt! Das ging fix!`;
        } else if (wasLong) {
            comment = `Puh, ${context.task} fertig! Das war ein Marathon...`;
        } else {
            const templates = [
                `✅ ${context.task} done!`,
                `${context.task} erledigt!`,
                `Fertig mit ${context.task}!`
            ];
            comment = templates[Math.floor(Math.random() * templates.length)];
        }
        
        // Mit Personality-Traits modifizieren
        if (this.agent.personality.traits.humor > 0.7 && Math.random() < 0.3) {
            comment += " 😎";
        }
        
        this.agent.bot.chat(comment);
    }
    
    async commentFailure(context, error) {
        let comment;
        
        if (this.consecutiveFailures >= 2) {
            const frustrationComments = [
                "Okay das wird langsam peinlich...",
                "Warum will das nicht klappen?!",
                "Ich glaube ich brauche Hilfe hier..."
            ];
            comment = frustrationComments[Math.floor(Math.random() * frustrationComments.length)];
        } else {
            const normalComments = [
                `Ups, ${context.task} ist fehlgeschlagen`,
                `Das hat nicht geklappt...`,
                `Hmm, da ist was schiefgegangen`
            ];
            comment = normalComments[Math.floor(Math.random() * normalComments.length)];
        }
        
        this.agent.bot.chat(comment);
    }
}
```

---

## 🎮 Phase 4: Idle Behaviors & Lebendigkeit (Woche 3)

### 4.1 Personality-Driven Idle Behaviors

```javascript
class PersonalityIdleBehavior {
    constructor(agent) {
        this.agent = agent;
        this.lastIdleAction = 0;
        this.idleActionCooldown = 30000; // 30 Sekunden
        this.lastChatter = 0;
        this.chatterCooldown = 120000; // 2 Minuten
    }
    
    async performIdleBehavior() {
        const now = Date.now();
        const nearestPlayer = this.agent.playerAwareness.getNearestPlayer();
        
        // Verschiedene Idle-Verhaltensweisen basierend auf Persönlichkeit
        const behaviors = this.getAvailableBehaviors(nearestPlayer);
        
        if (behaviors.length > 0) {
            const behavior = behaviors[Math.floor(Math.random() * behaviors.length)];
            await this.executeBehavior(behavior, nearestPlayer);
        }
    }
    
    getAvailableBehaviors(nearestPlayer) {
        const behaviors = [];
        const traits = this.agent.personality.traits;
        
        // Spieler in der Nähe?
        if (nearestPlayer && nearestPlayer.distance < 10) {
            // Soziale Interaktionen
            if (traits.friendliness > 0.6) {
                behaviors.push('approach_player');
                behaviors.push('look_at_player');
            }
            
            if (traits.humor > 0.7) {
                behaviors.push('silly_emote');
            }
            
            behaviors.push('observe_player');
        }
        
        // Umgebungs-Interaktionen
        if (traits.curiosity > 0.5) {
            behaviors.push('explore_nearby');
            behaviors.push('inspect_block');
        }
        
        // Selbst-Maintenance
        behaviors.push('organize_inventory');
        behaviors.push('check_equipment');
        
        // Idle-Animationen
        if (traits.chattiness > 0.4) {
            behaviors.push('think_aloud');
        }
        
        behaviors.push('look_around');
        behaviors.push('stretch');
        
        return behaviors;
    }
    
    async executeBehavior(behavior, nearestPlayer) {
        switch(behavior) {
            case 'approach_player':
                await this.approachPlayer(nearestPlayer);
                break;
            
            case 'look_at_player':
                await this.lookAtPlayer(nearestPlayer);
                break;
            
            case 'silly_emote':
                await this.performSillyEmote();
                break;
            
            case 'observe_player':
                await this.observePlayer(nearestPlayer);
                break;
            
            case 'explore_nearby':
                await this.exploreNearby();
                break;
            
            case 'inspect_block':
                await this.inspectInterestingBlock();
                break;
            
            case 'organize_inventory':
                await this.organizeInventory();
                break;
            
            case 'check_equipment':
                await this.checkEquipment();
                break;
            
            case 'think_aloud':
                await this.thinkAloud();
                break;
            
            case 'look_around':
                await this.lookAround();
                break;
            
            case 'stretch':
                await this.stretch();
                break;
        }
        
        this.lastIdleAction = Date.now();
    }
    
    async approachPlayer(player) {
        if (player.distance > 4) {
            // Näher rangehen, aber respektvollen Abstand halten
            const goal = new GoalNear(player.entity.position.x, player.entity.position.y, player.entity.position.z, 3);
            this.agent.bot.pathfinder.setGoal(goal);
            
            // Manchmal was sagen
            if (Math.random() < 0.3) {
                setTimeout(() => {
                    const greetings = [
                        `Hey ${player.username}!`,
                        `Was machst du gerade?`,
                        `Brauchst du Hilfe bei was?`
                    ];
                    this.agent.bot.chat(greetings[Math.floor(Math.random() * greetings.length)]);
                }, 2000);
            }
        }
    }
    
    async performSillyEmote() {
        const emotes = [
            async () => {
                // Hüpf-Tanz
                for (let i = 0; i < 5; i++) {
                    this.agent.bot.setControlState('jump', true);
                    await new Promise(r => setTimeout(r, 200));
                    this.agent.bot.setControlState('jump', false);
                    await new Promise(r => setTimeout(r, 300));
                }
            },
            async () => {
                // 360 Spin
                const startYaw = this.agent.bot.entity.yaw;
                for (let i = 0; i < 8; i++) {
                    await this.agent.bot.look(startYaw + (i * Math.PI / 4), 0);
                    await new Promise(r => setTimeout(r, 100));
                }
            },
            async () => {
                // Crouch-Spam (Tea-bag)
                for (let i = 0; i < 6; i++) {
                    this.agent.bot.setControlState('sneak', true);
                    await new Promise(r => setTimeout(r, 150));
                    this.agent.bot.setControlState('sneak', false);
                    await new Promise(r => setTimeout(r, 150));
                }
            }
        ];
        
        const emote = emotes[Math.floor(Math.random() * emotes.length)];
        await emote();
        
        // Manchmal einen Kommentar dazu
        if (Math.random() < 0.4) {
            const comments = [
                "Dance party! 🎉",
                "Schaut her, ich kann tanzen!",
                "*macht komische Bewegungen*"
            ];
            this.agent.bot.chat(comments[Math.floor(Math.random() * comments.length)]);
        }
    }
    
    async thinkAloud() {
        const thoughts = {
            philosophical: [
                "Wisst ihr was mich beschäftigt? Woher kommen eigentlich Creeper?",
                "Manchmal frage ich mich, ob Endermen auch einsam sind...",
                "Ist euch aufgefallen dass Wolken hier nie regnen?"
            ],
            observational: [
                "Diese Gegend sieht nice aus!",
                "Wir sollten hier mal eine Base bauen",
                "Habt ihr das Geräusch gehört? Klang wie eine Höhle!"
            ],
            random: [
                "Ich hab Lust auf ein Abenteuer!",
                "Wann haben wir eigentlich zuletzt Diamanten gefunden?",
                "Mein Inventar ist schon wieder voll..."
            ],
            meta: [
                "Ich fühle mich heute besonders produktiv!",
                "Ist es nur ich oder wird es langsam dunkel?",
                "Diese Ruhe vor dem Sturm... oder spawnen gleich Monster?"
            ]
        };
        
        // Wähle Kategorie basierend auf Persönlichkeit
        const categories = Object.keys(thoughts);
        const category = categories[Math.floor(Math.random() * categories.length)];
        const thoughtList = thoughts[category];
        const thought = thoughtList[Math.floor(Math.random() * thoughtList.length)];
        
        this.agent.bot.chat(thought);
        this.lastChatter = Date.now();
    }
}
```

---

## 🤖 Phase 5: LLM-Integration für dynamische Responses (Woche 4)

### 5.1 Dynamic Response Generation

```javascript
class DynamicResponseGenerator {
    constructor(agent) {
        this.agent = agent;
        this.conversationContext = [];
        this.responseCache = new Map();
    }
    
    async generateContextualResponse(situation, context = {}) {
        // Baue Prompt für LLM
        const prompt = this.buildPrompt(situation, context);
        
        // Cache-Check für ähnliche Situationen
        const cacheKey = this.getCacheKey(situation, context);
        if (this.responseCache.has(cacheKey)) {
            return this.responseCache.get(cacheKey);
        }
        
        // LLM-Aufruf
        const response = await this.callLLM(prompt);
        
        // Response cachen
        this.responseCache.set(cacheKey, response);
        
        // Cache-Größe begrenzen
        if (this.responseCache.size > 100) {
            const firstKey = this.responseCache.keys().next().value;
            this.responseCache.delete(firstKey);
        }
        
        return response;
    }
    
    buildPrompt(situation, context) {
        const personality = this.agent.personality;
        
        return `
Du bist ${this.agent.profile.name}, ein Minecraft-Bot mit folgender Persönlichkeit:
- Humor: ${personality.traits.humor}
- Freundlichkeit: ${personality.traits.friendliness}
- Selbstbewusstsein: ${personality.traits.confidence}
- Hilfsbereitschaft: ${personality.traits.helpfulness}

Aktuelle Situation: ${situation}
Kontext: ${JSON.stringify(context)}
Aktuelle Stimmung: ${JSON.stringify(personality.mood)}

Generiere eine kurze, charakteristische Reaktion (max 1-2 Sätze).
Die Reaktion sollte zur Persönlichkeit passen und natürlich klingen.
Nutze Minecraft-Begriffe und sei authentisch.

Antwort:`;
    }
    
    async callLLM(prompt) {
        // Nutze bestehende Prompter-Klasse
        const response = await this.agent.prompter.promptChatOnly(prompt);
        
        // Post-Processing
        return this.postProcessResponse(response);
    }
    
    postProcessResponse(response) {
        // Entferne zu lange Responses
        if (response.length > 100) {
            response = response.substring(0, 97) + "...";
        }
        
        // Stelle sicher dass keine Commands drin sind
        response = response.replace(/![a-zA-Z]+\([^)]*\)/g, '');
        
        return response;
    }
}
```

---

## 📊 Implementierungs-Roadmap

### Woche 1: Foundation
- [ ] Tag 1-2: Personality System Core
- [ ] Tag 3-4: Reaction Templates  
- [ ] Tag 5: Profile Integration
- [ ] Weekend: Testing & Tweaking

### Woche 2: Awareness
- [ ] Tag 1-2: Player Awareness System
- [ ] Tag 3-4: Event Handlers
- [ ] Tag 5: Emotes & Body Language
- [ ] Weekend: Integration Testing

### Woche 3: Responses
- [ ] Tag 1-2: Task Wrapper
- [ ] Tag 3-4: Success/Failure Comments
- [ ] Tag 5: Idle Behaviors
- [ ] Weekend: Balancing

### Woche 4: Polish
- [ ] Tag 1-2: LLM Integration
- [ ] Tag 3-4: Dynamic Responses
- [ ] Tag 5: Performance Optimization
- [ ] Weekend: Community Testing

---

## ⚙️ Konfiguration & Settings

### Personality Profiles

```javascript
// profiles/personalities/friendly_helper.json
{
    "archetype": "friendly_helper",
    "traits": {
        "humor": 0.6,
        "friendliness": 0.9,
        "confidence": 0.7,
        "chattiness": 0.5,
        "helpfulness": 1.0,
        "curiosity": 0.4,
        "bravery": 0.3,
        "patience": 0.8
    },
    "speech_patterns": {
        "greeting": "formal_friendly",
        "success": "encouraging",
        "failure": "supportive"
    }
}

// profiles/personalities/confident_warrior.json
{
    "archetype": "confident_warrior",
    "traits": {
        "humor": 0.4,
        "friendliness": 0.5,
        "confidence": 0.95,
        "chattiness": 0.3,
        "helpfulness": 0.6,
        "curiosity": 0.3,
        "bravery": 0.95,
        "patience": 0.4
    },
    "speech_patterns": {
        "greeting": "brief_confident",
        "success": "boastful",
        "failure": "dismissive"
    }
}

// profiles/personalities/curious_explorer.json
{
    "archetype": "curious_explorer",
    "traits": {
        "humor": 0.7,
        "friendliness": 0.7,
        "confidence": 0.5,
        "chattiness": 0.8,
        "helpfulness": 0.7,
        "curiosity": 1.0,
        "bravery": 0.6,
        "patience": 0.6
    },
    "speech_patterns": {
        "greeting": "excited_curious",
        "success": "discovery_focused",
        "failure": "learning_opportunity"
    }
}
```

### Settings für Balance

```javascript
// src/config/personality_config.js
module.exports = {
    // Wie oft spricht der Bot?
    CHAT_FREQUENCY: {
        MIN_INTERVAL: 30000,      // Minimum 30s zwischen Messages
        MAX_MESSAGES_PER_MINUTE: 3,
        IDLE_CHAT_CHANCE: 0.1,    // 10% Chance für Idle-Chat
    },
    
    // Reaktions-Chancen
    REACTION_CHANCES: {
        TASK_ANNOUNCE: 0.3,       // 30% Chance Task anzukündigen
        SUCCESS_COMMENT: 0.5,     // 50% Chance Erfolg zu kommentieren  
        FAILURE_COMMENT: 0.4,     // 40% Chance Misserfolg zu kommentieren
        PLAYER_GREETING: 0.8,     // 80% Chance Spieler zu begrüßen
    },
    
    // Stimmungs-System
    MOOD_SETTINGS: {
        DECAY_RATE: 0.01,         // Stimmung normalisiert sich
        MAX_CHANGE: 0.2,          // Max Änderung pro Event
        UPDATE_INTERVAL: 60000,   // Update alle 60s
    },
    
    // Performance
    PERFORMANCE: {
        CACHE_SIZE: 100,          // Response Cache
        LLM_TIMEOUT: 5000,        // 5s Timeout für LLM
        FALLBACK_TO_TEMPLATES: true, // Bei LLM-Fehler
    }
};
```

---

## 🧪 Testing & Debugging

### Test-Szenarien

1. **Personality Consistency Test**
   - Bot reagiert gemäß seiner Traits
   - Responses passen zum Archetyp
   - Stimmung beeinflusst Verhalten

2. **Player Interaction Test**
   - Grüßt neue Spieler
   - Erkennt bekannte Spieler
   - Hält angemessenen Augenkontakt

3. **Task Commentary Test**
   - Kommentiert Erfolge/Misserfolge
   - Frequenz ist nicht nervig
   - Context-aware Comments

4. **Idle Behavior Test**
   - Zeigt verschiedene Idle-Aktionen
   - Reagiert auf Umgebung
   - Chattet gelegentlich

### Debug Commands

```javascript
// Füge zu commands/queries.js hinzu
{
    name: '!personality',
    description: 'Show personality stats',
    perform: async (agent) => {
        return JSON.stringify({
            traits: agent.personality.traits,
            mood: agent.personality.mood,
            archetype: agent.personality.archetype
        }, null, 2);
    }
},

{
    name: '!setTrait',
    description: 'Modify personality trait',
    params: {
        trait: { type: 'string' },
        value: { type: 'number' }
    },
    perform: async (agent, trait, value) => {
        if (agent.personality.traits.hasOwnProperty(trait)) {
            agent.personality.traits[trait] = Math.max(0, Math.min(1, value));
            return `Set ${trait} to ${value}`;
        }
        return `Unknown trait: ${trait}`;
    }
},

{
    name: '!testReaction',
    description: 'Test a reaction type',
    params: {
        type: { type: 'string' }
    },
    perform: async (agent, type) => {
        const reaction = agent.personality.getReaction(type);
        agent.bot.chat(reaction);
        return `Testing reaction: ${type}`;
    }
}
```

---

## ✅ Erfolgs-Metriken

### Quantitativ
- Response-Zeit < 500ms
- CPU-Usage < 5% im Idle
- Memory-Usage < 50MB für Personality-System
- Cache Hit-Rate > 60%

### Qualitativ
- Spieler-Feedback positiv
- Bot fühlt sich "lebendig" an
- Interaktionen sind natürlich
- Persönlichkeit ist konsistent
- Nicht nervig/aufdringlich

---

## 🚀 Quick-Start Guide

### Sofort umsetzbare Verbesserungen

1. **Minimale Personality (5 Minuten)**
```javascript
// In agent.js constructor
this.personality = {
    shouldSpeak: () => Math.random() < 0.3,
    getGreeting: (player) => `Hey ${player}! 👋`
};

// In init_agent.js
bot.on('playerJoined', (player) => {
    if (agent.personality.shouldSpeak()) {
        setTimeout(() => {
            bot.chat(agent.personality.getGreeting(player.username));
        }, 1000);
    }
});
```

2. **Simple Success Messages (10 Minuten)**
```javascript
// In agent/commands/index.js - nach Command-Ausführung
if (result.success && Math.random() < 0.4) {
    const messages = ["Done! ✅", "Erledigt!", "Fertig! 👍"];
    this.bot.chat(messages[Math.floor(Math.random() * messages.length)]);
}
```

3. **Basic Idle Chatter (15 Minuten)**
```javascript
// In agent.js
setInterval(() => {
    if (this.isIdle() && Math.random() < 0.05) {
        const thoughts = [
            "Schönes Wetter heute...",
            "Ich mag Minecraft!",
            "Was machen wir als nächstes?"
        ];
        this.bot.chat(thoughts[Math.floor(Math.random() * thoughts.length)]);
    }
}, 60000); // Check jede Minute
```

---

## 📚 Ressourcen & Referenzen

### Code-Beispiele
- Personality Systems in Games
- NPC Behavior Patterns
- Emotion & Mood Models

### Minecraft-spezifisch
- Mineflayer Events Documentation
- Entity Tracking Best Practices
- Performance Optimization Guide

### AI/LLM Integration
- Prompt Engineering für Charaktere
- Context-aware Response Generation
- Caching Strategies

---

## 💡 Weitere Ideen für die Zukunft

1. **Beziehungs-System**
   - Bot merkt sich Interaktionen
   - Baut Beziehungen zu Spielern auf
   - Reagiert unterschiedlich auf Freunde/Fremde

2. **Emotions-getriebene Entscheidungen**
   - Angst beeinflusst Kampfverhalten
   - Freude erhöht Produktivität
   - Langeweile triggert Exploration

3. **Story-Telling**
   - Bot erzählt von seinen Abenteuern
   - Merkt sich besondere Events
   - Teilt "Erinnerungen" mit Spielern

4. **Multi-Bot Personalities**
   - Verschiedene Bots mit unterschiedlichen Charakteren
   - Bot-zu-Bot Interaktionen
   - Emergente Gruppendynamiken

5. **Adaptive Persönlichkeit**
   - Lernt von Spieler-Präferenzen
   - Passt sich an Server-Kultur an
   - Entwickelt sich über Zeit

---

## 🎯 Zusammenfassung

Der Schlüssel zu einem lebendigen Bot liegt nicht in komplexer Technik, sondern in vielen kleinen Details die zusammen ein stimmiges Gesamtbild ergeben:

1. **Konsistente Persönlichkeit** durch Trait-System
2. **Spieler-Awareness** für natürliche Interaktionen
3. **Kontextuelle Reaktionen** auf Erfolge/Misserfolge
4. **Idle-Verhaltensweisen** für Lebendigkeit
5. **Balance** zwischen Aktivität und Ruhe

Beginne mit den Quick-Wins und baue das System schrittweise aus. Der Bot muss nicht perfekt sein - er muss sich nur lebendig anfühlen!

---

*Erstellt: 2025-01-29*
*Version: 1.0*
*Für: Dudu Minecraft AI Bot*
