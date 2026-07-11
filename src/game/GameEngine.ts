import { Application, Container, Graphics, Text } from "pixi.js";
import { obtenerPalabraPorNivel, compararCaracteres } from "./dictionary";
import { ParticleSystem } from "./ParticleSystem";
import { soundSystem } from "./SoundSystem";

export interface GameBridge {
  onScoreUpdate: (score: number) => void;
  onShieldUpdate: (shield: number) => void;
  onComboUpdate: (combo: number) => void;
  onLevelUpdate: (level: number) => void;
  onEnemySpawn: (word: string) => void;
  onGameOver: (finalScore: number) => void;
  onSupportUpdate: (charges: number, wordsLeft: number) => void;
}

interface EnemyShip {
  id: string;
  word: string;
  typedCount: number;
  speed: number;
  x: number;
  y: number;
  color: number;
  type: "scout" | "cruiser" | "carrier";
  container: Container;
  graphics: Graphics;
  typedLabel: Text;
  remainingLabel: Text;
  textOffsetY: number;
}

interface Star {
  graphics: Graphics;
  x: number;
  y: number;
  speed: number;
  depth: number;
}

interface AlliedShip {
  graphics: Graphics;
  x: number;
  y: number;
  vy: number;
  active: boolean;
}

interface LaserBeam {
  graphics: Graphics;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  life: number;
  maxLife: number;
}

export class GameEngine {
  private app: Application;
  private bridge: GameBridge;
  
  // Contenedores Pixi
  private starContainer = new Container();
  private particleContainer = new Container();
  private shipContainer = new Container();
  private laserContainer = new Container();
  private hudContainer = new Container();

  // Estados del juego
  private isInitialized = false;
  private isDestroyed = false;
  private isActive = false;
  private enemies: EnemyShip[] = [];
  private stars: Star[] = [];
  private lasers: LaserBeam[] = [];
  private particleSystem!: ParticleSystem;

  // Jugador y Cañones
  private playerGraphics!: Graphics;
  private playerX = 0;
  private playerY = 0;
  private fireLeftCannon = true;

  // Sacudida de pantalla
  private shakeAmount = 0;
  private shakeDuration = 0;

  // Textos flotantes
  private floatingTexts: {
    text: Text;
    x: number;
    y: number;
    vx: number;
    vy: number;
    alpha: number;
    life: number;
    maxLife: number;
  }[] = [];

  // Target lock
  private lockedEnemyId: string | null = null;
  private targetReticle!: Graphics;
  private targetLineGraphics!: Graphics;

  // Nave de Apoyo Aliada y Especial
  private alliedShip: AlliedShip | null = null;
  private supportCharges = 0;
  private wordsCompletedForSupport = 0;
  private wordsUntilSupport = 30;

  // Configuración de juego seleccionada
  private selectedSpeedSetting: "lento" | "normal" | "rapido" | "extremo" = "normal";
  private selectedComplexitySetting: "basico" | "intermedio" | "avanzado" | "progresivo" = "progresivo";

  // Estadísticas del juego (sincronizadas con React)
  private score = 0;
  private shield = 100;
  private combo = 0;
  private level = 1;
  private wordsCompleted = 0;
  private totalKeystrokes = 0;
  private correctKeystrokes = 0;

  // Tiempos
  private spawnTimer = 0;
  private spawnInterval = 3000; // ms

  constructor(canvas: HTMLCanvasElement, bridge: GameBridge) {
    this.bridge = bridge;
    this.app = new Application();
    this.init(canvas);
  }

  private async init(canvas: HTMLCanvasElement) {
    try {
      await this.app.init({
        canvas,
        resizeTo: window,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        backgroundAlpha: 0, // Fondo transparente para que el CSS actúe
      });

      // Si fue destruido durante el proceso de inicialización asíncrono, abortamos
      if (this.isDestroyed) {
        if (this.app.stage) {
          this.app.stage.destroy({ children: true });
        }
        this.app.destroy({ removeView: true });
        return;
      }

      this.setupLayers();
      this.setupStarfield();
      this.setupPlayer();
      this.setupTargetReticle();
      
      this.particleSystem = new ParticleSystem(this.particleContainer);

      // Iniciar el Ticker de Pixi
      this.app.ticker.add(this.update, this);
      
      this.isInitialized = true;
      this.resetStats();
    } catch (error) {
      console.error("Error al inicializar PixiJS:", error);
    }
  }

  private setupLayers() {
    this.app.stage.addChild(this.starContainer);
    this.app.stage.addChild(this.laserContainer);
    this.app.stage.addChild(this.shipContainer);
    this.app.stage.addChild(this.particleContainer);
    this.app.stage.addChild(this.hudContainer);
  }

  private setupStarfield() {
    const starCount = 120;
    const starColors = [0xffffff, 0xd0e8ff, 0xffeed0, 0xffd0e8, 0xa0c0ff];
    for (let i = 0; i < starCount; i++) {
      const graphics = new Graphics();
      const depth = Math.random(); // 0 (lejos, lento) a 1 (cerca, rápido)
      const size = depth * 2.5 + 0.5;
      
      // Estrellas de diferentes intensidades y tonos neón
      const alpha = depth * 0.7 + 0.3;
      const color = starColors[Math.floor(Math.random() * starColors.length)];
      
      graphics.circle(0, 0, size).fill({ color, alpha });

      const x = Math.random() * window.innerWidth;
      const y = Math.random() * window.innerHeight;
      graphics.x = x;
      graphics.y = y;

      this.starContainer.addChild(graphics);

      this.stars.push({
        graphics,
        x,
        y,
        speed: (depth * 1.5 + 0.2) * 0.8,
        depth
      });
    }
  }

  private setupPlayer() {
    this.playerGraphics = new Graphics();
    this.drawPlayerShip();
    this.hudContainer.addChild(this.playerGraphics);

    this.playerX = window.innerWidth / 2;
    this.playerY = window.innerHeight - 80;
    this.playerGraphics.x = this.playerX;
    this.playerGraphics.y = this.playerY;
  }

  private drawPlayerShip() {
    this.playerGraphics.clear();
    
    // Parpadeo del propulsor
    const now = performance.now();
    const flameHeight = 15 + Math.sin(now * 0.05) * 6;
    
    // Propulsor (Flama de plasma)
    this.playerGraphics.moveTo(-6, 8);
    this.playerGraphics.lineTo(0, 8 + flameHeight);
    this.playerGraphics.lineTo(6, 8);
    this.playerGraphics.closePath();
    this.playerGraphics.fill({ color: 0xffaa00, alpha: 0.85 });
    
    // Núcleo de la flama (más brillante)
    this.playerGraphics.moveTo(-3, 8);
    this.playerGraphics.lineTo(0, 8 + flameHeight * 0.6);
    this.playerGraphics.lineTo(3, 8);
    this.playerGraphics.closePath();
    this.playerGraphics.fill({ color: 0xffffff, alpha: 0.95 });

    // Nave principal
    // Cuerpo principal
    this.playerGraphics.moveTo(0, -32);
    this.playerGraphics.lineTo(16, 5);
    this.playerGraphics.lineTo(6, 8);
    this.playerGraphics.lineTo(-6, 8);
    this.playerGraphics.lineTo(-16, 5);
    this.playerGraphics.closePath();
    this.playerGraphics.fill({ color: 0x00f0ff });
    
    // Alas / Paneles de energía
    this.playerGraphics.moveTo(8, 0);
    this.playerGraphics.lineTo(24, 12);
    this.playerGraphics.lineTo(12, 10);
    this.playerGraphics.closePath();
    this.playerGraphics.fill({ color: 0x9d00ff });

    this.playerGraphics.moveTo(-8, 0);
    this.playerGraphics.lineTo(-24, 12);
    this.playerGraphics.lineTo(-12, 10);
    this.playerGraphics.closePath();
    this.playerGraphics.fill({ color: 0x9d00ff });

    // Escudo decorativo en la base
    this.playerGraphics.circle(0, 0, 18).stroke({ color: 0x00f0ff, width: 1.5, alpha: 0.3 });
    
    // Cañones
    this.playerGraphics.rect(-18, -12, 3, 16).fill({ color: 0xff007f });
    this.playerGraphics.rect(15, -12, 3, 16).fill({ color: 0xff007f });
  }

  private setupTargetReticle() {
    this.targetReticle = new Graphics();
    this.targetReticle.visible = false;
    this.hudContainer.addChild(this.targetReticle);

    this.targetLineGraphics = new Graphics();
    this.hudContainer.addChild(this.targetLineGraphics);
  }

  private drawTargetReticle(size: number) {
    this.targetReticle.clear();
    const halfWidth = size * 1.3;  // Más ancho para enmarcar palabras
    const halfHeight = size * 0.45; // Más aplanado
    const len = 8;

    this.targetReticle.stroke({ color: 0xff007f, width: 2, alpha: 0.8 });

    // Esquina superior izquierda
    this.targetReticle.moveTo(-halfWidth, -halfHeight + len).lineTo(-halfWidth, -halfHeight).lineTo(-halfWidth + len, -halfHeight);
    // Esquina superior derecha
    this.targetReticle.moveTo(halfWidth, -halfHeight + len).lineTo(halfWidth, -halfHeight).lineTo(halfWidth - len, -halfHeight);
    // Esquina inferior izquierda
    this.targetReticle.moveTo(-halfWidth, halfHeight - len).lineTo(-halfWidth, halfHeight).lineTo(-halfWidth + len, halfHeight);
    // Esquina inferior derecha
    this.targetReticle.moveTo(halfWidth, halfHeight - len).lineTo(halfWidth, halfHeight).lineTo(halfWidth - len, halfHeight);
  }

  public startGame(
    speedSetting: "lento" | "normal" | "rapido" | "extremo" = "normal",
    complexitySetting: "basico" | "intermedio" | "avanzado" | "progresivo" = "progresivo"
  ) {
    this.selectedSpeedSetting = speedSetting;
    this.selectedComplexitySetting = complexitySetting;
    
    this.resumeAudio();
    this.resetStats();
    this.isActive = true;
  }

  public pauseGame() {
    this.isActive = false;
  }

  public resumeGame() {
    this.isActive = true;
  }

  private resumeAudio() {
    soundSystem.resume();
  }

  private resetStats() {
    this.score = 0;
    this.shield = 100;
    this.combo = 0;
    this.level = 1;
    this.wordsCompleted = 0;
    this.totalKeystrokes = 0;
    this.correctKeystrokes = 0;
    this.lockedEnemyId = null;
    this.targetReticle.visible = false;
    this.spawnTimer = 0;
    
    // Configurar intervalo inicial según la velocidad
    if (this.selectedSpeedSetting === "lento") {
      this.spawnInterval = 4000;
    } else if (this.selectedSpeedSetting === "normal") {
      this.spawnInterval = 3200;
    } else if (this.selectedSpeedSetting === "rapido") {
      this.spawnInterval = 2400;
    } else {
      this.spawnInterval = 1600; // extremo
    }

    this.shakeAmount = 0;
    this.shakeDuration = 0;
    this.supportCharges = 0;
    this.wordsCompletedForSupport = 0;
    this.wordsUntilSupport = 30;

    // Limpiar nave de apoyo aliada
    if (this.alliedShip) {
      this.app.stage.removeChild(this.alliedShip.graphics);
      this.alliedShip.graphics.destroy();
      this.alliedShip = null;
    }

    // Limpiar textos flotantes
    for (const ft of this.floatingTexts) {
      this.hudContainer.removeChild(ft.text);
    }
    this.floatingTexts = [];

    if (this.targetLineGraphics) {
      this.targetLineGraphics.clear();
    }

    // Limpiar naves
    for (const enemy of this.enemies) {
      this.shipContainer.removeChild(enemy.container);
    }
    this.enemies = [];

    // Limpiar láseres
    for (const laser of this.lasers) {
      this.laserContainer.removeChild(laser.graphics);
    }
    this.lasers = [];

    if (this.particleSystem) {
      this.particleSystem.clear();
    }

    // Comunicar stats iniciales
    this.bridge.onScoreUpdate(this.score);
    this.bridge.onShieldUpdate(this.shield);
    this.bridge.onComboUpdate(this.combo);
    this.bridge.onLevelUpdate(this.level);
    this.bridge.onSupportUpdate(this.supportCharges, this.wordsUntilSupport);
  }

  /**
   * Procesa la pulsación de teclas. Es invocada desde React.
   */
  public handleInput(char: string) {
    if (!this.isActive || !this.isInitialized || char.length === 0) return;

    this.totalKeystrokes++;
    const typedChar = char.charAt(0); // Tomar el primer carácter typed

    if (this.lockedEnemyId) {
      // Intentar avanzar en el enemigo actualmente enfocado
      const enemy = this.enemies.find((e) => e.id === this.lockedEnemyId);
      if (enemy) {
        const nextChar = enemy.word.charAt(enemy.typedCount);
        if (compararCaracteres(typedChar, nextChar)) {
          this.matchCharacter(enemy);
        } else {
          this.missCharacter();
        }
      } else {
        this.lockedEnemyId = null;
        this.handleInput(char); // Reintentar sin lock
      }
    } else {
      // Buscar un enemigo que comience con la letra typed.
      // Si hay varios, elegir el que esté más abajo (mayor Y).
      let bestMatch: EnemyShip | null = null;
      for (const enemy of this.enemies) {
        const firstChar = enemy.word.charAt(0);
        if (compararCaracteres(typedChar, firstChar)) {
          if (!bestMatch || enemy.y > bestMatch.y) {
            bestMatch = enemy;
          }
        }
      }

      if (bestMatch) {
        this.lockedEnemyId = bestMatch.id;
        this.matchCharacter(bestMatch);
      } else {
        this.missCharacter();
      }
    }
  }

  private matchCharacter(enemy: EnemyShip) {
    enemy.typedCount++;
    this.correctKeystrokes++;
    this.combo++;
    this.bridge.onComboUpdate(this.combo);

    // Audio de disparo
    soundSystem.playShoot();

    // Alternar cañones izquierdo y derecho
    const muzzleX = this.fireLeftCannon ? this.playerX - 18 : this.playerX + 15;
    const muzzleY = this.playerY - 12;
    this.fireLeftCannon = !this.fireLeftCannon;

    // Crear rayo láser con el color del enemigo directo hacia la palabra
    this.createLaser(muzzleX, muzzleY, enemy.x, enemy.y + enemy.textOffsetY, enemy.color);

    // Destello de partículas en el cañón
    this.particleSystem.flash(muzzleX, muzzleY, enemy.color);

    // Partículas de impacto en la palabra
    this.particleSystem.explode(enemy.x, enemy.y + enemy.textOffsetY, enemy.color, 5);

    // Letra flotante verde neón sobre la palabra
    const typedChar = enemy.word.charAt(enemy.typedCount - 1);
    this.createFloatingText(typedChar.toUpperCase(), enemy.x + (Math.random() - 0.5) * 15, enemy.y + enemy.textOffsetY - 15, 0x39ff14);

    // Sacudida de pantalla leve al disparar
    this.triggerShake(3, 4);

    // Actualizar visualización del texto
    this.updateEnemyText(enemy);

    if (enemy.typedCount >= enemy.word.length) {
      // ¡Enemigo destruido!
      this.destroyEnemy(enemy);
    }
  }

  private missCharacter() {
    this.combo = 0;
    this.bridge.onComboUpdate(this.combo);
    soundSystem.playError();

    // Mostrar una "X" roja sobre el jugador
    this.createFloatingText("✕", this.playerX, this.playerY - 45, 0xff0055);

    // Sacudida de pantalla por error
    this.triggerShake(4, 5);
  }

  private triggerShake(amount: number, duration: number) {
    this.shakeAmount = amount;
    this.shakeDuration = duration;
  }

  private createFloatingText(content: string, x: number, y: number, color: number) {
    const text = new Text({
      text: content,
      style: {
        fontFamily: "Share Tech Mono",
        fontSize: 24,
        fontWeight: "bold",
        fill: color,
        align: "center"
      }
    });
    text.anchor.set(0.5);
    text.x = x;
    text.y = y;

    this.hudContainer.addChild(text);

    this.floatingTexts.push({
      text,
      x,
      y,
      vx: (Math.random() - 0.5) * 2,
      vy: -2 - Math.random() * 2,
      alpha: 1,
      life: 25,
      maxLife: 25
    });
  }

  private createLaser(startX: number, startY: number, targetX: number, targetY: number, color: number) {
    const graphics = new Graphics();
    
    // 1. Línea exterior de resplandor (glow)
    graphics.stroke({ color, width: 8, alpha: 0.35 });
    graphics.moveTo(startX, startY);
    graphics.lineTo(targetX, targetY);

    // 2. Línea media de energía
    graphics.stroke({ color, width: 4, alpha: 0.7 });
    graphics.moveTo(startX, startY);
    graphics.lineTo(targetX, targetY);

    // 3. Núcleo blanco brillante
    graphics.stroke({ color: 0xffffff, width: 1.5, alpha: 1.0 });
    graphics.moveTo(startX, startY);
    graphics.lineTo(targetX, targetY);
    
    this.laserContainer.addChild(graphics);
    
    this.lasers.push({
      graphics,
      startX,
      startY,
      targetX,
      targetY,
      life: 6,
      maxLife: 6
    });
  }

  private updateEnemyText(enemy: EnemyShip) {
    const typedText = enemy.word.substring(0, enemy.typedCount);
    const remainingText = enemy.word.substring(enemy.typedCount);

    enemy.typedLabel.text = typedText;
    enemy.remainingLabel.text = remainingText;

    // Reposicionar para mantener el centrado
    // El typedLabel termina en X=0, remainingLabel empieza en X=0
    // Pixi alinea el texto según sus anclas automáticamente.
  }

  private destroyEnemy(enemy: EnemyShip) {
    // Sonido satisfactorio
    soundSystem.playExplosion();

    // Explosión de partículas más grande en la palabra
    this.particleSystem.explode(enemy.x, enemy.y + enemy.textOffsetY, enemy.color, 35);

    // Eliminar de la pantalla
    this.shipContainer.removeChild(enemy.container);
    this.enemies = this.enemies.filter((e) => e.id !== enemy.id);

    // Quitar target lock si era esta nave
    if (this.lockedEnemyId === enemy.id) {
      this.lockedEnemyId = null;
      this.targetReticle.visible = false;
    }

    // Calcular puntos y combo
    const comboMultiplier = this.getComboMultiplier();
    const points = enemy.word.length * 100 * comboMultiplier;
    this.score += points;
    this.wordsCompleted++;

    this.bridge.onScoreUpdate(this.score);

    // Incrementar progreso de apoyo táctico
    this.wordsCompletedForSupport++;
    if (this.wordsCompletedForSupport >= 30) {
      this.wordsCompletedForSupport = 0;
      this.supportCharges++;
      soundSystem.playLevelUp(); // Sonido heroico
      this.createFloatingText("¡APOYO LISTO! [ENTER]", window.innerWidth / 2, window.innerHeight - 180, 0x39ff14);
    }
    this.wordsUntilSupport = 30 - this.wordsCompletedForSupport;
    this.bridge.onSupportUpdate(this.supportCharges, this.wordsUntilSupport);

    // Puntos flotantes sobre la palabra
    this.createFloatingText(`+${points}`, enemy.x, enemy.y + enemy.textOffsetY - 10, 0x00f0ff);

    // Sacudida de pantalla al destruir nave
    this.triggerShake(8, 8);

    // Progresión de niveles
    const nextLevel = Math.floor(this.wordsCompleted / 10) + 1;
    if (nextLevel > this.level) {
      this.level = nextLevel;
      this.bridge.onLevelUpdate(this.level);
      soundSystem.playLevelUp();
      
      // Ajustar velocidad de spawn progresiva basándose en la dificultad inicial
      const baseInterval = 
        this.selectedSpeedSetting === "lento" ? 4000 :
        this.selectedSpeedSetting === "normal" ? 3200 :
        this.selectedSpeedSetting === "rapido" ? 2400 : 1600;
      this.spawnInterval = Math.max(800, baseInterval - (this.level - 1) * 250);
    }
  }

  public triggerSupportShip() {
    if (this.supportCharges <= 0) return;
    this.supportCharges--;
    this.wordsUntilSupport = 30 - this.wordsCompletedForSupport;
    this.bridge.onSupportUpdate(this.supportCharges, this.wordsUntilSupport);

    // Crear gráficos nave aliada
    const graphics = new Graphics();
    graphics.x = window.innerWidth / 2;
    graphics.y = window.innerHeight + 100;
    this.app.stage.addChild(graphics);

    this.alliedShip = {
      graphics,
      x: graphics.x,
      y: graphics.y,
      vy: -18,
      active: true
    };

    // Sonido de despliegue
    soundSystem.playLevelUp();

    // Sacudida de pantalla prolongada
    this.triggerShake(12, 40);

    // Destruir todos los enemigos en pantalla
    const enemiesToDestroy = [...this.enemies];
    for (const enemy of enemiesToDestroy) {
      // Láseres verdes
      this.createLaser(graphics.x, graphics.y - 30, enemy.x, enemy.y + enemy.textOffsetY, 0x39ff14);
      
      // Partículas
      this.particleSystem.explode(graphics.x, graphics.y - 30, 0x39ff14, 8);
      
      // Destruir sumando puntos
      this.destroyEnemy(enemy);
    }

    this.lockedEnemyId = null;
    this.targetReticle.visible = false;
  }

  public addSupportChargeCheat() {
    this.supportCharges++;
    this.bridge.onSupportUpdate(this.supportCharges, this.wordsUntilSupport);
    this.createFloatingText("CHEAT: +1 APOYO", window.innerWidth / 2, window.innerHeight - 250, 0x39ff14);
  }

  private getComboMultiplier(): number {
    if (this.combo >= 100) return 5;
    if (this.combo >= 50) return 4;
    if (this.combo >= 25) return 3;
    if (this.combo >= 10) return 2;
    return 1;
  }

  private spawnEnemy() {
    const word = obtenerPalabraPorNivel(this.level, this.selectedComplexitySetting);
    const id = Math.random().toString(36).substring(2, 9);
    
    // Determinar categoría y apariencia
    let type: "scout" | "cruiser" | "carrier";
    let color: number;
    let size: number;

    if (word.length <= 5) {
      type = "scout";
      color = 0x00f0ff; // Cyan
      size = 30;
    } else if (word.length <= 8) {
      type = "cruiser";
      color = 0xff007f; // Magenta
      size = 45;
    } else {
      type = "carrier";
      color = 0xffaa00; // Naranja
      size = 60;
    }

    // Posición horizontal aleatoria dentro del margen
    const margin = 80;
    const x = Math.random() * (window.innerWidth - margin * 2) + margin;
    const y = -50; // Empezar fuera de pantalla arriba

    // Velocidad base progresiva según nivel y multiplicador de dificultad inicial
    const baseSpeed = 0.8 + (this.level - 1) * 0.15;
    let speedMultiplier = 1.0;
    if (this.selectedSpeedSetting === "lento") {
      speedMultiplier = 0.65;
    } else if (this.selectedSpeedSetting === "normal") {
      speedMultiplier = 1.0;
    } else if (this.selectedSpeedSetting === "rapido") {
      speedMultiplier = 1.35;
    } else {
      speedMultiplier = 1.7; // extremo
    }
    const speed = baseSpeed * speedMultiplier * (Math.random() * 0.3 + 0.85);

    const container = new Container();
    container.x = x;
    container.y = y;

    // Gráficos de la nave
    const graphics = new Graphics();
    this.drawEnemyShip(graphics, type, color);
    container.addChild(graphics);

    // Texto de la palabra
    // Dividido en parte typed y parte restante para colorear por separado
    const typedStyle = {
      fontFamily: "Share Tech Mono",
      fontSize: 20,
      fontWeight: "bold" as const,
      fill: 0x39ff14, // Verde neón
      align: "right" as const,
    };

    const remainingStyle = {
      fontFamily: "Share Tech Mono",
      fontSize: 20,
      fontWeight: "bold" as const,
      fill: 0xffffff, // Blanco
      align: "left" as const,
    };

    const typedLabel = new Text({ text: "", style: typedStyle });
    const remainingLabel = new Text({ text: word, style: remainingStyle });

    // Alinear anclas para centrado perfecto
    typedLabel.anchor.set(1, 0.5);
    remainingLabel.anchor.set(0, 0.5);

    // Posicionar el texto debajo de la nave
    typedLabel.y = size / 2 + 15;
    remainingLabel.y = size / 2 + 15;
    typedLabel.x = -1; // Pequeño ajuste visual de separación
    remainingLabel.x = 1;

    container.addChild(typedLabel);
    container.addChild(remainingLabel);

    this.shipContainer.addChild(container);

    const textOffsetY = size / 2 + 15;

    const enemy: EnemyShip = {
      id,
      word,
      typedCount: 0,
      speed,
      x,
      y,
      color,
      type,
      container,
      graphics,
      typedLabel,
      remainingLabel,
      textOffsetY,
    };

    this.enemies.push(enemy);
    this.bridge.onEnemySpawn(word);
  }

  private drawEnemyShip(g: Graphics, type: "scout" | "cruiser" | "carrier", color: number) {
    g.clear();
    const now = performance.now();
    const flameHeight = 8 + Math.sin(now * 0.04 + (g as any).uid) * 4;

    if (type === "scout") {
      // Propulsor pequeño animado
      g.moveTo(-3, 6);
      g.lineTo(0, 6 + flameHeight);
      g.lineTo(3, 6);
      g.closePath();
      g.fill({ color: 0xffaa00, alpha: 0.9 });
      g.moveTo(-1.5, 6);
      g.lineTo(0, 6 + flameHeight * 0.6);
      g.lineTo(1.5, 6);
      g.closePath();
      g.fill({ color: 0xffffff, alpha: 0.95 });

      // Caza ligero (triángulo afilado)
      g.moveTo(0, -16);
      g.lineTo(12, 8);
      g.lineTo(0, 4);
      g.lineTo(-12, 8);
      g.closePath();
      g.fill({ color });

      // Bordes neón
      g.moveTo(0, -16).lineTo(12, 8).stroke({ color: 0xffffff, width: 1, alpha: 0.4 });
      g.moveTo(0, -16).lineTo(-12, 8).stroke({ color: 0xffffff, width: 1, alpha: 0.4 });

    } else if (type === "cruiser") {
      // Doble motor posterior animado
      g.moveTo(-7, 8);
      g.lineTo(-5.5, 8 + flameHeight * 0.8);
      g.lineTo(-4, 8);
      g.closePath();
      g.fill({ color: 0x00f0ff, alpha: 0.9 });

      g.moveTo(4, 8);
      g.lineTo(5.5, 8 + flameHeight * 0.8);
      g.lineTo(7, 8);
      g.closePath();
      g.fill({ color: 0x00f0ff, alpha: 0.9 });

      // Crucero mediano (forma de flecha con alerones)
      g.moveTo(0, -24);
      g.lineTo(16, -4);
      g.lineTo(12, 14);
      g.lineTo(0, 6);
      g.lineTo(-12, 14);
      g.lineTo(-16, -4);
      g.closePath();
      g.fill({ color });

      // Detalles estéticos
      g.rect(-6, -4, 12, 4).fill({ color: 0x9d00ff });
      g.circle(0, 0, 4).fill({ color: 0xffffff });

    } else {
      // Tres motores animados
      g.moveTo(-13, 16);
      g.lineTo(-11, 16 + flameHeight);
      g.lineTo(-9, 16);
      g.closePath();
      g.fill({ color: 0xff007f, alpha: 0.95 });

      g.moveTo(-2, 16);
      g.lineTo(0, 16 + flameHeight * 1.2);
      g.lineTo(2, 16);
      g.closePath();
      g.fill({ color: 0xff007f, alpha: 0.95 });

      g.moveTo(9, 16);
      g.lineTo(11, 16 + flameHeight);
      g.lineTo(13, 16);
      g.closePath();
      g.fill({ color: 0xff007f, alpha: 0.95 });

      // Cabina brillante
      g.moveTo(-1, 16).lineTo(0, 16 + flameHeight * 0.7).lineTo(1, 16).closePath().fill({ color: 0xffffff });

      // Nave nodriza gigante (hexágono reforzado)
      g.moveTo(0, -32);
      g.lineTo(26, -14);
      g.lineTo(20, 16);
      g.lineTo(-20, 16);
      g.lineTo(-26, -14);
      g.closePath();
      g.fill({ color });

      // Detalles estéticos
      g.rect(-12, -6, 24, 6).fill({ color: 0x03030d });
      g.circle(-8, -3, 2).fill({ color: 0x39ff14 });
      g.circle(8, -3, 2).fill({ color: 0x39ff14 });
    }
  }

  /**
   * Bucle de juego de PixiJS (corre a 60 FPS).
   */
  private update() {
    if (!this.isActive || !this.isInitialized) return;

    // PixiJS v8 ticker provee deltaTime en frames (normalizado a 1 a 60fps)
    const deltaTime = this.app.ticker.deltaTime;
    const now = performance.now();

    // Redibujar la nave del jugador para animar el propulsor
    this.drawPlayerShip();

    // Actualizar Nave de Apoyo Aliada
    if (this.alliedShip && this.alliedShip.active) {
      this.alliedShip.y += this.alliedShip.vy * deltaTime;
      this.alliedShip.graphics.y = this.alliedShip.y;

      // Animar propulsores gigantes de la nave aliada
      const flameHeight = 25 + Math.sin(now * 0.08) * 10;
      this.alliedShip.graphics.clear();
      
      // Propulsores
      this.alliedShip.graphics.moveTo(-10, 10);
      this.alliedShip.graphics.lineTo(-7, 10 + flameHeight);
      this.alliedShip.graphics.lineTo(-4, 10);
      this.alliedShip.graphics.closePath();
      this.alliedShip.graphics.fill({ color: 0xffaa00, alpha: 0.9 });
      this.alliedShip.graphics.moveTo(-8, 10);
      this.alliedShip.graphics.lineTo(-7, 10 + flameHeight * 0.6);
      this.alliedShip.graphics.lineTo(-6, 10);
      this.alliedShip.graphics.closePath();
      this.alliedShip.graphics.fill({ color: 0xffffff, alpha: 0.95 });

      this.alliedShip.graphics.moveTo(4, 10);
      this.alliedShip.graphics.lineTo(7, 10 + flameHeight);
      this.alliedShip.graphics.lineTo(10, 10);
      this.alliedShip.graphics.closePath();
      this.alliedShip.graphics.fill({ color: 0xffaa00, alpha: 0.9 });
      this.alliedShip.graphics.moveTo(5, 10);
      this.alliedShip.graphics.lineTo(7, 10 + flameHeight * 0.6);
      this.alliedShip.graphics.lineTo(9, 10);
      this.alliedShip.graphics.closePath();
      this.alliedShip.graphics.fill({ color: 0xffffff, alpha: 0.95 });

      // Cuerpo nave de apoyo
      this.alliedShip.graphics.moveTo(0, -50);
      this.alliedShip.graphics.lineTo(35, 15);
      this.alliedShip.graphics.lineTo(15, 10);
      this.alliedShip.graphics.lineTo(0, 25);
      this.alliedShip.graphics.lineTo(-15, 10);
      this.alliedShip.graphics.lineTo(-35, 15);
      this.alliedShip.graphics.closePath();
      this.alliedShip.graphics.fill({ color: 0x39ff14 });

      // Cabina
      this.alliedShip.graphics.rect(-6, -15, 12, 10).fill({ color: 0x03030d });
      this.alliedShip.graphics.circle(0, -10, 3).fill({ color: 0x00f0ff });

      // Si sale de la pantalla por arriba, destruir
      if (this.alliedShip.y < -150) {
        this.app.stage.removeChild(this.alliedShip.graphics);
        this.alliedShip.graphics.destroy();
        this.alliedShip.active = false;
        this.alliedShip = null;
      }
    }

    // 1. Spawning de naves enemigas
    this.spawnTimer += this.app.ticker.elapsedMS; // tiempo real transcurrido en ms
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnEnemy();
    }

    // 2. Actualizar Estrellas (Parallax)
    for (const star of this.stars) {
      star.y += star.speed * deltaTime;
      if (star.y > window.innerHeight) {
        star.y = -10;
        star.x = Math.random() * window.innerWidth;
      }
      star.graphics.y = star.y;
      star.graphics.x = star.x;
    }

    // 3. Actualizar Láseres
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const laser = this.lasers[i];
      laser.life -= deltaTime;
      if (laser.life <= 0) {
        this.laserContainer.removeChild(laser.graphics);
        this.lasers.splice(i, 1);
      } else {
        // Reducir la opacidad a medida que muere
        laser.graphics.alpha = laser.life / laser.maxLife;
      }
    }

    // 4. Actualizar Partículas
    this.particleSystem.update(deltaTime);

    // 5. Actualizar y Mover Enemigos (y animar sus motores)
    const boundaryY = window.innerHeight - 130; // Zona de impacto de escudo
    let targetEnemy: EnemyShip | null = null;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.y += enemy.speed * deltaTime;
      enemy.container.y = enemy.y;

      // Animar el motor del enemigo redibujando cada frame
      this.drawEnemyShip(enemy.graphics, enemy.type, enemy.color);

      // Guardar referencia del enemigo enfocado para actualizar el retículo
      if (enemy.id === this.lockedEnemyId) {
        targetEnemy = enemy;
      }

      // Colisión con escudo del jugador
      if (enemy.y >= boundaryY) {
        // Impacto!
        const damage = enemy.word.length * 2.5; // El daño escala con el tamaño de palabra
        this.shield -= damage;
        this.shield = Math.max(0, this.shield);
        this.bridge.onShieldUpdate(this.shield);

        // Explosión roja en el escudo
        this.particleSystem.explode(enemy.x, boundaryY, 0xff0000, 25);
        soundSystem.playError();

        // Texto flotante de daño recibido
        this.createFloatingText(`-${Math.round(damage)}%`, enemy.x, boundaryY - 20, 0xff0033);

        // Sacudida pesada de pantalla por el daño
        this.triggerShake(16, 12);

        // Limpiar enemigo
        this.shipContainer.removeChild(enemy.container);
        this.enemies.splice(i, 1);

        if (this.lockedEnemyId === enemy.id) {
          this.lockedEnemyId = null;
          this.targetReticle.visible = false;
        }

        // Game Over Check
        if (this.shield <= 0) {
          this.gameOver();
          return;
        }
      }
    }

    // 7. Sacudida de pantalla
    if (this.shakeDuration > 0) {
      this.shakeDuration -= deltaTime;
      const currentShake = this.shakeAmount * (this.shakeDuration / 10);
      this.app.stage.x = (Math.random() - 0.5) * currentShake;
      this.app.stage.y = (Math.random() - 0.5) * currentShake;
    } else {
      this.app.stage.x = 0;
      this.app.stage.y = 0;
    }

    // 8. Actualizar Textos Flotantes
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= deltaTime;
      if (ft.life <= 0) {
        this.hudContainer.removeChild(ft.text);
        this.floatingTexts.splice(i, 1);
      } else {
        ft.x += ft.vx * deltaTime;
        ft.y += ft.vy * deltaTime;
        ft.text.x = ft.x;
        ft.text.y = ft.y;
        ft.text.alpha = ft.life / ft.maxLife;
        // Animación de escala pequeña que encoge
        const scale = 0.85 + (ft.life / ft.maxLife) * 0.45;
        ft.text.scale.set(scale);
      }
    }

    // 6. Dibujar y posicionar Retículo de Objetivo Enfocado (Pulsante/Giratorio) y Línea Guía
    if (targetEnemy) {
      this.targetReticle.visible = true;
      this.targetReticle.x = targetEnemy.x;
      this.targetReticle.y = targetEnemy.y + targetEnemy.textOffsetY; // Centrado en la palabra
      
      // Rotar y pulsar retículo
      this.targetReticle.rotation += 0.04 * deltaTime;
      const size = 32 + Math.sin(now * 0.01) * 3; // Tamaño compacto adecuado para enmarcar la palabra
      this.drawTargetReticle(size);

      // Dibujar línea de guía desde la nave hasta la palabra
      this.drawTargetLine(this.playerX, this.playerY - 20, targetEnemy.x, targetEnemy.y + targetEnemy.textOffsetY, targetEnemy.color);
    } else {
      this.targetReticle.visible = false;
      if (this.targetLineGraphics) {
        this.targetLineGraphics.clear();
      }
    }
  }

  private drawTargetLine(startX: number, startY: number, targetX: number, targetY: number, color: number) {
    this.targetLineGraphics.clear();
    
    // 1. Línea base semi-transparente muy tenue
    this.targetLineGraphics.stroke({ color, width: 1, alpha: 0.2 });
    this.targetLineGraphics.moveTo(startX, startY);
    this.targetLineGraphics.lineTo(targetX, targetY);

    // 2. Pequeños flujos de energía (puntos) viajando desde el cañón del jugador hasta la palabra
    const now = performance.now();
    const dotsCount = 4;
    const dx = targetX - startX;
    const dy = targetY - startY;

    // Velocidad del flujo de energía
    const flowProgress = (now * 0.002) % 1.0;

    for (let i = 0; i < dotsCount; i++) {
      const t = (flowProgress + i / dotsCount) % 1.0;
      const dotX = startX + dx * t;
      const dotY = startY + dy * t;
      
      // Los puntos brillan más cuando recién salen del cañón y se atenúan al llegar
      this.targetLineGraphics.circle(dotX, dotY, 2).fill({ color, alpha: (1 - t) * 0.8 });
    }
  }

  private gameOver() {
    this.isActive = false;
    soundSystem.playGameOver();
    this.bridge.onGameOver(this.score);
  }

  public handleResize() {
    if (!this.isInitialized) return;
    this.playerX = window.innerWidth / 2;
    this.playerY = window.innerHeight - 80;
    this.playerGraphics.x = this.playerX;
    this.playerGraphics.y = this.playerY;
  }

  public destroy() {
    this.isActive = false;
    this.isDestroyed = true;
    
    // Limpiar textos flotantes al destruir
    if (this.floatingTexts) {
      for (const ft of this.floatingTexts) {
        try {
          this.hudContainer.removeChild(ft.text);
        } catch (e) {}
      }
      this.floatingTexts = [];
    }

    // Limpiar nave aliada al destruir
    if (this.alliedShip) {
      try {
        this.app.stage.removeChild(this.alliedShip.graphics);
        this.alliedShip.graphics.destroy();
      } catch (e) {}
      this.alliedShip = null;
    }

    if (this.isInitialized && this.app) {
      try {
        if (this.app.ticker) {
          this.app.ticker.remove(this.update, this);
        }
        if (this.app.stage) {
          this.app.stage.destroy({ children: true });
        }
        this.app.destroy({ removeView: true });
      } catch (e) {
        console.error("Error destruyendo la app PixiJS:", e);
      }
    }
  }
}
