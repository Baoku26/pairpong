import {
  uintCV,
  stringAsciiCV,
  cvToJSON,
  principalCV,
  fetchCallReadOnlyFunction,
} from '@stacks/transactions';
import { CONTRACT_ADDRESSES, STACKS_NETWORK } from './stacks-connect';

/**
 * Submit battle results to the leaderboard contract
 */
export const submitBattleResult = async (battleData) => {
    const { coinA, coinB, winner, performanceDelta, scoreA, scoreB } = battleData;

    try {
        const performanceDeltaUint = Math.floor(Math.abs(performanceDelta) * 100);

        const functionArgs = [
            stringAsciiCV(coinA),
            stringAsciiCV(coinB),
            stringAsciiCV(winner),
            uintCV(performanceDeltaUint),
            uintCV(scoreA),
            uintCV(scoreB),
        ];

        const response = await fetchCallReadOnlyFunction({
            network: STACKS_NETWORK.network,
            contractAddress: CONTRACT_ADDRESSES.LEADERBOARD.address,
            contractName: CONTRACT_ADDRESSES.LEADERBOARD.name,
            functionName: 'submit-battle',
            functionArgs,
            senderAddress: CONTRACT_ADDRESSES.LEADERBOARD.address,
        });

        console.log('Battle submitted successfully:', response);
        return response;
    } catch (error) {
        console.error('Error submitting battle:', error);
        throw error;
    }
};

/**
 * Get user stats from leaderboard
 */
export const getUserStats = async (userAddress) => {
    try {
        const result = await fetchCallReadOnlyFunction({
            network: STACKS_NETWORK.network,
            contractAddress: CONTRACT_ADDRESSES.LEADERBOARD.address,
            contractName: CONTRACT_ADDRESSES.LEADERBOARD.name,
            functionName: 'get-user-stats',
            functionArgs: [principalCV(userAddress)],
            senderAddress: userAddress,
        });

        const json = cvToJSON(result);
        const stats = json?.value || {};

        return {
            wins: parseInt(stats.wins?.value || 0),
            losses: parseInt(stats.losses?.value || 0),
            highestDelta: parseInt(stats['highest-delta']?.value || 0) / 100,
        };
    } catch (err) {
        console.error('Error fetching user stats:', err);
        return { wins: 0, losses: 0, highestDelta: 0 };
    }
};

/**
 * Get total battle count
 */
export const getBattleCount = async () => {
    try {
        const result = await fetchCallReadOnlyFunction({
            network: STACKS_NETWORK.network,
            contractAddress: CONTRACT_ADDRESSES.LEADERBOARD.address,
            contractName: CONTRACT_ADDRESSES.LEADERBOARD.name,
            functionName: 'get-battle-count',
            functionArgs: [],
            senderAddress: CONTRACT_ADDRESSES.LEADERBOARD.address,
        });

        const json = cvToJSON(result);
        return parseInt(json.value?.value || 0);
    } catch (err) {
        console.error('Error fetching battle count:', err);
        return 0;
    }
};

/**
 * Fetch a battle by ID
 */
export const getBattleById = async (battleId) => {
    try {
        const result = await fetchCallReadOnlyFunction({
            network: STACKS_NETWORK.network,
            contractAddress: CONTRACT_ADDRESSES.LEADERBOARD.address,
            contractName: CONTRACT_ADDRESSES.LEADERBOARD.name,
            functionName: 'get-battle-by-id',
            functionArgs: [uintCV(battleId)],
            senderAddress: CONTRACT_ADDRESSES.LEADERBOARD.address,
        });

        const json = cvToJSON(result);
        const data = json?.value || null;

        if (!data) return null;

        return {
            player: data.player?.value,
            winner: data.winner?.value,
            loser: data.loser?.value,
            delta: parseInt(data.delta?.value || 0) / 100,
            scoreA: parseInt(data['score-a']?.value || 0),
            scoreB: parseInt(data['score-b']?.value || 0),
        };
    } catch (err) {
        console.error(`Error fetching battle ID ${battleId}:`, err);
        return null;
    }
};

/**
 * Get recent battles for leaderboard display
 */
export const getRecentBattles = async (count = 10) => {
    try {
        const total = await getBattleCount();
        const ids = Array.from({ length: count }, (_, i) => total - 1 - i).filter((id) => id >= 0);

        const battles = await Promise.all(ids.map((id) => getBattleById(id)));
        return battles.filter(Boolean).map((b, i) => ({ id: ids[i], ...b }));
    } catch (err) {
        console.error('Error fetching recent battles:', err);
        return [];
    }
};

export default submitBattleResult;