import { AppConfig, UserSession, showConnect } from '@stacks/connect';
import {
    uintCV,
    stringAsciiCV,
    makeContractCall,
    broadcastTransaction,
    fetchCallReadOnlyFunction,
    cvToJSON,
} from '@stacks/transactions';
import { NETWORK, CONTRACT_DEPLOYER_ADDRESS, CONTRACTS, APP_DETAILS } from './stacksConfig';

// 🧩 Initialize session
const appConfig = new AppConfig(['store_write', 'publish_data']);
export const userSession = new UserSession({ appConfig });

export const connectWallet = (onFinish, onCancel) => {
    showConnect({
        APP_DETAILS,
        redirectTo: '/',
        userSession,
        onFinish: (data) => {
        console.log('✅ Wallet connected:', data);
        if (onFinish) onFinish(data);
        },
        onCancel: () => {
        console.log('❌ Wallet connection cancelled');
        if (onCancel) onCancel();
        },
    });
};

export const disconnectWallet = () => {
    userSession.signUserOut();
    window.location.reload();
};

export const getUserData = () => {
    if (userSession.isUserSignedIn()) {
        return userSession.loadUserData();
    }
    return null;
};

/* ────────────────────────────────────────────────────────────────
 ⚔️ Leaderboard Contract Functions
──────────────────────────────────────────────────────────────── */

export const submitBattleToBlockchain = async (battleData) => {
    const userData = getUserData();
    if (!userData) throw new Error('Wallet not connected');

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

    const txOptions = {
        contractAddress: CONTRACT_DEPLOYER_ADDRESS,
        contractName: CONTRACTS.LEADERBOARD,
        functionName: 'submit-battle',
        functionArgs,
        network: NETWORK,
        postConditionMode: 1,
    };

    try {
        const transaction = await makeContractCall(txOptions);
        const response = await broadcastTransaction(transaction, NETWORK);

        console.log('✅ Battle submitted:', response);

        // ⛓️ Decode result to see if user predicted correctly
        if (response && response.txid) {
        // Wait a bit for the transaction to confirm
        console.log('⏳ Waiting for confirmation to mint NFT...');
        await new Promise((resolve) => setTimeout(resolve, 10000));

        // Fetch user stats to determine correctness and optionally mint NFT
        const stats = await getUserStats(userData.profile.stxAddress.testnet);
        if (stats && stats.value && stats.value['correct-predictions']) {
            const correct = parseInt(stats.value['correct-predictions'].value);
            const total = parseInt(stats.value['total-predictions'].value);

            if (correct >= total) {
            // 🎉 Mint Battle Victory NFT
            const metadataUri = `https://pongpair-metadata.vercel.app/api/metadata/${userData.profile.stxAddress.testnet}-${Date.now()}`;
            console.log('🏆 Correct prediction! Minting NFT...');

            await mintBattleNFT(userData.profile.stxAddress.testnet, metadataUri);
            }
        }
        }

        return response;
    } catch (error) {
        console.error('❌ Error submitting battle:', error);
        throw error;
    }
};

export const getUserStats = async (userAddress) => {
    try {
        const result = await fetchCallReadOnlyFunction({
        contractAddress: CONTRACT_DEPLOYER_ADDRESS,
        contractName: CONTRACTS.LEADERBOARD,
        functionName: 'get-user-stats',
        functionArgs: [userAddress ? { type: 'principal', value: userAddress } : stringAsciiCV('')],
        network: NETWORK,
        senderAddress: userAddress,
        });

        const jsonResult = cvToJSON(result);
        return jsonResult?.value || null;
    } catch (error) {
        console.error('❌ Error fetching user stats:', error);
        return null;
    }
};

export const getBattleCount = async () => {
    try {
        const result = await fetchCallReadOnlyFunction({
        contractAddress: CONTRACT_DEPLOYER_ADDRESS,
        contractName: CONTRACTS.LEADERBOARD,
        functionName: 'get-battle-count',
        functionArgs: [],
        network: NETWORK,
        senderAddress: CONTRACT_DEPLOYER_ADDRESS,
        });

        const jsonResult = cvToJSON(result);
        return jsonResult?.value ? parseInt(jsonResult.value.value) : 0;
    } catch (error) {
        console.error('❌ Error fetching battle count:', error);
        return 0;
    }
};

export const getBattleById = async (battleId) => {
    try {
        const result = await fetchCallReadOnlyFunction({
        contractAddress: CONTRACT_DEPLOYER_ADDRESS,
        contractName: CONTRACTS.LEADERBOARD,
        functionName: 'get-battle-by-id',
        functionArgs: [uintCV(battleId)],
        network: NETWORK,
        senderAddress: CONTRACT_DEPLOYER_ADDRESS,
        });

        const jsonResult = cvToJSON(result);
        return jsonResult?.value || null;
    } catch (error) {
        console.error('❌ Error fetching battle:', error);
        return null;
    }
};

/* ────────────────────────────────────────────────────────────────
 🧩 Prediction Contract Functions
──────────────────────────────────────────────────────────────── */
export const submitPrediction = async (coinA, coinB, predictedWinner) => {
    const userData = getUserData();
    if (!userData) throw new Error('Wallet not connected');

    const functionArgs = [
        stringAsciiCV(coinA.substring(0, 10)),
        stringAsciiCV(coinB.substring(0, 10)),
        stringAsciiCV(predictedWinner.substring(0, 10)),
    ];

    const txOptions = {
        contractAddress: CONTRACT_DEPLOYER_ADDRESS,
        contractName: CONTRACTS.PREDICTION,
        functionName: 'submit-prediction',
        functionArgs,
        network: NETWORK,
        postConditionMode: 1,
    };

    try {
        const transaction = await makeContractCall(txOptions);
        const response = await broadcastTransaction(transaction, NETWORK);
        console.log('✅ Prediction submitted:', response);
        return response;
    } catch (error) {
        console.error('❌ Error submitting prediction:', error);
        throw error;
    }
};

export const settlePrediction = async (predictionId) => {
    const userData = getUserData();
    if (!userData) throw new Error('Wallet not connected');

    const txOptions = {
        contractAddress: CONTRACT_DEPLOYER_ADDRESS,
        contractName: CONTRACTS.PREDICTION,
        functionName: 'settle-prediction',
        functionArgs: [uintCV(predictionId)],
        network: NETWORK,
        postConditionMode: 1,
    };

    try {
        const transaction = await makeContractCall(txOptions);
        const response = await broadcastTransaction(transaction, NETWORK);
        console.log('✅ Prediction settled:', response);
        return response;
    } catch (error) {
        console.error('❌ Error settling prediction:', error);
        throw error;
    }
};

export const getPrediction = async (predictionId) => {
    try {
        const result = await fetchCallReadOnlyFunction({
        contractAddress: CONTRACT_DEPLOYER_ADDRESS,
        contractName: CONTRACTS.PREDICTION,
        functionName: 'get-prediction',
        functionArgs: [uintCV(predictionId)],
        network: NETWORK,
        senderAddress: CONTRACT_DEPLOYER_ADDRESS,
        });

        const jsonResult = cvToJSON(result);
        return jsonResult?.value || null;
    } catch (error) {
        console.error('❌ Error fetching prediction:', error);
        return null;
    }
};

/* ────────────────────────────────────────────────────────────────
 🏆 NFT Contract Functions
──────────────────────────────────────────────────────────────── */
export const mintBattleNFT = async (recipient, metadataUri) => {
    const userData = getUserData();
    if (!userData) throw new Error('Wallet not connected');

    const functionArgs = [
        { type: 'principal', value: recipient },
        stringAsciiCV(metadataUri.substring(0, 256)),
    ];

    const txOptions = {
        contractAddress: CONTRACT_DEPLOYER_ADDRESS,
        contractName: CONTRACTS.NFT,
        functionName: 'mint-battle-nft',
        functionArgs,
        network: NETWORK,
        postConditionMode: 1,
    };

    try {
        const transaction = await makeContractCall(txOptions);
        const response = await broadcastTransaction(transaction, NETWORK);
        console.log('✅ NFT minted:', response);
        return response;
    } catch (error) {
        console.error('❌ Error minting NFT:', error);
        throw error;
    }
};

export const getTokenUri = async (tokenId) => {
    try {
        const result = await fetchCallReadOnlyFunction({
        contractAddress: CONTRACT_DEPLOYER_ADDRESS,
        contractName: CONTRACTS.NFT,
        functionName: 'get-token-uri',
        functionArgs: [uintCV(tokenId)],
        network: NETWORK,
        senderAddress: CONTRACT_DEPLOYER_ADDRESS,
        });

        const jsonResult = cvToJSON(result);
        return jsonResult?.value || null;
    } catch (error) {
        console.error('❌ Error fetching token URI:', error);
        return null;
    }
};

export const getLastTokenId = async () => {
    try {
        const result = await fetchCallReadOnlyFunction({
        contractAddress: CONTRACT_DEPLOYER_ADDRESS,
        contractName: CONTRACTS.NFT,
        functionName: 'get-last-token-id',
        functionArgs: [],
        network: NETWORK,
        senderAddress: CONTRACT_DEPLOYER_ADDRESS,
        });

        const jsonResult = cvToJSON(result);
        return jsonResult?.value?.value ? parseInt(jsonResult.value.value) : 0;
    } catch (error) {
        console.error('❌ Error fetching last token ID:', error);
        return 0;
    }
};