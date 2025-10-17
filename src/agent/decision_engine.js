/**
 * LLM Decision Engine
 *
 * Nutzt LLM für komplexe Entscheidungsfindung basierend auf Memory-Context.
 * Hilft bei strategischen Fragen wie:
 * - "Was soll ich als nächstes tun?"
 * - "Ich brauche Enchanting Table - was sind die Schritte?"
 * - "Ich bin stuck bei X - was ist der beste Ansatz?"
 *
 * @author Dudu AI Team
 */

import { TaskPriority } from './task_queue_manager.js';

// ============================================================================
// DECISION ENGINE
// ============================================================================

export class DecisionEngine {
    constructor(agent) {
        this.agent = agent;
        this.lastDecision = null;
        this.lastDecisionTime = 0;
        this.decisionCooldown = 30000; // Minimum 30s zwischen Entscheidungen
    }

    /**
     * Fragt LLM nach einer strategischen Entscheidung
     */
    async makeDecision(context, question) {
        // Cooldown check
        const now = Date.now();
        if (now - this.lastDecisionTime < this.decisionCooldown) {
            console.log('⏰ Decision engine on cooldown');
            return null;
        }

        console.log(`🧠 Decision Engine: ${question}`);

        try {
            // Baue Prompt mit Memory-Context
            const memoryContext = this.agent.contextual_memory.generateContextString();
            const prompt = this.buildDecisionPrompt(memoryContext, context, question);

            // LLM-Abfrage über Prompter
            const response = await this.agent.prompter.promptConvo(prompt);

            // Parse Antwort
            const decision = this.parseDecisionResponse(response);

            this.lastDecision = decision;
            this.lastDecisionTime = now;

            console.log(`🧠 Decision: ${JSON.stringify(decision)}`);
            return decision;

        } catch (error) {
            console.error('Decision engine error:', error);
            return null;
        }
    }

    /**
     * Baut einen Decision-Prompt
     */
    buildDecisionPrompt(memoryContext, situationContext, question) {
        return `You are helping a Minecraft bot make a strategic decision.

CURRENT STATUS:
${memoryContext}

SITUATION:
${situationContext}

QUESTION:
${question}

Please respond with a clear, actionable decision. Consider:
1. Immediate needs (survival, safety)
2. Required steps and their order
3. Resource availability
4. Time/complexity trade-offs

Format your response as:
DECISION: <short summary>
REASONING: <why this is the best approach>
STEPS: <numbered list of specific actions>

Your response:`;
    }

    /**
     * Parsed LLM-Antwort zu strukturierter Decision
     */
    parseDecisionResponse(response) {
        const decision = {
            summary: '',
            reasoning: '',
            steps: [],
            raw: response
        };

        // Parse sections
        const decisionMatch = response.match(/DECISION:\s*(.+?)(?=\n|REASONING:|$)/is);
        const reasoningMatch = response.match(/REASONING:\s*(.+?)(?=\n|STEPS:|$)/is);
        const stepsMatch = response.match(/STEPS:\s*(.+?)$/is);

        if (decisionMatch) {
            decision.summary = decisionMatch[1].trim();
        }

        if (reasoningMatch) {
            decision.reasoning = reasoningMatch[1].trim();
        }

        if (stepsMatch) {
            // Parse numbered steps
            const stepsText = stepsMatch[1].trim();
            const stepLines = stepsText.split('\n')
                .map(line => line.trim())
                .filter(line => line.match(/^\d+\./));

            decision.steps = stepLines.map(line => {
                return line.replace(/^\d+\.\s*/, '').trim();
            });
        }

        return decision;
    }

    // ========================================================================
    // DECISION SCENARIOS - Vordefinierte Entscheidungs-Szenarien
    // ========================================================================

    /**
     * Entscheidung: Was tun wenn idle?
     */
    async decideIdleAction() {
        const context = `The bot is currently idle with no active tasks.`;
        const question = `What productive activity should I do next to improve my situation?`;

        return await this.makeDecision(context, question);
    }

    /**
     * Entscheidung: Komplexes Goal erreichen
     */
    async decideGoalStrategy(goal) {
        const context = `I want to achieve the following goal: "${goal}"`;
        const question = `What is the best strategy and sequence of steps to achieve this goal?`;

        return await this.makeDecision(context, question);
    }

    /**
     * Entscheidung: Stuck/Blocked Situation
     */
    async decideUnstuckStrategy(problem) {
        const context = `I am stuck/blocked: ${problem}`;
        const question = `What is the best way to overcome this obstacle?`;

        return await this.makeDecision(context, question);
    }

    /**
     * Entscheidung: Resource Prioritization
     */
    async decidePriorityResource() {
        const context = `I need to gather resources but have limited time.`;
        const question = `Which resource should I prioritize gathering first?`;

        return await this.makeDecision(context, question);
    }

    /**
     * Entscheidung: Combat vs Flee
     */
    async decideCombatStrategy(enemyType, enemyCount) {
        const context = `I encountered ${enemyCount}x ${enemyType}`;
        const question = `Should I fight or flee? What strategy should I use?`;

        return await this.makeDecision(context, question);
    }

    // ========================================================================
    // DECISION TO TASK - Konvertiert Decision zu ausführbaren Tasks
    // ========================================================================

    /**
     * Konvertiert Decision-Steps zu Task-Queue
     */
    async executeDecision(decision, priority = TaskPriority.NORMAL) {
        if (!decision || !decision.steps || decision.steps.length === 0) {
            console.log('No executable steps in decision');
            return false;
        }

        console.log(`📋 Executing decision: ${decision.summary}`);

        // Füge jeden Step als Task zur Queue hinzu
        for (let i = 0; i < decision.steps.length; i++) {
            const step = decision.steps[i];

            await this.agent.taskQueue.runTask(
                `decision_step_${i + 1}`,
                priority,
                async (agent) => {
                    agent.bot.chat(`📋 Step ${i + 1}/${decision.steps.length}: ${step}`);

                    // Versuche Step als Command zu interpretieren
                    // Annahme: Step enthält Command-Format wie "!collect wood 10"
                    const commandMatch = step.match(/!(\w+)\s*(.*)/);

                    if (commandMatch) {
                        const [_, command, args] = commandMatch;
                        await agent.handleMessage('system', step, -1);
                    } else {
                        // Kein Command erkannt - gebe an User weiter
                        agent.bot.chat(`ℹ️ Manual step needed: ${step}`);
                    }
                },
                {
                    timeout: 300000, // 5 Minuten pro Step
                    resumable: true,
                    metadata: {
                        type: 'decision_execution',
                        stepIndex: i,
                        totalSteps: decision.steps.length,
                        decision: decision.summary
                    }
                }
            );
        }

        return true;
    }

    // ========================================================================
    // AUTO-PLANNING - Automatische Entscheidung bei bestimmten Events
    // ========================================================================

    /**
     * Aktiviert automatische Entscheidungsfindung für bestimmte Situationen
     */
    enableAutoPlanning() {
        const bot = this.agent.bot;

        // Bei Tod: Automatische Recovery-Planung
        bot.on('death', async () => {
            const decision = await this.decideGoalStrategy('recover items from death location');
            if (decision) {
                await this.executeDecision(decision, TaskPriority.HIGH);
            }
        });

        // Bei langer Idle-Zeit: Produktivitäts-Planung
        let idleTime = 0;
        const idleInterval = setInterval(async () => {
            if (this.agent.taskQueue.isIdle()) {
                idleTime += 60000; // 1 Minute

                // Nach 3 Minuten Idle: Frage LLM
                if (idleTime >= 180000) {
                    const decision = await this.decideIdleAction();
                    if (decision) {
                        await this.executeDecision(decision, TaskPriority.LOW);
                    }
                    idleTime = 0; // Reset
                }
            } else {
                idleTime = 0;
            }
        }, 60000); // Check jede Minute

        console.log('🤖 Auto-planning enabled');
    }

    // ========================================================================
    // UTILITIES
    // ========================================================================

    /**
     * Gibt letzte Entscheidung zurück
     */
    getLastDecision() {
        return this.lastDecision;
    }

    /**
     * Zeigt Decision im Chat
     */
    showDecision(decision) {
        if (!decision) return;

        this.agent.bot.chat(`🧠 Decision: ${decision.summary}`);
        this.agent.bot.chat(`💭 Reasoning: ${decision.reasoning}`);

        if (decision.steps.length > 0) {
            this.agent.bot.chat(`📋 Steps:`);
            decision.steps.forEach((step, i) => {
                this.agent.bot.chat(`  ${i + 1}. ${step}`);
            });
        }
    }
}
