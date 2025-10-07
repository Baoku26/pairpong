import { STACKS_TESTNET, STACKS_MAINNET } from '@stacks/network';
import { Trophy } from 'lucide-react';

const isMainnet = import.meta.env.VITE_STACKS_ENV === 'mainnet';
export const NETWORK = isMainnet ? STACKS_MAINNET : STACKS_TESTNET;

export const CONTRACT_DEPLOYER_ADDRESS = 'ST2HY49W1BFB4YQZQ9CXETWT9Y3AY50DE8TCXTCCV';

export const CONTRACTS = {
    LEADERBOARD: 'battle-leaderboard-v4',
    NFT: 'battle-nft-v4',
    PREDICTION: 'battle-prediction-v4',
};

export const APP_DETAILS = {
    name: 'PongPair',
    icon: Trophy,
};