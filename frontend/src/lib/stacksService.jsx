import { request, getLocalStorage, isConnected, disconnect } from '@stacks/connect';
import {
  uintCV,
  stringAsciiCV,
  principalCV,
  cvToJSON,
  cvToHex,
  hexToCV
} from '@stacks/transactions';
import { CONTRACT_DEPLOYER_ADDRESS, CONTRACTS } from './stacksConfig';

// --- API Setup ---
const API_BASE_URL = import.meta.env.VITE_STACKS_ENV === 'mainnet'
    ? 'https://api.mainnet.hiro.so'
    : 'https://api.testnet.hiro.so';

// --- Helper function to call read-only functions ---
const callReadOnlyViaAPI = async (contractAddress, contractName, functionName, args = []) => {
    try {
        const url = `${API_BASE_URL}/v2/contracts/call-read/${contractAddress}/${contractName}/${functionName}`;
        console.log("Calling read-only function....", { url, functionName, argsCount: args.length })
        const hexArgs = args.map((arg) => cvToHex(arg))
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                sender: contractAddress,
                arguments: hexArgs,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text()
            console.error("API error response:", errorText)
            throw new Error(`HTTP ${response.status}: ${errorText}`)
        };

        const data = await response.json();
        console.log("Read-only call response:", data);

        if (data.okay && data.result) {
            console.log("Converted CV:", cvToJSON(hexToCV(data.result)));
            return hexToCV(data.result)
        }

        throw new Error("Invalid response format")
    } catch (error) {
        console.error("Read-only call failed:", error)
        throw error
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
            contract: `${CONTRACT_DEPLOYER_ADDRESS}.${CONTRACTS.LEADERBOARD}`,
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
            network: import.meta.env.VITE_STACKS_ENV
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
            contract: `${CONTRACT_DEPLOYER_ADDRESS}.${CONTRACTS.PREDICTION}`,
            functionName: 'submit-prediction',
            functionArgs: [
                stringAsciiCV(coinA.substring(0, 10)),
                stringAsciiCV(coinB.substring(0, 10)),
                stringAsciiCV(predictedWinner.substring(0, 10)),
            ],
            network: import.meta.env.VITE_STACKS_ENV
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
            contract: `${CONTRACT_DEPLOYER_ADDRESS}.${CONTRACTS.PREDICTION}`,
            functionName: 'settle-prediction',
            functionArgs: [uintCV(predictionId)],
            network: import.meta.env.VITE_STACKS_ENV
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
            contract: `${CONTRACT_DEPLOYER_ADDRESS}.${CONTRACTS.NFT}`,
            functionName: 'mint-battle-nft',
            functionArgs: [
                principalCV(recipient),
                stringAsciiCV(metadataUri.substring(0, 256)),
            ],
            network: import.meta.env.VITE_STACKS_ENV
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
            'get-leaderboard-stats',
            [principalCV(addr)]
        );
        
        const json = cvToJSON(result);
        const stats = json?.value?.value || {};
        
        return {
            wins: Number(stats["correct-predictions"]?.value || 0),
            losses: Number(stats["wrong-predictions"]?.value || 0),
            totalPredictions: Number(stats["total-predictions"]?.value || 0),
            points: Number(stats.points?.value || 0),
            highestDelta: Number(stats["highest-delta"]?.value || 0),
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
            delta: Number(battleData.delta?.value || 0),
            scoreA: Number(battleData['score-a']?.value || 0),
            scoreB: Number(battleData['score-b']?.value || 0),
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