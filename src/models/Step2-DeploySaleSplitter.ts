
import { ethers } from "ethers";
import * as admin from "firebase-admin";
const fs = require('fs');
const SA = process.env.SERVICE_ACCOUNT ? process.env.SERVICE_ACCOUNT : '';
const SPLITTER_ABI = JSON.parse(fs.readFileSync("src/contracts/build/SplitRoyalty_sol_SplitRoyalty.abi"));
const splitter_bytecode = fs.readFileSync("src/contracts/build/SplitRoyalty_sol_SplitRoyalty.bin").toString();

export class DeploySaleSplitter {
  amounts: number[];
  receivers: string[];
  chainId: number;
  royaltySplitterAddress: string;
  creatorSaleSplitterAddress: string;
  creatorSaleSplitterFactor: number;
  platformSaleSplitterAddress: string;
  platformSaleSplitterFactor: number;
  totalRoyaltyFactor: number;
  uid: string;

  constructor(royaltySplitterAddress: string, totalRoyaltyFactor: number, creatorSaleSplitterAddress: string, creatorSaleSplitterFactor: number, platformSaleSplitterAddress: string, platformSaleSplitterFactor: number, chainId: number, uid: string) {
    this.chainId = chainId;
    this.creatorSaleSplitterAddress = creatorSaleSplitterAddress.toLowerCase();
    this.royaltySplitterAddress = royaltySplitterAddress.toLowerCase();
    this.creatorSaleSplitterFactor = creatorSaleSplitterFactor;
    this.platformSaleSplitterAddress = platformSaleSplitterAddress.toLowerCase();
    this.platformSaleSplitterFactor = platformSaleSplitterFactor;
    this.totalRoyaltyFactor = totalRoyaltyFactor;
    this.receivers = [creatorSaleSplitterAddress.toLowerCase(), platformSaleSplitterAddress.toLowerCase()];
    this.amounts = [creatorSaleSplitterFactor, platformSaleSplitterFactor];
    this.uid = uid;
  }


  async deploySaleSplitter(provider: ethers.providers.JsonRpcProvider, db: admin.firestore.Firestore): Promise<unknown> {
    const walletMnemonic = ethers.Wallet.fromMnemonic(SA);
    const factory = new ethers.ContractFactory(SPLITTER_ABI, splitter_bytecode, walletMnemonic.connect(provider));
    const contract = await factory.deploy(this.receivers, this.amounts);
    const deployContract = await contract.deployed();
    console.log("Deployed Contract : ", deployContract.address);
    await this.saveSaleResults(deployContract.address, db);
    await this.saveGeneratorRequest(deployContract.address, db)
    return await this.deleteSaleTriggerDoc(db);
  }
  async saveSaleResults(deployedAddress: string, db: admin.firestore.Firestore): Promise<unknown> {
    const pathToSaveResult = `genTracking/chain_${this.chainId.toString()}/splitters`;
    const dataToSaveSplitter = {
      amounts: this.amounts,
      receivers: this.receivers,
      splitterAddress: deployedAddress,
      type: "sale",
      uid: this.uid
    }
    return await db.collection(pathToSaveResult).doc(deployedAddress.toLowerCase()).set(dataToSaveSplitter);
  }

  async saveGeneratorRequest(deployedAddress: string, db: admin.firestore.Firestore): Promise<unknown> {
    const pathToSaveResult = `requests/mintGen/tbMintedGen`;
    const requestDataToSave = {
      saleSplitterAddress: deployedAddress.toLowerCase(),
      royaltySplitterAddress: this.royaltySplitterAddress,
      uid: this.uid,
      chainId: this.chainId,
      totalRoyaltyFactor: this.totalRoyaltyFactor,
      isMinted: false,
      mintBlock: 0,
    }
    return await db.collection(pathToSaveResult).doc(this.uid).set(requestDataToSave);
  }
  async deleteSaleTriggerDoc(db: admin.firestore.Firestore): Promise<unknown> {
    const pathToDelete = `requests/splitters/tbDeployedSale`;
    return await db.collection(pathToDelete).doc(this.uid).delete();
  }

}