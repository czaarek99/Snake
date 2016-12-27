document.addEventListener('DOMContentLoaded', initializeGame);

var snakeGame;

class SnakeGame {

	constructor(){
		this.keycodeDirectionMap = {};

		this.foodImage = new Image();
		this.foodImage.src = "assets/apple2.png";

		this.snakeCanvas = new SnakeCanvas(1);
		this.background = new Background();
		this.currentSnake = new Snake();
		this.currentFood = new FoodEntity(this);

		this.entities = [];
		this.entities.push(this.currentSnake);
		this.entities.push(this.currentFood);
		this.entities.push(this.background);

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

}

//TODO: Cleanup
function onKeyDown(event){
	if(snakeGame.keycodeDirectionMap[event.keyCode] !== undefined){
		var newDirection = snakeGame.keycodeDirectionMap[event.keyCode];

		if(snakeGame.currentSnake.snakeDirection != snakeGame.opposingDirectionsMap[newDirection]){
			snakeGame.currentSnake.snakeDirection = newDirection;
		}
	}
}

function initializeGame(){
	snakeGame = new SnakeGame();

	document.addEventListener("keydown", onKeyDown);

	var scaleSlider = document.getElementById("scaleSlider");
	var snakeCanvas = snakeGame.snakeCanvas;
	snakeCanvas.scale = scaleSlider.value;
	scaleSlider.addEventListener("input", function () {
		snakeCanvas.scale = this.value;
	});

	//All sliders automatically update their values
	var sliderContainers = document.getElementsByClassName("sliderContainer");
	for(var i = 0; i < sliderContainers.length; i++){
		var sliderContainer = sliderContainers[i];
		var sliderValue = sliderContainer.getElementsByClassName("sliderValue")[0];
		var slider = sliderContainer.getElementsByClassName("slider")[0];

		var update = function() {sliderValue.innerHTML = slider.value};

		update();
		slider.addEventListener("input", update);

	}

	//Run at 20 ticks
	setInterval(run, 50);
}

function run(){
	//TODO: Object orientation
	snakeGame.background.update(snakeGame);
	snakeGame.currentSnake.update(snakeGame);
	snakeGame.currentFood.update(snakeGame);

	paint();
}

function paint(){
	var snakeCanvas = snakeGame.snakeCanvas;
	snakeCanvas.updateCanvasSize();
	snakeCanvas.scaleNext();

	//Paint background and score
	var canvasCont = snakeCanvas.canvasContext;
	snakeCanvas.paintEntity(snakeGame.background);

	//TODO: Make object oriented
	canvasCont.fillStyle = "blue";
	canvasCont.font = "20px Arial";
	canvasCont.fillText("Score: " + (snakeGame.currentSnake.getLength() - snakeGame.currentSnake.SNAKE_START_LENGT), 0, snakeCanvas.getScaledPixelHeight());

	snakeCanvas.paintEntity(snakeGame.currentSnake);
	snakeCanvas.paintEntity(snakeGame.currentFood);
}

function getRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

class SnakeCanvas {

	constructor(scale){
		this._cellWidth = 5;
		this._cellHeight = 5;

		this.canvas = document.getElementById("snakeCanvas");
		this._canvasContext = this.canvas.getContext("2d");

		this._scale = scale;
		this.updateCanvasSize();
	}

	paintEntity(entity){
		entity.paint(this);
	}

	getScaledCellWidth(){
		return this.getScaledPixelWidth() / this._cellWidth;
	}

	getScaledCellHeight(){
		return this.getScaledPixelHeight() / this._cellHeight;
	}

	getScaledPixelHeight(){
		return this.canvas.height / this._scale;
	}

	getScaledPixelWidth(){
		return this.canvas.width / this._scale;
	}

	scaleNext(){
		this.canvasContext.scale(this._scale, this._scale);
	}

	updateCanvasSize(){
		this.canvas.setAttribute("width", document.body.clientWidth * 0.75);
		this.canvas.setAttribute("height", document.body.clientHeight);
	}

	getRealWidth(){
		return this.canvas.width;
	}

	getRealHeight(){
		return this.canvas.height;
	}

	get cellWidth(){
		return this._cellWidth;
	}

	get cellHeight(){
		return this._cellHeight;
	}

	get canvasContext(){
		return this._canvasContext;
	}

	set scale(scale){
		this._scale = scale;
	}

}

class Entity {

	constructor(x, y, width, height){
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
		this.dead = false;
	}

	collidesWith(otherEntity){
		//https://silentmatt.com/rectangle-intersection/
		var ax2 = this.x + this.width;
		var ay2 = this.y + this.height;

		var bx2 = otherEntity.x + otherEntity.width;
		var by2 = otherEntity.y + otherEntity.height;

		return this.x < bx2 && ax2 > otherEntity.x && this.y < by2 && ay2 > otherEntity.y;
	}

	isInside(otherEntity){
		var otherRightX = otherEntity.width + otherEntity.x;
		var otherBottomY = otherEntity.height + otherEntity.y;

		return this.x <= otherRightX && this.y <= otherBottomY
			&& this.x + this.width <= otherRightX && this.y + this.height <= otherBottomY
			&& this.x >= otherEntity.x && this.y >= otherEntity.y;
	}

	paint(canvas){}

	update(game){}
}

class Snake extends Entity {

	constructor(){
		super(null, null, null, null);
		this.SNAKE_START_LENGT = 5;

		this._snakeDirection = "right";
		this._snakeParts = [];

		//Initialize start snake
		for(var i = this.SNAKE_START_LENGT; i > 0; i--){
			this._snakeParts.push(new SnakePartEntity(i, 2))
		}

	}

	get snakeDirection() {
		return this._snakeDirection;
	}

	set snakeDirection(value) {
		this._snakeDirection = value;
	}

	get snakeParts() {
		return this._snakeParts;
	}

	getLength(){
		return this._snakeParts.length;
	}

	getHead(){
		return this._snakeParts[0];
	}

	getButt(){
		return this._snakeParts[this._snakeParts.length - 1];
	}

	popButt(){
		return this._snakeParts.pop();
	}

	forEachPart(func){
		this._snakeParts.forEach(func);
	}

	append(parts = 1){
		var butt = this.getButt();
		for(var i = 0; i < parts; i++){
			this._snakeParts.push(new SnakePartEntity(butt.x, butt.y));
		}
	}

	headCollidesWith(item){
		return this.getHead().collidesWith(item);
	}

	moveForward(){
		var snakeButt = this.popButt();
		var snakeHead = this.getHead();
		var direction = this._snakeDirection;

		if(direction == "left"){
			snakeButt.x = snakeHead.x - 1;
			snakeButt.y = snakeHead.y;
		} else if(direction == "up"){
			snakeButt.y = snakeHead.y - 1;
			snakeButt.x = snakeHead.x;
		} else if(direction == "right"){
			snakeButt.x = snakeHead.x + 1;
			snakeButt.y = snakeHead.y;
		} else if(direction == "down"){
			snakeButt.y = snakeHead.y + 1;
			snakeButt.x = snakeHead.x;
		}

		//Move the butt in front of the snake, making it the new head
		this._snakeParts.unshift(snakeButt);
	}

	paint(canvas){
		this._snakeParts.forEach(function(part) {
			canvas.paintEntity(part);
		});
	}

	update(game){
		this.moveForward();

		if(this.headCollidesWith(game.currentFood)){
			this.append(4);
			game.currentFood = new FoodEntity(game);
		}

		if(!this.getHead().isInside(game.background)){
			game.currentSnake = new Snake();
		} else {
			this._snakeParts.forEach(function(snakePart, index) {
				//Skip the first element since that is the head
				if(index > 0 && game.currentSnake.headCollidesWith(snakePart)){
					game.currentSnake = new Snake();
				}
			});
		}

	}
}

class ColoredEntity extends Entity {

	constructor(x, y, width, height, color){
		super(x, y, width, height);

		this._color = color;
	}

	get color() {
		return this._color;
	}

	set color(value) {
		this._color = value;
	}
}

class ImageEntity extends Entity {

	constructor(x, y, width, height, image){
		super(x, y, width, height);

		this.image = image;
	}
}

class SnakePartEntity extends ColoredEntity {

	constructor(x, y){
		super(x, y, 1, 1, "green");
	}

	paint(canvas){
		canvas.canvasContext.fillStyle = this.color;
		canvas.canvasContext.fillRect(this.x * canvas.cellWidth, this.y * canvas.cellHeight, canvas.cellWidth * this.width, canvas.cellHeight * this.height);
	}
}

class FoodEntity extends ImageEntity {

	constructor(game){
		super(null, null, 2, 2, game.foodImage);
		this.update(game, true);
	}

	update(game, bypass){
		if(!this.isInside(game.background) || bypass){
			var snakeCanvas = game.snakeCanvas;
			var snake = game.currentSnake;

			var width = snakeCanvas.getScaledCellWidth();
			var height = snakeCanvas.getScaledCellHeight();

			var respawn = true;
			while(respawn){
				this.x = getRandomInt(0, width);
				this.y = getRandomInt(0, height);

				respawn = false;
				if(this.isInside(game.background)){
					snake.snakeParts.some(function(snakePart, index) {
						if(index > 0 && snake.headCollidesWith(snakePart)){
							respawn = true;
							return true;
						} else {
							respawn = false;
						}

					});
				}
			}
		}
	}

	paint(canvas){
		canvas.canvasContext.drawImage(this.image, this.x * canvas.cellWidth, this.y * canvas.cellHeight, canvas.cellWidth * this.width, canvas.cellHeight * this.height);
	}
}

class Background extends ColoredEntity {

	constructor() {
		super(0, 0, null, null, "white");
	}

	paint(canvas){
		var context = canvas.canvasContext;
		context.fillStyle = this.color;
		context.fillRect(0, 0, canvas.getScaledPixelWidth(), canvas.getScaledPixelHeight());
		context.strokeStyle = "black";
		context.strokeRect(0, 0, canvas.getScaledPixelWidth(), canvas.getScaledPixelHeight());
	}

	update(game){
		this.width = game.snakeCanvas.getScaledCellWidth();
		this.height = game.snakeCanvas.getScaledCellHeight();
	}
}





