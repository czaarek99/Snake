document.addEventListener('DOMContentLoaded', initializeGame);

function initializeGame() {
	var game = SnakeGame.getGame();

	var scaleSlider = document.getElementById("scaleSlider");
	var snakeCanvas = game.snakeCanvas;

	snakeCanvas.scale = scaleSlider.value;
	scaleSlider.addEventListener("input", function () {
		snakeCanvas.scale = this.value;
	});

	//All sliders automatically update their values
	var sliderContainers = document.getElementsByClassName("sliderContainer");
	for (var i = 0; i < sliderContainers.length; i++) {
		var sliderContainer = sliderContainers[i];
		var sliderValue = sliderContainer.getElementsByClassName("sliderValue")[0];
		var slider = sliderContainer.getElementsByClassName("slider")[0];

		var update = function () {
			sliderValue.innerHTML = slider.value
		};

		update();
		slider.addEventListener("input", update);
	}

	document.addEventListener("keydown", function (event) {
		SnakeGame.getGame().onKeyDown(event.keyCode);
	});

	//Run at 20 ticks
	setInterval(function () {
		SnakeGame.getGame().run();
	}, 50);
}

function getRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

class SnakeGame {

	initialize() {
		this.ticks = 0;

		this.appleImg = new Image();
		this.snakeHeadImg = new Image();
		this.snakeCurveImg = new Image();
		this.snakeStraightImg = new Image();
		this.snakeTailImg = new Image();

		this.appleImg.src = "assets/apple.png";
		this.snakeHeadImg.src = "assets/parts/head.png";
		this.snakeCurveImg.src = "assets/parts/curve.png";
		this.snakeStraightImg.src = "assets/parts/straight.png";
		this.snakeTailImg.src = "assets/parts/tail.png";

		this.snakeCanvas = new SnakeCanvas();

		this.background = new BackgroundEntity();
		this.currentSnake = new Snake();
		this.scoreEntity = new TextEntity(0, 0, "blue", "Score: 0", "20px Arial");

		this.entities = new Set();
		this.addEntity(this.background);
		this.addEntity(this.currentSnake);
		this.addEntity(this.scoreEntity);
		this.addEntity(new FoodEntity(this));

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

		this.imageRotationMap = {};
		this.imageRotationMap["left"] = 0;
		this.imageRotationMap["up"] = 90;
		this.imageRotationMap["right"] = 180;
		this.imageRotationMap["down"] = 270;
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
		if (entity instanceof Snake) {
			this.currentSnake = entity;
		}
	}

	onKeyDown(keyCode) {
		//Prevent buttonmashing
		if(this.prevKeyodeTicks != this.ticks){
			var keycodeMap = this.keycodeDirectionMap;

			if (keycodeMap[keyCode] !== undefined) {
				var newDirection = keycodeMap[keyCode];

				var snake = this.currentSnake;
				if (snake.snakeDirection != this.opposingDirectionsMap[newDirection]) {
					snake.snakeDirection = newDirection;
				}
			}
		}

		this.prevKeyodeTicks = this.ticks;
	}

	run() {
		this.ticks++;

		var snakeCanvas = this.snakeCanvas;
		snakeCanvas.updateCanvasSize();

		if (snakeCanvas.getScaledCellHeight() > 10 && snakeCanvas.getScaledPixelWidth() > 10) {
			var entities = this.entities;

			//Update living entities, remove dead ones
			entities.forEach(function (entity) {
				if (entity.dead) {
					entities.delete(entity);
				} else {
					entity.update();
				}
			});

			//Check for collisions, avoid checking self collisions
			entities.forEach(function (entity1) {
				entities.forEach(function (entity2) {
					if (entity1 != entity2 && entity1.collidesWith(entity2)) {
						entity1.onCollide(entity2);
					}
				})
			});

			//Painting
			snakeCanvas.scaleNext();

			entities.forEach(function (entity) {
				snakeCanvas.paintEntity(entity);
			});

			var snake = this.currentSnake;
			this.scoreEntity.text = "Score: " + (snake.getLength() - snake.SNAKE_START_LENGT);
			this.scoreEntity.y = this.snakeCanvas.getScaledCellHeight();
		} else {
			var canvasCont = snakeCanvas.canvasContext;

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

class Entity {

	constructor(x, y, width, height) {
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
		this.dead = false;
	}

	collidesWith(otherEntity) {
		//https://silentmatt.com/rectangle-intersection/
		var ax2 = this.x + this.width;
		var ay2 = this.y + this.height;

		var bx2 = otherEntity.x + otherEntity.width;
		var by2 = otherEntity.y + otherEntity.height;

		return this.x < bx2 && ax2 > otherEntity.x && this.y < by2 && ay2 > otherEntity.y;
	}

	isInside(otherEntity) {
		var otherRightX = otherEntity.width + otherEntity.x;
		var otherBottomY = otherEntity.height + otherEntity.y;

		return this.x <= otherRightX && this.y <= otherBottomY
			&& this.x + this.width <= otherRightX && this.y + this.height <= otherBottomY
			&& this.x >= otherEntity.x && this.y >= otherEntity.y;
	}

	kill() {
		this.dead = true;
	}

	paint(canvas) {
	}

	update() {
	}

	onCollide(otherEntity) {
	}
}

class Snake extends Entity {

	constructor() {
		super(null, null, null, null);
		this.SNAKE_START_LENGT = 5;

		this.snakeDirection = "right";
		this.snakeParts = [];

		//Initialize start snake
		for (var i = this.SNAKE_START_LENGT; i > 0; i--) {
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
		var butt = this.getButt();
		for (var i = 0; i < parts; i++) {
			this.snakeParts.push(new SnakePartEntity(butt.x, butt.y, SnakeGame.getGame().snakeStraightImg));
		}
	}

	headCollidesWith(item) {
		return this.getHead().collidesWith(item);
	}

	moveForward() {
		var snakeButt = this.popButt();
		var snakeHead = this.getHead();
		var direction = this.snakeDirection;

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
		for (var i = 0; i < this.snakeParts.length; i++) {
			var part = this.snakeParts[i];

			if (part.collidesWith(otherEntity)) {
				return true;
			}
		}
	}

	isInside(otherEntity) {
		for (var i = 0; i < this.snakeParts.length; i++) {
			if (this.snakeParts[i].isInside(otherEntity)) {
				return true;
			}
		}
	}

	paint(canvas) {
		this.snakeParts.forEach(function (part) {
			canvas.paintEntity(part);
		});
	}

	update() {
		this.moveForward();

		var head = this.getHead();
		var game = SnakeGame.getGame();
		var snake = this;

		if (!head.isInside(game.background)) {
			this.kill();
		}

		head.image = game.snakeHeadImg;
		head.rotation = game.imageRotationMap[this.snakeDirection];

		this.snakeParts.forEach(function (part) {
			if(part != head){
				part.rotation = 0;
				part.image = game.snakeStraightImg;

				//We avoid checking self collisions for most items
				//The snake needs to do that though
				if(snake.headCollidesWith(part)){
					snake.onCollide(snake);
				}
			}
		});

	}

	kill() {
		this.dead = true;
		
		var game = SnakeGame.getGame();
		game.entities.forEach(function (entity) {
			if (!entity.dead) {
				entity.kill();
			}
		});

		game.addEntity(new Snake());
		game.addEntity(new FoodEntity())
	}
	
	onCollide(otherEntity) {
		if (otherEntity instanceof FoodEntity) {
			this.append(4);
			otherEntity.kill();
			SnakeGame.getGame().addEntity(new FoodEntity());
		} else if (otherEntity instanceof Snake) {
			this.kill();
		}

		console.log(otherEntity)
	}
}

class ImageEntity extends Entity {

	constructor(x, y, width, height, image, rotation = 0) {
		super(x, y, width, height);

		this.image = image;
		this.rotation = rotation;
	}

	paint(canvas) {
		var context = canvas.canvasContext;
		var rotate = this.rotation != 0;

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

class FoodEntity extends ImageEntity {

	constructor() {
		super(null, null, 2, 2, SnakeGame.getGame().appleImg);
		this.update(true);
	}

	update(bypass) {
		var game = SnakeGame.getGame();
		if (!this.isInside(game.background) || bypass) {
			var snakeCanvas = game.snakeCanvas;
			var snake = game.currentSnake;

			var canvasWidth = snakeCanvas.getScaledCellWidth();
			var canvasHeight = snakeCanvas.getScaledCellHeight();

			var respawn = true;
			while (respawn) {
				this.x = getRandomInt(this.width, canvasWidth - this.width);
				this.y = getRandomInt(this.height, canvasHeight - this.height);
				respawn = snake.collidesWith(this);
			}
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
		var canvasCont = canvas.canvasContext;

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
	}

	paint(canvas) {
		var context = canvas.canvasContext;
		context.fillStyle = this.color;
		context.fillRect(0, 0, canvas.getScaledPixelWidth(), canvas.getScaledPixelHeight());
		context.strokeStyle = "black";
		context.strokeRect(0, 0, canvas.getScaledPixelWidth(), canvas.getScaledPixelHeight());
	}

	update() {
		var game = SnakeGame.getGame();
		this.width = game.snakeCanvas.getScaledCellWidth();
		this.height = game.snakeCanvas.getScaledCellHeight();
	}

	kill() {
	}
}





