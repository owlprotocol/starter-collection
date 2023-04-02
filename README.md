# OWL Protocol Starter Collection

Template generative NFT Collection with tradeable attributes that can be attached and detached as composable NFTs.

## Guide

### Clone the project

```
git clone https://github.com/owlprotocol/starter-collection.git
```

### Configure Layers

Edit [collections/](./collections/) folder by copying the example folder and adding your custom [layers](./collections/example-omo/layers/) and editing the [collection.json](./collections/example-omo/collection.json) that store your description, and the name of your layers.
Layers marked as `traits` will get assigned to the parent NFT.
Layers marked as `children` will be standalone attachable NFTs.

### NodeJS

Install NodeJS.
https://nodejs.org/en

### Dependencies

Install dependencie with npm.

```
npm install
```

## Configure .env file

Configure your environment variables that will be used to connect to the blockchain and IPFS.
Create a file called `.env`. Follow the next steps to generate a `.env` file with the following variables:

```
PRIVATE_KEY_0=<YOUR_PRIVATE_KEY>
RPC_URL=https://<blockchain>.infura.io/v3/<API_KEY>
PINATA_JWT=<PINATA_JWT>
```

### Generate Private Key

**Download Metamask**
Download [Metamask](https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn?hl=en)

**Add custom network (optional)**
We recommend using a testnet to try things out before going on a live blockchain. To do so you can add a testnet of your choice using [chainlist.org/](https://chainlist.org/). Polygon Mumbai is easy to use and has a working faucet. Click [here](https://chainlist.org/?testnets=true&search=mumbai) to easily add it to Metamask.

**Create new hot wallet account**
In your Metamamask, you will now generate a new account that will be used **exclusively** for programmatic use. Do **not** use this account for storing large amounts of crypto or personal crypto assets.

-   Open Metamask
-   Click the profile icon
-   Click "+ Create account" & name it "Hot Wallet"
    **Export hot wallet private key**
-   Click the details "..." button
-   Click "Account Details"
-   Click "Export Private Key"\
-   Copy paste the private key into the `.env` file `PRIVATE_KEY_0=<YOUR_PRIVATE_KEY>`

**Fund hot wallet**
If using a testnet:

-   Use a faucet to fund your wallet for free. For example you can use [faucet.polygon.technology/](https://faucet.polygon.technology/) to fund your account on Mumbai testnet.
    If using a mainnet:
-   Using another of your accounts, fund the "Hot Wallet" with some ETH, MATIC, BNB, or whatever crypto your chain of choice is using. We recommend starting with a testnet first and using a free faucet.

### Infura (Blockchain RPC)

Infura will be used as our blockchain connection.

-   Setup an account at [infura.io](https://infura.io).
-   Create a new Web3 project
-   (optional) Add Polygon add-on (free but requires credit card)
-   Go to the "Endpoints" section on Infura and copy the endpoint for your blockchain of choice to the `.env` file (Ethereum, Polygon, BSC, testnets...)
-   The endpoint should have the following format `https://<blockchain>.infura.io/v3/<INFURA_KEY>`
    -   `<blockchain>` can be a testnet (eg. `goerli`, `polygon-mumbai` ) or a mainnet (eg. `mainnet`, `polygon-mainnet`)
    -   `<INFURA_KEY>` is your API Key

### Pinata (IPFS Provider)

Pinata will be used as our IPFS provider to store metadata.

-   Setup an account at [pinata.cloud](https://www.pinata.cloud/)
-   Generate an API Key for Pinata [app.pinata.cloud/developers/api-keys](https://app.pinata.cloud/developers/api-keys)
-   Copy JWT token to `.env` file (see next section)

### Run full deploy script

Run the end-to-end deploy script to deploy your collection. This will do the following steps:

-   Generate IPFS metadata files for parent and child collection & Upload to Pinata
-   Generate dna encoding for on-chain metadata for parent and child tokens
-   Deploy parent and child ERC721 smart contracts
-   Mint parent and child NFT tokens and attach them

Once deployed your script should log the deployed contract addresses.
If deployed on a supported network, you can view them on [opensea.io/](https://opensea.io/) or [testnets.opensea.io/](https://testnets.opensea.io/)
