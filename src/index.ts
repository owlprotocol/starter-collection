import * as dotenv from "dotenv";
import pinataSDK from "@pinata/sdk";
import { TransactionReceipt } from "@ethersproject/providers";
import { Utils, Ethers } from "@owlprotocol/contracts";
import { awaitAllObj } from "@owlprotocol/utils";
import { NFTGenerativeTraitImage, NFTGenerativeCollection, NFTGenerativeCollectionClass } from "@owlprotocol/nft-sdk";
import { zip, fromPairs, pick, mapValues } from "lodash-es";
import { ethers, Signer } from "ethers";
import { join } from "path";
import { readdirSync, readFileSync, writeFileSync } from "fs";

dotenv.config();
const PINATA_JWT = process.env.PINATA_JWT!;
const PRIVATE_KEY_0 = process.env.PRIVATE_KEY_0!;

export async function deployCollectionMetadata(path: string, pinataJWT: string) {
    //Configure Pinata
    const pinata = new pinataSDK({ pinataJWTKey: pinataJWT });
    await pinata.testAuthentication();

    //Upload layer folders to ipfs
    const layers = join(path, "layers");
    const layerDirs = readdirSync(layers);
    const layerPins = await Promise.all(
        layerDirs.map((p) => {
            const path = join(layers, p);
            return pinata.pinFromFS(path, {
                pinataMetadata: {
                    name: path,
                },
                pinataOptions: {
                    cidVersion: 0,
                },
            });
        }),
    );

    //Generate Traits
    //iterate layers/<trait> for trait names
    const traitsArr = zip(layerDirs, layerPins).map(([l, pin]) => {
        const layerValues = readdirSync(join(layers, l!));
        //iterate layers/<trait>/<attribute> for attributes
        const options = layerValues.map((lv) => {
            return {
                value: lv.replace(".png", ""),
                image_url: `ipfs://${pin!.IpfsHash}/${lv}`,
            };
        });
        return {
            name: l!,
            type: "image",
            image_type: "png",
            options: options,
        } as NFTGenerativeTraitImage;
    });
    const traits = fromPairs(traitsArr.map((t) => [t.name, t]));

    //Generate classes
    const collectionInfo = JSON.parse(readFileSync(join(path, "collection.json"), "utf-8")) as {
        name: string;
        description: string;
        external_url: string;
        seller_fee_basis_points: number;
        fee_recipient: string;
        traits: string[];
        children: string[];
    };

    const childrenArr = collectionInfo.children.map((c) => {
        const trait = traits[c];
        if (!trait) throw new Error(`Unknown trait ${c}`);
        const childDef: NFTGenerativeCollection = {
            name: c,
            description: collectionInfo.description,
            external_url: collectionInfo.external_url,
            seller_fee_basis_points: collectionInfo.seller_fee_basis_points,
            fee_recipient: collectionInfo.fee_recipient,
            generatedImageType: "png",
            traits: {
                [c]: traits[c],
            },
        };
        return childDef;
    }) as NFTGenerativeCollection[];
    const children = fromPairs(childrenArr.map((c) => [c.name, c])) as Record<string, NFTGenerativeCollection>;
    const collection: NFTGenerativeCollection = {
        name: collectionInfo.name,
        description: collectionInfo.description,
        external_url: collectionInfo.external_url,
        seller_fee_basis_points: collectionInfo.seller_fee_basis_points,
        fee_recipient: collectionInfo.fee_recipient,
        generatedImageType: "png",
        traits: pick(traits, ...collectionInfo.traits),
        //@ts-ignore
        children,
    };

    //Generate <child>.json
    const childPinsArr = await Promise.all(
        childrenArr.map((c) => {
            const childDefPath = join(path, "output", `${c.name}.json`);
            writeFileSync(childDefPath, JSON.stringify(c.name), "utf-8");
            //Upload <child>.json to IPFS
            return pinata.pinFromFS(childDefPath, {
                pinataMetadata: {
                    name: childDefPath,
                },
                pinataOptions: {
                    cidVersion: 0,
                },
            });
        }),
    );
    const childPins = fromPairs(
        zip(
            collectionInfo.children,
            childPinsArr.map((c) => c.IpfsHash),
        ),
    ) as Record<string, string>;

    //Generate collection.json
    //const parentClass = NFTGenerativeCollectionClass.fromData(parentDef);
    const collectionPath = join(path, "output", "collection.json");
    writeFileSync(collectionPath, JSON.stringify(collection), "utf-8");
    //Upload collection.json to IPFS
    const collectionPin = await pinata.pinFromFS(collectionPath, {
        pinataMetadata: {
            name: collectionPath,
        },
        pinataOptions: {
            cidVersion: 0,
        },
    });

    return {
        children,
        childrenPins: childPins,
        collection: collection,
        collectionPin: collectionPin.IpfsHash,
    };
}

export async function deployCollectionContracts(
    signer: Signer,
    nonce: number,
    metadata: Awaited<ReturnType<typeof deployCollectionMetadata>>,
) {
    //Deploy contract with api url + contractUri
    const signerAddress = await signer.getAddress();
    const { children, childrenPins, collection, collectionPin } = metadata;

    const factories = Ethers.getFactories(signer);
    const cloneFactory = factories.ERC1167Factory.attach(Utils.ERC1167Factory.ERC1167FactoryAddress);
    const deterministicFactories = Ethers.getDeterministicFactories(factories);
    const deterministicInitializeFactories = Ethers.getDeterministicInitializeFactories(
        factories,
        cloneFactory,
        signerAddress,
    );
    const beaconFactory = deterministicInitializeFactories.UpgradeableBeacon;
    const beaconProxyFactories = Ethers.getBeaconProxyFactories(
        deterministicFactories,
        cloneFactory,
        beaconFactory,
        signerAddress,
    );
    const ERC721TopDownDnaMintableFactory = beaconProxyFactories.ERC721TopDownDnaMintable;

    const childInitParams = mapValues(children, (c) => {
        return {
            admin: signerAddress,
            name: c.name,
            symbol: collection.name,
            initBaseURI: `https://metadata.owlprotocol.xyz/metadata/getMetadata/${childrenPins[c.name]}/`,
            contractUri: childrenPins[c.name],
            childContracts721: [], //TODO
            childContracts1155: [],
        };
    });

    //Deploy Child Contracts
    const childContractsPromises = mapValues(childInitParams, async (p) => {
        const childArgs = Utils.ERC721TopDownDna.flattenInitArgsERC721TopDownDna(p);
        const address = ERC721TopDownDnaMintableFactory.getAddress(...childArgs);
        //Compute Deployment Address
        if (!(await ERC721TopDownDnaMintableFactory.exists(...childArgs))) {
            await ERC721TopDownDnaMintableFactory.deploy(...childArgs, { nonce: nonce++, gasLimit: 10e6 });
        }
        return address;
    });
    const childContracts = await awaitAllObj(childContractsPromises);

    //Deploy Collection Contract
    const collectionInitParams = {
        admin: signerAddress,
        name: collection.name,
        symbol: collection.name,
        initBaseURI: `https://metadata.owlprotocol.xyz/metadata/getMetadata/${collectionPin}/`,
        contractUri: collectionPin,
        childContracts721: Object.values(childContracts),
        childContracts1155: [],
    };
    const collectionArgs = Utils.ERC721TopDownDna.flattenInitArgsERC721TopDownDna(collectionInitParams);
    const address = ERC721TopDownDnaMintableFactory.getAddress(...collectionArgs);

    //Compute Deployment Address
    if (!(await ERC721TopDownDnaMintableFactory.exists(...collectionArgs))) {
        await ERC721TopDownDnaMintableFactory.deploy(...collectionArgs, { nonce: nonce++, gasLimit: 10e6 });
    }
    return {
        childContracts,
        address,
        nonce,
    };
}

export async function generateTokenDnas(
    metadata: Awaited<ReturnType<typeof deployCollectionMetadata>>,
    amount: number,
) {
    //Deploy contract with api url + contractUri
    const { children, collection } = metadata;

    //Generate randomized DNA
    //Child DNA
    const childDnas = mapValues(children, (child) => {
        const dnaArr: string[] = []
        const childClass = NFTGenerativeCollectionClass.fromData(child);
        for (let i = 0; i < amount; i++) {
            const instance = childClass.generateInstance();
            const d = instance.dna();
            dnaArr.push(d);
        }
        return dnaArr;
    });

    //Parent DNA
    const collectionClass = NFTGenerativeCollectionClass.fromData(collection);
    const dnas: string[] = [];
    for (let i = 0; i < amount; i++) {
        const instance = collectionClass.generateInstance();
        const d = instance.dna();
        dnas.push(d);
    }

    return {
        childDnas,
        dnas,
    };
}

export async function mintTokens(signer: Signer, address: string, nonce: number, dnas: string[]) {
    const signerAddress = await signer.getAddress();
    const factories = Ethers.getFactories(signer);
    const contract = factories.ERC721TopDownDnaMintable.attach(address);

    const txList = dnas.map((d, i) => contract.mintWithDna(signerAddress, i, d, { nonce: nonce++ }));
    return Promise.all(txList);
}

export async function mintCollectionTokens(
    signer: Signer,
    nonce: number,
    contracts: Awaited<ReturnType<typeof deployCollectionContracts>>,
    dnas: Awaited<ReturnType<typeof generateTokenDnas>>,
) {
    //Mint child tokens
    const childPromises = mapValues(contracts.childContracts, (address, k) => {
        const d = dnas.childDnas[k];
        const p = mintTokens(signer, address, nonce, d);
        nonce = nonce + d.length;
        return p;
    });

    const childTransactions = await awaitAllObj(childPromises);

    //Mint collection tokens
    const parentTransactions = await mintTokens(signer, contracts.address, nonce, dnas.dnas);
    return {
        childTransactions,
        parentTransactions,
    }
}

async function main() {
    const metadata = await deployCollectionMetadata("collections/example-omo", PINATA_JWT);
    const dnas = await generateTokenDnas(metadata, 1);

    /*
    const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
    const signer = new ethers.Wallet(PRIVATE_KEY_0, provider);
    let nonce = await provider.getTransactionCount(await signer.getAddress());

    const contracts = await deployCollectionContracts(signer, nonce, metadata);
    console.debug(contracts);

    nonce = await provider.getTransactionCount(await signer.getAddress());
    const transactions = await mintCollectionTokens(signer, nonce, contracts, dnas);
    console.debug(transactions);
    */
}

main();
