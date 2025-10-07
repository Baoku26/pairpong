import {StacksTestnet} from '@stacks/network';
const network = new StacksTestnet();

const DEPLOYER_ADDRESS = 'ST2HY49W1BFB4YQZQ9CXETWT9Y3AY50DE8TCXTCCV'; 
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
    network: network, 
    apiUrl: 'https://api.testnet.hiro.so',
};
