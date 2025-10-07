# Crypto Pong Battle

A decentralized gaming platform that combines classic Pong gameplay with real-time cryptocurrency price data and blockchain-based leaderboards on the Stacks network.

## Overview

Crypto Pong Battle is an innovative Web3 game where two cryptocurrencies compete in a Pong match. The game mechanics are directly influenced by real market data, paddle sizes adjust based on price performance, speeds change with volatility, and the winner is determined by actual price movements over a 20-second battle period.

## Features

- **Real-time Price Integration**: Fetches live cryptocurrency data from CoinGecko API
- **Dynamic Gameplay**: Paddle heights and speeds respond to actual market volatility
- **Blockchain Leaderboard**: Permanent, immutable score tracking on Stacks blockchain
- **NFT Rewards**: Mint victory NFTs for winning battles
- **Betting Mechanism**: Wager STX tokens on battle outcomes

## Stacks Integration

### Smart Contracts (Clarity)

We utilize Clarity smart contracts for:

1. **Leaderboard Contract** (`battle-leaderboard.clar`)
   - Stores all battle results on-chain
   - Tracks player statistics (wins, losses, highest performance)
   - Immutable battle history
   - Query functions for rankings

2. **Battle NFT Contract** (`battle-nft.clar`) 
   - Mint commemorative NFTs for victories
   - Metadata includes battle details, coins, performance delta
   - SIP-009 compliant

3. **Prediction Contract** (`battle-betting.clar`)
   - Allow users to wager STX on battle outcomes
   - Automated payout based on results
   - Fee distribution to protocol treasury

### Stacks.js Integration

The frontend uses `@stacks/connect` and `@stacks/transactions` for:

- **Wallet Connection**: Leather/Xverse wallet integration
- **Contract Calls**: Submit battle results to blockchain
- **Read Operations**: Fetch leaderboard data
- **Transaction Signing**: Authenticate battle submissions

### Architecture

```
Frontend (React + Canvas)
    ↓
CoinGecko API → Price Data
    ↓
Game Logic → Battle Results
    ↓
Stacks.js → Contract Interaction
    ↓
Clarity Contracts → On-chain Storage
```

## Installation

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Stacks wallet (Leather or Xverse)

### Setup

```bash
# Clone repository
git clone https://github.com/yourusername/pairpong.git
cd pairpong

# Install dependencies
cd frontend
npm install

# Run development server
npm run dev
```

### Deploy Contracts

```bash
cd smart-contract
# Install Clarinet
curl -L https://github.com/hirosystems/clarinet/releases/download/v1.8.0/clarinet-linux-x64.tar.gz | tar xz

#add your settings folder in the smart-contract folder
create 3 files: Testnet.toml, Devnet.toml, and Mainnet.toml

```
[network]
name = "mainnet/testnet/devnet"#fix based on the network you are working with
node_rpc_address = "https://api.hiro.so"

[accounts.deployer]
mnemonic = "enter your 24 word seed phrase"
```
put all these in the 3 files and the name will differ based on the files

# Compile contracts
clarinet check

#generate deloyments for testnet
clarinet deployments generate --testnet --low-cost

# Deploy to testnet
clarinet deployments apply --testnet

# Deploy to mainnet
clarinet deploy --mainnet
```

## Usage

1. **Connect Wallet**: Click "Connect Wallet" to authenticate with Stacks
2. **Select Coins**: Choose two cryptocurrencies from the dropdown (100+ available)
3. **Start Battle**: Click START to begin the 20-second battle
4. **Watch Live**: Paddles dynamically adjust based on real price movements
5. **Submit Results**: After battle, submit results to blockchain for leaderboard entry

## Smart Contract Functions

### Leaderboard Contract

```clarity
;; Submit battle result
(define-public (submit-battle 
  (coin-a (string-ascii 10))
  (coin-b (string-ascii 10))
  (winner (string-ascii 10))
  (performance-delta uint)
  (score-a uint)
  (score-b uint)))

;; Get user stats
(define-read-only (get-user-stats (user principal)))

;; Get top players
(define-read-only (get-leaderboard (limit uint)))
```

### Usage Example

```javascript
import { openContractCall } from '@stacks/connect';
import { uintCV, stringAsciiCV } from '@stacks/transactions';

const submitBattleResult = async (battleData) => {
  await openContractCall({
    network,
    contractAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
    contractName: 'battle-leaderboard',
    functionName: 'submit-battle',
    functionArgs: [
      stringAsciiCV(battleData.coinA),
      stringAsciiCV(battleData.coinB),
      stringAsciiCV(battleData.winner),
      uintCV(battleData.performanceDelta * 100),
      uintCV(battleData.scoreA),
      uintCV(battleData.scoreB)
    ],
    onFinish: (data) => {
      console.log('Battle submitted:', data);
    }
  });
};
```

## Technical Stack

- **Frontend**: React, Vite, Tailwind CSS
- **Blockchain**: Stacks, Clarity smart contracts
- **APIs**: CoinGecko (price data), Stacks API (blockchain queries)
- **Canvas**: HTML5 Canvas for game rendering
- **Wallet**: Stacks Connect for authentication

## Game Mechanics

### Price-Driven Physics

- **Paddle Height**: Scales 60-160px based on cumulative price change
- **Paddle Speed**: Increases with volatility (absolute price change rate)
- **Ball Velocity**: Multiplied by combined market momentum
- **Winner**: Determined by total price performance over battle duration

### Scoring System

- Traditional Pong scoring (paddle misses = opponent point)
- Blockchain leaderboard ranks by:
  - Total wins
  - Average performance delta
  - Highest single-battle performance

## Future Enhancements

- [ ] NFT minting for battle victories
- [ ] STX token betting pools
- [ ] Tournament mode with bracket system
- [ ] Multiplayer battles (real-time PvP)
- [ ] Achievement badges as SFTs
- [ ] Integration with DeFi protocols for prize pools

## API Rate Limits

CoinGecko free tier: 10-50 calls/minute
- Implemented 1-second rate limiting
- Exponential backoff on failures
- Fallback data generation

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## Hackathon Submission

**Event**: Stacks BUIDL Hackathon 2025  
**Category**: Gaming & NFTs  
**Team**: TeamX
**Demo**: https://www.pingpong.vercel.app
**Video**: https://www.youtube.com

## Acknowledgments

- CoinGecko for cryptocurrency data API
- Stacks Foundation for blockchain infrastructure
- Hiro for development tools (Clarinet, Stacks.js)