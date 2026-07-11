import { Container, Graphics } from "pixi.js";

interface ParticleData {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: number;
  size: number;
  life: number;
  maxLife: number;
  active: boolean;
}

export class ParticleSystem {
  private pool: ParticleData[] = [];
  private particles: ParticleData[] = [];
  private graphics: Graphics;

  constructor(parent: Container) {
    this.graphics = new Graphics();
    parent.addChild(this.graphics);
    
    // Pre-asignar 1000 partículas en el pool
    for (let i = 0; i < 1000; i++) {
      this.pool.push({
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        color: 0xffffff,
        size: 0,
        life: 0,
        maxLife: 0,
        active: false,
      });
    }
  }

  /**
   * Obtiene una partícula libre del pool.
   */
  private spawnParticle(
    x: number,
    y: number,
    vx: number,
    vy: number,
    color: number,
    size: number,
    maxLife: number
  ) {
    let p = this.pool.find((item) => !item.active);
    if (!p) {
      // Si el pool está lleno, expandir dinámicamente
      p = {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        color: 0xffffff,
        size: 0,
        life: 0,
        maxLife: 0,
        active: false,
      };
      this.pool.push(p);
    }

    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.color = color;
    p.size = size;
    p.life = maxLife;
    p.maxLife = maxLife;
    p.active = true;

    this.particles.push(p);
  }

  /**
   * Genera una explosión en una coordenada específica.
   */
  public explode(x: number, y: number, color: number = 0xff00ff, count: number = 25) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 2; // Velocidad de la chispa
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const size = Math.random() * 3 + 2; // Tamaño de 2 a 5
      const maxLife = Math.random() * 30 + 20; // 20-50 frames de vida

      this.spawnParticle(x, y, vx, vy, color, size, maxLife);
    }
  }

  /**
   * Genera un destello de partículas rápidas (muzzle flash) hacia arriba al disparar.
   */
  public flash(x: number, y: number, color: number) {
    for (let i = 0; i < 6; i++) {
      const vx = (Math.random() - 0.5) * 3;
      const vy = -Math.random() * 6 - 4; // Impulso hacia arriba rápido
      const size = Math.random() * 2 + 1.5;
      const maxLife = Math.random() * 10 + 6;
      this.spawnParticle(x, y, vx, vy, color, size, maxLife);
    }
  }

  /**
   * Actualiza y dibuja las partículas activas.
   */
  public update(deltaTime: number) {
    // 1. Limpiar gráficos anteriores
    this.graphics.clear();

    // Filtramos las partículas activas y las actualizamos
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (!p.active) continue;

      // Actualizar física
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      
      // Aplicar fricción espacial
      p.vx *= 0.95;
      p.vy *= 0.95;

      // Reducir vida
      p.life -= deltaTime;

      if (p.life <= 0) {
        p.active = false;
        this.particles.splice(i, 1);
        continue;
      }

      // Dibujar la partícula con opacidad decreciente
      const alpha = p.life / p.maxLife;
      
      // PixiJS v8 Graphics drawing format: circle().fill({ color, alpha })
      this.graphics.circle(p.x, p.y, p.size).fill({ color: p.color, alpha });
    }
  }

  /**
   * Resetea el sistema de partículas limpiando las activas.
   */
  public clear() {
    this.graphics.clear();
    for (const p of this.particles) {
      p.active = false;
    }
    this.particles = [];
  }
}
