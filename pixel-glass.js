var PixelGlass = function(){
  var defaultLegend = {
    //Numerical codes represnting different cell types
    pixelCodes : {background:0, interior:1, walls:2, walls2:3, base:4, base2:5, base3:6, stopper:7, sand1:8, sand2:9, sand3:10, dummySand:11,},
    pixelColors : {
      0: "rgba(0,0,0,0)", //Background
      1: "rgba(0,0,75,.1)", //Interior
      2: "#6acfdd", //Hourglass walls
      3: "#ffef00", //Hourglass walls 2
      4: "#6e4e03", //base
      5: "#553c01", //base 2
      6: "#845600", //base 3
      7: "#e2e2e2", //stopper
      8: "hsl(55,70%,60%)", //Sand 1
      9: "hsl(55,65%,50%)", //Sand 2
      10:"hsl(55,80%,65%)", //Sand 3 
      11: "#ffe96c", //dummy sand (sand not really simulated, visual effect)
    }
  };
  var defaultHourGlassConfig = {
    width: 99,            //Total cells wide
    height: 100,          //Total cells high
    pixelSize: 4,         //Size of a single cell within canvas
    offsetX: 0,           //X Offset entire cell grid within canvas 
    offsetY: 0,           //Y Offset entire cell grid within canvas
    cylinderHeight: 34,   //Weird variable determines hour glass shape (Tweak it until it works ;)
    timeStep:30,
    legend:defaultLegend
  };
  
  var HourGlass = function(config){
    this.config = config || defaultHourGlassConfig;
    this.tiles=[];
    this.canvas = document.createElement('canvas');
    this.canvas.width=this.config.width * this.config.pixelSize;
    this.canvas.height=this.config.height * this.config.pixelSize;
    this.grainsTotal=0;
    this.grainsDropped=0;
    this.time=0;
    this.running=false;
    this.grainDropDelay=0;
    this.leftToRight=false;
    this.mousePosition={x:0,y:0};
    this.create();
  };
  HourGlass.prototype.create = function(){
     this.running = false;
    
    //Essentially I build 2 halves of the hourglass (Two 2d arrays) simultaneously. One without sand.
    //Then I reverse bottom half array so that its a mirror of the top (minus sand) and stitch em together
    var topHalf = [],
      bottomHalf = [],
      w = this.config.width,
      h = this.config.height,
      z = this.config.cylinderHeight;

    for (var y = 0; y < h / 2; y++) {
      var topRow = [],
        bottomRow = [];
      for (var x = 0; x < w; x++) {

        //Hourglass base
        if ((y >= 0 && y <= 2) && (x > z - 3 && x < w - z + 2)) {
          var c = this.config.legend.pixelCodes.base;
          if (y == 1) c = this.config.legend.pixelCodes.base2;
          else if (y == 2) c = this.config.legend.pixelCodes.base3;
          topRow.push(c);
          bottomRow.push(c);
        }

        //Hourglass walls
        else if (x == z || x == z + 1 || x == (w - z - 1) || x == (w - z - 2)) {
          //magic number determines where middle ring lies
          var ringRatio = 1.4;
          var c = y >= (this.config.cylinderHeight * ringRatio) ? this.config.legend.pixelCodes.walls2 : this.config.legend.pixelCodes.walls;
          topRow.push(c);
          bottomRow.push(c);
        }

        //Interior & sand
        else if (x > z && x < (w - z - 1)) {
          if (Math.random() < 0.33) topRow.push(this.config.legend.pixelCodes.sand1);
          else if (Math.random() < 0.66) topRow.push(this.config.legend.pixelCodes.sand2);
          else topRow.push(this.config.legend.pixelCodes.sand3);
          this.grainsTotal++; //<< Count the sand
          bottomRow.push(this.config.legend.pixelCodes.interior);
        }

        //Exterior / background
        else {
          topRow.push(this.config.legend.pixelCodes.background);
          bottomRow.push(this.config.legend.pixelCodes.background);
        }
      }

      //Add rows to top/bottom arrays
      if (z < w / 2 - 3 && y > this.config.cylinderHeight) z++;
      topHalf.push(topRow);
      bottomHalf.push(bottomRow);
    }

    //Reverse bottom and append to top
    this.tiles = topHalf.concat(bottomHalf.reverse());

    //I kinda cheat here to remove a single grain from the top. Otherwise I end up with one that is never dropped
    this.tiles[Math.floor(h / 2 - 1)][Math.floor(w / 2)] = this.config.legend.pixelCodes.interior;
    this.grainsTotal--;

    //Create Stopper ( aka the grain dropper )
    //This cell looks empty but acts like a wall
    //The 'dropGrain' function expects the stopper to exist in this exact location
    this.tiles[Math.floor(h / 2)][Math.floor(w / 2)] = this.config.legend.pixelCodes.stopper;
    this.render();
  };
  HourGlass.prototype.render = function(){
    var context = this.canvas.getContext("2d"),
        w = this.config.width,
        h = this.config.height,
        s = this.config.pixelSize;
    context.clearRect(0,0,this.canvas.width,this.canvas.height);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var cell = this.tiles[y][x];
        //Ignore background tiles
        if (cell != this.config.legend.pixelCodes.background) {
          context.fillStyle = this.config.legend.pixelColors[cell];
          
          if (cell == this.config.legend.pixelCodes.dummySand){
            context.fillStyle = this.config.legend.pixelColors[this.config.legend.pixelCodes.sand1];
          }
          context.fillRect((x + this.config.offsetX) * s + (s / 2), (y + this.config.offsetY) * s + (s / 2), s, s);
        }
      }
    }
  }
  HourGlass.prototype.update = function(state){
    //What follows is how we keep track of the amount of time that has passed
    // between frames and whether or not it is time to drop a grain of sand. 
    // The delay between drops is updated after every grain to try and get better accuracy
    // This is really ugly. Too much 'this'  (Is it?)
    var now = Date.now(),
        updated = false,
        dt = this.config.timeStep;
    
    state.timeAcc += now - state.lastFrame;
    state.lastFrame = now;

    while (state.timeAcc >= dt){
      updated = true;
      state.timeAcc -= dt;
      state.grainTimeAcc += dt;
      if (state.grainTimeAcc >= this.grainDropDelay) {
        this.updateDelay(this.time - (Date.now()-state.startTime));
        state.grainTimeAcc = 0;
        this.dropGrain();
      } 
      else if (Math.random() > 0.8) {
        this.dropDummyGrain();
      }

      //This will alternate which cells are updated first (left side or right side)
      // It prevents the sand from prefering any one direction and keeps things moving towards/away from the middle
      //Its a hack but so isn't this whole thing really :)
      var w = this.config.width,
        h = this.config.height,
        lr = this.leftToRight;
      for (var x = (lr ? w - 1 : 0); (lr ? x > -1 : x < w); (lr ? x-- : x++)) {
        for (var y = h - 1; y > -1; y--) {
          this.updateCell(x, y);
        }
      }
      this.leftToRight = !this.leftToRight;
    }
    return updated;
  }
  HourGlass.prototype.updateCell = function(x,y){

    //Only sand cells get updated..
    if (this.tiles[y][x] < this.config.legend.pixelCodes.sand1) return;
    var interior = this.config.legend.pixelCodes.interior;
    //Inspect our neighbours
    var blockedBottom = this.tiles[y + 1][x] > interior,
        blockedTop = this.tiles[y - 1][x] > interior,
        blockedRight = this.tiles[y][x + 1] > interior,
        blockedLeft = this.tiles[y][x - 1] > interior,
        blockedBottomLeft = this.tiles[y + 1][x - 1] > interior,
        blockedBottomRight = this.tiles[y + 1][x + 1] > interior;

    //Handle mouse interaction with sand
    var mousePixelSize = 4,
        mouseX = this.mousePosition.x,
        mouseY = this.mousePosition.y;

    if (x > mouseX - mousePixelSize - this.offsetX && x < mouseX + mousePixelSize - this.offsetX &&
      y < mouseY + mousePixelSize / 2 - this.offsetY && y > mouseY - mousePixelSize / 2 - this.offsetY) {
      blockedBottom = true;
      blockedBottomLeft = true;
      blockedBottomRight = true;
    }

    //Remove dummy sand from simulation
    if (this.tiles[y][x] == this.config.legend.pixelCodes.dummySand && blockedBottom && blockedTop && blockedLeft && blockedRight) {
      this.tiles[y][x] = interior;
      return;
    }

    //The magic number 'r' is used to adjust when a grain of sand will move laterally to simulate falling over a cliff or piling up at the bottom. decrease 'n' (closer to 1) to get a steeper peak and pit
    var n = 1,
        r = Math.floor(Math.random() * (this.config.cylinderHeight * n)),
        w = this.config.width,
        h = this.config.height;

    //Movement rules.. (Lots of trial and error was used to get these right.)
    if (!blockedBottom) this.moveCell(x, y, 0, 1); //Straight Down
    else if (!blockedBottomLeft) this.moveCell(x, y, -1, 1); //Down & left
    else if (!blockedBottomRight) this.moveCell(x, y, 1, 1); //Down & right
    else if (x < Math.floor(w / 2) - r && !blockedRight && y < Math.floor(h / 2)) this.moveCell(x, y, 1, 0); //Move grain in the top left, right
    else if (x > Math.floor(w / 2) + r && !blockedLeft && y < Math.floor(h / 2)) this.moveCell(x, y, -1, 0); //Move grain in the top right, left   
    else if (x < Math.floor(w / 2) - r * 3 && !blockedLeft && blockedRight && y > Math.floor(h / 2)) this.moveCell(x, y, -1, 0); //Move bottom right grain, right
    else if (x > Math.floor(w / 2) + r * 3 && !blockedRight && blockedLeft && y > Math.floor(h / 2)) this.moveCell(x, y, 1, 0); //Move bottom-left grain, left
  }
  HourGlass.prototype.dropGrain = function(){
    //The stopper is just a cell that looks like its empty but basically acts like a wall.
    var stoppery = Math.floor(this.config.height / 2),
        stopperx = Math.floor(this.config.width / 2),
        tileAbove = this.tiles[stoppery - 1][stopperx],
        tileBelow = this.tiles[stoppery + 1][stopperx];

    if ((tileBelow == this.config.legend.pixelCodes.interior || tileBelow == this.config.legend.pixelCodes.dummySand) &&
      (tileAbove >= this.config.legend.pixelCodes.sand1)) {
      this.grainsDropped++;
      this.moveCell(stopperx, stoppery - 1, 0, 2);
    }
  };
  HourGlass.prototype.dropDummyGrain = function(){
    var stoppery = Math.floor(this.config.height / 2),
      stopperx = Math.floor(this.config.width / 2);
    if (this.tiles[stoppery + 1][stopperx] == this.config.legend.pixelCodes.interior) {
      this.tiles[stoppery + 1][stopperx] = this.config.legend.pixelCodes.dummySand;
    }
  };
  HourGlass.prototype.updateDelay = function(t){
    this.grainDropDelay = Math.floor(t / (this.grainsTotal - this.grainsDropped));
  };
  HourGlass.prototype.moveCell = function(x, y, x1, y1) {
    var tmp = this.tiles[y + y1][x + x1];
    this.tiles[y + y1][x + x1] = this.tiles[y][x];
    this.tiles[y][x] = tmp;
  };
  HourGlass.prototype.start = function(mins,callback){
    var now = Date.now();
    this.time = mins * 60000;
    this.updateDelay(this.time);
    this.running = true;
    var state = {
      startTime:now,
      lastFrame:now,
      timeAcc:0,
      grainTimeAcc:0
    }
    var me = this;
    var loop = function(){
      if (me.running && me.update(state)) me.render();
      if (me.grainsDropped >= me.grainsTotal) {
        me.running = false;
        if (callback) callback();
      }
      else if (me.running === true)
        {requestAnimationFrame(loop);}
    };
    loop();
  };
  HourGlass.prototype.setSandHue = function(hue){
    this.config.legend.pixelColors[this.config.legend.pixelCodes.sand1] = "hsl(" + hue + ",70%,60%)";
    this.config.legend.pixelColors[this.config.legend.pixelCodes.sand2] = "hsl(" + hue + ",65%,50%)";
    this.config.legend.pixelColors[this.config.legend.pixelCodes.sand3] = "hsl(" + hue + ",80%,65%)";
    this.render();
  }
  
  var HourGlassController = function(hourglass){this.hourglass = hourglass;};
  HourGlassController.prototype.start = function(time,callback){this.hourglass.start(time,callback);};
  HourGlassController.prototype.reset = function(){this.hourglass.create();};
  HourGlassController.prototype.getCanvas = function(){return this.hourglass.canvas;};
  HourGlassController.prototype.setHue = function(hue){this.hourglass.setSandHue(hue)};
  
  return {
    createHourGlass:function(){return new HourGlassController(new HourGlass())}
  };
};

var glass = PixelGlass().createHourGlass();
document.body.appendChild(glass.getCanvas());
glass.start(1,function(){console.log("OK");});



