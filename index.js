      // Circle formula
      let CIRCLE = Math.PI * 2;

      // Initializations for controls
      function Controls() {
        this.codes  = { 37: 'left', 39: 'right', 38: 'forward', 40: 'backward' };
        this.states = { 'left': false, 'right': false, 'forward': false, 'backward': false };
        document.addEventListener('keydown', this.onKey.bind(this, true), false);
        document.addEventListener('keyup', this.onKey.bind(this, false), false);
        document.addEventListener('touchstart', this.onTouch.bind(this), false);
        document.addEventListener('touchmove', this.onTouch.bind(this), false);
        document.addEventListener('touchend', this.onTouchEnd.bind(this), false);
      }

      // On key down
      Controls.prototype.onTouch = function(e) {
        let t = e.touches[0];
        this.onTouchEnd(e);
        if (t.pageY < window.innerHeight * 0.5) this.onKey(true, { keyCode: 38 });
        else if (t.pageX < window.innerWidth * 0.5) this.onKey(true, { keyCode: 37 });
        else if (t.pageY > window.innerWidth * 0.5) this.onKey(true, { keyCode: 39 });
      };

      // On key release
      Controls.prototype.onTouchEnd = function(e) {
        this.states = { 'left': false, 'right': false, 'forward': false, 'backward': false };
        e.preventDefault();
        e.stopPropagation();
      };

      // Helps with key presses and prevents refresh on key press
      Controls.prototype.onKey = function(val, e) {
        let state = this.codes[e.keyCode];
        if (typeof state === 'undefined') return;
        this.states[state] = val;
        e.preventDefault && e.preventDefault();
        e.stopPropagation && e.stopPropagation();
      };

      // Bitmap conversions
      function Bitmap(src, width, height) {
        this.image = new Image();
        this.image.src = src;
        this.width = width;
        this.height = height;
      }
      
      // Player initializations
      function Player(x, y, direction) {
        this.x = x;
        this.y = y;
        this.direction = direction;
        this.paces = 0;
      }

      // When player turns
      Player.prototype.rotate = function(angle) {
        this.direction = (this.direction + angle + CIRCLE) % (CIRCLE);
      };

      // When player forward or back
      Player.prototype.walk = function(distance, map) {
        let dx = Math.cos(this.direction) * distance;
        let dy = Math.sin(this.direction) * distance;
        if (map.get(this.x + dx, this.y) <= 0) this.x += dx;
        if (map.get(this.x, this.y + dy) <= 0) this.y += dy;
        this.paces += distance;
      };

      // Updates player as it moves
      Player.prototype.update = function(controls, map, seconds) {
        if (controls.left) this.rotate(-Math.PI * seconds);
        if (controls.right) this.rotate(Math.PI * seconds);
        if (controls.forward) this.walk(3 * seconds, map);
        if (controls.backward) this.walk(-3 * seconds, map);
      };

      // Map initializations
      function Map(size) {
        this.size = size;
        this.wallGrid = new Uint8Array(size * size);
        this.wallTexture = new Bitmap('wall_texture.jpg', 1024, 1024);
        this.floorTexture = new Bitmap('wall_texture.jpg', 1024, 1024);
        this.light = 0;
      }

      // Get wall placements
      Map.prototype.get = function(x, y) {
        x = Math.floor(x);
        y = Math.floor(y);
        if (x < 0 || x > this.size - 1 || y < 0 || y > this.size - 1) return -1;
        return this.wallGrid[y * this.size + x];
      };

      // Randomize map
      Map.prototype.randomize = function() {
        for (let i = 0; i < this.size * this.size; i++) {
          this.wallGrid[i] = Math.random() < 0.3 ? 1 : 0;
        }
      };

      // Casting out rays
      Map.prototype.cast = function(point, angle, range) {
        let self = this;
        let sin = Math.sin(angle);
        let cos = Math.cos(angle);
        let noWall = { length2: Infinity };

        return ray({ x: point.x, y: point.y, height: 0, distance: 0 });

        // Rays from origin point
        function ray(origin) {
          let stepX = step(sin, cos, origin.x, origin.y);
          let stepY = step(cos, sin, origin.y, origin.x, true);
          let nextStep = stepX.length2 < stepY.length2
            ? inspect(stepX, 1, 0, origin.distance, stepX.y)
            : inspect(stepY, 0, 1, origin.distance, stepY.x);

          if (nextStep.distance > range) return [origin];
          return [origin].concat(ray(nextStep));
        }

        // Each step player takes
        function step(rise, run, x, y, inverted) {
          if (run === 0) return noWall;
          let dx = run > 0 ? Math.floor(x + 1) - x : Math.ceil(x - 1) - x;
          let dy = dx * (rise / run);
          return {
            x: inverted ? y + dy : x + dx,
            y: inverted ? x + dx : y + dy,
            length2: dx * dx + dy * dy
          };
        }

        // Helps with collision detection
        function inspect(step, shiftX, shiftY, distance, offset) {
          let dx = cos < 0 ? shiftX : 0;
          let dy = sin < 0 ? shiftY : 0;
          step.height = self.get(step.x - dx, step.y - dy);
          step.distance = distance + Math.sqrt(step.length2);
          if (shiftX) step.shading = cos < 0 ? 2 : 0;
          else step.shading = sin < 0 ? 2 : 1;
          step.offset = offset - Math.floor(offset);
          return step;
        }
      };


    //   Map.prototype.update = function(seconds) {
    //     if (this.light > 0) this.light = Math.max(this.light - 10 * seconds, 0);
    //     else if (Math.random() * 5 < seconds) this.light = 2;
    //   };

      // Camera initializations
      function Camera(canvas, resolution, focalLength) {
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width = window.innerWidth * 0.5;
        this.height = canvas.height = window.innerHeight * 0.5;
        this.resolution = resolution;
        this.spacing = this.width / resolution;
        this.focalLength = focalLength || 0.8;
        this.range = 14;
        this.lightRange = 5;
        this.scale = (this.width + this.height) / 1200;
      }

      // Renders the columns
      Camera.prototype.render = function(player, map) {
        this.drawColumns(player, map);
      };

      // Prepares the columns to be drawn
      Camera.prototype.drawColumns = function(player, map) {
        this.ctx.save();
        for (let column = 0; column < this.resolution; column++) {
          let x = column / this.resolution - 0.5;
          let angle = Math.atan2(x, this.focalLength);
          let ray = map.cast(player, player.direction + angle, this.range);
          this.drawColumn(column, ray, angle, map, player);
        }
        this.ctx.restore();
      };

      // Draws each column on the screen
      Camera.prototype.drawColumn = function(column, ray, angle, map, player) {
        let ctx = this.ctx;
        let texture = map.wallTexture;
        let floorTexture = map.floorTexture;
        let left = Math.floor(column * this.spacing);
        let width = Math.ceil(this.spacing);
        let hit = -1;
        let wall;

        while (++hit < ray.length && ray[hit].height <= 0);

        for (let s = ray.length - 1; s >= 0; s--) {
            let step = ray[s];

            if (s === hit) {
                let textureX = Math.floor(texture.width * step.offset);
                wall = this.project(step.height, angle, step.distance);

                ctx.globalAlpha = 1;
                ctx.drawImage(texture.image, textureX, 0, 1, texture.height, left, wall.top, width, wall.height);

                ctx.fillStyle = '#000000';
                ctx.globalAlpha = Math.max((step.distance + step.shading) / this.lightRange - map.light, 0);
                ctx.fillRect(left, wall.top, width, wall.height);
            }

            // Prevents crash for endless horizon
            if(wall) {
                // Draw the floor texture
                let floorHeight = wall.top + wall.height;
                let floorX = (player.x + step.x) * floorTexture.width % (floorTexture.width * 2);
                let floorY = (player.y + step.y) * floorTexture.height % (floorTexture.height * 2);
                ctx.drawImage(floorTexture.image, floorX, floorY, width, this.height - floorHeight, left, floorHeight, width, this.height - floorHeight);

                //Draw the blue floor
                //ctx.fillStyle = 'blue';
                //let floorHeight = wall.top + wall.height;
                //ctx.fillRect(left, floorHeight, width, this.height - floorHeight);

                // Draw the red ceiling
                ctx.fillStyle = 'red';
                let ceilingHeight = 0;
                ctx.fillRect(left, ceilingHeight, width, wall.top);
            }
        }
    };

      // Gets walls based on camera position
      Camera.prototype.project = function(height, angle, distance) {
        let z = distance * Math.cos(angle);
        let wallHeight = this.height * height / z;
        let bottom = this.height / 2 * (1 + 1 / z);
        return {
          top: bottom - wallHeight,
          height: wallHeight
        }; 
      };

      // Game loop
      function GameLoop() {
        this.frame = this.frame.bind(this);
        this.lastTime = 0;
        this.callback = function() {};
      }

      // Starts game
      GameLoop.prototype.start = function(callback) {
        this.callback = callback;
        requestAnimationFrame(this.frame);
      };

      // Framerate
      GameLoop.prototype.frame = function(time) {
        let seconds = (time - this.lastTime) / 1000;
        this.lastTime = time;
        if (seconds < 0.2) this.callback(seconds);
        requestAnimationFrame(this.frame);
      };

      let display = document.getElementById('display');
      let player = new Player(15.3, -1.2, Math.PI * 0.3);
      let map = new Map(32);
      let controls = new Controls();
      let camera = new Camera(display, 320, 0.8);
      let loop = new GameLoop();

      map.randomize();
      
      // Game loop
      loop.start(function frame(seconds) {
        player.update(controls.states, map, seconds);
        camera.render(player, map);
      });
