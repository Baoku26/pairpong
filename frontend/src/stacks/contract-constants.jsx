import { openContractCall } from '@stacks/connect';
import { uintCV, stringAsciiCV, callReadOnlyFunction, cvToJSON, principalCV } from '@stacks/transactions';
import { CONTRACT_ADDRESSES, STACKS_NETWORK } from './stacks-connect';

/**
 * Submits the final battle results to the battle-leaderboard contract.
 * @param battleData The structured results of the battle.
 */
export const submitBattleResult = async (battleData) => {
    const { coinA, coinB, winner, performanceDelta, scoreA, scoreB } = battleData;

    const performanceDeltaUint = Math.floor(Math.abs(performanceDelta) * 100);

    const functionArgs = [
        stringAsciiCV(coinA),
        stringAsciiCV(coinB),
        stringAsciiCV(winner),
        uintCV(performanceDeltaUint),
        uintCV(scoreA),
        uintCV(scoreB),
    ];

    return new Promise((resolve, reject) => {
        openContractCall({
            network: STACKS_NETWORK.network,
            contractAddress: CONTRACT_ADDRESSES.LEADERBOARD.address,
            contractName: CONTRACT_ADDRESSES.LEADERBOARD.name,
            functionName: 'submit-battle',
            functionArgs: functionArgs,

            onFinish: (data) => {
                console.log('Battle submitted successfully. Transaction ID:', data.txId);
                resolve(data);
            },
            onCancel: () => {
                console.log('Transaction canceled by user.');
                reject(new Error('User canceled transaction'));
            },
        });
    });
};

/**
 * Get user statistics from the leaderboard contract
 * @param userAddress The Stacks address to query
 */
export const getUserStats = async (userAddress) => {
    try {
        const result = await callReadOnlyFunction({
            contractAddress: CONTRACT_ADDRESSES.LEADERBOARD.address,
            contractName: CONTRACT_ADDRESSES.LEADERBOARD.name,
            functionName: 'get-user-stats',
            functionArgs: [principalCV(userAddress)],
            network: STACKS_NETWORK.network,
            senderAddress: userAddress,
        });

        const jsonResult = cvToJSON(result);
        
        if (jsonResult.value) {
            return {
                wins: parseInt(jsonResult.value.wins.value),
                losses: parseInt(jsonResult.value.losses.value),
                highestDelta: parseInt(jsonResult.value['highest-delta'].value) / 100, // Convert back from uint
            };
        }
        
        return { wins: 0, losses: 0, highestDelta: 0 };
    } catch (error) {
        console.error('Error fetching user stats:', error);
        return { wins: 0, losses: 0, highestDelta: 0 };
    }
};

/**
 * Get total battle count
 */
export const getBattleCount = async () => {
    try {
        const result = await callReadOnlyFunction({
            contractAddress: CONTRACT_ADDRESSES.LEADERBOARD.address,
            contractName: CONTRACT_ADDRESSES.LEADERBOARD.name,
            functionName: 'get-battle-count',
            functionArgs: [],
            network: STACKS_NETWORK.network,
            senderAddress: CONTRACT_ADDRESSES.LEADERBOARD.address,
        });

        const jsonResult = cvToJSON(result);
        return parseInt(jsonResult.value.value) || 0;
    } catch (error) {
        console.error('Error fetching battle count:', error);
        return 0;
    }
};

/**
 * Get battle details by ID
 * @param battleId The battle ID to fetch
 */
export const getBattleById = async (battleId) => {
    try {
        const result = await callReadOnlyFunction({
            contractAddress: CONTRACT_ADDRESSES.LEADERBOARD.address,
            contractName: CONTRACT_ADDRESSES.LEADERBOARD.name,
            functionName: 'get-battle-by-id',
            functionArgs: [uintCV(battleId)],
            network: STACKS_NETWORK.network,
            senderAddress: CONTRACT_ADDRESSES.LEADERBOARD.address,
        });

        const jsonResult = cvToJSON(result);
        
        if (jsonResult.value) {
            return {
                player: jsonResult.value.player.value,
                winner: jsonResult.value.winner.value,
                loser: jsonResult.value.loser.value,
                delta: parseInt(jsonResult.value.delta.value) / 100,
                scoreA: parseInt(jsonResult.value['score-a'].value),
                scoreB: parseInt(jsonResult.value['score-b'].value),
            };
        }
        
        return null;
    } catch (error) {
        console.error('Error fetching battle by ID:', error);
        return null;
    }
};

/**
 * Get recent battles for leaderboard display
 * @param count Number of recent battles to fetch
 */
export const getRecentBattles = async (count = 10) => {
    try {
        const totalBattles = await getBattleCount();
        const battles = [];
        
        const startId = Math.max(0, totalBattles - count);
        
        for (let i = totalBattles - 1; i >= startId && i >= 0; i--) {
            const battle = await getBattleById(i);
            if (battle) {
                battles.push({ id: i, ...battle });
            }
        }
        
        return battles;
    } catch (error) {
        console.error('Error fetching recent battles:', error);
        return [];
    }
};

export default submitBattleResult;