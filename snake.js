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
		this.keycodeDirectionMap = {};

		this.foodImage = new Image();
		this.foodImage.src = "assets/apple2.png";

		this.snakeCanvas = new SnakeCanvas(1);
		this.snakeCanvas.updateCanvasSize();

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
		var keycodeMap = this.keycodeDirectionMap;

		if (keycodeMap[keyCode] !== undefined) {
			var newDirection = keycodeMap[keyCode];

			var snake = this.currentSnake;
			if (snake.snakeDirection != this.opposingDirectionsMap[newDirection]) {
				snake.snakeDirection = newDirection;
			}
		}
	}

	run() {
		var snakeCanvas = this.snakeCanvas;
		snakeCanvas.updateCanvasSize();

		if (snakeCanvas.getScaledCellHeight() > 10 && snakeCanvas.getScaledPixelWidth() > 10) {
			//Update living entities, remove dead ones
			var entities = this.entities;
			entities.forEach(function (entity) {
				if (entity.dead) {
					entities.delete(entity);
				} else {
					entity.update();
				}
			});

			//Check for collisions
			entities.forEach(function (entity1, index1) {
				entities.forEach(function (entity2, index2) {
					if (index2 >= index1 && entity1.collidesWith(entity2)) {
						entity1.onCollide(entity2);
						entity2.onCollide(entity1);
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

	constructor(scale) {
		this.cellWidth = 5;
		this.cellHeight = 5;

		this.canvas = document.getElementById("snakeCanvas");
		this.canvasContext = this.canvas.getContext("2d");

		this.scale = scale;
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
			this.snakeParts.push(new SnakePartEntity(butt.x, butt.y));
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
			if (this.snakeParts[i].collidesWith(otherEntity)) {
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

		if (!this.getHead().isInside(SnakeGame.getGame().background)) {
			this.kill();
		}

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
			SnakeGame.getGame().addEntity(new FoodEntity())
		} else if (otherEntity instanceof Snake) {
			this.kill();
		}
	}
}

class ColoredEntity extends Entity {

	constructor(x, y, width, height, color) {
		super(x, y, width, height);

		this.color = color;
	}

}

class ImageEntity extends Entity {

	constructor(x, y, width, height, image) {
		super(x, y, width, height);

		this.image = image;
	}
}

class SnakePartEntity extends ColoredEntity {

	constructor(x, y) {
		super(x, y, 1, 1, "green");
	}

	paint(canvas) {
		canvas.canvasContext.fillStyle = this.color;
		canvas.canvasContext.fillRect(this.x * canvas.cellWidth, this.y * canvas.cellHeight, canvas.cellWidth * this.width, canvas.cellHeight * this.height);
	}
}

class FoodEntity extends ImageEntity {

	constructor() {
		super(null, null, 2, 2, SnakeGame.getGame().foodImage);
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

	paint(canvas) {
		canvas.canvasContext.drawImage(this.image, this.x * canvas.cellWidth, this.y * canvas.cellHeight, canvas.cellWidth * this.width, canvas.cellHeight * this.height);
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





