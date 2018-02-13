
var marvin;
var jocelyn;
var heart;
var newMarvinPosition;

function setup() {
  createCanvas(800,650);
  
  marvin = createSprite(400, 150, 16, 23);
  marvin.setCollider("rectangle", 0, -17, 16, 14);
  marvin.scale = 4;
  marvin.addAnimation("standing", "assets/marvin-0.png");
  marvin.addAnimation("moving", "assets/marvin-0.png", "assets/marvin-3.png");

  jocelyn = createSprite(350, 150, 16, 23);
  newMarvinPosition = {
    x: 350,
    y: 150
  }
  jocelyn.setCollider("rectangle", 0, -17, 16, 14);
  jocelyn.scale = 4;
  jocelyn.addAnimation("standing", "assets/jocelyn-0.png");
  jocelyn.addAnimation("moving", "assets/jocelyn-0.png", "assets/jocelyn-3.png");

  heart = createSprite(0, 0, 35, 35);
  heart.scale = 4;
  heart.addAnimation("beating", "assets/heart-0.png", "assets/heart-7.png");
  heart.changeAnimation("beating");
  heart.visible = false;

  socket = io('https://mottet.xyz');
	socket.on('marvinMove', marvinMove);
}

function marvinMove (newPosition) {
  newMarvinPosition = newPosition;
}

function draw() {
  background(220,81,220);
  
  jocelyn.collide(marvin);
  if(keyIsDown(LEFT_ARROW) && jocelyn.position.x > 32) {
    jocelyn.changeAnimation("moving");
    jocelyn.mirrorX(-1);
    jocelyn.velocity.x = -4;
  } else if(keyIsDown(RIGHT_ARROW) && jocelyn.position.x < 768) {
    jocelyn.changeAnimation("moving");
    jocelyn.mirrorX(1);
    jocelyn.velocity.x = 4;
  } else {
    jocelyn.velocity.x = 0;
  }

  if(keyIsDown(UP_ARROW) && jocelyn.position.y > 46) {
    jocelyn.changeAnimation("moving");
    jocelyn.velocity.y = -4;
  } else if(keyIsDown(DOWN_ARROW) && jocelyn.position.y < 604) {
    jocelyn.changeAnimation("moving");
    jocelyn.velocity.y = 4;
  } else {
    jocelyn.velocity.y = 0;
  }
  
  if (jocelyn.velocity.x === 0 && jocelyn.velocity.y === 0) {
    jocelyn.changeAnimation("standing");
  }

  if (newMarvinPosition.x !== marvin.position.x || newMarvinPosition.y !== marvin.position.y) {
    if (newMarvinPosition.x > marvin.position.x)
      marvin.mirrorX(1);
    else if (newMarvinPosition.x < marvin.position.x)
      marvin.mirrorX(-1);
    marvin.position.x = newMarvinPosition.x;
    marvin.position.y = newMarvinPosition.y;
    marvin.changeAnimation("moving");
  } else {
    marvin.changeAnimation("standing");
  }

  if (jocelyn.position.y > marvin.position.y) {
    jocelyn.depth = 1;
    marvin.depth = -1;
  } else {
    jocelyn.depth = -1;
    marvin.depth = 1;
  }

  if (distance() < 100) {
    heart.position.x = Math.round((marvin.position.x + jocelyn.position.x) / 2);
    heart.position.y = Math.round((marvin.position.y + jocelyn.position.y) / 2),
    heart.visible = true;
  } else {
    heart.visible = false;
  }

  socket.emit('jocelynMove', {
    x: jocelyn.position.x,
    y: jocelyn.position.y
  });
  drawSprites();
}

function distance() {
  const x = marvin.position.x - jocelyn.position.x;
  const y = marvin.position.y - jocelyn.position.y;
  return Math.sqrt(x*x + y*y);
}
