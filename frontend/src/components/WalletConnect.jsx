import { useState, useEffect } from 'react';
import Tooltip from '@mui/material/Tooltip';
import { connect, disconnect, isConnected, getLocalStorage } from '@stacks/connect';

const WalletConnect = () => {
    const [connected, setConnected] = useState(false);
    const [address, setAddress] = useState('');

    useEffect(() => {
        if (isConnected()) {
            const data = getLocalStorage();
            const stxAddress = data?.addresses?.stx?.[0]?.address || '';
            setConnected(true);
            setAddress(stxAddress);
        }
    }, []);

    const handleConnect = async () => {
        try {
            await connect();
            const data = getLocalStorage();
            console.log(data);
            const stxAddress = data?.addresses?.stx?.[0]?.address || '';
            setAddress(stxAddress);
            setConnected(true);
        } catch (error) {
            console.error('Connection failed:', error);
        }
    };

    const handleDisconnect = async () => {
        try {
        await disconnect();
        setConnected(false);
        setAddress('');
        } catch (error) {
        console.error('Disconnect failed:', error);
        }
    };

    const truncateAddress = (addr) => {
        if (!addr) return '';
        return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
    };

    return (
        <div className="absolute top-2 right-2 text-white">
        {!connected ? (
            <button
            onClick={handleConnect}
            className="bg-[#3BA76F] hover:brightness-110 text-[#1F2E1F] px-4 py-2 rounded font-bold text-xs border-2 border-[#3BA76F] transition-all"
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