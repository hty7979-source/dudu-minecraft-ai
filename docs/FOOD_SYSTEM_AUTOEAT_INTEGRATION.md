# Food-System & Auto-Eat v5.0.3 Integration

**Datum:** 26. Oktober 2025
**Status:** ✅ Abgeschlossen

---

## Übersicht

Das Smart Food System wurde vollständig mit **mineflayer-auto-eat v5.0.3** integriert, um eine nahtlose Koordination zwischen automatischem Essen und intelligenter Nahrungsbeschaffung zu erreichen.

---

## 🎯 Neue Features

### 1. **Intelligente Auto-Eat Koordination**

Das Food-System kann jetzt Auto-Eat temporär deaktivieren während es Nahrung beschafft, um Konflikte zu vermeiden:

```javascript
// Automatisch gesteuert
const result = await smartObtainFood(bot, 5);
// Auto-Eat wird automatisch pausiert & wieder aktiviert

// Manuell gesteuert
const manager = new SmartFoodManager(bot);
await manager.obtainFood(5, { disableAutoEat: false }); // Lässt Auto-Eat aktiv
```

**Implementierung:**
- `disableAutoEat()` - Pausiert Auto-Eat temporär
- `enableAutoEat()` - Aktiviert Auto-Eat wieder
- Try-finally Block garantiert Re-Aktivierung auch bei Fehlern

---

### 2. **Auto-Eat Präferenzen Updates**

Das Food-System aktualisiert automatisch Auto-Eat's Einstellungen basierend auf der Qualität des beschafften Essens:

```javascript
updateAutoEatPreferences(foodType, priority) {
    // High-quality cooked meat (nutrition >= 8)
    if (isCookedMeat && nutrition >= 8) {
        bot.autoEat.setOpts({
            priority: 'saturation',    // Maximiere Saturation
            minHunger: 16              // Warte länger mit Essen
        });
    }

    // Good quality food (nutrition >= 6)
    else if (nutrition >= 6) {
        bot.autoEat.setOpts({
            priority: 'effectiveQuality',
            minHunger: 15
        });
    }

    // Normal food
    else {
        bot.autoEat.setOpts({
            priority: 'foodPoints',
            minHunger: 15
        });
    }
}
```

**Vorteile:**
- Auto-Eat nutzt automatisch die beste Strategie für verfügbares Essen
- Bei hochwertigem Essen wird seltener gegessen (Saturation-Fokus)
- Bei normalem Essen wird häufiger gegessen (FoodPoints-Fokus)

---

### 3. **Food-Stats Analyse mit Auto-Eat API**

Nutzt Auto-Eat's Food-Registry für detaillierte Stats:

```javascript
getBestAvailableFoods() {
    const availableFoods = [];

    for (const food of bot.autoEat.foodsArray) {
        const count = inventory[food.name] || 0;
        if (count > 0) {
            availableFoods.push({
                name: food.name,
                count: count,
                foodPoints: food.foodPoints,
                saturation: food.saturation,
                effectiveQuality: food.foodPoints + food.saturation,
                saturationRatio: food.saturation / food.foodPoints
            });
        }
    }

    return availableFoods.sort((a, b) => b.effectiveQuality - a.effectiveQuality);
}
```

**Verwendung:**
```javascript
const foods = getBestAvailableFoods(bot);
console.log(foods);
// [
//   { name: 'cooked_beef', count: 5, foodPoints: 8, saturation: 12.8, ... },
//   { name: 'bread', count: 10, foodPoints: 5, saturation: 6.0, ... }
// ]
```

---

### 4. **Quality Food Assurance**

Stellt sicher dass immer genug hochwertiges Essen vorhanden ist:

```javascript
// Prüfe ob mindestens 5 Items mit Quality >= 10 vorhanden sind
const hasEnough = await ensureQualityFood(bot, 5, 10);

if (hasEnough) {
    console.log('Ready for adventure!');
} else {
    console.log('Failed to get enough food');
}
```

**Funktionsweise:**
1. Scannt Inventar nach hochwertigem Essen
2. Wenn nicht genug → beschafft automatisch mehr
3. Nutzt `effectiveQuality` Priorität für beste Auswahl

---

### 5. **Manuelles Smart-Eating**

Nutzt Auto-Eat v5.0.3's eat() Methode mit optimaler Food-Auswahl:

```javascript
// Eat best food with custom priority
await eatBestFood(bot, 'saturation');
await eatBestFood(bot, 'effectiveQuality');
await eatBestFood(bot, 'foodPoints');
```

**Vorteile:**
- Manuelle Kontrolle über Eating-Priorität
- Nutzt Auto-Eat's optimierte eat() Implementierung
- Auto re-equip von vorherigem Item

---

## 📋 Neue Public API

### Funktionen

#### `smartObtainFood(bot, amount)`
Beschafft intelligent Nahrung (Legacy-kompatibel)

```javascript
const result = await smartObtainFood(bot, 5);
// { success: true, foodObtained: 5, foodType: 'cooked_beef' }
```

#### `ensureQualityFood(bot, minAmount, minQuality)`
Stellt sicher dass genug hochwertiges Essen vorhanden ist

```javascript
const hasEnough = await ensureQualityFood(bot, 5, 10);
// true/false
```

#### `eatBestFood(bot, priority)`
Isst das beste verfügbare Food mit Smart-Auswahl

```javascript
const success = await eatBestFood(bot, 'effectiveQuality');
// true/false
```

#### `getBestAvailableFoods(bot)`
Gibt detaillierte Stats über verfügbare Foods

```javascript
const foods = getBestAvailableFoods(bot);
// [{ name, count, foodPoints, saturation, effectiveQuality, saturationRatio }]
```

---

## 🔄 Workflow-Beispiele

### Beispiel 1: Automatische Integration

```javascript
// Auto-Eat ist aktiviert
bot.autoEat.enableAuto();

// Bot hat Hunger < 15 → Auto-Eat isst automatisch
// ... Zeit vergeht ...

// Smart Food System beschafft mehr Essen
await smartObtainFood(bot, 10);

// Während Beschaffung:
// 1. Auto-Eat wird pausiert
// 2. Food wird beschafft (Hunt, Cook, Craft)
// 3. Auto-Eat Präferenzen werden aktualisiert
// 4. Auto-Eat wird wieder aktiviert

// Auto-Eat nutzt nun optimale Einstellungen für neues Essen
```

---

### Beispiel 2: Vor längerer Reise

```javascript
// Stelle sicher dass genug hochwertiges Essen vorhanden ist
console.log('Preparing for journey...');

const ready = await ensureQualityFood(bot, 10, 12);

if (ready) {
    // Update Auto-Eat für lange Reise (spare Food)
    bot.autoEat.setOpts({
        minHunger: 12,              // Warte bis Hunger wirklich niedrig ist
        priority: 'saturation'      // Fokus auf Saturation
    });

    console.log('Ready to travel!');
    // Start journey...
} else {
    console.log('Not enough food - staying home');
}
```

---

### Beispiel 3: Combat-Vorbereitung

```javascript
// Vor Combat: Esse bestes Food für volle Health
console.log('Preparing for combat...');

// Stelle sicher dass top-tier Food vorhanden ist
await ensureQualityFood(bot, 5, 15);

// Esse jetzt proaktiv (auch wenn nicht hungrig)
await eatBestFood(bot, 'effectiveQuality');

// Combat Auto-Eat Einstellungen
bot.autoEat.setOpts({
    minHunger: 18,                  // Esse früh um Health hoch zu halten
    minHealth: 14,                  // Bei niedriger Health priorisiere Saturation
    priority: 'effectiveQuality',   // Beste Balance
    eatingTimeout: 5000             // Mehr Zeit im Combat
});

console.log('Combat ready!');
// Enter combat...
```

---

### Beispiel 4: Food-Status Monitoring

```javascript
// Zeige Food-Status im Chat
function showFoodStatus(bot) {
    const foods = getBestAvailableFoods(bot);

    if (foods.length === 0) {
        bot.chat('⚠️ Kein Essen im Inventar!');
        return;
    }

    const best = foods[0];
    const total = foods.reduce((sum, f) => sum + f.count, 0);

    bot.chat(`🍖 Essen: ${total}x gesamt`);
    bot.chat(`✨ Bestes: ${best.count}x ${best.name} (Quality: ${best.effectiveQuality.toFixed(1)})`);

    // Warnung bei wenig hochwertigem Essen
    const qualityCount = foods
        .filter(f => f.effectiveQuality >= 10)
        .reduce((sum, f) => sum + f.count, 0);

    if (qualityCount < 3) {
        bot.chat('⚠️ Wenig hochwertiges Essen - sollte bald nachfüllen!');
    }
}

// Regelmäßig checken
setInterval(() => showFoodStatus(bot), 60000); // Jede Minute
```

---

## 🎮 Prioritäts-Modi Erklärt

### `foodPoints` (Standard)
- **Fokus**: Maximiere Hunger-Wiederherstellung
- **Wann nutzen**: Bei normalem Essen, häufiger Aktivität
- **Beispiel**: Brot, Karotten, normale Steaks

### `saturation` (Premium)
- **Fokus**: Maximiere Saturation (verlangsamt Hunger-Verlust)
- **Wann nutzen**: Bei hochwertigem Essen, lange Reisen
- **Beispiel**: Cooked Beef, Cooked Porkchop, Golden Carrots

### `effectiveQuality` (Balanced)
- **Fokus**: Beste Balance aus FoodPoints + Saturation
- **Wann nutzen**: Bei gemischtem Essen, Combat-Prep
- **Beispiel**: Mix aus verschiedenen Foods

### `saturationRatio` (Efficiency)
- **Fokus**: Saturation pro FoodPoint (Effizienz)
- **Wann nutzen**: Bei limitiertem Inventar, Effizienz-Fokus
- **Beispiel**: Foods mit hohem Saturation-zu-FoodPoint Verhältnis

---

## 🔧 Konfiguration

### Food-System Optionen

```javascript
const manager = new SmartFoodManager(bot);

// Obtai food mit Optionen
await manager.obtainFood(5, {
    disableAutoEat: true,           // Auto-Eat während Beschaffung pausieren
    priority: 'effectiveQuality'    // Priorität für Auto-Eat Updates
});
```

### Auto-Eat Optionen (via Food-System)

Das Food-System setzt automatisch optimale Auto-Eat Optionen, aber du kannst sie überschreiben:

```javascript
bot.autoEat.setOpts({
    priority: 'saturation',
    minHunger: 16,
    minHealth: 14,
    bannedFood: ['rotten_flesh', 'spider_eye', 'poisonous_potato'],
    returnToLastItem: true,
    offhand: false,
    eatingTimeout: 3000,
    strictErrors: false
});
```

---

## 📊 Performance & Effizienz

### Vorteile der Integration

1. **Keine Konflikte**
   - Auto-Eat wird automatisch pausiert während Food-Beschaffung
   - Garantierte Re-Aktivierung via try-finally

2. **Optimale Food-Auswahl**
   - Auto-Eat nutzt automatisch beste Strategie für verfügbares Essen
   - Dynamische Anpassung an Food-Qualität

3. **Reduced Spam**
   - Weniger häufiges Essen bei hochwertigem Food (minHunger höher)
   - Bessere Saturation-Nutzung

4. **Proaktive Planung**
   - `ensureQualityFood()` verhindert Food-Engpässe
   - Automatische Nachfüllung bevor Hunger kritisch wird

---

## 🐛 Error Handling

Alle neuen Methoden haben robustes Error-Handling:

```javascript
try {
    await manager.obtainFood(5);
} catch (error) {
    console.error('Food obtainment failed:', error);
} finally {
    // Auto-Eat wird IMMER wieder aktiviert (wenn es vorher aktiv war)
}
```

**Auto-Eat Checks:**
```javascript
if (!bot.autoEat || !bot.autoEat.foodsArray) {
    // Graceful degradation wenn Auto-Eat nicht verfügbar
    return [];
}
```

---

## 📝 Migration Guide

### Von altem Food-System

**Vorher:**
```javascript
// Einfache Food-Beschaffung
await smartObtainFood(bot, 5);
```

**Nachher (mit neuen Features):**
```javascript
// Stelle sicher dass hochwertiges Essen vorhanden ist
await ensureQualityFood(bot, 5, 10);

// Oder: Beschaffe mit spezifischer Priorität
const manager = new SmartFoodManager(bot);
await manager.obtainFood(5, {
    priority: 'effectiveQuality'
});

// Oder: Esse manuell bestes Food
await eatBestFood(bot, 'saturation');
```

**Backwards Compatible:** Alte `smartObtainFood()` Calls funktionieren weiterhin!

---

## 🎯 Best Practices

### 1. Vor langen Aktivitäten
```javascript
// Ensure quality food vor großen Tasks
await ensureQualityFood(bot, 10, 12);
bot.autoEat.setOpts({ minHunger: 14, priority: 'saturation' });
```

### 2. In Combat
```javascript
// Höhere minHunger für Health-Regen
bot.autoEat.setOpts({ minHunger: 18, minHealth: 12 });
```

### 3. Bei limitiertem Inventar
```javascript
// Nutze saturationRatio für Effizienz
bot.autoEat.setOpts({ priority: 'saturationRatio' });
```

### 4. Monitoring
```javascript
// Regelmäßig Food-Status checken
setInterval(() => {
    const foods = getBestAvailableFoods(bot);
    if (foods.length < 3) {
        ensureQualityFood(bot, 5, 10);
    }
}, 60000);
```

---

## 🔗 Referenzen

- **Auto-Eat v5.0.3 Docs**: [docs/AUTO_EAT_UPDATE.md](./AUTO_EAT_UPDATE.md)
- **Food-System Original**: [docs/SMART_FOOD_SYSTEM.md](./SMART_FOOD_SYSTEM.md)
- **Update-Plan**: [docs/MINEFLAYER_UPDATE_PLAN.md](./MINEFLAYER_UPDATE_PLAN.md)

---

## 📈 Zusammenfassung

**Neue Methoden:**
- `disableAutoEat()` / `enableAutoEat()` - Auto-Eat Kontrolle
- `updateAutoEatPreferences()` - Dynamische Auto-Eat Optimierung
- `getBestAvailableFoods()` - Food-Stats Analyse
- `ensureQualityFood()` - Proaktive Food-Sicherstellung
- `eatBestFood()` - Manuelles Smart-Eating

**Neue Exports:**
- `ensureQualityFood(bot, minAmount, minQuality)`
- `eatBestFood(bot, priority)`
- `getBestAvailableFoods(bot)`

**Verbesserungen:**
- ✅ Keine Konflikte zwischen Auto-Eat und Food-System
- ✅ Dynamische Auto-Eat Optimierung basierend auf Food-Qualität
- ✅ Detaillierte Food-Stats via Auto-Eat API
- ✅ Proaktive Food-Management Features
- ✅ Backwards Compatible

---

**Status:** ✅ Production Ready
**Testing:** Erfolgreich
**Integration:** Vollständig

*Erstellt am: 26. Oktober 2025*
