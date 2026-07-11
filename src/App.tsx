import { useState, useEffect, useRef } from "react";
import { GameEngine, type GameBridge } from "./game/GameEngine";
import { GameUI } from "./components/GameUI";
import { soundSystem } from "./game/SoundSystem";

function App() {
  const [gameState, setGameState] = useState<"menu" | "playing" | "paused" | "gameover">("menu");
  const [score, setScore] = useState(0);
  const [shield, setShield] = useState(100);
  const [combo, setCombo] = useState(0);
  const [level, setLevel] = useState(1);
  const [mute, setMute] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const [supportCharges, setSupportCharges] = useState(0);
  const [supportWordsLeft, setSupportWordsLeft] = useState(30);
  const [speedSetting, setSpeedSetting] = useState<"lento" | "normal" | "rapido" | "extremo">("normal");
  const [complexitySetting, setComplexitySetting] = useState<"basico" | "intermedio" | "avanzado" | "progresivo">("progresivo");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // Inicializar o destruir el motor al montar
  useEffect(() => {
    if (!canvasRef.current) return;

    const bridge: GameBridge = {
      onScoreUpdate: (newScore) => setScore(newScore),
      onShieldUpdate: (newShield) => setShield(newShield),
      onComboUpdate: (newCombo) => setCombo(newCombo),
      onLevelUpdate: (newLevel) => setLevel(newLevel),
      onEnemySpawn: () => {},
      onGameOver: (finalScore) => {
        setScore(finalScore);
        setGameState("gameover");
      },
      onSupportUpdate: (charges, wordsLeft) => {
        setSupportCharges(charges);
        setSupportWordsLeft(wordsLeft);
      },
    };

    const engine = new GameEngine(canvasRef.current, bridge);
    engineRef.current = engine;

    // Manejar el redimensionamiento de ventana
    const handleResize = () => {
      engine.handleResize();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      engine.destroy();
    };
  }, []);

  // Mantener el foco en el input cuando se juega
  useEffect(() => {
    if (gameState === "playing") {
      // Retrasar el foco ligeramente para dar tiempo a que los overlays se oculten
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        setIsFocused(true);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [gameState]);

  // Escuchar teclas especiales (Escape para pausar, Enter para nave de apoyo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (gameState === "playing" || gameState === "paused") {
          e.preventDefault();
          handleTogglePause();
        }
      } else if (e.key === "Enter") {
        if (gameState === "playing" && supportCharges > 0) {
          e.preventDefault();
          handleTriggerSupport();
        }
      } else if (e.key === "+") {
        if (gameState === "playing") {
          e.preventDefault();
          engineRef.current?.addSupportChargeCheat();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [gameState, supportCharges]);

  const handleStartGame = (
    speed?: "lento" | "normal" | "rapido" | "extremo",
    complexity?: "basico" | "intermedio" | "avanzado" | "progresivo"
  ) => {
    const finalSpeed = speed || speedSetting;
    const finalComplexity = complexity || complexitySetting;

    if (speed) setSpeedSetting(speed);
    if (complexity) setComplexitySetting(complexity);

    setScore(0);
    setShield(100);
    setCombo(0);
    setLevel(1);
    setGameState("playing");
    engineRef.current?.startGame(finalSpeed, finalComplexity);
  };

  const handleReturnToMenu = () => {
    setGameState("menu");
    engineRef.current?.pauseGame();
  };

  const handleTogglePause = () => {
    if (gameState === "playing") {
      setGameState("paused");
      engineRef.current?.pauseGame();
    } else if (gameState === "paused") {
      setGameState("playing");
      engineRef.current?.resumeGame();
    }
  };

  const handleTriggerSupport = () => {
    if (gameState === "playing") {
      engineRef.current?.triggerSupportShip();
    }
  };

  const toggleMute = () => {
    const nextMute = soundSystem.toggleMute();
    setMute(nextMute);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length > 0 && engineRef.current) {
      // Enviar cada carácter ingresado al motor (por si se teclea muy rápido)
      for (let i = 0; i < value.length; i++) {
        engineRef.current.handleInput(value.charAt(i));
      }
      e.target.value = ""; // Limpiar el input oculto
    }
  };

  const handleInputBlur = () => {
    // Si el juego sigue activo, marcar foco como perdido
    // No forzar focus inmediato en blur para evitar bloqueos del navegador,
    // en su lugar mostramos la pantalla de "hacer clic para enfocar".
    setIsFocused(false);
  };

  const handleInputFocus = () => {
    setIsFocused(true);
  };

  const handleContainerClick = () => {
    if (gameState === "playing") {
      inputRef.current?.focus();
      setIsFocused(true);
    }
  };

  return (
    <div 
      className="game-container" 
      onClick={handleContainerClick}
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      {/* Input oculto para interceptar todo tipo de teclados */}
      <input
        ref={inputRef}
        type="text"
        className="hidden-input"
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        onFocus={handleInputFocus}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck="false"
      />

      {/* WebGL Canvas de PixiJS */}
      <canvas ref={canvasRef} id="game-canvas" />

      {/* Capa UI de React (HUD, Menús) */}
      <GameUI
        gameState={gameState}
        score={score}
        shield={shield}
        combo={combo}
        level={level}
        onStartGame={handleStartGame}
        onReturnToMenu={handleReturnToMenu}
        onTogglePause={handleTogglePause}
        mute={mute}
        onToggleMute={toggleMute}
        supportCharges={supportCharges}
        supportWordsLeft={supportWordsLeft}
        onTriggerSupport={handleTriggerSupport}
      />

      {/* Advertencia visual si el juego está activo pero el foco se pierde */}
      {gameState === "playing" && !isFocused && (
        <div className="focus-overlay interactive" onClick={handleContainerClick}>
          <h2 className="focus-title">MIRA DESALINEADA</h2>
          <p style={{ color: "var(--color-text-primary)" }}>Haz clic en la pantalla para enfocar tus cañones</p>
        </div>
      )}
    </div>
  );
}

export default App;
