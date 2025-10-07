import { AppConfig, UserSession, showConnect } from '@stacks/connect';
import {
    uintCV,
    stringAsciiCV,
    makeContractCall,
    broadcastTransaction,
    callReadOnlyFunction,
    cvToJSON,
} from '@stacks/transactions';
import { NETWORK, CONTRACT_ADDRESS, CONTRACTS, APP_CONFIG } from './stacksConfig';

// Initialize user session
const appConfig = new AppConfig(['store_write', 'publish_data']);
export const userSession = new UserSession({ appConfig });

// Connect wallet
export const connectWallet = (onFinish, onCancel) => {
    showConnect({
        appDetails: APP_CONFIG,
        redirectTo: '/',
        onFinish: (data) => {
        console.log('Wallet connected:', data);
        if (onFinish) onFinish(data);
        },
        onCancel: () => {
        console.log('Wallet connection cancelled');
        if (onCancel) onCancel();
        },
        userSession,
    });
};

// Disconnect wallet
export const disconnectWallet = () => {
    userSession.signUserOut();
    window.location.reload();
};

// Get user data
export const getUserData = () => {
    if (userSession.isUserSignedIn()) {
        return userSession.loadUserData();
    }
    return null;
};

// Submit battle result to blockchain
export const submitBattleToBlockchain = async (battleData) => {
    const userData = getUserData();
    if (!userData) {
        throw new Error('Wallet not connected');
    }

    const functionArgs = [
        stringAsciiCV(battleData.coinA.substring(0, 10)), // Coin A symbol (max 10 chars)
        stringAsciiCV(battleData.coinB.substring(0, 10)), // Coin B symbol
        stringAsciiCV(battleData.winner.substring(0, 10)), // Winner symbol
        uintCV(Math.floor(Math.abs(battleData.performanceDelta) * 100)), // Delta as uint
        uintCV(battleData.scoreA), // Score A
        uintCV(battleData.scoreB), // Score B
    ];

    const txOptions = {
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACTS.LEADERBOARD,
        functionName: 'submit-battle',
        functionArgs,
        network: NETWORK,
        senderKey: userData.profile.stxAddress.testnet,
        postConditionMode: 1, // Allow
    };

    try {
        const transaction = await makeContractCall(txOptions);
        const broadcastResponse = await broadcastTransaction(transaction, NETWORK);
        
        console.log('Battle submitted:', broadcastResponse);
        return broadcastResponse;
    } catch (error) {
        console.error('Error submitting battle:', error);
        throw error;
    }
};

// Get user stats from blockchain
export const getUserStats = async (userAddress) => {
    try {
        const result = await callReadOnlyFunction({
            contractAddress: CONTRACT_ADDRESS,
            contractName: CONTRACTS.LEADERBOARD,
            functionName: 'get-user-stats',
            functionArgs: [stringAsciiCV(userAddress)],
            network: NETWORK,
            senderAddress: userAddress,
        });

        const jsonResult = cvToJSON(result);
        return jsonResult.value;
    } catch (error) {
        console.error('Error fetching user stats:', error);
        return null;
    }
};

// Get battle by ID
export const getBattleById = async (battleId) => {
    try {
        const result = await callReadOnlyFunction({
            contractAddress: CONTRACT_ADDRESS,
            contractName: CONTRACTS.LEADERBOARD,
            functionName: 'get-battle-by-id',
            functionArgs: [uintCV(battleId)],
            network: NETWORK,
            senderAddress: CONTRACT_ADDRESS,
        });

        const jsonResult = cvToJSON(result);
        return jsonResult.value;
    } catch (error) {
        console.error('Error fetching battle:', error);
        return null;
    }
};

// Get total battle count
export const getBattleCount = async () => {
    try {
        const result = await callReadOnlyFunction({
            contractAddress: CONTRACT_ADDRESS,
            contractName: CONTRACTS.LEADERBOARD,
            functionName: 'get-battle-count',
            network: NETWORK,
            senderAddress: CONTRACT_ADDRESS,
        });

        const jsonResult = cvToJSON(result);
        return jsonResult.value ? parseInt(jsonResult.value.value) : 0;
    } catch (error) {
        console.error('Error fetching battle count:', error);
        return 0;
    }
};