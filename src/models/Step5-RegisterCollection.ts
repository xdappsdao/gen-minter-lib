
import { ethers } from "ethers";
import * as admin from "firebase-admin";
import { getPlatformSettingsData } from "../utils/getPlatformRoyaltyData";
import { GeneratorContractSetup } from "@xdappsdao/generator-setup-library/lib";
const fs = require('fs');
const SA = process.env.SERVICE_ACCOUNT ? process.env.SERVICE_ACCOUNT : '';

export class RegisterCollection {
  chainId: number
  uid: string;
  tokenContractAddress: string;

  constructor(uid: string, chainId: number, tokenContractAddress: string) {
    this.uid = uid;
    this.chainId = chainId;
    this.tokenContractAddress = tokenContractAddress;
  }

  async registerCollection(provider: ethers.providers.JsonRpcProvider, db: admin.firestore.Firestore): Promise<unknown> {
    const path = `genTracking/approvals/pendingSetup`;
    const doc = await db.collection(path).doc(this.uid).get();
    const docData = doc.data();
    const walletMnemonic = ethers.Wallet.fromMnemonic(SA);
    const settings = await getPlatformSettingsData(this.chainId, db, this.uid);
    const abi = ["function setApprovedMinter(address _minter) external"];
    const contract = new ethers.Contract(this.tokenContractAddress, abi, walletMnemonic.connect(provider));
    const mintAdmin = settings.cloudAdminAddress;
    await contract.setApprovedMinter(mintAdmin);
    const pathToUpdate = `requests/registerCollection/tbRegistered`;
    const dataToUpdate = {
      isRegistered: true
    }
    const creatorAddress = docData?.creatorAddress;
    const generatorAddress = settings?.generatorTokenContractAddress as string;
    const generatorTokenId = docData?.generatorTokenId;
    const setupController = new GeneratorContractSetup(this.chainId, creatorAddress, generatorAddress, generatorTokenId, this.tokenContractAddress, this.uid);
    await setupController.setupProject(db);
    await db.collection(pathToUpdate).doc(this.uid).update(dataToUpdate);
    await this._deleteCollectionDeployerTriggerDoc(db);
    await this._deleteCollectionPendingSetupDoc(db);
    // console.log("Deployed Contract : ", deployContract.address);
    return;
  }

  async _deleteCollectionDeployerTriggerDoc(db: admin.firestore.Firestore): Promise<unknown> {
    const path = `requests/registerCollection/tbRegistered/${this.uid}`;
    await db.doc(path).delete();
    return;
  }
  async _deleteCollectionPendingSetupDoc(db: admin.firestore.Firestore): Promise<unknown> {
    const pathToUpdate = `genTracking/chain_${this.chainId.toString()}/active/${this.tokenContractAddress}`;
    const pathToDelete = `genTracking/approvals/pendingSetup/${this.uid}`;
    const doc = await db.doc(pathToDelete).get();
    const docData = doc.data();
    const dataToUpdate = {
      admin: docData?.admin,
      avatarFileName: docData?.avatarFileName,
      bannerFileName: docData?.bannerFileName,
      creatorAddress: docData?.creatorAddress,
      creatorRoyaltyFactor: docData?.creatorRoyaltyFactor,
      generationAnimationFileName: docData?.generationAnimationFileName,
      generatorTokenAnimationFileName: docData?.generatorTokenAnimationFileName,
      generatorTokenCost: docData?.generatorTokenCost,
      generatorTokenImageFileName: docData?.generatorTokenImageFileName,
      placeholderFileName: docData?.placeholderFileName,
      royaltySplitterAddress: docData?.royaltySplitterAddress,
      saleSplitterAddress: docData?.saleSplitterAddress,
      symbol: docData?.symbol,
      totalRoyaltyFactor: docData?.totalRoyaltyFactor
    }
    await db.doc(pathToUpdate).update(dataToUpdate);
    await db.doc(pathToDelete).delete();
    return;
  }

  async _deleteCollectionPendingDoc(db: admin.firestore.Firestore): Promise<unknown> {
    const path = `requests/registerCollection/tbRegistered/${this.uid}`;
    await db.doc(path).delete();
    return;
  }
  async _addCollectionToOwnershipDatabase(provider: ethers.providers.JsonRpcProvider, db: admin.firestore.Firestore): Promise<unknown> {
    const lastBlock = await provider.getBlockNumber();
    const pathToSave = `contractSetup/${this.tokenContractAddress.toLowerCase()}_${this.chainId.toString()}`;
    const dataToSave = {
      blockToStart: (lastBlock - 1),
      chainId: this.chainId,
      contractAddress: this.tokenContractAddress,
    }
    await db.collection(pathToSave).doc(this.uid).set(dataToSave);
    return;
  }

}