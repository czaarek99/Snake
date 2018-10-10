/**
 *
 * Game entry point
 *
 * */

const TICKRATE = 20;
document.addEventListener("DOMContentLoaded", () => {
	let game = SnakeGame.getGame();

	document.addEventListener("keydown", event => {
		game.onKeyDown(event.keyCode);
	});

	//Run at 20 ticks
	setInterval(() => {
		game.update();
	}, 1000 / TICKRATE);

	game.paint();

	setInterval(() => {
		game.save();
	}, 5000);
});

/**
 *
 * Enum classes
 * */

const directions = [];
class Direction {

	constructor(direction, oppositeDirection, headRotation, applyMovement){
		this.direction = direction;
		this.oppositeDirection = oppositeDirection;
		this.headRotation = headRotation;
		this.applyMovement = applyMovement;
	}

	isOpposite(direction){
		return this.oppositeDirection == direction.direction;
	}

	static addDirection(direction){
		directions.push(direction);
		return direction;
	}

}

Direction.LEFT = Direction.addDirection(new Direction("left", "right", 0, (entity, amount) => {
	entity.x -= amount;
}));
Direction.UP = Direction.addDirection(new Direction("up", "down", 90,(entity, amount) => {
	entity.y -= amount;
}));
Direction.RIGHT = Direction.addDirection(new Direction("right", "left", 180, (entity, amount) => {
	entity.x += amount;
}));
Direction.DOWN = Direction.addDirection(new Direction("down", "up", 270, (entity, amount) => {
	entity.y += amount;
}));
Object.freeze(directions);

const gameStates = new Set();
class GameState {

	constructor(state){
		this.state = state;
	}

	static getAllStates(){
		return gameStates;
	}

	static addState(gameState){
		gameStates.add(gameState);
		return gameState;
	}

}

GameState.RUNNING = GameState.addState(new GameState("running"));
GameState.PAUSED = GameState.addState(new GameState("paused"));
GameState.STOPPED = GameState.addState(new GameState("stopped"));
Object.freeze(gameStates);

/**
 *
 * Game logic
 *
 * */
class SnakeGame {

	initialize() {
		this.gameState = GameState.STOPPED;
		
		this.menuWidth = 300;
		$("#newGameOverlay").addEventListener("click", () => {
			this.startNewGame();
		});

		if(Cookies.get("savedValues") === undefined){
			this.savedValues = {
				highscore: 0,
				longestLifeTicks: 0,
				unlockedAchievements: []
			};

		} else {
			this.savedValues = Cookies.getJSON("savedValues");
		}

		this.ticks = 0;
		this.apples = 0;

		this.upgrades = new Map();
		this.purchases = new Map();
		this.settings = new Map();

		this.achievements = new Map();

		this.snareImg = loadImage("snare.ico");
		this.appleImg = loadImage("apple.png");
		this.bombImg = loadImage("bomb.png");
		this.snakeHeadImg = loadImage("parts/head.png");
		this.snakeCurveImg = loadImage("parts/curve.png");
		this.snakeStraightImg = loadImage("parts/straight.png");
		this.snakeTailImg = loadImage("parts/tail.png");
		this.questionImg = loadImage("question.png");

		let addWithID = (collection, item) => {
			collection.set(item.id, item);
			return item;
		};

		//Upgrades
		//TODO: Fix up these images
		addWithID(this.upgrades, new Upgrade("bombsquad", "Bomb Squad", "Defuse any bomb you run into", this.bombImg, 125, () => {
			this.currentSnake.canDefuseBombs = true;
		}, null));
		addWithID(this.upgrades, new Upgrade("appleshrink", "Shrinking Apples", "Every time you eat an apple your snake shrinks!", loadImage("coincut.png"), 100, null, null));
		addWithID(this.upgrades, new Upgrade("phase", "Phasing Snake", "Allows you to phase through yourself without dying.", this.snakeHeadImg, 100, null, null));
		addWithID(this.upgrades, new Upgrade("doubleapples", "Double Apples", "All apples are worth 2x", loadImage("doublecoin.png"), 30, null, null));
		addWithID(this.upgrades, new Upgrade("stopsnake", "Stopping Snake", "Stop your snake by pressing the spacebar!", this.snakeHeadImg, 80, null, null));
		addWithID(this.upgrades, new Upgrade("slowgrow", "Slow Growth", "The snake grows slower when you eat an apple", loadImage("halfapple.png"), 25, () => {
			this.currentSnake.snakeGrowthOnFeed /= 2;
		}, null));

		//Purchases
		addWithID(this.purchases, new Purchase("ai", "Computer Snake", "Spawn a snake to help you out with collecting apples", this.snakeHeadImg, 200, (purchase) => {
			//TODO: Fix this to only allow one AI snake
			purchase.disabled = true;
			this.addEntity(new ComputerSnake(5));

		} , null));
		addWithID(this.purchases, new Purchase("defuse", "Defuse all bombs", "Defuses all the bombs on the field", this.bombImg, 20, () => {
			this.bombs.forEach((bomb) => {
				bomb.kill();
			});
		}, null));
		addWithID(this.purchases, new Purchase("cut", "Cut in Half", "Cuts your snake in half", loadImage("scissors.png"), 10, () => {
			let length = this.currentSnake.getChildAmount();

			if (length > 2) {
				for (let i = Math.floor(length / 2); i < length; i++) {
					this.currentSnake.popButt();
				}
			}
		}, (purchase) => {
			let length = this.currentSnake.getChildAmount();

			purchase.disabled = length <= 10;
		}));
		addWithID(this.purchases, new Purchase("suicide", "Suicide", "The easy way out. End it right here right now.", this.snareImg, 5, () => {
			this.unlockAchievement("kys");
			this.stopGame();
		}, null));


		//Achievements
		//TODO: Different icons? More achievements
		for(let i = 4; i < 14; i++){
			let id = i - 3;
			let required = Math.pow(2, i);

			addWithID(this.achievements, new Achievement(`apples${id}`, `Apple Collector ${id}`, `Collect ${required} apples`, this.appleImg, () => {
				return this.apples >= required;
			}));
		}

		addWithID(this.achievements, new Achievement("kys", "The easy way out", "Take your life at least once", this.snareImg, null));
		addWithID(this.achievements, new Achievement("boom", "Allahu Akbar", "Run into a bomb", this.bombImg, null));
		addWithID(this.achievements, new Achievement("upgrade", "Upgrader", "Purchase an upgrade", loadImage("upgrade.png"), null));

		this.generateHTML();

		let snCanvas = this.snakeCanvas = new SnakeCanvas();
		this.background = new BackgroundEntity(1, 1, 1, 1, "#1684AE");
		this.borderBackground = new BackgroundEntity(0, 0, 0, 0, "#C76B28");

		let centeredTextUpdate = function(){
			this.x = snCanvas.getScaledWidth() / 2;
			this.y = snCanvas.getScaledHeight() / 2;
		};

		this.appleText = new TextEntity(0, 0, "#589943", "0", "Arial 20px", "center");
		this.appleText.update = centeredTextUpdate;
		this.pausedText = new TextEntity(0, 0, "black", "Paused!", "Arial 5px", "center");
		this.pausedText.update = centeredTextUpdate;

		this.pausedText.statesToPaintAt = new Set([GameState.PAUSED]);
		this.pausedText.statesToUpdateAt = new Set([GameState.PAUSED]);

		this.entities = new Set();
		this.currentFood = null;
		this.bombs = new Set();
		this.addEntity(this.borderBackground);
		this.addEntity(this.background);
		this.addEntity(this.appleText);
		this.addEntity(this.pausedText);

		this.keycodeDirectionMap = {};
		//WASD = Arrow Keys = Direction
		this.keycodeDirectionMap[65] = this.keycodeDirectionMap[37] = Direction.LEFT;
		this.keycodeDirectionMap[87] = this.keycodeDirectionMap[38] = Direction.UP;
		this.keycodeDirectionMap[68] = this.keycodeDirectionMap[39] = Direction.RIGHT;
		this.keycodeDirectionMap[83] = this.keycodeDirectionMap[40] = Direction.DOWN;

		let canvasEl = this.snakeCanvas.canvasEl;
		canvasEl.addEventListener("mouseout", () => {
			if(this.gameState == GameState.RUNNING){
				this.gameState = GameState.PAUSED;
			}
		});

		canvasEl.addEventListener("mouseenter", () => {
			if(this.gameState == GameState.PAUSED) {
				this.gameState = GameState.RUNNING;
			}

		});

		this.updateNewGameOverlay(true);
		this.save();
	}

	generateHTML() {
        $("#menuContainer").style.width = this.menuWidth + "px";

		let generatePurchasesFunc = (value) => {
			let container = value instanceof Upgrade ?
				$("#upgradesContainer") : $("#purchasesContainer");

			value.generate(container);
		};

		this.upgrades.forEach(generatePurchasesFunc);
		this.purchases.forEach(generatePurchasesFunc);

		let achievementsList = $("#achievementsList");
		this.achievements.forEach((value) => {
			value.generate(achievementsList)
		});

		let fillersToAdd = this.achievements.size % 4;
		for(let i = 0; i < fillersToAdd; i++){
			achievementsList.insertAdjacentHTML("beforeend", "<div class='achievement achievementFiller'></div>");
		}

		this.savedValues.unlockedAchievements.forEach((achievementID) => {
			this.achievements.get(achievementID).unlock();
		});
	}

	static getGame() {
		if (SnakeGame.game === undefined) {
			SnakeGame.game = new SnakeGame();
			SnakeGame.game.initialize();
		}

		return SnakeGame.game;
	}

	updateHTML(){
		$("#bombsText").innerHTML = "Bombs: " + this.bombs.size;
		$("#timeText").innerHTML = "Time elapsed: " + this.convertTicksToString();
		$("#appleText").innerHTML = "Apples: " + this.apples;
	}

	convertTicksToString(ticks = this.ticks){
		let secondsSinceStart = Math.floor(ticks / TICKRATE);

		let minutes = Math.floor(secondsSinceStart / 60);
		let seconds = secondsSinceStart % 60;

		if(seconds > 0 || minutes > 0){
			let minutesText;
			if(minutes == 0){
				minutesText = "";
			} else if(minutes == 1){
				minutesText = "1 min ";
			} else {
				minutesText = minutes + " min "
			}

			let secondsText;
			if(seconds == 0){
				secondsText = "";
			} else if(seconds == 1){
				secondsText = "1s";
			} else {
				secondsText = seconds + "s";
			}

			return minutesText + secondsText;
		} else {
			return "0s";
		}
	}

	addEntity(entity) {
		this.entities.add(entity);
	}

	spawnNewFood(){
		if(this.currentFood != null){
			this.currentFood.kill();
		}

		let newFood = new FoodEntity();
		this.currentFood = newFood;
		this.addEntity(newFood);
	}

	onKeyDown(keyCode) {
		if(this.gameState == GameState.RUNNING){
			//Prevent buttonmashing
			if (this.prevKeyodeTicks != this.ticks) {
				//Check for spacebar
				if(keyCode == 32){
					if(this.hasUpgrade("stopsnake")){
						this.currentSnake.stopped = !this.currentSnake.stopped;
					}
				} else {
					let keycodeMap = this.keycodeDirectionMap;

					if (keycodeMap[keyCode] !== undefined) {
						let newDirection = keycodeMap[keyCode];

						this.currentSnake.setDirection(newDirection);
					}
				}
			}

			this.prevKeyodeTicks = this.ticks;
		}
	}

	setRandomPositionInside(entity, inside) {
		let respawn = true;

		while (respawn) {
			respawn = false;

			entity.x = getRandomDec(inside.x + entity.width, inside.width - entity.width);
			entity.y = getRandomDec(inside.y + entity.height, inside.height - entity.height);

			this.entities.forEach(collidingEntity => {
				if (collidingEntity.collidable) {
					if (!respawn && collidingEntity != entity && collidingEntity.collidesWith(entity)) {
						respawn = true;
					}
				}
			});
		}
	}

	startNewGame() {
		this.updateNewGameOverlay(false);
        this.gameState = GameState.RUNNING;

		this.currentSnake = new PlayerSnake(2);
		this.addEntity(this.currentSnake);
		this.spawnNewFood();

		this.ticks = 0;
		this.apples = 0;
		this.nextBombTicks = this.getRandFutureTicks(5, 10);

		this.update();
	}

	stopGame(){
        this.gameState = GameState.STOPPED;

        this.entities.forEach(entity => {
            if (!entity.dead) {
                entity.kill();
            }
        });

		this.bombs.clear();

        if(this.apples > this.savedValues.highscore){
			this.savedValues.highscore = this.apples;
		}

		let longestLifeTicks = this.savedValues.longestLifeTicks;
		if(this.ticks > longestLifeTicks){
			this.savedValues.longestLifeTicks = this.ticks;
		}

        this.upgrades.forEach((value) => {
            value.purchased = false;
        });

		this.save();
		this.updateNewGameOverlay(true);
	}

	updateNewGameOverlay(show){
		let overlayElement = $("#newGameOverlay");
		if(show){
			$("#highscoreText").innerText = "Highscore: " + this.savedValues.highscore + " apples";
			$("#lifeText").innerText = "Longest life: " + this.convertTicksToString(this.savedValues.longestLifeTicks);
			overlayElement.style.display = "flex";
		} else {
			overlayElement.style.display = "none";
		}

	}

	getRandFutureTicks(minSeconds, maxSeconds){
		return this.ticks + getRandomInt(minSeconds, maxSeconds) * TICKRATE;
	}

	getFutureTicks(seconds){
		return this.ticks + seconds * TICKRATE;
	}

	hasUpgrade(id) {
		return this.upgrades.get(id).purchased;
	}

	unlockAchievement(id){
		let achievement = this.achievements.get(id);
		achievement.unlock();
	}

	save(){
		let savedAchievements = [];

		this.achievements.forEach((achievement) => {
			if(!achievement.locked){
				savedAchievements.push(achievement.id);
			}
		});

		this.savedValues.unlockedAchievements = savedAchievements;

		Cookies.set("savedValues", this.savedValues, {expires: 365});
	}

	paint(){
		let snCanvas = this.snakeCanvas;
		let canvasCont = snCanvas.canvasCtx;

		snCanvas.updateCanvasSize();
		snCanvas.scaleNext();

		if(this.snakeCanvas.isBigEnough()){
			this.entities.forEach(entity => {
				if(entity.statesToPaintAt.has(this.gameState)){
					snCanvas.paintEntity(entity);
				}
			});
		} else {
			canvasCont.fillStyle = "black";
			canvasCont.font = "10px Arial";
			canvasCont.textAlign = "start";
			canvasCont.fillText("Window too small", 0, 30);
		}

		window.requestAnimationFrame(() => {
			SnakeGame.getGame().paint();
		});
	}

	update() {
		if(this.gameState != GameState.STOPPED){
			this.updateHTML();

			let update = (value) => {
				value.update();
			};

			this.upgrades.forEach(update);
			this.purchases.forEach(update);
			this.achievements.forEach(update);
		}

		let entities = this.entities;
		let bombs = this.bombs;
		if(this.snakeCanvas.isBigEnough()){
			//Update living entities, remove dead ones
			entities.forEach(entity => {
				if (entity.dead) {
					entities.delete(entity);

					//Make sure to remove dead bomb from array too
					if(entity instanceof BombEntity){
						bombs.delete(entity);
					}
				} else if(entity.statesToUpdateAt.has(this.gameState)){
					entity.update();
				}
			});

			if(this.gameState == GameState.RUNNING){
				this.ticks++;

				//Check for collisions, avoid checking self collisions
				entities.forEach(entity1 => {
					entities.forEach(entity2 => {
						if (entity1 != entity2 &&
							!entity1.dead && !entity2.dead &&
							entity1.collidable && entity2.collidable && entity1.collidesWith(entity2)) {
							entity1.onCollide(entity2);
						}
					})
				});

				if(this.nextBombTicks <= this.ticks){
					let bomb = new BombEntity();
					this.addEntity(bomb);
					bombs.add(bomb);
					this.nextBombTicks = this.getRandFutureTicks(10, 30);

					setTimeout(() => {
						bomb.ignite();
					}, 3000);

					const MAX_BOMBS = 10;
					if(bombs.size > MAX_BOMBS){
						//Delete the oldest bomb, make sure the amount of bombs doesn't exceed MAX_BOMBS
						for(let bomb of bombs.values()){
							bombs.delete(bomb);
							bomb.kill();
							break;
						}
					}
				}
			}

			this.appleText.text = this.apples;
		}
	}

}

class SnakeCanvas {

	constructor() {
		this.canvasEl = $("#snakeCanvas");
		this.canvasCtx = this.canvasEl.getContext("2d");

		this.scalingCanvasEl = document.createElement("canvas");
		this.scalingCanvasCtx = this.scalingCanvasEl.getContext("2d");
		this.secondScalingCanvas = document.createElement("canvas");
		this.secondScalingCanvasCtx = this.secondScalingCanvas.getContext("2d");

		this.scale = 1;
		this.updateCanvasSize();
	}

	paintEntity(entity) {
		entity.paint(this);
	}

	updateCanvasSize() {
		let game = SnakeGame.getGame();
		let context = this.canvasCtx;

		let devicePixelRatio = window.devicePixelRatio || 1;
		let backingStoreRatio =
			context.webkitBackingStorePixelRatio ||
			context.mozBackingStorePixelRatio ||
			context.msBackingStorePixelRatio ||
			context.oBackingStorePixelRatio ||
			context.backingStorePixelRatio || 1;

		let ratio = devicePixelRatio / backingStoreRatio;

		let canvas = this.canvasEl;
		let canvasWidth = document.body.clientWidth - game.menuWidth;
		let canvasHeight = document.body.clientHeight;

		if(devicePixelRatio !== backingStoreRatio){
			canvas.style.width = canvasWidth + "px";
			canvas.style.height = canvasHeight + "px";
		} else {
			ratio = 1;
		}

		canvas.width = canvasWidth * ratio;
		canvas.height = canvasHeight * ratio;

		let minPixels = 1900;
		let maxPixels = 2100;

		while(this.isBigEnough()){
			let pixels = this.getScaledHeight() * this.getScaledWidth();
			if(pixels > maxPixels){
				this.scale += 0.03;
			} else if(pixels < minPixels){
				this.scale -= 0.03;
			} else {
				break;
			}
		}
	}

	//TODO: Buffer of scaled images, will use more memory but less cpu
	drawScaledImage(img, x, y, width, height){
		let canvasCtx = this.canvasCtx;
		let sourceWidth = img.width;
		let sourceHeight = img.height;
		let targetWidth = this.scale * width;

		let steps = Math.max(0, Math.floor(Math.log(sourceWidth / targetWidth) / log2));

		if(steps > 0){
			let scalingCtx = this.scalingCanvasCtx;
			let scalingCanvas = this.scalingCanvasEl;

			let secondScalingCtx = this.secondScalingCanvasCtx;
			let secondScalingCanvas = this.secondScalingCanvas;

			let currentWidth = sourceWidth;
			let currentHeight = sourceHeight;

			scalingCanvas.width = currentWidth;
			scalingCanvas.height = currentHeight;

			scalingCtx.clearRect(0, 0, scalingCanvas.width, scalingCanvas.height);
			scalingCtx.drawImage(img, 0, 0, sourceWidth, sourceHeight);

			for(let i = 0; i < steps; i++){
				currentWidth /= 2;
				currentHeight /= 2;

				if(i % 2 == 0){
					secondScalingCanvas.width = currentWidth;
					secondScalingCanvas.height = currentHeight;
					secondScalingCtx.drawImage(scalingCanvas, 0, 0, currentWidth, currentHeight);
					scalingCtx.clearRect(0, 0, scalingCanvas.width, scalingCanvas.height);
				} else {
					scalingCanvas.width = currentWidth;
					scalingCanvas.height = currentHeight;
					scalingCtx.drawImage(secondScalingCanvas, 0, 0, currentWidth, currentHeight);
					secondScalingCtx.clearRect(0, 0, secondScalingCanvas.width, secondScalingCanvas.height);
				}

			}

			let finalCanvas = (steps % 2 == 0) ? scalingCanvas : secondScalingCanvas;
			canvasCtx.drawImage(finalCanvas, 0, 0, currentWidth, currentHeight, x, y, width, height);
		} else {
			canvasCtx.drawImage(img, x, y, width, height);
		}
	}

	scaleNext() {
		this.canvasCtx.scale(this.scale, this.scale);
	}

	getScaledHeight() {
		return this.canvasEl.height / this.scale;
	}

	getScaledWidth() {
		return this.canvasEl.width / this.scale;
	}

	getRealWidth() {
		return this.canvasEl.width;
	}

	getRealHeight() {
		return this.canvasEl.height;
	}

	isBigEnough(){
		let minCanvasSize = 200;
		return !(this.getRealHeight() < minCanvasSize || this.getRealWidth() < minCanvasSize);
	}
}

class Updateable {

	update() {}
}

class Entity extends Updateable {

	constructor(x, y, width, height) {
		super();
		this._x = x;
		this._y = y;
		this.width = width;
		this.height = height;
		this.dead = false;
		this.collidable = true;

		this.statesToPaintAt = new Set([GameState.RUNNING]);
		this.statesToUpdateAt = new Set([GameState.RUNNING]);
	}

	//TODO: There has to be a better way for these methods
	collidesWith(otherEntity) {
		let entitiesToCheck = this.getEntitiesToCheck(otherEntity);

		for(let i = 0; i < entitiesToCheck.length; i++){
			let entityToCheck = entitiesToCheck[i];

			//https://silentmatt.com/rectangle-intersection/
			let ax2 = this.x + this.width;
			let ay2 = this.y + this.height;

			let bx2 = entityToCheck.x + entityToCheck.width;
			let by2 = entityToCheck.y + entityToCheck.height;

			if(this.x < bx2 && ax2 > entityToCheck.x && this.y < by2 && ay2 > entityToCheck.y){
				return true;
			}
		}

		return false;
	}

	isInside(otherEntity) {
		let entitiesToCheck = this.getEntitiesToCheck(otherEntity);

		for(let i = 0; i < entitiesToCheck.length; i++){
			let entityToCheck = entitiesToCheck[i];

			let otherRightX = entityToCheck.width + entityToCheck.x;
			let otherBottomY = entityToCheck.height + entityToCheck.y;

			if(this.x <= otherRightX && this.y <= otherBottomY
				&& this.x + this.width <= otherRightX && this.y + this.height <= otherBottomY
				&& this.x >= entityToCheck.x && this.y >= entityToCheck.y){
				return true;
			}
		}

		return false;
	}

	getEntitiesToCheck(entity){
		if(entity instanceof MultiPartEntity){
			return entity.getChildren();
		} else {
			return [entity];
		}
	}

	kill() {
		this.dead = true;
	}

	paint(canvas) {}

	onCollide(otherEntity) {}

	move(direction, amount){
		direction.applyMovement(this, amount);
	}

	get x(){
		return this._x;
	}

	set x(x){
		this._x = x;
	}

	get y(){
		return this._y;
	}

	set y(y){
		this._y = y;
	}
}

class MultiPartEntity extends Entity {

	constructor(x, y, width, height) {
		super(-5000, -5000, -5000, -5000);
		this.children = [];
	}

	getChildren(){
		return this.children;
	}

	getChildAmount(){
		return this.children.length;
	}

	forEachChild(func){
		this.children.forEach(func);
	}

	collidesWith(otherEntity){
		let entities = this.getChildren();
		for(let i = 0; i < entities.length; i++){
			let entity = entities[i];

			if(entity.collidesWith(otherEntity)){
				return true;
			}
		}

		return false;
	}
}

class Snake extends MultiPartEntity {

	constructor(startY) {
		super();
		this.SNAKE_START_LENGT = 5;
		this.snakeGrowthOnFeed = 4;
		this.growthLeft = 0;
		this.stopped = false;
		this.canDefuseBombs = false;
		this.snakeDirection = Direction.RIGHT;

		//Initialize start snake
		for (let i = this.SNAKE_START_LENGT + 2; i > 2; i--) {
			this.children.push(new SnakePartEntity(i, startY, SnakeGame.getGame().snakeStraightImg))
		}

	}

	getHead() {
		return this.children[0];
	}

	getButt() {
		return this.children[this.getChildAmount() - 1];
	}

	popButt() {
		return this.children.pop();
	}

	grow(parts = 1) {
		this.growthLeft += parts;
	}

	headCollidesWith(item) {
		return this.getHead().collidesWith(item);
	}

	//TODO: Fix this algorithm. Make it also work with decimals
	move(direction, amount){
        for(let i = 0; i < amount; i++){
            let snakeHead = this.getHead();

            /*
             If the snake needs to grow then append a new part in front of it
             Otherwise move the butt to the front and make it the new head
             and leave updating the image to the paint() function
             */
            if(this.growthLeft > 0){
                let newPart = new SnakePartEntity(snakeHead.x, snakeHead.y);
                newPart.move(direction, 1);

                this.growthLeft--;
                this.children.unshift(newPart);
            } else {
                let snakeButt = this.popButt();

                if (direction == Direction.LEFT) {
                    snakeButt.x = snakeHead.x - 1;
                    snakeButt.y = snakeHead.y;
                } else if (direction == Direction.UP) {
                    snakeButt.y = snakeHead.y - 1;
                    snakeButt.x = snakeHead.x;
                } else if (direction == Direction.RIGHT) {
                    snakeButt.x = snakeHead.x + 1;
                    snakeButt.y = snakeHead.y;
                } else if (direction == Direction.DOWN) {
                    snakeButt.y = snakeHead.y + 1;
                    snakeButt.x = snakeHead.x;
                }

                //Move the butt in front of the snake, making it the new head
                this.children.unshift(snakeButt);
            }
        }
    }

	isInside(otherEntity) {
		for (let i = 0; i < this.getChildAmount(); i++) {
            let part = this.children[i];

			if (part.isInside(otherEntity)) {
				return true;
			}
		}
	}

	paint(canvas) {
		this.forEachChild((part) => {
			canvas.paintEntity(part);
		});
	}

	update() {
		if(!this.stopped){
			this.move(this.snakeDirection, 1);
		}

		let head = this.getHead();
		let game = SnakeGame.getGame();
		let butt = this.getButt();
		let parts = this.children;
		let beforeButtPart = parts[parts.length - 2];

		//Handle rotations for head and butt
		head.image = game.snakeHeadImg;
		head.rotation = this.snakeDirection.headRotation;

		let newButtRotation = 0;
		butt.image = game.snakeTailImg;

		if (beforeButtPart.x < butt.x) {
			newButtRotation = 0;
		} else if (beforeButtPart.y < butt.y) {
			newButtRotation = 90;
		} else if (beforeButtPart.x > butt.x) {
			newButtRotation = 180;
		} else if (beforeButtPart.y > butt.y) {
			newButtRotation = 270
		}

		butt.rotation = newButtRotation;

		//Handle rotations for the rest of the snake
		for (let i = 0; i < parts.length; i++) {
			let part = parts[i];
			let partBefore = parts[i - 1];
			let partAfter = parts[i + 1];

			if (part != head && part != butt) {
				if (partBefore.y == part.y && partAfter.y == part.y && partBefore.y == partAfter.y) {
					part.image = game.snakeStraightImg;
					part.rotation = 90;
				} else {
					for (let i2 = 0; i2 < 2; i2++) {
						//Flip the parts as there are two cases for each curve
						if (i2 > 0) {
							partAfter = parts[i - 1];
							partBefore = parts[i + 1];
						}

						if (partBefore.y == part.y && part.x == partAfter.x) {
							if (partBefore.x < part.x && partAfter.y > part.y) {
								part.image = game.snakeCurveImg;
								part.rotation = 270;
								break;
							} else if (partBefore.x > part.x && partAfter.y < part.y) {
								part.image = game.snakeCurveImg;
								part.rotation = 90;
								break;
							} else if (partBefore.x > part.x && partAfter.y > part.y) {
								part.image = game.snakeCurveImg;
								part.rotation = 180;
								break;
							} else if (partBefore.x < part.x && partAfter.y < part.y) {
								part.image = game.snakeCurveImg;
								part.rotation = 0;
								break;
							} else {
								part.image = game.snakeStraightImg;
								break;
							}
						} else {
							part.rotation = 0;
							part.image = game.snakeStraightImg;
						}
					}
				}
			}
		}

		this.forEachChild(part => {
			//We avoid checking self collisions for most items
			//The snake needs to do that though
			if (part != head && this.headCollidesWith(part)) {
				this.onCollide(this);
			}
		});

		if (!head.isInside(game.background)) {
			this.kill();
		}
	}

	onCollide(otherEntity) {
		let game = SnakeGame.getGame();

		if(otherEntity instanceof BombEntity){
			if(this.canDefuseBombs){
				otherEntity.kill()
			} else {
				this.kill();
			}

		} else if(otherEntity instanceof FoodEntity){
			this.grow(this.snakeGrowthOnFeed);

			if(game.hasUpgrade("doubleapples")){
				game.apples += 2;
			} else {
				game.apples++;
			}


			game.spawnNewFood();
			if(game.hasUpgrade("appleshrink")){
				this.popButt();
			}

		} else if(otherEntity instanceof Snake && !game.hasUpgrade("phase")){
			this.kill();
		}
	}
	setDirection(direction) {
		if (!this.snakeDirection.isOpposite(direction)){
			this.snakeDirection = direction;
		}
	}

	get x(){
		return this.getHead().x;
	}

	get y(){
		return this.getHead().y;
	}
}

class ComputerSnake extends Snake {

	constructor(startY){
		super(startY);
		this.currentPath = [];
	}

	update(){
		//TODO: Make this faster
		let game = SnakeGame.getGame();
		let head = this.getHead();

		let background = game.background;
		let gridWidth = Math.ceil(background.width);
		let gridHeight = Math.ceil(background.height);
		let grid = create2DArray(gridWidth);

		let getRelativeCoords = (entity) => {
			return {
				x: entity.x - background.x,
				y: entity.y - background.y
			};
		};

		let insertIntoGrid = (entity, walkable) => {
			let relative = getRelativeCoords(entity);

			let minGridX = Math.floor(relative.x);
			let maxGridX = Math.ceil(relative.x + entity.width);

			let minGridY = Math.floor(relative.y);
			let maxGridY = Math.ceil(relative.y + entity.height);

			for (let x = minGridX; x < maxGridX; x++) {
				for (let y = minGridY; y < maxGridY; y++) {
					grid[x][y] = new Node(walkable, entity.x, entity.y, x, y)
				}
			}
		};

		game.entities.forEach((entity) => {
			if (entity.collidable) {
				if(entity instanceof MultiPartEntity){
					entity.forEachChild((entity) => {
						insertIntoGrid(entity, false);
					});

				} else if (!(entity instanceof BackgroundEntity) && !(entity instanceof FoodEntity)) {
					let walkable = false;

					insertIntoGrid(entity, walkable);
				}
			}
		});

		//The head is our start
		let headRelativeCoords = getRelativeCoords(head);
		headRelativeCoords.x = Math.floor(headRelativeCoords.x);
		headRelativeCoords.y = Math.floor(headRelativeCoords.y);

		let startNode = new Node(false, head.x, head.y, headRelativeCoords.x, headRelativeCoords.y);
		grid[headRelativeCoords.x][headRelativeCoords.y] = startNode;

		//The food is our target
		let currentFood = game.currentFood;
		let foodRelativeCoords = getRelativeCoords(currentFood);
		foodRelativeCoords.x = Math.floor(foodRelativeCoords.x + currentFood.width);
		foodRelativeCoords.y = Math.floor(foodRelativeCoords.y + currentFood.height);

		let targetNode = new Node(true, currentFood.x, currentFood.y, foodRelativeCoords.x, foodRelativeCoords.y);
		grid[foodRelativeCoords.x][foodRelativeCoords.y] = targetNode;

		for (let x = 0; x < gridWidth; x++) {
			for (let y = 0; y < gridHeight; y++) {
				let node = grid[x][y];
				if (node === undefined) {
					grid[x][y] = new Node(true, x + background.x, y + background.y, x, y);
				}
			}
		}

		let getDistance = (firstNode, secondNode) => {
			let horizontalMovesNeeded = Math.abs(firstNode.gridX - secondNode.gridX);
			let verticalMovesNeeded = Math.abs(firstNode.gridY - secondNode.gridY);
			return horizontalMovesNeeded + verticalMovesNeeded;
		};

		let openSet = new Heap();
		let closedSet = new Set();
		openSet.add(startNode);

		while (openSet.getSize() > 0) {
			let currentNode = openSet.popFirst();
			closedSet.add(currentNode);
			if (currentNode == targetNode) {
				this.currentPath = [];
				let retracingNode = targetNode;

				while (retracingNode != startNode) {
					this.currentPath.push(retracingNode);
					retracingNode = retracingNode.parent;
				}

				this.currentPath.reverse();
				break;
			}

			let neighbours = [];
			for (let gridIndex = -1; gridIndex < 2; gridIndex += 2) {
				//TODO: Fix strange TypeError here
				let neighbourNode1 = grid[currentNode.gridX + gridIndex][currentNode.gridY];
				let neighbourNode2 = grid[currentNode.gridX][currentNode.gridY + gridIndex];

				if(neighbourNode1 != undefined){
					neighbours.push(neighbourNode1);
				}

				if(neighbourNode2 != undefined){
					neighbours.push(neighbourNode2);
				}
			}

			for (let nIndex = 0; nIndex < neighbours.length; nIndex++) {
				let neighbour = neighbours[nIndex];
				if (!neighbour.walkable || closedSet.has(neighbour)) {
					continue;
				}

				let newMovementCost = currentNode.gCost + getDistance(currentNode, neighbour);
				if (newMovementCost < neighbour.gCost || !openSet.contains(neighbour)) {
					neighbour.gCost = newMovementCost;
					neighbour.hCost = getDistance(neighbour, targetNode);
					neighbour.parent = currentNode;
					if (!openSet.contains(neighbour)) {
						openSet.add(neighbour);
					} else {
						openSet.update(neighbour);
					}
				}
			}
		}

		//Make sure that a path actually was found
		if(this.currentPath.length > 0){
			let nextNode = this.currentPath.shift();
			if (head.x < nextNode.x) {
				this.setDirection(Direction.RIGHT);
			} else if (head.x > nextNode.x) {
				this.setDirection(Direction.LEFT);
			} else if (head.y < nextNode.y) {
				this.setDirection(Direction.DOWN);
			} else if (head.y > nextNode.y) {
				this.setDirection(Direction.UP);
			}
		}

		super.update();
	}

	kill(){
		super.kill();
		SnakeGame.getGame().purchases.get("ai").disabled = false;
	}
}

class PlayerSnake extends Snake {

	constructor(startY){
		super(startY);
	}

	onCollide(otherEntity){
		let game = SnakeGame.getGame();
		if(otherEntity instanceof BombEntity){
			game.unlockAchievement("boom");
		}

		super.onCollide(otherEntity);
	}

	kill(){
		super.kill();
		SnakeGame.getGame().stopGame();
	}

}

class ImageEntity extends Entity {

	constructor(x, y, width, height, image, rotation = 0) {
		super(x, y, width, height);

		this.image = image;
		this.rotation = rotation;
	}

	paint(canvas) {
		let context = canvas.canvasCtx;
		let rotate = this.rotation != 0;
		
		if (rotate) {
			context.save();

			context.translate(this.x + (this.width / 2), this.y + (this.height / 2));
			context.rotate(this.rotation * Math.PI / 180);

			canvas.drawScaledImage(this.image, this.width / -2, this.height / -2, this.width, this.height);

			context.restore();
		} else {
			canvas.drawScaledImage(this.image, this.x, this.y, this.width, this.height);
		}
	}
}

class ColoredEntity extends Entity {

	constructor(x, y, width, height, color) {
		super(x, y, width, height);

		this.color = color;
	}

}

class SnakePartEntity extends ImageEntity {

	constructor(x, y, startImg) {
		super(x, y, 1, 1, startImg);
	}
}

class RandomLocImageEntity extends ImageEntity {

	constructor(width, height, img) {
		super(null, null, width, height, img);
		this.spawn();
	}

	update() {
		let game = SnakeGame.getGame();

		if (!this.isInside(game.background)) {
			this.spawn();
		}
	}

	spawn(){
        let game = SnakeGame.getGame();
        game.setRandomPositionInside(this, game.background);
	}
}

class FoodEntity extends RandomLocImageEntity {

	constructor() {
		super(2, 2, SnakeGame.getGame().appleImg);
	}

}

class BombEntity extends RandomLocImageEntity {

	constructor(){
		super(4, 4, SnakeGame.getGame().bombImg);
		this.collidable = false;
		this.ignited = false;
	}

	ignite(){
		this.collidable = true;
		this.ignited = true;
	}
	
	paint(canvas){
		if(this.ignited){
			super.paint(canvas);
		} else {
			let context = canvas.canvasCtx;

			context.save();
			context.globalAlpha = 0.5;
			super.paint(canvas);
			context.restore();
		}
	}
}

class TextEntity extends ColoredEntity {

	constructor(x, y, color, text, font, alignment) {
		super(x, y, null, null, color);
		this.text = text;
		this.font = font;
		this.alignment = alignment;
		this.collidable = false;
	}

	paint(canvas) {
		let canvasCont = canvas.canvasCtx;

		canvasCont.fillStyle = this.color;
		canvasCont.font = this.font;
		canvasCont.textAlign = this.alignment;
		canvasCont.textBaseline = "middle";
		canvasCont.fillText(this.text, this.x, this.y);
	}

	kill() {
	}

}

class BackgroundEntity extends ColoredEntity {

	constructor(leftTopBoundX, leftTopBoundY, bottomRightBoundX, bottomRightBoundY, color) {
		super(leftTopBoundX, leftTopBoundY, 0, 0, color);
		this.statesToPaintAt = GameState.getAllStates();
		this.statesToUpdateAt = GameState.getAllStates();
		this.collidable = false;

		/*
		These bounds are relative to how far away the background should be from the maxX
		and maxY
		 */
		this.bottomRightBoundX = bottomRightBoundX;
		this.bottomRightBoundY = bottomRightBoundY;

		this.update();
	}

	paint(canvas) {
		let context = canvas.canvasCtx;
		context.fillStyle = this.color;
		context.fillRect(this.x, this.y, this.width, this.height);
	}

	update() {
		let game = SnakeGame.getGame();
		this.width = game.snakeCanvas.getScaledWidth() - this.x - this.bottomRightBoundX;
		this.height = game.snakeCanvas.getScaledHeight() - this.y - this.bottomRightBoundY;
	}

	kill() {
	}
}

class Purchase extends Updateable {

	constructor(id, displayName, description, icon, price, onPurchase, onUpdate) {
		super();
		this.id = id;
		this.displayName = displayName;
		this.description = description;
		this.icon = icon;
		this.price = price;
		this.onPurchase = onPurchase;
		this.onUpdate = onUpdate;
		this.disabled = true;
	}

	buy() {
		if (!this.disabled) {
			let game = SnakeGame.getGame();
			if (game.apples >= this.price) {
				game.apples -= this.price;

				if (this.onPurchase != null) {
					this.onPurchase(this);
				}
			}
		}
	}

	update() {
		let game = SnakeGame.getGame();

		this.disabled = game.apples < this.price;

		if (this.onUpdate != null) {
			this.onUpdate(this);
		}

		if (this.disabled) {
			this.containingElement.classList.add("disabledPurchase");
		} else {
			this.containingElement.classList.remove("disabledPurchase");
		}
	}

	generate(container){
		let fullId = "InternalID_" + this.id;
		let toolTipID = "ToolTipID_" + this.id;

		container.insertAdjacentHTML("beforeend",
			`<div class="purchase" id="${fullId}">
				<img src="${this.icon.src}" class="purchaseIcon">
				<p class="purchaseText noMargin">${this.displayName}</p>
				<p class="purchasePrice noMargin">${this.price}</p>
				
				<div class="tooltip" id="${toolTipID}">
					<img src="${this.icon.src}" class="tooltipImg">
					<p>${this.description}</p>
				</div>
			</div>`
		);

		let upgrade = document.getElementById(fullId);

		this.containingElement = upgrade;
		upgrade.addEventListener("click", () => {
			this.buy();
		});

		let html = `<p>${this.description}</p>`;

		generateToolTip(this.id, this.icon, html, upgrade, "flex");
	}

}

class Upgrade extends Purchase {

	constructor(id, displayName, description, icon, price, onPurchase, onUpdate) {
		super(id, displayName, description, icon, price, onPurchase, onUpdate);

		this.purchased = false;
	}

	buy() {
		if (!this.purchased) {
			let game = SnakeGame.getGame();
			game.unlockAchievement("upgrade");

			super.buy();

			this.disabled = true;
			this.purchased = true;
		}
	}

	update() {
		super.update();

		if (this.purchased) {
			this.containingElement.classList.add("purchasedPurchase");
		} else {
			this.containingElement.classList.remove("purchasedPurchase");
		}
	}
}

class Achievement extends Updateable {

	constructor(id, displayName, description, icon, condition){
		super();
		this.id = id;
		this.displayName = displayName;
		this.description = description;
		this.icon = icon;
		this.locked = true;
		this.condition = condition;
	}

	unlock(){
		if(this.locked){

			this.locked = false;
			this.achievement.icon.src = this.icon.src;

			let html = `
			<div>
				<p class="achievementName noMargin">${this.displayName}</p>
				<p class="achievementSubText noMargin">[Achievement] [Unlocked]</p>
				<p class="noMargin">${this.description}</p>
			</div>
			`;

			generateToolTip(this.id, this.icon, html, this.achievement.mainContainer, "flex");
		}
	}

	generate(container){
		let game = SnakeGame.getGame();
		let achievementID = "AchievementID_" + this.id;
		let achievementIconID = "AchievementIconID_" + this.id;

		container.insertAdjacentHTML("beforeend", `
				<div class="achievement" id="${achievementID}">
					<img src="${game.questionImg.src}" class="achievementIcon" id="${achievementIconID}">
				</div>
			`);

		this.achievement = {
			mainContainer: document.getElementById(achievementID),
			icon: document.getElementById(achievementIconID)
		};

	}

	update(){
		if(this.locked && this.condition != null && this.condition()){
			this.unlock();
		}
	}

}

//TODO: Make settings generate from this object
class Setting {

	constructor(name, value){
		this.name = name;
		this.value = value;
	}

	save(){
		Cookies.set(this.name, this.value, { expires: 365 });
	}

	generate(){
		throw new Error("No implementation for generating this kind of setting");
	}

}

class SliderSetting extends Setting {

	constructor(name, value, minValue, maxValue, step){
		super(name, value);
		this.value = value;
		this.minValue = minValue;
		this.maxValue = maxValue;
		this.step = step;
	}

	generate(container){
		let sliderTextID = "InternalSliderTextID_" + this.name;
		let sliderID = "InternalSliderID_" + this.name;

		container.insertAdjacentHTML("beforeend", `
			<div class="sliderContainer">
				<div class="sliderTextContainer">
					<p id="${sliderTextID}" class="sliderName">${this.name}</p>
					<p class="sliderValue">${this.value}</p>
				</div>

				<input type="range" min="${this.minValue}" max="${this.maxValue}" value="${this.value}" step="${this.step}" id="${sliderID}" class="slider">
			</div>`
		);

		let slider = document.getElementById(sliderID);
		let sliderText = document.getElementById(sliderTextID);

		slider.addEventListener("input", () => {
			sliderText.innerHTML = slider.value;
		});

	}
}

class Node {

    constructor(walkable, x, y, gridX, gridY){
        this.walkable = walkable;
		this.x = x;
		this.y = y;
        this.gridX = gridX;
        this.gridY = gridY;

        this.gCost = 0;
        this.hCost = 0;
        this.heapIndex = null;
        this.parent = null;
    }

    get fCost(){
        return this.gCost + this.hCost;
    }

	/*
	-1 = Lower priority
	 0 = Equal priority
	 1 = Higher Priority
	 */
    compareTo(nodeToCompare){
		let fCost = this.fCost;

        if(fCost < nodeToCompare.fCost){
			return 1;
        } else if(fCost > nodeToCompare.fCost){
			return -1;
        } else {
			let hCost = this.hCost;

			if(hCost < nodeToCompare.hCost){
				return 1;
			} else if(hCost > nodeToCompare.hCost){
				return -1;
			} else {
				return 0;
			}
		}
    }
}

class Heap {

	constructor(){
		this.items = [];
	}

	add(item){
		if(item.compareTo === undefined){
			throw new Error("Item does not implement compareTo method!");
		}

		let items = this.items;
		item.heapIndex = items.length;
		items.push(item);
		this.sortUp(item);
	}

	getSize(){
		return this.items.length;
	}

	contains(item){
		if(item.heapIndex === undefined){
			throw new Error("Item does not have a heapIndex!");
		}

		if(item.heapIndex == null){
			return false;
		}

		return this.items[item.heapIndex] == item;
	}

	popFirst(){
		let items = this.items;
		let firstItem = items[0];

		if(items.length == 1){
			this.items = [];
			return firstItem;
		}

		let lastItem = items.pop();
		lastItem.heapIndex = 0;
		items[0] = lastItem;

		this.sortDown(items[0]);
		return firstItem;
	}

	//TODO: Check if this works properly 100% of the time
	update(item){
		this.sortUp(item);
		this.sortDown(item);
	}

	sortUp(item){
		if(item.heapIndex > 0){
			let items = this.items;

			let parentIndex = null;
			let updateParentIndex = () => {
				parentIndex = Math.floor((item.heapIndex - 1) / 2);
			};

			updateParentIndex();
			while(true){
				let parentItem = items[parentIndex];

				if(item.compareTo(parentItem) > 0){
					this.swap(item, parentItem);
				} else {
					break;
				}

				updateParentIndex();
				if(item.heapIndex <= 0){
					break;
				}
			}
		}
	}

	sortDown(item){
		let items = this.items;

		while(true){
			let childIndexLeft = item.heapIndex * 2 + 1;
			let childIndexRight = childIndexLeft++;
			let swapIndex = 0;

			if(childIndexLeft < items.length){
				swapIndex = childIndexLeft;

				if(childIndexRight < items.length){
					if(items[childIndexLeft].compareTo(items[childIndexRight]) < 0){
						swapIndex = childIndexRight;
					}
				}

				if(item.compareTo(items[swapIndex]) < 0){
					this.swap(item, items[swapIndex]);
				} else {
					return;
				}
			} else {
				return;
			}
		}
	}

	swap(firstItem, secondItem){
		let items = this.items;
		items[firstItem.heapIndex] = secondItem;
		items[secondItem.heapIndex] = firstItem;

		let firstItemIndex = firstItem.heapIndex;
		firstItem.heapIndex = secondItem.heapIndex;
		secondItem.heapIndex = firstItemIndex;
	}

}




