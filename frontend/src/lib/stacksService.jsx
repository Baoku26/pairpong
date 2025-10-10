import { request, getLocalStorage, isConnected, disconnect } from '@stacks/connect';
import { createClient } from '@stacks/blockchain-api-client';
import {
  uintCV,
  stringAsciiCV,
  principalCV,
  cvToJSON,
} from '@stacks/transactions';
import { NETWORK, CONTRACT_DEPLOYER_ADDRESS, CONTRACTS } from './stacksConfig';

// --- API Setup ---
const stacksApi = new createClient({
  fetchApi: fetch,
  basePath: NETWORK.coreApiUrl,
});

// --- AUTH ---
export const connectWallet = async () => {
    try {
        await request({ forceWalletSelect: true }, 'stx_getAddresses');
        return true;
    } catch (error) {
        console.error('Connection failed:', error);
        return false;
    }
};

export const disconnectWallet = async () => {
    try {
        await disconnect();
    } catch (error) {
        console.error('Disconnect failed:', error);
    }
};

export const getWalletAddress = () => {
    const data = getLocalStorage();
    return data?.addresses?.stx?.[0]?.address || null;
};

export const isWalletConnected = () => isConnected();

// --- CONTRACT WRITE FUNCTIONS ---
export const submitBattleToBlockchain = async (battleData) => {
    const { coinA, coinB, predictedWinner, actualWinner, performanceDelta, scoreA, scoreB } = battleData;
    
    try {
        const response = await request('stx_callContract', {
            contractAddress: CONTRACT_DEPLOYER_ADDRESS,
            contractName: CONTRACTS.LEADERBOARD,
            functionName: 'submit-battle',
            functionArgs: [
                stringAsciiCV(coinA.substring(0, 10)),
                stringAsciiCV(coinB.substring(0, 10)),
                stringAsciiCV(predictedWinner.substring(0, 10)),
                stringAsciiCV(actualWinner.substring(0, 10)),
                uintCV(Math.floor(Math.abs(performanceDelta) * 100)),
                uintCV(scoreA),
                uintCV(scoreB),
            ],
            network: NETWORK,
        });
        return response;
    } catch (error) {
        console.error('Battle submission failed:', error);
        throw error;
    }
};

export const submitPrediction = async (coinA, coinB, predictedWinner) => {
    try {
        const response = await request('stx_callContract', {
            contractAddress: CONTRACT_DEPLOYER_ADDRESS,
            contractName: CONTRACTS.PREDICTION,
            functionName: 'submit-prediction',
            functionArgs: [
                stringAsciiCV(coinA.substring(0, 10)),
                stringAsciiCV(coinB.substring(0, 10)),
                stringAsciiCV(predictedWinner.substring(0, 10)),
            ],
            network: NETWORK,
        });
        return response;
    } catch (error) {
        console.error('Prediction submission failed:', error);
        throw error;
    }
};

export const settlePrediction = async (predictionId) => {
    try {
        const response = await request('stx_callContract', {
        contractAddress: CONTRACT_DEPLOYER_ADDRESS,
        contractName: CONTRACTS.PREDICTION,
        functionName: 'settle-prediction',
        functionArgs: [uintCV(predictionId)],
        network: NETWORK,
        });
        return response;
    } catch (error) {
        console.error('Prediction settlement failed:', error);
        throw error;
    }
};

export const mintBattleNFT = async (recipient, metadataUri) => {
    try {
        const response = await request('stx_callContract', {
            contractAddress: CONTRACT_DEPLOYER_ADDRESS,
            contractName: CONTRACTS.NFT,
            functionName: 'mint-battle-nft',
            functionArgs: [
                principalCV(recipient),
                stringAsciiCV(metadataUri.substring(0, 256)),
            ],
            network: NETWORK,
        });
        return response;
    } catch (error) {
        console.error('NFT minting failed:', error);
        throw error;
    }
};

// --- CONTRACT READ-ONLY FUNCTIONS ---
export const getUserStats = async (userAddress) => {
  const addr = userAddress || getWalletAddress();
  if (!addr) return { wins: 0, losses: 0, highestDelta: 0 };

    try {
        const result = await stacksApi.callReadOnlyFunction({
            contractAddress: CONTRACT_DEPLOYER_ADDRESS,
            contractName: CONTRACTS.LEADERBOARD,
            functionName: 'get-user-stats',
            functionArgs: [principalCV(addr)],
            senderAddress: addr,
            network: NETWORK,
        });
        
        const json = cvToJSON(result);
        const stats = json?.value?.value || {};
        
        return {
        wins: parseInt(stats.wins?.value || 0),
        losses: parseInt(stats.losses?.value || 0),
        highestDelta: parseInt(stats['highest-delta']?.value || 0) / 100,
        };
    } catch (error) {
        console.error('Error fetching user stats:', error);
        return { wins: 0, losses: 0, highestDelta: 0 };
    }
};

export const getBattleCount = async () => {
    try {
        const result = await stacksApi.callReadOnlyFunction({
            contractAddress: CONTRACT_DEPLOYER_ADDRESS,
            contractName: CONTRACTS.LEADERBOARD,
            functionName: 'get-battle-count',
            functionArgs: [],
            senderAddress: CONTRACT_DEPLOYER_ADDRESS,
            network: NETWORK,
        });
        
        const json = cvToJSON(result);
        return json?.value ? parseInt(json.value.value) : 0;
    } catch (error) {
        console.error('Error fetching battle count:', error);
        return 0;
    }
};

export const getBattleById = async (battleId) => {
    try {
        const result = await stacksApi.callReadOnlyFunction({
            contractAddress: CONTRACT_DEPLOYER_ADDRESS,
            contractName: CONTRACTS.LEADERBOARD,
            functionName: 'get-battle-by-id',
            functionArgs: [uintCV(battleId)],
            senderAddress: CONTRACT_DEPLOYER_ADDRESS,
            network: NETWORK,
        });
        
        const json = cvToJSON(result);
        const data = json?.value?.value;
        if (!data) return null;
        
        const winner = data['actual-winner']?.value || 'N/A';
        const loser = winner === data['coin-a']?.value 
        ? data['coin-b']?.value 
        : data['coin-a']?.value;
        
        return {
        player: data.player?.value,
        winner,
        loser,
        delta: parseInt(data['performance-delta']?.value || 0) / 100,
        scoreA: parseInt(data['score-a']?.value || 0),
        scoreB: parseInt(data['score-b']?.value || 0),
        };
    } catch (error) {
        console.error(`Error fetching battle ID ${battleId}:`, error);
        return null;
    }
};

export const getRecentBattles = async (count = 10) => {
    try {
        const total = await getBattleCount();
        if (total === 0) return [];
        
        const ids = Array.from({ length: Math.min(count, total) },
        (_, i) => total - 1 - i);
        
        const battles = await Promise.all(ids.map(id => getBattleById(id)));
        return battles.filter(Boolean).map((b, i) => ({ id: ids[i], ...b }));
    } catch (error) {
        console.error('Error fetching recent battles:', error);
        return [];
    }
};

export const getPrediction = async (predictionId) => {
    try {
        const result = await stacksApi.callReadOnlyFunction({
            contractAddress: CONTRACT_DEPLOYER_ADDRESS,
            contractName: CONTRACTS.PREDICTION,
            functionName: 'get-prediction',
            functionArgs: [uintCV(predictionId)],
            senderAddress: CONTRACT_DEPLOYER_ADDRESS,
            network: NETWORK,
        });
        
        return cvToJSON(result)?.value || null;
    } catch (error) {
        console.error('Error fetching prediction:', error);
        return null;
    }
};

export const getTokenUri = async (tokenId) => {
    try {
        const result = await stacksApi.callReadOnlyFunction({
            contractAddress: CONTRACT_DEPLOYER_ADDRESS,
            contractName: CONTRACTS.NFT,
            functionName: 'get-token-uri',
            functionArgs: [uintCV(tokenId)],
            senderAddress: CONTRACT_DEPLOYER_ADDRESS,
            network: NETWORK,
        });
        
        return cvToJSON(result)?.value?.value || null;
    } catch (error) {
        console.error('Error fetching token URI:', error);
        return null;
    }
};

export const getLastTokenId = async () => {
    try {
        const result = await stacksApi.callReadOnlyFunction({
            contractAddress: CONTRACT_DEPLOYER_ADDRESS,
            contractName: CONTRACTS.NFT,
            functionName: 'get-last-token-id',
            functionArgs: [],
            senderAddress: CONTRACT_DEPLOYER_ADDRESS,
            network: NETWORK,
        });
        
        const json = cvToJSON(result);
        return json?.value?.value ? parseInt(json.value.value) : 0;
    } catch (error) {
        console.error('Error fetching last token ID:', error);
        return 0;
    }
};