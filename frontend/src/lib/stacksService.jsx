import { AppConfig, UserSession, showConnect, openContractCall } from '@stacks/connect';
import { createClient } from '@stacks/blockchain-api-client';
import {
  uintCV,
  stringAsciiCV,
  principalCV,
  cvToJSON,
} from '@stacks/transactions';
import { NETWORK, CONTRACT_DEPLOYER_ADDRESS, CONTRACTS, APP_DETAILS } from './stacksConfig';

// --- API and User Session Setup ---
const stacksApi = new createClient({
    fetchApi: fetch,
    basePath: NETWORK.coreApiUrl,
});

const appConfig = new AppConfig(['store_write', 'publish_data']);
export const userSession = new UserSession({ appConfig }); 

// --- AUTH ---
const authSubscribers = new Set();
export const subscribeAuth = (fn) => {
    authSubscribers.add(fn);
    return () => authSubscribers.delete(fn);
};
const notifyAuth = (isConnected) => {
    authSubscribers.forEach((fn) => {
        try {
            fn(isConnected);
        } catch (e) {
            console.error('Auth subscriber error', e);
        }
    });
};

export const connectWallet = () => {
    const safeAppDetails = { ...APP_DETAILS };
    if (typeof safeAppDetails.icon !== 'string') {
        delete safeAppDetails.icon;
    }
    showConnect({
        appDetails: safeAppDetails,
        redirectTo: '/',
        userSession,
        onFinish: () => notifyAuth(true),
        onCancel: () => notifyAuth(false),
    });
};

export const disconnectWallet = () => {
    if (userSession.isUserSignedIn()) {
        userSession.signUserOut();
    }
    notifyAuth(false);
    window.location.reload();
};

export const getUserData = () => {
    return userSession.isUserSignedIn() ? userSession.loadUserData() : null;
};

export const getStxAddress = () => {
    return userSession.isUserSignedIn() ? userSession.data.profile.stxAddress.testnet : null;
};

// --- CONTRACT WRITE FUNCTIONS ---
const callContract = (options) => {
    return new Promise((resolve, reject) => {
        openContractCall({
            ...options,
            onFinish: response => resolve(response),
            onCancel: () => reject(new Error('Transaction cancelled by user.')),
        });
    });
};

export const submitBattleToBlockchain = (battleData) => {
    const { coinA, coinB, predictedWinner, actualWinner, performanceDelta, scoreA, scoreB } = battleData;
    const functionArgs = [
        stringAsciiCV(coinA.substring(0, 10)),
        stringAsciiCV(coinB.substring(0, 10)),
        stringAsciiCV(predictedWinner.substring(0, 10)),
        stringAsciiCV(actualWinner.substring(0, 10)),
        uintCV(Math.floor(Math.abs(performanceDelta) * 100)),
        uintCV(scoreA),
        uintCV(scoreB),
    ];
    return callContract({
        contractAddress: CONTRACT_DEPLOYER_ADDRESS,
        contractName: CONTRACTS.LEADERBOARD,
        functionName: 'submit-battle',
        functionArgs,
        network: NETWORK,
    });
};

export const submitPrediction = (coinA, coinB, predictedWinner) => {
    const functionArgs = [
        stringAsciiCV(coinA.substring(0, 10)),
        stringAsciiCV(coinB.substring(0, 10)),
        stringAsciiCV(predictedWinner.substring(0, 10)),
    ];
    return callContract({
        contractAddress: CONTRACT_DEPLOYER_ADDRESS,
        contractName: CONTRACTS.PREDICTION,
        functionName: 'submit-prediction',
        functionArgs,
        network: NETWORK,
    });
};

export const settlePrediction = (predictionId) => {
    return callContract({
        contractAddress: CONTRACT_DEPLOYER_ADDRESS,
        contractName: CONTRACTS.PREDICTION,
        functionName: 'settle-prediction',
        functionArgs: [uintCV(predictionId)],
        network: NETWORK,
    });
};

export const mintBattleNFT = (recipient, metadataUri) => {
    const functionArgs = [
        principalCV(recipient),
        stringAsciiCV(metadataUri.substring(0, 256)),
    ];
    return callContract({
        contractAddress: CONTRACT_DEPLOYER_ADDRESS,
        contractName: CONTRACTS.NFT,
        functionName: 'mint-battle-nft',
        functionArgs,
        network: NETWORK,
    });
};

// --- CONTRACT READ-ONLY FUNCTIONS (Updated) ---

export const getUserStats = async (userAddress) => {
    const addr = userAddress || getStxAddress();
    if (!addr) return { wins: 0, losses: 0, highestDelta: 0 };
    try {
        const result = await stacksApi.callReadOnlyFunction({
            contractAddress: CONTRACT_DEPLOYER_ADDRESS,
            contractName: CONTRACTS.LEADERBOARD,
            functionName: 'get-user-stats',
            functionArgs: [principalCV(addr)],
            sender: addr,
        });
        const json = cvToJSON(result);
        const stats = json?.value?.value || {};
        return {
            wins: parseInt(stats.wins?.value || 0),
            losses: parseInt(stats.losses?.value || 0),
            highestDelta: parseInt(stats['highest-delta']?.value || 0) / 100,
        };
    } catch (error) {
        console.error('❌ Error fetching user stats:', error);
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
            sender: CONTRACT_DEPLOYER_ADDRESS,
        });
        const json = cvToJSON(result);
        return json?.value ? parseInt(json.value.value) : 0;
    } catch (error) {
        console.error('❌ Error fetching battle count:', error);
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
            sender: CONTRACT_DEPLOYER_ADDRESS,
        });
        const json = cvToJSON(result);
        const data = json?.value?.value;
        if (!data) return null;
        const winner = data['actual-winner']?.value || 'N/A';
        const loser = winner === data['coin-a']?.value ? data['coin-b']?.value : data['coin-a']?.value;
        return {
            player: data.player?.value,
            winner,
            loser,
            delta: parseInt(data['performance-delta']?.value || 0) / 100,
            scoreA: parseInt(data['score-a']?.value || 0),
            scoreB: parseInt(data['score-b']?.value || 0),
        };
    } catch (error) {
        console.error(`❌ Error fetching battle ID ${battleId}:`, error);
        return null;
    }
};

export const getRecentBattles = async (count = 10) => {
    try {
        const total = await getBattleCount();
        if (total === 0) return [];
        const ids = Array.from({ length: Math.min(count, total) }, (_, i) => total - 1 - i);
        const battles = await Promise.all(ids.map(id => getBattleById(id)));
        return battles.filter(Boolean).map((b, i) => ({ id: ids[i], ...b }));
    } catch (err) {
        console.error('Error fetching recent battles:', err);
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
            network: NETWORK,
            senderAddress: CONTRACT_DEPLOYER_ADDRESS,
        });
        return cvToJSON(result)?.value || null;
    } catch (error) {
        console.error('❌ Error fetching prediction:', error);
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
            network: NETWORK,
            senderAddress: CONTRACT_DEPLOYER_ADDRESS,
        });
        return cvToJSON(result)?.value?.value || null;
    } catch (error) {
        console.error('❌ Error fetching token URI:', error);
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
            network: NETWORK,
            senderAddress: CONTRACT_DEPLOYER_ADDRESS,
        });
        return cvToJSON(result)?.value?.value ? parseInt(cvToJSON(result).value.value) : 0;
    } catch (error) {
        console.error('❌ Error fetching last token ID:', error);
        return 0;
    }
};