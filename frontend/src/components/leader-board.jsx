import { useState, useEffect } from "react";
import {
  ChartBarIncreasingIcon,
  Trophy,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import {
  getRecentBattles,
  getUserStats,
  getWalletAddress,
  isWalletConnected,
} from "../lib/stacksService";

const LeaderBoard = () => {
  const [battles, setBattles] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLeaderboardData();

    // Set up interval to refresh battles periodically
    const interval = setInterval(fetchLeaderboardData, 60000); // Refresh every 1 minute

    return () => clearInterval(interval);
  }, []);

  const fetchLeaderboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch recent battles
      const recentBattles = await getRecentBattles(10);
      setBattles(recentBattles);

      // Fetch user stats if wallet is connected
      if (isWalletConnected()) {
        const userAddress = getWalletAddress();
        if (userAddress) {
          const stats = await getUserStats(userAddress);
          setUserStats(stats);
        } else {
          setUserStats(null);
        }
      } else {
        setUserStats(null);
      }
    } catch (err) {
      console.error("Error fetching leaderboard:", err);
      setError("Failed to load leaderboard data");
    } finally {
      setLoading(false);
    }
  };

  const truncateAddress = (address) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 sm:mt-8">
      {/* Header */}
      <div className="flex items-center justify-center sm:justify-start gap-2 mb-4 sm:mb-6">
        <ChartBarIncreasingIcon className="h-5 w-5 sm:h-6 sm:w-6 text-[#3BA76F]" />
        <h2 className="heading-font text-xl sm:text-2xl font-bold text-black">
          USER STATS
        </h2>
      </div>

      {/* User Stats Card - Mobile Optimized */}
      {userStats && (
        <div className="bg-[#26462F] border-2 border-[#3BA76F] rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
          <h3 className="text-[#A8F0A2] text-xs sm:text-sm mb-3 sm:mb-4 text-center sm:text-left">
            YOUR STATS
          </h3>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="text-center">
              <div className="text-white text-2xl sm:text-3xl font-bold">
                {userStats.wins}
              </div>
              <div className="text-[#9EB39F] text-xs mt-1">Wins</div>
            </div>
            <div className="text-center">
              <div className="text-white text-2xl sm:text-3xl font-bold">
                {userStats.losses}
              </div>
              <div className="text-[#9EB39F] text-xs mt-1">Losses</div>
            </div>
            <div className="text-center">
              <div className="text-[#F5C542] text-2xl sm:text-3xl font-bold">
                {userStats.highestDelta.toFixed(2)}%
              </div>
              <div className="text-[#9EB39F] text-xs mt-1">Best Delta</div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Battles - Mobile Optimized */}
      <div className="bg-[#26462F] border-2 border-[#3BA76F] rounded-lg p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h3 className="text-[#A8F0A2] text-xs sm:text-sm">RECENT BATTLES</h3>
          <button
            onClick={fetchLeaderboardData}
            disabled={loading}
            className="text-xs text-[#F5C542] hover:brightness-110 flex items-center gap-1 disabled:opacity-50 transition-all touch-manipulation active:scale-95"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-6 sm:py-8">
            <div className="w-6 h-6 sm:w-8 sm:h-8 border-4 border-[#3BA76F] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-[#9EB39F] text-xs sm:text-sm">
              Loading battles...
            </p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-6 sm:py-8">
            <p className="text-[#FF7676] text-xs sm:text-sm">{error}</p>
            <button
              onClick={fetchLeaderboardData}
              className="mt-3 text-xs text-[#F5C542] hover:brightness-110 transition-all"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && battles.length === 0 && (
          <div className="text-center py-6 sm:py-8">
            <Trophy className="w-10 h-10 sm:w-12 sm:h-12 text-[#9EB39F] mx-auto mb-2" />
            <p className="text-[#9EB39F] text-sm">No battles recorded yet</p>
            <p className="text-[#9EB39F] text-xs mt-2">
              Be the first to submit a battle!
            </p>
          </div>
        )}

        {/* Battle List - Mobile Optimized */}
        {!loading && !error && battles.length > 0 && (
          <div className="space-y-2 sm:space-y-3">
            {battles.map((battle) => (
              <div
                key={battle.id}
                className="bg-[#1F2E1F] border border-[#3BA76F] rounded-lg p-3 sm:p-4 hover:border-[#F5C542] transition-colors"
              >
                {/* Mobile: Stacked Layout */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-0">
                  {/* Coins Section */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-white font-bold text-sm sm:text-base">
                        {battle.winner}
                      </span>
                      <span className="text-[#9EB39F] text-xs">vs</span>
                      <span className="text-[#9EB39F] text-sm sm:text-base">
                        {battle.loser}
                      </span>
                    </div>
                    <div className="text-[#9EB39F] text-xs">
                      Player: {truncateAddress(battle.player)}
                    </div>
                  </div>

                  {/* Stats Section - Mobile: Horizontal, Desktop: Vertical */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 sm:gap-1 sm:text-right">
                    <div className="flex items-center gap-1 text-[#A8F0A2]">
                      <TrendingUp size={12} />
                      <span className="text-sm font-bold">
                        {battle.delta.toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-[#9EB39F] text-xs">
                      Score: {battle.scoreA} - {battle.scoreB}
                    </div>
                  </div>
                </div>

                {/* Battle ID - Moved to bottom for mobile */}
                <div className="text-[#9EB39F] text-xs mt-2 pt-2 border-t border-[#3BA76F]/30">
                  Battle #{battle.id}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Show More Button for Mobile - Optional */}
        {!loading && !error && battles.length >= 10 && (
          <div className="mt-4 text-center">
            <button
              onClick={fetchLeaderboardData}
              className="text-xs sm:text-sm text-[#F5C542] hover:brightness-110 transition-all px-4 py-2 border border-[#F5C542] rounded-lg touch-manipulation active:scale-95"
            >
              Load More
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaderBoard;
