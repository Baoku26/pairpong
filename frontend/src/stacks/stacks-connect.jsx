import { StacksTestnet } from '@stacks/network';

const DEPLOYER_ADDRESS = 'ST2HY49W1BFB4YQZQ9CXETWT9Y3AY50DE8TCXTCCV'; 
export const CONTRACT_ADDRESSES = {
    // Leaderboard Contract
    LEADERBOARD: {
        address: DEPLOYER_ADDRESS,
        name: 'battle-leaderboard',
    },
    // NFT Contract
    NFT: {
        address: DEPLOYER_ADDRESS,
        name: 'battle-nft',
    },
    // Betting 
    BETTING: {
        address: DEPLOYER_ADDRESS,
        name: 'battle-prediction',
    },
};

export const STACKS_NETWORK = {
    network: new StacksTestnet(), 
    apiUrl: 'https://api.testnet.hiro.so',
};
