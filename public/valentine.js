
var marvin;
var jocelyn;
var newJocelynPosition;

function setup() {
  createCanvas(800,650);
  
  marvin = createSprite(400, 150, 16, 23);
  marvin.setCollider("rectangle", 0, -17, 16, 14);
  marvin.scale = 4;
  marvin.addAnimation("standing", "assets/marvin-0.png");
  marvin.addAnimation("moving", "assets/marvin-0.png", "assets/marvin-3.png");

  jocelyn = createSprite(350, 150, 16, 23);
  newJocelynPosition = {
    x: 350,
    y: 150
  }
  jocelyn.setCollider("rectangle", 0, -17, 16, 14);
  jocelyn.scale = 4;
  jocelyn.addAnimation("standing", "assets/jocelyn-0.png");
  jocelyn.addAnimation("moving", "assets/jocelyn-0.png", "assets/jocelyn-3.png");

  socket = io('https://mottet.xyz');
	socket.on('jocelynMove', jocelynMove);
}

function jocelynMove (newPosition) {
  newJocelynPosition = newPosition;
}

function draw() {
  background(220,81,220);
  
  marvin.collide(jocelyn);
  if(keyIsDown(LEFT_ARROW) && marvin.position.x > 32) {
    marvin.changeAnimation("moving");
    marvin.mirrorX(-1);
    marvin.velocity.x = -4;
  } else if(keyIsDown(RIGHT_ARROW) && marvin.position.x < 768) {
    marvin.changeAnimation("moving");
    marvin.mirrorX(1);
    marvin.velocity.x = 4;
  } else {
    marvin.velocity.x = 0;
  }

  if(keyIsDown(UP_ARROW) && marvin.position.y > 46) {
    marvin.changeAnimation("moving");
    marvin.velocity.y = -4;
  } else if(keyIsDown(DOWN_ARROW) && marvin.position.y < 604) {
    marvin.changeAnimation("moving");
    marvin.velocity.y = 4;
  } else {
    marvin.velocity.y = 0;
  }
  
  if (marvin.velocity.x === 0 && marvin.velocity.y === 0) {
    marvin.changeAnimation("standing");
  }

  if (newJocelynPosition.x !== jocelyn.position.x || newJocelynPosition.y !== jocelyn.position.y) {
    if (newJocelynPosition.x > jocelyn.position.x)
      jocelyn.mirrorX(1);
    else if (newJocelynPosition.x < jocelyn.position.x)
      jocelyn.mirrorX(-1);
    jocelyn.position.x = newJocelynPosition.x;
    jocelyn.position.y = newJocelynPosition.y;
    jocelyn.changeAnimation("moving");
  } else {
    jocelyn.changeAnimation("standing");
  }

  if (marvin.position.y > jocelyn.position.y) {
    marvin.depth = 1;
    jocelyn.depth = -1;
  } else {
    marvin.depth = -1;
    jocelyn.depth = 1;
  }

  socket.emit('marvinMove', {
    x: marvin.position.x,
    y: marvin.position.y
  });
  drawSprites();
}
