import {STACKS_TESTNET, STACKS_MAINNET} from '@stacks/network';

const DEPLOYER_ADDRESS = 'ST2HY49W1BFB4YQZQ9CXETWT9Y3AY50DE8TCXTCCV'; 

const isMainnet = import.meta.env.VITE_STACKS_ENV === 'mainnet';
export const NETWORK = isMainnet ? STACKS_MAINNET : STACKS_TESTNET;
export const CONTRACT_ADDRESSES = {
    // Leaderboard Contract
    LEADERBOARD: {
        address: DEPLOYER_ADDRESS,
        name: 'battle-leaderboard-v4',
    },
    // NFT Contract
    NFT: {
        address: DEPLOYER_ADDRESS,
        name: 'battle-nft-v4',
    },
    // Betting 
    BETTING: {
        address: DEPLOYER_ADDRESS,
        name: 'battle-prediction-v4',
    },
};

export const STACKS_NETWORK = {
    network: NETWORK, 
    apiUrl: 'https://api.testnet.hiro.so',
};
