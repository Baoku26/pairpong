import { useState, useEffect } from 'react';
import Tooltip from '@mui/material/Tooltip';
import { connectWallet, disconnectWallet, getUserData, userSession, subscribeAuth } from '../lib/stacksService';

const WalletConnect = () => {
    const [isConnected, setIsConnected] = useState(false);
    const [address, setAddress] = useState(''); 

    useEffect(() => {
        checkConnection();

        // subscribe to auth changes
        const unsubscribe = subscribeAuth((connected) => {
            setIsConnected(connected);
            if (connected) {
                const userData = getUserData();
                setAddress(userData?.profile?.stxAddress?.testnet || '');
            } else {
                setAddress('');
            }
        });

        return () => unsubscribe();
    }, []);

    const checkConnection = () => {
        if (userSession.isUserSignedIn()) {
            const userData = getUserData();
            setIsConnected(true);
            setAddress(userData?.profile?.stxAddress?.testnet || '');
        } else {
            setIsConnected(false);
            setAddress('');
        }
    };

    const handleConnect = () => {
        // connectWallet now takes no callbacks — internal subscribeAuth will notify on finish or cancel
        connectWallet();
    };

    const handleDisconnect = () => {
        disconnectWallet();
        setIsConnected(false);
        setAddress('');
    };

    const truncateAddress = (addr) => {
        if (!addr) return '';
        return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
    };

    return (
        <div className="absolute top-2 right-2 hover:brightness-110 text-white py-2 px-4 rounded transition-all text-xs font-bold border-2">
        {!isConnected ? (
            <button
            onClick={handleConnect}
            className="bg-[#3BA76F] border-[#3BA76F] hover:brightness-110 text-[#1F2E1F] px-4 py-2 rounded font-bold text-xs transition-all"
            >
            CONNECT WALLET
            </button>
        ) : (
            <Tooltip title="Disconnect Wallet" placement="left">
            <div className="flex items-center gap-2">
                <div className="bg-[#26462F] text-[#A8F0A2] px-3 py-2 rounded text-xs border border-[#3BA76F]">
                {truncateAddress(address)}
                </div>
                <button
                onClick={handleDisconnect}
                className="bg-[#FF7676] hover:brightness-110 text-white px-3 py-2 rounded font-bold text-xs transition-all"
                >
                DISCONNECT
                </button>
            </div>
            </Tooltip>
        )}
        </div>
    );
};

export default WalletConnect;