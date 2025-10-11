import { STACKS_TESTNET, STACKS_MAINNET } from '@stacks/network';

const isMainnet = import.meta.env.VITE_STACKS_ENV === 'mainnet';
export const NETWORK = isMainnet ? STACKS_MAINNET : STACKS_TESTNET;

export const CONTRACT_DEPLOYER_ADDRESS = 'ST2HY49W1BFB4YQZQ9CXETWT9Y3AY50DE8TCXTCCV';

export const CONTRACTS = {
    LEADERBOARD: 'battle-leaderboard-v5',
    NFT: 'battle-nft-v5',
    PREDICTION: 'battle-prediction-v5',
};

export const APP_DETAILS = {
    name: 'PongPair',
    icon: "/vite.svg",
};