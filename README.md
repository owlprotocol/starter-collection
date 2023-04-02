# OWL Protocol Contracts Template
Template project for developing custom dNFT smart contracts and utilities.

## Project Structure
- [/contracts](./contracts/): Solidity contracts
- [/src/deploy](./src/deploy): Deploy functions, these do **not** require Hardhat Runtime Environment (HRE) and only need an ethereum provider as an argument. This enables deploying your contracts in other environments.
- [/src/deploy-hre](./src/deploy-hre): Deploy functions using Hardhat Runtime Environment (HRE). Uses the provider injected globally by hardhat.
- [/src/utils](./src/utils): Additional Typescript utilities to enable easier integration with your contracts such as exporting custom types and artifacts.

## Dependencies
- [@owlprotocol/contracts](https://github.com/owlprotocol/owlprotocol/tree/main/packages/contracts): Owl Protocol dNFT contracts.

## Installation
```
pnpm i
```