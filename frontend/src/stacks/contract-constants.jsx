import { openContractCall } from '@stacks/connect';
import { uintCV, stringAsciiCV } from '@stacks/transactions';
import { CONTRACT_ADDRESSES, STACKS_NETWORK } from './contract-constants';

/**
 * Submits the final battle results to the battle-leaderboard contract.
 * @param battleData The structured results of the 20-second battle.
 */
export const submitBattleResult = async (battleData) => {
    const { coinA, coinB, winner, performanceDelta, scoreA, scoreB } = battleData;

    // Clarity requires the delta to be an integer, so we multiply by 100 
    // (e.g., 5.45 -> 545) before converting to uintCV.
    const performanceDeltaUint = Math.floor(performanceDelta * 100);

    // Function arguments MUST match the Clarity contract definition order:
    // (coin-a (string-ascii 10))
    // (coin-b (string-ascii 10))
    // (winner (string-ascii 10))
    // (performance-delta uint)
    // (score-a uint)
    // (score-b uint)
    const functionArgs = [
        stringAsciiCV(coinA),
        stringAsciiCV(coinB),
        stringAsciiCV(winner),
        uintCV(performanceDeltaUint),
        uintCV(scoreA),
        uintCV(scoreB),
    ];

    await openContractCall({
        network: STACKS_NETWORK.network,
        contractAddress: CONTRACT_ADDRESSES.LEADERBOARD.address,
        contractName: CONTRACT_ADDRESSES.LEADERBOARD.name,
        functionName: 'submit-battle',
        functionArgs: functionArgs,

        onFinish: (data) => {
            console.log('Battle submitted successfully. Transaction ID:', data.txId);
        // Handle success notification here
        },
        onCancel: () => {
            console.log('Transaction canceled by user.');
        },
    });
};