import { Component, ViewChild, ElementRef, AfterViewInit, NgZone, HostListener, Pipe, PipeTransform } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Pipe({name: 'bigNumber'})
export class BigNumberPipe implements PipeTransform {
  constructor(){}

  /**
  *
  * @param value
  * @returns {string}
  */
  transform(value: number): string {
    const suffixArray = ["", "k", "M", "B", "T", "q", "Q", "s"];
    if (value < 100 && !Number.isInteger(value) ){
      return value.toFixed(2) + '';
    } else if (value < 10000){
      return Math.round(value) + '';
    } else if (value >= Math.pow(10, (suffixArray.length)  * 3)){
      return value.toPrecision(3);
    } else {
      const numberPower = Math.floor(Math.log10(value));
      const numStr = Math.floor(value / Math.pow(10,numberPower - (numberPower % 3) - 2)) / 100;
      return numStr + suffixArray[Math.floor(numberPower / 3)];
    }
  }
}

export interface Point {
  x: number,
  y: number
}

export interface GridPoint {
  row: number,
  col: number
}

export interface Creep {
  position: Point,
  speed: number,
  direction: number,
  type: CreepType,
  health: number,
  maxHealth: number,
  lastCell: GridPoint,
  nextCell: GridPoint | null,
  pathToEndLength: number,
  phase: number,
  deaths: number,
  value: number,
  size: number,
  stunTimer?: number,
  status: Status[]
}

export interface DeathExplosion {
  position: Point,
  countdown: number
}

export interface BombExplosion {
  position: Point,
  size: number,
  countdown: number,
  color: string
}

enum ProjectileShape {
  Round,
  Missile
}

export interface Projectile {
  position: Point,
  destination?: Point,
  target?: Creep,
  speed: number,
  damage: number,
  damageType: DamageType,
  size: number,
  blastSize: number,
  color: string,
  stopOnImpact: boolean,
  shape: ProjectileShape
}

export interface Tower {
  gridPosition: GridPoint,
  position: Point,
  muzzlePoint: Point
  type: TowerType,
  fireCooldown: number, // ms from one shot until the next
  damage: number,
  damageType: DamageType,
  range: number,
  lastShotTime: number,
  target: Creep | null,
  extraTargets?: Creep[],
  lastTargetPosition: Point,
  animationPhase?: number,
  targetingPhase: TargetingPhase,
  projectileSize: number,
  projectileSpeed: number,
  blastSize: number,
  value: number,
  targetPriority: TargetPriority,
  lockTarget: boolean
}

export interface TowerTemplate {
  type: TowerType,
  fireCooldown: number,
  damage: number,
  damageType: DamageType,
  range: number,
  projectileSize: number,
  projectileSpeed: number,
}

export interface GooBlob {
  position: Point,
  duration: number,
  damageType: DamageType,
  damage: number
}

export interface Status {
  effect: DamageType,
  power: number,
  duration: number,
}

enum CreepType {
  Normal,
  Speedy,
  Stacker,
  Blob,
  EggLayer,
  Shield,
  Ghost,
  KineticAbsorber,
  EnergyEater,
  Boss,
  Party,
  Egg,
}

enum TowerType {
  Basic,
  Laser,
  Bullet,
  Bomb,
  Heat,
  DamageBooster,
  Radiation,
  Nuclear,
  Lightning,
  ChainLightning,
  Storm,
  Stun,
  Paralysis,
  EnergyRay,
  PlasmaRay,
  Sniper,
  Railgun,
  Gatling,
  MachineGun,
  Blunderbuss,
  Chainshot,
  Goo,
  Acid,
  Poison,
  TriShot,
  Cluster,
  Rocket,
  Missile
}

enum Direction {
  Up,
  Down,
  Left,
  Right
}

enum TargetingPhase {
  Firing,
  Aiming,
}

enum SquareType {
  Wall = 1,
  Open = 0,
  None = -1
}

enum TargetPriority {
  Nearest,
  ClosestToEnd,
  Strongest,
  Weakest
}

enum DamageType {
  Physical,
  Energy,
  Stun,
  Goo,
  Other,
  Acid,
  Poison
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.less']
})
export class AppComponent implements AfterViewInit{

  get SquareType() { return SquareType; }

  @ViewChild('canvasElement', {static: false}) public canvas: ElementRef | undefined;
  ctx: CanvasRenderingContext2D | null = null;
  requestId: number = 0;
  canvasWidth = 600;
  grid: number[][] = [];
  maxGridDimension = 20;
  selectedSquare: GridPoint | null = null;
  selectedSquareType: number = SquareType.None;
  selectedTower: Tower | null = null;
  ghostTower: Tower | null = null;
  selectedSquarePhase = 0;
  selectedSquarePhases = ["red", "orange", "yellow", "white"];
  startPosition = {row: 0, col: 0};
  endPosition = {row: 4, col: 4};
  creeps: Creep[] = [];
  deathExplosions: DeathExplosion[] = [];
  projectiles: Projectile[] = []
  bombExplosions: BombExplosion[] = [];
  gooBlobs: GooBlob[] = [];
  maxCreeps = 100;
  towers: Tower[] = [];
  nextCreepSpawn = 0;
  phaseChangeInterval = 100;
  nextPhaseChange = 0;
  nextSaveTime = 0;
  saveInterval = 30000; // ms between autosaves
  wave = 0;
  leaks = 0;
  creepsLeft = 10;
  creepSpawnInterval = 1000; // ms to next creep spawn
  waveCreepTypes = [CreepType.Normal, CreepType.Speedy, CreepType.Stacker, CreepType.Blob, CreepType.EggLayer, CreepType.Shield, CreepType.Ghost, CreepType.KineticAbsorber, CreepType.EnergyEater, CreepType.Boss, CreepType.Party];
  creepTypeStrings = ["Normal", "Speedy", "Stacker", "Blob", "Egg Layer", "Shield", "Ghost", "Kinetic Absorber", "Energy Eater", "Boss", "Party!"];
  towerTypeStrings = ["Basic", "Laser", "Bullet", "Bomb", "Heat", "Damage Booster", "Radiation", "Nuclear",
    "Lightning", "Chain Lightning", "Storm", "Stun", "Paralysis", "Energy Ray", "Plasma Ray", "Sniper", "Railgun",
    "Gatling", "Machine Gun", "Blunderbuss", "Chainshot Cannon", "Goo", "Acid", "Poison", "TriShot", "Cluster", "Rocket", "Missile"];
  targetPriorityStrings = ["Creep Closest to Tower", "Creep Closest to Goal", "Strongest Creep", "Weakest Creep"];
  cash = 20;
  waveTokens = 0;
  paused = false;
  unsolvable = false;
  wallCost = 1;
  towerCost = 10;
  sellPriceFactor = .1;
  expandGridCost = 10;
  waveCreepType = CreepType.Normal;
  ghostPhaseMax = 100;
  squaresize = 120;
  wallColor = "blue";
  tickMilliseconds = 10;

  towerTemplates: TowerTemplate[] = [
    {
      type: TowerType.Basic,
      fireCooldown: 1000,
      damage: 1,
      damageType: DamageType.Physical,
      range: 2,
      projectileSize: .05,
      projectileSpeed: .2,
    },
    {
      type: TowerType.Laser,
      fireCooldown: 10,
      damage: .1,
      damageType: DamageType.Energy,
      range: 2,
      projectileSize: 0,
      projectileSpeed: 0,
    },
    {
      type: TowerType.Bullet,
      fireCooldown: 1000,
      damage: 10,
      damageType: DamageType.Physical,
      range: 4,
      projectileSize: 0,
      projectileSpeed: 0,
    },
    {
      type: TowerType.Bomb,
      fireCooldown: 5000,
      damage: 20,
      damageType: DamageType.Energy,
      range: 3,
      projectileSize: .1,
      projectileSpeed: .1,
    },
    {
      type: TowerType.Heat,
      fireCooldown: 500,
      damage: 2,
      damageType: DamageType.Energy,
      range: 1.2,
      projectileSize: 0,
      projectileSpeed: 0,
    },
    {
      type: TowerType.DamageBooster,
      fireCooldown: 0,
      damage: 1.5,
      damageType: DamageType.Other,
      range: 1,
      projectileSize: 0,
      projectileSpeed: 0,
    },
    {
      type: TowerType.Radiation,
      fireCooldown: 10,
      damage: .1,
      damageType: DamageType.Energy,
      range: 1.5,
      projectileSize: 0,
      projectileSpeed: 0,
    },
    {
      type: TowerType.Nuclear,
      fireCooldown: 10,
      damage: 1,
      damageType: DamageType.Energy,
      range: 2.5,
      projectileSize: 0,
      projectileSpeed: 0,
    },
    {
      type: TowerType.Lightning,
      fireCooldown: 1000,
      damage: 10,
      damageType: DamageType.Energy,
      range: 2,
      projectileSize: 0,
      projectileSpeed: 0,
    },
    {
      type: TowerType.ChainLightning,
      fireCooldown: 1000,
      damage: 10,
      damageType: DamageType.Energy,
      range: 2,
      projectileSize: 0,
      projectileSpeed: 0,
    },
    {
      type: TowerType.Storm,
      fireCooldown: 1000,
      damage: 100,
      damageType: DamageType.Energy,
      range: 3,
      projectileSize: 0,
      projectileSpeed: 0,
    },
    {
      type: TowerType.Stun,
      fireCooldown: 1000,
      damage: 30,
      damageType: DamageType.Stun,
      range: 1.5,
      projectileSize: 0,
      projectileSpeed: 0,
    },
    {
      type: TowerType.Paralysis,
      fireCooldown: 1500,
      damage: 40,
      damageType: DamageType.Stun,
      range: 2,
      projectileSize: 0,
      projectileSpeed: 0,
    },
    {
      type: TowerType.EnergyRay,
      fireCooldown: 10,
      damage: 1,
      damageType: DamageType.Energy,
      range: 3,
      projectileSize: 0,
      projectileSpeed: 0,
    },
    {
      type: TowerType.PlasmaRay,
      fireCooldown: 10,
      damage: 2,
      damageType: DamageType.Energy,
      range: 4,
      projectileSize: 0,
      projectileSpeed: 0,
    },
    {
      type: TowerType.Sniper,
      fireCooldown: 1000,
      damage: 20,
      damageType: DamageType.Physical,
      range: 6,
      projectileSize: 0,
      projectileSpeed: 0,
    },
    {
      type: TowerType.Railgun,
      fireCooldown: 1000,
      damage: 50,
      damageType: DamageType.Physical,
      range: 8,
      projectileSize: 0,
      projectileSpeed: 0,
    },
    {
      type: TowerType.Gatling,
      fireCooldown: 100,
      damage: 5,
      damageType: DamageType.Physical,
      range: 2,
      projectileSize: 0,
      projectileSpeed: 0,
    },
    {
      type: TowerType.MachineGun,
      fireCooldown: 10,
      damage: 5,
      damageType: DamageType.Physical,
      range: 2.5,
      projectileSize: 0,
      projectileSpeed: 0,
    },
    {
      type: TowerType.Blunderbuss,
      fireCooldown: 1000,
      damage: 10,
      damageType: DamageType.Physical,
      range: 1,
      projectileSize: .05,
      projectileSpeed: .2,
    },
    {
      type: TowerType.Chainshot,
      fireCooldown: 1000,
      damage: 50,
      damageType: DamageType.Physical,
      range: 1.3,
      projectileSize: .1,
      projectileSpeed: .2,
    },
    {
      type: TowerType.Goo,
      fireCooldown: 2000,
      damage: 0,
      damageType: DamageType.Goo,
      range: 1.5,
      projectileSize: .1,
      projectileSpeed: .2,
    },
    {
      type: TowerType.Acid,
      fireCooldown: 2000,
      damage: 0.1,
      damageType: DamageType.Acid,
      range: 1.5,
      projectileSize: .1,
      projectileSpeed: .2,
    },
    {
      type: TowerType.Poison,
      fireCooldown: 2000,
      damage: 0.001,
      damageType: DamageType.Poison,
      range: 2,
      projectileSize: .05,
      projectileSpeed: .1,
    },
    {
      type: TowerType.TriShot,
      fireCooldown: 4000,
      damage: 20,
      damageType: DamageType.Energy,
      range: 3,
      projectileSize: .1,
      projectileSpeed: .1,
    },
    {
      type: TowerType.Cluster,
      fireCooldown: 4000,
      damage: 20,
      damageType: DamageType.Energy,
      range: 3,
      projectileSize: .1,
      projectileSpeed: .1,
    },
    {
      type: TowerType.Rocket,
      fireCooldown: 6000,
      damage: 40,
      damageType: DamageType.Physical,
      range: 4,
      projectileSize: .2,
      projectileSpeed: .05,
    },
    {
      type: TowerType.Missile,
      fireCooldown: 6000,
      damage: 80,
      damageType: DamageType.Physical,
      range: 5,
      projectileSize: .2,
      projectileSpeed: .05,
    },

  ];
  gameSpeedMultiplier = 1;
  now = 0;

  constructor(private ngZone: NgZone, private snackbar: MatSnackBar) {
    // @ts-ignore
    window['Game'] = this;
    this.grid = [
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ];
    this.updateSquareSize(this.canvasWidth / Math.max(this.grid.length, this.grid[0].length));
    this.startNextWave();
  }

  ngAfterViewInit(): void {
    if (!this.canvas){
      console.log("Couldn't initialize the canvas, the game can't start.");
      return;
    }
    this.ctx = this.canvas.nativeElement.getContext('2d');
    this.loadGame();
    if (this.ctx){
      this.ngZone.runOutsideAngular(() => this.updateCanvas());
      setInterval(() => {
        for (let i = 0; i < this.gameSpeedMultiplier; i++){
          if (!this.paused){
            this.now += this.tickMilliseconds;
            this.updateData(this.now);
          }
        }
      }, 10);

      this.updateCanvas();

      this.canvas.nativeElement.addEventListener(
        "click",
        (event: MouseEvent) => {

          const pos = this.getMousePos(event);
          // sanity check the position
          if (pos && pos.row >= 0 && pos.row < this.grid.length && pos.col >= 0 && pos.col < this.grid[0].length){
            if (!this.selectedSquare || this.selectedSquare.col != pos?.col || this.selectedSquare.row != pos?.row){
              this.selectSquare(pos.row, pos.col);
              return;
            }
          }
          this.selectedSquare = null;
          this.selectedTower = null;
          this.selectedSquareType = SquareType.None;
        }
      );
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (event.key == ' '){
      this.pauseClick();
      return;
    }
    if (!this.selectedSquare){
      return;
    }
    if (event.key == "Escape"){
      this.selectedSquare = null;
      this.selectedTower = null;
      this.selectedSquareType = SquareType.None;
      return;
    }

    if (event.key == "ArrowLeft"){
      if (this.selectedSquare.col > 0){
        this.selectSquare(this.selectedSquare.row, this.selectedSquare.col - 1);
      }
      return;
    }
    if (event.key == "ArrowRight"){
      if (this.selectedSquare.col < this.grid[0].length - 1){
        this.selectSquare(this.selectedSquare.row, this.selectedSquare.col + 1);
      }
      return;
    }
    if (event.key == "ArrowUp"){
      if (this.selectedSquare.row > 0){
        this.selectSquare(this.selectedSquare.row - 1, this.selectedSquare.col);
      }
      return;
    }
    if (event.key == "ArrowDown"){
      if (this.selectedSquare.row < this.grid.length - 1){
        this.selectSquare(this.selectedSquare.row + 1, this.selectedSquare.col);
      }
      return;
    }

    if (this.selectedSquareType == SquareType.Open && event.key == 'b'){
      this.addWall();
    }
    if (this.selectedSquareType == SquareType.Wall && this.selectedTower == null){
      if (event.key == 'r'){
        this.removeWall();
      }
      if (event.key == '1' || event.key == '2' || event.key == '3'){
        this.buildTower(parseInt(event.key) - 1);
      }
    }
    if (this.selectedTower != null){
      if (event.key == 's'){
        this.sellTower();
      }
    }

  }

  selectSquare(row: number, col: number){
    this.selectedSquare = {row: row, col: col};
    this.selectedSquareType = this.grid[this.selectedSquare.row][this.selectedSquare.col];
    this.selectedTower = this.getSelectedTower();
  }

  pauseClick(){
    if (this.unsolvable && this.paused){
      for (const creep of this.creeps){
        this.setNextCreepStep(creep);
        if (!creep.nextCell){
          // still unsolvable
          return;
        }
      }
    }
    this.paused = !this.paused;
  }

  getMousePos(event: MouseEvent): GridPoint | null {
    if (!this.canvas){
      return null;
    }
    var rect = this.canvas.nativeElement.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / this.squaresize);
    const y = Math.floor((event.clientY - rect.top) / this.squaresize);

    return { col: x, row: y };
  }


  updateCanvas() {
    if (this.ctx){
      this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

      // draw the walls and gridlines
      this.ctx.fillStyle = this.wallColor;
      this.ctx.lineWidth = 1;
      for (let i = 0; i < this.grid.length; i++){
        for (let j = 0; j < this.grid[i].length; j++){
          if (this.grid[i][j] == 1){
            this.ctx.fillRect(this.squaresize * j, this.squaresize * i, this.squaresize, this.squaresize);
          }
          this.ctx.strokeStyle = "teal";
          this.ctx.strokeRect(this.squaresize * j, this.squaresize * i, this.squaresize, this.squaresize);
        }
      }
      if (this.selectedSquare){
        this.ctx.strokeStyle = this.selectedSquarePhases[this.selectedSquarePhase];
        this.ctx.strokeRect(this.squaresize * this.selectedSquare.col, this.squaresize * this.selectedSquare.row, this.squaresize, this.squaresize);
      }

      const startPoint = this.getPointFromGridPoint(this.startPosition);
      // draw the source and destination
      this.ctx.strokeStyle = 'white';
      this.ctx.fillStyle = 'blue';
      this.ctx.beginPath();
      this.ctx.arc(startPoint.x, startPoint.y, this.squaresize / 2 - 5, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.lineWidth = 5;
      this.ctx.stroke();

      const endPoint = this.getPointFromGridPoint(this.endPosition);
      this.ctx.strokeStyle = 'white';
      this.ctx.fillStyle = 'green';
      this.ctx.beginPath();
      this.ctx.arc(endPoint.x, endPoint.y, this.squaresize / 2 - 5, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.lineWidth = 5;
      this.ctx.stroke();
      this.ctx.lineWidth = 1;


      // draw goo blobs
      for (const blob of this.gooBlobs){
        this.drawGooBlob(blob);
      }

      // draw egg creeps
      for (const creep of this.creeps){
        if (creep.type == CreepType.Egg){
          this.drawCreep(creep);
        }
      }
      // draw other creeps
      for (const creep of this.creeps){
        if (creep.type != CreepType.Egg){
          this.drawCreep(creep);
        }
      }

      // draw the towers
      for (let tower of this.towers){
        this.drawTower(tower);
      }

      // draw the projectiles
      for (const projectile of this.projectiles){
        this.ctx.lineWidth = 1;
        this.ctx.fillStyle = projectile.color;
        if (projectile.shape == ProjectileShape.Round){
          this.ctx.beginPath();
          this.ctx.arc(projectile.position.x, projectile.position.y, projectile.size, 0, 2 * Math.PI, false);
          this.ctx.fill();
        } else {
          if (projectile.destination){
            this.drawMissile(projectile.position, this.getPointOnLine(projectile.position, projectile.destination, -this.squaresize * .4, true), projectile.color);
          }
        }
      }

      // draw the explosions
      for (const explosion of this.deathExplosions){
        this.drawDeathExplosion(explosion);
      }
      for (const explosion of this.bombExplosions){
        this.drawBombExplosion(explosion);
      }

      if (this.selectedTower){
        //show the range of the selected tower
        const towerLocation = this.getPointFromGridPoint(this.selectedTower.gridPosition);
        this.ctx.lineWidth = 1;
        this.ctx.strokeStyle = "white";
        this.ctx.beginPath();
        this.ctx.arc(towerLocation.x, towerLocation.y, this.selectedTower.range * this.squaresize, 0, 2 * Math.PI, false);
        this.ctx.stroke();
      }

      if (this.ghostTower){
        //show the range of the ghost tower
        this.drawTower(this.ghostTower);
        const towerLocation = this.getPointFromGridPoint(this.ghostTower.gridPosition);
        this.ctx.strokeStyle = "white";
        this.ctx.beginPath();
        this.ctx.arc(towerLocation.x, towerLocation.y, this.ghostTower.range * this.squaresize, 0, 2 * Math.PI, false);
        this.ctx.stroke();
      }


      if (this.paused){

        this.ctx.font = 'bold 88px Arial';
        this.ctx.fillStyle = 'white';
        this.ctx.textAlign = "center";
        if (this.unsolvable){
          this.ctx.fillText("BLOCKED!", this.canvasWidth / 2, (this.canvasWidth / 2) - 150);
        }

        this.ctx.fillText("GAME", this.canvasWidth / 2, (this.canvasWidth / 2) - 50);
        this.ctx.fillText("PAUSED", this.canvasWidth / 2, (this.canvasWidth / 2) + 50);
        this.ctx.font = 'bold 44px Arial';
        this.ctx.fillText("(you can still build)", this.canvasWidth / 2, (this.canvasWidth / 2) + 100);

      }
    }

    //set up the next animationFrame
    this.requestId = requestAnimationFrame(this.updateCanvas.bind(this));
  }

  drawCreep(creep: Creep){
    if (this.ctx){

      const eye1Offset: Point = {x: 1, y: 1};
      const eye2Offset: Point = {x: 1, y: 1};
      if (creep.direction == Direction.Right){
        eye1Offset.x = 1;
        eye1Offset.y = -1;
        eye2Offset.x = 1;
        eye2Offset.y = 1;
      } else if (creep.direction == Direction.Left){
        eye1Offset.x = -1;
        eye1Offset.y = -1;
        eye2Offset.x = -1;
        eye2Offset.y = 1;
      } else if (creep.direction == Direction.Down){
        eye1Offset.x = -1;
        eye1Offset.y = 1;
        eye2Offset.x = 1;
        eye2Offset.y = 1;
      } else if (creep.direction == Direction.Up){
        eye1Offset.x = -1;
        eye1Offset.y = -1;
        eye2Offset.x = 1;
        eye2Offset.y = -1;
      }
      let creepRadius = creep.size * this.squaresize;
      if (creep.type == CreepType.Normal){
        // draw the body
        this.ctx.fillStyle = 'yellow';
        this.ctx.strokeStyle = 'lightblue';
        this.ctx.beginPath();
        this.ctx.arc(creep.position.x, creep.position.y, creepRadius, 0, 2 * Math.PI, false);
        this.ctx.fill();
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // add the eyes for cuteness
        this.ctx.fillStyle = 'black';
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(creep.position.x + (eye1Offset.x * creepRadius * .4), creep.position.y + (eye1Offset.y * creepRadius * .4), creepRadius * .3, 0, 2 * Math.PI, false);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(creep.position.x + (eye2Offset.x * creepRadius * .4), creep.position.y + (eye2Offset.y * creepRadius * .4), creepRadius * .3, 0, 2 * Math.PI, false);
        this.ctx.fill();
      } else if (creep.type == CreepType.Speedy){
        // draw the body
        let xOffset1 = creepRadius;
        let yOffset1 = 0;
        let xOffset2 = -creepRadius;
        let yOffset2 = -creepRadius;
        let xOffset3 = -creepRadius;
        let yOffset3 = creepRadius;
        if (creep.direction == Direction.Left){
          xOffset1 = -creepRadius;
          yOffset1 = 0;
          xOffset2 = creepRadius;
          yOffset2 = -creepRadius;
          xOffset3 = creepRadius;
          yOffset3 = creepRadius;
        } else if (creep.direction == Direction.Up){
          xOffset1 = 0;
          yOffset1 = -creepRadius;
          xOffset2 = -creepRadius;
          yOffset2 = creepRadius;
          xOffset3 = creepRadius;
          yOffset3 = creepRadius;
        } else if (creep.direction == Direction.Down) {
          xOffset1 = 0;
          yOffset1 = creepRadius;
          xOffset2 = -creepRadius;
          yOffset2 = -creepRadius;
          xOffset3 = creepRadius;
          yOffset3 = -creepRadius;
        }
        this.ctx.beginPath();
        this.ctx.moveTo(creep.position.x + xOffset1, creep.position.y + yOffset1);
        this.ctx.lineTo(creep.position.x + xOffset2, creep.position.y + yOffset2);
        this.ctx.lineTo(creep.position.x + xOffset3, creep.position.y + yOffset3);
        this.ctx.fillStyle = 'yellow';
        this.ctx.fill();
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = 'lightblue';
        this.ctx.stroke();
        this.ctx.lineWidth = 1;

        //eyes
        this.ctx.fillStyle = 'black';
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(creep.position.x + (eye1Offset.x * creepRadius * .2), creep.position.y + (eye1Offset.y * creepRadius * .2), creepRadius * .1, 0, 2 * Math.PI, false);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(creep.position.x + (eye2Offset.x * creepRadius * .2), creep.position.y + (eye2Offset.y * creepRadius * .2), creepRadius * .1, 0, 2 * Math.PI, false);
        this.ctx.fill();

      } else if (creep.type == CreepType.Boss){
        const eye1position = {x: creep.position.x + (eye1Offset.x * creepRadius * .4), y: creep.position.y + (eye1Offset.y * creepRadius * .4)};
        const eye2position = {x: creep.position.x + (eye2Offset.x * creepRadius * .4), y: creep.position.y + (eye2Offset.y * creepRadius * .4)};

        // draw the body
        this.ctx.beginPath();
        this.ctx.arc(creep.position.x, creep.position.y, creepRadius, 0, 2 * Math.PI, false);
        this.ctx.fillStyle = 'orange';
        this.ctx.fill();
        this.ctx.lineWidth = 1;
        this.ctx.strokeStyle = 'red';
        this.ctx.stroke();

        //eyes
        this.ctx.fillStyle = 'black';
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(eye1position.x, eye1position.y, creepRadius * .3, 0, 2 * Math.PI, false);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(eye2position.x, eye2position.y, creepRadius * .3, 0, 2 * Math.PI, false);
        this.ctx.fill();

        if (this.squaresize > 30){
          // angry eyebrows
          let midpoint = this.getPointOnLine(creep.position, eye1position, creepRadius * .25);
          let p1 = this.getPerpendicularPoint1(midpoint, creep.position, creepRadius * .2);
          let p2 = this.getPerpendicularPoint2(midpoint, creep.position, creepRadius * .2);
          this.ctx.strokeStyle = 'black';
          this.ctx.beginPath();
          this.ctx.moveTo(p1.x, p1.y);
          this.ctx.lineTo(p2.x, p2.y);
          this.ctx.stroke()
          midpoint = this.getPointOnLine(creep.position, eye2position, creepRadius * .25);
          p1 = this.getPerpendicularPoint1(midpoint, creep.position, creepRadius * .2);
          p2 = this.getPerpendicularPoint2(midpoint, creep.position, creepRadius * .2);
          this.ctx.beginPath();
          this.ctx.moveTo(p1.x, p1.y);
          this.ctx.lineTo(p2.x, p2.y);
          this.ctx.stroke()
        }

      } else if (creep.type == CreepType.Stacker){

        // draw the body
        this.ctx.fillStyle = 'purple';
        this.ctx.strokeStyle = 'violet';
        this.ctx.fillRect(creep.position.x - creepRadius / 2 + creep.phase - 5, creep.position.y - creepRadius / 2 + creep.phase - 5, creepRadius, creepRadius);
        this.ctx.strokeRect(creep.position.x - creepRadius / 2 + creep.phase - 5, creep.position.y - creepRadius / 2 + creep.phase - 5, creepRadius, creepRadius);

        //eyes
        this.ctx.fillStyle = 'black';
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(creep.position.x + (eye1Offset.x * creepRadius * .2) + creep.phase - 5, creep.position.y + (eye1Offset.y * creepRadius * .2) + creep.phase - 5, creepRadius * .1, 0, 2 * Math.PI, false);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(creep.position.x + (eye2Offset.x * creepRadius * .2) + creep.phase - 5, creep.position.y + (eye2Offset.y * creepRadius * .2) + creep.phase - 5, creepRadius * .1, 0, 2 * Math.PI, false);

        this.ctx.fill();
      } else if (creep.type == CreepType.Blob){
        let xOffset1;
        let yOffset1;
        let xOffset2;
        let yOffset2;
        let xOffset3;
        let yOffset3;
        if (creep.direction == Direction.Up){
          xOffset1 = 0;
          yOffset1 = creepRadius / 2 + (creep.phase * creepRadius * .1);
          xOffset2 = 0;
          yOffset2 = -creepRadius / 2;
          xOffset3 = creepRadius;
          yOffset3 = 0;
          eye1Offset.x = eye1Offset.x * creepRadius * .4 + xOffset2;
          eye1Offset.y = eye1Offset.y * creepRadius * .4 + yOffset2;
          eye2Offset.x = eye2Offset.x * creepRadius * .4 + xOffset2;
          eye2Offset.y = eye2Offset.y * creepRadius * .4 + yOffset2;
        } else if (creep.direction == Direction.Down) {
          xOffset1 = 0;
          yOffset1 = creepRadius / 2;
          xOffset2 = 0;
          yOffset2 = -creepRadius / 2 - (creep.phase * creepRadius * .1);
          xOffset3 = creepRadius;
          yOffset3 = 0;
          eye1Offset.x = eye1Offset.x * creepRadius * .4 + xOffset1;
          eye1Offset.y = eye1Offset.y * creepRadius * .4 + yOffset1;
          eye2Offset.x = eye2Offset.x * creepRadius * .4 + xOffset1;
          eye2Offset.y = eye2Offset.y * creepRadius * .4 + yOffset1;
        } else if (creep.direction == Direction.Left) {
          xOffset1 = creepRadius / 2 + (creep.phase * creepRadius * .1);
          yOffset1 = 0;
          xOffset2 = -creepRadius / 2;
          yOffset2 = 0;
          xOffset3 = 0;
          yOffset3 = creepRadius;
          eye1Offset.x = eye1Offset.x * creepRadius * .4 + xOffset2;
          eye1Offset.y = eye1Offset.y * creepRadius * .4 + yOffset2;
          eye2Offset.x = eye2Offset.x * creepRadius * .4 + xOffset2;
          eye2Offset.y = eye2Offset.y * creepRadius * .4 + yOffset2;
        } else {
          xOffset1 = creepRadius / 2;
          yOffset1 = 0;
          xOffset2 = -creepRadius / 2 - (creep.phase * creepRadius * .1);
          yOffset2 = 0;
          xOffset3 = 0;
          yOffset3 = creepRadius;
          eye1Offset.x = eye1Offset.x * creepRadius * .4 + xOffset1;
          eye1Offset.y = eye1Offset.y * creepRadius * .4 + yOffset1;
          eye2Offset.x = eye2Offset.x * creepRadius * .4 + xOffset1;
          eye2Offset.y = eye2Offset.y * creepRadius * .4 + yOffset1;
        }

        // draw the body
        this.ctx.fillStyle = '#375c2d';
        this.ctx.strokeStyle = '#375c2d';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(creep.position.x + xOffset1, creep.position.y + yOffset1, creepRadius, 0, 2 * Math.PI, false);
        this.ctx.arc(creep.position.x + xOffset2, creep.position.y + yOffset2, creepRadius, 0, 2 * Math.PI, false);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.moveTo(creep.position.x + xOffset1 + xOffset3, creep.position.y + yOffset1 + yOffset3);
        this.ctx.lineTo(creep.position.x + xOffset2 + xOffset3, creep.position.y + yOffset2 + yOffset3);
        this.ctx.lineTo(creep.position.x + xOffset2 - xOffset3, creep.position.y + yOffset2 - yOffset3);
        this.ctx.lineTo(creep.position.x + xOffset1 - xOffset3, creep.position.y + yOffset1 - yOffset3);
        this.ctx.closePath();
        this.ctx.fill();

        //eyes
        this.ctx.fillStyle = 'black';
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(creep.position.x + eye1Offset.x, creep.position.y + eye1Offset.y, creepRadius * .2, 0, 2 * Math.PI, false);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(creep.position.x + eye2Offset.x, creep.position.y + eye2Offset.y, creepRadius * .2, 0, 2 * Math.PI, false);
        this.ctx.fill();
      } else if (creep.type == CreepType.Shield){
        // draw the body
        this.ctx.fillStyle = '#71797E';
        this.ctx.strokeStyle = 'lightblue';
        this.ctx.beginPath();
        this.ctx.moveTo(creep.position.x + creepRadius, creep.position.y);
        this.ctx.lineTo(creep.position.x, creep.position.y + creepRadius);
        this.ctx.lineTo(creep.position.x - creepRadius, creep.position.y);
        this.ctx.lineTo(creep.position.x, creep.position.y - creepRadius);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // add the eyes for cuteness
        this.ctx.fillStyle = 'black';
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(creep.position.x + (eye1Offset.x * creepRadius * .4), creep.position.y + (eye1Offset.y * creepRadius * .3), creepRadius * .2, 0, 2 * Math.PI, false);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(creep.position.x + (eye2Offset.x * creepRadius * .4), creep.position.y + (eye2Offset.y * creepRadius * .3), creepRadius * .2, 0, 2 * Math.PI, false);
        this.ctx.fill();
      } else if (creep.type == CreepType.EggLayer){
        let phaseModifier = 1 + creep.phase / 10;
        if (phaseModifier > 1.5){
          phaseModifier = 2 - creep.phase / 10;
        }
        let antiphaseModifier = 2.5 - phaseModifier;
        // draw the body
        this.ctx.fillStyle = 'brown';
        this.ctx.strokeStyle = '#F5F5DC';
        this.ctx.beginPath();
        this.ctx.ellipse(creep.position.x, creep.position.y, creepRadius * antiphaseModifier, (creepRadius * phaseModifier), 0, 0, 2 * Math.PI, false);
        this.ctx.fill();
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // add the eyes for cuteness
        this.ctx.fillStyle = 'black';
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(creep.position.x + (eye1Offset.x * creepRadius * .4), creep.position.y + (eye1Offset.y * creepRadius * .4), creepRadius * .3, 0, 2 * Math.PI, false);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(creep.position.x + (eye2Offset.x * creepRadius * .4), creep.position.y + (eye2Offset.y * creepRadius * .4), creepRadius * .3, 0, 2 * Math.PI, false);
        this.ctx.fill();
      } else if (creep.type == CreepType.Egg){
        let eggBottom = {x: creep.position.x, y: creep.position.y + creepRadius / 2};
        let eggTop = {x: creep.position.x, y: creep.position.y - creepRadius / 2};
        let midpoint1 = this.getPointOnLine(eggBottom, eggTop, creepRadius * .15);
        let midpoint2 = this.getPointOnLine(eggBottom, eggTop, creepRadius * .9);
        let perpendicularPoint1 = this.getPerpendicularPoint1(midpoint1, eggTop, creepRadius * .6);
        let perpendicularPoint2 = this.getPerpendicularPoint2(midpoint2, eggBottom, creepRadius * .2);
        let perpendicularPoint3 = this.getPerpendicularPoint2(midpoint1, eggTop, creepRadius * .6);
        let perpendicularPoint4 = this.getPerpendicularPoint1(midpoint2, eggBottom, creepRadius * .2);

        // draw the body
        this.ctx.fillStyle = '#F5F5DC';
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(eggBottom.x, eggBottom.y);
        this.ctx.bezierCurveTo(perpendicularPoint1.x, perpendicularPoint1.y, perpendicularPoint2.x, perpendicularPoint2.y, eggTop.x, eggTop.y);
        this.ctx.moveTo(eggBottom.x, eggBottom.y);
        this.ctx.bezierCurveTo(perpendicularPoint3.x, perpendicularPoint3.y, perpendicularPoint4.x, perpendicularPoint4.y, eggTop.x, eggTop.y);
        this.ctx.fill();
        this.ctx.stroke();
      } else if (creep.type == CreepType.Ghost){
        // draw the body
        this.ctx.strokeStyle = 'white';
        if (creep.phase > this.ghostPhaseMax / 2){
          this.ctx.fillStyle = 'white';
        } else {
          this.ctx.fillStyle = 'black';
        }
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(creep.position.x, creep.position.y, creepRadius, 0, 2 * Math.PI, false);
        this.ctx.fill();
        this.ctx.stroke();

        // add the eyes for cuteness
        this.ctx.lineWidth = 1;
        if (creep.phase > this.ghostPhaseMax / 2){
          this.ctx.fillStyle = 'black';
          this.ctx.strokeStyle = 'black';
        } else {
          this.ctx.fillStyle = 'white';
          this.ctx.strokeStyle = 'white';
        }
        this.ctx.beginPath();
        this.ctx.arc(creep.position.x + (eye1Offset.x * creepRadius * .4), creep.position.y + (eye1Offset.y * creepRadius * .4), creepRadius * .3, 0, 2 * Math.PI, false);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(creep.position.x + (eye2Offset.x * creepRadius * .4), creep.position.y + (eye2Offset.y * creepRadius * .4), creepRadius * .3, 0, 2 * Math.PI, false);
        this.ctx.fill();
      } else if (creep.type == CreepType.KineticAbsorber){
        // draw the body
        this.ctx.fillStyle = 'deeppink';
        this.ctx.strokeStyle = 'white';
        this.ctx.beginPath();
        this.ctx.ellipse(creep.position.x, creep.position.y, creepRadius , creepRadius / 3, 2 * Math.PI * creep.phase * .1, 0, 2 * Math.PI, false);
        this.ctx.fill();
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // add the eyes for cuteness
        this.ctx.lineWidth = 1;
        this.ctx.fillStyle = 'black';
        this.ctx.strokeStyle = 'black';
        this.ctx.beginPath();
        this.ctx.arc(creep.position.x + (eye1Offset.x * creepRadius * .1), creep.position.y + (eye1Offset.y * creepRadius * .1), creepRadius * .1, 0, 2 * Math.PI, false);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.arc(creep.position.x + (eye2Offset.x * creepRadius * .1), creep.position.y + (eye2Offset.y * creepRadius * .1), creepRadius * .1, 0, 2 * Math.PI, false);
        this.ctx.fill();
        this.ctx.stroke();
      } else if (creep.type == CreepType.EnergyEater){
        let phaseModifier = 1 + creep.phase / 10;
        if (phaseModifier > 1.5){
          phaseModifier = 2 - creep.phase / 10;
        }
        let antiphaseModifier = 2.5 - phaseModifier;

        if (creep.direction == Direction.Up){
          eye1Offset.x = (eye1Offset.x * creepRadius * .2);
          eye1Offset.y = -(eye1Offset.y * creepRadius * .2) - (creepRadius * antiphaseModifier / 2)
          eye2Offset.x = (eye2Offset.x * creepRadius * .2);
          eye2Offset.y = -(eye2Offset.y * creepRadius * .2) - (creepRadius * antiphaseModifier / 2)
        } else if (creep.direction == Direction.Down) {
          eye1Offset.x = (eye1Offset.x * creepRadius * .2);
          eye1Offset.y = -(eye1Offset.y * creepRadius * .2) + (creepRadius * antiphaseModifier / 2)
          eye2Offset.x = (eye2Offset.x * creepRadius * .2);
          eye2Offset.y = -(eye2Offset.y * creepRadius * .2) + (creepRadius * antiphaseModifier / 2)
        } else if (creep.direction == Direction.Left) {
          eye1Offset.x = -(eye1Offset.x * creepRadius * .2) - (creepRadius * phaseModifier / 2);
          eye1Offset.y = (eye1Offset.y * creepRadius * .2)
          eye2Offset.x = -(eye2Offset.x * creepRadius * .2) - (creepRadius * phaseModifier / 2);
          eye2Offset.y = (eye2Offset.y * creepRadius * .2)
        } else {
          eye1Offset.x = -(eye1Offset.x * creepRadius * .2) + (creepRadius * phaseModifier / 2);
          eye1Offset.y = (eye1Offset.y * creepRadius * .2)
          eye2Offset.x = -(eye2Offset.x * creepRadius * .2) + (creepRadius * phaseModifier / 2);
          eye2Offset.y = (eye2Offset.y * creepRadius * .2)
        }

        // draw the body
        this.ctx.fillStyle = 'turquoise';
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 2;
        this.ctx.fillRect(creep.position.x - (creepRadius * phaseModifier / 2), creep.position.y - (creepRadius * antiphaseModifier / 2), creepRadius * phaseModifier, creepRadius * antiphaseModifier);

        // add the eyes for cuteness
        this.ctx.lineWidth = 1;
        this.ctx.fillStyle = 'black';
        this.ctx.strokeStyle = 'black';

        this.ctx.beginPath();
        this.ctx.arc(creep.position.x + eye1Offset.x, creep.position.y + eye1Offset.y, creepRadius * .1, 0, 2 * Math.PI, false);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.arc(creep.position.x + eye2Offset.x, creep.position.y + eye2Offset.y, creepRadius * .1, 0, 2 * Math.PI, false);
        this.ctx.fill();
        this.ctx.stroke();
      }

      // give them a health bar
      const healthBarLength = this.squaresize * .8;
      const healthBarHeight = healthBarLength / 8;
      let barX = creep.position.x - (healthBarLength / 2);
      let barY = Math.max(creep.position.y - creepRadius - (healthBarHeight * 2), 0);
      let healthRatio = creep.health / creep.maxHealth;
      let damageBarLength = healthBarLength - Math.round(healthBarLength * healthRatio);
      let damageBarX = barX + healthBarLength - damageBarLength;
      if (creep.type == CreepType.Shield && creep.deaths < 3){
        this.ctx.fillStyle = "#71797E";
      } else {
        this.ctx.fillStyle = "red";
      }
      for (let status of creep.status){
        if (status.effect == DamageType.Poison){
          this.ctx.fillStyle = "green";
        }
      }
      this.ctx.fillRect(barX, barY, healthBarLength, healthBarHeight);
      this.ctx.fillStyle = "gray";
      this.ctx.fillRect(damageBarX, barY, damageBarLength, healthBarHeight);

    }
  }

  drawTower(tower: Tower){
    if (!this.ctx){
      return;
    }
    if (tower.type == TowerType.Basic){
      const towerRadius = this.squaresize * .2;
      let muzzleWidth = towerRadius * .3;
      this.ctx.lineWidth = 1;
      this.ctx.fillStyle = '#71797E';
      this.ctx.strokeStyle = "#88AA88";
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();
      let muzzleLength = towerRadius * 1.5;
      //point at the target
      if (tower.target){
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.target.position, muzzleLength);
      } else {
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.lastTargetPosition, muzzleLength);
      }
      this.ctx.beginPath();
      this.ctx.lineWidth = muzzleWidth;
      this.ctx.moveTo(tower.position.x, tower.position.y);
      this.ctx.strokeStyle = "#71797E";
      this.ctx.lineTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
      this.ctx.stroke();
    } else if (tower.type == TowerType.Laser){
      const towerRadius = this.squaresize * .25;
      let muzzleWidth = towerRadius * .3;
      this.ctx.lineWidth = 1;
      this.ctx.fillStyle = '#00AA00';
      this.ctx.strokeStyle = "#88AA88";
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();
      let muzzleLength = towerRadius * 1.5;
      //point at the target
      if (tower.target){
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.target.position, muzzleLength);
      } else {
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.lastTargetPosition, muzzleLength);
      }
      if (tower.target == null){
        this.ctx.beginPath();
        this.ctx.lineWidth = muzzleWidth;
        this.ctx.moveTo(tower.position.x, tower.position.y);
        this.ctx.strokeStyle = "#00AA00";
        this.ctx.lineTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
        this.ctx.stroke();
      } else {
        this.ctx.lineWidth = muzzleWidth - 4;
        this.ctx.beginPath();
        this.ctx.strokeStyle = "#AAFFAA";
        this.ctx.moveTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
        this.ctx.lineTo(tower.target.position.x, tower.target.position.y);
        this.ctx.stroke();
        this.ctx.lineWidth = muzzleWidth;
        this.ctx.beginPath();
        this.ctx.moveTo(tower.position.x, tower.position.y);
        this.ctx.strokeStyle = "#00AA00";
        this.ctx.lineTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
        this.ctx.stroke();
      }
    } else if (tower.type == TowerType.Bullet){
      const towerRadius = this.squaresize * .25;
      let muzzleWidth = towerRadius * .3;
      this.ctx.lineWidth = 1;
      this.ctx.fillStyle = '#3A3A3A';
      this.ctx.strokeStyle = "#6A6A6A";
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();
      let muzzleLength = towerRadius * 1.5;
      this.ctx.lineWidth = muzzleWidth;
      //point at the target
      if (!tower.target || tower.targetingPhase == TargetingPhase.Firing){
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.lastTargetPosition, muzzleLength);
      } else {
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.target.position, muzzleLength);
      }
      this.ctx.beginPath();
      this.ctx.moveTo(tower.position.x, tower.position.y);
      this.ctx.strokeStyle = "#3A3A3A";
      this.ctx.lineTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
      this.ctx.stroke();
      this.ctx.lineWidth = 1;
      if (tower.targetingPhase == TargetingPhase.Firing){

        const flashLength = muzzleLength;
        let muzzleFlashEnd = this.getPointOnLine(tower.muzzlePoint, tower.lastTargetPosition, flashLength);
        let perpendicularPoint1 = this.getPerpendicularPoint1(tower.muzzlePoint, muzzleFlashEnd);
        let perpendicularPoint2 = this.getPerpendicularPoint2(tower.muzzlePoint, muzzleFlashEnd);
        this.ctx.beginPath();
        this.ctx.moveTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
        this.ctx.strokeStyle = "red";
        this.ctx.fillStyle = 'red';
        this.ctx.bezierCurveTo(perpendicularPoint1.x, perpendicularPoint1.y, muzzleFlashEnd.x, muzzleFlashEnd.y, muzzleFlashEnd.x, muzzleFlashEnd.y);
        this.ctx.moveTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
        this.ctx.bezierCurveTo(perpendicularPoint2.x, perpendicularPoint2.y, muzzleFlashEnd.x, muzzleFlashEnd.y, muzzleFlashEnd.x, muzzleFlashEnd.y);
        this.ctx.fill();
        this.ctx.stroke();

        muzzleFlashEnd = this.getPointOnLine(tower.muzzlePoint, tower.lastTargetPosition, flashLength / 2);
        perpendicularPoint1 = this.getPerpendicularPoint1(tower.muzzlePoint, muzzleFlashEnd);
        perpendicularPoint2 = this.getPerpendicularPoint2(tower.muzzlePoint, muzzleFlashEnd);

        this.ctx.beginPath();
        this.ctx.moveTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
        this.ctx.strokeStyle = "white";
        this.ctx.fillStyle = 'white';
        this.ctx.bezierCurveTo(perpendicularPoint1.x, perpendicularPoint1.y, muzzleFlashEnd.x, muzzleFlashEnd.y, muzzleFlashEnd.x, muzzleFlashEnd.y);
        this.ctx.moveTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
        this.ctx.bezierCurveTo(perpendicularPoint2.x, perpendicularPoint2.y, muzzleFlashEnd.x, muzzleFlashEnd.y, muzzleFlashEnd.x, muzzleFlashEnd.y);
        this.ctx.fill();
        this.ctx.stroke();

      }
    } else if (tower.type == TowerType.Bomb){
      const towerRadius = this.squaresize * .4;
      let muzzleLength = towerRadius * .5;
      let barrelSize = towerRadius * .3;
      //point at the target
      if (tower.target){
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.target.position, muzzleLength);
      } else {
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.lastTargetPosition, muzzleLength);
      }
      const p1 = this.getPerpendicularPoint1(tower.position, tower.muzzlePoint, towerRadius * .2);
      const p2 = this.getPerpendicularPoint2(tower.position, tower.muzzlePoint, towerRadius * .2);
      const p3 = this.getPerpendicularPoint1(tower.muzzlePoint, tower.position, barrelSize);
      const p4 = this.getPerpendicularPoint2(tower.muzzlePoint, tower.position, barrelSize);

      this.ctx.lineWidth = 1;
      this.ctx.fillStyle = '#FF0000';
      this.ctx.strokeStyle = "#FF8888";
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.fillStyle = 'white';
      this.ctx.strokeStyle = "white";
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.lineTo(p3.x, p3.y);
      this.ctx.lineTo(p4.x, p4.y);
      this.ctx.closePath();
      this.ctx.fill()
      this.ctx.fillStyle = 'black';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(tower.muzzlePoint.x, tower.muzzlePoint.y, barrelSize, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.fillStyle = 'white';
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius * .2, 0, 2 * Math.PI, false);
      this.ctx.fill();
    } else if (tower.type == TowerType.Heat){
      const towerRadius = this.squaresize * .3;
      this.ctx.lineWidth = 2;
      this.ctx.fillStyle = 'yellow';
      this.ctx.strokeStyle = "red";
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();

      const flameTop = {x: tower.position.x, y: tower.position.y - towerRadius * .5};
      const flameBottom = {x: tower.position.x, y: tower.position.y + towerRadius * .5};
      let perpendicularPoint1 = this.getPerpendicularPoint1(flameBottom, flameTop, towerRadius * .7);
      let perpendicularPoint2 = this.getPerpendicularPoint2(flameBottom, flameTop, towerRadius * .7);
      this.ctx.beginPath();
      this.ctx.moveTo(flameBottom.x, flameBottom.y);
      this.ctx.strokeStyle = "red";
      this.ctx.fillStyle = 'red';
      this.ctx.bezierCurveTo(perpendicularPoint1.x, perpendicularPoint1.y, flameTop.x, flameTop.y, flameTop.x, flameTop.y);
      this.ctx.moveTo(flameBottom.x, flameBottom.y);
      this.ctx.bezierCurveTo(perpendicularPoint2.x, perpendicularPoint2.y, flameTop.x, flameTop.y, flameTop.x, flameTop.y);
      this.ctx.fill();
      this.ctx.stroke();

      perpendicularPoint1 = this.getPerpendicularPoint1(flameBottom, tower.position, towerRadius * .3);
      perpendicularPoint2 = this.getPerpendicularPoint2(flameBottom, tower.position, towerRadius * .3);

      this.ctx.beginPath();
      this.ctx.moveTo(flameBottom.x, flameBottom.y);
      this.ctx.strokeStyle = "white";
      this.ctx.fillStyle = 'white';
      this.ctx.bezierCurveTo(perpendicularPoint1.x, perpendicularPoint1.y, tower.position.x, tower.position.y, tower.position.x, tower.position.y);
      this.ctx.moveTo(flameBottom.x, flameBottom.y);
      this.ctx.bezierCurveTo(perpendicularPoint2.x, perpendicularPoint2.y, tower.position.x, tower.position.y, tower.position.x, tower.position.y);
      this.ctx.fill();
      this.ctx.stroke();

    } else if (tower.type == TowerType.DamageBooster){
      const towerRadius = this.squaresize * .3;
      this.ctx.lineWidth = 2;
      this.ctx.fillStyle = 'pink';
      this.ctx.strokeStyle = "purple";
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.fillStyle = 'purple';
      this.ctx.strokeStyle = "black";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.font = 'bold ' + (towerRadius * 1.2) + 'px Arial';
      this.ctx.beginPath();
      let { actualBoundingBoxAscent, actualBoundingBoxDescent } = this.ctx.measureText("D");
      this.ctx.fillText("D", tower.position.x, tower.position.y + (actualBoundingBoxAscent - actualBoundingBoxDescent) / 2);
      this.ctx.fill();
      this.ctx.stroke();
    } else if (tower.type == TowerType.Radiation){
      const towerRadius = this.squaresize * .3;
      this.ctx.lineWidth = 2;
      this.ctx.fillStyle = 'yellow';
      this.ctx.strokeStyle = "black";
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.fillStyle = 'black';
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius * .8, 0, 2 * Math.PI, false);
      this.ctx.fill();

      this.ctx.fillStyle = 'yellow';
      this.ctx.beginPath();
      this.ctx.moveTo(tower.position.x, tower.position.y);
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius * .85, 0, Math.PI / 3, false);
      this.ctx.lineTo(tower.position.x, tower.position.y);
      this.ctx.fill();

      this.ctx.beginPath();
      this.ctx.moveTo(tower.position.x, tower.position.y);
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius * .85, Math.PI * 2 / 3, Math.PI, false);
      this.ctx.lineTo(tower.position.x, tower.position.y);
      this.ctx.fill();

      this.ctx.beginPath();
      this.ctx.moveTo(tower.position.x, tower.position.y);
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius * .85, Math.PI * 4 / 3, Math.PI * 5 / 3, false);
      this.ctx.lineTo(tower.position.x, tower.position.y);
      this.ctx.fill();

      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius * .3, 0, 2 * Math.PI, false);
      this.ctx.fill();

      this.ctx.fillStyle = 'black';
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius * .2, 0, 2 * Math.PI, false);
      this.ctx.fill();

      this.ctx.save();
      this.ctx.globalAlpha = 0.1;
      this.ctx.fillStyle = 'green';
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, tower.range * this.squaresize, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.restore();
    } else if (tower.type == TowerType.Nuclear){
      const towerRadius = this.squaresize * .4;
      this.ctx.lineWidth = 2;
      this.ctx.fillStyle = 'red';
      this.ctx.strokeStyle = "black";
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.fillStyle = 'black';
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius * .8, 0, 2 * Math.PI, false);
      this.ctx.fill();

      this.ctx.fillStyle = 'red';
      this.ctx.beginPath();
      this.ctx.moveTo(tower.position.x, tower.position.y);
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius * .85, 0, Math.PI / 3, false);
      this.ctx.lineTo(tower.position.x, tower.position.y);
      this.ctx.fill();

      this.ctx.beginPath();
      this.ctx.moveTo(tower.position.x, tower.position.y);
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius * .85, Math.PI * 2 / 3, Math.PI, false);
      this.ctx.lineTo(tower.position.x, tower.position.y);
      this.ctx.fill();

      this.ctx.beginPath();
      this.ctx.moveTo(tower.position.x, tower.position.y);
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius * .85, Math.PI * 4 / 3, Math.PI * 5 / 3, false);
      this.ctx.lineTo(tower.position.x, tower.position.y);
      this.ctx.fill();

      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius * .3, 0, 2 * Math.PI, false);
      this.ctx.fill();

      this.ctx.fillStyle = 'black';
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius * .2, 0, 2 * Math.PI, false);
      this.ctx.fill();

      this.ctx.save();
      this.ctx.globalAlpha = 0.1;
      this.ctx.fillStyle = 'orange';
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, tower.range * this.squaresize, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.restore();

    } else if (tower.type == TowerType.Lightning){
      const towerRadius = this.squaresize * .25;
      let muzzleWidth = towerRadius * .3;
      this.ctx.lineWidth = 1;
      this.ctx.fillStyle = 'yellow';
      this.ctx.strokeStyle = "#AAAA88";
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();
      let muzzleLength = towerRadius * 1.5;
      //point at the target
      if (tower.target){
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.target.position, muzzleLength);
      } else {
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.lastTargetPosition, muzzleLength);
      }
      this.ctx.beginPath();
      this.ctx.lineWidth = muzzleWidth;
      this.ctx.moveTo(tower.position.x, tower.position.y);
      this.ctx.strokeStyle = "yellow";
      this.ctx.lineTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.lineWidth = muzzleWidth / 2;
      this.ctx.moveTo(tower.position.x, tower.position.y);
      this.ctx.strokeStyle = "black";
      this.ctx.lineTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
      this.ctx.stroke();
      this.ctx.fillStyle = 'black';
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius * .5, 0, 2 * Math.PI, false);
      this.ctx.fill();

      if (tower.targetingPhase == TargetingPhase.Firing){
        this.drawLightningLine(tower.muzzlePoint, tower.lastTargetPosition, towerRadius);
      }
    } else if (tower.type == TowerType.ChainLightning){
      const towerRadius = this.squaresize * .25;
      let muzzleWidth = Math.max(towerRadius * .3, 5);
      this.ctx.lineWidth = 1;
      this.ctx.fillStyle = 'yellow';
      this.ctx.strokeStyle = "#AAAA88";
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();
      let muzzleLength = towerRadius * 1.5;
      //point at the target
      if (tower.target){
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.target.position, muzzleLength);
      } else {
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.lastTargetPosition, muzzleLength);
      }
      this.ctx.beginPath();
      this.ctx.lineWidth = muzzleWidth;
      this.ctx.moveTo(tower.position.x, tower.position.y);
      this.ctx.strokeStyle = "yellow";
      this.ctx.lineTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.lineWidth = muzzleWidth *.6;
      this.ctx.strokeStyle = "black";
      this.ctx.moveTo(tower.position.x, tower.position.y);
      this.ctx.lineTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
      this.ctx.stroke();
      this.ctx.fillStyle = 'black';
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius * .6, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.fillStyle = 'yellow';
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius * .3, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.strokeStyle = "yellow";
      this.ctx.lineWidth = muzzleWidth *.2;
      this.ctx.beginPath();
      this.ctx.moveTo(tower.position.x, tower.position.y);
      this.ctx.lineTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
      this.ctx.stroke();

      if (tower.targetingPhase == TargetingPhase.Firing){
        this.drawLightningLine(tower.muzzlePoint, tower.lastTargetPosition, towerRadius);
        if (tower.extraTargets){
          let lastPosition = tower.lastTargetPosition;
          for (let i = 0; i < tower.extraTargets.length; i++){
            this.drawLightningLine(lastPosition, tower.extraTargets[i].position, towerRadius);
            lastPosition = tower.extraTargets[i].position;
          }
        }
      }
    } else if (tower.type == TowerType.Storm){
      const towerRadius = this.squaresize * .3;
      let muzzleWidth = Math.max(towerRadius * .6, 5);

      this.ctx.lineWidth = 1;
      this.ctx.fillStyle = 'white';
      for (let i = 0; i < 12; i++){
        this.ctx.beginPath();
        this.ctx.moveTo(tower.position.x, tower.position.y);
        let arcstart = (Math.PI * i / 6) + ((tower?.animationPhase || 0) * Math.PI / 60);
        let arcend = arcstart + Math.PI / 36;
        this.ctx.arc(tower.position.x, tower.position.y, towerRadius * 1.4, arcstart, arcend, false);
        this.ctx.lineTo(tower.position.x, tower.position.y);
        this.ctx.fill();
      }

      this.ctx.fillStyle = this.wallColor;
      this.ctx.strokeStyle = this.wallColor;
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius * 1.2, 0, 2 * Math.PI, false);
      this.ctx.fill();

      this.ctx.fillStyle = 'yellow';
      this.ctx.strokeStyle = "#AAAA88";
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();
      let muzzleLength = towerRadius * 1.4;
      //point at the target
      if (tower.target){
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.target.position, muzzleLength);
      } else {
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.lastTargetPosition, muzzleLength);
      }
      this.ctx.beginPath();
      this.ctx.lineWidth = muzzleWidth;
      this.ctx.moveTo(tower.position.x, tower.position.y);
      this.ctx.strokeStyle = "yellow";
      this.ctx.lineTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.lineWidth = muzzleWidth *.6;
      this.ctx.strokeStyle = "black";
      this.ctx.moveTo(tower.position.x, tower.position.y);
      this.ctx.lineTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
      this.ctx.stroke();
      this.ctx.fillStyle = 'black';
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius * .6, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.fillStyle = 'yellow';
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius * .3, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.strokeStyle = "yellow";
      this.ctx.lineWidth = muzzleWidth *.2;
      this.ctx.beginPath();
      this.ctx.moveTo(tower.position.x, tower.position.y);
      this.ctx.lineTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
      this.ctx.stroke();

      if (tower.targetingPhase == TargetingPhase.Firing){
        this.drawLightningLine(tower.muzzlePoint, tower.lastTargetPosition, towerRadius);
        if (tower.extraTargets){
          let lastPosition = tower.lastTargetPosition;
          for (let i = 0; i < tower.extraTargets.length; i++){
            this.drawLightningLine(lastPosition, tower.extraTargets[i].position, towerRadius);
            lastPosition = tower.extraTargets[i].position;
          }
        }
      }
    } else if (tower.type == TowerType.Stun){
      const towerRadius = this.squaresize * .25;
      let muzzleWidth = towerRadius * .3;
      this.ctx.lineWidth = 1;
      this.ctx.fillStyle = 'teal';
      this.ctx.strokeStyle = "white";
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();
      let muzzleLength = towerRadius * 1.5;
      //point at the target
      if (tower.target){
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.target.position, muzzleLength);
      } else {
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.lastTargetPosition, muzzleLength);
      }
      this.ctx.lineWidth = muzzleWidth;
      this.ctx.beginPath();
      this.ctx.moveTo(tower.position.x, tower.position.y);
      this.ctx.strokeStyle = "teal";
      this.ctx.lineTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
      this.ctx.stroke();

      if (tower.target != null && tower.targetingPhase == TargetingPhase.Firing){
        this.ctx.lineWidth = muzzleWidth - 4;
        this.ctx.beginPath();
        this.ctx.strokeStyle = "white";
        this.ctx.moveTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
        this.ctx.lineTo(tower.target.position.x, tower.target.position.y);
        this.ctx.stroke();
      }
    } else if (tower.type == TowerType.Paralysis){
      const towerRadius = this.squaresize * .35;
      let muzzleWidth = towerRadius * .3;
      this.ctx.lineWidth = 1;
      this.ctx.fillStyle = 'teal';
      this.ctx.strokeStyle = "white";
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();
      let muzzleLength = towerRadius * 1.6;
      //point at the target
      if (tower.target){
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.target.position, muzzleLength);
      } else {
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.lastTargetPosition, muzzleLength);
      }
      this.ctx.lineWidth = muzzleWidth;
      this.ctx.strokeStyle = "teal";
      this.ctx.beginPath();
      this.ctx.moveTo(tower.position.x, tower.position.y);
      this.ctx.lineTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.moveTo(tower.position.x, tower.position.y);

      this.ctx.strokeStyle = "white";
      this.ctx.lineWidth = muzzleWidth / 16;
      let radius = 0;
      let angle = -((tower?.animationPhase || 0) * Math.PI / 5);
      for (let i = 0; i < 150; i++) {
        radius += towerRadius / 150;
        angle += (Math.PI * 2) / 50;
        let x = tower.position.x + radius * Math.cos(angle);
        let y = tower.position.y + radius * Math.sin(angle);
        this.ctx.lineTo(x, y);
      }
      this.ctx.stroke();

      const p1 = this.getPointOnLine(tower.muzzlePoint, tower.position, muzzleWidth);
      this.ctx.beginPath();
      this.ctx.arc(p1.x, p1.y, muzzleWidth + 1, 0, 2 * Math.PI, false);
      this.ctx.fill();

      if (tower.target != null && tower.targetingPhase == TargetingPhase.Firing){
        this.ctx.lineWidth = muzzleWidth - 6;
        this.ctx.strokeStyle = "white";
        this.ctx.beginPath();
        this.ctx.moveTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
        this.ctx.lineTo(tower.target.position.x, tower.target.position.y);
        this.ctx.stroke();
        if (tower.extraTargets){
          for (let i = 0; i < tower.extraTargets.length; i++){
            this.ctx.beginPath();
            this.ctx.moveTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
            this.ctx.lineTo(tower.extraTargets[i].position.x, tower.extraTargets[i].position.y);
            this.ctx.stroke();
          }
        }
      }
    } else if (tower.type == TowerType.EnergyRay){
      const towerRadius = this.squaresize * .3;
      let muzzleWidth = towerRadius * .4;
      this.ctx.lineWidth = 1;
      this.ctx.fillStyle = '#FFBF00';
      this.ctx.strokeStyle = "white";
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();

      let muzzleLength = towerRadius * 1.5;
      //point at the target
      if (tower.target){
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.target.position, muzzleLength);
      } else {
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.lastTargetPosition, muzzleLength);
      }
      if (tower.target == null){
        this.ctx.beginPath();
        this.ctx.lineWidth = muzzleWidth;
        this.ctx.moveTo(tower.position.x, tower.position.y);
        this.ctx.strokeStyle = "#FFBF00";
        this.ctx.lineTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
        this.ctx.stroke();
      } else {
        this.ctx.lineWidth = muzzleWidth / 2;
        this.ctx.beginPath();
        this.ctx.strokeStyle = "#AAFFAA";
        this.ctx.moveTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
        this.ctx.lineTo(tower.target.position.x, tower.target.position.y);
        this.ctx.stroke();
        this.ctx.lineWidth = muzzleWidth;
        this.ctx.beginPath();
        this.ctx.moveTo(tower.position.x, tower.position.y);
        this.ctx.strokeStyle = "#FFBF00";
        this.ctx.lineTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
        this.ctx.stroke();
      }

      this.ctx.fillStyle = 'white';
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius * .6, 0, 2 * Math.PI, false);
      this.ctx.fill();

      this.ctx.fillStyle = '#FFBF00';
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius * .3, 0, 2 * Math.PI, false);
      this.ctx.fill();
    } else if (tower.type == TowerType.PlasmaRay){
      const towerRadius = this.squaresize * .4;
      let muzzleWidth = towerRadius * .5;
      this.ctx.lineWidth = 1;
      this.ctx.fillStyle = 'violet';
      this.ctx.strokeStyle = "white";
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();

      let muzzleLength = towerRadius * 1.5;
      //point at the target
      if (tower.target){
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.target.position, muzzleLength);
      } else {
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.lastTargetPosition, muzzleLength);
      }
      if (tower.target == null){
        this.ctx.beginPath();
        this.ctx.lineWidth = muzzleWidth;
        this.ctx.moveTo(tower.position.x, tower.position.y);
        this.ctx.strokeStyle = "violet";
        this.ctx.lineTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
        this.ctx.stroke();
      } else {
        this.ctx.lineWidth = muzzleWidth / 2;
        this.ctx.beginPath();
        this.ctx.strokeStyle = "purple";
        this.ctx.moveTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
        this.ctx.lineTo(tower.target.position.x, tower.target.position.y);
        this.ctx.stroke();
        this.ctx.lineWidth = muzzleWidth;
        this.ctx.beginPath();
        this.ctx.moveTo(tower.position.x, tower.position.y);
        this.ctx.strokeStyle = "violet";
        this.ctx.lineTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
        this.ctx.stroke();
        this.ctx.fillStyle = 'purple';
        this.ctx.strokeStyle = "purple";
        this.ctx.beginPath();
        this.ctx.arc(tower.target.position.x, tower.target.position.y, towerRadius * .2, 0, 2 * Math.PI, false);
        this.ctx.fill();
        this.ctx.lineWidth = muzzleWidth / 8;
        this.ctx.beginPath();
        this.ctx.ellipse(tower.target.position.x, tower.target.position.y, towerRadius * .4, towerRadius * .1, (tower?.animationPhase || 0) * Math.PI / 10, 0, 2 * Math.PI, false);
        this.ctx.ellipse(tower.target.position.x, tower.target.position.y, towerRadius * .1, towerRadius * .4, (tower?.animationPhase || 0) * Math.PI / 10, 0, 2 * Math.PI, false);
        this.ctx.fill();

      }

      this.ctx.fillStyle = 'white';
      for (let i = 0; i < 12; i++){
        this.ctx.beginPath();
        this.ctx.moveTo(tower.position.x, tower.position.y);
        let arcstart = (Math.PI * i / 6) - ((tower?.animationPhase || 0) * Math.PI / 60);
        let arcend = arcstart + Math.PI / 12;
        this.ctx.arc(tower.position.x, tower.position.y, towerRadius * .6, arcstart, arcend, false);
        this.ctx.lineTo(tower.position.x, tower.position.y);
        this.ctx.fill();
      }

      this.ctx.fillStyle = 'violet';
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius * .3, 0, 2 * Math.PI, false);
      this.ctx.fill();
    } else if (tower.type == TowerType.Sniper){
      const towerRadius = this.squaresize * .2;
      let muzzleWidth = towerRadius * .2;
      this.ctx.lineWidth = 1;
      this.ctx.fillStyle = '#2A2A2A';
      this.ctx.strokeStyle = "#6A6A6A";
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();
      let muzzleLength = towerRadius * 2.2;
      this.ctx.lineWidth = muzzleWidth;
      //point at the target
      if (!tower.target || tower.targetingPhase == TargetingPhase.Firing){
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.lastTargetPosition, muzzleLength);
      } else {
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.target.position, muzzleLength);
      }
      this.ctx.beginPath();
      this.ctx.moveTo(tower.position.x, tower.position.y);
      this.ctx.strokeStyle = "#2A2A2A";
      this.ctx.lineTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
      this.ctx.stroke();
      this.ctx.lineWidth = 1;
      if (tower.targetingPhase == TargetingPhase.Firing){

        const flashLength = muzzleLength / 2;
        let muzzleFlashEnd = this.getPointOnLine(tower.muzzlePoint, tower.lastTargetPosition, flashLength);
        let perpendicularPoint1 = this.getPerpendicularPoint1(tower.muzzlePoint, muzzleFlashEnd);
        let perpendicularPoint2 = this.getPerpendicularPoint2(tower.muzzlePoint, muzzleFlashEnd);
        this.ctx.beginPath();
        this.ctx.moveTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
        this.ctx.strokeStyle = "red";
        this.ctx.fillStyle = 'red';
        this.ctx.bezierCurveTo(perpendicularPoint1.x, perpendicularPoint1.y, muzzleFlashEnd.x, muzzleFlashEnd.y, muzzleFlashEnd.x, muzzleFlashEnd.y);
        this.ctx.moveTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
        this.ctx.bezierCurveTo(perpendicularPoint2.x, perpendicularPoint2.y, muzzleFlashEnd.x, muzzleFlashEnd.y, muzzleFlashEnd.x, muzzleFlashEnd.y);
        this.ctx.fill();
        this.ctx.stroke();

        muzzleFlashEnd = this.getPointOnLine(tower.muzzlePoint, tower.lastTargetPosition, flashLength / 2);
        perpendicularPoint1 = this.getPerpendicularPoint1(tower.muzzlePoint, muzzleFlashEnd);
        perpendicularPoint2 = this.getPerpendicularPoint2(tower.muzzlePoint, muzzleFlashEnd);

        this.ctx.beginPath();
        this.ctx.moveTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
        this.ctx.strokeStyle = "white";
        this.ctx.fillStyle = 'white';
        this.ctx.bezierCurveTo(perpendicularPoint1.x, perpendicularPoint1.y, muzzleFlashEnd.x, muzzleFlashEnd.y, muzzleFlashEnd.x, muzzleFlashEnd.y);
        this.ctx.moveTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
        this.ctx.bezierCurveTo(perpendicularPoint2.x, perpendicularPoint2.y, muzzleFlashEnd.x, muzzleFlashEnd.y, muzzleFlashEnd.x, muzzleFlashEnd.y);
        this.ctx.fill();
        this.ctx.stroke();

      }
    } else if (tower.type == TowerType.Railgun){
      const towerRadius = this.squaresize * .15;
      let muzzleWidth = towerRadius * .4;
      this.ctx.lineWidth = 1;
      this.ctx.fillStyle = '#0A0A0A';
      this.ctx.strokeStyle = "#6A6A6A";
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();
      let muzzleLength = towerRadius * 3;
      //point at the target
      if (!tower.target || tower.targetingPhase == TargetingPhase.Firing){
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.lastTargetPosition, muzzleLength);
      } else {
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.target.position, muzzleLength);
      }


      this.ctx.lineWidth = muzzleWidth;

      this.ctx.strokeStyle = "#0A0A0A";
      let p1 = this.getPerpendicularPoint1(tower.muzzlePoint, tower.position, muzzleLength / 8);
      let p2 = this.getPerpendicularPoint2(tower.muzzlePoint, tower.position, muzzleLength / 8);
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();


      this.ctx.strokeStyle = "#6A6A6A";
      p1 = this.getPointOnLine(tower.muzzlePoint, tower.position, muzzleLength / 4);
      p2 = this.getPerpendicularPoint2(p1, tower.position, muzzleLength / 10);
      p1 = this.getPerpendicularPoint1(p1, tower.position, muzzleLength / 10);
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();

      p1 = this.getPointOnLine(tower.muzzlePoint, tower.position, muzzleLength / 2);
      p2 = this.getPerpendicularPoint2(p1, tower.position, muzzleLength / 10);
      p1 = this.getPerpendicularPoint1(p1, tower.position, muzzleLength / 10);
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();

      this.ctx.strokeStyle = "#0A0A0A";
      this.ctx.beginPath();
      this.ctx.moveTo(tower.position.x, tower.position.y);
      this.ctx.lineTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
      this.ctx.stroke();


      if (tower.targetingPhase == TargetingPhase.Firing){

        this.ctx.lineWidth = 1;
        const flashLength = muzzleLength / 2;
        let muzzleFlashEnd = this.getPointOnLine(tower.muzzlePoint, tower.lastTargetPosition, flashLength);
        let perpendicularPoint1 = this.getPerpendicularPoint1(tower.muzzlePoint, muzzleFlashEnd, flashLength / 2);
        let perpendicularPoint2 = this.getPerpendicularPoint2(tower.muzzlePoint, muzzleFlashEnd, flashLength / 2);
        this.ctx.strokeStyle = "red";
        this.ctx.fillStyle = 'red';
        this.ctx.beginPath();
        this.ctx.moveTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
        this.ctx.bezierCurveTo(perpendicularPoint1.x, perpendicularPoint1.y, muzzleFlashEnd.x, muzzleFlashEnd.y, muzzleFlashEnd.x, muzzleFlashEnd.y);
        this.ctx.moveTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
        this.ctx.bezierCurveTo(perpendicularPoint2.x, perpendicularPoint2.y, muzzleFlashEnd.x, muzzleFlashEnd.y, muzzleFlashEnd.x, muzzleFlashEnd.y);
        this.ctx.fill();
        this.ctx.stroke();

        muzzleFlashEnd = this.getPointOnLine(tower.muzzlePoint, tower.lastTargetPosition, flashLength / 2);
        perpendicularPoint1 = this.getPerpendicularPoint1(tower.muzzlePoint, muzzleFlashEnd);
        perpendicularPoint2 = this.getPerpendicularPoint2(tower.muzzlePoint, muzzleFlashEnd);

        this.ctx.strokeStyle = "white";
        this.ctx.fillStyle = 'white';
        this.ctx.beginPath();
        this.ctx.moveTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
        this.ctx.bezierCurveTo(perpendicularPoint1.x, perpendicularPoint1.y, muzzleFlashEnd.x, muzzleFlashEnd.y, muzzleFlashEnd.x, muzzleFlashEnd.y);
        this.ctx.moveTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
        this.ctx.bezierCurveTo(perpendicularPoint2.x, perpendicularPoint2.y, muzzleFlashEnd.x, muzzleFlashEnd.y, muzzleFlashEnd.x, muzzleFlashEnd.y);
        this.ctx.fill();
        this.ctx.stroke();
      }
    } else if (tower.type == TowerType.Gatling){
      const towerRadius = this.squaresize * .3;
      let muzzleWidth = towerRadius * .2;
      this.ctx.lineWidth = 1;
      this.ctx.fillStyle = '#3A3A3A';
      this.ctx.strokeStyle = "#6A6A6A";
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();
      let muzzleLength = towerRadius * 1.6;
      this.ctx.lineWidth = muzzleWidth;
      //point at the target
      if (!tower.target || tower.targetingPhase == TargetingPhase.Firing){
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.lastTargetPosition, muzzleLength);
      } else {
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.target.position, muzzleLength);
      }
      this.ctx.strokeStyle = "#3A3A3A";
      this.ctx.beginPath();
      this.ctx.moveTo(tower.position.x, tower.position.y);
      this.ctx.lineTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
      this.ctx.stroke();
      let p1 = this.getPerpendicularPoint1(tower.position, tower.muzzlePoint, towerRadius * .25);
      let p2 = this.getPerpendicularPoint2(tower.muzzlePoint, tower.position, towerRadius * .25);
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();
      p1 = this.getPerpendicularPoint2(tower.position, tower.muzzlePoint, towerRadius * .25);
      p2 = this.getPerpendicularPoint1(tower.muzzlePoint, tower.position, towerRadius * .25);
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();

      this.ctx.lineWidth = towerRadius * .75;
      this.ctx.strokeStyle = "#6A6A6A";
      p1 = this.getPointOnLine(tower.position, tower.muzzlePoint, muzzleLength * .8);
      p2 = this.getPointOnLine(tower.position, tower.muzzlePoint, muzzleLength * .75);
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();

      p1 = this.getPointOnLine(tower.position, tower.muzzlePoint, muzzleLength * .9);
      p2 = this.getPointOnLine(tower.position, tower.muzzlePoint, muzzleLength * .85);
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();

      this.ctx.lineWidth = 1;
      if (tower.targetingPhase == TargetingPhase.Firing){

        const flashLength = muzzleLength;
        let muzzleFlashEnd = this.getPointOnLine(tower.muzzlePoint, tower.lastTargetPosition, flashLength);
        let perpendicularPoint1 = this.getPerpendicularPoint1(tower.muzzlePoint, muzzleFlashEnd);
        let perpendicularPoint2 = this.getPerpendicularPoint2(tower.muzzlePoint, muzzleFlashEnd);
        this.ctx.beginPath();
        this.ctx.moveTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
        this.ctx.strokeStyle = "red";
        this.ctx.fillStyle = 'red';
        this.ctx.bezierCurveTo(perpendicularPoint1.x, perpendicularPoint1.y, muzzleFlashEnd.x, muzzleFlashEnd.y, muzzleFlashEnd.x, muzzleFlashEnd.y);
        this.ctx.moveTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
        this.ctx.bezierCurveTo(perpendicularPoint2.x, perpendicularPoint2.y, muzzleFlashEnd.x, muzzleFlashEnd.y, muzzleFlashEnd.x, muzzleFlashEnd.y);
        this.ctx.fill();
        this.ctx.stroke();

        muzzleFlashEnd = this.getPointOnLine(tower.muzzlePoint, tower.lastTargetPosition, flashLength / 2);
        perpendicularPoint1 = this.getPerpendicularPoint1(tower.muzzlePoint, muzzleFlashEnd);
        perpendicularPoint2 = this.getPerpendicularPoint2(tower.muzzlePoint, muzzleFlashEnd);

        this.ctx.beginPath();
        this.ctx.moveTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
        this.ctx.strokeStyle = "white";
        this.ctx.fillStyle = 'white';
        this.ctx.bezierCurveTo(perpendicularPoint1.x, perpendicularPoint1.y, muzzleFlashEnd.x, muzzleFlashEnd.y, muzzleFlashEnd.x, muzzleFlashEnd.y);
        this.ctx.moveTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
        this.ctx.bezierCurveTo(perpendicularPoint2.x, perpendicularPoint2.y, muzzleFlashEnd.x, muzzleFlashEnd.y, muzzleFlashEnd.x, muzzleFlashEnd.y);
        this.ctx.fill();
        this.ctx.stroke();

      }
    } else if (tower.type == TowerType.MachineGun){
      const towerRadius = this.squaresize * .35;
      let muzzleWidth = towerRadius * .15;
      this.ctx.lineWidth = 1;
      this.ctx.fillStyle = '#3A3A3A';
      this.ctx.strokeStyle = "#6A6A6A";
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();
      let muzzleLength = towerRadius * 1.6;
      this.ctx.lineWidth = muzzleWidth;
      //point at the target
      if (!tower.target || tower.targetingPhase == TargetingPhase.Firing){
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.lastTargetPosition, muzzleLength);
      } else {
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.target.position, muzzleLength);
      }
      this.ctx.strokeStyle = "#3A3A3A";
      this.ctx.beginPath();
      this.ctx.moveTo(tower.position.x, tower.position.y);
      this.ctx.lineTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
      this.ctx.stroke();
      let p1 = this.getPerpendicularPoint1(tower.position, tower.muzzlePoint, muzzleWidth + 1);
      let p2 = this.getPerpendicularPoint2(tower.muzzlePoint, tower.position, muzzleWidth + 1);
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();
      p1 = this.getPerpendicularPoint1(tower.position, tower.muzzlePoint, 2 * muzzleWidth + 2);
      p2 = this.getPerpendicularPoint2(tower.muzzlePoint, tower.position, 2 * muzzleWidth + 2);
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();
      p1 = this.getPerpendicularPoint2(tower.position, tower.muzzlePoint, muzzleWidth + 1);
      p2 = this.getPerpendicularPoint1(tower.muzzlePoint, tower.position, muzzleWidth + 1);
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();
      p1 = this.getPerpendicularPoint2(tower.position, tower.muzzlePoint, 2 * muzzleWidth + 2);
      p2 = this.getPerpendicularPoint1(tower.muzzlePoint, tower.position, 2 * muzzleWidth + 2);
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();

      this.ctx.lineWidth = towerRadius * .9;
      this.ctx.strokeStyle = "#6A6A6A";
      p1 = this.getPointOnLine(tower.position, tower.muzzlePoint, muzzleLength * .8);
      p2 = this.getPointOnLine(tower.position, tower.muzzlePoint, muzzleLength * .75);
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();

      p1 = this.getPointOnLine(tower.position, tower.muzzlePoint, muzzleLength * .9);
      p2 = this.getPointOnLine(tower.position, tower.muzzlePoint, muzzleLength * .85);
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();

      this.ctx.lineWidth = 1;
      if (tower.targetingPhase == TargetingPhase.Firing){

        const flashLength = muzzleLength * 1.2;
        let muzzleFlashEnd = this.getPointOnLine(tower.muzzlePoint, tower.lastTargetPosition, flashLength);
        let perpendicularPoint1 = this.getPerpendicularPoint1(tower.muzzlePoint, muzzleFlashEnd);
        let perpendicularPoint2 = this.getPerpendicularPoint2(tower.muzzlePoint, muzzleFlashEnd);
        this.ctx.beginPath();
        this.ctx.moveTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
        this.ctx.strokeStyle = "red";
        this.ctx.fillStyle = 'red';
        this.ctx.bezierCurveTo(perpendicularPoint1.x, perpendicularPoint1.y, muzzleFlashEnd.x, muzzleFlashEnd.y, muzzleFlashEnd.x, muzzleFlashEnd.y);
        this.ctx.moveTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
        this.ctx.bezierCurveTo(perpendicularPoint2.x, perpendicularPoint2.y, muzzleFlashEnd.x, muzzleFlashEnd.y, muzzleFlashEnd.x, muzzleFlashEnd.y);
        this.ctx.fill();
        this.ctx.stroke();

        muzzleFlashEnd = this.getPointOnLine(tower.muzzlePoint, tower.lastTargetPosition, flashLength / 2);
        perpendicularPoint1 = this.getPerpendicularPoint1(tower.muzzlePoint, muzzleFlashEnd);
        perpendicularPoint2 = this.getPerpendicularPoint2(tower.muzzlePoint, muzzleFlashEnd);

        this.ctx.beginPath();
        this.ctx.moveTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
        this.ctx.strokeStyle = "white";
        this.ctx.fillStyle = 'white';
        this.ctx.bezierCurveTo(perpendicularPoint1.x, perpendicularPoint1.y, muzzleFlashEnd.x, muzzleFlashEnd.y, muzzleFlashEnd.x, muzzleFlashEnd.y);
        this.ctx.moveTo(tower.muzzlePoint.x, tower.muzzlePoint.y);
        this.ctx.bezierCurveTo(perpendicularPoint2.x, perpendicularPoint2.y, muzzleFlashEnd.x, muzzleFlashEnd.y, muzzleFlashEnd.x, muzzleFlashEnd.y);
        this.ctx.fill();
        this.ctx.stroke();

      }
    } else if (tower.type == TowerType.Blunderbuss){
      const towerRadius = this.squaresize * .2;
      this.ctx.lineWidth = 1;
      this.ctx.fillStyle = '#CC6600';
      this.ctx.strokeStyle = "#FFD9B3";
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();
      let muzzleLength = towerRadius * 2;
      //point at the target
      tower.muzzlePoint = this.getPointOnLine(tower.position, tower.lastTargetPosition, muzzleLength);
      this.ctx.fillStyle = '#CC6600';
      this.ctx.strokeStyle = "#CC6600";

      let p1 = this.getPerpendicularPoint1(tower.muzzlePoint, tower.position, muzzleLength * .4);
      let p2 = this.getPerpendicularPoint2(tower.muzzlePoint, tower.position, muzzleLength * .4);
      this.ctx.beginPath();
      this.ctx.moveTo(tower.position.x, tower.position.y);
      this.ctx.lineTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.closePath()
      this.ctx.fill();
      this.ctx.lineWidth = 1;
    } else if (tower.type == TowerType.Chainshot){
      const towerRadius = this.squaresize * .25;
      let muzzleLength = towerRadius * 1.6;
      //point at the target
      tower.muzzlePoint = this.getPointOnLine(tower.position, tower.lastTargetPosition, muzzleLength);

      this.ctx.lineWidth = 1;
      this.ctx.fillStyle = '#CC6600';
      this.ctx.strokeStyle = "#FFD9B3";
      let p1 = this.getPerpendicularPoint1(tower.muzzlePoint, tower.position, muzzleLength * .4);
      let p2 = this.getPerpendicularPoint2(tower.muzzlePoint, tower.position, muzzleLength * .4);
      let p3 = this.getPerpendicularPoint1(tower.position, tower.muzzlePoint, towerRadius);
      let p4 = this.getPerpendicularPoint2(tower.position, tower.muzzlePoint, towerRadius);
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.lineTo(p3.x, p3.y);
      this.ctx.lineTo(p4.x, p4.y);
      this.ctx.closePath()
      this.ctx.fill();

      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();

      this.ctx.lineWidth = towerRadius * .2;
      p1 = this.getPerpendicularPoint1(p3, p4, towerRadius * .75);
      p2 = this.getPerpendicularPoint2(p3, p4, towerRadius * .75);
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();
      p1 = this.getPerpendicularPoint1(p4, p3, towerRadius * .75);
      p2 = this.getPerpendicularPoint2(p4, p3, towerRadius * .75);
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();
    } else if (tower.type == TowerType.Goo){
      const towerRadius = this.squaresize * .1;
      tower.muzzlePoint = tower.position;
      this.ctx.lineWidth = 1;
      this.ctx.fillStyle = 'green';
      let offset = towerRadius;
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x + offset, tower.position.y + offset, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x - offset, tower.position.y + offset, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x + offset, tower.position.y - offset, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x - offset, tower.position.y - offset, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      offset = towerRadius * 1.4;
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x + offset, tower.position.y, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x - offset, tower.position.y, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y + offset, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y - offset, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
    } else if (tower.type == TowerType.Acid){
      const towerRadius = this.squaresize * .1;
      tower.muzzlePoint = tower.position;
      this.ctx.lineWidth = 1;
      this.ctx.fillStyle = 'yellow';
      let offset = towerRadius;
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x + offset, tower.position.y + offset, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x - offset, tower.position.y + offset, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x + offset, tower.position.y - offset, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x - offset, tower.position.y - offset, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      offset = towerRadius * 1.4;
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x + offset, tower.position.y, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x - offset, tower.position.y, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y + offset, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y - offset, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
    } else if (tower.type == TowerType.Poison){
      const towerRadius = this.squaresize * .5;
      tower.muzzlePoint = {x: tower.position.x, y: tower.position.y - towerRadius * .75};
      this.ctx.lineWidth = 1;
      this.ctx.fillStyle = 'green';
      this.ctx.beginPath();
      // @ts-ignore
      this.ctx.roundRect(tower.position.x - towerRadius * .5, tower.position.y - towerRadius * .3, towerRadius,  towerRadius, towerRadius * .2);
      this.ctx.fill();
      this.ctx.beginPath();
      // @ts-ignore
      this.ctx.roundRect(tower.position.x - towerRadius * .2, tower.position.y - towerRadius * .7, towerRadius * .4,  towerRadius, towerRadius * .2);
      this.ctx.fill();
      this.ctx.beginPath();
      // @ts-ignore
      this.ctx.roundRect(tower.position.x - towerRadius * .3, tower.position.y - towerRadius * .75, towerRadius * .6,  towerRadius * .2, towerRadius * .2);
      this.ctx.fill();
      this.ctx.fillStyle = 'yellow';
      this.ctx.beginPath();
      // @ts-ignore
      this.ctx.roundRect(tower.position.x - towerRadius * .4, tower.position.y - towerRadius * .2, towerRadius * .8,  towerRadius * .8, towerRadius * .2);
      this.ctx.fill();
      this.ctx.strokeStyle = 'black';
      this.ctx.fillStyle = 'black';
      this.ctx.lineWidth = towerRadius * .1;
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y + towerRadius * .05, towerRadius * .2, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.moveTo(tower.position.x - towerRadius * .3, tower.position.y + towerRadius * .25);
      this.ctx.lineTo(tower.position.x + towerRadius * .3, tower.position.y + towerRadius * .45);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(tower.position.x + towerRadius * .3, tower.position.y + towerRadius * .25);
      this.ctx.lineTo(tower.position.x - towerRadius * .3, tower.position.y + towerRadius * .45);
      this.ctx.stroke();
      this.ctx.fillStyle = 'yellow';
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x - towerRadius * .08, tower.position.y + towerRadius * .05, towerRadius * .05, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x + towerRadius * .08, tower.position.y + towerRadius * .05, towerRadius * .05, 0, 2 * Math.PI, false);
      this.ctx.fill();
    } else if (tower.type == TowerType.TriShot){
      const towerRadius = this.squaresize * .4;
      let muzzleLength = towerRadius * .5;
      let barrelSize = towerRadius * .25;
      //point at the target
      if (tower.target){
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.target.position, muzzleLength);
      } else {
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.lastTargetPosition, muzzleLength);
      }
      const outerBarrel1 = this.getPerpendicularPoint1(tower.muzzlePoint, tower.position);
      const outerBarrel2 = this.getPerpendicularPoint2(tower.muzzlePoint, tower.position);
      const p1 = this.getPerpendicularPoint1(tower.position, tower.muzzlePoint, barrelSize);
      const p2 = this.getPerpendicularPoint2(tower.position, tower.muzzlePoint, barrelSize);
      const p3 = this.getPointOnLine(tower.muzzlePoint, outerBarrel1, barrelSize * 3, true);
      const p4 = this.getPointOnLine(tower.muzzlePoint, outerBarrel2, barrelSize * 3, true);

      this.ctx.lineWidth = 1;
      this.ctx.fillStyle = '#FF0000';
      this.ctx.strokeStyle = "#FF8888";
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.fillStyle = 'white';
      this.ctx.strokeStyle = "white";
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.lineTo(p3.x, p3.y);
      this.ctx.lineTo(p4.x, p4.y);
      this.ctx.closePath();
      this.ctx.fill()
      this.ctx.fillStyle = 'black';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(tower.muzzlePoint.x, tower.muzzlePoint.y, barrelSize, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.arc(outerBarrel1.x, outerBarrel1.y, barrelSize, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.arc(outerBarrel2.x, outerBarrel2.y, barrelSize, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.fillStyle = 'white';
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, barrelSize, 0, 2 * Math.PI, false);
      this.ctx.fill();
    } else if (tower.type == TowerType.Cluster){
      const towerRadius = this.squaresize * .4;
      let muzzleLength = towerRadius * .4;
      let barrelSize = towerRadius * .2;
      //point at the target
      if (tower.target){
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.target.position, muzzleLength);
      } else {
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.lastTargetPosition, muzzleLength);
      }
      const nearPoint = this.getPointOnLine(tower.position, tower.muzzlePoint, muzzleLength * .15);
      const farPoint = this.getPointOnLine(tower.position, tower.muzzlePoint, muzzleLength * 1.85, true);
      const outerBarrel1 = this.getPerpendicularPoint1(tower.muzzlePoint, tower.position);
      const outerBarrel2 = this.getPerpendicularPoint2(tower.muzzlePoint, tower.position);
      const nearBarrel1 = this.getPerpendicularPoint1(nearPoint, tower.position, barrelSize);
      const nearBarrel2 = this.getPerpendicularPoint2(nearPoint, tower.position, barrelSize);
      const farBarrel1 = this.getPerpendicularPoint1(farPoint, tower.position, barrelSize);
      const farBarrel2 = this.getPerpendicularPoint2(farPoint, tower.position, barrelSize);

      this.ctx.lineWidth = 1;
      this.ctx.fillStyle = '#FF0000';
      this.ctx.strokeStyle = "#FF8888";
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerRadius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.fillStyle = 'white';
      this.ctx.beginPath();
      this.ctx.arc(tower.muzzlePoint.x, tower.muzzlePoint.y, barrelSize * 3, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.strokeStyle = "white";
      this.ctx.fillStyle = 'black';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(tower.muzzlePoint.x, tower.muzzlePoint.y, barrelSize, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.arc(outerBarrel1.x, outerBarrel1.y, barrelSize, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.arc(outerBarrel2.x, outerBarrel2.y, barrelSize, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.arc(nearBarrel1.x, nearBarrel1.y, barrelSize, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.arc(nearBarrel2.x, nearBarrel2.y, barrelSize, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.arc(farBarrel1.x, farBarrel1.y, barrelSize, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.arc(farBarrel2.x, farBarrel2.y, barrelSize, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();
    } else if (tower.type == TowerType.Rocket){
      const towerSize = this.squaresize * .8;
      let missileBottom;
      if (tower.target){
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.target.position, towerSize * .4);
        missileBottom = this.getPointOnLine(tower.position, tower.target.position, -towerSize * .4);
      } else {
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.lastTargetPosition, towerSize * .4);
        missileBottom = this.getPointOnLine(tower.position, tower.lastTargetPosition, -towerSize * .4);
      }

      this.ctx.lineWidth = 1;
      this.ctx.fillStyle = '#AAAAAA';
      this.ctx.beginPath();
      // @ts-ignore
      this.ctx.roundRect(tower.position.x - towerSize * .5, tower.position.y - towerSize * .5, towerSize,  towerSize, towerSize * .2);
      this.ctx.fill();
      this.drawMissile(tower.muzzlePoint, missileBottom, "red");
    } else if (tower.type == TowerType.Missile){
      const towerSize = this.squaresize * .8;
      let missileBottom;
      if (tower.target){
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.target.position, towerSize * .4);
        missileBottom = this.getPointOnLine(tower.position, tower.target.position, -towerSize * .4);
      } else {
        tower.muzzlePoint = this.getPointOnLine(tower.position, tower.lastTargetPosition, towerSize * .4);
        missileBottom = this.getPointOnLine(tower.position, tower.lastTargetPosition, -towerSize * .4);
      }
      this.ctx.lineWidth = this.squaresize * .1;
      this.ctx.fillStyle = '#AAAAAA';
      this.ctx.strokeStyle = 'black';
      this.ctx.beginPath();
      // @ts-ignore
      this.ctx.roundRect(tower.position.x - towerSize * .5, tower.position.y - towerSize * .5, towerSize,  towerSize, towerSize * .2);
      this.ctx.stroke();
      this.ctx.fill();
      this.ctx.fillStyle = 'yellow';
      this.ctx.strokeStyle = 'white';
      this.ctx.beginPath();
      this.ctx.arc(tower.position.x, tower.position.y, towerSize * .4, 0, 2 * Math.PI, false);
      this.ctx.stroke();
      this.ctx.fill();
      this.drawMissile(tower.muzzlePoint, missileBottom, "red");
    }

  }

  drawMissile(missileTop: Point, missileBottom: Point, color: string){
    if (!this.ctx){
      return;
    }
    const missileHeight = this.getDistance(missileTop, missileBottom);
    const missileConeBottom = this.getPointOnLine(missileTop, missileBottom, missileHeight * .2);
    const missileFinTop = this.getPointOnLine(missileTop, missileBottom, missileHeight * .6);
    const missileFinBottom = this.getPointOnLine(missileTop, missileBottom, missileHeight * .9);
    const halfMissileWidth = missileHeight * .125;
    const halfMissileFinWidth = missileHeight * .3;

    const p1 = this.getPerpendicularPoint1(missileConeBottom, missileBottom, halfMissileWidth);
    const p10 = this.getPerpendicularPoint2(missileConeBottom, missileBottom, halfMissileWidth);
    const p2 = this.getPerpendicularPoint1(missileFinTop, missileBottom, halfMissileWidth);
    const p9 = this.getPerpendicularPoint2(missileFinTop, missileBottom, halfMissileWidth);
    const p3 = this.getPerpendicularPoint2(missileBottom, missileTop, halfMissileFinWidth);
    const p8 = this.getPerpendicularPoint1(missileBottom, missileTop, halfMissileFinWidth);
    const p4 = this.getPerpendicularPoint2(missileFinBottom, missileTop, halfMissileWidth);
    const p7 = this.getPerpendicularPoint1(missileFinBottom, missileTop, halfMissileWidth);
    const p5 = this.getPerpendicularPoint2(missileBottom, missileTop, halfMissileWidth);
    const p6 = this.getPerpendicularPoint1(missileBottom, missileTop, halfMissileWidth);


    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(missileTop.x, missileTop.y);
    this.ctx.lineTo(p1.x, p1.y);
    this.ctx.lineTo(p2.x, p2.y);
    this.ctx.lineTo(p3.x, p3.y);
    this.ctx.lineTo(p4.x, p4.y);
    this.ctx.lineTo(p5.x, p5.y);
    this.ctx.lineTo(p6.x, p6.y);
    this.ctx.lineTo(p7.x, p7.y);
    this.ctx.lineTo(p8.x, p8.y);
    this.ctx.lineTo(p9.x, p9.y);
    this.ctx.lineTo(p10.x, p10.y);
    this.ctx.closePath();
    //this.ctx.stroke();
    this.ctx.fill();

  }

  drawLightningLine(start: Point, end: Point, width: number){
    if (!this.ctx){
      return;
    }
    let distance = this.getDistance(start, end);
    let p1 = this.getPointOnLine(start, end, distance * .2);
    p1 = this.getPerpendicularPoint1(p1, end, Math.random() * width);
    let p2 = this.getPointOnLine(start, end, distance * .4);
    p2 = this.getPerpendicularPoint2(p2, end, Math.random() * width);
    let p3 = this.getPointOnLine(start, end, distance * .6);
    p3 = this.getPerpendicularPoint1(p3, end, Math.random() * width);
    let p4 = this.getPointOnLine(start, end, distance * .8);
    p4 = this.getPerpendicularPoint2(p4, end, Math.random() * width);

    this.ctx.lineWidth = 3;
    this.ctx.strokeStyle = "yellow";
    this.ctx.beginPath();
    this.ctx.moveTo(start.x, start.y);
    this.ctx.lineTo(p1.x, p1.y);
    this.ctx.lineTo(p2.x, p2.y);
    this.ctx.lineTo(p3.x, p3.y);
    this.ctx.lineTo(p4.x, p4.y);
    this.ctx.lineTo(end.x, end.y);
    this.ctx.stroke();

  }

  drawDeathExplosion(explosion: DeathExplosion){
    if (this.ctx){
      let explosionRadius = this.squaresize * .03 * explosion.countdown;
      this.ctx.strokeStyle = "white";
      this.ctx.beginPath();
      this.ctx.moveTo(explosion.position.x - explosionRadius, explosion.position.y);
      this.ctx.lineTo(explosion.position.x + explosionRadius, explosion.position.y);
      this.ctx.moveTo(explosion.position.x, explosion.position.y - explosionRadius);
      this.ctx.lineTo(explosion.position.x, explosion.position.y + explosionRadius);
      this.ctx.moveTo(explosion.position.x - explosionRadius, explosion.position.y - explosionRadius);
      this.ctx.lineTo(explosion.position.x + explosionRadius, explosion.position.y + explosionRadius);
      this.ctx.moveTo(explosion.position.x - explosionRadius, explosion.position.y + explosionRadius);
      this.ctx.lineTo(explosion.position.x + explosionRadius, explosion.position.y - explosionRadius);

      this.ctx.lineWidth = 1;
      this.ctx.stroke();
    }
  }

  drawBombExplosion(explosion: BombExplosion){

    let size;
    if (explosion.countdown > 50){
      let value = 100 - explosion.countdown;
      size = explosion.size * value * .02;
    } else {
      size = explosion.size * explosion.countdown * .02;
    }

    if (this.ctx){
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.globalAlpha = 0.2;
      this.ctx.fillStyle = explosion.color;
      this.ctx.strokeStyle = explosion.color;
      this.ctx.arc(explosion.position.x, explosion.position.y, size, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.restore();

    }
  }

  drawGooBlob(blob: GooBlob){
    if (this.ctx){
      let radius = this.squaresize * .25;
      let halfRadius = radius * .5;
      this.ctx.lineWidth = 1;
      this.ctx.fillStyle = "green";
      if (blob.damageType == DamageType.Acid){
        this.ctx.fillStyle = "yellow";
      }
      this.ctx.beginPath();
      this.ctx.arc(blob.position.x - radius, blob.position.y + halfRadius , radius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.arc(blob.position.x + radius, blob.position.y - halfRadius, radius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.arc(blob.position.x - halfRadius, blob.position.y - radius, radius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.arc(blob.position.x + halfRadius, blob.position.y + radius, radius, 0, 2 * Math.PI, false);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.arc(blob.position.x, blob.position.y, radius, 0, 2 * Math.PI, false);
      this.ctx.fill();
    }
  }

  updateData(now: number): void {

    // update goo blobs
    for (let i = this.gooBlobs.length - 1; i >= 0; i--){
      this.gooBlobs[i].duration -= this.tickMilliseconds;
      if (this.gooBlobs[i].duration <= 0){
        this.gooBlobs.splice(i, 1);
      }
    }

    // update creep locations
    this.unsolvable = false;
    for (let i = this.creeps.length - 1; i >= 0; i--){
      const creep = this.creeps[i];
      if ((creep?.stunTimer || 0 > 0)){
        creep.stunTimer = (creep?.stunTimer || 0) - 1;
        continue;
      }
      if (!creep.nextCell){
        this.setNextCreepStep(creep);
      }
      if (!creep.nextCell){
        this.paused = true;
        this.unsolvable = true;
        return;
      }
      if (creep.type == CreepType.Egg){
        continue;
      }
      let speed = creep.speed;
      for (const blob of this.gooBlobs){
        if (this.getDistance(creep.position, blob.position) <= (this.squaresize * .5) + (creep.size * this.squaresize)){
          if (blob.damageType == DamageType.Goo){
            speed *= .5;
          } else if (blob.damageType == DamageType.Acid){
            // don't use acid damage type, it will spawn another blob
            this.damageCreep(creep, blob.damage, DamageType.Other);
          }
        }
      }
      for (let j = creep.status.length - 1; j >= 0; j--){
        if (creep.status[j].effect == DamageType.Poison){
          this.damageCreep(creep, creep.status[j].power * creep.maxHealth, DamageType.Other);
        }
        creep.status[j].duration -= this.tickMilliseconds;
        if (creep.status[j].duration <= 0){
          creep.status.splice(j, 1);
        }
      }
      const targetX = creep.nextCell.col * this.squaresize + (this.squaresize / 2);
      const targetY = creep.nextCell.row * this.squaresize + (this.squaresize / 2);
      if (creep.position.x < targetX){
        creep.position.x = Math.min(creep.position.x + speed, targetX);
        creep.direction = Direction.Right
      } else if (creep.position.x > targetX){
        creep.position.x = Math.max(creep.position.x - speed, targetX);
        creep.direction = Direction.Left;
      } else if (creep.position.y < targetY){
        creep.position.y = Math.min(creep.position.y + speed, targetY);
        creep.direction = Direction.Down;
      } else if (creep.position.y > targetY){
        creep.position.y = Math.max(creep.position.y - speed, targetY);
        creep.direction = Direction.Up;
      } else {
        // we reached our destination, check if it's the end
        if (creep.nextCell.row == this.endPosition.row && creep.nextCell.col == this.endPosition.col){
          // the creep made it through, set it back to the start
          creep.lastCell = this.startPosition;
          // untarget any towers targeting the creep
          creep.position = this.getPointFromGridPoint(this.startPosition);
          for (let tower of this.towers){
            if (tower.target == creep){
              tower.target = null;
              break;
            }
          }
          this.leaks++;
        } else {
          creep.lastCell = creep.nextCell;
          if (creep.type == CreepType.EggLayer && this.creeps.length < this.maxCreeps){
            this.creeps.push({
              position: {x: creep.position.x, y: creep.position.y},
              direction: creep.direction,
              type: CreepType.Egg,
              speed: creep.speed,
              health: creep.maxHealth / 10,
              maxHealth: creep.maxHealth / 10,
              lastCell: creep.lastCell,
              nextCell: null,
              pathToEndLength: Number.MAX_SAFE_INTEGER,
              phase: 0,
              deaths: 0,
              value: creep.value / 2,
              size: .15,
              status: []
            });
          }
        }
        // it's not the end, set a new next step
        this.setNextCreepStep(creep);
      }
    }

    if (this.nextSaveTime <= now){
      this.saveGame();
      this.nextSaveTime = now + this.saveInterval;
    }

    if (this.creeps.length == 0 && this.creepsLeft == 0){
      if (this.leaks == 0){
        this.toast("Wave complete!\n\nLet's try something harder.");
        this.startNextWave();
      } else {
        this.restartWave();
      }
    }

    if (this.nextCreepSpawn <= now && this.creepsLeft > 0 && this.creeps.length < this.maxCreeps){
      this.spawnCreep();
      this.nextCreepSpawn = now + this.creepSpawnInterval;
    }

    if (this.nextPhaseChange <= now){
      this.selectedSquarePhase++;
      if (this.selectedSquarePhase >= this.selectedSquarePhases.length){
        this.selectedSquarePhase = 0;
      }
      for (let i = this.deathExplosions.length - 1; i >= 0; i--){
        this.deathExplosions[i].countdown--;
        if (this.deathExplosions[i].countdown <= 0){
          this.deathExplosions.splice(i, 1);
        }
      }
      this.nextPhaseChange = now + this.phaseChangeInterval;
      for (const tower of this.towers){
        tower.targetingPhase = TargetingPhase.Aiming;
        if (tower.type == TowerType.Storm || tower.type == TowerType.Paralysis || tower.type == TowerType.PlasmaRay){
          tower.animationPhase = (tower.animationPhase || 0) + 1;
          if (tower.animationPhase >= 10){
            tower.animationPhase = 0;
          }
        }
      }
      const newCreeps: Creep[] = [];
      for (let i = this.creeps.length - 1; i >= 0; i--){
        const creep = this.creeps[i];
        if (creep.type == CreepType.Blob){
          creep.phase++;
          if (creep.phase > 4){
            creep.phase = 0;
          }
        } else if (creep.type == CreepType.EggLayer || creep.type == CreepType.EnergyEater || creep.type == CreepType.KineticAbsorber){
          creep.phase++;
          if (creep.phase >= 10){
            creep.phase = 0;
          }
        } else if (creep.type == CreepType.Ghost){
          creep.phase++;
          if (creep.phase > this.ghostPhaseMax){
            creep.phase = 0;
          }
        } else if (creep.type == CreepType.Egg){
          creep.phase++;
          if (creep.phase > 20 && this.creeps.length < this.maxCreeps){
            newCreeps.push({
              position: {x: creep.position.x, y: creep.position.y},
              direction: creep.direction,
              type: CreepType.EggLayer,
              speed: creep.speed,
              health: creep.maxHealth * 5,
              maxHealth: creep.maxHealth * 5,
              lastCell: creep.lastCell,
              nextCell: creep.nextCell,
              pathToEndLength: creep.pathToEndLength,
              phase: 0,
              deaths: 0,
              value: creep.value / 2,
              size: .2,
              status: []
            });
            this.killCreep(creep, false);
          }
        }
      }
      for (let newCreep of newCreeps){
        this.creeps.push(newCreep);
      }
    }


    for (let i = this.bombExplosions.length - 1; i >= 0; i--){
      this.bombExplosions[i].countdown -= 4;
      if (this.bombExplosions[i].countdown <= 0){
        this.bombExplosions.splice(i, 1);
      }
    }

    // fire towers that are ready
    for (const tower of this.towers){
      if (tower.type == TowerType.DamageBooster){
        continue;
      }
      if (tower.target){
        // check for target ghosting
        if (tower.target.type == CreepType.Ghost && tower.target.phase < this.ghostPhaseMax / 2){
          tower.target = null;
        } else {
          // check range
          let distance = this.getDistance(this.getPointFromGridPoint(tower.gridPosition), tower.target.position);
          if (distance > tower.range * this.squaresize){
            tower.target = null;
          }
        }
      }

      if (!tower.target || !tower.lockTarget){
        tower.target = this.chooseTarget(tower);
      }

      if (tower.target){
        if (tower.targetingPhase == TargetingPhase.Aiming){
          tower.lastTargetPosition = tower.target.position;
        }
        if (tower.lastShotTime + tower.fireCooldown < now){
          // time for shooting!
          const damageMultiplier = this.getDamageMultiplier(tower);
          const damage = tower.damage * damageMultiplier;

          if (tower.type == TowerType.Bomb || tower.type == TowerType.Rocket || tower.type == TowerType.Missile){
            this.projectiles.push({
              position: tower.muzzlePoint,
              destination: {x: tower.lastTargetPosition.x, y: tower.lastTargetPosition.y},
              speed: tower.projectileSpeed * this.squaresize,
              damage: damage,
              damageType: tower.damageType,
              size: tower.projectileSize * this.squaresize,
              blastSize: tower.blastSize * this.squaresize,
              color: "red",
              stopOnImpact: false,
              shape: tower.type == TowerType.Bomb ? ProjectileShape.Round : ProjectileShape.Missile
            });
          } else if (tower.type == TowerType.TriShot){
            let p1 = this.getPerpendicularPoint1(tower.lastTargetPosition, tower.position, this.squaresize);
            let p2 = this.getPerpendicularPoint2(tower.lastTargetPosition, tower.position, this.squaresize);
            let destinations = [
              {x: tower.lastTargetPosition.x, y: tower.lastTargetPosition.y},
              {x: p1.x, y: p1.y},
              {x: p2.x, y: p2.y},
            ];
            for (let destination of destinations){
              this.projectiles.push({
                position: tower.muzzlePoint,
                destination: destination,
                speed: tower.projectileSpeed * this.squaresize,
                damage: damage,
                damageType: tower.damageType,
                size: tower.projectileSize * this.squaresize,
                blastSize: tower.blastSize * this.squaresize,
                color: "red",
                stopOnImpact: false,
                shape: ProjectileShape.Round
              });
            }
          } else if (tower.type == TowerType.Cluster){
            let longPoint = this.getPointOnLine(tower.position, tower.lastTargetPosition, this.getDistance(tower.position, tower.lastTargetPosition) + this.squaresize, true);
            let shortPoint = this.getPointOnLine(tower.position, tower.lastTargetPosition, this.getDistance(tower.position, tower.lastTargetPosition) - this.squaresize, true);
            let p1 = this.getPerpendicularPoint1(tower.lastTargetPosition, tower.position, this.squaresize);
            let p2 = this.getPerpendicularPoint2(tower.lastTargetPosition, tower.position, this.squaresize);
            let p3 = this.getPerpendicularPoint1(longPoint, tower.position, this.squaresize * .5);
            let p4 = this.getPerpendicularPoint2(longPoint, tower.position, this.squaresize * .5);
            let p5 = this.getPerpendicularPoint1(shortPoint, tower.position, this.squaresize * .5);
            let p6 = this.getPerpendicularPoint2(shortPoint, tower.position, this.squaresize * .5);

            let destinations = [
              {x: tower.lastTargetPosition.x, y: tower.lastTargetPosition.y},
              {x: p1.x, y: p1.y},
              {x: p2.x, y: p2.y},
              {x: p3.x, y: p3.y},
              {x: p4.x, y: p4.y},
              {x: p5.x, y: p5.y},
              {x: p6.x, y: p6.y},
            ];
            for (let destination of destinations){
              this.projectiles.push({
                position: tower.muzzlePoint,
                destination: destination,
                speed: tower.projectileSpeed * this.squaresize,
                damage: damage,
                damageType: tower.damageType,
                size: tower.projectileSize * this.squaresize,
                blastSize: tower.blastSize * this.squaresize,
                color: "red",
                stopOnImpact: false,
                shape: ProjectileShape.Round
              });
            }
          } else if (tower.type == TowerType.Basic){
            this.projectiles.push({
              position: tower.muzzlePoint,
              target: tower.target,
              speed: tower.projectileSpeed * this.squaresize,
              damage: damage,
              damageType: tower.damageType,
              size: tower.projectileSize * this.squaresize,
              blastSize: tower.blastSize * this.squaresize,
              color: "white",
              stopOnImpact: true,
              shape: ProjectileShape.Round
            });
          } else if (tower.type == TowerType.Poison){
            this.projectiles.push({
              position: tower.muzzlePoint,
              target: tower.target,
              speed: tower.projectileSpeed * this.squaresize,
              damage: damage,
              damageType: tower.damageType,
              size: tower.projectileSize * this.squaresize,
              blastSize: tower.blastSize * this.squaresize,
              color: "green",
              stopOnImpact: true,
              shape: ProjectileShape.Round
            });
          } else if (tower.type == TowerType.Goo || tower.type == TowerType.Acid){
            this.projectiles.push({
              position: tower.muzzlePoint,
              destination: {x: tower.lastTargetPosition.x, y: tower.lastTargetPosition.y},
              speed: tower.projectileSpeed * this.squaresize,
              damage: damage,
              damageType: tower.damageType,
              size: tower.projectileSize * this.squaresize,
              blastSize: tower.blastSize * this.squaresize,
              color: tower.type == TowerType.Acid ? "green" : "yellow",
              stopOnImpact: true,
              shape: ProjectileShape.Round
            });
          } else if (tower.type == TowerType.Blunderbuss || tower.type == TowerType.Chainshot){
            let spread = 3;
            if (tower.type == TowerType.Chainshot){
              spread = 6;
            }
            let destinations = [{x: tower.lastTargetPosition.x, y: tower.lastTargetPosition.y}];
            for (let i = 0; i < spread; i++){
              let p1 = this.getPerpendicularPoint1(tower.lastTargetPosition, tower.position, this.squaresize * .05 * spread * i);
              let p2 = this.getPerpendicularPoint2(tower.lastTargetPosition, tower.position, this.squaresize * .05 * spread * i);
              destinations.push({x: p1.x, y: p1.y});
              destinations.push({x: p2.x, y: p2.y});
            }
            for (let destination of destinations){
              this.projectiles.push({
                position: tower.muzzlePoint,
                destination: destination,
                speed: tower.projectileSpeed * this.squaresize,
                damage: damage,
                damageType: tower.damageType,
                size: tower.projectileSize * this.squaresize,
                blastSize: tower.blastSize * this.squaresize,
                color: "#FFD9B3",
                stopOnImpact: true,
                shape: ProjectileShape.Round
              });
            }

          } else if (tower.type == TowerType.Heat || tower.type == TowerType.Radiation || tower.type == TowerType.Nuclear){
            for (const creep of this.creeps){
              if (this.getDistance(creep.position, tower.position) <= tower.range * this.squaresize){
                this.damageCreep(creep, damage, tower.damageType);
              }
            }
            if (tower.type == TowerType.Heat){
              this.bombExplosions.push({position: tower.position, size: tower.range * this.squaresize, countdown: 100, color: "yellow"})
            }
          } else {
            if (tower.target.type == CreepType.Shield && tower.target.deaths < 3){
              tower.target.deaths++;
            } else {
              this.damageCreep(tower.target, damage, tower.damageType);
            }
            if ( tower.type == TowerType.Bullet || tower.type == TowerType.Lightning ||
              tower.type == TowerType.ChainLightning || tower.type == TowerType.Storm ||
              tower.type == TowerType.Stun || tower.type == TowerType.Paralysis ||
              tower.type == TowerType.Sniper || tower.type == TowerType.Railgun ||
              tower.type == TowerType.Gatling || tower.type == TowerType.MachineGun){
              tower.targetingPhase = TargetingPhase.Firing;
            }
            if (tower.type == TowerType.Paralysis){
              // damage extra targets, hitting directly from the tower
              let targetCount = 2;
              const extraTargets: Creep[] = [tower.target];
              for (let i = 0; i < targetCount; i++){
                let target = this.chooseTarget(tower, extraTargets);
                if (target){
                  extraTargets.push(target);
                } else {
                  break;
                }
              }
              // peel off the original target
              extraTargets.shift();
              if (extraTargets.length > 0){
                for (const extraTarget of extraTargets){
                  this.damageCreep(extraTarget, damage, tower.damageType);
                }
                tower.extraTargets = extraTargets;
              } else {
                tower.extraTargets = undefined;
              }
            } else if (tower.type == TowerType.ChainLightning || tower.type == TowerType.Storm){
              // damage extra targets, bouncing from one target to the next
              let targetCount = 3;
              let bounceRange = tower.range * this.squaresize;
              if (tower.type == TowerType.Storm){
                targetCount = 6;
                bounceRange *= 2;
              }

              const extraTargets: Creep[] = [tower.target];
              for (let i = 0; i < targetCount; i++){
                let nearestDistance = Number.MAX_SAFE_INTEGER;
                let nearestCreep: Creep | undefined = undefined;
                for (const creep of this.creeps){
                  // check for target ghosting or used target
                  if ((creep.type == CreepType.Ghost && creep.phase < this.ghostPhaseMax / 2) || extraTargets.includes(creep)){
                    continue;
                  }
                  // check that the creep is in range
                  let distance = this.getDistance(extraTargets[extraTargets.length - 1].position, creep.position);
                  if (distance <= bounceRange){
                    if (distance < nearestDistance){
                      nearestCreep = creep;
                      nearestDistance = distance;
                    }
                  }
                }
                if (nearestCreep){
                  extraTargets.push(nearestCreep);
                } else {
                  break;
                }
              }
              extraTargets.shift();
              if (extraTargets.length > 0){
                for (const extraTarget of extraTargets){
                  this.damageCreep(extraTarget, damage, tower.damageType);
                }
                tower.extraTargets = extraTargets;
              } else {
                tower.extraTargets = undefined;
              }
            }
          }
          tower.lastShotTime = now;
        }
      }
    }

    // handle projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--){
      let projectile = this.projectiles[i];
      let destination;
      if (projectile.destination){
        destination = projectile.destination;
      } else if (projectile.target){
        destination = projectile.target.position;
      } else {
        // this projectile doesn't know where it's going, get rid of it
        this.projectiles.splice(i, 1);
        continue;
      }
      projectile.position = this.getPointOnLine(projectile.position, destination, projectile.speed);
      let impact = false;
      let impactTarget = null;
      if (projectile.position.x == destination.x && projectile.position.y == destination.y){
        // the projectile arrived
        impact = true;
      } else if (projectile.stopOnImpact){
        for (const creep of this.creeps){
          if (creep.health <= 0){
            // ignore creeps that are already dead
            continue;
          }
          if (this.getDistance(creep.position, projectile.position) <= creep.size * this.squaresize){
            impact = true;
            impactTarget = creep;
            break;
          }
        }
      }
      if (impact){
        if (projectile.blastSize > 0){
          for (const creep of this.creeps){
            if (this.getDistance(creep.position, projectile.position) <= projectile.blastSize){
              this.damageCreep(creep, projectile.damage, projectile.damageType);
            }
          }
          // then add an explosion and remove the projectile
          this.bombExplosions.push({position: projectile.position, size: projectile.blastSize, countdown: 100, color: "red"})
        } else if (impactTarget){
          this.damageCreep(impactTarget, projectile.damage, projectile.damageType);
        } else if (projectile.damageType == DamageType.Goo || projectile.damageType == DamageType.Acid){
          this.gooBlobs.push({position: {x: projectile.position.x, y: projectile.position.y},
            duration: 1000,
            damage: projectile.damage,
            damageType: projectile.damageType});
        }
        this.projectiles.splice(i, 1);
      }
    }

    // check for creep kills
    let newCreeps: Creep[][] = [];
    for (const creep of this.creeps){
      if (creep.health <= 0){
        let creepBatch = this.killCreep(creep);
        if (creepBatch.length > 0){
          newCreeps.push(creepBatch);
        }
      }
    }
    for(const newCreepBatch of newCreeps){
      for (const newCreep of newCreepBatch){
        this.creeps.push(newCreep);
      }
    }

  }

  chooseTarget(tower: Tower, excludeList: Creep[] = []) : Creep | null {
    let target = null;
    let bestMetric = Number.MAX_SAFE_INTEGER;
    let metric = 0;
    // try to find a target
    for (const creep of this.creeps){
      if (excludeList.includes(creep)){
        continue;
      }
      // check for target ghosting
      if (creep.type == CreepType.Ghost && creep.phase < this.ghostPhaseMax / 2){
        continue;
      }
      // check that the creep is in range
      if (this.getDistance(tower.position, creep.position) <= tower.range * this.squaresize){
        // if it's better than the current pick, pick it
        if (tower.targetPriority == TargetPriority.ClosestToEnd){
          metric = creep.pathToEndLength + this.getDistance(creep.position, this.getPointFromGridPoint(this.endPosition)) * .0001;
        } else if (tower.targetPriority == TargetPriority.Nearest){
          metric = this.getDistance(creep.position, this.getPointFromGridPoint(tower.gridPosition));
        } else if (tower.targetPriority == TargetPriority.Weakest){
          metric = creep.health;
        } else if (tower.targetPriority == TargetPriority.Strongest){
          metric = -creep.health;
        }
        if (metric < bestMetric){
          target = creep;
          bestMetric = metric
        }
      }
    }
    return target;
  }

  getDamageMultiplier(tower: Tower): number{
    let multiplier = 1;
    for (const otherTower of this.towers){
      if (otherTower.type == TowerType.DamageBooster){
        if (this.getDistance(tower.position, otherTower.position) <= (otherTower.range * this.squaresize)){
          multiplier *= otherTower.damage;
        }
      }
    }
    return multiplier;
  }

  damageCreep(creep: Creep, damage: number, damageType: DamageType){
    if (damageType == DamageType.Stun){
      creep.stunTimer = (creep?.stunTimer || 0) + damage;
      return;
    } else if (damageType == DamageType.Goo || damageType == DamageType.Acid){
      this.gooBlobs.push({position: {x: creep.position.x, y: creep.position.y}, duration: 1000, damage: damage, damageType: damageType});
      return;
    } else if (damageType == DamageType.Poison){
      this.addStatus(creep, {duration: 5000, power: damage, effect: damageType}); // TODO: make duration tied to tower stats somehow
    }
    if ((creep.type == CreepType.KineticAbsorber && damageType == DamageType.Physical) ||
      (creep.type == CreepType.EnergyEater && damageType == DamageType.Energy)){
      creep.health = Math.min(creep.health + (damage / 4), creep.maxHealth);
    } else {
      creep.health = Math.max(creep.health - damage, 0);
    }
  }

  addStatus(creep: Creep, newStatus: Status){
    for (const status of creep.status){
      if (status.effect == newStatus.effect){
        if (status.duration < newStatus.duration){
          status.duration = newStatus.duration;
        }
        if (status.power < newStatus.power){
          status.power = newStatus.power;
        }
        return;
      }
    }
    // didn't find an existing matching status, add one
    creep.status.push(newStatus);
  }


  // find the shortest path between the source point and the dest point
  setNextCreepStep(creep: Creep) {

    creep.nextCell = null;

    // These arrays are used to get row and column
    // numbers of 4 neighbours of a given cell
    const rowNum = [-1, 0, 0, 1];
    const colNum = [0, -1, 1, 0];

    let dest = this.endPosition;
    // check that the source and destination cells are open
    if(this.grid[creep.lastCell.row][creep.lastCell.col] !== 0 || this.grid[dest.row][dest.col] !== 0){
      return;
    }

    let visited: string[] = [];
    let pathBack: {[key: string]: string} = {};
    // Create a queue for breadth first search
    let q: string[] = [];
    let sourceNodeString = creep.lastCell.row + "," + creep.lastCell.col;

    q.push(creep.lastCell.row + "," + creep.lastCell.col) // Enqueue source cell

    // Do a BFS starting from source cell
    while(q.length > 0){
      let currentNode = q.shift(); // Dequeue the front cell
      if (!currentNode){
        break;
      }
      let splitCurrentString = currentNode.split(",");
      let currentRow = parseInt(splitCurrentString[0]);
      let currentCol = parseInt(splitCurrentString[1]);

      // If we have reached the destination cell, we are done
      if (currentRow == dest.row && currentCol == dest.col){
        let currentPathBack = currentNode;
        let nextPathBack = pathBack[currentNode];
        let pathLength = 0;
        while (nextPathBack && currentPathBack) {
          pathLength++;
          if (nextPathBack === sourceNodeString){
            // we traced it back to the start, parse the destination point out of the currentPathBack
            let splitstring = currentPathBack.split(",");
            let row = parseInt(splitstring[0]);
            let col = parseInt(splitstring[1]);
            creep.nextCell = {row: row, col: col};
            creep.pathToEndLength = pathLength;
            return;
          }
          currentPathBack = nextPathBack;
          nextPathBack = pathBack[currentPathBack];
        }
        return;
      }

      if (!visited.includes(currentNode)){
        // only add distinct entries to the visited array
        visited.push(currentNode);
      }

      // Otherwise enqueue its adjacent cells
      for(let i = 0; i < 4; i++){
        let row = currentRow + rowNum[i]
        let col = currentCol + colNum[i]
        let nextNodeString = row + "," + col;

        if (this.isValid(row, col)){
          if (!visited.includes(nextNodeString) && !q.includes(nextNodeString)){
            q.push(row + "," + col);
            pathBack[nextNodeString] = currentNode;
          }
        }
      }
    }
    // destination cannot be reached
    return;
  }

  getDistance(a: Point, b: Point): number{
    var xDiff = a.x - b.x;
    var yDiff = a.y - b.y;

    return Math.sqrt( (xDiff * xDiff) + (yDiff * yDiff) );
  }

  getPointOnLine(p1: Point, p2: Point, length: number, overshoot: boolean = false): Point {
    let x = ((length * (p2.x - p1.x)) / Math.sqrt( Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))) + p1.x;
    let y = ((length * (p2.y - p1.y)) / Math.sqrt( Math.pow(p2.y - p1.y, 2) + Math.pow(p2.x - p1.x, 2))) + p1.y;
    let returnPoint = {x: x, y: y};
    if (!overshoot && this.getDistance(p1, returnPoint) > this.getDistance(p1, p2)){
      // we overshot, clip back to endpoint
      returnPoint = {x: p2.x, y: p2.y};
    }
    return returnPoint;
  }

  getPerpendicularPoint1(p1: Point, p2: Point, length: number | null = null): Point{
    let perpendicularPoint = {x: p1.x - p2.y + p1.y, y: p1.y + p2.x - p1.x};
    if (length != null){
      perpendicularPoint = this.getPointOnLine(p1, perpendicularPoint, length, true);
    }
    return perpendicularPoint;
  }
  getPerpendicularPoint2(p1: Point, p2: Point, length: number | null = null): Point{
    let perpendicularPoint = {x: p1.x + p2.y - p1.y, y: p1.y - p2.x + p1.x};
    if (length != null){
      perpendicularPoint = this.getPointOnLine(p1, perpendicularPoint, length, true);
    }
    return perpendicularPoint;
  }

  startNextWave(){
    this.waveTokens++;
    this.wave++;
    this.waveCreepType = this.waveCreepTypes[(this.wave - 1) % this.waveCreepTypes.length];
    this.creepsLeft = this.getCreepCount();
    this.leaks = 0;
  }

  restartWave(){
    this.toast("Aw, some of those creeps made it through. Give it another shot.\n\nThis time for sure!")
    this.creepsLeft = this.getCreepCount();
    this.leaks = 0;
  }

  spawnCreep(){
    this.creepsLeft--;
    let creepType = this.waveCreepType;
    if (creepType == CreepType.Party){
      creepType = this.waveCreepTypes[9 - this.creepsLeft];
    }
    let speed = this.squaresize / 120;
    let numberToSpawn = 1;
    let size = .3;
    let rewardMultiplier = 1;
    if (creepType == CreepType.Speedy){
      speed *= 3;
    } else if (creepType == CreepType.Stacker){
      numberToSpawn = 10;
      size = .4;
      rewardMultiplier = .15;
    } else if (creepType == CreepType.Boss){
      rewardMultiplier = 5;
      size = .4;
    } else if (creepType == CreepType.EggLayer){
      size = .2;
    } else if (creepType == CreepType.Egg){
      size = .15;
      rewardMultiplier = 0;
    } else if (creepType == CreepType.Blob){
      size = .2;
    } else if (creepType == CreepType.EnergyEater){
      size = .4;
    }

    for (let i = 0; i < numberToSpawn; i++){
      this.creeps.push({
        position: this.getPointFromGridPoint(this.startPosition),
        direction: Direction.Right,
        type: creepType,
        speed: speed,
        health: this.getCreepHealth(this.wave, creepType),
        maxHealth: this.getCreepHealth(this.wave, creepType),
        lastCell: this.startPosition,
        nextCell: null,
        pathToEndLength: Number.MAX_SAFE_INTEGER,
        phase: i,
        deaths: 0,
        value: this.wave * rewardMultiplier,
        size: size,
        status: []
      });
    }
  }

  getCreepHealth(wave: number, creepType: CreepType): number{
    let creepTypeMultiplier = 1;
    if (creepType == CreepType.Boss){
      creepTypeMultiplier = 15;
    } else if (creepType == CreepType.Stacker || CreepType.EggLayer){
      creepTypeMultiplier = .2;
    }
    return (10 + Math.pow(1.5, wave)) * creepTypeMultiplier;
  }

  getCreepCount(){
    if (this.waveCreepType == CreepType.Boss){
      return 1;
    }
    if (this.waveCreepType == CreepType.Stacker){
      return 5;
    }
    return 10;
  }

  killCreep(creep: Creep, explode: boolean = true): Creep[]{
    let newCreeps: Creep[] = []
    if (explode){
      this.cash += creep.value;
    }
    if (creep.type == CreepType.Blob && creep.deaths == 0){
      // spawn baby blobs
      let r = this.squaresize / 4;
      let offsetX = [r, r, -r, -r];
      let offsetY = [r, -r, -r, r];
      for (let i = 0; i < 4; i++){
        let position = {x: creep.position.x + offsetX[i], y: creep.position.y + offsetY[i],};
        newCreeps.push({
          position: position,
          direction: creep.direction,
          type: creep.type,
          speed: creep.speed,
          health: creep.maxHealth / 2,
          maxHealth: creep.maxHealth / 2,
          lastCell: creep.lastCell,
          nextCell: creep.nextCell,
          pathToEndLength: creep.pathToEndLength,
          phase: i,
          deaths: 1,
          value: creep.value / 4,
          size: creep.size / 2,
          status: []
        });
      }
    }

    if (explode){
      this.deathExplosions.push({position: creep.position, countdown: 10});
    }

    for (let i = 0; i < this.creeps.length; i++){
      if (this.creeps[i] == creep){
        for (const tower of this.towers){
          if (tower.target == this.creeps[i]){
            tower.target = null;
          }
        }
        this.creeps.splice(i, 1);
        return newCreeps;
      }
    }
    return newCreeps;
  }

  addWall(){
    if (!this.selectedSquare){
      return;
    }
    if (this.busySquare() || this.cash < this.wallCost){
      return;
    }
    this.cash -= this.wallCost;
    this.wallCost++;
    this.grid[this.selectedSquare.row][this.selectedSquare.col] = SquareType.Wall;
    this.selectedSquareType = SquareType.Wall;
  }

  removeWall(){
    if (!this.selectedSquare){
      return;
    }
    this.wallCost--;
    this.cash += this.wallCost;
    this.grid[this.selectedSquare.row][this.selectedSquare.col] = SquareType.Open;
    this.selectedSquareType = SquareType.Open;
  }

  busySquare(): boolean {
    if (this.startPosition.row == this.selectedSquare?.row && this.startPosition.col == this.selectedSquare?.col){
      return true;
    }
    if (this.endPosition.row == this.selectedSquare?.row && this.endPosition.col == this.selectedSquare?.col){
      return true;
    }
    for (const creep of this.creeps){
      if (creep.nextCell?.row == this.selectedSquare?.row && creep.nextCell?.col == this.selectedSquare?.col){
        return true;
      }
    }
    return false;
  }

  getSelectedTower(): Tower | null {
    for (const tower of this.towers){
      if (tower.gridPosition.row == this.selectedSquare?.row && tower.gridPosition.col == this.selectedSquare?.col){
        return tower;
      }
    }
    return null;
  }

  sellTower(){
    if (!this.selectedSquare || !this.selectedTower){
      return;
    }
    this.cash += this.sellPriceFactor * this.selectedTower.value;
    this.towerCost /= 1.1;
    for (let i = 0; i < this.towers.length; i++){
      if (this.towers[i] == this.selectedTower){
        this.towers.splice(i, 1);
        this.selectedTower = null;
        return;
      }
    }
  }

  buildTower(towerType: TowerType){
    if (!this.selectedSquare){
      return;
    }
    if (this.cash < this.towerCost){
      return;
    }
    this.cash -= this.towerCost;
    this.towerCost *= 1.1;
    let towerTemplate;
    for (const template of this.towerTemplates){
      if (template.type == towerType){
        towerTemplate = template;
      }
    }
    if (!towerTemplate){
      return;
    }

    const startPoint = this.getPointFromGridPoint(this.startPosition);
    let blastSize = 0;
    if (towerType == TowerType.Bomb){
      blastSize = 1;
    } else if (towerType == TowerType.Rocket){
      blastSize = 1.2;
    } else if (towerType == TowerType.Missile){
      blastSize = 1.5;
    } else if (towerType == TowerType.TriShot || towerType == TowerType.Cluster){
      blastSize = .8;
    }

    this.towers.push(
      {
        gridPosition: {row: this.selectedSquare.row, col: this.selectedSquare.col},
        position: this.getPointFromGridPoint({row: this.selectedSquare.row, col: this.selectedSquare.col}),
        muzzlePoint: this.getPointFromGridPoint({row: this.selectedSquare.row, col: this.selectedSquare.col}),
        type: towerType,
        fireCooldown: towerTemplate.fireCooldown,
        damage: towerTemplate.damage,
        damageType: towerTemplate.damageType,
        range: towerTemplate.range,
        lastShotTime: 0,
        target: null,
        lastTargetPosition: {x: startPoint.x, y: startPoint.y},
        targetingPhase: TargetingPhase.Aiming,
        value: this.towerCost,
        projectileSize: towerTemplate.projectileSize,
        projectileSpeed: towerTemplate.projectileSpeed,
        blastSize: blastSize,
        targetPriority: TargetPriority.ClosestToEnd,
        lockTarget: true
      }
    )
    this.selectedTower = this.towers[this.towers.length - 1];
    this.ghostTower = null;
  }

  showGhostTower(towerType: TowerType){
    if (!this.selectedSquare){
      return;
    }
    if (this.selectedTower){
      // don't show a ghost if there's already a tower there
      return;
    }
    let towerTemplate;
    for (const template of this.towerTemplates){
      if (template.type == towerType){
        towerTemplate = template;
      }
    }
    if (!towerTemplate){
      return;
    }

    const startPoint = this.getPointFromGridPoint(this.startPosition);
    this.ghostTower = {
      gridPosition: {row: this.selectedSquare.row, col: this.selectedSquare.col},
      position: this.getPointFromGridPoint({row: this.selectedSquare.row, col: this.selectedSquare.col}),
      muzzlePoint: this.getPointFromGridPoint({row: this.selectedSquare.row, col: this.selectedSquare.col}),
      type: towerType,
      fireCooldown: towerTemplate.fireCooldown,
      damage: towerTemplate.damage,
      damageType: towerTemplate.damageType,
      range: towerTemplate.range,
      lastShotTime: 0,
      target: null,
      lastTargetPosition: {x: startPoint.x, y: startPoint.y},
      targetingPhase: TargetingPhase.Aiming,
      value: this.towerCost,
      projectileSize: 0,
      projectileSpeed: 0,
      blastSize: 0,
      targetPriority: TargetPriority.ClosestToEnd,
      lockTarget: true
    };
  }

  hideGhostTower(){
    this.ghostTower = null;
  }

  upgradeDamage(){
    if (this.selectedTower == null){
      return;
    }
    this.selectedTower.damage += (this.selectedTower.damage * 0.1);
  }

  upgradeRange(){
    if (this.selectedTower == null){
      return;
    }
    this.selectedTower.range += (this.selectedTower.range * 0.1);
  }

  upgradeRate(){
    if (this.selectedTower == null){
      return;
    }
    this.selectedTower.fireCooldown -= (this.selectedTower.fireCooldown * 0.1);
  }

  targetPriorityChange(priority: TargetPriority){
    if (this.selectedTower){
      this.selectedTower.targetPriority = priority;
    }
  }

  toggleTargetPriorityLock(){
    if (this.selectedTower){
      this.selectedTower.lockTarget = !this.selectedTower.lockTarget;
    }
  }

  // Check whether given cell(row,col) is valid for creep movement
  isValid(row: number, col: number): boolean{
    if ((row < 0) || (row >= this.grid.length)){
      // outside of rows
      return false;
    }
    if ((col < 0) || (col >= this.grid[0].length)){
      // outside of columns
      return false;
    }
    return this.grid[row][col] === 0;
  }

  getPointFromGridPoint(gridPoint: GridPoint): Point{
    return {x: (gridPoint.col * this.squaresize) + this.squaresize / 2, y: (gridPoint.row * this.squaresize) + this.squaresize / 2};
  }

  toast(message: string, duration = 5000) {
    this.snackbar.open(message, "x", { duration: duration, horizontalPosition: 'center', verticalPosition: 'bottom', panelClass: ['snackbar'] });
  }

  addMazeRow(){
    if (this.waveTokens < this.expandGridCost || this.grid.length >= this.maxGridDimension){
      return;
    }
    this.waveTokens -= this.expandGridCost;
    this.expandGridCost = Math.round(1.5 * this.expandGridCost);
    const newRow = [];
    for (let i = 0; i < this.grid[0].length; i++){
      newRow.push(0);
    }
    this.grid.push(newRow);
    this.endPosition.row++;
    this.updateSquareSize(this.canvasWidth / Math.max(this.grid.length, this.grid[0].length));
  }

  addMazeCol(){
    if (this.waveTokens < this.expandGridCost || this.grid[0].length >= this.maxGridDimension){
      return;
    }
    this.waveTokens -= this.expandGridCost;
    this.expandGridCost = Math.round(1.5 * this.expandGridCost);
    for (let i = 0; i < this.grid.length; i++){
      this.grid[i].push(0);
    }
    this.endPosition.col++;
    this.updateSquareSize(this.canvasWidth / Math.max(this.grid.length, this.grid[0].length));
  }

  startOver(){
    window.localStorage.removeItem('TDIdleGameState');
    window.location.reload();
  }

  updateSquareSize(newSize: number){
    if (this.squaresize == newSize){
      return;
    }
    for (let creep of this.creeps){
      creep.position.x = creep.position.x * newSize / this.squaresize;
      creep.position.y = creep.position.y * newSize / this.squaresize;
    }
    for (let tower of this.towers){
      tower.position.x = tower.position.x * newSize / this.squaresize;
      tower.position.y = tower.position.y * newSize / this.squaresize;
    }

    this.squaresize = newSize;
  }

  saveGame(){
    const gameState = {
      grid: this.grid,
      startPosition: this.startPosition,
      endPosition: this.endPosition,
      towers: this.towers,
      wave: this.wave,
      cash: this.cash,
      waveTokens: this.waveTokens,
      towerCost: this.towerCost,
      wallCost: this.wallCost,
      expandGridCost: this.expandGridCost
    }
    let gameStateString = JSON.stringify(gameState);
    gameStateString = "tdidle" + btoa(encodeURIComponent(gameStateString));

    window.localStorage.setItem('TDIdleGameState', gameStateString);
  }

  loadGame(){
    let gameStateSerialized = window.localStorage.getItem('TDIdleGameState');
    if (!gameStateSerialized) {
      return;
    }
    if (gameStateSerialized.substring(0, 6) === "tdidle") {
      // it's a new save file
      gameStateSerialized = decodeURIComponent(atob(gameStateSerialized.substring(6)));
    }
    const gameState = JSON.parse(gameStateSerialized);
    if (gameState){
      this.grid = gameState.grid;
      this.updateSquareSize(this.canvasWidth / Math.max(this.grid.length, this.grid[0].length));
      this.startPosition = gameState.startPosition;
      this.endPosition = gameState.endPosition;
      this.towers = gameState.towers;
      for (const tower of this.towers){
        tower.target = null;
        tower.lastShotTime = 0;
        tower.targetingPhase = TargetingPhase.Aiming;
      }
      this.cash = gameState.cash;
      this.waveTokens = gameState.waveTokens;
      this.towerCost = gameState.towerCost;
      this.wallCost = gameState.wallCost;
      this.expandGridCost = gameState.expandGridCost
      this.wave = gameState.wave - 1;
      this.startNextWave();

    }
  }
}

