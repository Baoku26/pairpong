import { request, getLocalStorage, isConnected, disconnect } from '@stacks/connect';
import {
  uintCV,
  stringAsciiCV,
  principalCV,
  cvToJSON,
} from '@stacks/transactions';
import { NETWORK, CONTRACT_DEPLOYER_ADDRESS, CONTRACTS } from './stacksConfig';
import axios from 'axios';

// --- API Setup ---
const API_BASE_URL = NETWORK.coreApiUrl || 'https://api.testnet.hiro.so';

// --- Helper function to call read-only functions ---
const callReadOnlyViaAPI = async (contractAddress, contractName, functionName, args = []) => {
    try {
        const argsPayload = args && args.length ? encodeURIComponent(JSON.stringify(args)) : null;

        const url = argsPayload
        ? `${API_BASE_URL}/v2/contract/${contractAddress}/${contractName}/${functionName}?args=${argsPayload}`
        : `${API_BASE_URL}/v2/contract/${contractAddress}/${contractName}/${functionName}`;

        const response = await axios.get(url);
        console.log('Read-only call response:', response);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        return data.result || data;
    } catch (error) {
        console.error('Read-only call failed:', error);
        throw error;
    }
};

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
    console.log('Submitting battle:', battleData);
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
        const result = await callReadOnlyViaAPI(
        CONTRACT_DEPLOYER_ADDRESS,
        CONTRACTS.LEADERBOARD,
        'get-user-stats',
        [principalCV(addr)]
        );
        
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
        const result = await callReadOnlyViaAPI(
        CONTRACT_DEPLOYER_ADDRESS,
        CONTRACTS.LEADERBOARD,
        'get-battle-count',
        []
        );
        
        const json = cvToJSON(result);
        return json?.value ? parseInt(json.value.value) : 0;
    } catch (error) {
        console.error('Error fetching battle count:', error);
        return 0;
    }
};

export const getBattleById = async (battleId) => {
    try {
        const result = await callReadOnlyViaAPI(
        CONTRACT_DEPLOYER_ADDRESS,
        CONTRACTS.LEADERBOARD,
        'get-battle-by-id',
        [uintCV(battleId)]
        );
        
        const json = cvToJSON(result);
        const battleData = json?.value?.value;
        
        if (!battleData) return null;
        
        const winner = battleData['actual-winner']?.value || 'N/A';
        const loser = winner === battleData['coin-a']?.value 
        ? battleData['coin-b']?.value 
        : battleData['coin-a']?.value;
        
        return {
        player: battleData.player?.value,
        winner,
        loser,
        delta: parseInt(battleData['performance-delta']?.value || 0) / 100,
        scoreA: parseInt(battleData['score-a']?.value || 0),
        scoreB: parseInt(battleData['score-b']?.value || 0),
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
        
        const ids = Array.from(
        { length: Math.min(count, total) },
        (_, i) => total - 1 - i
        );
        
        const battles = await Promise.all(ids.map(id => getBattleById(id)));
        return battles.filter(Boolean).map((b, i) => ({ id: ids[i], ...b }));
    } catch (error) {
        console.error('Error fetching recent battles:', error);
        return [];
    }
};

export const getPrediction = async (predictionId) => {
    try {
        const result = await callReadOnlyViaAPI(
        CONTRACT_DEPLOYER_ADDRESS,
        CONTRACTS.PREDICTION,
        'get-prediction',
        [uintCV(predictionId)]
        );
        
        return cvToJSON(result)?.value || null;
    } catch (error) {
        console.error('Error fetching prediction:', error);
        return null;
    }
};

export const getTokenUri = async (tokenId) => {
    try {
        const result = await callReadOnlyViaAPI(
        CONTRACT_DEPLOYER_ADDRESS,
        CONTRACTS.NFT,
        'get-token-uri',
        [uintCV(tokenId)]
        );
        
        return cvToJSON(result)?.value?.value || null;
    } catch (error) {
        console.error('Error fetching token URI:', error);
        return null;
    }
};

export const getLastTokenId = async () => {
    try {
        const result = await callReadOnlyViaAPI(
        CONTRACT_DEPLOYER_ADDRESS,
        CONTRACTS.NFT,
        'get-last-token-id',
        []
        );
        
        const json = cvToJSON(result);
        return json?.value?.value ? parseInt(json.value.value) : 0;
    } catch (error) {
        console.error('Error fetching last token ID:', error);
        return 0;
    }
};