'use strict';

function setup() {
  setupGame('jocelynMove', jocelynMove);
}

function jocelynMove (newPosition) {
  jocelyn.position.x = newPosition.x;
  jocelyn.position.y = newPosition.y;
  jocelyn.velocity.x = newPosition.v_x;
  jocelyn.velocity.y = newPosition.v_y;
}

function draw() {
  drawGame(marvin, jocelyn, 'marvinMove');
}
