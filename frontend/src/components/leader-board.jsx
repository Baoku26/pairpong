import { useState, useEffect } from 'react';
import { ChartBarIncreasingIcon, Trophy, TrendingUp, RefreshCw } from "lucide-react";
import { getRecentBattles, getUserStats, getWalletAddress, isWalletConnected } from "../lib/stacksService";

const LeaderBoard = () => {
    const [battles, setBattles] = useState([]);
    const [userStats, setUserStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchLeaderboardData();
        
        // Set up interval to refresh battles periodically
        const interval = setInterval(fetchLeaderboardData, 30000); // Refresh every 30 seconds
        
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
        console.error('Error fetching leaderboard:', err);
        setError('Failed to load leaderboard data');
        } finally {
        setLoading(false);
        }
    };

    const truncateAddress = (address) => {
        if (!address) return '';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    return (
        <div className='max-w-7xl mx-auto p-4 mt-8'>
        <div className="flex items-center gap-2 mb-6">
            <ChartBarIncreasingIcon className="h-6 w-6 text-[#3BA76F]" />
            <h2 className='heading-font text-2xl font-bold text-black'>
            LEADERBOARD
            </h2>
        </div>

        {/* User Stats Card */}
        {userStats && (
            <div className='bg-[#26462F] border-2 border-[#3BA76F] rounded-lg p-6 mb-6'>
            <h3 className='text-[#A8F0A2] text-sm mb-4'>YOUR STATS</h3>
            <div className='grid grid-cols-3 gap-4'>
                <div className='text-center'>
                <div className='text-white text-3xl font-bold'>
                    {userStats.wins}
                </div>
                <div className='text-[#9EB39F] text-xs mt-1'>Wins</div>
                </div>
                <div className='text-center'>
                <div className='text-white text-3xl font-bold'>
                    {userStats.losses}
                </div>
                <div className='text-[#9EB39F] text-xs mt-1'>Losses</div>
                </div>
                <div className='text-center'>
                <div className='text-[#F5C542] text-3xl font-bold'>
                    {userStats.highestDelta.toFixed(2)}%
                </div>
                <div className='text-[#9EB39F] text-xs mt-1'>Best Delta</div>
                </div>
            </div>
            </div>
        )}

        {/* Recent Battles */}
        <div className='bg-[#26462F] border-2 border-[#3BA76F] rounded-lg p-6'>
            <div className="flex items-center justify-between mb-4">
            <h3 className='text-[#A8F0A2] text-sm'>RECENT BATTLES</h3>
            <button
                onClick={fetchLeaderboardData}
                disabled={loading}
                className="text-xs text-[#F5C542] hover:brightness-110 flex items-center gap-1 disabled:opacity-50 transition-all"
            >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                Refresh
            </button>
            </div>

            {loading && (
            <div className='text-center py-8'>
                <div className="w-8 h-8 border-4 border-[#3BA76F] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className='text-[#9EB39F] text-sm'>Loading battles...</p>
            </div>
            )}

            {error && (
            <div className='text-center py-8'>
                <p className='text-[#FF7676] text-sm'>{error}</p>
            </div>
            )}

            {!loading && !error && battles.length === 0 && (
            <div className='text-center py-8'>
                <Trophy className="w-12 h-12 text-[#9EB39F] mx-auto mb-2" />
                <p className='text-[#9EB39F] text-sm'>No battles recorded yet</p>
                <p className='text-[#9EB39F] text-xs mt-2'>
                Be the first to submit a battle!
                </p>
            </div>
            )}

            {!loading && !error && battles.length > 0 && (
            <div className='space-y-3'>
                {battles.map((battle) => (
                <div 
                    key={battle.id}
                    className='bg-[#1F2E1F] border border-[#3BA76F] rounded-lg p-4 hover:border-[#F5C542] transition-colors'
                >
                    <div className='flex justify-between items-start mb-2'>
                    <div className='flex-1'>
                        <div className='flex items-center gap-2 mb-1'>
                        <span className='text-white font-bold'>
                            {battle.winner}
                        </span>
                        <span className='text-[#9EB39F] text-xs'>vs</span>
                        <span className='text-[#9EB39F]'>
                            {battle.loser}
                        </span>
                        </div>
                        <div className='text-[#9EB39F] text-xs'>
                        Player: {truncateAddress(battle.player)}
                        </div>
                    </div>
                    <div className='text-right'>
                        <div className='flex items-center gap-1 text-[#A8F0A2]'>
                        <TrendingUp size={12} />
                        <span className='text-sm font-bold'>
                            {battle.delta.toFixed(2)}%
                        </span>
                        </div>
                        <div className='text-[#9EB39F] text-xs mt-1'>
                        {battle.scoreA} - {battle.scoreB}
                        </div>
                    </div>
                    </div>
                    <div className='text-[#9EB39F] text-xs'>
                    Battle #{battle.id}
                    </div>
                </div>
                ))}
            </div>
            )}
        </div>
        </div>
    );
};

export default LeaderBoard;