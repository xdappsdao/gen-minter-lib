import { ethers } from "ethers";
import * as admin from "firebase-admin";
const fs = require('fs');
const SA = process.env.SERVICE_ACCOUNT ? process.env.SERVICE_ACCOUNT : '';
const SPLITTER_ABI = JSON.parse(fs.readFileSync("src/contracts/build/SplitRoyalty_sol_SplitRoyalty.abi"));
const splitter_bytecode = fs.readFileSync("src/contracts/build/SplitRoyalty_sol_SplitRoyalty.bin").toString();

export class DeployRoyaltySplitter {
  amounts: number[];
  receivers: string[];
  chainId: number;
  creatorRoyaltyAddress: string;
  creatorRoyaltyFactor: number;
  platformRoyaltyAddress: string;
  platformRoyaltyFactor: number;
  uid: string;

  constructor(creatorRoyaltyAddress: string, creatorRoyaltyFactor: number, platformRoyaltyAddress: string, platformRoyaltyFactor: number, chainId: number, uid: string) {
    this.chainId = chainId;
    this.creatorRoyaltyAddress = creatorRoyaltyAddress.toLowerCase();
    this.creatorRoyaltyFactor = creatorRoyaltyFactor;
    this.platformRoyaltyAddress = platformRoyaltyAddress.toLowerCase();
    this.platformRoyaltyFactor = platformRoyaltyFactor;
    this.receivers = [creatorRoyaltyAddress.toLowerCase(), platformRoyaltyAddress.toLowerCase()];
    this.amounts = [creatorRoyaltyFactor, platformRoyaltyFactor];
    this.uid = uid;
  }

  async deployRoyaltySplitter(provider: ethers.providers.JsonRpcProvider, db: admin.firestore.Firestore): Promise<unknown> {
    const walletMnemonic = ethers.Wallet.fromMnemonic(SA);
    const factory = new ethers.ContractFactory(SPLITTER_ABI, splitter_bytecode, walletMnemonic.connect(provider));
    const contract = await factory.deploy(this.receivers, this.amounts);
    const deployContract = await contract.deployed();
    console.log("Deployed Contract : ", deployContract.address);
    await this._saveRoyaltyResults(deployContract.address, db);
    await this._saveSplitterSaleRequest(deployContract.address, db);
    return await this._deleteRoyaltyTriggerDoc(db);
  }
  async _saveRoyaltyResults(deployedAddress: string, db: admin.firestore.Firestore): Promise<unknown> {
    const pathToSaveResult = `genTracking/chain_${this.chainId.toString()}/splitters`;
    const dataToSaveSplitter = {
      amounts: this.amounts,
      receivers: this.receivers,
      splitterAddress: deployedAddress,
      type: "royalty",
      uid: this.uid
    }
    await db.collection(pathToSaveResult).doc(deployedAddress.toLowerCase()).set(dataToSaveSplitter);
    const platformDataToUpdate = {
      platformRoyaltyFactor: this.platformRoyaltyFactor,
      totalRoyaltyFactor: (this.creatorRoyaltyFactor + this.platformRoyaltyFactor),
    }
    const pathToUpdate = `genTracking/approvals/pendingSetup`;
    await db.collection(pathToUpdate).doc(this.uid).update(platformDataToUpdate);
    return;
  }
  async _deleteRoyaltyTriggerDoc(db: admin.firestore.Firestore): Promise<unknown> {
    const pathToDelete = `requests/splitters/tbDeployedRoyalty`;
    return await db.collection(pathToDelete).doc(this.uid).delete();
  }
  async _saveSplitterSaleRequest(deployedAddress: string, db: admin.firestore.Firestore): Promise<unknown> {
    const pathToSaveResult = `requests/splitters/tbDeployedSale`;
    let factor = 0;
    //   for loop to set factor
    for (let i = 0; i < this.amounts.length; i++) {
      factor += this.amounts[i];
    }
    const settingsPath = `settings/chain_${this.chainId.toString()}`;
    const settingsDoc = await db.doc(settingsPath).get();
    const settings = settingsDoc.data();
    const platformSaleFactor = settings?.platformSaleFactor as number;
    const creatorSaleFactor = 10000 - platformSaleFactor;
    //get sale split factor from settings
    const dataToSaveSplitter = {
      creatorSalePaymentAddress: this.creatorRoyaltyAddress,
      platformSalePaymentAddress: this.platformRoyaltyAddress,
      creatorSalePaymentFactor: creatorSaleFactor,
      platformSalePaymentFactor: platformSaleFactor,
      totalRoyaltyFactor: factor,
      royaltySplitterAddress: deployedAddress.toLowerCase(),
      chainId: this.chainId,
      uid: this.uid
    }
    return await db.collection(pathToSaveResult).doc(this.uid).set(dataToSaveSplitter);
  }

}