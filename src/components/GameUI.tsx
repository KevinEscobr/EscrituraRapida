import React, { useState, useEffect } from "react";
import { Volume2, VolumeX, Shield, Flame, Trophy, Play, RotateCcw, Home, Pause } from "lucide-react";

interface GameUIProps {
  gameState: "menu" | "playing" | "paused" | "gameover";
  score: number;
  shield: number;
  combo: number;
  level: number;
  onStartGame: (
    speedSetting?: "lento" | "normal" | "rapido" | "extremo", 
    complexitySetting?: "basico" | "intermedio" | "avanzado" | "progresivo"
  ) => void;
  onReturnToMenu: () => void;
  onTogglePause: () => void;
  mute: boolean;
  onToggleMute: () => void;
  supportCharges: number;
  supportWordsLeft: number;
  onTriggerSupport: () => void;
}

interface HighScore {
  score: number;
  level: number;
  date: string;
}

export const GameUI: React.FC<GameUIProps> = ({
  gameState,
  score,
  shield,
  combo,
  level,
  onStartGame,
  onReturnToMenu,
  onTogglePause,
  mute,
  onToggleMute,
  supportCharges,
  supportWordsLeft,
  onTriggerSupport,
}) => {
  const [highScores, setHighScores] = useState<HighScore[]>([]);
  const [initialSpeed, setInitialSpeed] = useState<"lento" | "normal" | "rapido" | "extremo">("normal");
  const [complexity, setComplexity] = useState<"basico" | "intermedio" | "avanzado" | "progresivo">("progresivo");

  // Cargar puntuaciones locales
  useEffect(() => {
    const saved = localStorage.getItem("mecanografia_estelar_highscores");
    if (saved) {
      try {
        setHighScores(JSON.parse(saved));
      } catch (e) {
        console.error("Error cargando puntuaciones altas", e);
      }
    }
  }, [gameState]);

  // Guardar puntuación si estamos en gameover
  useEffect(() => {
    if (gameState === "gameover" && score > 0) {
      const newScore: HighScore = {
        score,
        level,
        date: new Date().toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit",
        }),
      };

      const saved = localStorage.getItem("mecanografia_estelar_highscores");
      let currentScores: HighScore[] = [];
      if (saved) {
        try {
          currentScores = JSON.parse(saved);
        } catch (e) {}
      }

      // Añadir y ordenar
      const updated = [...currentScores, newScore]
        .sort((a, b) => b.score - a.score)
        .slice(0, 5); // Guardar top 5

      localStorage.setItem("mecanografia_estelar_highscores", JSON.stringify(updated));
      setHighScores(updated);
    }
  }, [gameState, score, level]);

  const getComboMultiplier = (c: number) => {
    if (c >= 100) return "5x";
    if (c >= 50) return "4x";
    if (c >= 25) return "3x";
    if (c >= 10) return "2x";
    return "1x";
  };

  return (
    <div className="ui-layer">
      {/* MENÚ PRINCIPAL */}
      {gameState === "menu" && (
        <div className="overlay-screen">
          <div className="panel interactive">
            <h1 className="game-title">Impacto Estelar</h1>
            <p className="game-subtitle">Typing Space Shooter</p>

            {/* Opciones de Configuración */}
            <div className="settings-section">
              <div className="setting-group">
                <span className="setting-title">Velocidad Inicial</span>
                <div className="segmented-control">
                  {(["lento", "normal", "rapido", "extremo"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`segment-btn ${initialSpeed === s ? "active" : ""}`}
                      onClick={() => setInitialSpeed(s)}
                    >
                      {s === "lento" ? "Lento" : s === "normal" ? "Normal" : s === "rapido" ? "Rápido" : "Frenético"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="setting-group">
                <span className="setting-title">Complejidad de Palabras</span>
                <div className="segmented-control">
                  {(["basico", "intermedio", "avanzado", "progresivo"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`segment-btn ${complexity === c ? "active" : ""}`}
                      onClick={() => setComplexity(c)}
                    >
                      {c === "basico" ? "Fácil" : c === "intermedio" ? "Medio" : c === "avanzado" ? "Difícil" : "Progresivo"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button className="btn btn-primary" onClick={() => onStartGame(initialSpeed, complexity)}>
              <Play size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />
              Iniciar Misión
            </button>

            <button className="btn btn-secondary" onClick={onToggleMute}>
              {mute ? (
                <>
                  <VolumeX size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />
                  Activar Sonido
                </>
              ) : (
                <>
                  <Volume2 size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />
                  Desactivar Sonido
                </>
              )}
            </button>

            <div className="instructions">
              <p style={{ fontWeight: "bold", color: "#fff", marginBottom: "0.5rem" }}>
                INSTRUCCIONES DE VUELO:
              </p>
              <p>
                1. Las naves enemigas descienden con palabras en <b>español</b>.
              </p>
              <p>
                2. Presiona la <b>primera letra</b> de una palabra para fijar el blanco (<kbd>Target Lock</kbd>).
              </p>
              <p>
                3. Escribe el resto de las letras para destruirla.
              </p>
              <p>
                4. Las vocales con acento (<kbd>á, é, í, ó, ú, ü</kbd>) aceptan también su vocal sin acento (<kbd>a, e, i, o, u</kbd>). La <kbd>ñ</kbd> requiere su tecla respectiva.
              </p>
              <p style={{ marginTop: "0.5rem", color: "var(--color-primary)" }}>
                ¡El combo aumenta tu multiplicador de puntuación!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* JUGANDO - HUD */}
      {(gameState === "playing" || gameState === "paused") && (
        <>
          <div className="hud-header">
            {/* Puntuación y Nivel */}
            <div className="hud-group">
              <div className="hud-stat">
                <span className="stat-label">Puntos</span>
                <span className="stat-val">{score}</span>
              </div>
              <div className="hud-stat">
                <span className="stat-label">Nivel</span>
                <span className="stat-val" style={{ color: "var(--color-warning)" }}>
                  {level}
                </span>
              </div>
            </div>

            {/* Estado del Escudo */}
            <div className="hud-stat shield-container">
              <span className="stat-label" style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <Shield size={14} /> Escudo Base
              </span>
              <div className="shield-bar-outer" style={{ marginTop: 4 }}>
                <div
                  className={`shield-bar-inner ${shield <= 30 ? "low" : ""}`}
                  style={{ width: `${shield}%` }}
                />
              </div>
            </div>

            {/* Controles flotantes */}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {/* Botón de Pausa */}
              {gameState === "playing" && (
                <button
                  className="btn interactive"
                  style={{
                    padding: "0.4rem 0.8rem",
                    fontSize: "0.8rem",
                    margin: 0,
                    borderColor: "rgba(255,255,255,0.2)",
                  }}
                  onClick={onTogglePause}
                  title="Pausar juego (Esc)"
                >
                  <Pause size={14} />
                </button>
              )}
              {/* Mute flotante */}
              <button
                className="btn interactive"
                style={{
                  padding: "0.4rem 0.8rem",
                  fontSize: "0.8rem",
                  margin: 0,
                  borderColor: "rgba(255,255,255,0.2)",
                }}
                onClick={onToggleMute}
              >
                {mute ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
            </div>
          </div>

          {/* Indicador de Nave de Apoyo (Ataque Especial) */}
          <div 
            className="support-display interactive" 
            onClick={onTriggerSupport} 
            style={{ cursor: supportCharges > 0 ? "pointer" : "default" }}
            title={supportCharges > 0 ? "¡Presiona ENTER o haz clic aquí para desplegar la nave de apoyo!" : "Escribe palabras correctamente para cargar el apoyo táctico"}
          >
            <div className="support-status">
              <span className="support-label">APOYO TÁCTICO [ENTER]</span>
              <div className="charges-container">
                {[...Array(Math.max(1, supportCharges))].map((_, i) => (
                  <span 
                    key={i} 
                    className={`charge-indicator ${supportCharges > 0 ? "charged" : "empty"}`}
                  >
                    ⚡
                  </span>
                ))}
                {supportCharges > 0 && <span className="charges-count">x{supportCharges}</span>}
              </div>
            </div>
            
            <div className="support-progress-container">
              <div 
                className="support-progress-bar" 
                style={{ width: `${((30 - supportWordsLeft) / 30) * 100}%` }}
              />
              <span className="support-progress-text">
                {supportCharges > 0 ? "¡LISTO PARA DESPLEGAR!" : `${30 - supportWordsLeft}/30`}
              </span>
            </div>
          </div>

          {/* Combo flotante inferior */}
          {combo > 0 && (
            <div className="combo-display">
              <span className="combo-num">{combo}</span>
              <span className="combo-text">Combo</span>
              {combo >= 10 && (
                <span
                  className="stat-val multiplier"
                  style={{
                    fontSize: "1.2rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    marginTop: 4,
                  }}
                >
                  <Flame size={16} fill="currentColor" /> {getComboMultiplier(combo)}
                </span>
              )}
            </div>
          )}
        </>
      )}

      {/* PANTALLA PAUSA */}
      {gameState === "paused" && (
        <div className="overlay-screen">
          <div className="panel interactive">
            <h2 className="game-title" style={{ color: "var(--color-primary)", fontSize: "2.8rem" }}>
              Misión Pausada
            </h2>
            <p className="game-subtitle" style={{ marginBottom: "1.5rem" }}>
              Sistemas en modo de espera
            </p>

            <button className="btn btn-primary" onClick={onTogglePause}>
              <Play size={16} style={{ marginRight: 8, verticalAlign: "middle" }} />
              Reanudar (Esc)
            </button>

            <button className="btn btn-secondary" onClick={onReturnToMenu}>
              <Home size={16} style={{ marginRight: 8, verticalAlign: "middle" }} />
              Menú Principal
            </button>
          </div>
        </div>
      )}

      {/* PANTALLA GAME OVER */}
      {gameState === "gameover" && (
        <div className="overlay-screen">
          <div className="panel interactive">
            <h2 className="game-title" style={{ color: "var(--color-secondary)", fontSize: "2.8rem" }}>
              Misión Abortada
            </h2>
            <p className="game-subtitle" style={{ marginBottom: "1.5rem" }}>
              Tu escudo ha colapsado
            </p>

            <div className="hud-stat" style={{ marginBottom: "1.5rem", alignItems: "center" }}>
              <span className="stat-label">Puntuación Final</span>
              <span className="stat-val" style={{ fontSize: "2.5rem", color: "var(--color-primary)" }}>
                {score}
              </span>
            </div>

            {/* Tabla de Puntuaciones Altas */}
            <div style={{ width: "100%", marginBottom: "2rem" }}>
              <p
                style={{
                  fontFamily: "var(--font-logo)",
                  fontSize: "1rem",
                  color: "var(--color-text-muted)",
                  borderBottom: "1px solid rgba(255,255,255,0.15)",
                  paddingBottom: "0.4rem",
                  marginBottom: "0.6rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.4rem",
                }}
              >
                <Trophy size={16} color="gold" /> Salón de Honor
              </p>
              {highScores.length === 0 ? (
                <p style={{ fontSize: "0.9rem", color: "var(--color-text-muted)", textAlign: "center" }}>
                  Aún no hay puntuaciones registradas
                </p>
              ) : (
                highScores.map((hs, index) => {
                  const isCurrent = hs.score === score && hs.level === level;
                  return (
                    <div
                      key={index}
                      className={`score-row ${isCurrent ? "current-run" : ""}`}
                      style={{ fontSize: "0.95rem" }}
                    >
                      <span>
                        #{index + 1} - Lvl {hs.level}
                      </span>
                      <span>{hs.score} pts</span>
                      <span style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>{hs.date}</span>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ display: "flex", gap: "1rem" }}>
              <button className="btn btn-primary" onClick={() => onStartGame()}>
                <RotateCcw size={16} style={{ marginRight: 8, verticalAlign: "middle" }} />
                Reintentar
              </button>
              <button className="btn btn-secondary" onClick={onReturnToMenu}>
                <Home size={16} style={{ marginRight: 8, verticalAlign: "middle" }} />
                Menú
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
