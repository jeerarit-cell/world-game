const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const RPC_URL = "https://worldchain-mainnet.g.alchemy.com/public"; 
const CONTRACT_ADDRESS = "0xE2d2e88CadDeE4508152972CA8183b654311b144";
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const ABI = [
    "function payoutWinner(address _winner, uint256 _amount) external",
    "function getBalance() public view returns (uint256)"
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

let players = []; 

io.on('connection', (socket) => {
    socket.on('joinQueue', (data) => {
        players.push({ id: socket.id, name: data.name, wallet: data.wallet });
        io.emit('updatePlayers', players);
        if (players.length >= 2) runGame();
    });

    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        io.emit('updatePlayers', players);
    });
});

async function runGame() {
    const winIdx = Math.floor(Math.random() * players.length);
    const winner = players[winIdx];
    io.emit('startSpin', winIdx);
    try {
        const balance = await contract.getBalance();
        if (balance > 0n) {
            const tx = await contract.payoutWinner(winner.wallet, balance);
            await tx.wait();
        }
    } catch (err) { console.error(err); }
    setTimeout(() => { players = []; io.emit('updatePlayers', players); }, 10000);
}

server.listen(process.env.PORT || 3000);
