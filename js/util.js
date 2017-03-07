/**
 * Global variables
 */

const log2 = Math.log(2);

/**
 * Global utility functions
 */

function $(selector){
	if(selector.startsWith("#")){
		return document.getElementById(selector.substring(1));
	} else if(selector.startsWith(".")){
		return document.getElementsByClassName(selector.substring(1));
	}
}

function getRandomDec(min, max){
	return (Math.random() * (max - min + 1)) + min;
}

function getRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function loadImage(src) {
	let img = new Image();
	img.src = "assets/" + src;
	return img;
}

function generateToolTip(id, icon, html, container, displayType){
	let toolTipID = "ToolTipID_" + id;
	let htmlContainerID = "HtmlContainerID_" + id;
	let toolTipImgID = "ToolTipImgID_" + id;

	container.insertAdjacentHTML("beforeend", `
		<div class="tooltip" id="${toolTipID}">
			<img src="${icon.src}" class="tooltipImg" id="${toolTipImgID}">
			<div id="${htmlContainerID}"></div>
			${html}
		</div>
	`);

	let tooltipElem = document.getElementById(toolTipID);
	container.addEventListener("mouseover", () => {
		tooltipElem.style.display = displayType;
	});

	container.addEventListener("mouseout", () => {
		tooltipElem.style.display = "none";
	});

	container.addEventListener("mousemove", (event) => {
		tooltipElem.style.top = (event.clientY - tooltipElem.clientHeight / 2) + "px";
	});

	return {
		mainContainer: tooltipElem,
		icon: document.getElementById(toolTipImgID),
		customHtmlContainer: document.getElementById(htmlContainerID)
	};
}

function create2DArray(rows) {
	var arr = [];

	for (var i = 0; i < rows; i++) {
		arr[i] = [];
	}

	return arr;
}