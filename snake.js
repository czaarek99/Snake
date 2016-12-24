document.addEventListener('DOMContentLoaded', function() {
	initializeGame();
}, false);

var snakeStartLength = 5;
var opposingDirectionsMap = {};
var keycodeDirectionMap = {};
var foodImage;
var currentFood;
var currentSnake;
var snakeCanvas;
var background;

function initializeGame(){
	opposingDirectionsMap["left"] = "right";
	opposingDirectionsMap["up"] = "down";
	opposingDirectionsMap["right"] = "left";
	opposingDirectionsMap["down"] = "up";

	keycodeDirectionMap[37] = "left";
	keycodeDirectionMap[38] = "up";
	keycodeDirectionMap[39] = "right";
	keycodeDirectionMap[40] = "down";

	snakeCanvas = new SnakeCanvas(3);
	background = new Background();
	foodImage = new Image();
	foodImage.src = "assets/apple2.png";

	document.addEventListener("keydown", onKeyDown);

	//Run at 20 ticks
	setInterval(run, 50);
	spawnNewSnake();
}

function run(){
	computeLogic();
	paint();
}

function computeLogic(){
	currentSnake.moveForward();

	background.width = snakeCanvas.getScaledCellWidth();
	background.height = snakeCanvas.getScaledCellHeight();

	//Respawn the food it it is outside the snakeCanvas
	if(!currentFood.isInside(background, snakeCanvas)){
		spawnNewFood();
	}

	if(currentSnake.headCollidesWith(currentFood)){
		currentSnake.append(4);
		spawnNewFood();
	}

	var snakeHead = currentSnake.getHead();
	if(!snakeHead.isInside(background)){
		spawnNewSnake();
	} else {
		currentSnake.forEachPart(function(snakePart, index) {
			//Skip the first element since that is the head
			if(index > 0 && currentSnake.headCollidesWith(snakePart)){
				spawnNewSnake();
			}
		});
	}

}

function spawnNewSnake(){
	currentSnake = new Snake(snakeStartLength);
	spawnNewFood();
}

function spawnNewFood(){

	var collides = true;
	var newFood;

	var width = snakeCanvas.getScaledCellWidth();
	var height = snakeCanvas.getScaledCellHeight();

	while(collides){
		newFood = new Food(width, height, foodImage);
		currentSnake.snakeParts.some(function(snakePart) {
			if(newFood.collidesWith(snakePart)){
				collides = true;
				return true;
			} else {
				collides = false;
			}

		});
	}

	currentFood = newFood;
}

function paint(){
	snakeCanvas.updateCanvasSize();
	snakeCanvas.scaleNext();

	//Paint background and score
	var canvasCont = snakeCanvas.canvasContext;
	snakeCanvas.paintItem(background);

	canvasCont.fillStyle = "blue";
	canvasCont.font = "20px Arial";
	canvasCont.fillText("Score: " + (currentSnake.getLength() - snakeStartLength), 0, snakeCanvas.getScaledPixelHeight());

	//TODO: If performance is a concern iterate over snake parts only once
	currentSnake.forEachPart(function(item) {
		snakeCanvas.paintItem(item);
	});

	snakeCanvas.paintItem(currentFood);
}

function onKeyDown(event){
	if(keycodeDirectionMap[event.keyCode] !== undefined){
		var newDirection = keycodeDirectionMap[event.keyCode];

		if(currentSnake.snakeDirection != opposingDirectionsMap[newDirection]){
			currentSnake._snakeDirection = newDirection;
		}
	}
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

		this.scale = scale;
		this.updateCanvasSize();
	}

	paintItem(item){
		item.paint(this);
	}

	getScaledCellWidth(){
		return this.getScaledPixelWidth() / this._cellWidth;
	}

	getScaledCellHeight(){
		return this.getScaledPixelHeight() / this._cellHeight;
	}

	getScaledPixelHeight(){
		return this.canvas.height / this.scale;
	}

	getScaledPixelWidth(){
		return this.canvas.width / this.scale;
	}

	scaleNext(){
		this.canvasContext.scale(this.scale, this.scale);
	}

	updateCanvasSize(){
		//Remove 3 pixels to avoid overflow
		this.canvas.setAttribute("width", document.body.clientWidth);
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

}

class Snake {
	
	constructor(length){
		this._snakeDirection = "right";
		this._snakeParts = [];

		//Initialize start snake
		for(var i = length; i > 0; i--){
			this._snakeParts.push(new SnakePart(i, 2))
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
			this._snakeParts.push(new SnakePart(butt.x, butt.y));
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
}

class BoardItem {
	constructor(x, y, width, height){
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
	}

	collidesWith(otherItem){
		//https://silentmatt.com/rectangle-intersection/
		var ax2 = this.x + this.width;
		var ay2 = this.y + this.height;

		var bx2 = otherItem.x + otherItem.width;
		var by2 = otherItem.y + otherItem.height;

		return this.x < bx2 && ax2 > otherItem.x && this.y < by2 && ay2 > otherItem.y;
	}

	isInside(otherItem){
		var otherRightX = otherItem.width + otherItem.x;
		var otherBottomY = otherItem.height + otherItem.y;

		return this.x <= otherRightX && this.y <= otherBottomY
			&& this.x + this.width <= otherRightX && this.y + this.height <= otherBottomY
			&& this.x >= otherItem.x && this.y >= otherItem.y;
	}

	paint(canvas){}
}

class ColoredBoardItem extends BoardItem {

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

class ImageBoardItem extends BoardItem {

	constructor(x, y, width, height, image){
		super(x, y, width, height);

		this.image = image;
	}
}

class SnakePart extends ColoredBoardItem {
	constructor(x, y){
		super(x, y, 1, 1, "green");
	}

	paint(canvas){
		canvas.canvasContext.fillStyle = this.color;
		canvas.canvasContext.fillRect(this.x * canvas.cellWidth, this.y * canvas.cellHeight, canvas.cellWidth * this.width, canvas.cellHeight * this.height);
	}
}

class Food extends ImageBoardItem {
	constructor(boardWidth, boardHeight, image){
		super(getRandomInt(0, boardWidth), getRandomInt(0, boardHeight), 2, 2, image);
	}

	paint(canvas){
		canvas.canvasContext.drawImage(this.image, this.x * canvas.cellWidth, this.y * canvas.cellHeight, canvas.cellWidth * this.width, canvas.cellHeight * this.height);
	}
}

class Background extends ColoredBoardItem {

	constructor() {
		super(0, 0, null, null, "white");
	}

	paint(canvas){
		canvas.canvasContext.fillStyle = this.color;
		canvas.canvasContext.fillRect(0, 0, canvas.getScaledPixelWidth(), canvas.getScaledPixelHeight());
	}
}





