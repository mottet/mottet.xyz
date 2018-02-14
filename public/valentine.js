
var marvin;
var jocelyn;
var heart;

function setup() {
  createCanvas(800,650);
  
  marvin = createSprite(100, 100, 16, 23);
  marvin.setCollider("rectangle", 0, -17, 16, 14);
  marvin.scale = 4;
  marvin.addAnimation("standing", "assets/marvin-0.png");
  marvin.addAnimation("moving", "assets/marvin-0.png", "assets/marvin-3.png");

  jocelyn = createSprite(700, 550, 16, 23);
  jocelyn.setCollider("rectangle", 0, -17, 16, 14);
  jocelyn.scale = 4;
  jocelyn.addAnimation("standing", "assets/jocelyn-0.png");
  jocelyn.addAnimation("moving", "assets/jocelyn-0.png", "assets/jocelyn-3.png");

  heart = createSprite(0, 0, 35, 35);
  heart.scale = 4;
  heart.addAnimation("beating", "assets/heart-0.png", "assets/heart-7.png");
  heart.changeAnimation("beating");
  heart.depth = 2;
  heart.visible = false;

  socket = io('https://mottet.xyz');
	socket.on('jocelynMove', jocelynMove);
}

function jocelynMove (newPosition) {
  jocelyn.position.x = newPosition.x;
  jocelyn.position.y = newPosition.y;
  jocelyn.velocity.x = newPosition.v_x;
  jocelyn.velocity.y = newPosition.v_y;
}

function draw() {
  background(166,77,232);
  
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

  if (jocelyn.velocity.x != 0 || jocelyn.velocity.y != 0) {
    if (jocelyn.velocity.x > 0)
      jocelyn.mirrorX(1);
    else if (jocelyn.velocity.x < 0)
      jocelyn.mirrorX(-1);
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

  if (distance() < 100) {
    heart.position.x = Math.round((marvin.position.x + jocelyn.position.x) / 2);
    heart.position.y = Math.round((marvin.position.y + jocelyn.position.y) / 2),
    heart.visible = true;
    var s = 'Happy Valentine\'s Day !! \nI Love you <3';
    textSize(80);
    fill(255, 81, 255);
    text(s, 20, 20, 550, 500); 
  } else {
    heart.visible = false;
  }

  socket.emit('marvinMove', {
    x: marvin.position.x,
    y: marvin.position.y,
    v_x: marvin.velocity.x,
    v_y: marvin.velocity.y
  });
  drawSprites();
}

function distance() {
  const x = marvin.position.x - jocelyn.position.x;
  const y = marvin.position.y - jocelyn.position.y;
  return Math.sqrt(x*x + y*y);
}
