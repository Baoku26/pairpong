import {
    UserSession,
    showConnect,
} from '@stacks/connect';
import { STACKS_NETWORK } from './contract-constants';
import {Trophy} from 'lucide-react';

const appDetails = {
    name: 'PongPair',
    icon: Trophy,
};

// Initialize User Session
export const userSession = new UserSession({ appDetails });

/**
 * Initiates the wallet connection flow.
 */
export const connectWallet = () => {
    showConnect({
        appDetails,
        network: STACKS_NETWORK.network,
        onFinish: (data) => {
            console.log('Wallet connected successfully:', data);
        },
        onCancel: () => {
            console.log('Wallet connection canceled.');
        },
        userSession,
    });
};

/**
 * Retrieves the user's Stacks address if they are authenticated.
 */
export const getStxAddress = () => {
    if (userSession.isUserSignedIn()) {
        const userData = userSession.loadUserData();
        // Returns the Testnet address
        return userData.profile.stxAddress.testnet; 
    }
    return null;
};

/**
 * Signs the user out.
 */
export const disconnectWallet = () => {
    userSession.signUserOut();
    window.location.reload();
};
