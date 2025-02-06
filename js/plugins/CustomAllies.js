/*:
 * @plugindesc Autonomous Actor Follower Events System
 * @author Your Name
 * 
 * @help
 * This plugin allows empty events to be assigned actor properties and 
 * autonomous combat behavior.
 * 
 * Plugin Command:
 * AssignAutonomousActor eventId actorId
 * - Assigns an actor to an event and enables autonomous behavior
 * 
 * Example:
 * AssignAutonomousActor 1 2  // Assigns Actor ID 2 to Event ID 1
 */

(function() {

    // Store original Game_Interpreter method
    var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);
        
        if (command === 'AssignAutonomousActor') {
            var eventId = parseInt(args[0]);
            var actorId = parseInt(args[1]);
            var event = $gameMap.event(eventId);
            if (event) {
                event.setupAsAutonomousActor(actorId);
            }
        }
    };

    // Add new methods to Game_Event
    Game_Event.prototype.setupAsAutonomousActor = function(actorId) {
        this._actorId = actorId;
        this._actor = $gameActors.actor(actorId);
        this._isAutonomousActor = true;
        this._targetId = null;
        this._searchRange = 5;
        this._attackRange = 2;
        this._waitCount = 0;
        this._inBattle = false;
        
        // Set character image to match actor
        this._characterName = this._actor.characterName();
        this._characterIndex = this._actor.characterIndex();
        
        // Initialize autonomous movement and battle states
        this.setupAutonomousBehavior();
    };

    Game_Event.prototype.setupAutonomousBehavior = function() {
        // Set up autonomous movement route
        var moveRoute = {
            list: [
                {code: 45, parameters: ["this.updateAutonomousBehavior()"]},
                {code: 0}
            ],
            repeat: true,
            skippable: true
        };
        
        this.forceMoveRoute(moveRoute);
    };

    Game_Event.prototype.updateAutonomousBehavior = function() {
        if (!this._isAutonomousActor) return;
        
        if (this._waitCount > 0) {
            this._waitCount--;
            return;
        }

        // Search for enemies if not in battle
        if (!this._inBattle) {
            this.searchForTarget();
        }

        // Handle battle behavior if target exists
        if (this._targetId) {
            this.updateBattleBehavior();
        } else {
            this.followPlayer();
        }
    };

    Game_Event.prototype.searchForTarget = function() {
        var enemies = $gameMap.events().filter(function(event) {
            return event && event._enemyId;
        });

        var nearestEnemy = null;
        var shortestDistance = this._searchRange;

        enemies.forEach(function(enemy) {
            var distance = this.distanceFromCharacter(enemy);
            if (distance <= shortestDistance) {
                shortestDistance = distance;
                nearestEnemy = enemy;
            }
        }, this);

        if (nearestEnemy) {
            this._targetId = nearestEnemy._eventId;
            this._inBattle = true;
            // Switch to battle state
            $gameSelfSwitches.setValue([this._mapId, this._eventId, 'A'], true);
        }
    };

    Game_Event.prototype.updateBattleBehavior = function() {
        var target = $gameMap.event(this._targetId);
        
        // Check if target is still valid
        if (!target || target._erased) {
            this.endBattle();
            return;
        }

        var distance = this.distanceFromCharacter(target);
        
        if (distance <= this._attackRange) {
            // Execute attack
            this.executeAttack(target);
        } else {
            // Move toward target
            this.moveTowardCharacter(target);
        }
    };

    Game_Event.prototype.executeAttack = function(target) {
        // Face target
        this.turnTowardCharacter(target);
        
        // Execute attack animation
        var skillId = this._actor.attackSkillId();
        var skill = $dataSkills[skillId];
        
        // Show animation
        target.requestAnimation(skill.animationId);
        
        // Calculate and apply damage
        var damage = this._actor.attackDamage(target);
        if (target.receiveDamage) {
            target.receiveDamage(damage);
        }
        
        // Add wait time between attacks
        this._waitCount = 60;
    };

    Game_Event.prototype.endBattle = function() {
        this._targetId = null;
        this._inBattle = false;
        // Switch back to normal state
        $gameSelfSwitches.setValue([this._mapId, this._eventId, 'A'], false);
    };

    Game_Event.prototype.followPlayer = function() {
        var distance = this.distanceFromCharacter($gamePlayer);
        if (distance > 3) {
            this.moveTowardCharacter($gamePlayer);
        }
    };

    Game_Event.prototype.distanceFromCharacter = function(character) {
        var dx = Math.abs(this.x - character.x);
        var dy = Math.abs(this.y - character.y);
        return Math.sqrt(dx * dx + dy * dy);
    };

    // Add damage handling to Game_Event
    Game_Event.prototype.receiveDamage = function(damage) {
        if (this._enemyId) {
            // Handle enemy receiving damage
            if (this._hp === undefined) {
                this._hp = this.enemy().params[0]; // Set initial HP if not set
            }
            
            this._hp -= damage;
            
            if (this._hp <= 0) {
                this._hp = 0;
                this.erase();
            }
            
            // Show damage popup if you have a damage popup system
            if (Imported.MOG_ChronoEngine) {
                this.requestAnimation(1); // Hit animation
            }
        }
    };

})();