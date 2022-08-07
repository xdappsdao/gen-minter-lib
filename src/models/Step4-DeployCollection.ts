
import { ethers } from "ethers";
import * as admin from "firebase-admin";
const fs = require('fs');
const SA = process.env.SERVICE_ACCOUNT ? process.env.SERVICE_ACCOUNT : '';
const TOKEN_CONTRACT_ABI = JSON.parse(fs.readFileSync("src/contracts/build/GlobalTokenContract721_sol_GlobalTokenContract721.abi"));
const token_contract_bytecode = fs.readFileSync("src/contracts/build/GlobalTokenContract721_sol_GlobalTokenContract721.bin").toString();

export class DeployCollection {
  chainId: number
  uid: string;
  royaltyFactor: number;

  constructor(uid: string, royaltyFactor: number, chainId: number) {
    this.uid = uid;
    this.chainId = chainId;
    this.royaltyFactor = royaltyFactor;
  }

  async deployCollection(provider: ethers.providers.JsonRpcProvider, db: admin.firestore.Firestore): Promise<unknown> {
    const path = `genTracking/approvals/pendingSetup`;
    const doc = await db.collection(path).doc(this.uid).get();
    const docData = doc.data();
    const collectionName = docData?.name;
    const symbol = docData?.symbol;
    const royaltyFactor = docData?.totalRoyaltyFactor;
    const royaltyAddress = docData?.royaltySplitterAddress;
    const walletMnemonic = ethers.Wallet.fromMnemonic(SA);
    const factory = new ethers.ContractFactory(TOKEN_CONTRACT_ABI, token_contract_bytecode, walletMnemonic.connect(provider));
    const contract = await factory.deploy(collectionName, symbol, royaltyAddress, royaltyFactor);
    const deployContract = await contract.deployed();
    await this._saveCollectionDeployedResults(deployContract.address, db);
    await this._saveCollectionRegistrationRequest(deployContract.address, db);
    return await this._deleteDeployCollectionTriggerDoc(db);
  }

  async _saveCollectionDeployedResults(deployedAddress: string, db: admin.firestore.Firestore): Promise<unknown> {
    const path = `genTracking/approvals/pendingSetup`;
    const doc = await db.collection(path).doc(this.uid).get();
    const dataToUpdate = {
      tokenContractAddress: deployedAddress
    }
    await doc.ref.update(dataToUpdate);
    return;
  }

  async _saveCollectionRegistrationRequest(deployedAddress: string, db: admin.firestore.Firestore): Promise<unknown> {
    const pathToSaveResult = `requests/registerCollection/tbRegistered`;
    const dataToSave = {
      uid: this.uid,
      chainId: this.chainId,
      tokenContractAddress: deployedAddress.toLowerCase(),
      isRegistered: false
    }
    return await db.collection(pathToSaveResult).doc(this.uid).set(dataToSave);
  }

  async _deleteDeployCollectionTriggerDoc(db: admin.firestore.Firestore): Promise<unknown> {
    const pathToDelete = `requests/deployCollection/tbDeployedCollection`;
    return await db.collection(pathToDelete).doc(this.uid).delete();
  }
}