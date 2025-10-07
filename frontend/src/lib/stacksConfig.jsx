import { StacksTestnet, StacksMainnet } from '@stacks/network';
import {Trophy} from 'lucide-react'

export const NETWORK = new StacksTestnet();

export const CONTRACT_ADDRESS = 'ST2HY49W1BFB4YQZQ9CXETWT9Y3AY';

export const CONTRACTS = {
    LEADERBOARD: 'battle-leaderboard',
    NFT: 'battle-nft',
    BETTING: 'battle-betting',
};

const appDetails = {
    name: 'PongPair',
    icon: Trophy,
};