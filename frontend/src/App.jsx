import { 
  useState, 
  useEffect, 
  useRef, 
  useCallback 
} from "react";
import { 
  Swords, 
  Trophy, 
  TrendingUp, 
  TrendingDown,
  Wallet2
} from "lucide-react";
import LeaderBoard from "./components/leader-board";
import submitBattleResult from "./stacks/contract-constants";
import WalletConnect from './components/WalletConnect';
import { submitBattleToBlockchain, getUserStats, getBattleCount } from './lib/stacksService';
import "./App.css";

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;
const PADDLE_WIDTH = 12;
const PADDLE_OFFSET = 40; // Distance from canvas edge
const BASE_PADDLE_HEIGHT = 100;
const BALL_SIZE = 15;
const BASE_SPEED = 10; // Increased from 6 to 10
const GAME_DURATION = 40000; // Increased to 40 seconds
const API_CALL_INTERVAL = 1000;
const TRAIL_LENGTH = 12; // Increased trail for faster movement

const CryptoPongBattle = () => {
  const [userPrediction, setUserPrediction] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [submittingToBlockchain, setSubmittingToBlockchain] = useState(false);
  const [blockchainTxId, setBlockchainTxId] = useState(null);
  const [coins, setCoins] = useState([]);
  const [isLoadingCoins, setIsLoadingCoins] = useState(true);
  const [coinA, setCoinA] = useState(null);
  const [coinB, setCoinB] = useState(null);
  const [priceData, setPriceData] = useState({});
  const [isRunning, setIsRunning] = useState(false);
  const [timer, setTimer] = useState(40);
  const [winner, setWinner] = useState(null);
  const [gameState, setGameState] = useState("idle");
  const [apiError, setApiError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [loadingHistorical, setLoadingHistorical] = useState(false);
  const [historicalData, setHistoricalData] = useState({
    coinA: [],
    coinB: [],
  });
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [finalScoreA, setFinalScoreA] = useState(0);
  const [finalScoreB, setFinalScoreB] = useState(0);
  const [replaySnapshot, setReplaySnapshot] = useState(null);

  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const lastApiCallRef = useRef(0);
  const ballTrailRef = useRef([]);
  const replayCanvasRef = useRef(null);
  const replayAnimationRef = useRef(null);
  const gameStateRef = useRef({
    balls: [
      {
        x: CANVAS_WIDTH / 2,
        y: CANVAS_HEIGHT / 2,
        velX: BASE_SPEED,
        velY: BASE_SPEED,
      },
    ],
    paddleAY: CANVAS_HEIGHT / 2 - BASE_PADDLE_HEIGHT / 2,
    paddleBY: CANVAS_HEIGHT / 2 - BASE_PADDLE_HEIGHT / 2,
    paddleAHeight: BASE_PADDLE_HEIGHT,
    paddleBHeight: BASE_PADDLE_HEIGHT,
    paddleASpeed: 1,
    paddleBSpeed: 1,
    priceChangePercentA: 0,
    priceChangePercentB: 0,
    priceDataIndex: 0,
    totalChangeA: 0,
    totalChangeB: 0,
    gameStartTime: null,
    endGameTriggered: false,
  });

  const rateLimitCheck = useCallback(() => {
    const now = Date.now();
    const timeSinceLastCall = now - lastApiCallRef.current;
    if (timeSinceLastCall < API_CALL_INTERVAL) {
      const waitTime = API_CALL_INTERVAL - timeSinceLastCall;
      return new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    lastApiCallRef.current = now;
    return Promise.resolve();
  }, []);

  useEffect(() => {
    const fetchCoins = async (attempt = 1) => {
      setIsLoadingCoins(true);
      setApiError(null);

      try {
        await rateLimitCheck();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(
          "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1",
          {
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0)
          throw new Error("Invalid data");

        const formattedCoins = data.map((coin) => ({
          id: coin.id,
          symbol: coin.symbol?.toUpperCase() || "UNKNOWN",
          name: coin.name || "Unknown Coin",
          image: coin.image,
        }));

        setCoins(formattedCoins);
        setRetryCount(0);

        const btc = formattedCoins.find((c) => c.symbol === "BTC");
        const eth = formattedCoins.find((c) => c.symbol === "ETH");
        if (btc) setCoinA(btc);
        if (eth) setCoinB(eth);
      } catch (error) {
        console.error(`[Coins Fetch] Attempt ${attempt}:`, error);
        if (attempt < 3) {
          setTimeout(() => {
            setRetryCount(attempt);
            fetchCoins(attempt + 1);
          }, Math.pow(2, attempt) * 1000);
        } else {
          setApiError(`Failed to load coins: ${error.message}`);
          const fallbackCoins = [
            { id: "bitcoin", symbol: "BTC", name: "Bitcoin", image: "" },
            { id: "ethereum", symbol: "ETH", name: "Ethereum", image: "" },
          ];
          setCoins(fallbackCoins);
          setCoinA(fallbackCoins[0]);
          setCoinB(fallbackCoins[1]);
        }
      } finally {
        setIsLoadingCoins(false);
      }
    };

    fetchCoins();
  }, [rateLimitCheck]);

  const fetchCurrentPrices = useCallback(
    async (attempt = 1) => {
      if (!coinA || !coinB) return;
      setLoadingPrices(true);

      try {
        await rateLimitCheck();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${coinA.id},${coinB.id}&vs_currencies=usd&include_24hr_change=true`,
          {
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!data[coinA.id] || !data[coinB.id])
          throw new Error("Price data missing");

        setPriceData(data);
        setRetryCount(0);
        setApiError(null);
      } catch (error) {
        console.error(`[Price Fetch] Attempt ${attempt}:`, error);
        if (attempt < 3) {
          setTimeout(() => {
            setRetryCount(attempt);
            fetchCurrentPrices(attempt + 1);
          }, Math.pow(2, attempt) * 1000);
        } else {
          setApiError(
            error.name === "AbortError"
              ? "Request timeout"
              : `Price fetch failed: ${error.message}`
          );
        }
      } finally {
        setLoadingPrices(false);
      }
    },
    [coinA, coinB, rateLimitCheck]
  );

  const fetchHistoricalData = async (coin, days = 1, attempt = 1) => {
    try {
      await rateLimitCheck();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/${coin.id}/market_chart?vs_currency=usd&days=${days}`,
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (
        !data.prices ||
        !Array.isArray(data.prices) ||
        data.prices.length === 0
      ) {
        throw new Error("No price history");
      }
      return data.prices;
    } catch (error) {
      if (attempt < 3) {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
        return fetchHistoricalData(coin, days, attempt + 1);
      } else {
        return generateFallbackData(days);
      }
    }
  };

  const generateFallbackData = (days) => {
    const dataPoints = days * 24;
    const basePrice = 50000;
    const data = [];
    for (let i = 0; i < dataPoints; i++) {
      const timestamp = Date.now() - (dataPoints - i) * (60 * 60 * 1000);
      const price = basePrice * (1 + (Math.random() - 0.5) * 0.1);
      data.push([timestamp, price]);
    }
    return data;
  };

  useEffect(() => {
    if (coinA && coinB) fetchCurrentPrices();
  }, [coinA, coinB, fetchCurrentPrices]);

  useEffect(() => {
    if (!coinA || !coinB) return;
    const interval = setInterval(() => fetchCurrentPrices(), 30000);
    return () => clearInterval(interval);
  }, [coinA, coinB, fetchCurrentPrices]);

  useEffect(() => {
    if (!isRunning) return;
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(
        0,
        Math.ceil((GAME_DURATION - elapsed) / 1000)
      );
      setTimer(remaining);
      if (remaining === 0 && !gameStateRef.current.endGameTriggered) {
        gameStateRef.current.endGameTriggered = true;
        clearInterval(interval);
        setTimeout(() => endGame(), 100);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    if (gameState === "battling" && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      animateGame(ctx);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [gameState, historicalData]);

  // Replay animation loop
  useEffect(() => {
    if (gameState === "ended" && replaySnapshot && replayCanvasRef.current) {
      const canvas = replayCanvasRef.current;
      const ctx = canvas.getContext("2d");
      let frame = 0;
      const maxFrames = 60;

      const animateReplay = () => {
        frame++;
        if (frame > maxFrames) frame = 0;

        const progress = frame / maxFrames;

        // Clear canvas
        ctx.fillStyle = "#2A6E40";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw center line
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, 0);
        ctx.lineTo(canvas.width / 2, canvas.height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Scale factor for smaller canvas
        const scale = canvas.width / CANVAS_WIDTH;

        // Animate ball moving toward losing side
        const ballX =
          winner === "A"
            ? replaySnapshot.ballX * scale +
              (canvas.width - replaySnapshot.ballX * scale) * progress
            : replaySnapshot.ballX * scale -
              replaySnapshot.ballX * scale * progress;
        const ballY = replaySnapshot.ballY * scale;

        // Draw paddles
        const paddleRadius = (PADDLE_WIDTH / 2) * scale;
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.roundRect(
          PADDLE_OFFSET * scale,
          replaySnapshot.paddleAY * scale,
          PADDLE_WIDTH * scale,
          replaySnapshot.paddleAHeight * scale,
          paddleRadius
        );
        ctx.fill();

        ctx.beginPath();
        ctx.roundRect(
          canvas.width - (PADDLE_OFFSET + PADDLE_WIDTH) * scale,
          replaySnapshot.paddleBY * scale,
          PADDLE_WIDTH * scale,
          replaySnapshot.paddleBHeight * scale,
          paddleRadius
        );
        ctx.fill();

        // Draw ball
        const ballRadius = (BALL_SIZE / 2) * scale;
        ctx.fillStyle = "#F5C542";
        ctx.beginPath();
        ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#E0A020";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
        ctx.stroke();

        replayAnimationRef.current = requestAnimationFrame(animateReplay);
      };

      animateReplay();

      return () => {
        if (replayAnimationRef.current) {
          cancelAnimationFrame(replayAnimationRef.current);
        }
      };
    }
  }, [gameState, replaySnapshot, winner]);

  const startGame = async () => {
    if (!coinA || !coinB) {
      alert("Please select both coins");
      return;
    }

    setLoadingHistorical(true);
    setApiError(null);

    try {
      const [dataA, dataB] = await Promise.all([
        fetchHistoricalData(coinA, 1),
        fetchHistoricalData(coinB, 1),
      ]);

      const sampleSize = 50;
      const sampledA = [];
      const sampledB = [];

      for (let i = 0; i < sampleSize; i++) {
        const index = Math.floor((i / sampleSize) * dataA.length);
        sampledA.push(dataA[index] || dataA[dataA.length - 1]);
        sampledB.push(dataB[index] || dataB[dataB.length - 1]);
      }

      setHistoricalData({ coinA: sampledA, coinB: sampledB });
      setIsRunning(true);
      setGameState("battling");
      setTimer(40);
      setWinner(null);
      setScoreA(0);
      setScoreB(0);
      setFinalScoreA(0);
      setFinalScoreB(0);

      gameStateRef.current = {
        balls: [
          {
            x: CANVAS_WIDTH / 2,
            y: CANVAS_HEIGHT / 2,
            velX: BASE_SPEED * (Math.random() > 0.5 ? 1 : -1),
            velY: BASE_SPEED * (Math.random() > 0.5 ? 1 : -1),
          },
        ],
        paddleAY: CANVAS_HEIGHT / 2 - BASE_PADDLE_HEIGHT / 2,
        paddleBY: CANVAS_HEIGHT / 2 - BASE_PADDLE_HEIGHT / 2,
        paddleAHeight: BASE_PADDLE_HEIGHT,
        paddleBHeight: BASE_PADDLE_HEIGHT,
        paddleASpeed: 1,
        paddleBSpeed: 1,
        priceChangePercentA: 0,
        priceChangePercentB: 0,
        priceDataIndex: 0,
        totalChangeA: 0,
        totalChangeB: 0,
        gameStartTime: Date.now(),
        endGameTriggered: false,
      };

      ballTrailRef.current = [];
    } catch (error) {
      setApiError("Failed to start battle. Please try again.");
    } finally {
      setLoadingHistorical(false);
    }
  };

  const endGame = async () => {
    setIsRunning(false);

    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    const state = gameStateRef.current;
    const changeA = state.totalChangeA;
    const changeB = state.totalChangeB;

    // Determine winner and award final point
    let winnerSide = null;
    let winnerCoin = '';
    
    if (Math.abs(changeA - changeB) < 0.5) {
      winnerSide = "TIE";
      winnerCoin = "TIE";
    } else if (changeA > changeB) {
      winnerSide = "A";
      winnerCoin = coinA?.symbol || "BTC";
      setScoreA((prev) => prev + 1);
    } else {
      winnerSide = "B";
      winnerCoin = coinB?.symbol || "ETH";
      setScoreB((prev) => prev + 1);
    }

    // Capture final scores after awarding point
    setTimeout(async () => {
      const finalA = winnerSide === "A" ? scoreA + 1 : scoreA;
      const finalB = winnerSide === "B" ? scoreB + 1 : scoreB;
      
      setFinalScoreA(finalA);
      setFinalScoreB(finalB);
      setWinner(winnerSide);
      setGameState("ended");

      // Capture replay snapshot
      setReplaySnapshot({
        ballX: state.balls[0].x,
        ballY: state.balls[0].y,
        paddleAY: state.paddleAY,
        paddleBY: state.paddleBY,
        paddleAHeight: state.paddleAHeight,
        paddleBHeight: state.paddleBHeight,
      });

      // Submit to blockchain if wallet is connected
      if (isWalletConnected && winnerSide !== "TIE") {
        try {
          const battleData = {
            coinA: coinA?.symbol || "BTC",
            coinB: coinB?.symbol || "ETH",
            winner: winnerCoin,
            performanceDelta: Math.abs(changeA - changeB),
            scoreA: finalA,
            scoreB: finalB,
          };

          console.log('Submitting battle to blockchain:', battleData);
          await submitBattleResult(battleData);
          
          // Show success notification
          alert('Battle recorded on blockchain! ✅');
        } catch (error) {
          console.error('Failed to submit battle:', error);
          // Only show alert if user didn't cancel
          if (error.message !== 'User canceled transaction') {
            alert('Failed to record battle on blockchain. Please try again.');
          }
        }
      }
    }, 50);
  };

  const resetGame = () => {
    setGameState("idle");
    setWinner(null);
    setScoreA(0);
    setScoreB(0);
    setFinalScoreA(0);
    setFinalScoreB(0);
    setTimer(40);
    setReplaySnapshot(null);
    if (replayAnimationRef.current) {
      cancelAnimationFrame(replayAnimationRef.current);
    }
    gameStateRef.current = {
      balls: [
        {
          x: CANVAS_WIDTH / 2,
          y: CANVAS_HEIGHT / 2,
          velX: BASE_SPEED,
          velY: BASE_SPEED,
        },
      ],
      paddleAY: CANVAS_HEIGHT / 2 - BASE_PADDLE_HEIGHT / 2,
      paddleBY: CANVAS_HEIGHT / 2 - BASE_PADDLE_HEIGHT / 2,
      paddleAHeight: BASE_PADDLE_HEIGHT,
      paddleBHeight: BASE_PADDLE_HEIGHT,
      paddleASpeed: 1,
      paddleBSpeed: 1,
      priceChangePercentA: 0,
      priceChangePercentB: 0,
      priceDataIndex: 0,
      totalChangeA: 0,
      totalChangeB: 0,
      gameStartTime: null,
      endGameTriggered: false,
    };
    ballTrailRef.current = [];
  };

  const animateGame = (ctx) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const state = gameStateRef.current;
    ctx.fillStyle = "#2A6E40";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.setLineDash([10, 10]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);

    const elapsed = Date.now() - state.gameStartTime;
    const progressRatio = elapsed / GAME_DURATION;
    const dataIndex = Math.floor(
      progressRatio * (historicalData.coinA.length - 1)
    );

    if (
      dataIndex !== state.priceDataIndex &&
      dataIndex < historicalData.coinA.length &&
      dataIndex >= 0
    ) {
      state.priceDataIndex = dataIndex;

      const priceA = historicalData.coinA[dataIndex]?.[1] || 0;
      const priceB = historicalData.coinB[dataIndex]?.[1] || 0;
      const firstPriceA = historicalData.coinA[0]?.[1] || priceA;
      const firstPriceB = historicalData.coinB[0]?.[1] || priceB;

      state.totalChangeA = ((priceA - firstPriceA) / firstPriceA) * 100;
      state.totalChangeB = ((priceB - firstPriceB) / firstPriceB) * 100;

      const prevPriceA =
        historicalData.coinA[Math.max(0, dataIndex - 1)]?.[1] || priceA;
      const prevPriceB =
        historicalData.coinB[Math.max(0, dataIndex - 1)]?.[1] || priceB;

      const changeA = ((priceA - prevPriceA) / prevPriceA) * 100;
      const changeB = ((priceB - prevPriceB) / prevPriceB) * 100;

      state.priceChangePercentA = changeA;
      state.priceChangePercentB = changeB;

      state.paddleAHeight = Math.max(
        60,
        Math.min(160, BASE_PADDLE_HEIGHT + state.totalChangeA * 5)
      );
      state.paddleBHeight = Math.max(
        60,
        Math.min(160, BASE_PADDLE_HEIGHT + state.totalChangeB * 5)
      );
      state.paddleASpeed = 1 + Math.abs(changeA) / 5;
      state.paddleBSpeed = 1 + Math.abs(changeB) / 5;

      const volatilityA = Math.abs(changeA);
      const volatilityB = Math.abs(changeB);
      const totalVolatility = volatilityA + volatilityB;

      state.balls.forEach((ball) => {
        const momentumFactor = 1 + totalVolatility / 30;
        const direction = ball.velX > 0 ? 1 : -1;
        ball.velX = direction * BASE_SPEED * momentumFactor;
      });
    }

    state.balls.forEach((ball) => {
      // Add current position to trail
      ballTrailRef.current.push({ x: ball.x, y: ball.y });
      if (ballTrailRef.current.length > TRAIL_LENGTH) {
        ballTrailRef.current.shift();
      }

      ball.x += ball.velX;
      ball.y += ball.velY;

      if (ball.y <= BALL_SIZE / 2 || ball.y >= CANVAS_HEIGHT - BALL_SIZE / 2) {
        ball.velY = -ball.velY;
      }

      // Paddle collision with updated positions
      if (
        ball.x - BALL_SIZE / 2 <= PADDLE_OFFSET + PADDLE_WIDTH &&
        ball.y >= state.paddleAY &&
        ball.y <= state.paddleAY + state.paddleAHeight &&
        !state.endGameTriggered
      ) {
        ball.velX = Math.abs(ball.velX);
        const hitPos = (ball.y - state.paddleAY) / state.paddleAHeight - 0.5;
        ball.velY = hitPos * BASE_SPEED * 2;
      }

      if (
        ball.x + BALL_SIZE / 2 >= CANVAS_WIDTH - PADDLE_OFFSET - PADDLE_WIDTH &&
        ball.y >= state.paddleBY &&
        ball.y <= state.paddleBY + state.paddleBHeight &&
        !state.endGameTriggered
      ) {
        ball.velX = -Math.abs(ball.velX);
        const hitPos = (ball.y - state.paddleBY) / state.paddleBHeight - 0.5;
        ball.velY = hitPos * BASE_SPEED * 2;
      }

      if (ball.x <= 0) {
        setScoreB((prev) => prev + 1);
        ball.x = CANVAS_WIDTH / 2;
        ball.y = CANVAS_HEIGHT / 2;
        ball.velX = BASE_SPEED;
        ball.velY = BASE_SPEED * (Math.random() > 0.5 ? 1 : -1);
        ballTrailRef.current = [];
      } else if (ball.x >= CANVAS_WIDTH) {
        setScoreA((prev) => prev + 1);
        ball.x = CANVAS_WIDTH / 2;
        ball.y = CANVAS_HEIGHT / 2;
        ball.velX = -BASE_SPEED;
        ball.velY = BASE_SPEED * (Math.random() > 0.5 ? 1 : -1);
        ballTrailRef.current = [];
      }

      // Draw trail
      ballTrailRef.current.forEach((pos, index) => {
        const alpha = (index + 1) / TRAIL_LENGTH;
        const trailSize = BALL_SIZE * (0.3 + alpha * 0.7);

        ctx.fillStyle = `rgba(245, 197, 66, ${alpha * 0.3})`;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, trailSize / 2, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw ball with 2D cartoon style (flat with outline)
      ctx.fillStyle = "#F5C542";
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();

      // Add outline/border
      ctx.strokeStyle = "#E0A020";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_SIZE / 2, 0, Math.PI * 2);
      ctx.stroke();

      // Add highlight for cartoon effect
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.beginPath();
      ctx.arc(
        ball.x - BALL_SIZE / 6,
        ball.y - BALL_SIZE / 6,
        BALL_SIZE / 4,
        0,
        Math.PI * 2
      );
      ctx.fill();
    });

    if (!state.endGameTriggered) {
      const closestBallA = state.balls.reduce((closest, ball) => {
        if (ball.x < CANVAS_WIDTH / 2 && ball.velX < 0) {
          return !closest || ball.x < closest.x ? ball : closest;
        }
        return closest;
      }, null);

      const closestBallB = state.balls.reduce((closest, ball) => {
        if (ball.x > CANVAS_WIDTH / 2 && ball.velX > 0) {
          return !closest || ball.x > closest.x ? ball : closest;
        }
        return closest;
      }, null);

      if (closestBallA) {
        const targetA = closestBallA.y - state.paddleAHeight / 2;
        const distance = Math.abs(
          closestBallA.x - (PADDLE_OFFSET + PADDLE_WIDTH)
        );
        const urgency = Math.max(0.1, 1 - distance / (CANVAS_WIDTH / 2));
        state.paddleAY +=
          (targetA - state.paddleAY) * 0.25 * state.paddleASpeed * urgency; // Increased from 0.15 to 0.25
      }

      if (closestBallB) {
        const targetB = closestBallB.y - state.paddleBHeight / 2;
        const distance = Math.abs(
          closestBallB.x - (CANVAS_WIDTH - PADDLE_OFFSET - PADDLE_WIDTH)
        );
        const urgency = Math.max(0.1, 1 - distance / (CANVAS_WIDTH / 2));
        state.paddleBY +=
          (targetB - state.paddleBY) * 0.25 * state.paddleBSpeed * urgency; // Increased from 0.15 to 0.25
      }
    }

    state.paddleAY = Math.max(
      0,
      Math.min(CANVAS_HEIGHT - state.paddleAHeight, state.paddleAY)
    );
    state.paddleBY = Math.max(
      0,
      Math.min(CANVAS_HEIGHT - state.paddleBHeight, state.paddleBY)
    );

    // Draw paddles with rounded edges (white)
    const paddleRadius = PADDLE_WIDTH / 2;

    // Left paddle (Coin A)
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.roundRect(
      PADDLE_OFFSET,
      state.paddleAY,
      PADDLE_WIDTH,
      state.paddleAHeight,
      paddleRadius
    );
    ctx.fill();

    // Right paddle (Coin B)
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.roundRect(
      CANVAS_WIDTH - PADDLE_OFFSET - PADDLE_WIDTH,
      state.paddleBY,
      PADDLE_WIDTH,
      state.paddleBHeight,
      paddleRadius
    );
    ctx.fill();

    animationRef.current = requestAnimationFrame(() => animateGame(ctx));
  };

  const formatPrice = (coinId) => {
    const price = priceData[coinId]?.usd;
    return price
      ? `$${price.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : "$0.00";
  };

  const formatChange = (coinId) => {
    const change = priceData[coinId]?.usd_24h_change;
    return change || 0;
  };

  return (
    <div className="min-h-screen bg-white p-4 sm:p-8">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Orbitron:wght@400;700&display=swap');
        
        body {
          font-family: 'Press Start 2P', monospace;
        }
        
        .body-text {
          font-family: 'Press Start 2P', monospace;
          font-size: 0.75rem;
          line-height: 1.5;
        }
        
        .heading-font {
          font-family: 'Orbitron', monospace;
          font-weight: 700;
          letter-spacing: 0.05em;
        }
      `}</style>

      <div className="max-w-7xl mx-auto">
        <h1 className="heading-font mt-10 text-2xl sm:text-3xl md:text-4xl text-black text-center mb-4 sm:mb-8 tracking-wider">
          CRYPTO PONG BATTLE
        </h1>
        <WalletConnect />

        {/* {apiError && (
          <div className="mb-4 p-3 bg-[#FF7676]/20 border-2 border-[#FF7676] rounded text-[#FF7676] text-sm">
            {apiError}
          </div>
        )} */}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Panel - Mobile: Below canvas */}
          <div className="lg:col-span-3 order-2 lg:order-1 space-y-4">
            {/* Battle Settings - Compact on Mobile */}
            <div className="bg-[#26462F] rounded border-2 border-[#3BA76F] p-3 sm:p-4">
              <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-1">
                {/* Coin A */}
                <div>
                  <label className="block text-white text-xs mb-1">
                    Coin A
                  </label>
                  <select
                    value={coinA?.id || ""}
                    onChange={(e) =>
                      setCoinA(coins.find((c) => c.id === e.target.value))
                    }
                    disabled={
                      isRunning || isLoadingCoins || gameState === "ended"
                    }
                    className="w-full bg-[#1F2E1F] text-white border-2 border-[#3BA76F] rounded p-1.5 sm:p-2 text-xs focus:outline-none focus:border-[#F5C542] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoadingCoins ? (
                      <option>Loading...</option>
                    ) : (
                      coins.map((coin) => (
                        <option key={coin.id} value={coin.id}>
                          {coin.symbol}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Coin B */}
                <div>
                  <label className="block text-white text-xs mb-1">
                    Coin B
                  </label>
                  <select
                    value={coinB?.id || ""}
                    onChange={(e) =>
                      setCoinB(coins.find((c) => c.id === e.target.value))
                    }
                    disabled={
                      isRunning || isLoadingCoins || gameState === "ended"
                    }
                    className="w-full bg-[#1F2E1F] text-white border-2 border-[#3BA76F] rounded p-1.5 sm:p-2 text-xs focus:outline-none focus:border-[#F5C542] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoadingCoins ? (
                      <option>Loading...</option>
                    ) : (
                      coins.map((coin) => (
                        <option key={coin.id} value={coin.id}>
                          {coin.symbol}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/*Prediction Div*/}
              <div>
                <p>ENTER YOUR PREDICTION</p>
                <input 
                  disabled={
                    isRunning || isLoadingCoins || gameState === "ended"
                  }
                  type="text" 
                  value={userPrediction} 
                  onChange={(e) => setUserPrediction(e.target.value)}
                />
              </div>

              {/* Button */}
              {gameState === "ended" ? (
                <button
                  onClick={resetGame}
                  className="w-full mt-3 bg-[#3BA76F] hover:brightness-110 text-white py-2 sm:py-3 rounded transition-all text-xs font-bold border-2 border-[#3BA76F]"
                >
                  NEW BATTLE
                </button>
              ) : (
                <button
                  onClick={startGame}
                  disabled={isRunning || isLoadingCoins || loadingHistorical}
                  className="w-full mt-3 bg-[#3BA76F] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 sm:py-3 rounded transition-all text-xs font-bold border-2 border-[#3BA76F]"
                >
                  {loadingHistorical
                    ? "LOADING..."
                    : isRunning
                    ? "BATTLING"
                    : "START"}
                </button>
              )}
            </div>

            {/* Live Prices - Horizontal on Mobile */}
            <div className="bg-[#26462F] rounded border-2 border-[#3BA76F] p-3 sm:p-4">
              <div className="flex flex-rowjustify-between items-center mb-2">
                <span className="text-white text-xs">Live Prices</span>
                {loadingPrices && (
                  <div className="w-2 h-2 bg-[#F5C542] rounded-full animate-pulse"></div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-1 gap-3">
                {/* Coin A Price */}
                <div className="text-center lg:text-left">
                  <div className="text-[#A8F0A2] text-xs mb-1">
                    {coinA?.symbol || "BTC"}
                  </div>
                  <div className="text-white text-sm sm:text-lg font-bold">
                    {formatPrice(coinA?.id)}
                  </div>
                  <div
                    className={`flex items-center justify-center lg:justify-start gap-1 text-xs ${
                      formatChange(coinA?.id) >= 0
                        ? "text-[#A8F0A2]"
                        : "text-[#FF7676]"
                    }`}
                  >
                    {formatChange(coinA?.id) >= 0 ? (
                      <TrendingUp size={10} />
                    ) : (
                      <TrendingDown size={10} />
                    )}
                    {Math.abs(formatChange(coinA?.id)).toFixed(2)}%
                  </div>
                </div>

                {/* Coin B Price */}
                <div className="text-center lg:text-left border-l lg:border-l-0 lg:border-t border-[#3BA76F] pl-3 lg:pl-0 lg:pt-3">
                  <div className="text-[#F5C542] text-xs mb-1">
                    {coinB?.symbol || "ETH"}
                  </div>
                  <div className="text-white text-sm sm:text-lg font-bold">
                    {formatPrice(coinB?.id)}
                  </div>
                  <div
                    className={`flex items-center justify-center lg:justify-start gap-1 text-xs ${
                      formatChange(coinB?.id) >= 0
                        ? "text-[#A8F0A2]"
                        : "text-[#FF7676]"
                    }`}
                  >
                    {formatChange(coinB?.id) >= 0 ? (
                      <TrendingUp size={10} />
                    ) : (
                      <TrendingDown size={10} />
                    )}
                    {Math.abs(formatChange(coinB?.id)).toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Center Panel - Mobile: First priority */}
          <div className="lg:col-span-6 order-1 lg:order-2 space-y-4">
            {gameState === "battling" && (
              <div className="flex flex-row sm:flex-row justify-between items-start px-2 sm:px-2 gap-1 sm:gap-0">
                <div className="text-center">
                  <div className="text-[#A8F0A2] text-sm sm:text-lg font-bold">
                    {coinA?.symbol || "BTC"}
                  </div>
                  <div className="text-[#9EB39F] text-xs">
                    {gameStateRef.current.totalChangeA?.toFixed(2) || "0.00"}%
                  </div>
                  <div className="text-white text-xl sm:text-2xl font-bold">
                    {scoreA}
                  </div>
                </div>

                <div className="bg-[#1F2E1F] border-2 border-[#3BA76F] px-4 sm:px-8 py-2 sm:py-3 rounded">
                  <div className="text-white text-2xl sm:text-3xl font-bold">
                    {timer}:00
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-[#F5C542] text-sm sm:text-lg font-bold">
                    {coinB?.symbol || "ETH"}
                  </div>
                  <div className="text-[#9EB39F] text-xs">
                    {gameStateRef.current.totalChangeB?.toFixed(2) || "0.00"}%
                  </div>
                  <div className="text-white text-xl sm:text-2xl font-bold">
                    {scoreB}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-[#1F4A54] rounded border-4 border-[#26462F] overflow-hidden shadow-xl">
              {gameState === "idle" && (
                <div className="aspect-[3/2] flex flex-col items-center justify-center bg-[#2A6E40] p-4">
                  <Swords
                    size={60}
                    className="sm:w-20 sm:h-20 text-white mb-4 sm:mb-6"
                    strokeWidth={1.5}
                  />
                  <div className="heading-font text-white text-xl sm:text-3xl mb-2 text-center">
                    Start a Battle
                  </div>
                  <div className="text-[#9EB39F] text-xs sm:text-sm text-center">
                    Select coins and press START
                  </div>
                </div>
              )}

              {gameState === "battling" && (
                <canvas
                  ref={canvasRef}
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                  className="w-full"
                />
              )}

              {gameState === "ended" && (
                <div className="aspect-[3/2] flex flex-col items-center justify-center bg-[#2A6E40] p-4 sm:p-8">
                  {/* Trophy Icon - Visual Hierarchy Top */}
                  <Trophy
                    size={48}
                    className="sm:w-16 sm:h-16 text-[#F5C542] mb-3 sm:mb-4"
                    strokeWidth={1.5}
                  />

                  {/* Winner Announcement - Primary Focus */}
                  <div className="text-center mb-4 sm:mb-6">
                    <div className="heading-font text-[#9EB39F] text-xs sm:text-sm mb-2">
                      WINNER
                    </div>
                    <div className="heading-font text-[#F5C542] text-4xl sm:text-6xl mb-2 sm:mb-3">
                      {winner === "TIE"
                        ? "TIE"
                        : winner === "A"
                        ? coinA?.symbol
                        : coinB?.symbol}
                    </div>
                    <div className="text-white text-xl sm:text-2xl font-bold mb-2">
                      {finalScoreA} - {finalScoreB}
                    </div>
                    <div className="text-[#9EB39F] text-xs sm:text-sm">
                      {winner === "TIE"
                        ? "Equal Performance"
                        : `${(winner === "A"
                            ? gameStateRef.current.totalChangeA
                            : gameStateRef.current.totalChangeB
                          )?.toFixed(2)}% Price Change`}
                    </div>
                  </div>

                  {/* Replay TV Box - Secondary Element */}
                  {winner !== "TIE" && replaySnapshot && (
                    <div className="flex flex-col items-center w-full max-w-xs">
                      <div className="text-[#A8F0A2] text-xs mb-2 tracking-wider">
                        ▶ WINNING MOMENT
                      </div>
                      <div className="border-4 border-[#1F2E1F] rounded-lg overflow-hidden bg-[#1F2E1F] shadow-xl w-full">
                        <canvas
                          ref={replayCanvasRef}
                          width={180}
                          height={120}
                          className="w-full"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Mobile: Last */}
          <div className="lg:col-span-3 order-3">
            <div className="bg-[#26462F] rounded border-2 border-[#3BA76F] p-4">
              <div className="heading-font text-white text-sm mb-4">
                BATTLE RESULT
              </div>

              {gameState === "idle" && (
                <div className="text-[#9EB39F] text-sm text-center py-8">
                  No battle result yet
                </div>
              )}

              {gameState === "battling" && (
                <div className="space-y-4">
                  <div className="text-[#9EB39F] text-sm mb-3">
                    Battle in progress...
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-2 bg-[#1F2E1F] rounded">
                      <span className="text-[#A8F0A2] text-sm">
                        {coinA?.symbol}
                      </span>
                      <span className="text-white text-lg font-bold">
                        {scoreA}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-[#1F2E1F] rounded">
                      <span className="text-[#F5C542] text-sm">
                        {coinB?.symbol}
                      </span>
                      <span className="text-white text-lg font-bold">
                        {scoreB}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#3BA76F]">
                    <div className="text-[#9EB39F] text-xs mb-2">
                      Performance
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-white text-sm">
                          {coinA?.symbol}
                        </span>
                        <span
                          className={`text-sm font-bold ${
                            gameStateRef.current.totalChangeA >= 0
                              ? "text-[#A8F0A2]"
                              : "text-[#FF7676]"
                          }`}
                        >
                          {gameStateRef.current.totalChangeA?.toFixed(2) ||
                            "0.00"}
                          %
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-white text-sm">
                          {coinB?.symbol}
                        </span>
                        <span
                          className={`text-sm font-bold ${
                            gameStateRef.current.totalChangeB >= 0
                              ? "text-[#A8F0A2]"
                              : "text-[#FF7676]"
                          }`}
                        >
                          {gameStateRef.current.totalChangeB?.toFixed(2) ||
                            "0.00"}
                          %
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {gameState === "ended" && winner && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-[#1F2E1F] rounded">
                    <div className="text-center flex-1">
                      <div
                        className={`text-xl font-bold mb-1 ${
                          winner === "A" ? "text-[#A8F0A2]" : "text-white"
                        }`}
                      >
                        {coinA?.symbol}
                      </div>
                      <div className="text-[#9EB39F] text-xs">
                        {gameStateRef.current.totalChangeA?.toFixed(2)}%
                      </div>
                    </div>

                    <div className="text-white text-xl px-4">VS</div>

                    <div className="text-center flex-1">
                      <div
                        className={`text-xl font-bold mb-1 ${
                          winner === "B" ? "text-[#F5C542]" : "text-white"
                        }`}
                      >
                        {coinB?.symbol}
                      </div>
                      <div className="text-[#9EB39F] text-xs">
                        {gameStateRef.current.totalChangeB?.toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  {winner !== "TIE" && (
                    <div className="text-center p-3 bg-[#3BA76F]/20 border border-[#3BA76F] rounded">
                      <div className="text-[#A8F0A2] text-sm mb-1">Winner</div>
                      <div className="heading-font text-[#F5C542] text-2xl">
                        {winner === "A" ? coinA?.symbol : coinB?.symbol}
                      </div>
                    </div>
                  )}

                  {winner === "TIE" && (
                    <div className="text-center p-3 bg-[#F5C542]/20 border border-[#F5C542] rounded">
                      <div className="heading-font text-[#F5C542] text-2xl">
                        IT'S A TIE!
                      </div>
                    </div>
                  )}

                  <div className="pt-3 border-t border-[#3BA76F]">
                    <div className="text-[#9EB39F] text-xs mb-2">
                      Performance Margin
                    </div>
                    <div className="text-white text-xl font-bold text-center">
                      {Math.abs(
                        gameStateRef.current.totalChangeA -
                          gameStateRef.current.totalChangeB
                      ).toFixed(2)}
                      %
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <LeaderBoard />
    </div>
  );
};

export default CryptoPongBattle;
