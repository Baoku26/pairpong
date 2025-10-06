import React, { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;
const PADDLE_WIDTH = 15;
const BASE_PADDLE_HEIGHT = 100;
const BALL_SIZE = 12;
const BASE_SPEED = 6;
const GAME_DURATION = 20000;
const API_CALL_INTERVAL = 1000;

const CryptoPongBattle = () => {
  const [coins, setCoins] = useState([]);
  const [isLoadingCoins, setIsLoadingCoins] = useState(true);
  const [coinA, setCoinA] = useState(null);
  const [coinB, setCoinB] = useState(null);
  const [priceData, setPriceData] = useState({});
  const [isRunning, setIsRunning] = useState(false);
  const [timer, setTimer] = useState(20);
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

  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const lastApiCallRef = useRef(0);
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

        const response = await fetch(
          "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1",
          {
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
          throw new Error("Invalid data received from API");
        }

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
        console.error(`Error fetching coins (attempt ${attempt}):`, error);

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
      setApiError(null);

      try {
        await rateLimitCheck();

        const response = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${coinA.id},${coinB.id}&vs_currencies=usd&include_24hr_change=true`,
          {
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (!data[coinA.id] || !data[coinB.id]) {
          throw new Error("Invalid price data received");
        }

        setPriceData(data);
        setRetryCount(0);
      } catch (error) {
        console.error(`Error fetching prices (attempt ${attempt}):`, error);

        if (attempt < 3) {
          setTimeout(() => {
            setRetryCount(attempt);
            fetchCurrentPrices(attempt + 1);
          }, Math.pow(2, attempt) * 1000);
        } else {
          setApiError(`Failed to load prices: ${error.message}`);
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

      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/${coin.id}/market_chart?vs_currency=usd&days=${days}`,
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (
        !data.prices ||
        !Array.isArray(data.prices) ||
        data.prices.length === 0
      ) {
        throw new Error("Invalid historical data received");
      }

      return data.prices;
    } catch (error) {
      console.error(
        `Error fetching historical data (attempt ${attempt}):`,
        error
      );

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

  // Fetch prices on mount and when coins change
  useEffect(() => {
    if (coinA && coinB) {
      fetchCurrentPrices();
    }
  }, [coinA, coinB, fetchCurrentPrices]);

  // Periodic price updates every 10 seconds
  useEffect(() => {
    if (!coinA || !coinB) return;

    const interval = setInterval(() => {
      fetchCurrentPrices();
    }, 10000); // Update every 10 seconds

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
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameState, historicalData]);

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
      setTimer(20);
      setWinner(null);
      setScoreA(0);
      setScoreB(0);

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
    } catch (error) {
      console.error("Error starting game:", error);
      setApiError("Failed to start battle. Please try again.");
    } finally {
      setLoadingHistorical(false);
    }
  };

  const endGame = () => {
    setIsRunning(false);
    setGameState("ended");

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const state = gameStateRef.current;
    const changeA = state.totalChangeA;
    const changeB = state.totalChangeB;

    if (Math.abs(changeA - changeB) < 0.5) {
      setWinner("TIE");
    } else if (changeA > changeB) {
      setWinner("A");
    } else {
      setWinner("B");
    }
  };

  const animateGame = (ctx) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const state = gameStateRef.current;

    ctx.fillStyle = "#2A6E40";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#FFFFFF";
    ctx.setLineDash([10, 10]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Update price-based mechanics
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

      // Dynamic paddle heights based on performance
      state.paddleAHeight = Math.max(
        60,
        Math.min(160, BASE_PADDLE_HEIGHT + state.totalChangeA * 5)
      );
      state.paddleBHeight = Math.max(
        60,
        Math.min(160, BASE_PADDLE_HEIGHT + state.totalChangeB * 5)
      );

      // Paddle speed based on volatility
      state.paddleASpeed = 1 + Math.abs(changeA) / 5;
      state.paddleBSpeed = 1 + Math.abs(changeB) / 5;

      // Adjust ball speeds based on momentum
      const volatilityA = Math.abs(changeA);
      const volatilityB = Math.abs(changeB);
      const totalVolatility = volatilityA + volatilityB;

      state.balls.forEach((ball) => {
        const momentumFactor = 1 + totalVolatility / 30;
        const direction = ball.velX > 0 ? 1 : -1;
        ball.velX = direction * BASE_SPEED * momentumFactor;
      });
    }

    // Update and draw balls
    state.balls.forEach((ball) => {
      ball.x += ball.velX;
      ball.y += ball.velY;

      if (ball.y <= BALL_SIZE / 2 || ball.y >= CANVAS_HEIGHT - BALL_SIZE / 2) {
        ball.velY = -ball.velY;
      }

      // Paddle collision with angle adjustment
      if (
        ball.x - BALL_SIZE / 2 <= PADDLE_WIDTH &&
        ball.y >= state.paddleAY &&
        ball.y <= state.paddleAY + state.paddleAHeight &&
        !state.endGameTriggered
      ) {
        ball.velX = Math.abs(ball.velX);
        const hitPos = (ball.y - state.paddleAY) / state.paddleAHeight - 0.5;
        ball.velY = hitPos * BASE_SPEED * 2;
      }

      if (
        ball.x + BALL_SIZE / 2 >= CANVAS_WIDTH - PADDLE_WIDTH &&
        ball.y >= state.paddleBY &&
        ball.y <= state.paddleBY + state.paddleBHeight &&
        !state.endGameTriggered
      ) {
        ball.velX = -Math.abs(ball.velX);
        const hitPos = (ball.y - state.paddleBY) / state.paddleBHeight - 0.5;
        ball.velY = hitPos * BASE_SPEED * 2;
      }

      // Scoring
      if (ball.x <= 0) {
        setScoreB((prev) => prev + 1);
        ball.x = CANVAS_WIDTH / 2;
        ball.y = CANVAS_HEIGHT / 2;
        ball.velX = BASE_SPEED;
        ball.velY = BASE_SPEED * (Math.random() > 0.5 ? 1 : -1);
      } else if (ball.x >= CANVAS_WIDTH) {
        setScoreA((prev) => prev + 1);
        ball.x = CANVAS_WIDTH / 2;
        ball.y = CANVAS_HEIGHT / 2;
        ball.velX = -BASE_SPEED;
        ball.velY = BASE_SPEED * (Math.random() > 0.5 ? 1 : -1);
      }

      // Draw ball with glow
      const gradient = ctx.createRadialGradient(
        ball.x,
        ball.y,
        0,
        ball.x,
        ball.y,
        BALL_SIZE * 2
      );
      gradient.addColorStop(0, "#F5C542");
      gradient.addColorStop(0.5, "#F5C542");
      gradient.addColorStop(1, "rgba(245, 197, 66, 0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_SIZE * 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#F5C542";
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Smart paddle AI with urgency tracking
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
        const distance = Math.abs(closestBallA.x - PADDLE_WIDTH);
        const urgency = Math.max(0.05, 1 - distance / (CANVAS_WIDTH / 2));
        state.paddleAY +=
          (targetA - state.paddleAY) * 0.15 * state.paddleASpeed * urgency;
      }

      if (closestBallB) {
        const targetB = closestBallB.y - state.paddleBHeight / 2;
        const distance = Math.abs(
          closestBallB.x - (CANVAS_WIDTH - PADDLE_WIDTH)
        );
        const urgency = Math.max(0.05, 1 - distance / (CANVAS_WIDTH / 2));
        state.paddleBY +=
          (targetB - state.paddleBY) * 0.15 * state.paddleBSpeed * urgency;
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

    // Draw paddles
    ctx.fillStyle = "#3BA76F";
    ctx.fillRect(0, state.paddleAY, PADDLE_WIDTH, state.paddleAHeight);

    ctx.fillStyle = "#F5C542";
    ctx.fillRect(
      CANVAS_WIDTH - PADDLE_WIDTH,
      state.paddleBY,
      PADDLE_WIDTH,
      state.paddleBHeight
    );

    // Draw price change indicators on canvas
    ctx.font = "10px monospace";
    ctx.fillStyle = state.priceChangePercentA >= 0 ? "#A8F0A2" : "#FF7676";
    ctx.fillText(
      `${state.priceChangePercentA >= 0 ? "↑" : "↓"} ${Math.abs(
        state.priceChangePercentA
      ).toFixed(2)}%`,
      20,
      25
    );

    ctx.fillStyle = state.priceChangePercentB >= 0 ? "#A8F0A2" : "#FF7676";
    ctx.fillText(
      `${state.priceChangePercentB >= 0 ? "↑" : "↓"} ${Math.abs(
        state.priceChangePercentB
      ).toFixed(2)}%`,
      CANVAS_WIDTH - 75,
      25
    );

    // Draw total performance
    ctx.font = "8px monospace";
    ctx.fillStyle = "#9EB39F";
    ctx.fillText(`Total: ${state.totalChangeA.toFixed(2)}%`, 20, 40);
    ctx.fillText(
      `Total: ${state.totalChangeB.toFixed(2)}%`,
      CANVAS_WIDTH - 75,
      40
    );

    animationRef.current = requestAnimationFrame(() => animateGame(ctx));
  };

  const getCoinName = (coin) => coin?.symbol || "N/A";

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
    if (!change) return "↑ 0.0%";
    const arrow = change >= 0 ? "↑" : "↓";
    return `${arrow} ${Math.abs(change).toFixed(2)}%`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2A6E40] to-[#1F2E1F] p-8 font-['Press_Start_2P']">
      <link
        href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap"
        rel="stylesheet"
      />

      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl text-[#A8F0A2] text-center mb-8 drop-shadow-lg">
          CRYPTO PONG BATTLE
        </h1>

        {apiError && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-200 text-xs">
            {apiError}
          </div>
        )}

        {retryCount > 0 && (
          <div className="mb-4 p-3 bg-yellow-900/50 border border-yellow-500 rounded-lg text-yellow-200 text-xs">
            Retrying... (Attempt {retryCount}/3)
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-[#26462F] rounded-lg p-4 shadow-lg border-2 border-[#3BA76F]">
              <label className="block text-[#A8F0A2] text-xs mb-2">
                Coin A{" "}
                {isLoadingCoins && (
                  <span className="text-yellow-400">Loading...</span>
                )}
              </label>
              <select
                value={coinA?.id || ""}
                onChange={(e) =>
                  setCoinA(coins.find((c) => c.id === e.target.value))
                }
                disabled={isRunning || isLoadingCoins}
                className="w-full bg-[#1F2E1F] text-white border border-[#3BA76F] rounded p-2 text-xs focus:outline-none focus:border-[#F5C542]"
              >
                {isLoadingCoins ? (
                  <option>Loading coins...</option>
                ) : (
                  coins.map((coin) => (
                    <option key={coin.id} value={coin.id}>
                      {coin.symbol} - {coin.name}
                    </option>
                  ))
                )}
              </select>

              <label className="block text-[#A8F0A2] text-xs mb-2 mt-4">
                Coin B{" "}
                {isLoadingCoins && (
                  <span className="text-yellow-400">Loading...</span>
                )}
              </label>
              <select
                value={coinB?.id || ""}
                onChange={(e) =>
                  setCoinB(coins.find((c) => c.id === e.target.value))
                }
                disabled={isRunning || isLoadingCoins}
                className="w-full bg-[#1F2E1F] text-white border border-[#3BA76F] rounded p-2 text-xs focus:outline-none focus:border-[#F5C542]"
              >
                {isLoadingCoins ? (
                  <option>Loading coins...</option>
                ) : (
                  coins.map((coin) => (
                    <option key={coin.id} value={coin.id}>
                      {coin.symbol} - {coin.name}
                    </option>
                  ))
                )}
              </select>

              <button
                onClick={startGame}
                disabled={isRunning || isLoadingCoins || loadingHistorical}
                className="w-full mt-4 bg-[#3BA76F] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded transition-all text-xs font-bold"
              >
                {loadingHistorical ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Loading Data...
                  </div>
                ) : isLoadingCoins ? (
                  "LOADING..."
                ) : isRunning ? (
                  "BATTLING"
                ) : (
                  "START"
                )}
              </button>
            </div>

            <div className="bg-[#26462F] rounded-lg p-4 shadow-lg border-2 border-[#3BA76F] space-y-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[#A8F0A2] text-xs">Live Prices</div>
                {loadingPrices && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 border border-[#F5C542] border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-[#F5C542] text-xs">Updating...</span>
                  </div>
                )}
              </div>

              <div>
                <div className="text-[#A8F0A2] text-xs mb-1">
                  {getCoinName(coinA)}
                </div>
                <div className="text-white text-sm">
                  {formatPrice(coinA?.id)}
                </div>
                <div
                  className={`text-xs ${
                    (priceData[coinA?.id]?.usd_24h_change || 0) >= 0
                      ? "text-[#A8F0A2]"
                      : "text-[#FF7676]"
                  }`}
                >
                  {formatChange(coinA?.id)}
                </div>
              </div>

              <div className="border-t border-[#3BA76F] pt-3">
                <div className="text-[#A8F0A2] text-xs mb-1">
                  {getCoinName(coinB)}
                </div>
                <div className="text-white text-sm">
                  {formatPrice(coinB?.id)}
                </div>
                <div
                  className={`text-xs ${
                    (priceData[coinB?.id]?.usd_24h_change || 0) >= 0
                      ? "text-[#A8F0A2]"
                      : "text-[#FF7676]"
                  }`}
                >
                  {formatChange(coinB?.id)}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-4">
            {gameState === "battling" && (
              <div className="flex justify-between items-center">
                <div className="text-center">
                  <div
                    className={`text-lg ${
                      (gameStateRef.current.totalChangeA || 0) >= 0
                        ? "text-[#A8F0A2]"
                        : "text-[#FF7676]"
                    }`}
                  >
                    {getCoinName(coinA)}
                  </div>
                  <div className="text-xs text-[#9EB39F]">
                    {gameStateRef.current.totalChangeA?.toFixed(2) || "0.00"}%
                  </div>
                  <div className="text-2xl font-bold text-[#3BA76F] mt-1">
                    {scoreA}
                  </div>
                </div>

                <div className="bg-[#1F2E1F] px-6 py-2 rounded text-white text-lg">
                  {timer}
                </div>

                <div className="text-center">
                  <div
                    className={`text-lg ${
                      (gameStateRef.current.totalChangeB || 0) >= 0
                        ? "text-[#A8F0A2]"
                        : "text-[#FF7676]"
                    }`}
                  >
                    {getCoinName(coinB)}
                  </div>
                  <div className="text-xs text-[#9EB39F]">
                    {gameStateRef.current.totalChangeB?.toFixed(2) || "0.00"}%
                  </div>
                  <div className="text-2xl font-bold text-[#F5C542] mt-1">
                    {scoreB}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-[#2A6E40] rounded-xl shadow-2xl border-4 border-[#26462F] overflow-hidden">
              {gameState === "idle" && (
                <div className="aspect-[3/2] flex flex-col items-center justify-center">
                  <div className="text-6xl mb-6">⚔️</div>
                  <div className="text-white text-2xl mb-2">Start a Battle</div>
                  <div className="text-[#9EB39F] text-xs">
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
                <div className="aspect-[3/2] flex flex-col items-center justify-center">
                  <div className="text-4xl mb-4">WINNER 🏆</div>
                  <div className="text-6xl text-white mb-4">
                    {winner === "TIE"
                      ? "TIE"
                      : getCoinName(winner === "A" ? coinA : coinB)}
                  </div>
                  <div className="text-[#9EB39F] text-sm mb-2">
                    {winner === "TIE"
                      ? "Equal Performance"
                      : `Performance: ${
                          winner === "A"
                            ? gameStateRef.current.totalChangeA.toFixed(2)
                            : gameStateRef.current.totalChangeB.toFixed(2)
                        }%`}
                  </div>
                  <div className="text-[#A8F0A2] text-xs">
                    Final Score: {scoreA} - {scoreB}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="bg-[#26462F] rounded-lg p-4 shadow-lg border-2 border-[#3BA76F]">
              <div className="text-[#A8F0A2] text-xs mb-4">BATTLE RESULT</div>

              {gameState === "idle" && (
                <div className="text-[#9EB39F] text-xs">
                  No battle result yet
                </div>
              )}

              {gameState === "battling" && (
                <div className="space-y-2">
                  <div className="text-[#9EB39F] text-xs mb-3">
                    Battle in progress...
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[#A8F0A2] text-xs">
                        {getCoinName(coinA)}
                      </span>
                      <span className="text-white text-xs">{scoreA}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#F5C542] text-xs">
                        {getCoinName(coinB)}
                      </span>
                      <span className="text-white text-xs">{scoreB}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#3BA76F]">
                    <div className="text-[#9EB39F] text-xs mb-2">
                      Performance
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs">{getCoinName(coinA)}</span>
                        <span
                          className={`text-xs ${
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
                        <span className="text-xs">{getCoinName(coinB)}</span>
                        <span
                          className={`text-xs ${
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
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span
                      className={`${
                        winner === "A" ? "text-[#A8F0A2]" : "text-[#9EB39F]"
                      }`}
                    >
                      {getCoinName(coinA)}
                    </span>
                    <span
                      className={`${
                        winner === "B" ? "text-[#F5C542]" : "text-[#9EB39F]"
                      }`}
                    >
                      {getCoinName(coinB)}
                    </span>
                  </div>

                  <div className="text-center text-2xl">
                    {winner === "TIE" ? "=" : winner === "A" ? ">" : "<"}
                  </div>

                  <div className="text-[#F5C542] text-xs text-center mt-4">
                    {winner === "TIE"
                      ? "Draw!"
                      : `${getCoinName(winner === "A" ? coinA : coinB)} WINS!`}
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#3BA76F]">
                    <div className="text-[#9EB39F] text-xs mb-2">
                      Final Performance
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs">{getCoinName(coinA)}</span>
                        <span
                          className={`text-xs ${
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
                        <span className="text-xs">{getCoinName(coinB)}</span>
                        <span
                          className={`text-xs ${
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

                  <div className="mt-3 text-center">
                    <div className="text-[#9EB39F] text-xs">Margin</div>
                    <div className="text-white text-sm font-bold">
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
    </div>
  );
};

export default CryptoPongBattle;
