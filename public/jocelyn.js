'use strict';

function setup() {
  setupGame('marvinMove', marvinMove);
}

function marvinMove (newPosition) {
  marvin.position.x = newPosition.x;
  marvin.position.y = newPosition.y;
  marvin.velocity.x = newPosition.v_x;
  marvin.velocity.y = newPosition.v_y;
}

function draw() {
  drawGame(jocelyn, marvin, 'jocelynMove');
}
