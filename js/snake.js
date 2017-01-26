/**
 *
 * Game entry point
 *
 * */

document.addEventListener("DOMContentLoaded", () => {
	let game = SnakeGame.getGame();

	document.addEventListener("keydown", event => {
		game.onKeyDown(event.keyCode);
	});

	//Run at 20 ticks
	setInterval(() => {
		game.run();
	}, 50);

	setInterval(() => {
		game.save();
	}, 5000);
});

/**
 *
 * Global utility functions
 *
 * */

function getRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandFutureDate(minSeconds, maxSeconds){
	let date = new Date();
	date.setSeconds(date.getSeconds() + getRandomInt(minSeconds, maxSeconds));
	return date;
}

function loadImage(src) {
	let img = new Image();
	img.src = "assets/" + src;
	return img;
}

function $(selector){
	if(selector.startsWith("#")){
		return document.getElementById(selector.substring(1));
	} else if(selector.startsWith(".")){
		return document.getElementsByClassName(selector.substring(1));
 	}
}

/**
 *
 * Enum classes
 *
 * */

const directions = [];
class Direction {

	constructor(direction, oppositeDirection, headRotation){
		this.direction = direction;
		this.oppositeDirection = oppositeDirection;
		this.headRotation = headRotation;
	}

	isOpposite(direction){
		return this.oppositeDirection == direction.direction;
	}

	toString(){
		return this.direction;
	}

	static getRandomDirection(){
		return directions[getRandomInt(0, directions.length - 1)];
	}

	static addDirection(direction){
		directions.push(direction);
		return direction;
	}

}

Direction.LEFT = Direction.addDirection(new Direction("left", "right", 0));
Direction.UP = Direction.addDirection(new Direction("up", "down", 90));
Direction.RIGHT = Direction.addDirection(new Direction("right", "left", 180));
Direction.DOWN = Direction.addDirection(new Direction("down", "up", 270));
Object.freeze(directions);

class GameState {

	constructor(state){
		this.state = state;
	}

	toString(){
		return this.state;
	}

}

GameState.RUNNING = new GameState("running");
GameState.PAUSED = new GameState("paused");
GameState.STOPPED = new GameState("stopped");

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
			this.savedValues = {highscore: 0};
		} else {
			this.savedValues = Cookies.getJSON("savedValues");
		}

		this.bombs = 0;
		this.ticks = 0;
		this.score = 0;
		this.coins = 0;

		this.upgrades = new Map();
		this.purchases = new Map();
		this.settings = new Map();

		this.appleImg = loadImage("apple.png");
		this.coinImg = loadImage("coin.png");
		this.bombImg = loadImage("bomb.png");
		this.snakeHeadImg = loadImage("parts/head.png");
		this.snakeCurveImg = loadImage("parts/curve.png");
		this.snakeStraightImg = loadImage("parts/straight.png");
		this.snakeTailImg = loadImage("parts/tail.png");

		this.upgrades.set("coinshrink", new Upgrade("Shrinking Coins", loadImage("coincut.png"), 100, null, null));
		this.upgrades.set("phase", new Upgrade("Phasing Snake", this.snakeHeadImg, 100, null, null));
		this.upgrades.set("doublecoin", new Upgrade("Double Coins", loadImage("doublecoin.png"), 30, null, null));
		this.upgrades.set("slowgrow", new Upgrade("Slow Growth", loadImage("halfapple.png"), 25, () => {
			this.currentSnake.snakeGrowthOnFeed /= 2;
		}, null));

		this.upgrades.set("doublescore", new Upgrade("Double Score", loadImage("score.png"), 15, null, null));

		this.purchases.set("cut", new Purchase("Cut in Half", loadImage("scissors.png"), 10, () => {
			let length = this.currentSnake.snakeParts.length;

			if (length > 2) {
				for (let i = Math.floor(length / 2); i < length; i++) {
					this.currentSnake.popButt();
				}
			}
		}, (purchase) => {
			let length = this.currentSnake.snakeParts.length;

			purchase.disabled = length <= 10;
		}));

		this.purchases.set("suicide", new Purchase("Suicide", loadImage("snare.ico"), 5, () => {
			this.stopGame();
		}, null));

		//TODO: When we actually need settings make this work
		let addSetting = (setting) => {
			this.settings.set(setting.name, setting);
		};

		addSetting(new SliderSetting("scale"));

		this.generateHTML();

		this.snakeCanvas = new SnakeCanvas();
		this.background = new BackgroundEntity();
		this.scoreText = new TextEntity(0, 0, "#afafaf", "0", "Arial 20px", "center");

		this.entities = new Set();
		this.addEntity(this.background);
		this.addEntity(this.scoreText);

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
                canvasEl.focus();
			}

		});
	}

	generateHTML() {
		$("#highscoreText").innerText = "Highscore: " + this.savedValues.highscore;
        $("#menuContainer").style.width = this.menuWidth + "px";

		let generatePurchasesFunc = (value, key) => {
			let container = value instanceof Upgrade ?
				$("#upgradesContainer") : $("#purchasesContainer");

			value.generate(key, container);
		};

		this.upgrades.forEach(generatePurchasesFunc);
		this.purchases.forEach(generatePurchasesFunc);
	}

	static getGame() {
		if (SnakeGame.game === undefined) {
			SnakeGame.game = new SnakeGame();
			SnakeGame.game.initialize();
		}

		return SnakeGame.game;
	}

	addEntity(entity) {
		this.entities.add(entity);
	}

	onKeyDown(keyCode) {
		if(this.gameState == GameState.RUNNING){
			//Prevent buttonmashing
			if (this.prevKeyodeTicks != this.ticks) {
				let keycodeMap = this.keycodeDirectionMap;

				if (keycodeMap[keyCode] !== undefined) {
					let newDirection = keycodeMap[keyCode];

					let snake = this.currentSnake;
					if (!snake.snakeDirection.isOpposite(newDirection)) {
						snake.snakeDirection = newDirection;
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

			entity.x = getRandomInt(entity.width + 1, inside.width - entity.width - 1);
			entity.y = getRandomInt(entity.height + 1, inside.height - entity.height - 1);

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

		this.currentSnake = new PlayerSnake();
		this.addEntity(this.currentSnake);
		this.addEntity(new FoodEntity());
		this.addEntity(new CoinEntity());

		this.coins = 250;
		this.startDate = new Date();
	}

	stopGame(){
        this.gameState = GameState.STOPPED;

        this.entities.forEach(entity => {
            if (!entity.dead) {
                entity.kill();
            }
        });

        if(this.score > this.savedValues.highscore){
			this.savedValues.highscore = this.score;
		}

        this.score = 0;
        this.ticks = 0;
		this.bombs = 0;

        this.upgrades.forEach((value) => {
            value.purchased = false;
        });

		this.save();
		this.updateNewGameOverlay(true);
	}

	updateNewGameOverlay(show){
		let overlayElement = $("#newGameOverlay");
		if(show){
			$("#highscoreText").innerText = "Highscore: " + this.savedValues.highscore;
			overlayElement.style.display = "flex";
		} else {
			overlayElement.style.display = "none";
		}

	}

	hasUpgrade(id) {
		return this.upgrades.get(id).purchased;
	}

	save(){
		Cookies.set("savedValues", this.savedValues, {expires: 365});
	}

	run() {
		let snakeCanvas = this.snakeCanvas;
		snakeCanvas.updateCanvasSize();

		if(this.gameState != GameState.STOPPED){
			this.ticks++;

			let update = (value) => {
				value.update();
			};

			this.upgrades.forEach(update);
			this.purchases.forEach(update);

			let minWindowCells = 20;
			let canvasCont = snakeCanvas.canvasContext;
			if(this.gameState == GameState.PAUSED){
				canvasCont.fillStyle = "black";
				canvasCont.font = "20px Arial";
				canvasCont.textAlign = "center";
				canvasCont.fillText("Paused!", snakeCanvas.getRealWidth() / 2, snakeCanvas.getRealHeight() / 2);
			} else if (snakeCanvas.getScaledCellHeight() > minWindowCells && snakeCanvas.getScaledCellWidth() > minWindowCells) {
				let entities = this.entities;

				//Update living entities, remove dead ones
				entities.forEach(entity => {
					if (entity.dead) {
						entities.delete(entity);
					} else {
						entity.update();
					}
				});

				//Check for collisions, avoid checking self collisions
				entities.forEach(entity1 => {
					entities.forEach(entity2 => {
						if (entity1 != entity2 && entity1.collidable && entity2.collidable && entity1.collidesWith(entity2)) {
							entity1.onCollide(entity2);
						}
					})
				});

				$("#scoreText").innerHTML = "Score: " + this.score;
				$("#coinsText").innerHTML = "Coins: " + this.coins;

				this.scoreText.text = this.score;

				//Painting
				snakeCanvas.scaleNext();

				this.scoreText.x = this.snakeCanvas.getScaledCellWidth() / 2;
				this.scoreText.y = this.snakeCanvas.getScaledCellHeight() / 2;

				entities.forEach(entity => {
					snakeCanvas.paintEntity(entity);
				});

				//TODO: Fix this counting in time while the game is paused
				let gameLength = new Date() - this.startDate;
				let secondsSinceStart = Math.floor(gameLength / 1000);

				let minutes = Math.floor(secondsSinceStart / 60);
				let seconds = secondsSinceStart % 60;

				if(seconds > 0 || minutes > 0){
					let minutesText;
					if(minutes == 0){
						minutesText = "";
					} else if(minutes == 1){
						minutesText = "1 minute ";
					} else {
						minutesText = minutes + " minutes "
					}

					let secondsText;
					if(seconds == 0){
						secondsText = "";
					} else if(seconds == 1){
						secondsText = "1 second";
					} else {
						secondsText = seconds + " seconds";
					}

					$("#timeText").innerHTML = "Time elapsed: " + minutesText + secondsText;
				}

			} else {
				canvasCont.fillStyle = "black";
				canvasCont.font = "30px Arial";
				canvasCont.textAlign = "start";
				canvasCont.fillText("Window too small", 0, 30);
			}
		}


	}

}

class SnakeCanvas {

	constructor() {
		this.cellWidth = 5;
		this.cellHeight = 5;

		this.canvasEl = $("#snakeCanvas");
		this.canvasContext = this.canvasEl.getContext("2d");

		this.scale = 1;
		this.updateCanvasSize();
	}

	paintEntity(entity) {
		entity.paint(this);
	}

	getScaledCellWidth() {
		return this.getScaledPixelWidth() / this.cellWidth;
	}

	getScaledCellHeight() {
		return this.getScaledPixelHeight() / this.cellHeight;
	}

	getScaledPixelHeight() {
		return this.canvasEl.height / this.scale;
	}

	getScaledPixelWidth() {
		return this.canvasEl.width / this.scale;
	}

	scaleNext() {
		this.canvasContext.scale(this.scale, this.scale);
	}

	updateCanvasSize() {
		let game = SnakeGame.getGame();

		this.canvasEl.setAttribute("width", document.body.clientWidth - game.menuWidth);
		this.canvasEl.setAttribute("height", document.body.clientHeight);

		let minPixels = 1900;
		let maxPixels = 2100;

		while(true){
			let pixels = this.getScaledCellWidth() * this.getScaledCellHeight();
			if(pixels > maxPixels){
				this.scale += 0.03;
			} else if(pixels < minPixels){
				this.scale -= 0.03;
			} else {
				break;
			}
		}


	}

	getRealWidth() {
		return this.canvasEl.width;
	}

	getRealHeight() {
		return this.canvasEl.height;
	}
}

class Updateable {

	update() {}
}

class Entity extends Updateable {

	constructor(x, y, width, height) {
		super();
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
		this.dead = false;
		this.collidable = true;
	}

	collidesWith(otherEntity) {
		//https://silentmatt.com/rectangle-intersection/
		let ax2 = this.x + this.width;
		let ay2 = this.y + this.height;

		let bx2 = otherEntity.x + otherEntity.width;
		let by2 = otherEntity.y + otherEntity.height;

		return this.x < bx2 && ax2 > otherEntity.x && this.y < by2 && ay2 > otherEntity.y;
	}

	isInside(otherEntity) {
		let otherRightX = otherEntity.width + otherEntity.x;
		let otherBottomY = otherEntity.height + otherEntity.y;

		return this.x <= otherRightX && this.y <= otherBottomY
			&& this.x + this.width <= otherRightX && this.y + this.height <= otherBottomY
			&& this.x >= otherEntity.x && this.y >= otherEntity.y;
	}

	kill() {
		this.dead = true;
	}

	paint(canvas) {
	}

	onCollide(otherEntity) {
	}

	moveForward(direction){
		if(direction == Direction.LEFT){
			this.x--;
		} else if(direction == Direction.UP){
			this.y--;
		} else if(direction == Direction.RIGHT){
			this.x++;
		} else if(direction == Direction.DOWN){
			this.y++;
		}
	}
}

class Snake extends Entity {

	constructor() {
		super(null, null, null, null);
		this.SNAKE_START_LENGT = 5;
		this.snakeGrowthOnFeed = 4;

		this.snakeDirection = Direction.RIGHT;
		this.snakeParts = [];

		//Initialize start snake
		for (let i = this.SNAKE_START_LENGT; i > 0; i--) {
			this.snakeParts.push(new SnakePartEntity(i, 2))
		}

	}

	getLength() {
		return this.snakeParts.length;
	}

	getHead() {
		return this.snakeParts[0];
	}

	getButt() {
		return this.snakeParts[this.snakeParts.length - 1];
	}

	popButt() {
		return this.snakeParts.pop();
	}

	append(parts = 1) {
		let butt = this.getButt();

		for (let i = 0; i < parts; i++) {
			this.snakeParts.push(new SnakePartEntity(butt.x, butt.y, SnakeGame.getGame().snakeStraightImg));
		}
	}

	headCollidesWith(item) {
		return this.getHead().collidesWith(item);
	}

	moveForward() {
		let snakeButt = this.popButt();
		let snakeHead = this.getHead();
		let direction = this.snakeDirection;

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
		this.snakeParts.unshift(snakeButt);
	}

	collidesWith(otherEntity) {
		for (let i = 0; i < this.snakeParts.length; i++) {
			let part = this.snakeParts[i];

			if (part.collidesWith(otherEntity)) {
				return true;
			}
		}
	}

	isInside(otherEntity) {
		for (let i = 0; i < this.snakeParts.length; i++) {
			if (this.snakeParts[i].isInside(otherEntity)) {
				return true;
			}
		}
	}

	paint(canvas) {
		let game = SnakeGame.getGame();
		let head = this.getHead();
		let butt = this.getButt();
		let parts = this.snakeParts;
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

			canvas.paintEntity(part);
		}
	}

	update() {
		let game = SnakeGame.getGame();
		this.moveForward();

		let head = this.getHead();
		this.snakeParts.forEach(part => {
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
		if(otherEntity instanceof Snake || otherEntity instanceof BombEntity){
			this.kill();
		} else if(otherEntity instanceof FoodEntity){
			otherEntity.kill();
			this.append(this.snakeGrowthOnFeed);
		} else if(otherEntity instanceof CoinEntity){
			otherEntity.kill();
		}


	}
}

//TODO: Create an AI
class ComputerSnake {

	update(){

	}

}

class PlayerSnake extends Snake {

	onCollide(otherEntity){
		let game = SnakeGame.getGame();
		if(otherEntity instanceof Snake && game.hasUpgrade("phase")) {
			return;
		}

		super.onCollide(otherEntity);
		if (otherEntity instanceof FoodEntity) {
			if(game.hasUpgrade("doublescore")){
				game.score += 2;
			} else {
				game.score++;
			}

			game.addEntity(new FoodEntity());
			if (getRandomInt(0, 1) > 0) {
				game.addEntity(new CoinEntity());
			}

		} else if (otherEntity instanceof CoinEntity) {
			if(game.hasUpgrade("coinshrink")){
				this.popButt();
			}

			if (game.hasUpgrade("doublecoin")) {
				game.coins += 2;
			} else {
				game.coins++;
			}

			if(game.bombs < 10){
				game.addEntity(new BombEntity());
			}
		}

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
		let context = canvas.canvasContext;
		let rotate = this.rotation != 0;

		if (rotate) {
			context.save();

			context.translate(this.x * canvas.cellWidth + ((canvas.cellWidth * this.width) / 2), this.y * canvas.cellHeight + ((canvas.cellHeight * this.height) / 2));
			context.rotate(this.rotation * Math.PI / 180);

			context.drawImage(this.image, (this.width * canvas.cellWidth) / -2, (this.height * canvas.cellHeight) / -2, canvas.cellWidth * this.width, canvas.cellHeight * this.height);

			context.restore();
		} else {
			context.drawImage(this.image, this.x * canvas.cellWidth, this.y * canvas.cellHeight, canvas.cellWidth * this.width, canvas.cellHeight * this.height);
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

class CoinEntity extends RandomLocImageEntity {

	constructor() {
		super(3, 3, SnakeGame.getGame().coinImg);
        this.deathDate = getRandFutureDate(2, 6);
	}

	update() {
		if(new Date().getTime() >= this.deathDate.getTime()){
			this.kill();
		}
	}

}

class BombEntity extends RandomLocImageEntity {

	constructor(){
		super(2, 2, SnakeGame.getGame().bombImg)
	}
}

class TextEntity extends ColoredEntity {

	constructor(x, y, color, text, font, alignment) {
		super(x, y, null, null, color);
		this.text = text;
		this.font = font;
		this.alignment = alignment;
	}

	paint(canvas) {
		let canvasCont = canvas.canvasContext;

		canvasCont.fillStyle = this.color;
		canvasCont.font = this.font;
		canvasCont.align = this.alignment;
		canvasCont.fillText(this.text, this.x * canvas.cellWidth, this.y * canvas.cellHeight);
	}

	kill() {
	}

}

class BackgroundEntity extends ColoredEntity {

	constructor() {
		super(0, 0, null, null, "#ffea69");
		this.collidable = false;
		this.update();
	}

	paint(canvas) {
		let context = canvas.canvasContext;
		context.fillStyle = this.color;
		context.fillRect(0, 0, canvas.getScaledPixelWidth(), canvas.getScaledPixelHeight());
		context.strokeStyle = "black";
		context.strokeRect(0, 0, canvas.getScaledPixelWidth(), canvas.getScaledPixelHeight());
	}

	update() {
		let game = SnakeGame.getGame();
		this.width = game.snakeCanvas.getScaledCellWidth();
		this.height = game.snakeCanvas.getScaledCellHeight();
	}

	kill() {
	}
}

class Purchase extends Updateable {

	constructor(displayName, icon, price, onPurchase, onUpdate) {
		super();
		this.displayName = displayName;
		this.icon = icon;
		this.price = price;
		this.onPurchase = onPurchase;
		this.onUpdate = onUpdate;
		this.disabled = true;
	}

	buy() {
		if (!this.disabled) {
			let game = SnakeGame.getGame();
			if (game.coins >= this.price) {
				game.coins -= this.price;
				this.purchased = true;

				if (this.onPurchase != null) {
					this.onPurchase(this);
				}
			}
		}
	}

	update() {
		let game = SnakeGame.getGame();

		this.disabled = game.coins < this.price;

		if (this.onUpdate != null) {
			this.onUpdate(this);
		}

		if (this.disabled) {
			this.containingElement.classList.add("disabledPurchase");
		} else {
			this.containingElement.classList.remove("disabledPurchase");
		}
	}

	generate(id, container){
		let fullId = "InternalID_" + id;

		container.insertAdjacentHTML("beforeend",
			`<div class="purchase" id="${fullId}">
				<img src="${this.icon.src}" class="purchaseIcon">
				<p class="purchaseText noMargin">${this.displayName}</p>
				<p class="purchasePrice noMargin">${this.price}</p>
			</div>`
		);

		let upgrade = document.getElementById(fullId);

		this.containingElement = upgrade;
		upgrade.addEventListener("click", () => {
			this.buy();
		});
	}

}

class Upgrade extends Purchase {

	constructor(displayName, icon, price, onPurchase, onUpdate) {
		super(displayName, icon, price, onPurchase, onUpdate);

		this.purchased = false;
	}

	buy() {
		if (!this.purchased) {
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

		container.insertAdjacentHTML("beforeend",
			`<div class="sliderContainer">
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




