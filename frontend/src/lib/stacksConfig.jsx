import * as network from '@stacks/network';
import {Trophy} from 'lucide-react'

export const NETWORK = new network.StacksTestnet();

export const CONTRACT_DEPLOYER_ADDRESS = 'ST2HY49W1BFB4YQZQ9CXETWT9Y3AY50DE8TCXTCCV';

export const CONTRACTS = {
    LEADERBOARD: 'battle-leaderboard-v4',
    NFT: 'battle-nft-v4',
    PREDICTION: 'battle-prediction-v4',
};

export const appDetails = {
    name: 'PongPair',
    icon: Trophy,
};