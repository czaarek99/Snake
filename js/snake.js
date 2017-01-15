document.addEventListener('DOMContentLoaded', initializeGame);

function initializeGame() {
	let game = SnakeGame.getGame();

	let scaleSlider = document.getElementById("scaleSlider");
	let snakeCanvas = game.snakeCanvas;

	snakeCanvas.scale = scaleSlider.value;
	scaleSlider.addEventListener("input", function () {
		snakeCanvas.scale = this.value;
	});

	//All sliders automatically update their values
	let sliderContainers = document.getElementsByClassName("sliderContainer");
	for (let i = 0; i < sliderContainers.length; i++) {
		let sliderContainer = sliderContainers[i];
		let sliderValue = sliderContainer.getElementsByClassName("sliderValue")[0];
		let slider = sliderContainer.getElementsByClassName("slider")[0];

		let update = () => {
			sliderValue.innerHTML = slider.value
		};

		update();
		slider.addEventListener("input", update);
	}

	document.addEventListener("keydown", event => {
		SnakeGame.getGame().onKeyDown(event.keyCode);
	});

	//Run at 20 ticks
	setInterval(() => {
		game.run();
	}, 50);
}

function getRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function loadImage(src){
	let img = new Image();
	img.src = "assets/" + src;
	return img;
}

class SnakeGame {

    initialize() {
        this.ticks = 0;
		this.score = 0;
		this.coins = 0;

		this.upgrades = new Map();
		this.purchases = new Map();

		this.appleImg = loadImage("apple.png");
		this.coinImg = loadImage("coin.png");
		this.snakeHeadImg = loadImage("parts/head.png");
		this.snakeCurveImg = loadImage("parts/curve.png");
		this.snakeStraightImg = loadImage("parts/straight.png");
		this.snakeTailImg = loadImage("parts/tail.png");

		this.upgrades.set("phase", new Upgrade("Phasing Snake", this.snakeHeadImg, 50, null, null));
		this.upgrades.set("slowsnake", new Upgrade("Slow Snake", this.snakeHeadImg, 50, null, null));
		this.upgrades.set("doublecoin", new Upgrade("Double Coins", loadImage("doublecoin.png"), 30, null, null));
		this.upgrades.set("slowgrow", new Upgrade("Slow Growth", loadImage("halfapple.png"), 25, null, null));

		this.purchases.set("cut", new Purchase("Cut in Half", loadImage("scissors.png"), 10, () => {
			let length = this.currentSnake.snakeParts.length;

			if(length > 2){
				for(let i = Math.floor(length / 2); i < length; i++){
					this.currentSnake.popButt();
				}
			}
		}, (purchase) => {
			let length = this.currentSnake.snakeParts.length;

			purchase.disabled = length <= 10;
		}));
		this.purchases.set("suicide", new Purchase("Suicide", loadImage("snare.ico"), 5, () => {
			this.startNewGame();
		}, null));

		this.generateHTML();

		this.snakeCanvas = new SnakeCanvas();

		this.background = new BackgroundEntity();
		this.currentSnake = new Snake();

		this.entities = new Set();
		this.addEntity(this.background);
		this.startNewGame();

		this.opposingDirectionsMap = {};
		this.opposingDirectionsMap["left"] = "right";
		this.opposingDirectionsMap["up"] = "down";
		this.opposingDirectionsMap["right"] = "left";
		this.opposingDirectionsMap["down"] = "up";

		this.keycodeDirectionMap = {};
		this.keycodeDirectionMap[37] = "left";
		this.keycodeDirectionMap[38] = "up";
		this.keycodeDirectionMap[39] = "right";
		this.keycodeDirectionMap[40] = "down";

		this.headImgRotationsMap = {};
		this.headImgRotationsMap["left"] = 0;
		this.headImgRotationsMap["up"] = 90;
		this.headImgRotationsMap["right"] = 180;
		this.headImgRotationsMap["down"] = 270;
	}

	generateHTML(){
		let generatePurchasesFunc = (value, key) => {
			let container = value instanceof Upgrade ?
				document.getElementById("upgradesContainer") : document.getElementById("purchasesContainer")
			let purchaseID = "InternalJavascriptID-" + key;

			container.insertAdjacentHTML("beforeend", ` 
			<div class="purchase" id="${purchaseID}">
				<img src="${value.icon.src}" class="purchaseIcon">
				<p class="purchaseText noMargin">${value.displayName}</p>
				<p class="purchasePrice noMargin">$${value.price}</p>
			</div>
			`);

			let upgrade = document.getElementById(purchaseID);

			value.containingElement = upgrade;
			upgrade.addEventListener("click", () => {
				value.buy();
			});
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
		//Prevent buttonmashing
		if(this.prevKeyodeTicks != this.ticks){
			let keycodeMap = this.keycodeDirectionMap;

			if (keycodeMap[keyCode] !== undefined) {
				let newDirection = keycodeMap[keyCode];

				let snake = this.currentSnake;
				if (snake.snakeDirection != this.opposingDirectionsMap[newDirection]) {
					snake.snakeDirection = newDirection;
				}
			}
		}

		this.prevKeyodeTicks = this.ticks;
	}

    setRandomPositionInside(entity, inside){
        let respawn = true;

        while (respawn) {
            respawn = false;

            entity.x = getRandomInt(entity.width + 1, inside.width - entity.width - 1);
            entity.y = getRandomInt(entity.height + 1, inside.height - entity.height - 1);

			this.entities.forEach(collidingEntity => {
				if(collidingEntity.collidable){
					if (!respawn && collidingEntity != entity && collidingEntity.collidesWith(entity)) {
						respawn = true;
					}
				}
			});
        }
    }

    startNewGame(){
        this.entities.forEach(entity => {
            if (!entity.dead) {
                entity.kill();
            }
        });

        this.currentSnake = new Snake();
        this.addEntity(this.currentSnake);
        this.addEntity(new FoodEntity());
        this.addEntity(new CoinEntity());

        this.score = 0;
        this.coins = 50;

		this.upgrades.forEach((value) => {
			value.purchased = false;
		});
    }

	hasUpgrade(id){
		return this.upgrades.get(id).purchased;
	}

	run() {
		this.ticks++;

		let snakeCanvas = this.snakeCanvas;
		snakeCanvas.updateCanvasSize();

		let update = (value) => {
			value.update();
		};

		this.upgrades.forEach(update);
		this.purchases.forEach(update);

		if (snakeCanvas.getScaledCellHeight() > 10 && snakeCanvas.getScaledPixelWidth() > 10) {
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

			document.getElementById("scoreText").innerHTML = "Score: " + this.score;
            document.getElementById("coinsText").innerHTML = "Coins: " + this.coins;

			//Painting
			snakeCanvas.scaleNext();
			entities.forEach(entity => {
				snakeCanvas.paintEntity(entity);
			});
		} else {
			let canvasCont = snakeCanvas.canvasContext;

			canvasCont.fillStyle = "black";
			canvasCont.font = "30px Arial";
			canvasCont.fillText("Window too small", 0, 30);
		}
	}

}

class SnakeCanvas {

	constructor() {
		this.cellWidth = 5;
		this.cellHeight = 5;

		this.canvas = document.getElementById("snakeCanvas");
		this.canvasContext = this.canvas.getContext("2d");

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
		return this.canvas.height / this.scale;
	}

	getScaledPixelWidth() {
		return this.canvas.width / this.scale;
	}

	scaleNext() {
		this.canvasContext.scale(this.scale, this.scale);
	}

	updateCanvasSize() {
		this.canvas.setAttribute("width", document.body.clientWidth * 0.75);
		this.canvas.setAttribute("height", document.body.clientHeight);
	}

	getRealWidth() {
		return this.canvas.width;
	}

	getRealHeight() {
		return this.canvas.height;
	}
}

class Updateable {

	update(){}
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
}

class Snake extends Entity {

	constructor() {
		super(null, null, null, null);
		this.SNAKE_START_LENGT = 5;
		this.snakeGrowthOnFeed = 4;

		this.snakeDirection = "right";
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

		if (direction == "left") {
			snakeButt.x = snakeHead.x - 1;
			snakeButt.y = snakeHead.y;
		} else if (direction == "up") {
			snakeButt.y = snakeHead.y - 1;
			snakeButt.x = snakeHead.x;
		} else if (direction == "right") {
			snakeButt.x = snakeHead.x + 1;
			snakeButt.y = snakeHead.y;
		} else if (direction == "down") {
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
		head.rotation = game.headImgRotationsMap[this.snakeDirection];

		let newButtRotation = 0;
		butt.image = game.snakeTailImg;

		if(beforeButtPart.x < butt.x){
			newButtRotation = 0;
		} else if(beforeButtPart.y < butt.y){
			newButtRotation = 90;
		} else if(beforeButtPart.x > butt.x){
			newButtRotation = 180;
		} else if(beforeButtPart.y > butt.y){
			newButtRotation = 270
		}

		butt.rotation = newButtRotation;

		//Handle rotations for the rest of the snake
		for (let i = 0; i < parts.length; i++) {
			let part = parts[i];
			let partBefore = parts[i - 1];
			let partAfter = parts[i + 1];

			if(part != head && part != butt){
				if(partBefore.y == part.y && partAfter.y == part.y && partBefore.y == partAfter.y){
					part.image = game.snakeStraightImg;
					part.rotation = 90;
				} else {
					for(let i2 = 0; i2 < 2; i2++){
						//Flip the parts as there are two cases for each curve
						if(i2 > 0){
							partAfter = parts[i - 1];
							partBefore = parts[i + 1];
						}

						if(partBefore.y == part.y && part.x == partAfter.x){
							if(partBefore.x < part.x && partAfter.y > part.y){
								part.image = game.snakeCurveImg;
								part.rotation = 270;
								break;
							} else if(partBefore.x > part.x && partAfter.y < part.y){
								part.image = game.snakeCurveImg;
								part.rotation = 90;
								break;
							} else if(partBefore.x > part.x && partAfter.y > part.y){
								part.image = game.snakeCurveImg;
								part.rotation = 180;
								break;
							} else if(partBefore.x < part.x && partAfter.y < part.y){
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
		let hasSlowUpgrade = game.hasUpgrade("slowsnake");

		if(!hasSlowUpgrade || game.ticks % 2 == 0 && hasSlowUpgrade){
			this.moveForward();
		}

		let head = this.getHead();
		if(!game.hasUpgrade("phase")){
			this.snakeParts.forEach(part => {
				//We avoid checking self collisions for most items
				//The snake needs to do that though
				if(part != head && this.headCollidesWith(part)){
					this.onCollide(this);
				}
			});
		}

        if (!head.isInside(game.background)) {
            game.startNewGame();
        }
	}

	onCollide(otherEntity) {
        let game = SnakeGame.getGame();
		if (otherEntity instanceof FoodEntity) {
			//TODO: Fix these parts being draw wrong until expanded

			if(game.hasUpgrade("slowgrow")){
				this.append(this.snakeGrowthOnFeed / 2);
			} else {
				this.append(this.snakeGrowthOnFeed);
			}

			otherEntity.kill();
			game.addEntity(new FoodEntity());
			game.score += 1;

			if(getRandomInt(0, 1) > 0){
				game.addEntity(new CoinEntity());
			}

		} else if(otherEntity instanceof CoinEntity){
			otherEntity.kill();

			if(game.hasUpgrade("doublecoin")){
				game.coins += 2;
			} else {
				game.coins++;
			}


        } else if (otherEntity instanceof Snake) {
			game.startNewGame();
		}
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

		if(rotate){
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
        this.update(true);
    }

    update(bypass) {
        let game = SnakeGame.getGame();

        if(!this.isInside(game.background) || bypass){
            game.setRandomPositionInside(this, game.background);
        }
    }
}

class FoodEntity extends RandomLocImageEntity {

    constructor(){
        super(2, 2, SnakeGame.getGame().appleImg);
    }

}

class CoinEntity extends RandomLocImageEntity {

    constructor(){
        super(3, 3, SnakeGame.getGame().coinImg);
        this.startTicks = SnakeGame.getGame().ticks;
        this.ticksToExist = getRandomInt(20, 100);
    }

    update(bypass){
    	super.update(bypass);

    	if(SnakeGame.getGame().ticks > this.startTicks + this.ticksToExist){
    		this.kill();
		}
	}


}

class TextEntity extends ColoredEntity {

	constructor(x, y, color, text, font) {
		super(x, y, null, null, color);
		this.text = text;
		this.font = font;
	}

	paint(canvas) {
		let canvasCont = canvas.canvasContext;

		canvasCont.fillStyle = this.color;
		canvasCont.font = this.font;
		canvasCont.fillText(this.text, this.x * canvas.cellWidth, this.y * canvas.cellHeight);
	}

	kill() {
	}

}

class BackgroundEntity extends ColoredEntity {

	constructor() {
		super(0, 0, null, null, "white");
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
//TODO: Make settings generate from this object
class Setting {

}

class Purchase extends Updateable {

	constructor(displayName, icon, price, onPurchase, onUpdate){
		super();
		this.displayName = displayName;
		this.icon = icon;
		this.price = price;
		this.onPurchase = onPurchase;
		this.onUpdate = onUpdate;
		this.disabled = true;
	}

	buy(){
		if(!this.disabled){
			let game = SnakeGame.getGame();
			if(game.coins >= this.price){
				game.coins -= this.price;
				this.purchased = true;

				if(this.onPurchase != null){
					this.onPurchase(this);
				}
			}
		}
	}

	update(){
		let game = SnakeGame.getGame();

		this.disabled = game.coins < this.price;

		if(this.onUpdate != null){
			this.onUpdate(this);
		}

		if(this.disabled){
			this.containingElement.classList.add("disabledPurchase");
		} else {
			this.containingElement.classList.remove("disabledPurchase");
		}
	}

}

class Upgrade extends Purchase {

	constructor(displayName, icon, price, onPurchase, onUpdate){
		super(displayName, icon, price, onPurchase, onUpdate);

		this.purchased = false;
	}

	buy(){
		if(!this.purchased){
			super.buy();

			this.disabled = true;
			this.purchased = true;
		}
	}

	update(){
		super.update();

		if(this.purchased){
			this.containingElement.classList.add("purchasedPurchase");
		} else {
			this.containingElement.classList.remove("purchasedPurchase");
		}
	}
}





