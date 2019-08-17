'use strict';

let marvin;
let jocelyn;
let heart;

let walls;
let platforms;

let touchFloor;

const JUMP_FORCE = -20;
const GRAVITY = 1;

function setupGame(socketMessageToListen, socketCallback) {
  createCanvas(730,670);
  
  marvin = createSprite(700, 100, 16, 23);
  marvin.setCollider("rectangle", 0, 0, 16, 23);
  marvin.scale = 4;
  marvin.addAnimation("standing", "assets/marvin-0.png");
  marvin.addAnimation("moving", "assets/marvin-0.png", "assets/marvin-3.png");

  jocelyn = createSprite(100, 1900, 16, 23);
  jocelyn.setCollider("rectangle", 0, 0, 16, 23);
  jocelyn.scale = 4;
  jocelyn.addAnimation("standing", "assets/jocelyn-0.png");
  jocelyn.addAnimation("moving", "assets/jocelyn-0.png", "assets/jocelyn-3.png");

  walls = new Group();
  platforms = new Group();

  let floor = createSprite(400, 2000, 800, 30);
  floor.shapeColor = color(255, 81, 255);
  floor.setCollider("rectangle", 0, 0, 800, 30);

  let roof = createSprite(400, 0, 800, 30);
  roof.shapeColor = color(255, 81, 255);
  roof.setCollider("rectangle", 0, 0, 800, 30);

  let leftWall = createSprite(0, 1000, 30, 2030);
  leftWall.shapeColor = color(255, 81, 255);
  leftWall.setCollider("rectangle", 0, 0, 30, 2030);

  let rightWall = createSprite(800, 1000, 30, 2030);
  rightWall.shapeColor = color(255, 81, 255);
  rightWall.setCollider("rectangle", 0, 0, 30, 2030);

  walls.add(floor);
  walls.add(roof);
  walls.add(leftWall);
  walls.add(rightWall);

  let final = createSprite(200, 300, 300, 30);
  final.shapeColor = color(255, 81, 255);
  final.setCollider("rectangle", 0, 0, 300, 30);
  platforms.add(final);

  for (let i = 3; i < 10; ++i) {
    let platform = createSprite(i % 2==0 ? 200 : 600, 200 * i, 300, 30);
    platform.shapeColor = color(255, 81, 255);
    platform.setCollider("rectangle", 0, 0, 300, 30);
    platforms.add(platform);
  }

  heart = createSprite(0, 0, 35, 35);
  heart.scale = 4;
  heart.addAnimation("beating", "assets/heart-0.png", "assets/heart-7.png");
  heart.changeAnimation("beating");
  heart.depth = 2;
  heart.visible = false;

  socket = io();
  socket.on(socketMessageToListen, socketCallback);
}

function drawGame(yourCharacter, otherCharacter, socketMessageName) {
  background(166,77,232);

  const s = 'Happy Valentine\'s Day !!\nI Love you <3';
  textSize(30);
  fill(255, 81, 255);
  text(s, 0, -90, 550, 500); 

  yourCharacter.collide(walls, isAbove);
  yourCharacter.collide(platforms, isAbove);
  yourCharacter.collide(otherCharacter, isAbove);
  
  if (!touchFloor) {
    yourCharacter.velocity.y += GRAVITY;
  }

  if(keyIsDown(LEFT_ARROW)) {
    yourCharacter.changeAnimation("moving");
    yourCharacter.mirrorX(-1);
    yourCharacter.velocity.x = -8;
  } else if(keyIsDown(RIGHT_ARROW)) {
    yourCharacter.changeAnimation("moving");
    yourCharacter.mirrorX(1);
    yourCharacter.velocity.x = 8;
  } else {
    yourCharacter.velocity.x = 0;
  }

  if(keyIsDown(32) && touchFloor) {
    yourCharacter.velocity.y = JUMP_FORCE;
  }

  if (yourCharacter.velocity.x === 0 && yourCharacter.velocity.y === 0) {
    yourCharacter.changeAnimation("standing");
  }

  if (otherCharacter.velocity.x != 0 || otherCharacter.velocity.y != 0) {
    if (otherCharacter.velocity.x > 0)
      otherCharacter.mirrorX(1);
    else if (otherCharacter.velocity.x < 0)
      otherCharacter.mirrorX(-1);
    otherCharacter.changeAnimation("moving");
  } else {
    otherCharacter.changeAnimation("standing");
  }

  camera.position.x = yourCharacter.position.x;
  camera.position.y = yourCharacter.position.y;

  touchFloor = false;

  if (distance(yourCharacter, otherCharacter) < 100) {
    heart.position.x = Math.round((otherCharacter.position.x + yourCharacter.position.x) / 2);
    heart.position.y = Math.round((otherCharacter.position.y + yourCharacter.position.y) / 2),
    heart.visible = true;
  } else {
    heart.visible = false;
  }

  socket.emit(socketMessageName, {
    x: yourCharacter.position.x,
    y: yourCharacter.position.y,
    v_x: yourCharacter.velocity.x,
    v_y: yourCharacter.velocity.y
  });
  drawSprites();
}

function isAbove(character, obstacle) {
  if (character.position.y + (character.height / 2) <= obstacle.position.y - (obstacle.height / 2)) {
    touchFloor = true;
    character.velocity.y = 0;
  }
}

function distance(betweenThis, andThis) {
  const x = betweenThis.position.x - andThis.position.x;
  const y = betweenThis.position.y - andThis.position.y;
  return Math.sqrt(x*x + y*y);
}
